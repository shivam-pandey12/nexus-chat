import crypto from 'node:crypto';

import { CHAT_LIMITS, NOTIFICATION_PREFERENCES, NOTIFICATION_TYPES } from '../../shared/chatConfig.js';
import {
  getCategoryConfig,
  getCategoryForNotificationGroup,
  getCategorySlug,
} from '../../shared/categoryConfig.js';
import {
  sanitizeIdentifier,
  sanitizeNotificationBody,
  sanitizeNotificationPreferences,
  sanitizeNotificationTitle,
  sanitizeNotificationType,
  sanitizeRoomNotificationState,
} from './safetyService.js';

export function createNotificationService({ repositories = {}, pushService = null, logger = console } = {}) {
  const notificationRepository = repositories.notificationRepository || {};
  const userRepository = repositories.userRepository || {};
  const userSockets = new Map();
  let emitToSocket = () => {};

  function setEmitter(emitter) {
    emitToSocket = typeof emitter === 'function' ? emitter : () => {};
  }

  function registerUserSocket(userId, socketId) {
    if (!userId || !socketId) {
      return;
    }

    const cleanUserId = String(userId);
    const sockets = userSockets.get(cleanUserId) || new Set();
    sockets.add(socketId);
    userSockets.set(cleanUserId, sockets);
  }

  function unregisterSocket(socketId) {
    for (const [userId, sockets] of userSockets.entries()) {
      sockets.delete(socketId);

      if (sockets.size === 0) {
        userSockets.delete(userId);
      }
    }
  }

  async function listNotifications(userId) {
    const cleanUserId = sanitizeIdentifier(userId, 'User');
    const notifications = await notificationRepository.listForUser?.(
      cleanUserId,
      CHAT_LIMITS.MAX_NOTIFICATIONS_LOAD,
    );
    return {
      notifications: (notifications || []).map(serializeNotification).filter(Boolean),
      unreadCount: await countUnread(cleanUserId),
    };
  }

  async function countUnread(userId) {
    const cleanUserId = sanitizeIdentifier(userId, 'User');
    const count = await notificationRepository.countUnread?.(cleanUserId, CHAT_LIMITS.MAX_NOTIFICATIONS_LOAD);
    return Number(count || 0);
  }

  async function markRead(userId, notificationId) {
    const cleanUserId = sanitizeIdentifier(userId, 'User');
    const cleanNotificationId = sanitizeIdentifier(notificationId, 'Notification');
    await notificationRepository.markRead?.(cleanUserId, cleanNotificationId, new Date().toISOString());
    await emitUnreadCount(cleanUserId);
    return { notificationId: cleanNotificationId };
  }

  async function markAllRead(userId) {
    const cleanUserId = sanitizeIdentifier(userId, 'User');
    const count = await notificationRepository.markAllRead?.(cleanUserId, new Date().toISOString());
    await emitUnreadCount(cleanUserId);
    return { count: Number(count || 0) };
  }

  async function dismiss(userId, notificationId) {
    const cleanUserId = sanitizeIdentifier(userId, 'User');
    const cleanNotificationId = sanitizeIdentifier(notificationId, 'Notification');
    await notificationRepository.dismiss?.(cleanUserId, cleanNotificationId, new Date().toISOString());
    await emitUnreadCount(cleanUserId);
    return { notificationId: cleanNotificationId };
  }

  async function updatePreferences(userId, settings) {
    const cleanUserId = sanitizeIdentifier(userId, 'User');
    const profile = await userRepository.get?.(cleanUserId);
    const nextSettings = {
      ...(profile?.settings || {}),
      notificationPreferences: sanitizeNotificationPreferences(settings),
    };
    const updated = await userRepository.updateNotificationSettings?.(cleanUserId, nextSettings);
    return updated?.settings?.notificationPreferences || nextSettings.notificationPreferences;
  }

  async function markRoomRead(user, roomId, state = {}) {
    if (!user?.userId) {
      return { roomId, unreadCount: 0 };
    }

    const cleanUserId = sanitizeIdentifier(user.userId, 'User');
    const cleanRoomId = sanitizeIdentifier(roomId, 'Room');
    await userRepository.markRoomRead?.(cleanUserId, cleanRoomId, {
      lastReadAt: state.lastReadAt || new Date().toISOString(),
      lastReadMessageId: state.lastReadMessageId || '',
    });
    return { roomId: cleanRoomId, unreadCount: 0 };
  }

  async function updateRoomNotificationState(user, roomId, payload = {}) {
    if (!user?.userId) {
      return { roomId, localOnly: true };
    }

    const cleanUserId = sanitizeIdentifier(user.userId, 'User');
    const cleanRoomId = sanitizeIdentifier(roomId, 'Room');
    const state = sanitizeRoomNotificationState(payload);
    await userRepository.updateJoinedRoom?.(cleanUserId, cleanRoomId, {
      ...state,
      notificationSettingsVersion: 7,
      updatedAt: new Date().toISOString(),
    });
    return { roomId: cleanRoomId, ...state };
  }

  async function createNotification(payload = {}) {
    if (!payload.userId || !NOTIFICATION_TYPES.includes(payload.type)) {
      return null;
    }

    const userId = sanitizeIdentifier(payload.userId, 'User');

    if (!(await shouldCreateNotification(userId, payload))) {
      return null;
    }

    const now = new Date().toISOString();
    const notification = {
      notificationId: payload.notificationId || createId('ntf'),
      userId,
      roomId: payload.roomId ? safeOptionalIdentifier(payload.roomId) : '',
      actorUserId: payload.actorUserId ? safeOptionalIdentifier(payload.actorUserId) : '',
      actorName: sanitizeNotificationTitle(payload.actorName || ''),
      type: sanitizeNotificationType(payload.type),
      title: sanitizeNotificationTitle(payload.title),
      body: sanitizeNotificationBody(payload.body),
      targetView: sanitizeTargetView(payload.targetView || ''),
      targetUrl: sanitizeTargetUrl(payload.targetUrl || ''),
      createdAt: payload.createdAt || now,
      readAt: null,
      dismissedAt: null,
      metadata: sanitizeMetadata(payload.metadata),
    };

    await notificationRepository.create?.(userId, notification);
    emitToUser(userId, 'notification:new', serializeNotification(notification));
    await emitUnreadCount(userId);
    pushService
      ?.sendNotification?.({ userId, notification: serializeNotification(notification) })
      .catch((error) => logger.warn?.('Push notification skipped safely.', { error }));
    return notification;
  }

  async function handleMessageCreated({ room, message, replyTo = null, mentions = [], memberRecords = [], activeSessionIds = [] }) {
    const activeSessions = new Set(activeSessionIds || []);
    const recipients = dedupeMembers(memberRecords).filter((member) => member.userId && member.userId !== message.senderUserId);
    const preview = createPreview(message.content);

    await Promise.all(
      recipients
        .filter((member) => !activeSessions.has(member.sessionId))
        .slice(0, CHAT_LIMITS.MAX_UNREAD_FANOUT_PER_MESSAGE)
        .map((member) =>
          userRepository.incrementRoomUnread?.(member.userId, room.roomId, {
            lastUnreadAt: message.createdAt,
            latestMessagePreview: preview,
            latestMessageAt: message.createdAt,
            latestMessageId: message.messageId,
            roomSnapshot: toRoomSnapshot(room),
          }),
        ),
    );

    const mentionedUserIds = new Set(
      (mentions || [])
        .map((mention) => mention.userId)
        .filter((userId) => userId && userId !== message.senderUserId),
    );

    await Promise.all(
      [...mentionedUserIds].map((userId) =>
        createNotification({
          userId,
          roomId: room.roomId,
          actorUserId: message.senderUserId || '',
          actorName: message.senderName,
          type: 'mention',
          title: `${message.senderName} mentioned you`,
          body: `${room.title}: ${preview}`,
          targetView: 'room',
          targetUrl: `/room/${room.inviteCode}`,
          metadata: { roomId: room.roomId, messageId: message.messageId, ...toCategoryMetadata(room) },
        }),
      ),
    );

    if (replyTo?.senderUserId && replyTo.senderUserId !== message.senderUserId) {
      await createNotification({
        userId: replyTo.senderUserId,
        roomId: room.roomId,
        actorUserId: message.senderUserId || '',
        actorName: message.senderName,
        type: 'reply',
        title: `${message.senderName} replied to you`,
        body: `${room.title}: ${preview}`,
        targetView: 'room',
        targetUrl: `/room/${room.inviteCode}`,
        metadata: {
          roomId: room.roomId,
          messageId: message.messageId,
          replyToMessageId: replyTo.replyToMessageId,
          ...toCategoryMetadata(room),
        },
      });
    }
  }

  async function notifyAnnouncement({ room, announcement, actor, memberRecords = [] }) {
    const recipients = dedupeMembers(memberRecords).filter((member) => member.userId && member.userId !== actor?.userId);

    await Promise.all(
      recipients.slice(0, CHAT_LIMITS.MAX_UNREAD_FANOUT_PER_MESSAGE).map((member) =>
        createNotification({
          userId: member.userId,
          roomId: room.roomId,
          actorUserId: actor?.userId || '',
          actorName: actor?.displayName || announcement.createdByName,
          type: 'room_announcement',
          title: announcement.title,
          body: `${room.title}: ${announcement.body}`,
          targetView: 'room',
          targetUrl: `/room/${room.inviteCode}`,
          metadata: { roomId: room.roomId, announcementId: announcement.announcementId, ...toCategoryMetadata(room) },
        }),
      ),
    );
  }

  async function getAdminSummary() {
    const recent = await notificationRepository.listRecent?.(100);
    const safeRecent = (recent || []).map(serializeNotification).filter(Boolean);

    return {
      sampled: safeRecent.length,
      unreadSample: safeRecent.filter((item) => !item.readAt && !item.dismissedAt).length,
      byType: safeRecent.reduce((acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      }, {}),
      recent: safeRecent.slice(0, 20),
    };
  }

  async function emitUnreadCount(userId) {
    emitToUser(userId, 'notifications:unread', { unreadCount: await countUnread(userId) });
  }

  function emitToUser(userId, event, payload) {
    for (const socketId of userSockets.get(String(userId)) || []) {
      emitToSocket(socketId, event, payload);
    }
  }

  async function shouldCreateNotification(userId, payload) {
    const profile = await userRepository.get?.(userId);
    const preferences = {
      ...NOTIFICATION_PREFERENCES,
      ...(profile?.settings?.notificationPreferences || {}),
    };
    const preferenceKey = preferenceKeyFor(payload.type);

    if (preferenceKey && preferences[preferenceKey] === false) {
      return false;
    }

    if (payload.roomId) {
      const relationships = await userRepository.listJoinedRooms?.(userId, CHAT_LIMITS.MAX_MY_ROOMS_QUERY);
      const relationship = (relationships || []).find((item) => item.roomId === payload.roomId);

      if (
        relationship?.notificationSettingsVersion === 7 &&
        relationship?.notificationsEnabled === false &&
        payload.type !== 'moderation_action'
      ) {
        return false;
      }

      if (isRoomMuted(relationship)) {
        return false;
      }
    }

    return true;
  }

  return {
    countUnread,
    createNotification,
    dismiss,
    getAdminSummary,
    handleMessageCreated,
    listNotifications,
    markAllRead,
    markRead,
    markRoomRead,
    notifyAnnouncement,
    registerUserSocket,
    setEmitter,
    unregisterSocket,
    updatePreferences,
    updateRoomNotificationState,
  };
}

