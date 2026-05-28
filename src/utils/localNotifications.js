const LOCAL_NOTIFICATIONS_KEY = 'nexusChat.localNotifications.v1';
const LOCAL_ROOM_STATE_KEY = 'nexusChat.localRoomNotificationState.v1';
const LOCAL_PREFERENCES_KEY = 'nexusChat.localNotificationPreferences.v1';

export function loadLocalNotifications() {
  try {
    const stored = JSON.parse(localStorage.getItem(LOCAL_NOTIFICATIONS_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter((item) => item?.notificationId).slice(0, 50) : [];
  } catch {
    return [];
  }
}

export function addLocalNotification(notification) {
  const next = {
    notificationId: notification.notificationId || `local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type: notification.type || 'system_notice',
    title: notification.title || 'Nexus update',
    body: notification.body || '',
    roomId: notification.roomId || '',
    targetView: notification.targetView || '',
    targetUrl: notification.targetUrl || '',
    createdAt: notification.createdAt || new Date().toISOString(),
    readAt: null,
    dismissedAt: null,
    metadata: notification.metadata || {},
  };
  const notifications = [next, ...loadLocalNotifications()].slice(0, 50);
  localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(notifications));
  return notifications;
}

export function updateLocalNotification(notificationId, updates) {
  const notifications = loadLocalNotifications().map((notification) =>
    notification.notificationId === notificationId ? { ...notification, ...updates } : notification,
  );
  localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(notifications));
  return notifications;
}

export function markAllLocalNotificationsRead() {
  const readAt = new Date().toISOString();
  const notifications = loadLocalNotifications().map((notification) =>
    notification.dismissedAt ? notification : { ...notification, readAt: notification.readAt || readAt },
  );
  localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(notifications));
  return notifications;
}

export function getLocalUnreadCount(notifications = loadLocalNotifications()) {
  return notifications.filter((notification) => !notification.readAt && !notification.dismissedAt).length;
}

export function loadLocalRoomStates() {
  try {
    const stored = JSON.parse(localStorage.getItem(LOCAL_ROOM_STATE_KEY) || '{}');
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  } catch {
    return {};
  }
}

export function saveLocalRoomState(roomId, updates) {
  const states = loadLocalRoomStates();
  states[roomId] = { ...(states[roomId] || {}), ...updates, updatedAt: new Date().toISOString() };
  localStorage.setItem(LOCAL_ROOM_STATE_KEY, JSON.stringify(states));
  return states[roomId];
}

export function loadLocalNotificationPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(LOCAL_PREFERENCES_KEY) || '{}');
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  } catch {
    return {};
  }
}

export function saveLocalNotificationPreferences(preferences) {
  localStorage.setItem(LOCAL_PREFERENCES_KEY, JSON.stringify(preferences || {}));
  return preferences || {};
}
