import { FieldValue } from 'firebase-admin/firestore';

import { CHAT_LIMITS } from '../../shared/chatConfig.js';

const COLLECTIONS = {
  rooms: 'rooms',
  reports: 'reports',
  moderationLogs: 'moderationLogs',
  users: 'users',
  handles: 'userHandles',
  billingEvents: 'billingEvents',
  analyticsDaily: 'analyticsDaily',
  feedback: 'feedback',
  communities: 'communities',
  eventRooms: 'eventRooms',
  scheduledAnnouncements: 'scheduledAnnouncements',
};

const LEGACY_COLLECTIONS = {
  rooms: 'nexusRooms',
  messages: 'nexusMessages',
  reports: 'nexusReports',
  moderationLogs: 'nexusModerationLogs',
  users: 'nexusUsers',
};

export function createFirestoreRepositories(db) {
  return {
    roomRepository: createRoomRepository(db),
    messageRepository: createMessageRepository(db),
    reportRepository: createReportRepository(db),
    moderationLogRepository: createModerationLogRepository(db),
    userRepository: createUserRepository(db),
    memberRepository: createMemberRepository(db),
    billingRepository: createBillingRepository(db),
    notificationRepository: createNotificationRepository(db),
    announcementRepository: createAnnouncementRepository(db),
    activityRepository: createActivityRepository(db),
    communityRepository: createCommunityRepository(db),
    communityMemberRepository: createCommunityMemberRepository(db),
    communityRoomRepository: createCommunityRoomRepository(db),
    communityAnnouncementRepository: createCommunityAnnouncementRepository(db),
    communityActivityRepository: createCommunityActivityRepository(db),
    eventRepository: createEventRepository(db),
    rsvpRepository: createRsvpRepository(db),
    scheduledAnnouncementRepository: createScheduledAnnouncementRepository(db),
    feedbackRepository: createFeedbackRepository(db),
    analyticsRepository: createAnalyticsRepository(db),
    categoryToolRepository: createCategoryToolRepository(db),
    pushTokenRepository: createPushTokenRepository(db),
  };
}

function createRoomRepository(db) {
  const rooms = db.collection(COLLECTIONS.rooms);
  const legacyRooms = db.collection(LEGACY_COLLECTIONS.rooms);

  async function getRoom(roomId) {
    const canonical = await rooms.doc(roomId).get();

    if (canonical.exists) {
      return readDoc(canonical);
    }

    const legacy = await legacyRooms.doc(roomId).get();
    return legacy.exists ? { ...readDoc(legacy), legacySource: true } : null;
  }

  return {
    async listActive(limit = 250) {
      // TODO Phase 5 Firestore index: rooms type/category/deletedAt/lastActiveAt for larger explore/admin lists.
      const [canonicalSnapshot, legacySnapshot] = await Promise.all([
        rooms.orderBy('createdAt', 'desc').limit(limit).get(),
        legacyRooms.orderBy('createdAt', 'desc').limit(limit).get(),
      ]);
      return mergeCompatibilityDocs(canonicalSnapshot, legacySnapshot, limit).filter((room) => !room.deletedAt);
    },

    async get(roomId) {
      return getRoom(roomId);
    },

    async findByInviteCode(inviteCode) {
      const cleanInviteCode = String(inviteCode || '').trim().toUpperCase();

      if (!cleanInviteCode) {
        return null;
      }

      const [canonicalSnapshot, legacySnapshot] = await Promise.all([
        rooms.where('inviteCode', '==', cleanInviteCode).limit(1).get(),
        legacyRooms.where('inviteCode', '==', cleanInviteCode).limit(1).get(),
      ]);

      if (!canonicalSnapshot.empty) {
        return readDoc(canonicalSnapshot.docs[0]);
      }

      return legacySnapshot.empty ? null : { ...readDoc(legacySnapshot.docs[0]), legacySource: true };
    },

    async getMany(roomIds, limit = CHAT_LIMITS.MAX_MY_ROOMS_QUERY) {
      const uniqueIds = [...new Set((roomIds || []).filter(Boolean))].slice(0, limit);
      const roomsById = await Promise.all(uniqueIds.map(getRoom));
      return roomsById.filter(Boolean);
    },

    async save(room) {
      await rooms.doc(room.roomId).set(toFirestoreValue(room), { merge: true });
    },

    async update(room) {
      await rooms.doc(room.roomId).set(toFirestoreValue(room), { merge: true });
    },

    async touch(roomId, updates) {
      await rooms.doc(roomId).set(toFirestoreValue(updates), { merge: true });
    },

    async softDelete(roomId, deletedAt) {
      await rooms.doc(roomId).set({ deletedAt, updatedAt: deletedAt }, { merge: true });
    },

    async cleanupExpired(nowIso = new Date().toISOString()) {
      // TODO Phase 5 Firestore index: rooms type + expiresAt for bounded temp cleanup.
      const snapshot = await rooms.where('type', '==', 'temp').where('expiresAt', '<=', nowIso).limit(100).get();

      if (snapshot.empty) {
        return 0;
      }

      const batch = db.batch();
      let count = 0;

      snapshot.docs.forEach((document) => {
        const room = readDoc(document);

        if (!room.deletedAt) {
          batch.set(document.ref, { deletedAt: nowIso, updatedAt: nowIso }, { merge: true });
          count += 1;
        }
      });

      if (count > 0) {
        await batch.commit();
      }

      return count;
    },
  };
}

