import crypto from 'node:crypto';

import { NOTIFICATION_PREFERENCES, NOTIFICATION_TYPES } from '../../shared/chatConfig.js';
import { sanitizeIdentifier, sanitizeNotificationBody, sanitizeNotificationTitle } from './safetyService.js';

const ELIGIBLE_PUSH_TYPES = new Set([
  'mention',
  'reply',
  'room_announcement',
  'moderation_action',
  'report_status',
  'billing_status',
  'system_notice',
  'community_announcement',
  'event_starting',
  'event_live',
  'event_cancelled',
  'community_report_status',
]);

const INVALID_TOKEN_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/invalid-argument',
]);

export function createPushService({ repositories = {}, adminApp = null, persistenceStatus = {}, logger = console } = {}) {
  const pushTokenRepository = repositories.pushTokenRepository || {};
  const userRepository = repositories.userRepository || {};
  const enabled = String(process.env.FCM_ENABLED || '').toLowerCase() === 'true';
  const hasVapidKey = Boolean(process.env.VITE_FIREBASE_VAPID_KEY);
  const ready = Boolean(enabled && hasVapidKey && adminApp && persistenceStatus?.enabled);
  const metrics = {
    attempts: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    recentFailures: [],
  };
  let messagingPromise = null;

  async function getMessagingClient() {
    if (!ready) {
      return null;
    }

    if (!messagingPromise) {
      messagingPromise = import('firebase-admin/messaging').then(({ getMessaging }) => getMessaging(adminApp));
    }

    return messagingPromise;
  }

  async function registerToken(user, payload = {}, context = {}) {
    if (!ready) {
      return { enabled: false, unavailableReason: getUnavailableReason() };
    }

    const cleanUserId = sanitizeIdentifier(user?.userId, 'User');
    const token = sanitizeToken(payload.token);
    const tokenId = hashToken(token);
    const now = new Date().toISOString();

    await pushTokenRepository.upsert?.(cleanUserId, tokenId, {
      token,
      deviceLabel: sanitizeDeviceLabel(payload.deviceLabel),
      userAgent: sanitizeUserAgent(context.userAgent),
      createdAt: payload.createdAt || now,
      lastSeenAt: now,
      updatedAt: now,
      disabledAt: null,
    });

    return { enabled: true, tokenId };
  }

  async function disableToken(user, tokenId) {
    if (!user?.userId || !tokenId) {
      return { disabled: false };
    }

    const cleanUserId = sanitizeIdentifier(user.userId, 'User');
    const cleanTokenId = sanitizeTokenId(tokenId);
    await pushTokenRepository.disable?.(cleanUserId, cleanTokenId, new Date().toISOString());
    return { disabled: true, tokenId: cleanTokenId };
  }

  async function sendNotification({ userId, notification } = {}) {
    if (!ready || !notification?.notificationId || !userId || !ELIGIBLE_PUSH_TYPES.has(notification.type)) {
      metrics.skipped += 1;
      return { sent: 0, skipped: true };
    }

    const cleanUserId = sanitizeIdentifier(userId, 'User');
    const profile = await userRepository.get?.(cleanUserId);
    const preferences = {
      ...NOTIFICATION_PREFERENCES,
      ...(profile?.settings?.notificationPreferences || {}),
    };

    if (!isPushAllowed(notification.type, preferences)) {
      metrics.skipped += 1;
      return { sent: 0, skipped: true, reason: 'preferences' };
    }

    const tokens = (await pushTokenRepository.listEnabledForUser?.(cleanUserId, 20)) || [];

    if (!tokens.length) {
      metrics.skipped += 1;
      return { sent: 0, skipped: true, reason: 'no_tokens' };
    }

    const messaging = await getMessagingClient();

    if (!messaging) {
      metrics.skipped += 1;
      return { sent: 0, skipped: true, reason: 'not_ready' };
    }

    const safeNotification = toSafePushNotification(notification);
    metrics.attempts += tokens.length;

    try {
      const result = await messaging.sendEachForMulticast({
        tokens: tokens.map((item) => item.token),
        notification: {
          title: safeNotification.title,
          body: safeNotification.body,
        },
        data: safeNotification.data,
        webpush: {
          fcmOptions: {
            link: safeNotification.data.targetUrl || '/',
          },
          notification: {
            icon: '/icons/nexus-icon.svg',
            badge: '/icons/nexus-badge.svg',
            tag: safeNotification.data.notificationId,
          },
        },
      });

      metrics.sent += result.successCount || 0;
      metrics.failed += result.failureCount || 0;

      await Promise.all(
        (result.responses || []).map(async (response, index) => {
          if (response.success) {
            return;
          }

          const tokenRecord = tokens[index];
          const code = response.error?.code || 'messaging/unknown';
          rememberFailure(code, response.error?.message || 'Push send failed.');

          if (INVALID_TOKEN_CODES.has(code) && tokenRecord?.tokenId) {
            await pushTokenRepository.disable?.(cleanUserId, tokenRecord.tokenId, new Date().toISOString());
          }
        }),
      );

      return {
        sent: result.successCount || 0,
        failed: result.failureCount || 0,
      };
    } catch (error) {
      metrics.failed += tokens.length;
      rememberFailure('messaging/send-failed', error instanceof Error ? error.message : 'Push delivery failed.');
      logger.warn?.('Push notification delivery skipped safely.', { error });
      return { sent: 0, failed: tokens.length };
    }
  }

  async function getAdminSummary() {
    const recentTokens = (await pushTokenRepository.listRecent?.(200)) || [];
    const enabledTokens = recentTokens.filter((item) => !item.disabledAt && item.tokenId);
    const userIds = new Set(enabledTokens.map((item) => item.userId).filter(Boolean));

    return {
      enabled,
      ready,
      unavailableReason: ready ? '' : getUnavailableReason(),
      configured: {
        vapidKey: hasVapidKey,
        firebaseAdmin: Boolean(adminApp),
        persistence: Boolean(persistenceStatus?.enabled),
      },
      sampledTokens: recentTokens.length,
      enabledTokens: enabledTokens.length,
      tokenUsers: userIds.size,
      attempts: metrics.attempts,
      sent: metrics.sent,
      failed: metrics.failed,
      skipped: metrics.skipped,
      recentFailures: metrics.recentFailures.slice(0, 12),
    };
  }

  function getStatus() {
    return {
      enabled,
      ready,
      provider: ready ? 'firebase-cloud-messaging' : 'disabled',
      state: ready ? 'ready' : 'unavailable',
      unavailableReason: ready ? '' : getUnavailableReason(),
      attempts: metrics.attempts,
      sent: metrics.sent,
      failed: metrics.failed,
      skipped: metrics.skipped,
    };
  }

  function getUnavailableReason() {
    if (!enabled) {
      return 'fcm_disabled';
    }

    if (!hasVapidKey) {
      return 'missing_vapid_key';
    }

    if (!adminApp) {
      return 'firebase_admin_unavailable';
    }

    if (!persistenceStatus?.enabled) {
      return 'persistence_disabled';
    }

    return '';
  }

  function rememberFailure(code, message) {
    metrics.recentFailures.unshift({
      code: sanitizeNotificationTitle(code).slice(0, 80),
      message: sanitizeNotificationBody(message).slice(0, 160),
      at: new Date().toISOString(),
    });
    metrics.recentFailures.splice(25);
  }

  return {
    disableToken,
    getAdminSummary,
    getStatus,
    registerToken,
    sendNotification,
  };
}

