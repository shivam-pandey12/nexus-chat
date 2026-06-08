export async function fetchPublicRooms() {
  const response = await fetch('/api/rooms/public');

  if (!response.ok) {
    throw new Error('Could not load public rooms.');
  }

  const data = await response.json();
  return data.rooms || [];
}

export async function fetchStatus() {
  return requestJson('/api/status');
}

export async function createReport(payload, idToken = '', sessionId = '') {
  return requestJson('/api/reports', {
    method: 'POST',
    body: JSON.stringify({ ...payload, reporterSessionId: sessionId }),
  }, {
    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    ...(sessionId ? { 'x-session-id': sessionId } : {}),
  });
}

export async function createFeedback(payload, idToken = '', sessionId = '') {
  return requestJson('/api/feedback', {
    method: 'POST',
    body: JSON.stringify({ ...payload, sessionId }),
  }, {
    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    ...(sessionId ? { 'x-session-id': sessionId } : {}),
  });
}

export async function fetchCommunities(params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ).toString();
  return requestJson(`/api/communities${query ? `?${query}` : ''}`);
}

export async function fetchCommunity(identifier, idToken = '', sessionId = '') {
  return requestJson(`/api/communities/${encodeURIComponent(identifier)}`, {}, {
    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    ...(sessionId ? { 'x-session-id': sessionId } : {}),
  });
}

