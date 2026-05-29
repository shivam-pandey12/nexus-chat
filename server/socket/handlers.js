import crypto from 'node:crypto';

import { CHAT_LIMITS } from '../../shared/chatConfig.js';
import { CATEGORY_MESSAGE_TYPES, detectCodingSecretRisk, isToolEnabledForCategory } from '../../shared/categoryConfig.js';
import {
  createChatMessage,
  createSystemMessage,
} from '../services/roomService.js';
import {
  assertPlainObject,
  createRateLimiter,
  createRepeatedMessageGuard,
  isValidSessionId,
  sanitizeDisplayName,
  sanitizeHandle,
  sanitizeIdentifier,
  sanitizeInviteCode,
  sanitizeCardMessageBody,
  sanitizeCategoryMessageType,
  sanitizeCategoryToolMetadata,
  sanitizeCategoryToolType,
  sanitizeCodeSnippetContent,
  hasHighConfidenceCodingSecret,
  sanitizeMessageContent,
  sanitizeModerationDuration,
  sanitizeReactionEmoji,
  sanitizeReportDetails,
  sanitizeReportReason,
  sanitizeReportTargetType,
  sanitizeProfileStatus,
  sanitizeRoomRole,
} from '../services/safetyService.js';

const AVATAR_IDS = new Set(['nexus', 'ivory', 'gold', 'sage', 'onyx', 'rose']);

