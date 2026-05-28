import { CHAT_LIMITS, NOTIFICATION_PREFERENCES } from '../../shared/chatConfig.js';
import { PROFILE_COSMETICS } from '../../shared/billingCatalog.js';
import { getCategoryConfig, getCategoryFeatureHooks, getCategoryForAnalytics, getCategorySlug } from '../../shared/categoryConfig.js';
import {
  sanitizeDisplayName,
  sanitizeHandle,
  sanitizeIdentifier,
  sanitizeProfileStatus,
} from './safetyService.js';

const AVATAR_IDS = new Set(['nexus', 'ivory', 'gold', 'sage', 'onyx', 'rose']);

export function createAccountService({ repositories = {}, entitlementService } = {}) {
  const userRepository = repositories.userRepository || {};
  const roomRepository = repositories.roomRepository || {};

  async function ensureAuthenticatedProfile(identity) {
    const fallbackProfile = {
      userId: identity.userId,
      sessionId: identity.sessionId || `user_${identity.userId}`,
      displayName: identity.displayName || 'NexusUser',
      avatar: identity.avatar || 'nexus',
      authProvider: identity.authProvider || 'google',
      email: identity.email || undefined,
      photoMode: sanitizePhotoMode(identity.photoMode),
      photoURL: sanitizeProfilePhotoUrl(identity.photoURL),
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      plan: 'free',
    };

    await userRepository.upsert?.(fallbackProfile);
    return (await getProfile(identity.userId)) || serializePrivateProfile(fallbackProfile);
  }

  async function getProfile(userId) {
    const profile = await userRepository.get?.(sanitizeIdentifier(userId, 'User'));
    return profile ? serializePrivateProfile(profile) : null;
  }

  async function updateProfile(userId, payload) {
    const cleanUserId = sanitizeIdentifier(userId, 'User');
    const handle = sanitizeHandle(payload?.handle);
    const updates = {
      userId: cleanUserId,
      displayName: sanitizeDisplayName(payload?.displayName),
      avatar: sanitizeAvatar(payload?.avatar),
      photoMode: sanitizePhotoMode(payload?.photoMode),
      photoURL: sanitizePhotoMode(payload?.photoMode) === 'google' ? sanitizeProfilePhotoUrl(payload?.photoURL) : '',
      handle,
      status: sanitizeProfileStatus(payload?.status ?? payload?.bio),
      bio: sanitizeProfileStatus(payload?.status ?? payload?.bio),
      settings: sanitizeSettings(payload?.settings),
      updatedAt: new Date().toISOString(),
    };

    const profileRingId = sanitizeCosmeticId(payload?.profileRingId, 'profileRing');
    const badgeIds = sanitizeBadgeIds(payload?.badgeIds);

    if (profileRingId) {
      const productId = productForCosmetic(profileRingId);

      if (!(await entitlementService?.canUseProfileCosmetic?.(cleanUserId, productId))) {
        throw new Error('That premium profile ring is not owned yet.');
      }

      updates.profileRingId = profileRingId;
    }

    if (badgeIds.length > 0) {
      for (const badgeId of badgeIds) {
        const productId = productForCosmetic(badgeId);

        if (!(await entitlementService?.canUseProfileCosmetic?.(cleanUserId, productId))) {
          throw new Error('That premium badge is not owned yet.');
        }
      }

      updates.badgeIds = badgeIds;
    }

    const profile = await userRepository.updateProfile?.(cleanUserId, updates);
    return profile ? serializePrivateProfile(profile) : serializePrivateProfile(updates);
  }

  async function getPublicProfile(identifier) {
    const profile = await userRepository.getPublic?.(sanitizeIdentifier(identifier, 'Profile'));
    return profile ? serializePublicProfile(profile) : null;
  }

  async function getMyRooms(userId) {
    const cleanUserId = sanitizeIdentifier(userId, 'User');
    const relationships = await userRepository.listJoinedRooms?.(cleanUserId, CHAT_LIMITS.MAX_MY_ROOMS_QUERY);
    const roomIds = (relationships || []).map((relationship) => relationship.roomId);
    const rooms = await roomRepository.getMany?.(roomIds, CHAT_LIMITS.MAX_MY_ROOMS_QUERY);
    const roomMap = new Map((rooms || []).map((room) => [room.roomId, serializeRoomSummary(room)]));

    return (relationships || [])
      .map((relationship) => ({
        ...serializeRelationship(relationship),
        room: roomMap.get(relationship.roomId) || relationship.roomSnapshot || null,
      }))
      .filter((relationship) => relationship.room && !relationship.room.deletedAt);
  }

  async function saveJoinedRoom(user, room, role = 'member') {
    if (!user?.userId || !room?.roomId) {
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
      isFavorite: false,
      notificationsEnabled: true,
      notificationsMuted: false,
      mutedUntil: null,
      notificationSettingsVersion: 7,
      unreadCount: 0,
      roomSnapshot: serializeRoomSummary(room),
    });
  }

  async function setFavorite(userId, roomId, isFavorite) {
    const cleanUserId = sanitizeIdentifier(userId, 'User');
    const cleanRoomId = sanitizeIdentifier(roomId, 'Room');
    const room = await roomRepository.get?.(cleanRoomId);

    if (!room || room.deletedAt) {
      throw new Error('Room not found.');
    }

    if (isFavorite) {
      const relationships = await userRepository.listJoinedRooms?.(cleanUserId, CHAT_LIMITS.MAX_MY_ROOMS_QUERY);
      const currentFavorites = (relationships || []).filter((relationship) => relationship.isFavorite);
      const limits = await entitlementService?.getFeatureLimits?.(cleanUserId);

      if (!currentFavorites.some((relationship) => relationship.roomId === cleanRoomId) && currentFavorites.length >= (limits?.favorites || 10)) {
        throw new Error('Favorite room limit reached for your current plan.');
      }
    }

    await userRepository.setFavorite?.(cleanUserId, cleanRoomId, Boolean(isFavorite), {
      lastVisitedAt: new Date().toISOString(),
      roomSnapshot: serializeRoomSummary(room),
    });
    return { roomId: cleanRoomId, isFavorite: Boolean(isFavorite) };
  }

  async function listBlocks(userId) {
    const blocks = await userRepository.listBlockedUsers?.(
      sanitizeIdentifier(userId, 'User'),
      CHAT_LIMITS.MAX_BLOCKED_USERS_QUERY,
    );
    return (blocks || []).map(serializeBlock);
  }

  async function blockUser(userId, payload) {
    const blockedId = sanitizeIdentifier(payload?.blockedId, 'Blocked user');
    const block = {
      blockedId,
      targetUserId: sanitizeOptionalIdentifier(payload?.targetUserId),
      targetSessionId: sanitizeOptionalIdentifier(payload?.targetSessionId),
      displayName: sanitizeDisplayName(payload?.displayName),
      createdAt: new Date().toISOString(),
    };

    await userRepository.blockUser?.(sanitizeIdentifier(userId, 'User'), block);
    return serializeBlock(block);
  }

  async function unblockUser(userId, blockedId) {
    const cleanBlockedId = sanitizeIdentifier(blockedId, 'Blocked user');
    await userRepository.unblockUser?.(sanitizeIdentifier(userId, 'User'), cleanBlockedId);
    return cleanBlockedId;
  }

  function serializePublicProfile(profile) {
    return {
      userId: profile.userId || null,
      sessionId: profile.sessionId || null,
      displayName: sanitizeDisplayName(profile.displayName),
      avatar: sanitizeAvatar(profile.avatar),
      photoMode: sanitizePhotoMode(profile.photoMode),
      photoURL: sanitizeProfilePhotoUrl(profile.photoURL),
      handle: profile.handle || '',
      status: sanitizeProfileStatus(profile.status || profile.bio),
      badges: Array.isArray(profile.badges) ? profile.badges.slice(0, 6).map(String) : [],
      badgeIds: Array.isArray(profile.badgeIds) ? profile.badgeIds.slice(0, 6).map(String) : [],
      profileRingId: profile.profileRingId || '',
      joinedAt: profile.joinedAt || profile.createdAt || null,
      plan: profile.plan || 'free',
    };
  }

  return {
    blockUser,
    ensureAuthenticatedProfile,
    getMyRooms,
    getProfile,
    getPublicProfile,
    listBlocks,
    saveJoinedRoom,
    serializePublicProfile,
    setFavorite,
    unblockUser,
    updateProfile,
  };
}