export async function createCommunity(idToken, sessionId, payload) {
  return authRequest('/api/communities', idToken, sessionId, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateCommunity(idToken, sessionId, communityId, payload) {
  return authRequest(`/api/communities/${encodeURIComponent(communityId)}`, idToken, sessionId, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteCommunity(idToken, sessionId, communityId) {
  return authRequest(`/api/communities/${encodeURIComponent(communityId)}`, idToken, sessionId, {
    method: 'DELETE',
  });
}

export async function joinCommunity(idToken, sessionId, communityId) {
  return authRequest(`/api/communities/${encodeURIComponent(communityId)}/join`, idToken, sessionId, { method: 'POST' });
}

export async function leaveCommunity(idToken, sessionId, communityId) {
  return authRequest(`/api/communities/${encodeURIComponent(communityId)}/leave`, idToken, sessionId, { method: 'POST' });
}

export async function favoriteCommunity(idToken, sessionId, communityId, isFavorite) {
  return authRequest(`/api/communities/${encodeURIComponent(communityId)}/favorite`, idToken, sessionId, {
    method: 'POST',
    body: JSON.stringify({ isFavorite }),
  });
}

export async function updateCommunityRole(idToken, sessionId, communityId, memberId, role) {
  return authRequest(
    `/api/communities/${encodeURIComponent(communityId)}/members/${encodeURIComponent(memberId)}/role`,
    idToken,
    sessionId,
    {
      method: 'POST',
      body: JSON.stringify({ role }),
    },
  );
}

export async function banCommunityMember(idToken, sessionId, communityId, memberId, payload) {
  return authRequest(
    `/api/communities/${encodeURIComponent(communityId)}/members/${encodeURIComponent(memberId)}/ban`,
    idToken,
    sessionId,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function createCommunityRoom(idToken, sessionId, communityId, payload) {
  return authRequest(`/api/communities/${encodeURIComponent(communityId)}/rooms`, idToken, sessionId, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchEvents(params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ).toString();
  return requestJson(`/api/events${query ? `?${query}` : ''}`);
}

export async function fetchEvent(eventId) {
  return requestJson(`/api/events/${encodeURIComponent(eventId)}`);
}

export async function createEvent(idToken, sessionId, payload) {
  return authRequest('/api/events', idToken, sessionId, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateEvent(idToken, sessionId, eventId, payload) {
  return authRequest(`/api/events/${encodeURIComponent(eventId)}`, idToken, sessionId, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function cancelEvent(idToken, sessionId, eventId) {
  return authRequest(`/api/events/${encodeURIComponent(eventId)}/cancel`, idToken, sessionId, { method: 'POST' });
}

export async function setEventRsvp(idToken, sessionId, eventId, status) {
  return authRequest(`/api/events/${encodeURIComponent(eventId)}/rsvp`, idToken, sessionId, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

export async function fetchScheduledAnnouncements(idToken, sessionId) {
  return authRequest('/api/scheduled-announcements', idToken, sessionId);
}

export async function createScheduledAnnouncement(idToken, sessionId, payload) {
  return authRequest('/api/scheduled-announcements', idToken, sessionId, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function cancelScheduledAnnouncement(idToken, sessionId, announcementId) {
  return authRequest(`/api/scheduled-announcements/${encodeURIComponent(announcementId)}/cancel`, idToken, sessionId, {
    method: 'POST',
  });
}

export async function fetchPublicProfile(identifier) {
  return requestJson(`/api/profiles/${encodeURIComponent(identifier)}`);
}

export async function fetchBillingCatalog() {
  return requestJson('/api/billing/catalog');
}

export async function fetchBillingEntitlements(idToken, sessionId) {
  return authRequest('/api/billing/entitlements', idToken, sessionId);
}

export async function fetchBillingHistory(idToken, sessionId) {
  return authRequest('/api/billing/history', idToken, sessionId);
}

export async function createPaymentOrder(idToken, sessionId, productId) {
  return authRequest('/api/payments/create-order', idToken, sessionId, {
    method: 'POST',
    body: JSON.stringify({ productId }),
  });
}

export async function verifyPayment(idToken, sessionId, payload) {
  return authRequest('/api/payments/verify', idToken, sessionId, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchMyProfile(idToken, sessionId) {
  return authRequest('/api/me/profile', idToken, sessionId);
}

export async function updateMyProfile(idToken, sessionId, payload) {
  return authRequest('/api/me/profile', idToken, sessionId, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function fetchMyRooms(idToken, sessionId) {
  return authRequest('/api/me/rooms', idToken, sessionId);
}

export async function fetchMyNotifications(idToken, sessionId) {
  return authRequest('/api/me/notifications', idToken, sessionId);
}

export async function markNotificationRead(idToken, sessionId, notificationId) {
  return authRequest(`/api/me/notifications/${encodeURIComponent(notificationId)}/read`, idToken, sessionId, {
    method: 'POST',
  });
}

export async function markAllNotificationsRead(idToken, sessionId) {
  return authRequest('/api/me/notifications/read-all', idToken, sessionId, { method: 'POST' });
}

export async function dismissNotification(idToken, sessionId, notificationId) {
  return authRequest(`/api/me/notifications/${encodeURIComponent(notificationId)}/dismiss`, idToken, sessionId, {
    method: 'POST',
  });
}

export async function updateNotificationPreferences(idToken, sessionId, preferences) {
  return authRequest('/api/me/notification-preferences', idToken, sessionId, {
    method: 'PATCH',
    body: JSON.stringify(preferences),
  });
}

export async function registerPushToken(idToken, sessionId, payload) {
  return authRequest('/api/me/push-tokens', idToken, sessionId, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function disablePushToken(idToken, sessionId, tokenId) {
  return authRequest(`/api/me/push-tokens/${encodeURIComponent(tokenId)}`, idToken, sessionId, {
    method: 'DELETE',
  });
}

export async function markRoomRead(idToken, sessionId, roomId, payload = {}) {
  return authRequest(`/api/me/rooms/${encodeURIComponent(roomId)}/read`, idToken, sessionId, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateRoomNotifications(idToken, sessionId, roomId, payload) {
  return authRequest(`/api/me/rooms/${encodeURIComponent(roomId)}/notifications`, idToken, sessionId, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function setFavoriteRoom(idToken, sessionId, roomId, isFavorite) {
  return authRequest(`/api/me/rooms/${encodeURIComponent(roomId)}/favorite`, idToken, sessionId, {
    method: 'POST',
    body: JSON.stringify({ isFavorite }),
  });
}

export async function fetchMyBlocks(idToken, sessionId) {
  return authRequest('/api/me/blocks', idToken, sessionId);
}

export async function createMyBlock(idToken, sessionId, payload) {
  return authRequest('/api/me/blocks', idToken, sessionId, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteMyBlock(idToken, sessionId, blockedId) {
  return authRequest(`/api/me/blocks/${encodeURIComponent(blockedId)}`, idToken, sessionId, {
    method: 'DELETE',
  });
}

export async function fetchAdminOverview(adminAuth) {
  return adminRequest('/api/admin/overview', adminAuth);
}

export async function fetchAdminSystemStatus(adminAuth) {
  return adminRequest('/api/admin/system-status', adminAuth);
}

export async function runAdminJobs(adminAuth) {
  return adminRequest('/api/admin/jobs/run', adminAuth, { method: 'POST' });
}

export async function fetchAdminAnalytics(adminAuth) {
  return adminRequest('/api/admin/analytics', adminAuth);
}

export async function fetchAdminErrors(adminAuth) {
  return adminRequest('/api/admin/errors', adminAuth);
}

export async function fetchAdminFeedback(adminAuth, filters = {}) {
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ).toString();
  return adminRequest(`/api/admin/feedback${query ? `?${query}` : ''}`, adminAuth);
}

export async function updateAdminFeedbackStatus(adminAuth, feedbackId, status) {
  return adminRequest(`/api/admin/feedback/${encodeURIComponent(feedbackId)}/status`, adminAuth, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function fetchAdminCategoryTools(adminAuth, filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== 'all') {
      params.set(key, value);
    }
  });
  const query = params.toString();
  return adminRequest(`/api/admin/category-tools${query ? `?${query}` : ''}`, adminAuth);
}

export async function updateAdminCategoryToolStatus(adminAuth, roomId, toolId, status) {
  return adminRequest(
    `/api/admin/category-tools/${encodeURIComponent(roomId)}/${encodeURIComponent(toolId)}/status`,
    adminAuth,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  );
}

export async function deleteAdminCategoryTool(adminAuth, roomId, toolId) {
  return adminRequest(
    `/api/admin/category-tools/${encodeURIComponent(roomId)}/${encodeURIComponent(toolId)}`,
    adminAuth,
    { method: 'DELETE' },
  );
}

export async function fetchAdminReports(adminAuth) {
  return adminRequest('/api/admin/reports', adminAuth);
}

export async function fetchAdminLogs(adminAuth) {
  return adminRequest('/api/admin/logs', adminAuth);
}

export async function fetchAdminRoomMembers(adminAuth, roomId) {
  return adminRequest(`/api/admin/rooms/${encodeURIComponent(roomId)}/members`, adminAuth);
}

export async function fetchAdminRoomActivity(adminAuth, roomId) {
  return adminRequest(`/api/admin/rooms/${encodeURIComponent(roomId)}/activity`, adminAuth);
}

export async function removeAdminAnnouncement(adminAuth, roomId, announcementId) {
  return adminRequest(
    `/api/admin/rooms/${encodeURIComponent(roomId)}/announcements/${encodeURIComponent(announcementId)}`,
    adminAuth,
    { method: 'DELETE' },
  );
}

export async function removeAdminRoomMember(adminAuth, roomId, memberId) {
  return adminRequest(`/api/admin/rooms/${encodeURIComponent(roomId)}/members/${encodeURIComponent(memberId)}/remove`, adminAuth, {
    method: 'POST',
  });
}

export async function updateReportStatus(adminAuth, reportId, status) {
  return adminRequest(`/api/admin/reports/${encodeURIComponent(reportId)}/status`, adminAuth, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

export async function clearAdminReports(adminAuth) {
  return adminRequest('/api/admin/reports/clear', adminAuth, { method: 'POST' });
}

export async function deleteAdminRoom(adminAuth, roomId) {
  return adminRequest(`/api/admin/rooms/${encodeURIComponent(roomId)}/delete`, adminAuth, { method: 'POST' });
}

export async function cleanupExpiredAdminRooms(adminAuth) {
  return adminRequest('/api/admin/rooms/cleanup-expired', adminAuth, { method: 'POST' });
}

export async function fetchAdminBilling(adminAuth) {
  return adminRequest('/api/admin/billing', adminAuth);
}

export async function fetchAdminCommunities(adminAuth) {
  return adminRequest('/api/admin/communities', adminAuth);
}

export async function deleteAdminCommunity(adminAuth, communityId) {
  return adminRequest(`/api/admin/communities/${encodeURIComponent(communityId)}/delete`, adminAuth, { method: 'POST' });
}

export async function fetchAdminEvents(adminAuth) {
  return adminRequest('/api/admin/events', adminAuth);
}

export async function cancelAdminEvent(adminAuth, eventId) {
  return adminRequest(`/api/admin/events/${encodeURIComponent(eventId)}/cancel`, adminAuth, { method: 'POST' });
}

export async function fetchAdminScheduledAnnouncements(adminAuth) {
  return adminRequest('/api/admin/scheduled-announcements', adminAuth);
}

export async function cancelAdminScheduledAnnouncement(adminAuth, announcementId) {
  return adminRequest(`/api/admin/scheduled-announcements/${encodeURIComponent(announcementId)}/cancel`, adminAuth, {
    method: 'POST',
  });
}

export async function grantAdminEntitlement(adminAuth, payload) {
  return adminRequest('/api/admin/billing/grant', adminAuth, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function revokeAdminEntitlement(adminAuth, payload) {
  return adminRequest('/api/admin/billing/revoke', adminAuth, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function authRequest(path, idToken, sessionId, options = {}) {
  if (!idToken) {
    throw new Error('Account login is required.');
  }

  return requestJson(path, options, {
    Authorization: `Bearer ${idToken}`,
    'x-session-id': sessionId || '',
  });
}

async function adminRequest(path, adminAuth, options = {}) {
  return requestJson(path, options, {
    ...(adminAuth?.idToken ? { Authorization: `Bearer ${adminAuth.idToken}` } : {}),
    ...(adminAuth?.adminKey ? { 'x-admin-key': adminAuth.adminKey } : {}),
    ...(adminAuth?.sessionId ? { 'x-session-id': adminAuth.sessionId } : {}),
  });
}

async function requestJson(path, options = {}, extraHeaders = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
      ...(options.headers || {}),
    },
  });
  const rawBody = await response.text().catch(() => '');
  let data = {};

  if (rawBody) {
    try {
      data = JSON.parse(rawBody);
    } catch {
      data = { error: rawBody.slice(0, 180) };
    }
  }

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status}).`);
  }

  return data;
}