export function createSocketHandlers(
  io,
  roomService,
  moderationService,
  persistenceService,
  notificationService,
  communityService,
  options = {},
) {
  const {
    logger = console,
    rateLimitService,
    analyticsService,
    cacheService,
    entitlementService,
    categoryFeatureService,
    launchConfig = {},
  } = options;
  const messageLimiter = createRateLimiter({
    windowMs: CHAT_LIMITS.MESSAGE_RATE_WINDOW_MS,
    max: CHAT_LIMITS.MESSAGE_RATE_MAX,
  });
  const messageCooldown = createRateLimiter({
    windowMs: CHAT_LIMITS.MESSAGE_COOLDOWN_MS,
    max: 1,
  });
  const repeatedMessageGuard = createRepeatedMessageGuard({
    windowMs: CHAT_LIMITS.REPEATED_MESSAGE_WINDOW_MS,
    max: CHAT_LIMITS.REPEATED_MESSAGE_MAX,
  });
  const typingTimers = new Map();
  notificationService?.setEmitter?.((socketId, event, payload) => {
    io.to(socketId).emit(event, payload);
  });
  const stalePresenceTimer = setInterval(() => {
    const activeSocketIds = new Set(io.sockets.sockets.keys());
    const departures = roomService.pruneStaleSockets?.(activeSocketIds) || [];

    for (const { room, member } of departures) {
      fireAndForget(cacheService?.removePresence?.(room.roomId, member.sessionId));
      clearTypingTimer(room.roomId, member.sessionId);
      emitSystemMessage(room, `${member.displayName} left.`);
      emitRoomState(room);
      emitTyping(room);
    }

    if (departures.length > 0) {
      logger.debug?.('Pruned stale socket presence.', { departures: departures.length });
      emitPublicRooms();
    }
  }, 45_000);
  stalePresenceTimer.unref?.();

  io.on('connection', (socket) => {
    socket.data.launchConfig = launchConfig;
    socket.data.logger = logger;
    logger.debug?.('Socket connected.', {
      socketId: socket.id,
      transport: socket.conn?.transport?.name || 'unknown',
    });
    socket.conn?.on?.('upgrade', (transport) => {
      logger.debug?.('Socket transport upgraded.', {
        socketId: socket.id,
        transport: transport?.name || 'unknown',
      });
    });
    socket.on('error', (error) => {
      logger.warn?.('Socket runtime error handled safely.', {
        socketId: socket.id,
        error: error instanceof Error ? error.message : 'socket error',
      });
    });
    socket.emit('connection:status', { state: 'connected' });

    socket.on('guest:ready', async (profile, acknowledge = noop) => {
      try {
        if (launchConfig.maintenanceMode) {
          throw new Error('Nexus Chat is in maintenance mode. Please try again soon.');
        }

        const guest = sanitizeGuestProfile(profile);
        const decodedToken = profile?.idToken ? await persistenceService.verifyIdToken(profile.idToken) : null;

        if (!decodedToken?.uid && launchConfig.guestChatEnabled === false) {
          throw new Error('Guest chat is paused right now. Login entry may return when launch mode allows it.');
        }

        if (decodedToken?.uid) {
          guest.userId = decodedToken.uid;
          guest.authProvider = getFirebaseProvider(decodedToken);
          guest.email = decodedToken.email || '';
          entitlementService?.rememberVerifiedIdentity?.(guest);
        }

        if (socket.data.guest?.userId && socket.data.guest.userId !== guest.userId) {
          notificationService?.unregisterSocket?.(socket.id);
        }

        socket.data.guest = guest;
        roomService.upsertUser(guest);
        if (guest.userId) {
          notificationService?.registerUserSocket?.(guest.userId, socket.id);
          socket.emit('notifications:unread', {
            unreadCount: await notificationService?.countUnread?.(guest.userId),
          });
        }
        acknowledgeSafe(acknowledge, { ok: true, profile: guest });
      } catch (error) {
        const rawMessage = error instanceof Error ? error.message : '';
        const message =
          rawMessage === 'Nexus Chat is in maintenance mode. Please try again soon.' ||
          rawMessage === 'Guest chat is paused right now. Login entry may return when launch mode allows it.'
            ? rawMessage
            : 'Account session could not be verified. Continue as a guest or sign in again.';
        logger.warn?.('Socket profile handshake rejected.', {
          socketId: socket.id,
          reason: rawMessage || 'unknown',
        });
        socket.emit('room:error', { message });
        acknowledgeSafe(acknowledge, { ok: false, error: message });
      }
    });

    socket.on('room:create', (payload, acknowledge = noop) => {
      handleRoomAction(socket, acknowledge, async () => {
        await assertSocketLimit(socket, 'roomCreate');
        const cleanPayload = assertPlainObject(payload, 'Room payload');

        if (cleanPayload.communityId && launchConfig.communitiesEnabled === false) {
          throw new Error('Community rooms are paused for this launch mode.');
        }

        const communityContext = cleanPayload.communityId
          ? await communityService?.prepareRoomCreate?.(socket.data.guest, cleanPayload)
          : {};
        const room = await roomService.createRoom({
          title: cleanPayload.title,
          type: cleanPayload.type,
          category: cleanPayload.category,
          expiresInMs: cleanPayload.expiresInMs,
          rules: cleanPayload.rules,
          templateId: cleanPayload.templateId,
          roomPurpose: cleanPayload.roomPurpose,
          owner: socket.data.guest,
          ...communityContext,
          eventRoomId: cleanPayload.eventRoomId || communityContext.eventRoomId || '',
        });
        await communityService?.attachRoom?.(room, socket.data.guest);
        analyticsService?.track?.('rooms_created', {
          roomId: room.roomId,
          communityId: room.communityId,
          category: room.categoryAnalyticsKey || room.category,
        });

        const joinResult = await roomService.joinRoom(room, socket.data.guest, socket.id);
        if (communityContext.communityRoleContext) {
          await roomService.applyCommunityRole?.(room.roomId, socket.data.guest, communityContext.communityRoleContext);
        }
        socket.join(room.roomId);
        fireAndForget(cacheService?.addPresence?.(room.roomId, socket.data.guest.sessionId));
        emitSystemMessage(room, `${joinResult.member.displayName} created the room.`);
        emitRoomState(room);
        emitPublicRooms();
        acknowledgeSafe(acknowledge, { ok: true, state: roomService.getRoomState(room, socket.data.guest.sessionId) });
        socket.emit('room:joined', roomService.getRoomState(room, socket.data.guest.sessionId));
      });
    });

    socket.on('room:join', (payload, acknowledge = noop) => {
      handleRoomAction(socket, acknowledge, async () => {
        return joinRequestedRoom(socket, payload, acknowledge);
      });
    });

    socket.on('room:restore', (payload, acknowledge = noop) => {
      handleRoomAction(socket, acknowledge, () => {
        return joinRequestedRoom(socket, payload, acknowledge);
      });
    });

    socket.on('room:leave', (payload, acknowledge = noop) => {
      handleRoomAction(socket, acknowledge, () => {
        const cleanPayload = assertPlainObject(payload, 'Room payload');
        leaveSocketRoom(socket, sanitizeIdentifier(cleanPayload.roomId, 'Room'));
        acknowledgeSafe(acknowledge, { ok: true });
      });
    });

    socket.on('room:read', (payload, acknowledge = noop) => {
      handleRoomAction(socket, acknowledge, async () => {
        const cleanPayload = assertPlainObject(payload, 'Read payload');
        const roomId = sanitizeIdentifier(cleanPayload.roomId, 'Room');

        if (!roomService.isMember(roomId, socket.data.guest.sessionId)) {
          throw new Error('Join the room before marking it read.');
        }

        const result = await notificationService?.markRoomRead?.(socket.data.guest, roomId, {
          lastReadMessageId: cleanPayload.lastReadMessageId || '',
        });
        acknowledgeSafe(acknowledge, { ok: true, read: result || { roomId } });
      });
    });

    socket.on('room:announcement:create', (payload, acknowledge = noop) => {
      handleRoomAction(socket, acknowledge, async () => {
        await assertSocketLimit(socket, 'announcements');
        const cleanPayload = assertPlainObject(payload, 'Announcement payload');
        const roomId = sanitizeIdentifier(cleanPayload.roomId, 'Room');
        const { room, announcement, activity } = await roomService.createAnnouncement(roomId, socket.data.guest, cleanPayload);
        emitRoomState(room);
        io.to(room.roomId).emit('room:announcement', { roomId: room.roomId, announcement });

        if (activity) {
          io.to(room.roomId).emit('room:activity', { roomId: room.roomId, activity });
        }

        try {
          await notificationService?.notifyAnnouncement?.({
            room,
            announcement,
            actor: socket.data.guest,
            memberRecords: await roomService.getNotificationMembers(roomId),
          });
        } catch (error) {
          logger.warn?.('Announcement notifications skipped safely.', { error });
        }
        analyticsService?.track?.('room_announcements_created', { roomId, communityId: room.communityId });
        acknowledgeSafe(acknowledge, { ok: true, announcement });
      });
    });

    socket.on('message:send', (payload, acknowledge = noop) => {
      handleRoomAction(socket, acknowledge, async () => {
        await assertSocketLimit(socket, 'messages');
        const cleanPayload = assertPlainObject(payload, 'Message payload');
        const roomId = sanitizeIdentifier(cleanPayload.roomId, 'Room');
        const sessionId = socket.data.guest.sessionId;

        if (!roomService.isMember(roomId, sessionId)) {
          throw new Error('Join the room before sending messages.');
        }

        const roomForMessage = roomService.findRoom(roomId);
        await communityService?.validateRoomMessage?.(roomForMessage, socket.data.guest);

        if (roomService.isMuted(roomId, sessionId)) {
          throw new Error('You are muted in this room.');
        }

        if (!messageCooldown.check(`${sessionId}:${roomId}:cooldown`)) {
          throw new Error('Please wait a moment before sending again.');
        }

        if (!messageLimiter.check(`${sessionId}:${roomId}:rate`)) {
          throw new Error('Slow down before sending another message.');
        }

        const messageType = sanitizeCategoryMessageType(cleanPayload.messageType || 'text');
        const categoryToolType = cleanPayload.categoryToolType ? sanitizeCategoryToolType(cleanPayload.categoryToolType) : inferToolTypeForMessage(messageType);
        let content = '';
        const metadata = sanitizeCategoryToolMetadata(cleanPayload.metadata || {});

        if (messageType !== 'text') {
          await assertSocketLimit(socket, 'categoryCardMessages');
          const roomCategory = roomForMessage?.categorySlug || roomForMessage?.category || 'random';

          if (categoryToolType && !isToolEnabledForCategory(categoryToolType, roomCategory)) {
            throw new Error('That category card is not available in this room.');
          }

          if (messageType === 'code_snippet') {
            content = sanitizeCodeSnippetContent(cleanPayload.content);
            const risk = detectCodingSecretRisk(content);

            if (hasHighConfidenceCodingSecret(content)) {
              throw new Error('This looks like a private key or service account secret. Remove credentials before sending.');
            }

            if (risk.risky && !cleanPayload.secretWarningAccepted) {
              throw new Error('This may contain credentials. Review it and confirm before sending.');
            }
          } else if (CATEGORY_MESSAGE_TYPES.includes(messageType)) {
            content = sanitizeCardMessageBody(cleanPayload.content);
          }
        } else {
          content = sanitizeMessageContent(cleanPayload.content);
        }

        if (!repeatedMessageGuard.check(`${sessionId}:${roomId}:repeat`, content)) {
          throw new Error('Repeated message blocked for safety.');
        }

        let replyTo = null;

        if (cleanPayload.replyToMessageId) {
          const replyToMessageId = sanitizeIdentifier(cleanPayload.replyToMessageId, 'Reply message');
          replyTo = roomService.findReplyTarget(roomId, replyToMessageId);

          if (!replyTo) {
            throw new Error('Reply target is no longer available.');
          }
        }

        const mentions = await roomService.parseMentions(roomId, content);
        const room = roomService.clearTyping(roomId, sessionId) || roomForMessage || roomService.findRoom(roomId);
        const message = createChatMessage({
          roomId,
          sender: socket.data.guest,
          content,
          replyTo,
          mentions,
          messageType,
          categoryToolType,
          categoryToolId: cleanPayload.categoryToolId || '',
          metadata,
        });
        roomService.addMessage(roomId, message);
        emitTyping(room);
        emitMessage(room, message, 'message:new');
        try {
          await notificationService?.handleMessageCreated?.({
            room,
            message,
            replyTo,
            mentions,
            memberRecords: await roomService.getNotificationMembers(roomId),
            activeSessionIds: roomService.getActiveSessionIds(roomId),
          });
        } catch (error) {
          logger.warn?.('Notification fanout skipped safely.', { error });
        }
        analyticsService?.track?.('messages_sent', {
          roomId,
          communityId: room?.communityId,
          category: room?.categoryAnalyticsKey || room?.category,
          type: messageType,
        });
        acknowledgeSafe(acknowledge, {
          ok: true,
          message: roomService.serializeMessage(message, sessionId),
        });
      });
    });

    socket.on('message:react', (payload, acknowledge = noop) => {
      handleRoomAction(socket, acknowledge, async () => {
        await assertSocketLimit(socket, 'reactions');
        const cleanPayload = assertPlainObject(payload, 'Reaction payload');
        const roomId = sanitizeIdentifier(cleanPayload.roomId, 'Room');
        const messageId = sanitizeIdentifier(cleanPayload.messageId, 'Message');
        const emoji = sanitizeReactionEmoji(cleanPayload.emoji);

        if (!roomService.isMember(roomId, socket.data.guest.sessionId)) {
          throw new Error('Join the room before reacting.');
        }

        const { room, message } = roomService.toggleReaction(
          roomId,
          messageId,
          socket.data.guest.sessionId,
          emoji,
        );
        emitMessage(room, message, 'message:updated');
        acknowledgeSafe(acknowledge, { ok: true });
      });
    });

    socket.on('message:delete', (payload, acknowledge = noop) => {
      handleRoomAction(socket, acknowledge, async () => {
        const cleanPayload = assertPlainObject(payload, 'Delete payload');
        const roomId = sanitizeIdentifier(cleanPayload.roomId, 'Room');
        const messageId = sanitizeIdentifier(cleanPayload.messageId, 'Message');

        if (!roomService.isMember(roomId, socket.data.guest.sessionId)) {
          throw new Error('Join the room before deleting messages.');
        }

        const { room, message, wasOwnerAction, targetSessionId, targetName } =
          await roomService.softDeleteMessageByRequester(roomId, messageId, socket.data.guest);
        emitMessage(room, message, 'message:deleted');

        if (wasOwnerAction) {
          moderationService.addLog({
            roomId,
            actor: socket.data.guest,
            actionType: 'delete_message',
            targetSessionId,
            targetMessageId: messageId,
            reason: 'Owner deleted a message',
            details: targetName,
          });
          emitSystemMessage(room, 'A message was removed by room moderation.');
        }

        acknowledgeSafe(acknowledge, { ok: true });
      });
    });

    socket.on('categoryTool:create', (payload, acknowledge = noop) => {
      handleCategoryToolEvent(socket, acknowledge, payload, 'categoryTools', (room, cleanPayload) =>
        categoryFeatureService.createTool(room, socket.data.guest, cleanPayload),
      );
    });

    socket.on('categoryTool:update', (payload, acknowledge = noop) => {
      handleCategoryToolEvent(socket, acknowledge, payload, 'categoryTools', (room, cleanPayload) =>
        categoryFeatureService.updateTool(room, socket.data.guest, cleanPayload),
      );
    });

    socket.on('categoryTool:delete', (payload, acknowledge = noop) => {
      handleCategoryToolEvent(socket, acknowledge, payload, 'categoryTools', (room, cleanPayload) =>
        categoryFeatureService.deleteTool(room, socket.data.guest, cleanPayload),
      );
    });

    socket.on('categoryTool:vote', (payload, acknowledge = noop) => {
      handleCategoryToolEvent(socket, acknowledge, payload, 'categoryToolVotes', (room, cleanPayload) =>
        categoryFeatureService.vote(room, socket.data.guest, cleanPayload),
      );
    });

    socket.on('categoryTool:joinMatch', (payload, acknowledge = noop) => {
      handleCategoryToolEvent(socket, acknowledge, payload, 'categoryToolVotes', (room, cleanPayload) =>
        categoryFeatureService.joinMatch(room, socket.data.guest, cleanPayload),
      );
    });

    socket.on('categoryTool:startTimer', (payload, acknowledge = noop) => {
      handleCategoryToolEvent(socket, acknowledge, payload, 'categoryToolTimers', (room, cleanPayload) =>
        categoryFeatureService.startTimer(room, socket.data.guest, cleanPayload),
      );
    });

    socket.on('categoryTool:pauseTimer', (payload, acknowledge = noop) => {
      handleCategoryToolEvent(socket, acknowledge, payload, 'categoryToolTimers', (room, cleanPayload) =>
        categoryFeatureService.pauseTimer(room, socket.data.guest, cleanPayload),
      );
    });

    socket.on('categoryTool:completeTimer', (payload, acknowledge = noop) => {
      handleCategoryToolEvent(socket, acknowledge, payload, 'categoryToolTimers', (room, cleanPayload) =>
        categoryFeatureService.completeTimer(room, socket.data.guest, cleanPayload),
      );
    });

    socket.on('categoryTool:markSolved', (payload, acknowledge = noop) => {
      handleCategoryToolEvent(socket, acknowledge, payload, 'categoryTools', (room, cleanPayload) =>
        categoryFeatureService.markSolved(room, socket.data.guest, cleanPayload),
      );
    });

    socket.on('categoryTool:pollVote', (payload, acknowledge = noop) => {
      handleCategoryToolEvent(socket, acknowledge, payload, 'categoryToolVotes', (room, cleanPayload) =>
        categoryFeatureService.pollVote(room, socket.data.guest, cleanPayload),
      );
    });

    socket.on('moderation:report', (payload, acknowledge = noop) => {
      handleRoomAction(socket, acknowledge, async () => {
        await assertSocketLimit(socket, 'reports');
        const cleanPayload = assertPlainObject(payload, 'Report payload');
        const roomId = sanitizeIdentifier(cleanPayload.roomId, 'Room');

        if (!roomService.isMember(roomId, socket.data.guest.sessionId)) {
          throw new Error('Join the room before reporting.');
        }

        const report = moderationService.createReport({
          reporter: socket.data.guest,
          targetType: sanitizeReportTargetType(cleanPayload.targetType),
          targetId: sanitizeIdentifier(cleanPayload.targetId, 'Report target'),
          roomId,
          reason: sanitizeReportReason(cleanPayload.reason),
          details: sanitizeReportDetails(cleanPayload.details),
        });

        moderationService.addLog({
          roomId,
          actor: socket.data.guest,
          actionType: 'report_action',
          targetRoomId: cleanPayload.targetType === 'room' ? cleanPayload.targetId : '',
          targetSessionId: cleanPayload.targetType === 'user' ? cleanPayload.targetId : '',
          targetMessageId: cleanPayload.targetType === 'message' ? cleanPayload.targetId : '',
          reason: `Report created: ${report.reason}`,
          details: report.reportId,
        });

        analyticsService?.track?.('reports_created', {
          roomId,
          type: report.targetType,
          category: roomService.findRoom(roomId)?.categoryAnalyticsKey || roomService.findRoom(roomId)?.category,
        });
        acknowledgeSafe(acknowledge, { ok: true, report });
      });
    });

    socket.on('moderation:mute', (payload, acknowledge = noop) => {
      handleRoomAction(socket, acknowledge, async () => {
        const cleanPayload = assertPlainObject(payload, 'Mute payload');
        const roomId = sanitizeIdentifier(cleanPayload.roomId, 'Room');
        const targetSessionId = sanitizeIdentifier(cleanPayload.targetSessionId, 'User');
        const duration = sanitizeModerationDuration('mute', cleanPayload.duration || '15m');
        const { room, target } = await roomService.muteUser(
          roomId,
          socket.data.guest,
          targetSessionId,
          duration,
          cleanPayload.reason,
        );
        moderationService.addLog({
          roomId,
          actor: socket.data.guest,
          actionType: 'mute',
          targetSessionId,
          reason: 'Room moderation muted user',
          details: target.displayName,
        });
        emitSystemMessage(room, `${target.displayName} was muted by room moderation.`);
        emitRoomState(room);
        acknowledgeSafe(acknowledge, { ok: true });
      });
    });

    socket.on('moderation:unmute', (payload, acknowledge = noop) => {
      handleRoomAction(socket, acknowledge, async () => {
        const cleanPayload = assertPlainObject(payload, 'Unmute payload');
        const roomId = sanitizeIdentifier(cleanPayload.roomId, 'Room');
        const targetSessionId = sanitizeIdentifier(cleanPayload.targetSessionId, 'User');
        const { room, target } = await roomService.unmuteUser(roomId, socket.data.guest, targetSessionId);
        moderationService.addLog({
          roomId,
          actor: socket.data.guest,
          actionType: 'unmute',
          targetSessionId,
          reason: 'Room moderation unmuted user',
          details: target.displayName,
        });
        emitSystemMessage(room, `${target.displayName} was unmuted by room moderation.`);
        emitRoomState(room);
        acknowledgeSafe(acknowledge, { ok: true });
      });
    });

    socket.on('moderation:kick', (payload, acknowledge = noop) => {
      handleRoomAction(socket, acknowledge, async () => {
        const cleanPayload = assertPlainObject(payload, 'Kick payload');
        const roomId = sanitizeIdentifier(cleanPayload.roomId, 'Room');
        const targetSessionId = sanitizeIdentifier(cleanPayload.targetSessionId, 'User');
        const duration = sanitizeModerationDuration('kick', cleanPayload.duration || 'cooldown');
        const { room, target, socketIds } = await roomService.kickUser(
          roomId,
          socket.data.guest,
          targetSessionId,
          duration,
          cleanPayload.reason,
        );
        moderationService.addLog({
          roomId,
          actor: socket.data.guest,
          actionType: 'kick',
          targetSessionId,
          reason: 'Room moderation removed user',
          details: target.displayName,
        });

        for (const socketId of socketIds) {
          io.to(socketId).emit('room:kicked', {
            roomId,
            reason: 'You were removed from this room by the owner.',
          });
          io.sockets.sockets.get(socketId)?.leave(roomId);
          clearTypingTimer(roomId, targetSessionId);
        }

        emitSystemMessage(room, `${target.displayName} was removed from the room.`);
        emitRoomState(room);
        emitTyping(room);
        emitPublicRooms();
        acknowledgeSafe(acknowledge, { ok: true });
      });
    });

    socket.on('moderation:ban', (payload, acknowledge = noop) => {
      handleRoomAction(socket, acknowledge, async () => {
        const cleanPayload = assertPlainObject(payload, 'Ban payload');
        const roomId = sanitizeIdentifier(cleanPayload.roomId, 'Room');
        const targetSessionId = sanitizeIdentifier(cleanPayload.targetSessionId, 'User');
        const duration = sanitizeModerationDuration('ban', cleanPayload.duration || '24h');
        const { room, target, socketIds } = await roomService.banUser(
          roomId,
          socket.data.guest,
          targetSessionId,
          duration,
          cleanPayload.reason,
        );
        moderationService.addLog({
          roomId,
          actor: socket.data.guest,
          actionType: 'ban',
          targetSessionId,
          reason: 'Room moderation banned user',
          details: target.displayName,
        });

        for (const socketId of socketIds) {
          io.to(socketId).emit('room:kicked', {
            roomId,
            reason: 'You were banned from this room.',
          });
          io.sockets.sockets.get(socketId)?.leave(roomId);
          clearTypingTimer(roomId, targetSessionId);
        }

        emitSystemMessage(room, `${target.displayName} was banned from the room.`);
        emitRoomState(room);
        emitTyping(room);
        emitPublicRooms();
        acknowledgeSafe(acknowledge, { ok: true });
      });
    });

    socket.on('moderation:unban', (payload, acknowledge = noop) => {
      handleRoomAction(socket, acknowledge, async () => {
        const cleanPayload = assertPlainObject(payload, 'Unban payload');
        const roomId = sanitizeIdentifier(cleanPayload.roomId, 'Room');
        const targetMemberId = sanitizeIdentifier(cleanPayload.targetMemberId, 'Member');
        const { room, target } = await roomService.unbanUser(roomId, socket.data.guest, targetMemberId);
        moderationService.addLog({
          roomId,
          actor: socket.data.guest,
          actionType: 'unban',
          targetSessionId: target.sessionId,
          reason: 'Room moderation removed ban',
          details: target.displayName,
        });
        emitRoomState(room);
        acknowledgeSafe(acknowledge, { ok: true });
      });
    });

    socket.on('room:role', (payload, acknowledge = noop) => {
      handleRoomAction(socket, acknowledge, async () => {
        const cleanPayload = assertPlainObject(payload, 'Role payload');
        const roomId = sanitizeIdentifier(cleanPayload.roomId, 'Room');
        const targetSessionId = sanitizeIdentifier(cleanPayload.targetSessionId, 'User');
        const role = sanitizeRoomRole(cleanPayload.role);
        const { room, target } = await roomService.setMemberRole(roomId, socket.data.guest, targetSessionId, role);
        moderationService.addLog({
          roomId,
          actor: socket.data.guest,
          actionType: 'role_change',
          targetSessionId,
          reason: `Room role set to ${role}`,
          details: target.displayName,
        });
        emitSystemMessage(room, `${target.displayName} is now ${role === 'moderator' ? 'a moderator' : 'a member'}.`);
        emitRoomState(room);
        acknowledgeSafe(acknowledge, { ok: true });
      });
    });

    socket.on('moderation:clear_recent', (payload, acknowledge = noop) => {
      handleRoomAction(socket, acknowledge, async () => {
        const cleanPayload = assertPlainObject(payload, 'Clear messages payload');
        const roomId = sanitizeIdentifier(cleanPayload.roomId, 'Room');
        const { room, count } = await roomService.clearRecentMessages(
          roomId,
          socket.data.guest,
          CHAT_LIMITS.CLEAR_RECENT_MESSAGE_COUNT,
        );
        moderationService.addLog({
          roomId,
          actor: socket.data.guest,
          actionType: 'clear_messages',
          reason: 'Room owner cleared recent messages',
          details: `${count} messages`,
        });

        emitRoomState(room);

        if (count > 0) {
          emitSystemMessage(room, `${count} recent messages were cleared by the room owner.`);
        }

        acknowledgeSafe(acknowledge, { ok: true, count });
      });
    });

    socket.on('typing:start', (payload, acknowledge = noop) => {
      handleRoomAction(socket, acknowledge, async () => {
        await assertSocketLimit(socket, 'typing');
        const cleanPayload = assertPlainObject(payload, 'Typing payload');
        const roomId = sanitizeIdentifier(cleanPayload.roomId, 'Room');
        const room = roomService.setTyping(roomId, socket.data.guest);
        scheduleTypingClear(roomId, socket.data.guest.sessionId);
        emitTyping(room);
        acknowledgeSafe(acknowledge, { ok: true });
      });
    });

    socket.on('typing:stop', (payload, acknowledge = noop) => {
      handleRoomAction(socket, acknowledge, () => {
        const cleanPayload = assertPlainObject(payload, 'Typing payload');
        const roomId = sanitizeIdentifier(cleanPayload.roomId, 'Room');
        const room = roomService.clearTyping(roomId, socket.data.guest.sessionId);

        if (room) {
          emitTyping(room);
        }

        acknowledgeSafe(acknowledge, { ok: true });
      });
    });

    socket.on('room:rename', (payload, acknowledge = noop) => {
      handleRoomAction(socket, acknowledge, () => {
        const cleanPayload = assertPlainObject(payload, 'Room payload');
        const roomId = sanitizeIdentifier(cleanPayload.roomId, 'Room');
        const room = roomService.renameRoom(roomId, socket.data.guest, cleanPayload.title);
        emitSystemMessage(room, `${socket.data.guest.displayName} renamed the room.`);
        emitRoomState(room);
        emitPublicRooms();
        acknowledgeSafe(acknowledge, { ok: true, state: roomService.getRoomState(room, socket.data.guest.sessionId) });
      });
    });

    socket.on('room:lock', (payload, acknowledge = noop) => {
      handleRoomAction(socket, acknowledge, () => {
        const cleanPayload = assertPlainObject(payload, 'Room payload');
        const roomId = sanitizeIdentifier(cleanPayload.roomId, 'Room');
        const room = roomService.setRoomLocked(
          roomId,
          socket.data.guest,
          cleanPayload.isLocked,
        );
        emitSystemMessage(room, room.isLocked ? 'The room was locked.' : 'The room was unlocked.');
        emitRoomState(room);
        emitPublicRooms();
        acknowledgeSafe(acknowledge, { ok: true, state: roomService.getRoomState(room, socket.data.guest.sessionId) });
      });
    });

    socket.on('room:rules', (payload, acknowledge = noop) => {
      handleRoomAction(socket, acknowledge, () => {
        const cleanPayload = assertPlainObject(payload, 'Rules payload');
        const roomId = sanitizeIdentifier(cleanPayload.roomId, 'Room');
        const room = roomService.updateRoomRules(roomId, socket.data.guest, cleanPayload.rules);
        emitRoomState(room);
        acknowledgeSafe(acknowledge, { ok: true, state: roomService.getRoomState(room, socket.data.guest.sessionId) });
      });
    });

    socket.on('room:theme', (payload, acknowledge = noop) => {
      handleRoomAction(socket, acknowledge, async () => {
        const cleanPayload = assertPlainObject(payload, 'Theme payload');
        const roomId = sanitizeIdentifier(cleanPayload.roomId, 'Room');
        const themeId = sanitizeIdentifier(cleanPayload.themeId || 'classic', 'Room theme');
        const room = await roomService.updateRoomTheme(roomId, socket.data.guest, themeId);
        analyticsService?.track?.('room_theme_applied', {
          roomId,
          category: room.categoryAnalyticsKey || room.category,
          type: themeId,
        });
        emitRoomState(room);
        emitPublicRooms();
        acknowledgeSafe(acknowledge, { ok: true, state: roomService.getRoomState(room, socket.data.guest.sessionId) });
      });
    });

    socket.on('room:delete', (payload, acknowledge = noop) => {
      handleRoomAction(socket, acknowledge, () => {
        const cleanPayload = assertPlainObject(payload, 'Room payload');
        const roomId = sanitizeIdentifier(cleanPayload.roomId, 'Room');
        const room = roomService.deleteRoom(roomId, socket.data.guest);
        moderationService.addLog({
          roomId,
          actor: socket.data.guest,
          actionType: 'close_room',
          targetRoomId: roomId,
          reason: 'Room owner closed room',
          details: room.title,
        });
        io.to(room.roomId).emit('room:closed', { roomId: room.roomId, reason: 'Room closed by owner.' });
        io.in(room.roomId).socketsLeave(room.roomId);
        emitPublicRooms();
        acknowledgeSafe(acknowledge, { ok: true });
      });
    });

    socket.on('disconnect', (reason) => {
      logger.debug?.('Socket disconnected.', {
        socketId: socket.id,
        reason,
        hadGuest: Boolean(socket.data.guest),
      });

      if (!socket.data.guest) {
        return;
      }

      notificationService?.unregisterSocket?.(socket.id);
      const departures = roomService.removeSocketFromAllRooms(socket.id, socket.data.guest.sessionId);

      for (const { room, member } of departures) {
        fireAndForget(cacheService?.removePresence?.(room.roomId, member.sessionId));
        clearTypingTimer(room.roomId, member.sessionId);
        emitSystemMessage(room, `${member.displayName} left.`);
        emitRoomState(room);
        emitTyping(room);
      }

      if (departures.length > 0) {
        emitPublicRooms();
      }
    });
  });

  function handleCategoryToolEvent(socket, acknowledge, payload, limitKey, action) {
    handleRoomAction(socket, acknowledge, async () => {
      if (!categoryFeatureService) {
        throw new Error('Category tools are not available right now.');
      }

      await assertSocketLimit(socket, limitKey || 'categoryTools');
      const cleanPayload = assertPlainObject(payload, 'Category tool payload');
      const roomId = sanitizeIdentifier(cleanPayload.roomId, 'Room');

      if (!roomService.isMember(roomId, socket.data.guest.sessionId)) {
        throw new Error('Join the room before using category tools.');
      }

      const room = roomService.findRoom(roomId);
      await categoryFeatureService.hydrateRoom?.(room);
      assertCategoryMessageMarkerPermission(room, socket, cleanPayload);
      const result = await action(room, cleanPayload);
      const activity = roomService.addActivity(roomId, 'category_tool_updated', socket.data.guest, {
        toolType: result.tool?.toolType || '',
        title: result.tool?.title || '',
        status: result.tool?.status || '',
      });
      maybeMarkMessageFromTool(room, result.tool);
      maybeEmitToolSystemMessage(room, result);
      emitCategoryTools(room, result.tool, activity);
      analyticsService?.track?.(`category_tool_${result.action || 'updated'}`, {
        roomId,
        category: room.categoryAnalyticsKey || room.category,
        type: result.tool?.toolType || '',
      });
      acknowledgeSafe(acknowledge, {
        ok: true,
        tool: roomService.getRoomState(room, socket.data.guest.sessionId).categoryTools.find((tool) => tool.toolId === result.tool?.toolId) || null,
        tools: roomService.getRoomState(room, socket.data.guest.sessionId).categoryTools,
      });
    });
  }

  function assertCategoryMessageMarkerPermission(room, socket, payload = {}) {
    const markerTools = new Set(['doubt_marker', 'help_queue', 'fix_solved_marker', 'feedback_request', 'priority_tag']);
    const toolType = payload.toolType || '';

    if (!payload.targetMessageId || !markerTools.has(toolType)) {
      return;
    }

    const target = roomService.findReplyTarget(room.roomId, sanitizeIdentifier(payload.targetMessageId, 'Message'));

    if (!target) {
      throw new Error('Message target is no longer available.');
    }

    const currentState = roomService.getRoomState(room, socket.data.guest.sessionId);
    const canModerate = Boolean(currentState.currentUser?.canModerate);

    if (!canModerate && target.senderSessionId !== socket.data.guest.sessionId) {
      throw new Error('Only the message author or room moderators can mark that message.');
    }
  }

  async function joinRequestedRoom(socket, payload, acknowledge) {
    const cleanPayload = assertPlainObject(payload, 'Room payload');
    const roomIdentifier = cleanPayload.roomId
      ? sanitizeIdentifier(cleanPayload.roomId, 'Room')
      : sanitizeInviteCode(cleanPayload.inviteCode || cleanPayload.code);
    const room = await roomService.findOrLoadRoom(roomIdentifier, { includeUnavailable: true });

    if (!room) {
      throw new Error('No room found for that code.');
    }

    await roomService.prepareRoomHistory(room);
    await categoryFeatureService?.hydrateRoom?.(room);
    await communityService?.validateRoomJoin?.(room, socket.data.guest);
    const joinResult = await roomService.joinRoom(room, socket.data.guest, socket.id);
    if (room.communityId) {
      const details = await communityService?.getCommunity?.(room.communityId, socket.data.guest).catch(() => null);
      await roomService.applyCommunityRole?.(room.roomId, socket.data.guest, details?.membership?.role || '');
    }
    socket.join(room.roomId);
    fireAndForget(cacheService?.addPresence?.(room.roomId, socket.data.guest.sessionId));

    if (joinResult.isFirstJoin) {
      emitSystemMessage(room, `${joinResult.member.displayName} joined.`);
      const activity = roomService.addActivity(room.roomId, 'user_joined', socket.data.guest, {
        displayName: joinResult.member.displayName,
      });

      if (activity) {
        io.to(room.roomId).emit('room:activity', { roomId: room.roomId, activity });
      }
    }

    emitRoomState(room);
    emitPublicRooms();
    acknowledgeSafe(acknowledge, { ok: true, state: roomService.getRoomState(room, socket.data.guest.sessionId) });
    socket.emit('room:joined', roomService.getRoomState(room, socket.data.guest.sessionId));
  }

  function emitRoomState(room) {
    for (const member of room.members.values()) {
      for (const socketId of member.socketIds) {
        const state = roomService.getRoomState(room, member.sessionId);
        io.to(socketId).emit('room:state', state);
        io.to(socketId).emit('users:update', state.users);
      }
    }
  }

  function emitCategoryTools(room, changedTool, activity) {
    for (const member of room.members.values()) {
      for (const socketId of member.socketIds) {
        const state = roomService.getRoomState(room, member.sessionId);
        const tool = state.categoryTools.find((item) => item.toolId === changedTool?.toolId) || null;
        io.to(socketId).emit('categoryTool:updated', {
          roomId: room.roomId,
          tool,
          tools: state.categoryTools,
          activity,
        });
        io.to(socketId).emit('room:state', state);
      }
    }

    if (activity) {
      io.to(room.roomId).emit('room:activity', { roomId: room.roomId, activity });
    }
  }

  function emitMessage(room, message, eventName) {
    for (const member of room.members.values()) {
      for (const socketId of member.socketIds) {
        io.to(socketId).emit(eventName, roomService.serializeMessage(message, member.sessionId));
      }
    }
  }

  function emitSystemMessage(room, content) {
    const message = createSystemMessage(room.roomId, content);
    roomService.addMessage(room.roomId, message);
    emitMessage(room, message, 'message:new');
  }

  function maybeMarkMessageFromTool(room, tool) {
    if (!tool?.targetMessageId) {
      return;
    }

    const marker = markerForTool(tool);

    if (!marker) {
      return;
    }

    try {
      const { message } = roomService.applyMessageCategoryMarker(room.roomId, tool.targetMessageId, marker);
      emitMessage(room, message, 'message:updated');
    } catch (error) {
      logger.warn?.('Message category marker skipped safely.', { error });
    }
  }

  function maybeEmitToolSystemMessage(room, result = {}) {
    const tool = result.tool || {};
    const message = {
      timer_started: `${tool.createdByName || 'Room mod'} started a focus timer.`,
      timer_completed: 'Focus timer completed. Nice work.',
      solved: `${tool.createdByName || 'A member'} marked an item solved.`,
    }[result.action];

    if (message) {
      emitSystemMessage(room, message);
    }
  }

  function markerForTool(tool = {}) {
    const labelMap = {
      doubt_marker: tool.status === 'solved' ? 'Solved' : 'Need help',
      help_queue: tool.status === 'solved' ? 'Solved' : tool.metadata?.priority === 'urgent' ? 'Urgent help' : 'Need help',
      fix_solved_marker: tool.status === 'fixed' ? 'Fix found' : 'Investigating',
      feedback_request: 'Feedback requested',
      priority_tag: tool.metadata?.priority === 'urgent' ? 'Urgent' : 'Priority',
      draft_pin: 'Pinned draft',
    };
    const label = labelMap[tool.toolType];

    if (!label) {
      return null;
    }

    return {
      toolId: tool.toolId,
      toolType: tool.toolType,
      label,
      status: tool.status,
    };
  }

  function emitTyping(room) {
    for (const member of room.members.values()) {
      for (const socketId of member.socketIds) {
        io.to(socketId).emit('typing:update', {
          roomId: room.roomId,
          typingUsers: roomService.getTypingUsers(room, member.sessionId),
        });
      }
    }
  }

  function emitPublicRooms() {
    io.emit('rooms:update', { rooms: roomService.getPublicRooms() });
  }

  function leaveSocketRoom(socket, roomId) {
    const room = roomService.clearTyping(roomId, socket.data.guest.sessionId);
    const result = roomService.leaveRoom(roomId, socket.data.guest.sessionId, socket.id);
    socket.leave(roomId);
    clearTypingTimer(roomId, socket.data.guest.sessionId);

    if (room) {
      emitTyping(room);
    }

    if (result?.didLeaveCompletely) {
      fireAndForget(cacheService?.removePresence?.(roomId, socket.data.guest.sessionId));
      emitSystemMessage(result.room, `${result.member.displayName} left.`);
      emitRoomState(result.room);
      emitPublicRooms();
    }
  }

  function scheduleTypingClear(roomId, sessionId) {
    const key = `${roomId}:${sessionId}`;
    clearTypingTimer(roomId, sessionId);
    typingTimers.set(
      key,
      setTimeout(() => {
        typingTimers.delete(key);
        const room = roomService.clearTyping(roomId, sessionId);

        if (room) {
          emitTyping(room);
        }
      }, CHAT_LIMITS.TYPING_TTL_MS),
    );
  }

  function clearTypingTimer(roomId, sessionId) {
    const key = `${roomId}:${sessionId}`;
    const timer = typingTimers.get(key);

    if (timer) {
      clearTimeout(timer);
      typingTimers.delete(key);
    }
  }

  async function assertSocketLimit(socket, action) {
    if (!rateLimitService?.assertAllowed) {
      return;
    }

    const identity = socket.data.guest?.userId || socket.data.guest?.sessionId || socket.handshake?.address || socket.id;
    await rateLimitService.assertAllowed(action, identity);
  }

  function fireAndForget(promise) {
    Promise.resolve(promise).catch((error) => logger.warn?.('Socket side effect skipped safely.', { error }));
  }
}