function serializePrivateProfile(profile) {
  return {
    ...serializeBaseProfile(profile),
    stats: {
      roomsCreated: Number(profile.stats?.roomsCreated || 0),
      messagesSent: Number(profile.stats?.messagesSent || 0),
      helpfulReports: Number(profile.stats?.helpfulReports || 0),
      moderationActions: Number(profile.stats?.moderationActions || 0),
    },
    settings: {
      theme: profile.settings?.theme === 'dark' ? 'dark' : 'light',
      safetyBannerDismissed: Boolean(profile.settings?.safetyBannerDismissed),
      notificationsEnabled: profile.settings?.notificationsEnabled !== false,
      notificationPreferences: sanitizeNotificationPreferences(profile.settings?.notificationPreferences),
      onboardingVersion: Number(profile.settings?.onboardingVersion || 0),
      onboardingCompletedAt: profile.settings?.onboardingCompletedAt || null,
    },
  };
}

function serializeBaseProfile(profile) {
  return {
    userId: profile.userId || null,
    sessionId: profile.sessionId || null,
    displayName: sanitizeDisplayName(profile.displayName),
    avatar: sanitizeAvatar(profile.avatar),
    photoMode: sanitizePhotoMode(profile.photoMode),
    photoURL: sanitizeProfilePhotoUrl(profile.photoURL),
    handle: profile.handle || '',
    status: sanitizeProfileStatus(profile.status || profile.bio),
    bio: sanitizeProfileStatus(profile.status || profile.bio),
    badges: Array.isArray(profile.badges) ? profile.badges.slice(0, 6).map(String) : [],
    role: profile.role === 'admin' || profile.role === 'moderator' ? profile.role : 'user',
    plan: 'free',
    profileRingId: profile.profileRingId || '',
    badgeIds: Array.isArray(profile.badgeIds) ? profile.badgeIds.slice(0, 6).map(String) : [],
    joinedAt: profile.joinedAt || profile.createdAt || null,
    lastSeenAt: profile.lastSeenAt || null,
  };
}

