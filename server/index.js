import 'dotenv/config';

import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';

import { createSocketHandlers } from './socket/handlers.js';
import { createAccountService } from './services/accountService.js';
import { createAnalyticsService } from './services/analyticsService.js';
import { createBillingService } from './services/billingService.js';
import { createCacheService } from './services/cacheService.js';
import { createCategoryFeatureService } from './services/categoryFeatureService.js';
import { createCommunityService } from './services/communityService.js';
import { createEntitlementService } from './services/entitlementService.js';
import { getLaunchConfig, safeEnvSummary, validateEnv } from './services/envService.js';
import { createFeedbackService } from './services/feedbackService.js';
import { createJobService } from './services/jobService.js';
import { createLogger } from './services/logger.js';
import { createModerationService } from './services/moderationService.js';
import { createNotificationService } from './services/notificationService.js';
import { createPersistenceService } from './services/persistenceService.js';
import { createPushService } from './services/pushService.js';
import { createRateLimitService } from './services/rateLimitService.js';
import { createRoomService } from './services/roomService.js';
import { sanitizeDisplayName } from './services/safetyService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
process.env.NODE_ENV = isDev ? 'development' : process.env.NODE_ENV || 'production';
const logger = createLogger();
const envValidation = validateEnv({ logger, isDev });
const launchConfig = getLaunchConfig();

const port = Number(process.env.PORT || 4000);
const socketPingIntervalMs = positiveEnvNumber('SOCKET_PING_INTERVAL_MS', 25000, 5000);
const socketPingTimeoutMs = positiveEnvNumber('SOCKET_PING_TIMEOUT_MS', 30000, 10000);
const socketConnectTimeoutMs = positiveEnvNumber('SOCKET_CONNECT_TIMEOUT_MS', 20000, 10000);
const allowedOrigins = (process.env.CLIENT_ORIGIN || (isDev ? 'http://localhost:5173' : ''))
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const cacheService = await createCacheService({ logger });
const rateLimitService = createRateLimitService({ cacheService, logger });
const app = express();
if (String(process.env.TRUST_PROXY || '').toLowerCase() === 'true') {
  app.set('trust proxy', 1);
}
const server = http.createServer(app);
const persistenceService = await createPersistenceService();
const analyticsService = createAnalyticsService({ repositories: persistenceService.repositories, logger });
const entitlementService = createEntitlementService({ repositories: persistenceService.repositories });
const billingService = createBillingService({
  repositories: persistenceService.repositories,
  entitlementService,
});
const roomService = createRoomService({
  repositories: persistenceService.repositories,
  entitlementService,
});
const categoryFeatureService = createCategoryFeatureService({
  repositories: persistenceService.repositories,
  entitlementService,
  logger,
});
const moderationService = createModerationService({ repositories: persistenceService.repositories });
const pushService = createPushService({
  repositories: persistenceService.repositories,
  adminApp: persistenceService.adminApp,
  persistenceStatus: persistenceService.getStatus(),
  logger,
});
const notificationService = createNotificationService({ repositories: persistenceService.repositories, pushService, logger });
const feedbackService = createFeedbackService({ repositories: persistenceService.repositories, logger });
const accountService = createAccountService({
  repositories: persistenceService.repositories,
  entitlementService,
});
const communityService = createCommunityService({
  repositories: persistenceService.repositories,
  entitlementService,
});
let jobService = null;

try {
  await Promise.all([
    roomService.initializeFromPersistence(),
    moderationService.initializeFromPersistence(),
    communityService.initializeFromPersistence(),
  ]);
} catch (error) {
  logger.warn('Persisted data hydration skipped; live memory mode continues.', { error });
}

