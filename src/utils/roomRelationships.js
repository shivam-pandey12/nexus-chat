const GUEST_ROOMS_KEY = 'nexusChat.guestRoomRelationships.v1';

export function loadGuestRooms() {
  try {
    const stored = JSON.parse(localStorage.getItem(GUEST_ROOMS_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter((item) => item?.roomId).slice(0, 80) : [];
  } catch {
    return [];
  }
}

export function rememberGuestRoom(room, role = 'member') {
  if (!room?.roomId) {
    return loadGuestRooms();
  }

  const current = loadGuestRooms();
  const previous = current.find((item) => item.roomId === room.roomId);
  const relationship = {
    roomId: room.roomId,
    role,
    joinedAt: previous?.joinedAt || new Date().toISOString(),
    lastVisitedAt: new Date().toISOString(),
    isFavorite: Boolean(previous?.isFavorite),
    unreadCount: 0,
    notificationsMuted: Boolean(previous?.notificationsMuted),
    mutedUntil: previous?.mutedUntil || null,
    latestMessagePreview: previous?.latestMessagePreview || room.latestMessagePreview || '',
    latestMessageAt: previous?.latestMessageAt || room.latestMessageAt || null,
    latestAnnouncement: room.latestAnnouncement || previous?.latestAnnouncement || null,
    room: summarizeRoom(room),
  };
  return saveGuestRooms([relationship, ...current.filter((item) => item.roomId !== room.roomId)]);
}

export function setGuestFavorite(room, isFavorite) {
  const current = loadGuestRooms();
  const previous = current.find((item) => item.roomId === room.roomId);
  const relationship = {
    roomId: room.roomId,
    role: previous?.role || 'member',
    joinedAt: previous?.joinedAt || new Date().toISOString(),
    lastVisitedAt: previous?.lastVisitedAt || new Date().toISOString(),
    isFavorite: Boolean(isFavorite),
    unreadCount: Number(previous?.unreadCount || 0),
    notificationsMuted: Boolean(previous?.notificationsMuted),
    mutedUntil: previous?.mutedUntil || null,
    latestMessagePreview: previous?.latestMessagePreview || room.latestMessagePreview || '',
    latestMessageAt: previous?.latestMessageAt || room.latestMessageAt || null,
    latestAnnouncement: room.latestAnnouncement || previous?.latestAnnouncement || null,
    room: summarizeRoom(room),
  };
  return saveGuestRooms([relationship, ...current.filter((item) => item.roomId !== room.roomId)]);
}

export function markGuestRoomRead(roomId) {
  const current = loadGuestRooms();
  return saveGuestRooms(
    current.map((item) =>
      item.roomId === roomId
        ? { ...item, unreadCount: 0, lastReadAt: new Date().toISOString(), lastVisitedAt: new Date().toISOString() }
        : item,
    ),
  );
}

export function incrementGuestRoomUnread(room, message) {
  if (!room?.roomId) {
    return loadGuestRooms();
  }

  const current = loadGuestRooms();
  const previous = current.find((item) => item.roomId === room.roomId);
  const relationship = {
    roomId: room.roomId,
    role: previous?.role || 'member',
    joinedAt: previous?.joinedAt || new Date().toISOString(),
    lastVisitedAt: previous?.lastVisitedAt || new Date().toISOString(),
    isFavorite: Boolean(previous?.isFavorite),
    unreadCount: Number(previous?.unreadCount || 0) + 1,
    notificationsMuted: Boolean(previous?.notificationsMuted),
    mutedUntil: previous?.mutedUntil || null,
    latestMessagePreview: message?.content || room.latestMessagePreview || '',
    latestMessageAt: message?.createdAt || room.latestMessageAt || null,
    latestAnnouncement: room.latestAnnouncement || previous?.latestAnnouncement || null,
    room: summarizeRoom(room),
  };
  return saveGuestRooms([relationship, ...current.filter((item) => item.roomId !== room.roomId)]);
}

export function setGuestRoomNotificationState(roomId, updates) {
  const current = loadGuestRooms();
  return saveGuestRooms(
    current.map((item) => (item.roomId === roomId ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item)),
  );
}

export function isGuestFavorite(roomId) {
  return loadGuestRooms().some((item) => item.roomId === roomId && item.isFavorite);
}

function saveGuestRooms(relationships) {
  const clean = relationships.slice(0, 80);
  localStorage.setItem(GUEST_ROOMS_KEY, JSON.stringify(clean));
  return clean;
}

function summarizeRoom(room) {
  return {
    roomId: room.roomId,
    inviteCode: room.inviteCode,
    title: room.title,
    type: room.type,
    category: room.category,
    categorySlug: room.categorySlug || '',
    categoryLabel: room.categoryLabel || room.category || '',
    categoryThemeClass: room.categoryThemeClass || '',
    categoryAccentClass: room.categoryAccentClass || '',
    categoryAnalyticsKey: room.categoryAnalyticsKey || '',
    categoryFeatureHooks: room.categoryFeatureHooks || [],
    createdAt: room.createdAt,
    lastActiveAt: room.lastActiveAt || room.createdAt,
    memberCount: room.memberCount || 0,
    isLocked: Boolean(room.isLocked),
    expiresAt: room.expiresAt || null,
    themeId: room.themeId || 'classic',
    latestMessagePreview: room.latestMessagePreview || '',
    latestMessageAt: room.latestMessageAt || null,
    latestAnnouncement: room.latestAnnouncement || null,
  };
}