function handleRoomAction(socket, acknowledge, action) {
  if (socket.data.launchConfig?.maintenanceMode) {
    handleRoomError(socket, acknowledge, new Error('Nexus Chat is in maintenance mode. Please try again soon.'));
    return;
  }

  if (!socket.data.guest) {
    handleRoomError(socket, acknowledge, new Error('Guest profile is required.'));
    return;
  }

  Promise.resolve()
    .then(action)
    .catch((error) => {
      handleRoomError(socket, acknowledge, error);
    });
}

function inferToolTypeForMessage(messageType) {
  return {
    code_snippet: 'code_snippet_mode',
    match_invite: 'match_invite',
    score_card: 'score_post',
    topic_card: 'topic_spinner',
    poll_card: 'quick_poll',
  }[messageType] || '';
}

function handleRoomError(socket, acknowledge, error) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  socket.data.logger?.warn?.('Socket action rejected safely.', {
    socketId: socket.id,
    error,
  });
  socket.emit('room:error', { message });
  acknowledgeSafe(acknowledge, { ok: false, error: message });
}

function acknowledgeSafe(acknowledge, payload) {
  if (typeof acknowledge !== 'function') {
    return;
  }

  try {
    acknowledge(payload);
  } catch {
    // A broken client ack should never take down the live socket pipeline.
  }
}