function createMessageRepository(db) {
  const legacyMessages = db.collection(LEGACY_COLLECTIONS.messages);

  return {
    async listRecentByRoom(roomId, limit = CHAT_LIMITS.PERSISTED_MESSAGE_LOAD_LIMIT) {
      const boundedLimit = Math.min(limit, CHAT_LIMITS.PERSISTED_MESSAGE_LOAD_LIMIT);
      // TODO Phase 5 Firestore index: legacy nexusMessages roomId + createdAt until old history ages out.
      const canonicalSnapshot = await roomMessages(db, roomId)
        .orderBy('createdAt', 'desc')
        .limit(boundedLimit)
        .get();

      if (!canonicalSnapshot.empty) {
        return canonicalSnapshot.docs.map(readDoc).reverse();
      }

      const legacySnapshot = await legacyMessages
        .where('roomId', '==', roomId)
        .orderBy('createdAt', 'desc')
        .limit(boundedLimit)
        .get();
      return legacySnapshot.docs.map((document) => ({ ...readDoc(document), legacySource: true })).reverse();
    },

    async save(message) {
      await roomMessages(db, message.roomId).doc(message.messageId).set(toFirestoreValue(message), { merge: true });
    },

    async update(message) {
      await roomMessages(db, message.roomId).doc(message.messageId).set(toFirestoreValue(message), { merge: true });
    },

    async enforceLimit(roomId, limit = CHAT_LIMITS.MAX_PERSISTED_MESSAGES_PER_ROOM) {
      const snapshot = await roomMessages(db, roomId).orderBy('createdAt', 'desc').limit(limit + 100).get();

      if (snapshot.size <= limit) {
        return;
      }

      const batch = db.batch();
      snapshot.docs.slice(limit).forEach((document) => batch.delete(document.ref));
      await batch.commit();
    },
  };
}

function createReportRepository(db) {
  const reports = db.collection(COLLECTIONS.reports);
  const legacyReports = db.collection(LEGACY_COLLECTIONS.reports);

  return {
    async listRecent(limit = 500) {
      // TODO Phase 5 Firestore index: reports status + createdAt for admin filters.
      const [canonicalSnapshot, legacySnapshot] = await Promise.all([
        reports.orderBy('createdAt', 'desc').limit(limit).get(),
        legacyReports.orderBy('createdAt', 'desc').limit(limit).get(),
      ]);
      return mergeCompatibilityDocs(canonicalSnapshot, legacySnapshot, limit).slice().reverse();
    },

    async listByRoom(roomId, limit = 50) {
      const snapshot = await reports
        .where('roomId', '==', roomId)
        .orderBy('createdAt', 'desc')
        .limit(Math.min(limit, 50))
        .get();
      return snapshot.docs.map(readDoc);
    },

    async create(report) {
      await reports.doc(report.reportId).set(toFirestoreValue(report), { merge: true });
    },

    async updateStatus(reportId, status, updatedAt) {
      await reports.doc(reportId).set({ status, updatedAt }, { merge: true });
    },

    async clearAll(limit = 500) {
      const snapshot = await reports.orderBy('createdAt', 'desc').limit(limit).get();

      if (snapshot.empty) {
        return;
      }

      const batch = db.batch();
      snapshot.docs.forEach((document) => batch.delete(document.ref));
      await batch.commit();
    },
  };
}

function createModerationLogRepository(db) {
  const logs = db.collection(COLLECTIONS.moderationLogs);
  const legacyLogs = db.collection(LEGACY_COLLECTIONS.moderationLogs);

  return {
    async listRecent(limit = 500) {
      // TODO Phase 5 Firestore index: moderationLogs roomId + createdAt for room-scoped audit panels.
      const [canonicalSnapshot, legacySnapshot] = await Promise.all([
        logs.orderBy('createdAt', 'desc').limit(limit).get(),
        legacyLogs.orderBy('createdAt', 'desc').limit(limit).get(),
      ]);
      return mergeCompatibilityDocs(canonicalSnapshot, legacySnapshot, limit).slice().reverse();
    },

    async create(log) {
      await logs.doc(log.logId).set(toFirestoreValue(log), { merge: true });
    },
  };
}