function toSafePushNotification(notification) {
  const roomName = sanitizeNotificationTitle(notification.metadata?.roomTitle || notification.title || 'Nexus room');
  const type = NOTIFICATION_TYPES.includes(notification.type) ? notification.type : 'system_notice';
  const title = pushTitleFor(type, notification, roomName);
  const body = pushBodyFor(type, notification, roomName);
  const targetUrl = sanitizeTargetUrl(notification.targetUrl || (notification.roomId ? `/room/${notification.roomId}` : '/'));

  return {
    title,
    body,
    data: {
      notificationId: String(notification.notificationId || ''),
      targetView: String(notification.targetView || ''),
      targetUrl,
      roomId: String(notification.roomId || ''),
      type,
      title,
      body,
    },
  };
}

function pushTitleFor(type, notification, roomName) {
  if (type === 'mention') {
    return 'New mention in Nexus Chat';
  }

  if (type === 'reply') {
    return 'New reply in Nexus Chat';
  }

  if (type === 'room_announcement' || type === 'community_announcement') {
    return 'New Nexus announcement';
  }

  if (type === 'event_starting') {
    return 'Nexus event starting soon';
  }

  if (type === 'event_live') {
    return 'Nexus event is live';
  }

  if (type === 'event_cancelled') {
    return 'Nexus event cancelled';
  }

  if (type === 'billing_status') {
    return 'Nexus billing update';
  }

  if (type === 'moderation_action' || type === 'report_status' || type === 'community_report_status') {
    return 'Nexus safety update';
  }

  return sanitizeNotificationTitle(notification.title || roomName || 'Nexus Chat update');
}

function pushBodyFor(type, _notification, roomName) {
  if (type === 'mention') {
    return `Open ${roomName} to view the mention.`;
  }

  if (type === 'reply') {
    return `Open ${roomName} to view the reply.`;
  }

  if (type === 'room_announcement' || type === 'community_announcement') {
    return `There is a new announcement in ${roomName}.`;
  }

  if (type.startsWith('event_')) {
    return 'Open Nexus Chat for the latest event state.';
  }

  if (type === 'billing_status') {
    return 'Open Billing to review your latest account update.';
  }

  if (type === 'moderation_action' || type === 'report_status' || type === 'community_report_status') {
    return 'Open Nexus Chat to review the safety update.';
  }

  return 'Open Nexus Chat for the latest update.';
}

function isPushAllowed(type, preferences) {
  if (preferences.pushEnabled !== true) {
    return false;
  }

  const key = {
    mention: 'pushMentions',
    reply: 'pushReplies',
    room_announcement: 'pushAnnouncements',
    community_announcement: 'pushAnnouncements',
    event_starting: 'pushEventReminders',
    event_live: 'pushEventReminders',
    event_cancelled: 'pushEventReminders',
    moderation_action: 'pushSafetyUpdates',
    report_status: 'pushSafetyUpdates',
    community_report_status: 'pushSafetyUpdates',
    billing_status: 'pushBillingSystem',
    system_notice: 'pushBillingSystem',
  }[type];

  return !key || preferences[key] !== false;
}

function sanitizeToken(value) {
  const token = String(value || '').trim();

  if (!/^[a-zA-Z0-9:._-]{80,4096}$/.test(token)) {
    throw new Error('Push token is invalid.');
  }

  return token;
}

function sanitizeTokenId(value) {
  const tokenId = String(value || '').trim();

  if (!/^[a-f0-9]{24,64}$/.test(tokenId)) {
    throw new Error('Push token id is invalid.');
  }

  return tokenId;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function sanitizeDeviceLabel(value) {
  return sanitizeNotificationTitle(value || 'Browser device').slice(0, 80);
}

function sanitizeUserAgent(value) {
  return sanitizeNotificationBody(value || '').slice(0, 180);
}

function sanitizeTargetUrl(value) {
  const text = String(value || '/').trim();
  return /^\/[a-zA-Z0-9/_?=&.-]*$/.test(text) ? text.slice(0, 180) : '/';
}
