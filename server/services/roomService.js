import crypto from 'node:crypto';

import {
  CHAT_LIMITS,
  DEFAULT_TEMP_ROOM_EXPIRY_MS,
  ROOM_ACTIVITY_TYPES,
  REACTION_EMOJIS,
  TEMP_ROOM_EXPIRY_OPTIONS,
} from '../../shared/chatConfig.js';
import { getPlanLimits, getTheme } from '../../shared/billingCatalog.js';
import {
  getCategoryConfig,
  getCategoryFeatureHooks,
  getCategoryForAnalytics,
  getCategorySlug,
  isValidCategory,
} from '../../shared/categoryConfig.js';
import {
  normalizeRoomType,
  sanitizeActivityType,
  sanitizeAnnouncementBody,
  sanitizeAnnouncementTitle,
  sanitizeCategory,
  sanitizeCategoryMessageType,
  sanitizeCategoryToolMetadata,
  sanitizeCategoryToolType,
  sanitizeReportDetails,
  sanitizeReplySnippet,
  sanitizeRoomRole,
  sanitizeRoomRules,
  sanitizeRoomTemplateId,
  sanitizeRoomTitle,
  sanitizeScheduledAnnouncementBody,
  sanitizeScheduledAnnouncementTitle,
} from './safetyService.js';