function createUserRepository(db) {
  const users = db.collection(COLLECTIONS.users);
  const legacyUsers = db.collection(LEGACY_COLLECTIONS.users);
  const handles = db.collection(COLLECTIONS.handles);

  return {
    async upsert(user) {
      const id = user.userId || user.sessionId;

      if (!id) {
        return;
      }

      const now = new Date().toISOString();
      await users.doc(id).set(
        toFirestoreValue({
          userId: user.userId || null,
          sessionId: user.sessionId,
          displayName: user.displayName,
          avatar: user.avatar,
          photoMode: user.photoMode || undefined,
          photoURL: user.photoURL || undefined,
          authProvider: user.authProvider || null,
          linkedProvider: user.authProvider || null,
          authEmail: user.email || undefined,
          plan: 'free',
          role: 'user',
          joinedAt: user.joinedAt || now,
          createdAt: user.createdAt || now,
          lastSeenAt: now,
        }),
        { merge: true },
      );
    },

    async get(id) {
      const canonical = await users.doc(id).get();

      if (canonical.exists) {
        return readDoc(canonical);
      }

      const legacy = await legacyUsers.doc(id).get();
      return legacy.exists ? { ...readDoc(legacy), legacySource: true } : null;
    },

    async getPublic(id) {
      const byId = await this.get(id);

      if (byId) {
        return byId;
      }

      const bySession = await users.where('sessionId', '==', id).limit(1).get();
      return bySession.empty ? null : readDoc(bySession.docs[0]);
    },

    async updateProfile(userId, updates) {
      const userRef = users.doc(userId);
      const nextHandle = updates.handle || '';

      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(userRef);
        const current = snapshot.exists ? readDoc(snapshot) : {};
        const previousHandle = current.handle || '';

        if (nextHandle && nextHandle !== previousHandle) {
          const handleRef = handles.doc(nextHandle);
          const handleSnapshot = await transaction.get(handleRef);

          if (handleSnapshot.exists && handleSnapshot.data().userId !== userId) {
            throw new Error('Handle is already taken.');
          }

          transaction.set(handleRef, { userId, handle: nextHandle, updatedAt: new Date().toISOString() }, { merge: true });
        }

        if (previousHandle && previousHandle !== nextHandle) {
          transaction.delete(handles.doc(previousHandle));
        }

        transaction.set(userRef, toFirestoreValue(updates), { merge: true });
      });

      return this.get(userId);
    },

    async listStats(limit = CHAT_LIMITS.MAX_ADMIN_USERS_QUERY) {
      const snapshot = await users.orderBy('lastSeenAt', 'desc').limit(limit).get();
      const documents = snapshot.docs.map(readDoc);

      return {
        sampledUsers: documents.length,
        totalUsers: documents.length,
        loggedInUsers: documents.filter((user) => Boolean(user.userId)).length,
        guestUsers: documents.filter((user) => !user.userId).length,
      };
    },

    async incrementStat(userId, statName, amount = 1) {
      if (!userId) {
        return;
      }

      await users.doc(userId).set({ stats: { [statName]: FieldValue.increment(amount) } }, { merge: true });
    },

    async listJoinedRooms(userId, limit = CHAT_LIMITS.MAX_MY_ROOMS_QUERY) {
      // TODO Phase 7 Firestore index: users/{userId}/joinedRooms lastVisitedAt desc for room dashboards.
      const snapshot = await users
        .doc(userId)
        .collection('joinedRooms')
        .orderBy('lastVisitedAt', 'desc')
        .limit(limit)
        .get();
      return snapshot.docs.map(readDoc);
    },

    async saveJoinedRoom(userId, relationship) {
      if (!userId || !relationship.roomId) {
        return;
      }

      await users.doc(userId).collection('joinedRooms').doc(relationship.roomId).set(toFirestoreValue(relationship), {
        merge: true,
      });
    },

    async updateJoinedRoom(userId, roomId, updates) {
      await users.doc(userId).collection('joinedRooms').doc(roomId).set(toFirestoreValue(updates), { merge: true });
    },

    async markRoomRead(userId, roomId, updates = {}) {
      await users
        .doc(userId)
        .collection('joinedRooms')
        .doc(roomId)
        .set(
          toFirestoreValue({
            roomId,
            unreadCount: 0,
            lastReadAt: updates.lastReadAt || new Date().toISOString(),
            lastReadMessageId: updates.lastReadMessageId || '',
            lastVisitedAt: updates.lastVisitedAt || new Date().toISOString(),
          }),
          { merge: true },
        );
    },

    async incrementRoomUnread(userId, roomId, updates = {}) {
      await users
        .doc(userId)
        .collection('joinedRooms')
        .doc(roomId)
        .set(
          {
            roomId,
            unreadCount: FieldValue.increment(1),
            lastUnreadAt: updates.lastUnreadAt || new Date().toISOString(),
            latestMessagePreview: updates.latestMessagePreview || '',
            latestMessageAt: updates.latestMessageAt || '',
            latestMessageId: updates.latestMessageId || '',
            ...(updates.roomSnapshot ? { roomSnapshot: toFirestoreValue(updates.roomSnapshot) } : {}),
          },
          { merge: true },
        );
    },

    async updateNotificationSettings(userId, settings) {
      await users.doc(userId).set(toFirestoreValue({ settings, updatedAt: new Date().toISOString() }), { merge: true });
      return this.get(userId);
    },

    async setFavorite(userId, roomId, isFavorite, roomSnapshot = {}) {
      await users
        .doc(userId)
        .collection('joinedRooms')
        .doc(roomId)
        .set(toFirestoreValue({ roomId, isFavorite: Boolean(isFavorite), ...roomSnapshot }), { merge: true });
    },

    async listBlockedUsers(userId, limit = CHAT_LIMITS.MAX_BLOCKED_USERS_QUERY) {
      const snapshot = await users.doc(userId).collection('blockedUsers').orderBy('createdAt', 'desc').limit(limit).get();
      return snapshot.docs.map(readDoc);
    },

    async blockUser(userId, blockedUser) {
      await users
        .doc(userId)
        .collection('blockedUsers')
        .doc(blockedUser.blockedId)
        .set(toFirestoreValue(blockedUser), { merge: true });
    },

    async unblockUser(userId, blockedId) {
      await users.doc(userId).collection('blockedUsers').doc(blockedId).delete();
    },
  };
}