function serializeNotification(notification) {
  if (!notification?.notificationId || !notification.userId) {
    return null;
  }

  return {
    notificationId: notification.notificationId,
    userId: notification.userId,
    roomId: notification.roomId || '',
    actorUserId: notification.actorUserId || '',
    actorName: notification.actorName || '',
    type: NOTIFICATION_TYPES.includes(notification.type) ? notification.type : 'system_notice',
    title: sanitizeNotificationTitle(notification.title),
    body: sanitizeNotificationBody(notification.body),
    targetView: sanitizeTargetView(notification.targetView || ''),
    targetUrl: sanitizeTargetUrl(notification.targetUrl || ''),
    createdAt: notification.createdAt || new Date().toISOString(),
    readAt: notification.readAt || null,
    dismissedAt: notification.dismissedAt || null,
    metadata: sanitizeMetadata(notification.metadata),
  };
}

function preferenceKeyFor(type) {
  return {
    mention: 'mentions',
    reply: 'replies',
    room_announcement: 'roomAnnouncements',
    moderation_action: 'moderationUpdates',
    report_status: 'reportUpdates',
    billing_status: 'billingStatus',
    system_notice: 'systemNotices',
    community_invite: 'communityActivity',
    community_announcement: 'communityAnnouncements',
    event_starting: 'eventReminders',
    event_live: 'eventReminders',
    event_cancelled: 'eventReminders',
    community_role_changed: 'communityActivity',
    community_report_status: 'reportUpdates',
  }[type];
}