export function createRoomService({ repositories = {}, entitlementService } = {}) {
  // Phase 4 live presence, typing, and socket membership stay in memory even when room history persists.
  const rooms = new Map();
  const roomRepository = repositories.roomRepository || {};
  const messageRepository = repositories.messageRepository || {};
  const userRepository = repositories.userRepository || {};
  const memberRepository = repositories.memberRepository || {};
  const reportRepository = repositories.reportRepository || {};
  const announcementRepository = repositories.announcementRepository || {};
  const activityRepository = repositories.activityRepository || {};

  async function initializeFromPersistence() {
    const persistedRooms = await roomRepository.listActive?.();

    hydratePersistedRooms(persistedRooms);
  }

  async function refreshPublicRoomsFromPersistence() {
    const persistedRooms = await roomRepository.listActive?.(CHAT_LIMITS.MAX_ACTIVE_PUBLIC_ROOMS * 3);
    hydratePersistedRooms(persistedRooms);
    return getPublicRooms();
  }

  async function createRoom({
    title,
    type,
    category,
    owner,
    expiresInMs,
    rules = '',
    templateId = '',
    communityId = '',
    communityName = '',
    communityRoleContext = '',
    roomPurpose = '',
    eventRoomId = '',
  }) {
    const normalizedType = normalizeRoomType(type);
    const categorySnapshot = createCategorySnapshot(category);
    const limits = await getOwnerLimits(owner);

    if (!categorySnapshot.categoryAllowedRoomTypes.includes(normalizedType)) {
      throw new Error('That room type is not available for this category.');
    }

    if (
      (normalizedType === 'public' || normalizedType === 'temp') &&
      getActivePublicRoomCount() >= CHAT_LIMITS.MAX_ACTIVE_PUBLIC_ROOMS
    ) {
      throw new Error('Public room limit reached. Try a private room for now.');
    }

    if (getActiveCreatedRoomCount(owner) >= limits.activeRooms) {
      throw new Error('Active room limit reached for your current plan.');
    }

    if (normalizedType === 'temp' && !isTempDurationAllowed(expiresInMs, limits)) {
      throw new Error('That temp room duration requires a higher plan.');
    }

    const roomId = createId('room');
    const createdAt = new Date().toISOString();
    const room = {
      roomId,
      inviteCode: createInviteCode(),
      title: sanitizeRoomTitle(title),
      type: normalizedType,
      ...categorySnapshot,
      ownerSessionId: owner.sessionId,
      ownerUserId: owner.userId || null,
      ownerName: owner.displayName,
      communityId,
      communityName,
      communityRoleContext,
      roomPurpose: sanitizeRoomPurpose(roomPurpose),
      eventRoomId,
      rules: sanitizeRoomRules(rules),
      templateId: sanitizeRoomTemplateId(templateId, categorySnapshot.categorySlug),
      themeId: 'classic',
      maxMembers: limits.roomMembers,
      createdAt,
      updatedAt: createdAt,
      lastActiveAt: createdAt,
      expiresAt: normalizedType === 'temp' ? createExpiry(expiresInMs, limits) : null,
      deletedAt: null,
      memberCount: 0,
      isLocked: false,
      members: new Map(),
      messages: [],
      messagesHydrated: true,
      typing: new Map(),
      mutedUsers: new Map(),
      kickedUsers: new Map(),
      memberRecords: new Map(),
      membersHydrated: true,
      announcements: [],
      announcementsHydrated: true,
      activity: [],
      activityHydrated: true,
      categoryTools: [],
      categoryToolsHydrated: true,
      lastMessagePreview: '',
      lastMessageAt: null,
      latestAnnouncement: null,
    };

    rooms.set(roomId, room);
    persistRoom(room);
    upsertUser(owner);
    const ownerRecord = createMemberRecord(room, owner, 'owner');
    room.memberRecords.set(ownerRecord.memberId, ownerRecord);
    writeLater(memberRepository.upsert?.(room.roomId, ownerRecord), 'owner member save');
    writeJoinedRoom(owner, room, 'owner');
    writeLater(userRepository.incrementStat?.(owner.userId, 'roomsCreated'), 'room creator stat');
    addActivity(room.roomId, 'room_created', owner, { title: room.title });
    return room;
  }

  async function joinRoom(room, user, socketId) {
    if (!room) {
      throw new Error('Room not found.');
    }

    if (room.deletedAt || isExpired(room)) {
      throw new Error('This room has expired or closed.');
    }

    if (room.isLocked && user.sessionId !== room.ownerSessionId && !room.members.has(user.sessionId)) {
      throw new Error('This room is locked.');
    }

    const memberRecord = await getOrCreateMemberRecord(room, user);
    enforceKickCooldown(room, user.sessionId, memberRecord);

    const existingMember = room.members.get(user.sessionId);

    if (existingMember) {
      existingMember.displayName = user.displayName;
      existingMember.avatar = user.avatar;
      existingMember.photoMode = user.photoMode || existingMember.photoMode || 'avatar';
      existingMember.photoURL = user.photoURL || '';
      existingMember.handle = user.handle || existingMember.handle || '';
      existingMember.status = user.status || existingMember.status || '';
      existingMember.userId = user.userId || null;
      existingMember.memberId = memberRecord.memberId;
      existingMember.role = memberRecord.role;
      existingMember.socketIds.add(socketId);
      existingMember.lastSeenAt = new Date().toISOString();
      room.memberCount = room.members.size;
      await touchMemberRecord(room, memberRecord, user);
      touchRoom(room);
      upsertUser(user);
      return { member: existingMember, isFirstJoin: false };
    }

    if (room.members.size >= Math.min(room.maxMembers || CHAT_LIMITS.MAX_ONLINE_USERS_PER_ROOM, CHAT_LIMITS.MAX_ONLINE_USERS_PER_ROOM)) {
      throw new Error('This room is full.');
    }

    const member = {
      sessionId: user.sessionId,
      userId: user.userId || null,
      memberId: memberRecord.memberId,
      role: memberRecord.role,
      displayName: user.displayName,
      avatar: user.avatar,
      photoMode: user.photoMode || 'avatar',
      photoURL: user.photoURL || '',
      handle: user.handle || '',
      status: user.status || '',
      joinedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      socketIds: new Set([socketId]),
    };

    room.members.set(user.sessionId, member);
    room.memberCount = room.members.size;
    await touchMemberRecord(room, memberRecord, user);
    touchRoom(room);
    upsertUser(user);
    return { member, isFirstJoin: true };
  }

  async function applyCommunityRole(roomId, user, communityRole = '') {
    const room = requireRoom(roomId);

    if (!['owner', 'admin', 'moderator'].includes(communityRole) || !room.members.has(user.sessionId)) {
      return null;
    }

    const member = room.members.get(user.sessionId);
    const record = await getOrCreateMemberRecord(room, user);

    if (record.role !== 'owner') {
      record.role = 'moderator';
      member.role = 'moderator';
      room.memberRecords.set(record.memberId, record);
      await memberRepository.updateRole?.(room.roomId, record.memberId, 'moderator');
    }

    return record;
  }

  async function prepareRoomHistory(room) {
    if (!room) {
      return room;
    }

    if (!room.messagesHydrated) {
      try {
        const messages = await messageRepository.listRecentByRoom?.(
          room.roomId,
          CHAT_LIMITS.PERSISTED_MESSAGE_LOAD_LIMIT,
        );
        room.messages = (messages || []).map(hydrateMessage);
      } catch (error) {
        console.warn(
          `Persisted message history could not be loaded for ${room.roomId}; live chat continues. ${
            error instanceof Error ? error.message : 'Repository read failed.'
          }`,
        );
      }

      room.messagesHydrated = true;
    }

    await prepareRoomMembers(room);
    await prepareRoomAnnouncements(room);
    await prepareRoomActivity(room);
    return room;
  }

  function leaveRoom(roomId, sessionId, socketId) {
    const room = rooms.get(roomId);

    if (!room) {
      return null;
    }

    const member = room.members.get(sessionId);

    if (!member) {
      return { room, member: null, didLeaveCompletely: false };
    }

    member.socketIds.delete(socketId);

    if (member.socketIds.size > 0) {
      return { room, member, didLeaveCompletely: false };
    }

    room.members.delete(sessionId);
    clearTyping(room.roomId, sessionId);
    room.memberCount = room.members.size;
    touchRoom(room);

    return { room, member, didLeaveCompletely: true };
  }

  function removeSocketFromAllRooms(socketId, sessionId) {
    const departures = [];

    for (const room of rooms.values()) {
      const result = leaveRoom(room.roomId, sessionId, socketId);

      if (result?.didLeaveCompletely) {
        departures.push(result);
      }
    }

    return departures;
  }

  function pruneStaleSockets(activeSocketIds) {
    const active = activeSocketIds instanceof Set ? activeSocketIds : new Set(activeSocketIds || []);
    const departures = [];

    for (const room of rooms.values()) {
      for (const member of [...room.members.values()]) {
        const before = member.socketIds.size;

        for (const socketId of [...member.socketIds]) {
          if (!active.has(socketId)) {
            member.socketIds.delete(socketId);
          }
        }

        if (before === member.socketIds.size || member.socketIds.size > 0) {
          continue;
        }

        room.members.delete(member.sessionId);
        clearTyping(room.roomId, member.sessionId);
        room.memberCount = room.members.size;
        touchRoom(room);
        departures.push({ room, member, didLeaveCompletely: true });
      }
    }

    return departures;
  }

  function renameRoom(roomId, requester, title) {
    const room = requireOwner(roomId, requester);
    room.title = sanitizeRoomTitle(title);
    touchRoom(room, { updatedAt: new Date().toISOString() });
    addActivity(roomId, 'room_renamed', requester, { title: room.title });
    return room;
  }

  function setRoomLocked(roomId, requester, isLocked) {
    const room = requireOwner(roomId, requester);
    room.isLocked = Boolean(isLocked);
    touchRoom(room, { updatedAt: new Date().toISOString() });
    addActivity(roomId, room.isLocked ? 'room_locked' : 'room_unlocked', requester, {});
    return room;
  }

  function updateRoomRules(roomId, requester, rules) {
    const room = requireOwner(roomId, requester);
    room.rules = sanitizeRoomRules(rules);
    touchRoom(room, { updatedAt: new Date().toISOString() });
    return room;
  }

  async function updateRoomTheme(roomId, requester, themeId) {
    const room = requireOwner(roomId, requester);
    const theme = getTheme(themeId);

    if (theme.productId && !(await entitlementService?.canUseRoomTheme?.(requester.userId, theme.themeId))) {
      throw new Error('That premium room theme is not owned yet.');
    }

    room.themeId = theme.themeId;
    touchRoom(room, { updatedAt: new Date().toISOString() });
    addActivity(roomId, 'theme_changed', requester, { themeId: theme.themeId });
    return room;
  }

  function deleteRoom(roomId, requester) {
    const room = requireOwner(roomId, requester);
    markRoomDeleted(room);
    addActivity(roomId, 'room_deleted', requester, { title: room.title });
    rooms.delete(roomId);
    return room;
  }

  function deleteRoomAsAdmin(roomId) {
    const room = requireRoom(roomId);
    markRoomDeleted(room);
    addActivity(roomId, 'room_deleted', { sessionId: 'admin', displayName: 'Admin' }, { title: room.title });
    rooms.delete(roomId);
    return room;
  }

  function addMessage(roomId, message) {
    const room = rooms.get(roomId);

    if (!room) {
      throw new Error('Room not found.');
    }

    room.messages.push(message);
    room.lastActiveAt = new Date().toISOString();

    if (message.type === 'chat' && !message.deletedAt) {
      room.lastMessagePreview = sanitizeReplySnippet(message.content);
      room.lastMessageAt = message.createdAt;
    }

    if (room.messages.length > CHAT_LIMITS.MAX_MESSAGES_PER_ROOM) {
      room.messages.splice(0, room.messages.length - CHAT_LIMITS.MAX_MESSAGES_PER_ROOM);
    }

    persistMessage(message);
    touchRoom(room);

    if (message.type === 'chat') {
      writeLater(userRepository.incrementStat?.(message.senderUserId, 'messagesSent'), 'message author stat');
    }

    if (room.messages.length % 50 === 0) {
      writeLater(
        messageRepository.enforceLimit?.(roomId, CHAT_LIMITS.MAX_PERSISTED_MESSAGES_PER_ROOM),
        'message retention',
      );
    }

    return message;
  }

  function toggleReaction(roomId, messageId, sessionId, emoji) {
    const room = requireRoom(roomId);
    const message = requireMessage(room, messageId);

    if (message.type === 'system' || message.deletedAt) {
      throw new Error('This message cannot be reacted to.');
    }

    if (!REACTION_EMOJIS.includes(emoji)) {
      throw new Error('Reaction is not supported.');
    }

    if (!message.reactions.has(emoji)) {
      message.reactions.set(emoji, new Set());
    }

    const reactors = message.reactions.get(emoji);

    if (reactors.has(sessionId)) {
      reactors.delete(sessionId);
    } else {
      reactors.add(sessionId);
    }

    if (reactors.size === 0) {
      message.reactions.delete(emoji);
    }

    message.updatedAt = new Date().toISOString();
    persistMessage(message);
    return { room, message };
  }

  function softDeleteMessage(roomId, messageId, sessionId) {
    const room = requireRoom(roomId);
    const message = requireMessage(room, messageId);

    if (message.type === 'system') {
      throw new Error('System messages cannot be deleted.');
    }

    if (message.senderSessionId !== sessionId) {
      throw new Error('You can only delete your own messages.');
    }

    message.content = '';
    message.deletedAt = new Date().toISOString();
    message.deletedBySessionId = sessionId;
    message.reactions.clear();
    message.updatedAt = message.deletedAt;
    persistMessage(message);

    return { room, message };
  }

  function applyMessageCategoryMarker(roomId, messageId, marker = {}) {
    const room = requireRoom(roomId);
    const message = requireMessage(room, messageId);

    if (message.type === 'system' || message.deletedAt) {
      throw new Error('That message cannot be marked.');
    }

    const nextMarker = serializeCategoryMarker(marker);
    const existing = Array.isArray(message.categoryMarkers) ? message.categoryMarkers : [];
    message.categoryMarkers = [
      nextMarker,
      ...existing.filter(
        (item) =>
          !(
            (nextMarker.toolId && item.toolId === nextMarker.toolId) ||
            (!nextMarker.toolId && nextMarker.toolType && item.toolType === nextMarker.toolType)
          ),
      ),
    ].slice(0, 6);
    message.updatedAt = new Date().toISOString();
    persistMessage(message);
    return { room, message };
  }

  async function softDeleteMessageByRequester(roomId, messageId, requester) {
    const room = requireRoom(roomId);
    const message = requireMessage(room, messageId);

    if (message.type === 'system') {
      throw new Error('System messages cannot be deleted.');
    }

    if (message.senderSessionId !== requester.sessionId) {
      await requireModerator(room, requester);
      assertCanModerateTarget(room, requester, message.senderSessionId);
    }

    const wasOwnerAction = message.senderSessionId !== requester.sessionId;
    markMessageDeleted(message, requester.sessionId);
    persistMessage(message);

    return {
      room,
      message,
      wasOwnerAction,
      targetSessionId: message.senderSessionId,
      targetName: message.senderName,
    };
  }

  async function muteUser(roomId, requester, targetSessionId, duration, reason = '') {
    const room = requireRoom(roomId);
    await requireModerator(room, requester);
    assertCanModerateTarget(room, requester, targetSessionId);
    const target = requireMember(room, targetSessionId);
    const record = await getOrCreateMemberRecord(room, target);
    const mutedAt = new Date().toISOString();
    const mutedUntil = duration.ms ? new Date(Date.now() + duration.ms).toISOString() : 'session';
    const moderation = {
      mutedUntil,
      muteReason: sanitizeReportDetails(reason),
      muteActionBy: actorRef(requester),
      muteCreatedAt: mutedAt,
    };
    room.mutedUsers.set(targetSessionId, {
      sessionId: targetSessionId,
      displayName: target.displayName,
      mutedBySessionId: requester.sessionId,
      mutedAt,
      mutedUntil,
    });
    Object.assign(record, moderation);
    await memberRepository.updateModeration?.(room.roomId, record.memberId, moderation);
    await incrementModerationStat(requester);

    return { room, target, moderation };
  }

  async function unmuteUser(roomId, requester, targetSessionId) {
    const room = requireRoom(roomId);
    await requireModerator(room, requester);
    assertCanModerateTarget(room, requester, targetSessionId);
    const target = room.members.get(targetSessionId) || room.mutedUsers.get(targetSessionId);
    const record = target ? await getOrCreateMemberRecord(room, target) : null;
    room.mutedUsers.delete(targetSessionId);

    if (record) {
      record.mutedUntil = null;
      await memberRepository.updateModeration?.(room.roomId, record.memberId, {
        mutedUntil: null,
        muteReason: '',
        muteActionBy: null,
        muteCreatedAt: null,
      });
    }

    await incrementModerationStat(requester);
    return {
      room,
      target: target || { sessionId: targetSessionId, displayName: 'User' },
    };
  }

  async function kickUser(roomId, requester, targetSessionId, duration, reason = '') {
    const room = requireRoom(roomId);
    await requireModerator(room, requester);
    assertCanModerateTarget(room, requester, targetSessionId);
    const target = requireMember(room, targetSessionId);
    const record = await getOrCreateMemberRecord(room, target);
    const socketIds = [...target.socketIds];
    const kickedAt = new Date().toISOString();
    const kickedUntil = new Date(Date.now() + (duration.ms || CHAT_LIMITS.KICK_REJOIN_COOLDOWN_MS)).toISOString();
    room.members.delete(targetSessionId);
    room.mutedUsers.delete(targetSessionId);
    room.typing.delete(targetSessionId);
    room.kickedUsers.set(targetSessionId, {
      sessionId: targetSessionId,
      displayName: target.displayName,
      kickedBySessionId: requester.sessionId,
      kickedAt,
      expiresAt: new Date(kickedUntil).getTime(),
    });
    room.memberCount = room.members.size;
    const moderation = {
      kickedUntil,
      kickReason: sanitizeReportDetails(reason),
      kickActionBy: actorRef(requester),
      kickCreatedAt: kickedAt,
    };
    Object.assign(record, moderation);
    await memberRepository.updateModeration?.(room.roomId, record.memberId, moderation);
    await incrementModerationStat(requester);

    return { room, target, socketIds, moderation };
  }

  async function banUser(roomId, requester, targetSessionId, duration, reason = '') {
    const { room, target, socketIds } = await kickUser(roomId, requester, targetSessionId, {
      ms: CHAT_LIMITS.KICK_REJOIN_COOLDOWN_MS,
    }, reason);
    const record = await getOrCreateMemberRecord(room, target);
    const bannedAt = new Date().toISOString();
    const moderation = {
      bannedUntil: duration.ms === null ? 'permanent' : new Date(Date.now() + duration.ms).toISOString(),
      banReason: sanitizeReportDetails(reason),
      banActionBy: actorRef(requester),
      banCreatedAt: bannedAt,
    };
    Object.assign(record, moderation);
    await memberRepository.updateModeration?.(room.roomId, record.memberId, moderation);

    return { room, target, socketIds, moderation };
  }

  async function unbanUser(roomId, requester, targetMemberId) {
    const room = requireRoom(roomId);
    await requireModerator(room, requester);
    const record = await getMemberRecordById(room, targetMemberId);

    if (!record) {
      throw new Error('Banned member was not found.');
    }

    assertCanModerateRecord(room, requester, record);
    Object.assign(record, {
      bannedUntil: null,
      banReason: '',
      banActionBy: null,
      banCreatedAt: null,
    });
    await memberRepository.updateModeration?.(room.roomId, record.memberId, {
      bannedUntil: null,
      banReason: '',
      banActionBy: null,
      banCreatedAt: null,
    });
    await incrementModerationStat(requester);

    return { room, target: record };
  }

  async function clearRecentMessages(roomId, requester, count = CHAT_LIMITS.CLEAR_RECENT_MESSAGE_COUNT) {
    const room = requireOwner(roomId, requester);
    const deletedMessages = [];

    for (let index = room.messages.length - 1; index >= 0 && deletedMessages.length < count; index -= 1) {
      const message = room.messages[index];

      if (message.type !== 'system' && !message.deletedAt) {
        markMessageDeleted(message, requester.sessionId);
        persistMessage(message);
        deletedMessages.push(message);
      }
    }

    return { room, messages: deletedMessages, count: deletedMessages.length };
  }

  async function setMemberRole(roomId, requester, targetSessionId, role) {
    const room = requireOwner(roomId, requester);
    const cleanRole = sanitizeRoomRole(role);

    if (cleanRole === 'owner') {
      throw new Error('Owner role cannot be reassigned here.');
    }

    const target = requireMember(room, targetSessionId);

    if (!target.userId) {
      throw new Error('Guest users cannot be durable moderators.');
    }

    const record = await getOrCreateMemberRecord(room, target);

    if (record.role === 'owner') {
      throw new Error('Owner role cannot be changed.');
    }

    const limits = await getOwnerLimits(requester);
    const moderatorCount = [...room.memberRecords.values()].filter(
      (entry) => entry.memberId !== record.memberId && entry.role === 'moderator',
    ).length;

    if (cleanRole === 'moderator' && moderatorCount >= limits.maxModeratorsPerRoom) {
      throw new Error('Moderator limit reached for this room plan.');
    }

    record.role = cleanRole;
    target.role = cleanRole;
    await memberRepository.updateRole?.(room.roomId, record.memberId, cleanRole);
    await incrementModerationStat(requester);
    addActivity(roomId, 'role_changed', requester, { target: target.displayName, role: cleanRole });
    return { room, target, role: cleanRole };
  }

  async function getRoomReports(roomId, requester) {
    const room = requireRoom(roomId);
    await requireModerator(room, requester);
    return reportRepository.listByRoom?.(room.roomId, 50) || [];
  }

  function findReplyTarget(roomId, messageId) {
    if (!messageId) {
      return null;
    }

    const room = rooms.get(roomId);

    if (!room) {
      return null;
    }

    const message = room.messages.find((item) => item.messageId === messageId);

    if (!message || message.type === 'system' || message.deletedAt) {
      return null;
    }

    return {
      replyToMessageId: message.messageId,
      replyToSenderName: message.senderName,
      replyToContentSnippet: sanitizeReplySnippet(message.content),
      senderSessionId: message.senderSessionId,
      senderUserId: message.senderUserId || null,
    };
  }

  function setTyping(roomId, user) {
    const room = requireRoom(roomId);

    if (!room.members.has(user.sessionId)) {
      throw new Error('Join the room before typing.');
    }

    room.typing.set(user.sessionId, {
      sessionId: user.sessionId,
      displayName: user.displayName,
      expiresAt: Date.now() + CHAT_LIMITS.TYPING_TTL_MS,
    });

    return room;
  }

  function clearTyping(roomId, sessionId) {
    const room = rooms.get(roomId);

    if (!room) {
      return null;
    }

    room.typing.delete(sessionId);
    return room;
  }

  function pruneTyping(room) {
    const now = Date.now();

    for (const [sessionId, entry] of room.typing.entries()) {
      if (entry.expiresAt <= now || !room.members.has(sessionId)) {
        room.typing.delete(sessionId);
      }
    }
  }

  function getTypingUsers(room, viewerSessionId) {
    pruneTyping(room);

    return [...room.typing.values()]
      .filter((entry) => entry.sessionId !== viewerSessionId)
      .map((entry) => ({
        sessionId: entry.sessionId,
        displayName: entry.displayName,
      }));
  }

  function findRoom(identifier) {
    const room = findRoomCandidate(identifier);
    return room && !room.deletedAt && !isExpired(room) ? room : null;
  }

  function findRoomCandidate(identifier) {
    if (!identifier) {
      return null;
    }

    if (rooms.has(identifier)) {
      return rooms.get(identifier);
    }

    const normalized = String(identifier).trim().toUpperCase();
    return [...rooms.values()].find((room) => room.inviteCode === normalized) || null;
  }

  async function findOrLoadRoom(identifier, { includeUnavailable = false } = {}) {
    const liveRoom = includeUnavailable ? findRoomCandidate(identifier) : findRoom(identifier);

    if (liveRoom) {
      return liveRoom;
    }

    const cleanIdentifier = String(identifier || '').trim();

    if (!cleanIdentifier) {
      return null;
    }

    const persistedRoom =
      (await roomRepository.get?.(cleanIdentifier)) ||
      (await roomRepository.findByInviteCode?.(cleanIdentifier.toUpperCase()));

    if (!persistedRoom?.roomId) {
      return null;
    }

    const room = hydrateRoom(persistedRoom, []);

    if (room.deletedAt || isExpired(room)) {
      return includeUnavailable ? room : null;
    }

    rooms.set(room.roomId, room);
    return room;
  }

  async function parseMentions(roomId, content) {
    const room = requireRoom(roomId);
    await prepareRoomMembers(room);
    const tokens = [...String(content || '').matchAll(/@([\p{L}\p{N}._-]{2,32})/gu)]
      .map((match) => normalizeMentionKey(match[1]))
      .filter(Boolean);

    if (tokens.length === 0) {
      return [];
    }

    const seen = new Set();
    const candidates = [...room.members.values(), ...room.memberRecords.values()];
    const mentions = [];

    for (const token of tokens) {
      if (mentions.length >= CHAT_LIMITS.MAX_MENTIONS_PER_MESSAGE) {
        break;
      }

      const match = candidates.find((candidate) => {
        const handle = normalizeMentionKey(candidate.handle);
        const compactName = normalizeMentionKey(candidate.displayName);
        const firstName = normalizeMentionKey(String(candidate.displayName || '').split(/\s+/)[0]);
        return token === handle || token === compactName || token === firstName;
      });

      const key = match?.userId ? `user_${match.userId}` : match?.sessionId ? `session_${match.sessionId}` : '';

      if (!match || !key || seen.has(key)) {
        continue;
      }

      seen.add(key);
      mentions.push({
        userId: match.userId || null,
        sessionId: match.sessionId || '',
        displayName: match.displayName || 'User',
        handle: match.handle || '',
      });
    }

    return mentions;
  }

  async function createAnnouncement(roomId, requester, payload = {}) {
    const room = requireRoom(roomId);
    await requireModerator(room, requester);
    await prepareRoomAnnouncements(room);

    const limits = await getOwnerLimits({
      userId: room.ownerUserId,
      sessionId: room.ownerSessionId,
    });
    const cap = Math.min(
      limits.activeAnnouncements || 1,
      CHAT_LIMITS.MAX_ACTIVE_ANNOUNCEMENTS_PER_ROOM,
    );
    const activeAnnouncements = room.announcements.filter((announcement) => announcement.active);

    if (activeAnnouncements.length >= cap) {
      throw new Error('Announcement limit reached for this room plan.');
    }

    const now = new Date().toISOString();
    const announcement = serializeAnnouncement({
      announcementId: createId('ann'),
      roomId: room.roomId,
      title: sanitizeAnnouncementTitle(payload.title),
      body: sanitizeAnnouncementBody(payload.body),
      createdByUserId: requester.userId || null,
      createdBySessionId: requester.sessionId,
      createdByName: requester.displayName,
      createdAt: now,
      pinnedUntil: payload.pinnedUntil || null,
      active: true,
    });

    room.announcements = [announcement, ...room.announcements].slice(0, CHAT_LIMITS.MAX_ANNOUNCEMENT_HISTORY_LOAD);
    room.latestAnnouncement = announcement;
    writeLater(announcementRepository.create?.(room.roomId, announcement), 'announcement create');
    const activity = addActivity(room.roomId, 'announcement_posted', requester, {
      announcementId: announcement.announcementId,
      title: announcement.title,
    });
    touchRoom(room);
    return { room, announcement, activity };
  }

  async function publishScheduledAnnouncement(roomId, actor, payload = {}) {
    const room = await findOrLoadRoom(roomId);

    if (!room) {
      throw new Error('Target room was not found.');
    }

    await prepareRoomAnnouncements(room);
    const now = new Date().toISOString();
    const announcement = serializeAnnouncement({
      announcementId: createId('ann'),
      roomId: room.roomId,
      title: sanitizeScheduledAnnouncementTitle(payload.title),
      body: sanitizeScheduledAnnouncementBody(payload.body),
      createdByUserId: actor.userId || null,
      createdBySessionId: actor.sessionId || '',
      createdByName: actor.displayName || 'Nexus',
      createdAt: now,
      pinnedUntil: null,
      active: true,
    });
    room.announcements = [announcement, ...room.announcements].slice(0, CHAT_LIMITS.MAX_ANNOUNCEMENT_HISTORY_LOAD);
    room.latestAnnouncement = announcement;
    writeLater(announcementRepository.create?.(room.roomId, announcement), 'scheduled room announcement publish');
    const activity = addActivity(room.roomId, 'announcement_posted', actor, {
      announcementId: announcement.announcementId,
      title: announcement.title,
    });
    touchRoom(room);
    return { room, announcement, activity };
  }

  async function removeAnnouncementAsAdmin(roomId, announcementId, actor) {
    const room = requireRoom(roomId);
    await prepareRoomAnnouncements(room);
    const cleanAnnouncementId = String(announcementId || '').trim();
    const announcement = room.announcements.find((item) => item.announcementId === cleanAnnouncementId);

    if (!announcement) {
      throw new Error('Announcement not found.');
    }

    announcement.active = false;
    announcement.removedAt = new Date().toISOString();
    announcement.removedBySessionId = actor?.sessionId || 'admin';
    room.latestAnnouncement = room.announcements.find((item) => item.active) || null;
    writeLater(
      announcementRepository.update?.(room.roomId, announcement.announcementId, {
        active: false,
        removedAt: announcement.removedAt,
        removedBySessionId: announcement.removedBySessionId,
      }),
      'announcement remove',
    );
    const activity = addActivity(room.roomId, 'moderation_action', actor || { sessionId: 'admin', displayName: 'Admin' }, {
      action: 'announcement_removed',
      announcementId: announcement.announcementId,
    });
    return { room, announcement: serializeAnnouncement(announcement), activity };
  }

  function addActivity(roomId, type, actor = {}, metadata = {}) {
    const room = rooms.get(roomId);

    if (!room || !ROOM_ACTIVITY_TYPES.includes(type)) {
      return null;
    }

    const activity = serializeActivity({
      activityId: createId('act'),
      roomId,
      type: sanitizeActivityType(type),
      actorSessionId: actor.sessionId || '',
      actorUserId: actor.userId || null,
      actorName: actor.displayName || 'Nexus',
      createdAt: new Date().toISOString(),
      metadata: sanitizeActivityMetadata(metadata),
    });

    room.activity = [activity, ...(room.activity || [])].slice(0, CHAT_LIMITS.MAX_ROOM_ACTIVITY_LOAD);
    writeLater(activityRepository.create?.(roomId, activity), 'activity create');
    return activity;
  }

  async function getRoomActivity(roomId) {
    const room = requireRoom(roomId);
    await prepareRoomActivity(room);
    return (room.activity || []).slice(0, CHAT_LIMITS.MAX_ROOM_ACTIVITY_LOAD).map(serializeActivity);
  }

  async function getNotificationMembers(roomId) {
    const room = requireRoom(roomId);
    await prepareRoomMembers(room);
    return [...room.memberRecords.values()].map(serializeMemberRecord);
  }

  function getActiveSessionIds(roomId) {
    return [...(rooms.get(roomId)?.members.keys() || [])];
  }

  function getPublicRooms() {
    return [...rooms.values()]
      .filter((room) => !room.deletedAt && !isExpired(room) && (room.type === 'public' || room.type === 'temp'))
      .map(toPublicRoom)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  function getRoomState(room, viewerSessionId) {
    const viewer = room.members.get(viewerSessionId);
    const role = getMemberRole(room, viewer);
    const canModerate = role === 'owner' || role === 'moderator';

    return {
      room: toPublicRoom(room),
      messages: room.messages.map((message) => serializeMessage(message, viewerSessionId)),
      users: getUsers(room, viewerSessionId),
      typingUsers: getTypingUsers(room, viewerSessionId),
      announcements: (room.announcements || []).filter((announcement) => announcement.active).slice(0, CHAT_LIMITS.MAX_ACTIVE_ANNOUNCEMENTS_PER_ROOM).map(serializeAnnouncement),
      activity: (room.activity || []).slice(0, CHAT_LIMITS.MAX_ROOM_ACTIVITY_LOAD).map(serializeActivity),
      categoryTools: (room.categoryTools || []).slice(0, CHAT_LIMITS.MAX_CATEGORY_TOOLS_LOAD).map(serializeCategoryTool),
      currentUser: {
        role,
        isOwner: role === 'owner',
        canModerate,
        canManageRoom: role === 'owner',
        isMuted: isMuted(room.roomId, viewerSessionId),
      },
      moderationState: canModerate ? getModerationState(room) : null,
    };
  }

  function toPublicRoom(room) {
    const categorySnapshot = createCategorySnapshot(room.legacyCategory || room.categorySlug || room.category);
    return {
      roomId: room.roomId,
      inviteCode: room.inviteCode,
      title: room.title,
      type: room.type,
      ...categorySnapshot,
      ownerSessionId: room.ownerSessionId,
      ownerName: room.ownerName,
      communityId: room.communityId || '',
      communityName: room.communityName || '',
      communityRoleContext: room.communityRoleContext || '',
      roomPurpose: room.roomPurpose || '',
      eventRoomId: room.eventRoomId || '',
      rules: room.rules || '',
      templateId: room.templateId || '',
      themeId: room.themeId || 'classic',
      maxMembers: room.maxMembers || CHAT_LIMITS.MAX_ONLINE_USERS_PER_ROOM,
      createdAt: room.createdAt,
      expiresAt: room.expiresAt || null,
      lastActiveAt: room.lastActiveAt || room.createdAt,
      memberCount: room.memberCount,
      isLocked: room.isLocked,
      isExpired: isExpired(room),
      lastMessagePreview: room.lastMessagePreview || '',
      lastMessageAt: room.lastMessageAt || null,
      latestAnnouncement: room.latestAnnouncement ? serializeAnnouncement(room.latestAnnouncement) : null,
    };
  }

  function getUsers(room, viewerSessionId = '') {
    const viewer = room.members.get(viewerSessionId);
    const viewerRole = getMemberRole(room, viewer);
    const canSeeModeration = viewerRole === 'owner' || viewerRole === 'moderator';

    return [...room.members.values()].map((member) => ({
      sessionId: member.sessionId,
      userId: member.userId || null,
      memberId: member.memberId || getMemberId(member),
      displayName: member.displayName,
      avatar: member.avatar,
      photoMode: member.photoMode || 'avatar',
      photoURL: member.photoURL || '',
      handle: member.handle || '',
      status: member.status || '',
      joinedAt: member.joinedAt,
      role: getMemberRole(room, member),
      isOwner: getMemberRole(room, member) === 'owner',
      isModerator: getMemberRole(room, member) === 'moderator',
      isMuted: canSeeModeration ? isMuted(room.roomId, member.sessionId) : member.sessionId === viewerSessionId && isMuted(room.roomId, member.sessionId),
    }));
  }

  function getAdminRooms() {
    return [...rooms.values()].filter((room) => !room.deletedAt).map((room) => ({
      ...toPublicRoom(room),
      messageCount: room.messages.length,
      mutedCount: room.mutedUsers.size,
      bannedCount: [...room.memberRecords.values()].filter(isRecordBanned).length,
      kickedCooldownCount: [...room.kickedUsers.values()].filter((entry) => entry.expiresAt > Date.now()).length,
      users: getUsers(room, room.ownerSessionId),
    }));
  }

  function getModerationState(room) {
    return {
      muted: [...room.memberRecords.values()].filter(isRecordMuted).slice(0, CHAT_LIMITS.MAX_ROOM_MEMBERS_QUERY).map(serializeMemberRecord),
      banned: [...room.memberRecords.values()].filter(isRecordBanned).slice(0, CHAT_LIMITS.MAX_ROOM_MEMBERS_QUERY).map(serializeMemberRecord),
    };
  }

  async function getMemberRecords(roomId) {
    const room = requireRoom(roomId);
    await prepareRoomMembers(room);
    return [...room.memberRecords.values()].slice(0, CHAT_LIMITS.MAX_ROOM_MEMBERS_QUERY).map(serializeMemberRecord);
  }

  async function removeMemberAsAdmin(roomId, targetMemberId) {
    const room = requireRoom(roomId);
    const record = await getMemberRecordById(room, targetMemberId);

    if (!record) {
      throw new Error('Room member not found.');
    }

    if (record.role === 'owner' || isRoomOwner(room, record)) {
      throw new Error('Close the room instead of removing its owner.');
    }

    const target = room.members.get(record.sessionId);
    const socketIds = target ? [...target.socketIds] : [];
    const kickedUntil = new Date(Date.now() + CHAT_LIMITS.KICK_REJOIN_COOLDOWN_MS).toISOString();
    Object.assign(record, {
      kickedUntil,
      kickReason: 'Removed by admin',
      kickActionBy: { sessionId: 'admin', userId: null, displayName: 'Admin' },
      kickCreatedAt: new Date().toISOString(),
    });
    await memberRepository.updateModeration?.(room.roomId, record.memberId, {
      kickedUntil: record.kickedUntil,
      kickReason: record.kickReason,
      kickActionBy: record.kickActionBy,
      kickCreatedAt: record.kickCreatedAt,
    });

    if (target) {
      room.members.delete(target.sessionId);
      room.mutedUsers.delete(target.sessionId);
      room.typing.delete(target.sessionId);
      room.memberCount = room.members.size;
    }

    return { room, target: serializeMemberRecord(record), socketIds };
  }

  function getAdminOverview() {
    const adminRooms = getAdminRooms();

    return {
      rooms: adminRooms,
      totalRooms: adminRooms.length,
      totalOnlineUsers: adminRooms.reduce((sum, room) => sum + room.memberCount, 0),
      publicRooms: adminRooms.filter((room) => room.type === 'public' || room.type === 'temp').length,
      privateRooms: adminRooms.filter((room) => room.type === 'private').length,
    };
  }

  function isMuted(roomId, sessionId) {
    const room = rooms.get(roomId);
    const muted = room?.mutedUsers.get(sessionId);

    if (!muted) {
      return false;
    }

    if (muted.mutedUntil && muted.mutedUntil !== 'session' && new Date(muted.mutedUntil).getTime() <= Date.now()) {
      room.mutedUsers.delete(sessionId);
      return false;
    }

    return true;
  }

  function serializeMessage(message, viewerSessionId) {
    return {
      messageId: message.messageId,
      roomId: message.roomId,
      senderSessionId: message.senderSessionId,
      senderUserId: message.senderUserId || null,
      senderName: message.senderName,
      senderAvatar: message.senderAvatar,
      senderPhotoURL: message.senderPhotoURL || '',
      content: message.deletedAt ? '' : message.content,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      type: message.type,
      messageType: sanitizeCategoryMessageType(message.messageType || 'text'),
      categoryToolType: safeCategoryToolType(message.categoryToolType || ''),
      categoryToolId: message.categoryToolId || '',
      categoryMarkers: Array.isArray(message.categoryMarkers) ? message.categoryMarkers.map(serializeCategoryMarker) : [],
      metadata: serializeMessageMetadata(message.metadata || {}),
      replyToMessageId: message.replyToMessageId,
      replyToSenderName: message.replyToSenderName,
      replyToContentSnippet: message.replyToContentSnippet,
      mentions: Array.isArray(message.mentions) ? message.mentions.map(serializeMention) : [],
      deletedAt: message.deletedAt,
      deletedBySessionId: message.deletedBySessionId,
      reactions: serializeReactions(message, viewerSessionId),
    };
  }

  function serializeReactions(message, viewerSessionId) {
    if (!message.reactions || message.deletedAt) {
      return [];
    }

    return [...message.reactions.entries()]
      .map(([emoji, reactors]) => ({
        emoji,
        count: reactors.size,
        reactedByMe: reactors.has(viewerSessionId),
      }))
      .filter((reaction) => reaction.count > 0);
  }

  function isMember(roomId, sessionId) {
    return Boolean(rooms.get(roomId)?.members.has(sessionId));
  }

  function countRooms() {
    return rooms.size;
  }

  function cleanupExpiredRooms() {
    let count = 0;

    for (const room of rooms.values()) {
      if (isExpired(room)) {
        markRoomDeleted(room);
        rooms.delete(room.roomId);
        count += 1;
      }
    }

    writeLater(roomRepository.cleanupExpired?.(), 'expired room cleanup');
    return count;
  }

  function requireRoom(roomId) {
    const room = rooms.get(roomId);

    if (!room) {
      throw new Error('Room not found.');
    }

    return room;
  }

  function requireMessage(room, messageId) {
    const message = room.messages.find((item) => item.messageId === messageId);

    if (!message) {
      throw new Error('Message not found.');
    }

    return message;
  }

  function requireMember(room, sessionId) {
    const member = room.members.get(sessionId);

    if (!member) {
      throw new Error('User is not online in this room.');
    }

    return member;
  }

  function requireOwner(roomId, requester) {
    const room = requireRoom(roomId);

    if (!isRoomOwner(room, requester)) {
      throw new Error('Only the room owner can do that.');
    }

    return room;
  }

  function getActivePublicRoomCount() {
    return [...rooms.values()].filter(
      (room) => !room.deletedAt && !isExpired(room) && (room.type === 'public' || room.type === 'temp'),
    ).length;
  }

  function markMessageDeleted(message, sessionId) {
    message.content = '';
    message.deletedAt = new Date().toISOString();
    message.deletedBySessionId = sessionId;
    message.reactions.clear();
    message.updatedAt = message.deletedAt;
  }

  function enforceKickCooldown(room, sessionId, memberRecord) {
    if (isRecordBanned(memberRecord)) {
      throw new Error('You are banned from this room.');
    }

    if (isFutureUntil(memberRecord?.kickedUntil)) {
      throw new Error('You were removed from this room. Try again later.');
    }

    const kicked = room.kickedUsers.get(sessionId);

    if (!kicked) {
      return;
    }

    if (kicked.expiresAt <= Date.now()) {
      room.kickedUsers.delete(sessionId);
      return;
    }

    throw new Error('You were removed from this room. Try again later.');
  }

  function hydrateRoom(room, messages) {
    return {
      ...room,
      ...createCategorySnapshot(room.legacyCategory || room.categorySlug || room.category),
      ownerUserId: room.ownerUserId || null,
      updatedAt: room.updatedAt || room.createdAt,
      communityId: room.communityId || '',
      communityName: room.communityName || '',
      communityRoleContext: room.communityRoleContext || '',
      roomPurpose: room.roomPurpose || '',
      eventRoomId: room.eventRoomId || '',
      lastActiveAt: room.lastActiveAt || room.createdAt,
      expiresAt: room.expiresAt || null,
      deletedAt: room.deletedAt || null,
      rules: room.rules || '',
      templateId: room.templateId || '',
      themeId: room.themeId || 'classic',
      maxMembers: room.maxMembers || CHAT_LIMITS.MAX_ONLINE_USERS_PER_ROOM,
      memberCount: 0,
      members: new Map(),
      messages: messages.map(hydrateMessage),
      messagesHydrated: messages.length > 0 ? true : false,
      typing: new Map(),
      mutedUsers: new Map(),
      kickedUsers: new Map(),
      memberRecords: new Map(),
      membersHydrated: false,
      announcements: Array.isArray(room.announcements) ? room.announcements.map(serializeAnnouncement) : [],
      announcementsHydrated: false,
      activity: Array.isArray(room.activity) ? room.activity.map(serializeActivity) : [],
      activityHydrated: false,
      categoryTools: Array.isArray(room.categoryTools) ? room.categoryTools.map(serializeCategoryTool) : [],
      categoryToolsHydrated: false,
      lastMessagePreview: room.lastMessagePreview || '',
      lastMessageAt: room.lastMessageAt || null,
      latestAnnouncement: room.latestAnnouncement ? serializeAnnouncement(room.latestAnnouncement) : null,
    };
  }

  function hydratePersistedRooms(persistedRooms = []) {
    for (const persistedRoom of persistedRooms || []) {
      if (!persistedRoom?.roomId || persistedRoom.deletedAt || isExpired(persistedRoom) || rooms.has(persistedRoom.roomId)) {
        continue;
      }

      rooms.set(persistedRoom.roomId, hydrateRoom(persistedRoom, []));
    }
  }

  function hydrateMessage(message) {
    return {
      ...message,
      updatedAt: message.updatedAt || null,
      deletedAt: message.deletedAt || null,
      deletedBySessionId: message.deletedBySessionId || null,
      messageType: sanitizeCategoryMessageType(message.messageType || 'text'),
      categoryToolType: safeCategoryToolType(message.categoryToolType || ''),
      categoryToolId: message.categoryToolId || '',
      categoryMarkers: Array.isArray(message.categoryMarkers) ? message.categoryMarkers.map(serializeCategoryMarker) : [],
      metadata: serializeMessageMetadata(message.metadata || {}),
      replyToMessageId: message.replyToMessageId || null,
      replyToSenderName: message.replyToSenderName || '',
      replyToContentSnippet: message.replyToContentSnippet || '',
      mentions: Array.isArray(message.mentions) ? message.mentions.map(serializeMention) : [],
      reactions: new Map(
        Object.entries(message.reactions || {}).map(([emoji, reactors]) => [
          emoji,
          new Set(Array.isArray(reactors) ? reactors : []),
        ]),
      ),
    };
  }

  function persistRoom(room) {
    writeLater(roomRepository.save?.(toPersistedRoom(room)), 'room save');
  }

  function touchRoom(room, updates = {}) {
    const now = new Date().toISOString();
    room.updatedAt = updates.updatedAt || now;
    room.lastActiveAt = updates.lastActiveAt || now;
    writeLater(roomRepository.update?.(toPersistedRoom(room)), 'room update');
  }

  function persistMessage(message) {
    writeLater(messageRepository.save?.(message), 'message save');
  }

  function markRoomDeleted(room) {
    const deletedAt = new Date().toISOString();
    room.deletedAt = deletedAt;
    room.updatedAt = deletedAt;
    writeLater(roomRepository.softDelete?.(room.roomId, deletedAt), 'room delete');
  }

  function toPersistedRoom(room) {
    const categorySnapshot = createCategorySnapshot(room.legacyCategory || room.categorySlug || room.category);
    return {
      roomId: room.roomId,
      inviteCode: room.inviteCode,
      title: room.title,
      type: room.type,
      ...categorySnapshot,
      ownerSessionId: room.ownerSessionId,
      ownerUserId: room.ownerUserId || null,
      ownerName: room.ownerName,
      communityId: room.communityId || '',
      communityName: room.communityName || '',
      communityRoleContext: room.communityRoleContext || '',
      roomPurpose: room.roomPurpose || '',
      eventRoomId: room.eventRoomId || '',
      rules: room.rules || '',
      templateId: room.templateId || '',
      themeId: room.themeId || 'classic',
      maxMembers: room.maxMembers || CHAT_LIMITS.MAX_ONLINE_USERS_PER_ROOM,
      isLocked: Boolean(room.isLocked),
      createdAt: room.createdAt,
      updatedAt: room.updatedAt || room.createdAt,
      expiresAt: room.expiresAt || null,
      deletedAt: room.deletedAt || null,
      lastActiveAt: room.lastActiveAt || room.createdAt,
      memberCountSnapshot: room.memberCount || 0,
      lastMessagePreview: room.lastMessagePreview || '',
      lastMessageAt: room.lastMessageAt || null,
      latestAnnouncement: room.latestAnnouncement ? serializeAnnouncement(room.latestAnnouncement) : null,
    };
  }

  function createExpiry(value, limits = getPlanLimits('free')) {
    const requested = Number(value);
    const allowed = TEMP_ROOM_EXPIRY_OPTIONS.some(
      (option) => option.ms === requested && limits.tempDurations.includes(option.value),
    )
      ? requested
      : DEFAULT_TEMP_ROOM_EXPIRY_MS;
    return new Date(Date.now() + allowed).toISOString();
  }

  async function getOwnerLimits(owner) {
    return owner?.userId ? (await entitlementService?.getFeatureLimits?.(owner.userId)) || getPlanLimits('free') : getPlanLimits('free');
  }

  function getActiveCreatedRoomCount(owner) {
    return [...rooms.values()].filter(
      (room) =>
        !room.deletedAt &&
        !isExpired(room) &&
        ((owner.userId && room.ownerUserId === owner.userId) || (!owner.userId && room.ownerSessionId === owner.sessionId)),
    ).length;
  }

  function isTempDurationAllowed(expiresInMs, limits) {
    const requested = Number(expiresInMs || DEFAULT_TEMP_ROOM_EXPIRY_MS);
    const option = TEMP_ROOM_EXPIRY_OPTIONS.find((item) => item.ms === requested);
    return Boolean(option && limits.tempDurations.includes(option.value));
  }

  function isExpired(room) {
    if (!room?.expiresAt) {
      return false;
    }

    const expiresAt = new Date(room.expiresAt).getTime();
    return Number.isFinite(expiresAt) && expiresAt <= Date.now();
  }

  function writeLater(task, label) {
    if (!task?.catch) {
      return;
    }

    task.catch((error) => {
      console.warn(
        `Phase 4 persistence ${label} failed; live memory state kept. ${
          error instanceof Error ? error.message : 'Repository error.'
        }`,
      );
    });
  }

  async function prepareRoomMembers(room) {
    if (room.membersHydrated) {
      return room;
    }

    try {
      const records = await memberRepository.listByRoom?.(room.roomId, CHAT_LIMITS.MAX_ROOM_MEMBERS_QUERY);

      for (const record of records || []) {
        if (record?.memberId) {
          room.memberRecords.set(record.memberId, normalizeMemberRecord(record));
        }
      }
    } catch (error) {
      console.warn(
        `Persisted room members could not be loaded for ${room.roomId}; live members continue. ${
          error instanceof Error ? error.message : 'Repository read failed.'
        }`,
      );
    }

    room.membersHydrated = true;
    return room;
  }

  async function prepareRoomAnnouncements(room) {
    if (room.announcementsHydrated) {
      return room;
    }

    try {
      const announcements = await announcementRepository.listRecent?.(
        room.roomId,
        CHAT_LIMITS.MAX_ANNOUNCEMENT_HISTORY_LOAD,
      );
      room.announcements = (announcements || []).map(serializeAnnouncement);
      room.latestAnnouncement = room.announcements.find((announcement) => announcement.active) || null;
    } catch (error) {
      console.warn(
        `Persisted announcements could not be loaded for ${room.roomId}; live room continues. ${
          error instanceof Error ? error.message : 'Repository read failed.'
        }`,
      );
    }

    room.announcementsHydrated = true;
    return room;
  }

  async function prepareRoomActivity(room) {
    if (room.activityHydrated) {
      return room;
    }

    try {
      const activity = await activityRepository.listByRoom?.(room.roomId, CHAT_LIMITS.MAX_ROOM_ACTIVITY_LOAD);
      room.activity = (activity || []).map(serializeActivity);
    } catch (error) {
      console.warn(
        `Persisted activity could not be loaded for ${room.roomId}; live room continues. ${
          error instanceof Error ? error.message : 'Repository read failed.'
        }`,
      );
    }

    room.activityHydrated = true;
    return room;
  }

  async function getOrCreateMemberRecord(room, user, forcedRole = '') {
    await prepareRoomMembers(room);
    const memberId = getMemberId(user);
    let record = room.memberRecords.get(memberId);

    if (!record) {
      record = normalizeMemberRecord(
        (await memberRepository.get?.(room.roomId, memberId)) ||
          createMemberRecord(room, user, forcedRole || (isRoomOwner(room, user) ? 'owner' : 'member')),
      );
      room.memberRecords.set(memberId, record);
    }

    if (isRoomOwner(room, user)) {
      record.role = 'owner';
    }

    activateRecordModeration(room, user.sessionId, record);
    return record;
  }

  async function getMemberRecordById(room, memberId) {
    await prepareRoomMembers(room);
    const cleanId = String(memberId || '').trim();

    if (!cleanId) {
      return null;
    }

    const record = room.memberRecords.get(cleanId) || (await memberRepository.get?.(room.roomId, cleanId));

    if (record) {
      room.memberRecords.set(cleanId, normalizeMemberRecord(record));
    }

    return record ? room.memberRecords.get(cleanId) : null;
  }

  async function touchMemberRecord(room, record, user) {
    const now = new Date().toISOString();
    Object.assign(record, {
      userId: user.userId || record.userId || null,
      sessionId: user.sessionId,
      displayName: user.displayName,
      avatar: user.avatar,
      photoMode: user.photoMode || 'avatar',
      photoURL: user.photoURL || '',
      handle: user.handle || record.handle || '',
      status: user.status || record.status || '',
      role: isRoomOwner(room, user) ? 'owner' : record.role || 'member',
      lastVisitedAt: now,
      joinedAt: record.joinedAt || now,
    });
    room.memberRecords.set(record.memberId, record);
    await memberRepository.upsert?.(room.roomId, record);
    await writeJoinedRoom(user, room, record.role);
    activateRecordModeration(room, user.sessionId, record);
  }

  async function requireModerator(room, requester) {
    if (!room.members.has(requester.sessionId)) {
      throw new Error('Join the room before moderating.');
    }

    if (isRoomOwner(room, requester)) {
      return 'owner';
    }

    const record = await getOrCreateMemberRecord(room, requester);

    if (record.role !== 'moderator') {
      throw new Error('Only a room owner or moderator can do that.');
    }

    return record.role;
  }

  function assertCanModerateTarget(room, requester, targetSessionId) {
    if (requester.sessionId === targetSessionId) {
      throw new Error('You cannot moderate yourself.');
    }

    const target = requireMember(room, targetSessionId);
    const record = room.memberRecords.get(target.memberId || getMemberId(target));
    assertCanModerateRecord(room, requester, record || target);
  }

  function assertCanModerateRecord(room, requester, target) {
    const requesterRole = isRoomOwner(room, requester) ? 'owner' : getMemberRole(room, requester);
    const targetRole = target?.role || 'member';

    if (targetRole === 'owner' || isRoomOwner(room, target)) {
      throw new Error('Room owner cannot be moderated.');
    }

    if (requesterRole === 'moderator' && targetRole !== 'member') {
      throw new Error('Moderators can only moderate room members.');
    }
  }

  function getMemberRole(room, user) {
    if (!user) {
      return 'member';
    }

    if (isRoomOwner(room, user)) {
      return 'owner';
    }

    const record = room.memberRecords.get(user.memberId || getMemberId(user));
    return record?.role === 'moderator' ? 'moderator' : 'member';
  }

  function createMemberRecord(room, user, role = 'member') {
    const now = new Date().toISOString();

    return normalizeMemberRecord({
      memberId: getMemberId(user),
      roomId: room.roomId,
      userId: user.userId || null,
      sessionId: user.sessionId,
      displayName: user.displayName,
      avatar: user.avatar,
      photoMode: user.photoMode || 'avatar',
      photoURL: user.photoURL || '',
      handle: user.handle || '',
      status: user.status || '',
      role,
      joinedAt: now,
      lastVisitedAt: now,
      mutedUntil: null,
      kickedUntil: null,
      bannedUntil: null,
    });
  }

  function normalizeMemberRecord(record) {
    return {
      memberId: record.memberId || getMemberId(record),
      roomId: record.roomId || '',
      userId: record.userId || null,
      sessionId: record.sessionId || '',
      displayName: record.displayName || 'User',
      avatar: record.avatar || 'nexus',
      photoMode: record.photoMode || 'avatar',
      photoURL: record.photoURL || '',
      handle: record.handle || '',
      status: record.status || '',
      role: record.role === 'owner' || record.role === 'moderator' ? record.role : 'member',
      joinedAt: record.joinedAt || new Date().toISOString(),
      lastVisitedAt: record.lastVisitedAt || record.joinedAt || new Date().toISOString(),
      mutedUntil: record.mutedUntil || null,
      kickedUntil: record.kickedUntil || null,
      bannedUntil: record.bannedUntil || null,
      muteReason: record.muteReason || '',
      kickReason: record.kickReason || '',
      banReason: record.banReason || '',
      muteActionBy: record.muteActionBy || null,
      kickActionBy: record.kickActionBy || null,
      banActionBy: record.banActionBy || null,
      muteCreatedAt: record.muteCreatedAt || null,
      kickCreatedAt: record.kickCreatedAt || null,
      banCreatedAt: record.banCreatedAt || null,
    };
  }

  function activateRecordModeration(room, sessionId, record) {
    if (!record?.mutedUntil) {
      return;
    }

    if (record.mutedUntil === 'session' || isFutureUntil(record.mutedUntil)) {
      room.mutedUsers.set(sessionId, {
        sessionId,
        displayName: record.displayName,
        mutedUntil: record.mutedUntil,
      });
    }
  }

  function getMemberId(user) {
    return user?.userId ? `user_${user.userId}` : user?.memberId || user?.sessionId || '';
  }

  function normalizeMentionKey(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/^@+/, '')
      .replace(/[^\p{L}\p{N}._-]/gu, '');
  }

  function isRoomOwner(room, requester) {
    if (!requester) {
      return false;
    }

    return Boolean(
      (room.ownerUserId && requester.userId && room.ownerUserId === requester.userId) ||
        (room.ownerSessionId && requester.sessionId && room.ownerSessionId === requester.sessionId),
    );
  }

  function isRecordBanned(record) {
    return record?.bannedUntil === 'permanent' || isFutureUntil(record?.bannedUntil);
  }

  function isRecordMuted(record) {
    return record?.mutedUntil === 'session' || isFutureUntil(record?.mutedUntil);
  }

  function isFutureUntil(value) {
    if (!value || value === 'session' || value === 'permanent') {
      return false;
    }

    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) && timestamp > Date.now();
  }

  function actorRef(actor) {
    return {
      userId: actor.userId || null,
      sessionId: actor.sessionId,
      displayName: actor.displayName,
    };
  }

  function serializeMention(mention) {
    return {
      userId: mention?.userId || null,
      sessionId: mention?.sessionId || '',
      displayName: mention?.displayName || 'User',
      handle: mention?.handle || '',
    };
  }

  function serializeAnnouncement(announcement) {
    return {
      announcementId: announcement.announcementId,
      roomId: announcement.roomId,
      title: sanitizeAnnouncementTitle(announcement.title || 'Announcement'),
      body: sanitizeAnnouncementBody(announcement.body || 'Room announcement'),
      createdByUserId: announcement.createdByUserId || null,
      createdBySessionId: announcement.createdBySessionId || '',
      createdByName: announcement.createdByName || 'Nexus',
      createdAt: announcement.createdAt || new Date().toISOString(),
      pinnedUntil: announcement.pinnedUntil || null,
      active: announcement.active !== false,
      removedAt: announcement.removedAt || null,
    };
  }

  function serializeActivity(activity) {
    return {
      activityId: activity.activityId,
      roomId: activity.roomId || '',
      type: ROOM_ACTIVITY_TYPES.includes(activity.type) ? activity.type : 'system_notice',
      actorSessionId: activity.actorSessionId || '',
      actorUserId: activity.actorUserId || null,
      actorName: activity.actorName || 'Nexus',
      createdAt: activity.createdAt || new Date().toISOString(),
      metadata: sanitizeActivityMetadata(activity.metadata),
    };
  }

  function serializeCategoryTool(tool = {}) {
    return {
      toolId: String(tool.toolId || '').slice(0, 120),
      roomId: String(tool.roomId || '').slice(0, 120),
      categorySlug: getCategorySlug(tool.categorySlug || tool.category || 'random'),
      toolType: safeCategoryToolType(tool.toolType || 'topic_spinner'),
      title: sanitizeReplySnippet(tool.title || 'Room tool'),
      body: sanitizeReplySnippet(tool.body || ''),
      status: String(tool.status || 'open').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'open',
      createdByUserId: tool.createdByUserId || null,
      createdBySessionId: String(tool.createdBySessionId || '').slice(0, 120),
      createdByName: sanitizeReplySnippet(tool.createdByName || 'Guest'),
      targetMessageId: String(tool.targetMessageId || '').slice(0, 120),
      createdAt: tool.createdAt || new Date().toISOString(),
      updatedAt: tool.updatedAt || tool.createdAt || new Date().toISOString(),
      closedAt: tool.closedAt || null,
      metadata: serializeMessageMetadata(tool.metadata || {}),
    };
  }

  function serializeCategoryMarker(marker = {}) {
    return {
      toolId: String(marker.toolId || '').slice(0, 120),
      toolType: safeCategoryToolType(marker.toolType || 'topic_spinner'),
      label: sanitizeReplySnippet(marker.label || 'Marked'),
      status: String(marker.status || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40),
    };
  }

  function serializeMessageMetadata(metadata = {}) {
    const sanitized = sanitizeCategoryToolMetadata(metadata);
    delete sanitized.votes;
    delete sanitized.participants;
    delete sanitized.voters;
    return sanitized;
  }

  function safeCategoryToolType(toolType) {
    if (!toolType) {
      return '';
    }

    try {
      return sanitizeCategoryToolType(toolType);
    } catch {
      return 'topic_spinner';
    }
  }

  function sanitizeActivityMetadata(metadata = {}) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(metadata)
        .slice(0, 10)
        .map(([key, value]) => [
          String(key).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40),
          typeof value === 'string' ? sanitizeReplySnippet(value) : typeof value === 'number' || typeof value === 'boolean' ? value : '',
        ]),
    );
  }

  function serializeMemberRecord(record) {
    return {
      memberId: record.memberId,
      userId: record.userId || null,
      sessionId: record.sessionId || null,
      displayName: record.displayName,
      avatar: record.avatar,
      photoMode: record.photoMode || 'avatar',
      photoURL: record.photoURL || '',
      handle: record.handle || '',
      status: record.status || '',
      role: record.role,
      joinedAt: record.joinedAt || null,
      lastVisitedAt: record.lastVisitedAt || null,
      mutedUntil: record.mutedUntil || null,
      kickedUntil: record.kickedUntil || null,
      bannedUntil: record.bannedUntil || null,
      muteReason: record.muteReason || '',
      kickReason: record.kickReason || '',
      banReason: record.banReason || '',
    };
  }

  async function writeJoinedRoom(user, room, role) {
    if (!user?.userId) {
      return;
    }

    const now = new Date().toISOString();
    await userRepository.saveJoinedRoom?.(user.userId, {
      roomId: room.roomId,
      userId: user.userId,
      sessionId: user.sessionId,
      role,
      joinedAt: now,
      lastVisitedAt: now,
      notificationsEnabled: true,
      notificationsMuted: false,
      mutedUntil: null,
      notificationSettingsVersion: 7,
      unreadCount: 0,
      roomSnapshot: toPublicRoom(room),
    });
  }

  async function incrementModerationStat(actor) {
    await userRepository.incrementStat?.(actor.userId, 'moderationActions');
  }

  function upsertUser(user) {
    writeLater(userRepository.upsert?.(user), 'user persistence');
  }

  return {
    addMessage,
    addActivity,
    applyMessageCategoryMarker,
    banUser,
    clearTyping,
    countRooms,
    createRoom,
    createAnnouncement,
    deleteRoom,
    deleteRoomAsAdmin,
    findReplyTarget,
    findOrLoadRoom,
    findRoom,
    getAdminOverview,
    getAdminRooms,
    getActiveSessionIds,
    getMemberRecords,
    getNotificationMembers,
    getRoomActivity,
    getRoomReports,
    getPublicRooms,
    getRoomState,
    getTypingUsers,
    getUsers,
    initializeFromPersistence,
    isMuted,
    isMember,
    joinRoom,
    kickUser,
    leaveRoom,
    applyCommunityRole,
    muteUser,
    parseMentions,
    prepareRoomHistory,
    publishScheduledAnnouncement,
    pruneStaleSockets,
    refreshPublicRoomsFromPersistence,
    removeAnnouncementAsAdmin,
    removeMemberAsAdmin,
    removeSocketFromAllRooms,
    renameRoom,
    serializeMessage,
    setRoomLocked,
    setMemberRole,
    setTyping,
    clearRecentMessages,
    softDeleteMessage,
    softDeleteMessageByRequester,
    toPublicRoom,
    toggleReaction,
    unbanUser,
    cleanupExpiredRooms,
    updateRoomRules,
    updateRoomTheme,
    upsertUser,
    unmuteUser,
  };
}