function createNotificationRepository(db) {
  const users = db.collection(COLLECTIONS.users);

  return {
    async listForUser(userId, limit = CHAT_LIMITS.MAX_NOTIFICATIONS_LOAD) {
      // TODO Phase 7 Firestore index: user notifications createdAt desc and readAt/createdAt for unread panels.
      const snapshot = await users
        .doc(userId)
        .collection('notifications')
        .orderBy('createdAt', 'desc')
        .limit(Math.min(limit, CHAT_LIMITS.MAX_NOTIFICATIONS_LOAD))
        .get();
      return snapshot.docs.map(readDoc);
    },

    async create(userId, notification) {
      await users
        .doc(userId)
        .collection('notifications')
        .doc(notification.notificationId)
        .set(toFirestoreValue(notification), { merge: true });
    },

    async markRead(userId, notificationId, readAt = new Date().toISOString()) {
      await users.doc(userId).collection('notifications').doc(notificationId).set({ readAt }, { merge: true });
    },

    async markAllRead(userId, readAt = new Date().toISOString(), limit = CHAT_LIMITS.MAX_NOTIFICATIONS_LOAD) {
      const snapshot = await users.doc(userId).collection('notifications').orderBy('createdAt', 'desc').limit(limit).get();

      if (snapshot.empty) {
        return 0;
      }

      const batch = db.batch();
      let count = 0;
      snapshot.docs.forEach((document) => {
        const data = readDoc(document);
        if (!data.readAt && !data.dismissedAt) {
          batch.set(document.ref, { readAt }, { merge: true });
          count += 1;
        }
      });

      if (count > 0) {
        await batch.commit();
      }

      return count;
    },

    async dismiss(userId, notificationId, dismissedAt = new Date().toISOString()) {
      await users.doc(userId).collection('notifications').doc(notificationId).set({ dismissedAt }, { merge: true });
    },

    async countUnread(userId, limit = CHAT_LIMITS.MAX_NOTIFICATIONS_LOAD) {
      const items = await this.listForUser(userId, limit);
      return items.filter((item) => !item.readAt && !item.dismissedAt).length;
    },

    async listRecent(limit = 100) {
      // TODO Phase 7 Firestore index: collectionGroup notifications createdAt desc for admin metrics.
      const snapshot = await db.collectionGroup('notifications').orderBy('createdAt', 'desc').limit(Math.min(limit, 100)).get();
      return snapshot.docs.map(readDoc);
    },
  };
}

function createPushTokenRepository(db) {
  const users = db.collection(COLLECTIONS.users);

  return {
    async upsert(userId, tokenId, tokenRecord) {
      await users
        .doc(userId)
        .collection('fcmTokens')
        .doc(tokenId)
        .set(toFirestoreValue({ ...tokenRecord, tokenId, userId }), { merge: true });
    },

    async disable(userId, tokenId, disabledAt = new Date().toISOString()) {
      await users.doc(userId).collection('fcmTokens').doc(tokenId).set({ disabledAt, updatedAt: disabledAt }, { merge: true });
    },

    async listEnabledForUser(userId, limit = 20) {
      // TODO Phase 11 Firestore index: users/{userId}/fcmTokens lastSeenAt desc for device management.
      const snapshot = await users
        .doc(userId)
        .collection('fcmTokens')
        .orderBy('lastSeenAt', 'desc')
        .limit(Math.min(Number(limit) || 20, 50))
        .get();
      return snapshot.docs.map(readDoc).filter((token) => !token.disabledAt && token.token);
    },

    async listRecent(limit = 200) {
      // TODO Phase 11 Firestore index: collectionGroup fcmTokens lastSeenAt desc for admin push status.
      const snapshot = await db.collectionGroup('fcmTokens').orderBy('lastSeenAt', 'desc').limit(Math.min(Number(limit) || 200, 500)).get();
      return snapshot.docs.map((document) => ({
        ...readDoc(document),
        userId: document.ref.parent.parent?.id || readDoc(document).userId || '',
      }));
    },
  };
}

function createAnnouncementRepository(db) {
  return {
    async listActive(roomId, limit = CHAT_LIMITS.MAX_ACTIVE_ANNOUNCEMENTS_PER_ROOM) {
      // TODO Phase 7 Firestore index: room announcements active + createdAt desc.
      const snapshot = await roomAnnouncements(db, roomId)
        .where('active', '==', true)
        .orderBy('createdAt', 'desc')
        .limit(Math.min(limit, CHAT_LIMITS.MAX_ACTIVE_ANNOUNCEMENTS_PER_ROOM))
        .get();
      return snapshot.docs.map(readDoc);
    },

    async listRecent(roomId, limit = CHAT_LIMITS.MAX_ANNOUNCEMENT_HISTORY_LOAD) {
      const snapshot = await roomAnnouncements(db, roomId)
        .orderBy('createdAt', 'desc')
        .limit(Math.min(limit, CHAT_LIMITS.MAX_ANNOUNCEMENT_HISTORY_LOAD))
        .get();
      return snapshot.docs.map(readDoc);
    },

    async create(roomId, announcement) {
      await roomAnnouncements(db, roomId).doc(announcement.announcementId).set(toFirestoreValue(announcement), {
        merge: true,
      });
    },

    async update(roomId, announcementId, updates) {
      await roomAnnouncements(db, roomId).doc(announcementId).set(toFirestoreValue(updates), { merge: true });
    },
  };
}

