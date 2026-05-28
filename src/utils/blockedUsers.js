const BLOCKED_USERS_KEY = 'nexusChat.blockedUsers.v1';

export function loadBlockedUsers() {
  try {
    const stored = JSON.parse(localStorage.getItem(BLOCKED_USERS_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter(isSessionIdLike) : [];
  } catch {
    return [];
  }
}

export function saveBlockedUsers(sessionIds) {
  const cleanIds = [...new Set((sessionIds || []).filter(isSessionIdLike))];
  localStorage.setItem(BLOCKED_USERS_KEY, JSON.stringify(cleanIds));
  return cleanIds;
}

function isSessionIdLike(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{3,120}$/.test(value);
}