function sanitizeCosmeticId(value, type) {
  const text = String(value || '').trim();
  return PROFILE_COSMETICS.some((cosmetic) => cosmetic.cosmeticId === text && cosmetic.type === type) ? text : '';
}

function sanitizeBadgeIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || '').trim())
    .filter((item) => PROFILE_COSMETICS.some((cosmetic) => cosmetic.cosmeticId === item && cosmetic.type === 'badge'))
    .slice(0, 4);
}

function productForCosmetic(cosmeticId) {
  return PROFILE_COSMETICS.find((cosmetic) => cosmetic.cosmeticId === cosmeticId)?.productId || '';
}

function serializeRelationship(relationship) {
  return {
    roomId: relationship.roomId,
    role: relationship.role || 'member',
    joinedAt: relationship.joinedAt || null,
    lastVisitedAt: relationship.lastVisitedAt || relationship.joinedAt || null,
    isFavorite: Boolean(relationship.isFavorite),
    notificationsEnabled: relationship.notificationsEnabled !== false,
    notificationsMuted: Boolean(relationship.notificationsMuted),
    mutedUntil: relationship.mutedUntil || null,
    notificationSettingsVersion: Number(relationship.notificationSettingsVersion || 0),
    unreadCount: Number(relationship.unreadCount || 0),
    lastReadAt: relationship.lastReadAt || null,
    latestMessagePreview: relationship.latestMessagePreview || relationship.roomSnapshot?.latestMessagePreview || '',
    latestMessageAt: relationship.latestMessageAt || relationship.roomSnapshot?.latestMessageAt || null,
    latestAnnouncement: relationship.latestAnnouncement || relationship.roomSnapshot?.latestAnnouncement || null,
  };
}

function serializeRoomSummary(room) {
  const category = getCategoryConfig(room.categorySlug || room.category);
  return {
    roomId: room.roomId,
    inviteCode: room.inviteCode,
    title: room.title,
    type: room.type,
    category: category.label,
    categorySlug: getCategorySlug(category.slug),
    categoryLabel: category.label,
    categoryThemeClass: category.themeClass,
    categoryAccentClass: category.accentClass,
    categoryAnalyticsKey: getCategoryForAnalytics(category.slug),
    categoryFeatureHooks: getCategoryFeatureHooks(category.slug),
    createdAt: room.createdAt,
    lastActiveAt: room.lastActiveAt || room.createdAt,
    memberCount: Number(room.memberCount || room.memberCountSnapshot || 0),
    isLocked: Boolean(room.isLocked),
    expiresAt: room.expiresAt || null,
    deletedAt: room.deletedAt || null,
    themeId: room.themeId || 'classic',
    communityId: room.communityId || '',
    communityName: room.communityName || '',
    roomPurpose: room.roomPurpose || '',
    eventRoomId: room.eventRoomId || '',
    latestMessagePreview: room.lastMessagePreview || room.latestMessagePreview || '',
    latestMessageAt: room.lastMessageAt || room.latestMessageAt || null,
    latestAnnouncement: room.latestAnnouncement || null,
  };
}

function serializeBlock(block) {
  return {
    blockedId: block.blockedId,
    targetUserId: block.targetUserId || null,
    targetSessionId: block.targetSessionId || null,
    displayName: block.displayName || 'User',
    createdAt: block.createdAt || null,
  };
}

function sanitizeSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return undefined;
  }

  return {
    theme: settings.theme === 'dark' ? 'dark' : 'light',
    safetyBannerDismissed: Boolean(settings.safetyBannerDismissed),
    notificationsEnabled: Boolean(settings.notificationsEnabled),
    notificationPreferences: sanitizeNotificationPreferences(settings.notificationPreferences),
    onboardingVersion: Math.max(0, Math.min(Number(settings.onboardingVersion) || 0, 10)),
    onboardingCompletedAt: sanitizeSettingsDate(settings.onboardingCompletedAt),
  };
}

function sanitizeNotificationPreferences(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(
    Object.entries(NOTIFICATION_PREFERENCES).map(([key, fallback]) => [
      key,
      source[key] === undefined ? fallback : Boolean(source[key]),
    ]),
  );
}

function sanitizeAvatar(value) {
  return AVATAR_IDS.has(value) ? value : 'nexus';
}

function sanitizePhotoMode(value) {
  return value === 'google' ? 'google' : 'avatar';
}

function sanitizeProfilePhotoUrl(value) {
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

function sanitizeOptionalIdentifier(value) {
  try {
    return value ? sanitizeIdentifier(value, 'Identifier') : null;
  } catch {
    return null;
  }
}

function sanitizeSettingsDate(value) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}