function createActivityRepository(db) {
  return {
    async listByRoom(roomId, limit = CHAT_LIMITS.MAX_ROOM_ACTIVITY_LOAD) {
      // TODO Phase 7 Firestore index: room activity createdAt desc.
      const snapshot = await roomActivity(db, roomId)
        .orderBy('createdAt', 'desc')
        .limit(Math.min(limit, CHAT_LIMITS.MAX_ROOM_ACTIVITY_LOAD))
        .get();
      return snapshot.docs.map(readDoc);
    },

    async listRecent(limit = CHAT_LIMITS.MAX_ROOM_ACTIVITY_LOAD) {
      const snapshot = await db.collectionGroup('activity').orderBy('createdAt', 'desc').limit(Math.min(limit, 100)).get();
      return snapshot.docs.map(readDoc);
    },

    async create(roomId, activity) {
      await roomActivity(db, roomId).doc(activity.activityId).set(toFirestoreValue(activity), { merge: true });
    },
  };
}

function createMemberRepository(db) {
  return {
    async get(roomId, memberId) {
      const snapshot = await roomMembers(db, roomId).doc(memberId).get();
      return snapshot.exists ? readDoc(snapshot) : null;
    },

    async upsert(roomId, member) {
      await roomMembers(db, roomId).doc(member.memberId).set(toFirestoreValue(member), { merge: true });
    },

    async updateRole(roomId, memberId, role, updatedAt = new Date().toISOString()) {
      await roomMembers(db, roomId).doc(memberId).set({ role, updatedAt }, { merge: true });
    },

    async updateModeration(roomId, memberId, moderation) {
      await roomMembers(db, roomId).doc(memberId).set(toFirestoreValue({ ...moderation, updatedAt: new Date().toISOString() }), {
        merge: true,
      });
    },

    async listByRoom(roomId, limit = CHAT_LIMITS.MAX_ROOM_MEMBERS_QUERY) {
      const snapshot = await roomMembers(db, roomId).orderBy('lastVisitedAt', 'desc').limit(limit).get();
      return snapshot.docs.map(readDoc);
    },
  };
}

function createCommunityRepository(db) {
  const communities = db.collection(COLLECTIONS.communities);

  return {
    async listActive(limit = CHAT_LIMITS.MAX_COMMUNITIES_LOAD) {
      // TODO Phase 8 Firestore index: communities visibility/category/deletedAt/lastActiveAt for discovery.
      const snapshot = await communities.orderBy('lastActiveAt', 'desc').limit(Math.min(limit, CHAT_LIMITS.MAX_COMMUNITIES_LOAD)).get();
      return snapshot.docs.map(readDoc).filter((community) => !community.deletedAt);
    },

    async listByOwner(ownerUserId, limit = CHAT_LIMITS.MAX_COMMUNITIES_LOAD) {
      const snapshot = await communities
        .where('ownerUserId', '==', ownerUserId)
        .limit(Math.min(limit, CHAT_LIMITS.MAX_COMMUNITIES_LOAD))
        .get();
      return snapshot.docs
        .map(readDoc)
        .filter((community) => !community.deletedAt)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    },

    async get(communityId) {
      const document = await communities.doc(communityId).get();
      return document.exists ? readDoc(document) : null;
    },

    async findBySlug(slug) {
      const snapshot = await communities.where('slug', '==', slug).limit(1).get();
      return snapshot.empty ? null : readDoc(snapshot.docs[0]);
    },

    async save(community) {
      await communities.doc(community.communityId).set(toFirestoreValue(community), { merge: true });
    },

    async update(communityId, community) {
      await communities.doc(communityId).set(toFirestoreValue(community), { merge: true });
    },

    async softDelete(communityId, deletedAt) {
      await communities.doc(communityId).set({ deletedAt, updatedAt: deletedAt }, { merge: true });
    },
  };
}

function createCommunityMemberRepository(db) {
  return {
    async get(communityId, memberId) {
      const document = await communityMembers(db, communityId).doc(memberId).get();
      return document.exists ? readDoc(document) : null;
    },

    async upsert(communityId, member) {
      await communityMembers(db, communityId).doc(member.memberId).set(toFirestoreValue(member), { merge: true });
    },

    async updateRole(communityId, memberId, role) {
      await communityMembers(db, communityId).doc(memberId).set({ role, updatedAt: new Date().toISOString() }, { merge: true });
    },

    async updateModeration(communityId, memberId, updates) {
      await communityMembers(db, communityId).doc(memberId).set(toFirestoreValue(updates), { merge: true });
    },

    async remove(communityId, memberId) {
      await communityMembers(db, communityId).doc(memberId).delete();
    },

    async listByCommunity(communityId, limit = CHAT_LIMITS.MAX_COMMUNITY_MEMBERS_LOAD) {
      // TODO Phase 8 Firestore index: community members role + joinedAt for staff/member pages.
      const snapshot = await communityMembers(db, communityId)
        .orderBy('lastVisitedAt', 'desc')
        .limit(Math.min(limit, CHAT_LIMITS.MAX_COMMUNITY_MEMBERS_LOAD))
        .get();
      return snapshot.docs.map(readDoc);
    },
  };
}