const corsOptions = allowedOrigins.length
  ? {
      origin(origin, callback) {
        if (isOriginAllowed(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error('Origin is not allowed for Nexus Chat.'));
      },
      credentials: true,
    }
  : undefined;

app.disable('x-powered-by');
app.use(logger.requestIdMiddleware());
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(compression());

if (corsOptions) {
  app.use(cors(corsOptions));
}

app.post('/api/payments/webhook', express.raw({ type: 'application/json', limit: '200kb' }), async (request, response) => {
  try {
    const result = await billingService.handleWebhook(request.body, request.get('x-razorpay-signature'));
    analyticsService.track('billing_webhook_processed', { status: result?.status || 'processed' });
    response.json(result);
  } catch (error) {
    logger.warn('Razorpay webhook ignored safely.', { error });
    response.status(400).json({ ok: false });
  }
});

app.use(express.json({ limit: '100kb' }));

app.use('/api', (request, response, next) => {
  if (!launchConfig.maintenanceMode || request.method === 'GET' || isMaintenanceSafeApiPath(request.path)) {
    next();
    return;
  }

  response.status(503).json({
    error: 'Nexus Chat is in maintenance mode. Please check status and try again soon.',
    code: 'maintenance_mode',
  });
});

app.use(['/api/communities', '/api/events', '/api/scheduled-announcements'], (request, response, next) => {
  if (launchConfig.communitiesEnabled || request.method === 'GET') {
    next();
    return;
  }

  response.status(503).json({
    error: 'Communities and event rooms are paused for this launch mode.',
    code: 'communities_disabled',
  });
});

app.post('/api/reports', rateLimitService.middleware('reports'), async (request, response) => {
  try {
    const verifiedUser = await readOptionalUser(request);
    const sessionId = verifiedUser?.sessionId || String(request.get('x-session-id') || request.body?.reporterSessionId || '').trim();

    if (!sessionId) {
      response.status(400).json({ error: 'Set a guest profile before sending a report.' });
      return;
    }

    const report = moderationService.createReport({
      reporter: verifiedUser || {
        sessionId,
        userId: null,
        displayName: sanitizeDisplayName(request.body?.reporterName || 'Guest'),
      },
      targetType: request.body?.targetType,
      targetId: request.body?.targetId,
      roomId: request.body?.roomId || '',
      reason: request.body?.reason,
      details: request.body?.details,
    });
    const reportRoom = report.roomId ? roomService.findRoom(report.roomId) : null;
    analyticsService.track('reports_created', {
      roomId: report.roomId,
      type: report.targetType,
      category: reportRoom?.categoryAnalyticsKey || reportRoom?.category,
    });
    response.json({ report });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not send report.' });
  }
});

app.post('/api/feedback', rateLimitService.middleware('feedback'), async (request, response) => {
  try {
    const verifiedUser = await readOptionalUser(request);
    const sessionId = verifiedUser?.sessionId || String(request.get('x-session-id') || request.body?.sessionId || '').trim();
    const feedback = await feedbackService.createFeedback(
      {
        ...(verifiedUser || {}),
        sessionId,
        displayName: verifiedUser?.displayName || request.body?.name || '',
      },
      request.body || {},
      { userAgent: request.get('user-agent') || '' },
    );
    analyticsService.track('feedback_created', { type: feedback.type });
    response.json({ feedback });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not send feedback.' });
  }
});

app.get('/api/health', (_request, response) => {
  const persistence = persistenceService.getStatus();

  response.json({
    ok: true,
    service: 'nexus-chat',
    mode: process.env.NODE_ENV,
    rooms: roomService.countRooms(),
    persistence,
    persistenceEnabled: persistence.enabled,
    persistenceProvider: persistence.provider,
    dbStatus: persistence.state,
    redis: cacheService.getStatus(),
    billing: billingService.getStatus(),
    jobs: jobService?.getStatus?.() || { enabled: false },
    launch: toPublicLaunchStatus(),
    pwa: toPublicPwaStatus(),
  });
});

app.get('/api/status', (_request, response) => {
  const persistence = persistenceService.getStatus();
  response.json({
    ok: true,
    service: 'nexus-chat',
    mode: process.env.NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    persistence: {
      enabled: persistence.enabled,
      provider: persistence.provider,
      state: persistence.state,
    },
    redis: cacheService.getStatus(),
    billing: billingService.getStatus(),
    jobs: jobService?.getStatus?.() || { enabled: false },
    analytics: analyticsService.getStatus(),
    launch: toPublicLaunchStatus(),
    pwa: toPublicPwaStatus(),
  });
});

app.get('/api/billing/catalog', (_request, response) => {
  response.json(billingService.getPublicCatalog());
});

app.get('/api/rooms/public', async (_request, response) => {
  try {
    response.json({ rooms: await roomService.refreshPublicRoomsFromPersistence() });
  } catch (error) {
    logger.warn('Persisted public room refresh failed; serving live memory rooms.', { error });
    response.json({ rooms: roomService.getPublicRooms() });
  }
});

app.get('/api/rooms/:roomId', async (request, response) => {
  const room = await roomService.findOrLoadRoom(request.params.roomId);

  if (!room) {
    response.status(404).json({ error: 'Room not found.' });
    return;
  }

  response.json({ room: roomService.toPublicRoom(room) });
});

app.get('/api/communities', async (request, response) => {
  try {
    response.json({
      communities: await communityService.listCommunities({
        category: request.query.category,
        search: request.query.search,
      }),
    });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not load communities.' });
  }
});

app.post('/api/communities', requireVerifiedUser, rateLimitService.middleware('communityCreate'), async (request, response) => {
  try {
    const community = await communityService.createCommunity(request.user, request.body || {});
    analyticsService.track('communities_created', {
      communityId: community.communityId,
      category: community.categoryAnalyticsKey || community.category,
    });
    response.json({ community });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not create community.' });
  }
});

app.get('/api/communities/:slugOrId', async (request, response) => {
  try {
    response.json(await communityService.getCommunity(request.params.slugOrId, await readOptionalUser(request)));
  } catch (error) {
    response.status(404).json({ error: error instanceof Error ? error.message : 'Community not found.' });
  }
});

app.patch('/api/communities/:communityId', requireVerifiedUser, async (request, response) => {
  try {
    response.json({ community: await communityService.updateCommunity(request.params.communityId, request.user, request.body || {}) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not update community.' });
  }
});

app.delete('/api/communities/:communityId', requireVerifiedUser, async (request, response) => {
  try {
    response.json({ community: await communityService.deleteCommunity(request.params.communityId, request.user) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not delete community.' });
  }
});

app.post('/api/communities/:communityId/join', requireVerifiedUser, async (request, response) => {
  try {
    response.json(await communityService.joinCommunity(request.params.communityId, request.user));
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not join community.' });
  }
});

app.post('/api/communities/:communityId/leave', requireVerifiedUser, async (request, response) => {
  try {
    response.json(await communityService.leaveCommunity(request.params.communityId, request.user));
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not leave community.' });
  }
});

app.post('/api/communities/:communityId/favorite', requireVerifiedUser, async (request, response) => {
  try {
    response.json({ favorite: await communityService.setFavorite(request.params.communityId, request.user, request.body?.isFavorite) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not favorite community.' });
  }
});

app.get('/api/communities/:communityId/members', requireVerifiedUser, async (request, response) => {
  try {
    response.json({ members: await communityService.listMembers(request.params.communityId, request.user) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not load community members.' });
  }
});

app.post('/api/communities/:communityId/members/:memberId/role', requireVerifiedUser, async (request, response) => {
  try {
    response.json({
      member: await communityService.setMemberRole(
        request.params.communityId,
        request.user,
        request.params.memberId,
        request.body?.role,
      ),
    });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not update member role.' });
  }
});

app.post('/api/communities/:communityId/members/:memberId/remove', requireVerifiedUser, async (request, response) => {
  try {
    response.json({ member: await communityService.removeMember(request.params.communityId, request.user, request.params.memberId) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not remove member.' });
  }
});

app.post('/api/communities/:communityId/members/:memberId/ban', requireVerifiedUser, async (request, response) => {
  try {
    response.json({ member: await communityService.banMember(request.params.communityId, request.user, request.params.memberId, request.body || {}) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not ban member.' });
  }
});

app.post('/api/communities/:communityId/members/:memberId/unban', requireVerifiedUser, async (request, response) => {
  try {
    response.json({ member: await communityService.unbanMember(request.params.communityId, request.user, request.params.memberId) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not unban member.' });
  }
});

app.get('/api/communities/:communityId/rooms', async (request, response) => {
  try {
    response.json({ rooms: await communityService.listCommunityRooms(request.params.communityId) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not load community rooms.' });
  }
});

app.post('/api/communities/:communityId/rooms', requireVerifiedUser, rateLimitService.middleware('roomCreate'), async (request, response) => {
  try {
    const context = await communityService.prepareRoomCreate(request.user, {
      ...(request.body || {}),
      communityId: request.params.communityId,
    });
    const room = await roomService.createRoom({
      ...(request.body || {}),
      owner: request.user,
      ...context,
    });
    await communityService.attachRoom(room, request.user);
    analyticsService.track('rooms_created', {
      roomId: room.roomId,
      communityId: room.communityId,
      category: room.categoryAnalyticsKey || room.category,
    });
    response.json({ room: roomService.toPublicRoom(room) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not create community room.' });
  }
});

app.get('/api/events', async (request, response) => {
  try {
    response.json({ events: await communityService.listEvents({ communityId: request.query.communityId }) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not load event rooms.' });
  }
});

app.post('/api/events', requireVerifiedUser, rateLimitService.middleware('events'), async (request, response) => {
  try {
    const result = await communityService.createEvent(request.user, request.body || {}, roomService);
    analyticsService.track('events_created', {
      eventId: result.event?.eventId,
      communityId: result.event?.communityId,
      category: result.event?.categoryAnalyticsKey || result.event?.category,
    });
    response.json({ event: result.event, room: roomService.toPublicRoom(result.room) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not create event room.' });
  }
});

app.get('/api/events/:eventId', async (request, response) => {
  try {
    const event = await communityService.getEvent(request.params.eventId);
    if (!event) {
      response.status(404).json({ error: 'Event not found.' });
      return;
    }
    response.json({ event });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not load event room.' });
  }
});

app.patch('/api/events/:eventId', requireVerifiedUser, async (request, response) => {
  try {
    response.json({ event: await communityService.updateEvent(request.params.eventId, request.user, request.body || {}) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not update event.' });
  }
});

app.post('/api/events/:eventId/cancel', requireVerifiedUser, async (request, response) => {
  try {
    response.json({ event: await communityService.cancelEvent(request.params.eventId, request.user) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not cancel event.' });
  }
});

app.post('/api/events/:eventId/rsvp', requireVerifiedUser, rateLimitService.middleware('rsvp'), async (request, response) => {
  try {
    response.json({ rsvp: await communityService.setRsvp(request.params.eventId, request.user, request.body?.status) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not update RSVP.' });
  }
});

app.get('/api/scheduled-announcements', requireVerifiedUser, async (request, response) => {
  response.json({ announcements: await communityService.listScheduledAnnouncements(request.user, request.query || {}) });
});

app.post('/api/scheduled-announcements', requireVerifiedUser, rateLimitService.middleware('announcements'), async (request, response) => {
  try {
    const announcement = await communityService.createScheduledAnnouncement(request.user, request.body || {}, roomService);
    analyticsService.track('scheduled_announcements_created', {
      type: announcement.targetType,
      communityId: announcement.targetType === 'community' ? announcement.targetId : '',
      roomId: announcement.targetType === 'room' ? announcement.targetId : '',
    });
    response.json({ announcement });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not schedule announcement.' });
  }
});

app.patch('/api/scheduled-announcements/:announcementId', requireVerifiedUser, async (request, response) => {
  try {
    response.json({
      announcement: await communityService.updateScheduledAnnouncement(
        request.params.announcementId,
        request.user,
        request.body || {},
        roomService,
      ),
    });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not update scheduled announcement.' });
  }
});

app.post('/api/scheduled-announcements/:announcementId/cancel', requireVerifiedUser, async (request, response) => {
  try {
    response.json({ announcement: await communityService.cancelScheduledAnnouncement(request.params.announcementId, request.user) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not cancel scheduled announcement.' });
  }
});

const ioOptions = {
  path: '/socket.io',
  pingInterval: socketPingIntervalMs,
  pingTimeout: socketPingTimeoutMs,
  connectTimeout: socketConnectTimeoutMs,
  maxHttpBufferSize: 1e6,
};

if (corsOptions) {
  ioOptions.cors = corsOptions;
}

const io = new Server(server, ioOptions);
const socketAdapter = cacheService.createSocketAdapter?.();
if (socketAdapter) {
  io.adapter(socketAdapter);
  logger.info('Socket.io Redis adapter enabled.');
}
createSocketHandlers(io, roomService, moderationService, persistenceService, notificationService, communityService, {
  logger,
  rateLimitService,
  analyticsService,
  cacheService,
  entitlementService,
  categoryFeatureService,
  launchConfig,
});

app.get('/api/socket-status', (_request, response) => {
  response.json({
    ok: true,
    service: 'nexus-chat',
    socket: {
      path: ioOptions.path,
      clients: io.engine.clientsCount,
      transports: ['websocket', 'polling'],
      pingIntervalMs: socketPingIntervalMs,
      pingTimeoutMs: socketPingTimeoutMs,
      connectTimeoutMs: socketConnectTimeoutMs,
      redisAdapter: Boolean(socketAdapter),
    },
  });
});

jobService = createJobService({
  logger,
  roomService,
  communityService,
  notificationService,
  billingService,
  repositories: persistenceService.repositories,
  io,
});
jobService.start();

app.get('/api/profiles/:identifier', async (request, response) => {
  try {
    const profile = await accountService.getPublicProfile(request.params.identifier);

    if (!profile) {
      response.status(404).json({ error: 'Profile not found.' });
      return;
    }

    response.json({ profile });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Profile is invalid.' });
  }
});

app.get('/api/me/profile', requireVerifiedUser, async (request, response) => {
  const profile = await accountService.ensureAuthenticatedProfile(request.user);
  response.json({ profile });
});

app.patch('/api/me/profile', requireVerifiedUser, rateLimitService.middleware('profileChanges'), async (request, response) => {
  try {
    const profile = await accountService.updateProfile(request.user.userId, request.body || {});
    response.json({ profile });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not update profile.' });
  }
});

app.get('/api/me/rooms', requireVerifiedUser, async (request, response) => {
  const rooms = await accountService.getMyRooms(request.user.userId);
  response.json({ rooms });
});

app.post('/api/me/rooms/:roomId/favorite', requireVerifiedUser, async (request, response) => {
  try {
    const favorite = await accountService.setFavorite(request.user.userId, request.params.roomId, request.body?.isFavorite);
    response.json({ favorite });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not update favorite.' });
  }
});

app.get('/api/me/blocks', requireVerifiedUser, async (request, response) => {
  response.json({ blocks: await accountService.listBlocks(request.user.userId) });
});

app.post('/api/me/blocks', requireVerifiedUser, async (request, response) => {
  try {
    response.json({ block: await accountService.blockUser(request.user.userId, request.body || {}) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not block user.' });
  }
});

app.delete('/api/me/blocks/:blockedId', requireVerifiedUser, async (request, response) => {
  try {
    response.json({ ok: true, blockedId: await accountService.unblockUser(request.user.userId, request.params.blockedId) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not unblock user.' });
  }
});

app.get('/api/me/notifications', requireVerifiedUser, async (request, response) => {
  response.json(await notificationService.listNotifications(request.user.userId));
});

app.post('/api/me/notifications/:id/read', requireVerifiedUser, async (request, response) => {
  try {
    response.json({ ok: true, ...(await notificationService.markRead(request.user.userId, request.params.id)) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not mark notification read.' });
  }
});

app.post('/api/me/notifications/read-all', requireVerifiedUser, async (request, response) => {
  response.json({ ok: true, ...(await notificationService.markAllRead(request.user.userId)) });
});

app.post('/api/me/notifications/:id/dismiss', requireVerifiedUser, async (request, response) => {
  try {
    response.json({ ok: true, ...(await notificationService.dismiss(request.user.userId, request.params.id)) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not dismiss notification.' });
  }
});

app.patch('/api/me/notification-preferences', requireVerifiedUser, async (request, response) => {
  try {
    response.json({ preferences: await notificationService.updatePreferences(request.user.userId, request.body || {}) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not update notification preferences.' });
  }
});

app.post('/api/me/push-tokens', requireVerifiedUser, rateLimitService.middleware('pushTokens'), async (request, response) => {
  try {
    response.json({
      ok: true,
      push: await pushService.registerToken(request.user, request.body || {}, {
        userAgent: request.get('user-agent') || '',
      }),
    });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not register push notifications.' });
  }
});

app.delete('/api/me/push-tokens/:tokenId', requireVerifiedUser, async (request, response) => {
  try {
    response.json({ ok: true, push: await pushService.disableToken(request.user, request.params.tokenId) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not disable this push device.' });
  }
});

app.post('/api/me/rooms/:roomId/read', requireVerifiedUser, async (request, response) => {
  try {
    response.json({ ok: true, read: await notificationService.markRoomRead(request.user, request.params.roomId, request.body || {}) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not mark room read.' });
  }
});

app.patch('/api/me/rooms/:roomId/notifications', requireVerifiedUser, async (request, response) => {
  try {
    response.json({
      state: await notificationService.updateRoomNotificationState(request.user, request.params.roomId, request.body || {}),
    });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not update room notifications.' });
  }
});

app.get('/api/billing/entitlements', requireVerifiedUser, async (request, response) => {
  response.json(await billingService.getBillingSummary(request.user.userId));
});

app.get('/api/billing/history', requireVerifiedUser, async (request, response) => {
  response.json(await billingService.getBillingHistory(request.user.userId));
});

app.post('/api/payments/create-order', requireVerifiedUser, rateLimitService.middleware('paymentOrders'), async (request, response) => {
  try {
    const order = await billingService.createOrder(request.user, request.body?.productId);
    analyticsService.track('billing_orders_created', { productId: request.body?.productId });
    response.json(order);
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not create payment order.' });
  }
});

app.post('/api/payments/verify', requireVerifiedUser, async (request, response) => {
  try {
    const result = await billingService.verifyPayment(request.user, request.body || {});
    analyticsService.track('billing_payments_verified', {
      productId: result.entitlement?.productId,
      planTier: result.entitlement?.planTier,
    });
    try {
      await notificationService.createNotification({
        userId: request.user.userId,
        actorName: 'Nexus Billing',
        type: 'billing_status',
        title: 'Premium access updated',
        body: `${result.entitlement?.productId || 'Nexus premium'} is now active.`,
        targetView: 'billing',
        metadata: { entitlementId: result.entitlement?.entitlementId || '' },
      });
    } catch (notificationError) {
      console.warn(
        `Billing notification skipped safely. ${
          notificationError instanceof Error ? notificationError.message : 'Notification failed.'
        }`,
      );
    }
    response.json(result);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : 'Payment verification failed.',
      support: 'If money was deducted, keep your Razorpay payment ID and contact MH Horizon support.',
    });
  }
});

app.get('/api/admin/system-status', requireAdminAccess, async (_request, response) => {
  const persistence = persistenceService.getStatus();
  response.json({
    ok: true,
    service: 'nexus-chat',
    mode: process.env.NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    env: safeEnvSummary(),
    envValidation,
    persistence,
    redis: cacheService.getStatus(),
    billing: billingService.getStatus(),
    jobs: jobService?.getStatus?.() || { enabled: false },
    analytics: analyticsService.getStatus(),
    push: await pushService.getAdminSummary(),
    pwa: toPublicPwaStatus(),
    rooms: { liveCount: roomService.countRooms() },
    launch: toPublicLaunchStatus(),
    security: {
      adminEmailAuthConfigured: Boolean(String(process.env.ADMIN_EMAILS || '').trim()),
      adminKeyFallbackProductionAllowed: isAdminKeyFallbackAllowed(),
      corsOriginsConfigured: allowedOrigins.length,
    },
  });
});

app.post('/api/admin/jobs/run', requireAdminAccess, async (request, response) => {
  try {
    const result = await jobService?.runAll?.('admin') || { skipped: true, reason: 'jobs-disabled' };
    moderationService.addLog({
      roomId: '',
      actor: adminActor(request),
      actionType: 'system_notice',
      reason: 'Admin triggered safe jobs',
      details: result.skipped ? result.reason : 'completed',
    });
    response.json({ ok: true, result });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Could not run jobs.' });
  }
});

app.get('/api/admin/analytics', requireAdminAccess, async (_request, response) => {
  response.json(await analyticsService.getOverview(30));
});

app.get('/api/admin/errors', requireAdminAccess, (_request, response) => {
  response.json({ errors: logger.getRecentErrors(50) });
});

app.get('/api/admin/overview', requireAdminAccess, async (request, response) => {
  const userStats = await persistenceService.repositories.userRepository.listStats?.();
  const notifications = await notificationService.getAdminSummary();
  const feedback = await feedbackService.getAdminSummary();
  const categoryTools = await categoryFeatureService.listAdmin({ limit: 60 });
  const push = await pushService.getAdminSummary();
  const persistence = persistenceService.getStatus();
  response.json({
    ...roomService.getAdminOverview(),
    recentReports: moderationService.getRecentReports(),
    recentLogs: moderationService.getRecentLogs(),
    persistence,
    persistenceEnabled: persistence.enabled,
    persistenceProvider: persistence.provider,
    dbStatus: persistence.state,
    users: userStats || { totalUsers: 0, loggedInUsers: 0, guestUsers: 0 },
    notifications,
    push,
    feedback,
    categoryTools,
    adminAuth: request.adminAuth,
    billing: billingService.getStatus(),
    redis: cacheService.getStatus(),
    jobs: jobService?.getStatus?.() || { enabled: false },
    analytics: analyticsService.getStatus(),
    push,
    env: safeEnvSummary(),
    launch: toPublicLaunchStatus(),
  });
});

app.get('/api/admin/feedback', requireAdminAccess, async (request, response) => {
  try {
    response.json({
      feedback: await feedbackService.listAdmin({
        type: request.query.type,
        status: request.query.status,
        limit: request.query.limit,
      }),
    });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not load feedback.' });
  }
});

app.patch('/api/admin/feedback/:feedbackId/status', requireAdminAccess, async (request, response) => {
  try {
    const feedback = await feedbackService.updateStatus(request.params.feedbackId, request.body?.status);
    moderationService.addLog({
      roomId: '',
      actor: adminActor(request),
      actionType: 'system_notice',
      reason: 'Admin updated launch feedback',
      details: `${feedback.feedbackId}:${feedback.status}`,
    });
    response.json({ feedback });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not update feedback.' });
  }
});

app.get('/api/admin/category-tools', requireAdminAccess, async (request, response) => {
  try {
    response.json({
      tools: await categoryFeatureService.listAdmin({
        category: request.query.category,
        toolType: request.query.toolType,
        status: request.query.status,
        limit: request.query.limit,
      }),
    });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not load category tools.' });
  }
});

app.patch('/api/admin/category-tools/:roomId/:toolId/status', requireAdminAccess, async (request, response) => {
  try {
    const tool = await categoryFeatureService.updateAdminStatus(request.params.roomId, request.params.toolId, request.body?.status);
    moderationService.addLog({
      roomId: request.params.roomId,
      actor: adminActor(request),
      actionType: 'system_notice',
      reason: 'Admin updated category tool',
      details: `${tool.toolType}:${tool.status}`,
    });
    io.to(tool.roomId).emit('categoryTool:updated', { roomId: tool.roomId, tool });
    response.json({ tool });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not update category tool.' });
  }
});

app.delete('/api/admin/category-tools/:roomId/:toolId', requireAdminAccess, async (request, response) => {
  try {
    const tool = await categoryFeatureService.removeAdminTool(request.params.roomId, request.params.toolId);
    moderationService.addLog({
      roomId: request.params.roomId,
      actor: adminActor(request),
      actionType: 'system_notice',
      reason: 'Admin removed category tool',
      details: tool.toolType,
    });
    io.to(tool.roomId).emit('categoryTool:updated', { roomId: tool.roomId, tool });
    response.json({ ok: true, tool });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not remove category tool.' });
  }
});

app.get('/api/admin/billing', requireAdminAccess, async (_request, response) => {
  response.json(await billingService.getAdminBillingOverview());
});

app.post('/api/admin/billing/grant', requireAdminAccess, async (request, response) => {
  try {
    const entitlement = await billingService.grantTestEntitlement({
      admin: adminActor(request),
      userId: request.body?.userId,
      productId: request.body?.productId,
      reason: request.body?.reason,
    });
    moderationService.addLog({
      roomId: '',
      actor: adminActor(request),
      actionType: 'billing_action',
      targetSessionId: request.body?.userId || '',
      reason: 'Admin granted test/support entitlement',
      details: entitlement.productId,
    });
    try {
      await notificationService.createNotification({
        userId: request.body?.userId,
        actorName: 'Nexus Admin',
        type: 'billing_status',
        title: 'Support access granted',
        body: `${entitlement.productId} was granted by MH Horizon support.`,
        targetView: 'billing',
        metadata: { entitlementId: entitlement.entitlementId },
      });
    } catch {}
    response.json({ entitlement });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not grant entitlement.' });
  }
});

app.post('/api/admin/billing/revoke', requireAdminAccess, async (request, response) => {
  try {
    const result = await billingService.revokeTestEntitlement({
      admin: adminActor(request),
      userId: request.body?.userId,
      entitlementId: request.body?.entitlementId,
      reason: request.body?.reason,
    });
    moderationService.addLog({
      roomId: '',
      actor: adminActor(request),
      actionType: 'billing_action',
      targetSessionId: request.body?.userId || '',
      reason: 'Admin revoked test/support entitlement',
      details: request.body?.entitlementId || '',
    });
    try {
      await notificationService.createNotification({
        userId: request.body?.userId,
        actorName: 'Nexus Admin',
        type: 'billing_status',
        title: 'Support entitlement updated',
        body: 'A test/support entitlement was revoked.',
        targetView: 'billing',
        metadata: { entitlementId: request.body?.entitlementId || '' },
      });
    } catch {}
    response.json(result);
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not revoke entitlement.' });
  }
});

app.get('/api/admin/reports', requireAdminAccess, (_request, response) => {
  response.json({ reports: moderationService.listReports() });
});

app.post('/api/admin/reports/:reportId/status', requireAdminAccess, async (request, response) => {
  try {
    const report = moderationService.updateReportStatus(request.params.reportId, request.body?.status, adminActor(request));
    if (report.reporterUserId) {
      try {
        await notificationService.createNotification({
          userId: report.reporterUserId,
          roomId: report.roomId,
          actorName: 'Nexus Safety',
          type: 'report_status',
          title: `Report ${report.status}`,
          body: `Your ${report.reason.toLowerCase()} report was marked ${report.status}.`,
          targetView: 'admin',
          metadata: { reportId: report.reportId, status: report.status },
        });
      } catch {}
    }
    response.json({ report });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not update report.' });
  }
});

app.post('/api/admin/reports/clear', requireAdminAccess, (request, response) => {
  const count = moderationService.clearReports(adminActor(request));
  response.json({ ok: true, count });
});

app.post('/api/admin/rooms/:roomId/delete', requireAdminAccess, (request, response) => {
  try {
    const room = roomService.deleteRoomAsAdmin(request.params.roomId);
    moderationService.addLog({
      roomId: room.roomId,
      actor: adminActor(request),
      actionType: 'close_room',
      targetRoomId: room.roomId,
      reason: 'Admin closed room',
      details: room.title,
    });
    io.to(room.roomId).emit('room:closed', { roomId: room.roomId, reason: 'Room closed by admin.' });
    io.in(room.roomId).socketsLeave(room.roomId);
    io.emit('rooms:update', { rooms: roomService.getPublicRooms() });
    response.json({ ok: true, room: roomService.toPublicRoom(room) });
  } catch (error) {
    response.status(404).json({ error: error instanceof Error ? error.message : 'Room not found.' });
  }
});

app.get('/api/admin/rooms/:roomId/members', requireAdminAccess, async (request, response) => {
  try {
    response.json({ members: await roomService.getMemberRecords(request.params.roomId) });
  } catch (error) {
    response.status(404).json({ error: error instanceof Error ? error.message : 'Room members not found.' });
  }
});

app.get('/api/admin/notifications/summary', requireAdminAccess, async (_request, response) => {
  response.json({ notifications: await notificationService.getAdminSummary() });
});

app.get('/api/admin/communities', requireAdminAccess, async (_request, response) => {
  response.json(await communityService.getAdminOverview());
});

app.get('/api/admin/communities/:communityId', requireAdminAccess, async (request, response) => {
  try {
    response.json(await communityService.getAdminCommunity(request.params.communityId));
  } catch (error) {
    response.status(404).json({ error: error instanceof Error ? error.message : 'Community not found.' });
  }
});

app.post('/api/admin/communities/:communityId/delete', requireAdminAccess, async (request, response) => {
  try {
    const community = await communityService.deleteCommunityAsAdmin(request.params.communityId, adminActor(request));
    moderationService.addLog({
      roomId: '',
      actor: adminActor(request),
      actionType: 'community_action',
      targetRoomId: community.communityId,
      reason: 'Admin closed community',
      details: community.name,
    });
    io.emit('community:update', { community });
    response.json({ ok: true, community });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not close community.' });
  }
});

app.get('/api/admin/events', requireAdminAccess, async (_request, response) => {
  response.json({ events: await communityService.listEvents({ includeCancelled: true }) });
});

app.post('/api/admin/events/:eventId/cancel', requireAdminAccess, async (request, response) => {
  try {
    const event = await communityService.cancelEvent(request.params.eventId, { ...adminActor(request), admin: true });
    io.emit('event:update', { event });
    response.json({ ok: true, event });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not cancel event.' });
  }
});

app.get('/api/admin/scheduled-announcements', requireAdminAccess, async (_request, response) => {
  response.json({ scheduledAnnouncements: (await communityService.getAdminOverview()).scheduledAnnouncements });
});

app.post('/api/admin/scheduled-announcements/:announcementId/cancel', requireAdminAccess, async (request, response) => {
  try {
    response.json({
      ok: true,
      announcement: await communityService.cancelScheduledAnnouncement(request.params.announcementId, {
        ...adminActor(request),
        admin: true,
      }),
    });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not cancel scheduled announcement.' });
  }
});

app.get('/api/admin/communities/:communityId/activity', requireAdminAccess, async (request, response) => {
  try {
    response.json({ activity: await communityService.listCommunityActivity(request.params.communityId) });
  } catch (error) {
    response.status(404).json({ error: error instanceof Error ? error.message : 'Community activity not found.' });
  }
});

app.get('/api/admin/communities/:communityId/members', requireAdminAccess, async (request, response) => {
  try {
    response.json({ members: await communityService.listMembers(request.params.communityId, { ...adminActor(request), admin: true }) });
  } catch (error) {
    response.status(404).json({ error: error instanceof Error ? error.message : 'Community members not found.' });
  }
});

app.get('/api/admin/rooms/:roomId/activity', requireAdminAccess, async (request, response) => {
  try {
    response.json({ activity: await roomService.getRoomActivity(request.params.roomId) });
  } catch (error) {
    response.status(404).json({ error: error instanceof Error ? error.message : 'Room activity not found.' });
  }
});

app.delete('/api/admin/rooms/:roomId/announcements/:announcementId', requireAdminAccess, async (request, response) => {
  try {
    const result = await roomService.removeAnnouncementAsAdmin(
      request.params.roomId,
      request.params.announcementId,
      adminActor(request),
    );
    io.to(result.room.roomId).emit('room:announcement', {
      roomId: result.room.roomId,
      announcement: result.announcement,
      removed: true,
    });
    io.to(result.room.roomId).emit('room:activity', { roomId: result.room.roomId, activity: result.activity });
    response.json({ ok: true, announcement: result.announcement });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not remove announcement.' });
  }
});

app.post('/api/admin/rooms/:roomId/members/:memberId/remove', requireAdminAccess, async (request, response) => {
  try {
    const result = await roomService.removeMemberAsAdmin(request.params.roomId, request.params.memberId);
    moderationService.addLog({
      roomId: result.room.roomId,
      actor: adminActor(request),
      actionType: 'kick',
      targetSessionId: result.target.sessionId,
      reason: 'Admin removed room member',
      details: result.target.displayName,
    });

    for (const socketId of result.socketIds) {
      io.to(socketId).emit('room:kicked', {
        roomId: result.room.roomId,
        reason: 'You were removed from this room by admin moderation.',
      });
      io.sockets.sockets.get(socketId)?.leave(result.room.roomId);
    }

    io.emit('rooms:update', { rooms: roomService.getPublicRooms() });
    response.json({ ok: true, member: result.target });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not remove member.' });
  }
});

app.post('/api/admin/rooms/cleanup-expired', requireAdminAccess, (request, response) => {
  const count = roomService.cleanupExpiredRooms();
  moderationService.addLog({
    roomId: '',
    actor: adminActor(request),
    actionType: 'close_room',
    reason: 'Admin cleaned expired temp rooms',
    details: `${count} live temp rooms removed`,
  });
  io.emit('rooms:update', { rooms: roomService.getPublicRooms() });
  response.json({ ok: true, count });
});

app.get('/api/admin/logs', requireAdminAccess, (_request, response) => {
  response.json({ logs: moderationService.listLogs() });
});

app.use(logger.errorHandler());

if (!isDev) {
  app.use(express.static(distDir));
  app.get(/.*/, (_request, response) => {
    response.sendFile(path.join(distDir, 'index.html'));
  });
}

server.listen(port, () => {
  const originLabel = allowedOrigins.length ? allowedOrigins.join(', ') : 'same-origin';
  logger.info(`Nexus Chat server listening on http://localhost:${port}`, {
    mode: process.env.NODE_ENV,
    allowedOrigin: originLabel,
    env: safeEnvSummary(),
  });
});

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
});
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
});

let shutdownStarted = false;
async function gracefulShutdown(signal) {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;
  logger.info('Nexus Chat shutdown started.', { signal });
  jobService?.stop?.();

  await Promise.allSettled([
    new Promise((resolve) => io.close(resolve)),
    new Promise((resolve) => server.close(resolve)),
    cacheService.close?.(),
  ]);

  logger.info('Nexus Chat shutdown complete.', { signal });
  process.exit(0);
}

function positiveEnvNumber(key, fallback, minimum) {
  const parsed = Number(process.env[key] || fallback);
  return Number.isFinite(parsed) ? Math.max(minimum, parsed) : fallback;
}

function toPublicLaunchStatus() {
  return {
    mode: launchConfig.mode,
    maintenanceMode: launchConfig.maintenanceMode,
    signupsEnabled: launchConfig.signupsEnabled,
    guestChatEnabled: launchConfig.guestChatEnabled,
    communitiesEnabled: launchConfig.communitiesEnabled,
    storeEnabled: launchConfig.storeEnabled,
  };
}

function toPublicPwaStatus() {
  const pushStatus = pushService.getStatus();
  return {
    enabled: true,
    manifest: true,
    serviceWorker: true,
    offlineShell: true,
    fcm: {
      enabled: pushStatus.enabled,
      ready: pushStatus.ready,
      state: pushStatus.state,
      unavailableReason: pushStatus.unavailableReason,
      vapidKeyConfigured: Boolean(process.env.VITE_FIREBASE_VAPID_KEY),
    },
  };
}

function isMaintenanceSafeApiPath(apiPath) {
  return apiPath === '/payments/webhook' || apiPath.startsWith('/admin/');
}

function isOriginAllowed(origin) {
  if (!origin || allowedOrigins.includes(origin)) {
    return true;
  }

  return isDev && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}

async function requireVerifiedUser(request, response, next) {
  try {
    const token = getBearerToken(request);
    const decoded = token ? await persistenceService.verifyIdToken(token) : null;

    if (!decoded?.uid) {
      response.status(401).json({ error: 'Firebase login is required.' });
      return;
    }

    request.user = toVerifiedUser(decoded, request.get('x-session-id'));
    entitlementService.rememberVerifiedIdentity?.(request.user);
    next();
  } catch {
    response.status(401).json({ error: 'Firebase session is invalid.' });
  }
}

async function readOptionalUser(request) {
  try {
    const token = getBearerToken(request);
    const decoded = token ? await persistenceService.verifyIdToken(token) : null;
    const user = decoded?.uid ? toVerifiedUser(decoded, request.get('x-session-id')) : null;
    entitlementService.rememberVerifiedIdentity?.(user);
    return user;
  } catch {
    return null;
  }
}

async function requireAdminAccess(request, response, next) {
  try {
    const token = getBearerToken(request);
    const decoded = token ? await persistenceService.verifyIdToken(token) : null;
    const email = String(decoded?.email || '').trim().toLowerCase();

    if (decoded?.uid && email && getAdminEmails().has(email)) {
      request.user = toVerifiedUser(decoded, request.get('x-session-id'));
      entitlementService.rememberVerifiedIdentity?.(request.user);
      request.adminAuth = { method: 'firebase', email };
      next();
      return;
    }
  } catch {
    // Invalid Firebase tokens may still fall back to a local dev admin key.
  }

  const adminKey = process.env.ADMIN_KEY || '';

  if (!isAdminKeyFallbackAllowed()) {
    await rateLimitService.consume('adminFailedAttempts', request.ip || request.get('x-session-id') || 'admin');
    response.status(401).json({ error: 'Firebase admin access is required.' });
    return;
  }

  if (!adminKey) {
    await rateLimitService.consume('adminFailedAttempts', request.ip || request.get('x-session-id') || 'admin');
    response.status(503).json({ error: 'Admin key fallback is not configured.' });
    return;
  }

  if (request.get('x-admin-key') !== adminKey) {
    const limit = await rateLimitService.consume('adminFailedAttempts', request.ip || request.get('x-session-id') || 'admin');
    if (!limit.ok) {
      response.status(429).json({ error: limit.message });
      return;
    }
    response.status(401).json({ error: 'Admin access is invalid.' });
    return;
  }

  request.adminAuth = { method: 'key' };
  next();
}

function adminActor(request) {
  return {
    sessionId: request?.user?.sessionId || 'admin',
    userId: request?.user?.userId || null,
    displayName: request?.adminAuth?.method === 'firebase' ? 'Firebase Admin' : 'Admin',
  };
}

function getBearerToken(request) {
  const authorization = request.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

function toVerifiedUser(decoded, sessionId = '') {
  return {
    userId: decoded.uid,
    sessionId: sessionId || `user_${decoded.uid}`,
    displayName: decoded.name || decoded.displayName || 'NexusUser',
    avatar: 'nexus',
    authProvider: 'google',
    email: decoded.email || '',
  };
}

function getAdminEmails() {
  return new Set(
    String(process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function isAdminKeyFallbackAllowed() {
  return isDev || String(process.env.ALLOW_ADMIN_KEY_IN_PRODUCTION || '').toLowerCase() === 'true';
}