function isRoomMuted(relationship) {
  if (!relationship?.notificationsMuted && !relationship?.mutedUntil) {
    return false;
  }

  if (relationship.mutedUntil === 'manual') {
    return true;
  }

  const timestamp = new Date(relationship.mutedUntil || 0).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function dedupeMembers(members = []) {
  const byUser = new Map();

  for (const member of members || []) {
    if (member?.userId && !byUser.has(member.userId)) {
      byUser.set(member.userId, member);
    }
  }

  return [...byUser.values()];
}

function createPreview(value) {
  return sanitizeNotificationBody(value).slice(0, 120);
}

function toRoomSnapshot(room) {
  return {
    roomId: room.roomId,
    inviteCode: room.inviteCode,
    title: room.title,
    type: room.type,
    category: room.category,
    categorySlug: getCategorySlug(room.categorySlug || room.category),
    categoryLabel: getCategoryConfig(room.categorySlug || room.category).label,
    memberCount: room.memberCount || 0,
    isLocked: Boolean(room.isLocked),
    expiresAt: room.expiresAt || null,
    lastActiveAt: room.lastActiveAt || new Date().toISOString(),
    latestMessagePreview: room.lastMessagePreview || '',
    latestMessageAt: room.lastMessageAt || '',
    latestAnnouncement: room.latestAnnouncement || null,
  };
}

function toCategoryMetadata(room = {}) {
  const category = getCategoryConfig(room.categorySlug || room.category);
  return {
    roomTitle: sanitizeNotificationTitle(room.title || 'Nexus room'),
    categorySlug: category.slug,
    categoryLabel: category.label,
    categoryAccent: category.accentClass,
    notificationGroup: getCategoryForNotificationGroup(category.slug),
  };
}

function sanitizeMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metadata)
      .slice(0, 12)
      .map(([key, value]) => [
        String(key).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40),
        typeof value === 'string' ? sanitizeNotificationBody(value) : typeof value === 'number' || typeof value === 'boolean' ? value : '',
      ]),
  );
}

function sanitizeTargetView(value) {
  return [
    'room',
    'my-rooms',
    'billing',
    'admin',
    'profile',
    'communities',
    'community-home',
    'event-lobby',
  ].includes(value)
    ? value
    : '';
}

function sanitizeTargetUrl(value) {
  const text = String(value || '').trim();
  return /^\/[a-zA-Z0-9/_-]*$/.test(text) ? text.slice(0, 160) : '';
}

function safeOptionalIdentifier(value) {
  try {
    return sanitizeIdentifier(value, 'Identifier');
  } catch {
    return '';
  }
}

function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}