function createCommunityRoomRepository(db) {
  return {
    async upsert(communityId, room) {
      await communityRooms(db, communityId).doc(room.roomId).set(toFirestoreValue(room), { merge: true });
    },

    async listByCommunity(communityId, limit = CHAT_LIMITS.MAX_COMMUNITY_ROOMS_LOAD) {
      const snapshot = await communityRooms(db, communityId)
        .orderBy('lastActiveAt', 'desc')
        .limit(Math.min(limit, CHAT_LIMITS.MAX_COMMUNITY_ROOMS_LOAD))
        .get();
      return snapshot.docs.map(readDoc);
    },
  };
}

function createCommunityAnnouncementRepository(db) {
  return {
    async listRecent(communityId, limit = CHAT_LIMITS.MAX_COMMUNITY_ANNOUNCEMENTS_LOAD) {
      // TODO Phase 8 Firestore index: community announcements active + createdAt.
      const snapshot = await communityAnnouncements(db, communityId)
        .orderBy('createdAt', 'desc')
        .limit(Math.min(limit, CHAT_LIMITS.MAX_COMMUNITY_ANNOUNCEMENTS_LOAD))
        .get();
      return snapshot.docs.map(readDoc);
    },

    async create(communityId, announcement) {
      await communityAnnouncements(db, communityId).doc(announcement.announcementId).set(toFirestoreValue(announcement), { merge: true });
    },

    async update(communityId, announcementId, updates) {
      await communityAnnouncements(db, communityId).doc(announcementId).set(toFirestoreValue(updates), { merge: true });
    },
  };
}

function createCommunityActivityRepository(db) {
  return {
    async listByCommunity(communityId, limit = CHAT_LIMITS.MAX_COMMUNITY_ACTIVITY_LOAD) {
      // TODO Phase 8 Firestore index: community activity createdAt desc.
      const snapshot = await communityActivity(db, communityId)
        .orderBy('createdAt', 'desc')
        .limit(Math.min(limit, CHAT_LIMITS.MAX_COMMUNITY_ACTIVITY_LOAD))
        .get();
      return snapshot.docs.map(readDoc);
    },

    async listRecent(limit = CHAT_LIMITS.MAX_COMMUNITY_ACTIVITY_LOAD) {
      const snapshot = await db.collectionGroup('activity').orderBy('createdAt', 'desc').limit(Math.min(limit, 100)).get();
      return snapshot.docs.map(readDoc);
    },

    async create(communityId, activity) {
      await communityActivity(db, communityId).doc(activity.activityId).set(toFirestoreValue(activity), { merge: true });
    },
  };
}

function createEventRepository(db) {
  const events = db.collection(COLLECTIONS.eventRooms);

  return {
    async listRecent(limit = CHAT_LIMITS.MAX_EVENTS_LOAD) {
      // TODO Phase 8 Firestore index: eventRooms status + startsAt + communityId.
      const snapshot = await events.orderBy('startsAt', 'desc').limit(Math.min(limit, CHAT_LIMITS.MAX_EVENTS_LOAD)).get();
      return snapshot.docs.map(readDoc);
    },

    async listByCommunity(communityId, limit = CHAT_LIMITS.MAX_EVENTS_LOAD) {
      const snapshot = await events
        .where('communityId', '==', communityId)
        .orderBy('startsAt', 'desc')
        .limit(Math.min(limit, CHAT_LIMITS.MAX_EVENTS_LOAD))
        .get();
      return snapshot.docs.map(readDoc);
    },

    async listByHost(hostUserId, limit = CHAT_LIMITS.MAX_EVENTS_LOAD) {
      const snapshot = await events
        .where('hostUserId', '==', hostUserId)
        .orderBy('startsAt', 'desc')
        .limit(Math.min(limit, CHAT_LIMITS.MAX_EVENTS_LOAD))
        .get();
      return snapshot.docs.map(readDoc);
    },

    async get(eventId) {
      const document = await events.doc(eventId).get();
      return document.exists ? readDoc(document) : null;
    },

    async save(event) {
      await events.doc(event.eventId).set(toFirestoreValue(event), { merge: true });
    },

    async update(eventId, event) {
      await events.doc(eventId).set(toFirestoreValue(event), { merge: true });
    },
  };
}

function createRsvpRepository(db) {
  return {
    async upsert(eventId, rsvp) {
      await eventRsvps(db, eventId).doc(rsvp.userId).set(toFirestoreValue(rsvp), { merge: true });
    },

    async listByEvent(eventId, limit = CHAT_LIMITS.MAX_RSVP_LOAD) {
      const snapshot = await eventRsvps(db, eventId).orderBy('updatedAt', 'desc').limit(Math.min(limit, CHAT_LIMITS.MAX_RSVP_LOAD)).get();
      return snapshot.docs.map(readDoc);
    },

    async countByEvent(eventId) {
      const snapshot = await eventRsvps(db, eventId).limit(CHAT_LIMITS.MAX_RSVP_LOAD).get();
      return snapshot.docs.filter((document) => readDoc(document).status !== 'cancelled').length;
    },
  };
}