function sanitizeGuestProfile(profile) {
  const sessionId = isValidSessionId(profile?.sessionId)
    ? profile.sessionId
    : `guest_${crypto.randomBytes(10).toString('hex')}`;
  const avatar = AVATAR_IDS.has(profile?.avatar) ? profile.avatar : 'nexus';

  return {
    sessionId,
    displayName: sanitizeDisplayName(profile?.displayName),
    avatar,
    photoMode: profile?.photoMode === 'google' ? 'google' : 'avatar',
    photoURL: profile?.photoMode === 'google' ? safePhotoURL(profile?.photoURL) : '',
    handle: safeHandle(profile?.handle),
    status: sanitizeProfileStatus(profile?.status || profile?.bio || ''),
  };
}

function getFirebaseProvider(decodedToken = {}) {
  const provider = decodedToken.firebase?.sign_in_provider || '';

  if (provider === 'password') {
    return 'password';
  }

  if (provider === 'google.com') {
    return 'google';
  }

  return provider ? 'firebase' : 'password';
}

function safeHandle(value) {
  try {
    return value ? sanitizeHandle(value) : '';
  } catch {
    return '';
  }
}

function safePhotoURL(value) {
  const text = String(value || '').trim();

  if (!text || text.length > 500) {
    return '';
  }

  try {
    const url = new URL(text);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function noop() {}