function sanitizeRoomPurpose(value) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, 90);
}

function createCategorySnapshot(category) {
  const config = getCategoryConfig(category);
  const legacyCategory = !isValidCategory(category) && String(category || '').trim()
    ? String(category).trim().slice(0, CHAT_LIMITS.MAX_CATEGORY_LENGTH)
    : '';
  return {
    category: sanitizeCategory(config.slug),
    categorySlug: getCategorySlug(config.slug),
    categoryLabel: config.label,
    categoryThemeClass: config.themeClass,
    categoryAccentClass: config.accentClass,
    categoryAnalyticsKey: getCategoryForAnalytics(config.slug),
    categoryFeatureHooks: getCategoryFeatureHooks(config.slug),
    categoryAllowedRoomTypes: config.allowedRoomTypes,
    legacyCategory,
  };
}

export function createChatMessage({
  roomId,
  sender,
  content,
  replyTo,
  mentions = [],
  messageType = 'text',
  categoryToolType = '',
  categoryToolId = '',
  metadata = {},
}) {
  return {
    messageId: createId('msg'),
    roomId,
    senderSessionId: sender.sessionId,
    senderUserId: sender.userId || null,
    senderName: sender.displayName,
    senderAvatar: sender.avatar,
    senderPhotoURL: sender.photoURL || '',
    content,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    type: 'chat',
    messageType: sanitizeCategoryMessageType(messageType || 'text'),
    categoryToolType: categoryToolType ? sanitizeCategoryToolType(categoryToolType) : '',
    categoryToolId: String(categoryToolId || '').slice(0, 120),
    categoryMarkers: [],
    metadata: sanitizeCategoryToolMetadata(metadata || {}),
    replyToMessageId: replyTo?.replyToMessageId || null,
    replyToSenderName: replyTo?.replyToSenderName || '',
    replyToContentSnippet: replyTo?.replyToContentSnippet || '',
    mentions: Array.isArray(mentions) ? mentions : [],
    deletedAt: null,
    deletedBySessionId: null,
    reactions: new Map(),
  };
}

export function createSystemMessage(roomId, content) {
  return {
    messageId: createId('sys'),
    roomId,
    senderSessionId: 'system',
    senderUserId: null,
    senderName: 'Nexus',
    senderAvatar: 'nexus',
    senderPhotoURL: '',
    content,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    type: 'system',
    messageType: 'text',
    categoryToolType: '',
    categoryToolId: '',
    categoryMarkers: [],
    metadata: {},
    replyToMessageId: null,
    replyToSenderName: '',
    replyToContentSnippet: '',
    mentions: [],
    deletedAt: null,
    deletedBySessionId: null,
    reactions: new Map(),
  };
}

function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function createInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}