function createScheduledAnnouncementRepository(db) {
  const scheduled = db.collection(COLLECTIONS.scheduledAnnouncements);

  return {
    async listRecent(limit = CHAT_LIMITS.MAX_SCHEDULED_ANNOUNCEMENTS_LOAD) {
      const snapshot = await scheduled
        .orderBy('createdAt', 'desc')
        .limit(Math.min(limit, CHAT_LIMITS.MAX_SCHEDULED_ANNOUNCEMENTS_LOAD))
        .get();
      return snapshot.docs.map(readDoc);
    },

    async listByCreator(userId, limit = CHAT_LIMITS.MAX_SCHEDULED_ANNOUNCEMENTS_LOAD) {
      const snapshot = await scheduled
        .where('createdByUserId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(Math.min(limit, CHAT_LIMITS.MAX_SCHEDULED_ANNOUNCEMENTS_LOAD))
        .get();
      return snapshot.docs.map(readDoc);
    },

    async listDue(nowIso, limit = CHAT_LIMITS.MAX_DUE_SCHEDULED_ANNOUNCEMENTS_PER_TICK) {
      // TODO Phase 8 Firestore index: scheduledAnnouncements publishStatus + scheduledFor.
      const snapshot = await scheduled
        .where('publishStatus', '==', 'scheduled')
        .where('scheduledFor', '<=', nowIso)
        .orderBy('scheduledFor', 'asc')
        .limit(Math.min(limit, CHAT_LIMITS.MAX_DUE_SCHEDULED_ANNOUNCEMENTS_PER_TICK))
        .get();
      return snapshot.docs.map(readDoc);
    },

    async get(announcementId) {
      const document = await scheduled.doc(announcementId).get();
      return document.exists ? readDoc(document) : null;
    },

    async save(announcement) {
      await scheduled.doc(announcement.announcementId).set(toFirestoreValue(announcement), { merge: true });
    },

    async update(announcementId, announcement) {
      await scheduled.doc(announcementId).set(toFirestoreValue(announcement), { merge: true });
    },
  };
}

function createBillingRepository(db) {
  const users = db.collection(COLLECTIONS.users);
  const billingEvents = db.collection(COLLECTIONS.billingEvents);

  return {
    async listEntitlements(userId, limit = 100) {
      const snapshot = await users
        .doc(userId)
        .collection('entitlements')
        .orderBy('updatedAt', 'desc')
        .limit(limit)
        .get();
      return snapshot.docs.map(readDoc);
    },

    async saveEntitlement(entitlement) {
      await users
        .doc(entitlement.userId)
        .collection('entitlements')
        .doc(entitlement.entitlementId)
        .set(toFirestoreValue(entitlement), { merge: true });
    },

    async revokeEntitlement(userId, entitlementId, updates = {}) {
      await users
        .doc(userId)
        .collection('entitlements')
        .doc(entitlementId)
        .set(toFirestoreValue({ status: 'cancelled', ...updates, updatedAt: new Date().toISOString() }), {
          merge: true,
        });
    },

    async listPayments(userId, limit = 100) {
      const snapshot = await users.doc(userId).collection('payments').orderBy('createdAt', 'desc').limit(limit).get();
      return snapshot.docs.map(readDoc);
    },

    async savePayment(payment) {
      await users
        .doc(payment.userId)
        .collection('payments')
        .doc(payment.paymentId)
        .set(toFirestoreValue(payment), { merge: true });
    },

    async updatePayment(userId, paymentId, updates) {
      await users.doc(userId).collection('payments').doc(paymentId).set(toFirestoreValue(updates), { merge: true });
    },

    async findPaymentByOrderId(orderId) {
      if (!orderId) {
        return null;
      }

      const snapshot = await db.collectionGroup('payments').where('razorpayOrderId', '==', orderId).limit(1).get();
      return snapshot.empty ? null : readDoc(snapshot.docs[0]);
    },

    async listBillingEvents(limit = 100) {
      const snapshot = await billingEvents.orderBy('createdAt', 'desc').limit(limit).get();
      return snapshot.docs.map(readDoc);
    },

    async getBillingEvent(eventId) {
      const snapshot = await billingEvents.doc(eventId).get();
      return snapshot.exists ? readDoc(snapshot) : null;
    },

    async saveBillingEvent(event) {
      await billingEvents.doc(event.eventId).set(toFirestoreValue(event), { merge: true });
    },

    async listRecentEntitlements(limit = 100) {
      const snapshot = await db.collectionGroup('entitlements').orderBy('updatedAt', 'desc').limit(limit).get();
      return snapshot.docs.map(readDoc);
    },

    async listRecentPayments(limit = 100) {
      const snapshot = await db.collectionGroup('payments').orderBy('updatedAt', 'desc').limit(limit).get();
      return snapshot.docs.map(readDoc);
    },
  };
}

function createFeedbackRepository(db) {
  const feedback = db.collection(COLLECTIONS.feedback);

  return {
    async create(entry) {
      await feedback.doc(entry.feedbackId).set(toFirestoreValue(entry), { merge: true });
    },

    async listRecent({ type = '', status = '', limit = CHAT_LIMITS.MAX_FEEDBACK_LOAD } = {}) {
      // TODO Phase 10 Firestore index: feedback type/status/createdAt for filtered admin launch queues.
      let query = feedback;

      if (type) {
        query = query.where('type', '==', type);
      }

      if (status) {
        query = query.where('status', '==', status);
      }

      const snapshot = await query.orderBy('createdAt', 'desc').limit(Math.min(Number(limit) || 50, CHAT_LIMITS.MAX_FEEDBACK_LOAD)).get();
      return snapshot.docs.map(readDoc);
    },

    async updateStatus(feedbackId, status, updatedAt = new Date().toISOString()) {
      await feedback.doc(feedbackId).set({ status, updatedAt }, { merge: true });
    },
  };
}

function createAnalyticsRepository(db) {
  const analyticsDaily = db.collection(COLLECTIONS.analyticsDaily);

  return {
    isEnabled: true,
    async incrementDaily(date = new Date(), eventType, metadata = {}) {
      const dayId = toDayId(date);
      const updates = {
        date: dayId,
        updatedAt: new Date().toISOString(),
        [`counters.${eventType}`]: FieldValue.increment(1),
      };

      if (metadata.category) {
        updates[`topCategories.${safeAnalyticsKey(metadata.category)}`] = FieldValue.increment(1);
      }

      if (metadata.roomId) {
        updates[`roomTouches.${safeAnalyticsKey(metadata.roomId)}`] = FieldValue.increment(1);
      }

      if (metadata.communityId) {
        updates[`communityTouches.${safeAnalyticsKey(metadata.communityId)}`] = FieldValue.increment(1);
      }

      await analyticsDaily.doc(dayId).set(updates, { merge: true });
    },

    async listDaily(limit = 14) {
      const snapshot = await analyticsDaily.orderBy('date', 'desc').limit(Math.min(Number(limit) || 14, 60)).get();
      return snapshot.docs.map(readDoc);
    },
  };
}

function createCategoryToolRepository(db) {
  return {
    async listByRoom(roomId, limit = CHAT_LIMITS.MAX_CATEGORY_TOOLS_LOAD) {
      // TODO Phase category tools index: rooms/{roomId}/tools updatedAt desc plus status/toolType/categorySlug for admin filters.
      const snapshot = await roomTools(db, roomId)
        .orderBy('updatedAt', 'desc')
        .limit(Math.min(Number(limit) || CHAT_LIMITS.MAX_CATEGORY_TOOLS_LOAD, CHAT_LIMITS.MAX_CATEGORY_TOOLS_LOAD))
        .get();
      return snapshot.docs.map(readDoc);
    },

    async save(roomId, tool) {
      await roomTools(db, roomId).doc(tool.toolId).set(toFirestoreValue(tool), { merge: true });
    },

    async update(roomId, toolId, updates) {
      await roomTools(db, roomId).doc(toolId).set(toFirestoreValue(updates), { merge: true });
    },

    async delete(roomId, toolId, updates = {}) {
      await roomTools(db, roomId)
        .doc(toolId)
        .set(
          toFirestoreValue({
            status: 'closed',
            closedAt: updates.closedAt || new Date().toISOString(),
            updatedAt: updates.updatedAt || new Date().toISOString(),
          }),
          { merge: true },
        );
    },

    async listAdmin({ limit = 100 } = {}) {
      // TODO Phase category tools index: collectionGroup tools updatedAt desc, categorySlug/status/toolType filters.
      const snapshot = await db.collectionGroup('tools').orderBy('updatedAt', 'desc').limit(Math.min(Number(limit) || 100, 200)).get();
      return snapshot.docs.map(readDoc);
    },
  };
}

function roomMessages(db, roomId) {
  return db.collection(COLLECTIONS.rooms).doc(roomId).collection('messages');
}

function roomMembers(db, roomId) {
  return db.collection(COLLECTIONS.rooms).doc(roomId).collection('members');
}

function communityMembers(db, communityId) {
  return db.collection(COLLECTIONS.communities).doc(communityId).collection('members');
}

function communityRooms(db, communityId) {
  return db.collection(COLLECTIONS.communities).doc(communityId).collection('rooms');
}

function communityAnnouncements(db, communityId) {
  return db.collection(COLLECTIONS.communities).doc(communityId).collection('announcements');
}

function communityActivity(db, communityId) {
  return db.collection(COLLECTIONS.communities).doc(communityId).collection('activity');
}

function eventRsvps(db, eventId) {
  return db.collection(COLLECTIONS.eventRooms).doc(eventId).collection('rsvps');
}

function roomAnnouncements(db, roomId) {
  return db.collection(COLLECTIONS.rooms).doc(roomId).collection('announcements');
}

function roomActivity(db, roomId) {
  return db.collection(COLLECTIONS.rooms).doc(roomId).collection('activity');
}

function roomTools(db, roomId) {
  return db.collection(COLLECTIONS.rooms).doc(roomId).collection('tools');
}

function mergeCompatibilityDocs(canonicalSnapshot, legacySnapshot, limit) {
  const canonicalIds = new Set(canonicalSnapshot.docs.map((document) => document.id));
  const canonical = canonicalSnapshot.docs.map(readDoc);
  const legacy = legacySnapshot.docs
    .filter((document) => !canonicalIds.has(document.id))
    .map((document) => ({ ...readDoc(document), legacySource: true }));
  return [...canonical, ...legacy]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, limit);
}

function readDoc(document) {
  return { ...document.data(), documentId: document.id };
}

function toFirestoreValue(value) {
  if (value instanceof Map) {
    return Object.fromEntries([...value.entries()].map(([key, entry]) => [key, toFirestoreValue(entry)]));
  }

  if (value instanceof Set) {
    return [...value].map(toFirestoreValue);
  }

  if (Array.isArray(value)) {
    return value.map(toFirestoreValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, toFirestoreValue(entry)]),
    );
  }

  return value;
}

function toDayId(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function safeAnalyticsKey(value) {
  return String(value || 'unknown')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 80) || 'unknown';
}
