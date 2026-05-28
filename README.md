# Nexus Chat

Nexus Chat is a room-based realtime people-to-people chat app for MH Horizon. It is not an AI chatbot.

## Current Features

- Guest profile with stable local `sessionId`, display name, and avatar.
- Public, private, and temporary rooms with in-memory fallback and optional Firestore persistence.
- Rich logged-in profiles with editable display name, avatar, handle, status, saved settings, and bounded profile stats.
- Guest profiles stay first-class with local recent-room and favorite-room storage.
- My Rooms shelves for created, joined, favorite, and recent rooms.
- Account-aware room relationships with owner, moderator, and member roles.
- Owner role management for logged-in moderators, with backend permission validation for every role and moderation action.
- Durable Firestore member moderation state for mutes, kicks, and bans where persistence is available.
- User mini-profile cards with report, block, unblock, and allowed moderation actions.
- Logged-in blocked-user persistence with guest local blocking fallback.
- Owner room settings surfaces for room rules, member roles, and moderation state.
- Invite links and room-code joining.
- Live Socket.io messaging with timestamps and system join/leave messages.
- Message replies with quoted previews and scroll/highlight targeting.
- Emoji reactions with counts and per-user toggle state.
- Typing indicators with throttled client events and server timeout cleanup.
- Online users panel with owner badge, current-user label, and typing status.
- Room info drawer with invite code, member count, created time, owner, lock status, and copy actions.
- Owner controls for rename, lock/unlock, and close room.
- Message actions for reply, react, copy text, and soft-delete own message.
- Behavior-driven category presets for room discovery, default rules, templates, ambience, communities, notifications, and analytics grouping.
- Explore filters by category and room-title search.
- In-app toast notifications for copy, room actions, message delete, and errors.
- Reconnect UI and safe current-room restore using local session data.
- Message, user, and room reporting with Firestore persistence when enabled and memory fallback otherwise.
- Local browser user blocking with collapsed hidden-message display and unblock controls.
- Owner moderation for mute, unmute, kick, delete another user's message, and clear recent messages.
- Kicked-user short rejoin cooldown and muted-user send blocking.
- Moderation logs for reports, role changes, owner actions, and admin actions with the same persistence fallback.
- MVP admin panel at `/admin`, preferring Firebase admin email access with local/dev `ADMIN_KEY` fallback.
- Admin overview shows persistence status, bounded user/member summaries, and can clean expired temp rooms.
- Public-room safety banner and room rules in the room info panel.
- Stronger server-side spam checks for long messages, bursts, repeated messages, repeated characters, and link bursts.
- Firestore repository layer for room metadata, latest message history, reports, moderation logs, and guest/account profile records.
- Optional Firebase Google sign-in that keeps guest entry first-class.
- Real temp-room expiry options for 1 hour, 6 hours, 24 hours, and 7 days.
- Phase 6 billing foundation with Razorpay order creation, server-side checkout/webhook verification, Firestore entitlements, and safe disabled mode.
- Pricing, Billing, and Store pages with free/Plus/Pro/Community plan cards, owned cosmetic states, and login-to-buy gating.
- Premium room themes and profile cosmetics that are enforced server-side while keeping basic chat free.
- Admin billing support tools for viewing entitlements/payments/events and granting or revoking test/support access.
- Phase 7 in-app notification center for account mentions, replies, announcements, report status, billing status, and local guest notices.
- Unread room counts, latest room highlights, room notification snooze controls, and profile notification preferences.
- Server-validated `@` mentions, owner/mod room announcements, and bounded room activity timelines.
- Phase 9 production hardening with optional Redis, centralized jobs, aggregate analytics, status endpoints, launch/legal pages, SEO basics, and VPS deployment notes.
- Phase 11 PWA shell with install prompt, offline-safe app page, mobile safe-area polish, and optional user-controlled Firebase Cloud Messaging push.

## Local Development

```bash
npm install
cp .env.example .env
npm run dev
```

The dev command runs:

- Express + Socket.io backend on `http://localhost:4000`
- Vite React frontend on `http://localhost:5173`

If `5173` is busy, start Vite manually on another port and set `CLIENT_ORIGIN` for the backend.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run check
```

`npm run start` serves the production Vite build from the Express backend. Run `npm run build` first.

## Environment

Use `.env.example` as the template:

```bash
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
SOCKET_PING_INTERVAL_MS=25000
SOCKET_PING_TIMEOUT_MS=30000
SOCKET_CONNECT_TIMEOUT_MS=20000
NODE_ENV=development
ADMIN_KEY=change-me-for-local-admin
ADMIN_EMAILS=owner@example.com
FULL_ACCESS_EMAILS=
ALLOW_ADMIN_KEY_IN_PRODUCTION=false
TRUST_PROXY=true
LOG_LEVEL=info
ERROR_REPORTING_DSN=
LAUNCH_MODE=dev
MAINTENANCE_MODE=false
SIGNUPS_ENABLED=true
GUEST_CHAT_ENABLED=true
COMMUNITIES_ENABLED=true
STORE_ENABLED=true
PERSISTENCE_ENABLED=false
DATA_RETENTION_DAYS=30
REDIS_ENABLED=false
REDIS_URL=
REDIS_PREFIX=nexuschat
FCM_ENABLED=false
JOBS_ENABLED=true
JOB_INTERVAL_MS=60000
BILLING_ENABLED=false
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
RAZORPAY_CHECKOUT_CONFIG_ID=
VITE_GA_MEASUREMENT_ID=
VITE_ENABLE_ANALYTICS=false
VITE_FIREBASE_VAPID_KEY=
VITE_SUPPORT_EMAIL=support@example.com
```

For production, set `NODE_ENV=production`, set `PORT` to the backend port, and set `CLIENT_ORIGIN` to the public site origin, for example `https://chat.example.com`.

`ADMIN_KEY` remains the Phase 4 MVP safety-dashboard gate. The code also has a later Firebase admin-email seam through `ADMIN_EMAILS`; production key fallback is off unless `ALLOW_ADMIN_KEY_IN_PRODUCTION=true` is deliberately set. Do not expose any admin variables to Vite.

`FULL_ACCESS_EMAILS` is a backend-only verified-email allowlist for owner/test/support accounts that should resolve the complete product catalog without a Razorpay purchase. Keep it outside Vite config; it does not trust a frontend email string.

`DATA_RETENTION_DAYS` is the Phase 4 retention knob for future scheduled cleanup policy. Current message retention is already bounded by the latest-message caps in `shared/chatConfig.js`.

`BILLING_ENABLED=false` is the safe default. When billing is disabled or Razorpay env is missing, chat, guest mode, Google login, rooms, moderation, pricing previews, and store previews continue to work. Razorpay secrets are backend-only and must never use the `VITE_` prefix.

`REDIS_ENABLED=false` is the safe default. When Redis is disabled or unavailable, Nexus Chat uses memory-backed cache, presence counters, cooldowns, and rate-limit buckets. If `REDIS_ENABLED=true`, set `REDIS_URL`; the server will attach the Socket.io Redis adapter only after Redis connects.

`FCM_ENABLED=false` is the safe default. When Firebase Cloud Messaging is disabled, missing, unsupported, or denied by the browser, the app still loads normally and keeps in-app notifications. To enable optional push, set `FCM_ENABLED=true`, configure Firebase Admin persistence, and provide `VITE_FIREBASE_VAPID_KEY` for the browser token flow.

`JOBS_ENABLED=true` runs the single-instance Node scheduler every `JOB_INTERVAL_MS` milliseconds. The jobs are bounded and idempotent, covering temp-room expiry, Phase 8 scheduled announcements and event transitions, repository cleanup hooks, and entitlement-expiry placeholders. Before multi-instance production, add a distributed lock or move this to a dedicated worker.

## Firebase Persistence And Auth

Nexus Chat stays deployment-friendly without Firebase:

- `PERSISTENCE_ENABLED=false` keeps the Phase 4 services in memory mode.
- If `PERSISTENCE_ENABLED=true` but Firebase Admin env is missing or init fails, the backend warns and falls back to memory mode instead of crashing local dev.
- Socket.io presence, typing, active socket membership, and socket mappings stay live in memory in this phase.

For Firestore persistence, set `PERSISTENCE_ENABLED=true` and configure one Firebase Admin credential style on the backend:

```bash
FIREBASE_SERVICE_ACCOUNT_JSON=
FIREBASE_SERVICE_ACCOUNT_BASE64=
# or split env values
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

Never commit service-account JSON or private keys. Firebase Admin env stays backend-only.

Optional Google login uses public Vite web config only:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
```

Guest mode remains the default. Guests and Google users share the same rooms. Logged-in users gain saved profiles, joined/favorite rooms, persistent blocks, and durable role/moderation records where Firestore is available.

Firestore room/message repositories use bounded reads: room joins hydrate only the latest 100 persisted messages, admin/member/report samples are bounded, and older-history pagination stays a repository seam for later phases. Socket.io remains the live transport; there are no unlimited frontend Firestore listeners.

Phase 4 persistence now reloads active room metadata from Firestore on boot, refreshes Explore from persisted room metadata, and resolves room IDs or invite codes from Firestore when they are not already present in live memory. Temp-room joins still pass through server expiry checks so expired links get a clean expired/closed error.

Phase 5 canonical writes use:

- `rooms/{roomId}`
- `rooms/{roomId}/messages/{messageId}`
- `rooms/{roomId}/members/{memberId}`
- `users/{userIdOrGuestSessionId}`
- `users/{userId}/joinedRooms/{roomId}`
- `users/{userId}/blockedUsers/{blockedUserId}`
- `users/{userId}/notifications/{notificationId}`
- `users/{userId}/fcmTokens/{tokenId}`
- `rooms/{roomId}/announcements/{announcementId}`
- `rooms/{roomId}/activity/{activityId}`
- `reports/{reportId}`
- `moderationLogs/{logId}`

Legacy `nexusRooms`, `nexusMessages`, `nexusReports`, `nexusModerationLogs`, and `nexusUsers` are not deleted or reset. Repository reads can fall back to legacy data and lazily backfill canonical records when a safe write path touches them.

Firestore may ask for indexes as data grows. Keep these query shapes in mind:

- reports by `status` and `createdAt`
- rooms by `type`, `category`, `deletedAt`, and `lastActiveAt`
- temp rooms by `type` and `expiresAt`
- moderation logs by `roomId` and `createdAt`
- legacy message fallback by `roomId` and `createdAt`
- billing collection-group queries for `users/*/payments` by `razorpayOrderId` and recent `updatedAt`
- billing collection-group queries for `users/*/entitlements` by recent `updatedAt`
- user notifications by `createdAt` and unread filtering
- room announcements by `active` and `createdAt`
- `users/{userId}/fcmTokens` by `lastSeenAt` and collection-group `fcmTokens` by `lastSeenAt` for admin push status
- room activity by `createdAt`
- `rooms` by `communityId` and `lastActiveAt`
- `users` by `createdAt` and `lastSeenAt`
- `users/{userId}/notifications` by `readAt` and `createdAt`
- `scheduledAnnouncements` by `publishStatus` and `scheduledFor`
- `eventRooms` by `status`, `startsAt`, and `communityId`
- `communities` by `visibility`, `category`, and `lastActiveAt`
- `billingEvents` by `createdAt`
- collection-group `entitlements` by `status` and `expiresAt`
- `feedback` by `type`, `status`, and `createdAt` for filtered admin launch queues

## Phase 9 Production Hardening

Phase 9 keeps all Phase 1-8 features intact and adds launch-readiness seams:

- Optional Redis cache/rate-limit/presence store and Socket.io adapter via `server/services/cacheService.js`.
- Central rate limits for messages, reactions, typing, reports, room/community creation, announcements, RSVP, payment orders, profile changes, and admin failed attempts.
- Central logger with request IDs, recent sanitized error memory, and secret redaction.
- Environment validation with safe summaries for production toggles.
- Single-instance background jobs through `server/services/jobService.js`.
- Aggregate-only analytics through `analyticsDaily/{yyyy-mm-dd}`. Analytics never stores message content, report details, private email, raw payment data, tokens, or secrets.
- Public `GET /api/status`, public-safe `GET /api/socket-status`, plus admin-only `GET /api/admin/system-status`, `POST /api/admin/jobs/run`, `GET /api/admin/analytics`, and `GET /api/admin/errors`.
- Premium launch placeholder pages: `/privacy`, `/terms`, `/refund-policy`, `/safety`, `/contact`, plus `/status`.
- SEO basics in `index.html`, `public/robots.txt`, and `public/sitemap.xml`.

Operational status surfaces are safe serialized JSON only. Detailed system state remains admin-only and must not expose raw Firestore documents, socket IDs, Razorpay raw payloads, admin keys, Firebase private keys, or webhook secrets.

## Phase 10 Launch Readiness

Phase 10 adds a focused public-launch layer without changing the chat stack:

- Env-driven launch controls: `LAUNCH_MODE`, `MAINTENANCE_MODE`, `SIGNUPS_ENABLED`, `GUEST_CHAT_ENABLED`, `COMMUNITIES_ENABLED`, and `STORE_ENABLED`.
- Public-safe launch flags in `GET /api/status` and admin launch state in `GET /api/admin/system-status`.
- Guest-friendly feedback intake through `POST /api/feedback`, plus bounded admin feedback review/status endpoints.
- Skippable onboarding cards for guest/account users with a clear personal-info safety reminder.
- Premium `/updates`, launch footer/legal links, SEO placeholders, `LAUNCH_CHECKLIST.md`, and `LAUNCH_CONTENT.md`.

Maintenance mode is env-controlled. It pauses normal user mutation and Socket.io chat entry while health, status, admin-safe operations, and the Razorpay webhook path stay reachable. Google entry, guest chat, Store, and Communities can be paused independently for beta/public launch work.

`VITE_ENABLE_ANALYTICS=false` is the frontend-safe default. Phase 9 analytics remain aggregate backend counters only and do not store message content.

## Phase 11 PWA And Optional Push

Phase 11 makes Nexus Chat feel more app-like without changing the live chat stack:

- `public/manifest.webmanifest`, `/sw.js`, `/offline.html`, and placeholder SVG icons make Nexus installable where the browser supports PWA prompts.
- The service worker caches only static app-shell assets and the offline page. It deliberately bypasses `/api`, `/socket.io`, billing, payment, admin, and private JSON paths.
- Offline mode is honest: users can keep the already loaded shell visible, but live chat sends and room actions are blocked until the network returns.
- Profile settings include an install card and optional push controls. Notification permission is requested only after a user action.
- Durable push requires Google login, Firestore persistence, Firebase Admin, `FCM_ENABLED=true`, and `VITE_FIREBASE_VAPID_KEY`.
- FCM tokens are stored under `users/{userId}/fcmTokens/{tokenId}` using a stable server hash as `tokenId`; raw tokens are never exposed in admin responses.
- Push delivery is wired after in-app notification creation, so existing preferences, room mutes, and sender suppression remain the source of truth.

Push is limited to important account notifications: mentions, replies, room/community announcements, event reminders/live/cancelled notices, report/moderation status, and billing/system notices. Nexus does not push every normal message, typing event, reaction, join, or leave event. Push notification bodies use safe generic text and avoid raw sensitive chat content.

New Phase 11 endpoints:

- `POST /api/me/push-tokens` registers or refreshes the current browser FCM token for the authenticated user.
- `DELETE /api/me/push-tokens/:tokenId` disables a browser token for logout/device removal.
- `GET /api/status` includes public-safe PWA/FCM availability.
- `GET /api/admin/system-status` and `GET /api/admin/overview` include FCM enabled/ready state, sampled token users, send attempts, and sanitized recent failures.

PWA and FCM deployment notes:

- Service workers and web push require HTTPS in production. `localhost` is usually allowed for local testing.
- Generate a Web Push certificate/VAPID key in Firebase console and set the public key as `VITE_FIREBASE_VAPID_KEY`.
- Keep Firebase Admin credentials backend-only. Never commit service account JSON and never expose Admin SDK secrets through `VITE_` variables.
- If push causes launch issues, set `FCM_ENABLED=false`; in-app notifications and chat continue normally.
- Browser support varies. iOS, private browsing modes, enterprise policies, and notification-denied states can prevent web push.

## Category Engine

Categories are behavior-driven room presets rather than display labels. `shared/categoryConfig.js` is the shared frontend/backend contract for `Study`, `Coding`, `Gaming`, `Creative`, `Random`, `Help`, and `MH Horizon`.

- Category helpers normalize legacy labels and slugs, so old rooms such as `category: "Study"` or `category: "MH Horizon"` continue to open. Missing or unknown room categories resolve to the `Random` preset safely.
- New or touched room serializers expose trusted snapshots such as `categorySlug`, `categoryLabel`, `categoryThemeClass`, `categoryFeatureHooks`, and `categoryAnalyticsKey`; client-sent accent classes and hooks are not trusted.
- Create Room uses premium category cards plus lightweight templates. Templates prefill title, purpose, suggested rules, room type, and theme guidance while leaving the owner free to edit the room.
- Empty room rules are derived from general safety rules plus category-specific defaults. Custom room rules remain sanitized room metadata.
- Explore, chat ambience, communities, event rooms, notifications, Store theme fit, admin filtering, and aggregate analytics use the same category config and notification/analytics grouping keys.
- Category tools now add lightweight, real room utilities from the same config-driven contract. Study rooms get focus/goal/checklist/doubt tools, Coding rooms get code snippets/bug templates/secret warnings/fix markers, Gaming rooms get match lobby/invite/score cards, Creative rooms get idea/prompt/feedback boards, Help rooms get a queue/priority/solved flow, Random rooms get topic/poll cards, and MH Horizon rooms get safe hub/product-feedback surfaces.

Category theme suggestions never grant paid room themes. Existing entitlement checks in the billing/room-theme path still decide whether a premium theme can be applied.

Category tool state is additive and bounded:

- Shared contract: `shared/categoryConfig.js` exposes tool types, message card types, per-category tool availability, default settings, safe hub links, and coding secret-risk detection.
- Firestore shape: `rooms/{roomId}/tools/{toolId}` with safe serialized fields (`toolId`, `roomId`, `categorySlug`, `toolType`, `title`, `body`, `status`, creator refs, `targetMessageId`, timestamps, and bounded `metadata`). Persistence-disabled mode uses the memory/noop repository seam.
- Socket events: `categoryTool:create`, `categoryTool:update`, `categoryTool:delete`, `categoryTool:vote`, `categoryTool:joinMatch`, `categoryTool:startTimer`, `categoryTool:pauseTimer`, `categoryTool:completeTimer`, `categoryTool:markSolved`, and `categoryTool:pollVote`. The server broadcasts `categoryTool:updated` plus normal safe message updates where markers/cards are involved.
- Special message cards keep `type: "chat"` for compatibility and add `messageType`, `categoryToolType`, `categoryToolId`, and safe `metadata`. Code snippets are plain text only; no raw HTML and no execution.
- Permissions are server-side: room membership, category/tool availability, owner/mod/admin rights, rate limits, plan caps, text lengths, metadata shapes, safe hub links, and official MH Horizon badge authority are all validated by the backend.
- Admin controls include bounded `/api/admin/category-tools` reads plus status/remove endpoints for abusive or stale tool items.

## Phase 7 Notifications And Activity

Phase 7 keeps in-app notifications as the source of truth. Logged-in users load the latest 50 Firestore notifications through authenticated REST endpoints and receive live bell updates through Socket.io while online. Phase 11 can optionally mirror important account-safe notification types to browser push after user consent; guests keep local/session notification state in `localStorage`.

- Message mentions are parsed and validated by the server against known room members before safe mention metadata is persisted.
- Replies notify the original logged-in sender when another user answers them.
- Joined-room relationships store bounded unread state, `lastReadAt`, mute/snooze state, latest message preview, and announcement highlights.
- Owners and moderators can post bounded room announcements after server role checks. Activity stores room events only, never every normal message.
- Room notification snoozes suppress account notifications while chat and unread counts continue to work.

## Phase 6 Billing And Entitlements

Billing uses Razorpay checkout plus server-owned Firestore entitlements. Purchases require Firebase login; guests can still view Pricing and Store pages and continue using free chat normally.

Backend routes:

- `GET /api/billing/catalog`
- `GET /api/billing/entitlements`
- `GET /api/billing/history`
- `POST /api/payments/create-order`
- `POST /api/payments/verify`
- `POST /api/payments/webhook`

Admin billing routes:

- `GET /api/admin/billing`
- `POST /api/admin/billing/grant`
- `POST /api/admin/billing/revoke`

Security notes:

- Server catalog prices in `shared/billingCatalog.js` control amount and currency. Client-sent amount/currency is ignored.
- `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are used only on the backend.
- Checkout signatures and webhook signatures are verified server-side.
- Entitlement grants are idempotent from Razorpay payment/order references.
- Manual admin grants/revokes are intended for test/support operations and are logged.

Firestore billing structure:

- `users/{userId}/entitlements/{entitlementId}`
- `users/{userId}/payments/{paymentId}`
- `billingEvents/{eventId}`

Product catalog entries currently include Plus, Pro, Community, a weekly Plus pass, premium room themes, a golden avatar ring, and an Early Supporter badge. Free users keep public room joining, basic chatting, replies, reactions, reporting, blocking, and basic owner safety tools.

## Phase 8 Communities, Events, And Scheduled Announcements

Phase 8 adds lightweight communities as bounded containers for rooms. Communities are not Discord-style servers: chat still happens in the existing top-level room system and Socket.io remains the live layer.

Community routes:

- `GET /api/communities`
- `POST /api/communities`
- `GET /api/communities/:slugOrId`
- `PATCH /api/communities/:communityId`
- `DELETE /api/communities/:communityId`
- `POST /api/communities/:communityId/join`
- `POST /api/communities/:communityId/leave`
- `POST /api/communities/:communityId/favorite`
- `GET /api/communities/:communityId/members`
- `POST /api/communities/:communityId/members/:memberId/role`
- `POST /api/communities/:communityId/members/:memberId/remove`
- `POST /api/communities/:communityId/members/:memberId/ban`
- `POST /api/communities/:communityId/members/:memberId/unban`
- `GET /api/communities/:communityId/rooms`
- `POST /api/communities/:communityId/rooms`

Event and scheduled-announcement routes:

- `GET /api/events`
- `POST /api/events`
- `GET /api/events/:eventId`
- `PATCH /api/events/:eventId`
- `POST /api/events/:eventId/cancel`
- `POST /api/events/:eventId/rsvp`
- `GET /api/scheduled-announcements`
- `POST /api/scheduled-announcements`
- `PATCH /api/scheduled-announcements/:announcementId`
- `POST /api/scheduled-announcements/:announcementId/cancel`

Firestore structure:

- `communities/{communityId}`
- `communities/{communityId}/members/{memberId}`
- `communities/{communityId}/rooms/{roomId}` as a bounded room summary mirror
- `communities/{communityId}/announcements/{announcementId}`
- `communities/{communityId}/activity/{activityId}`
- `eventRooms/{eventId}`
- `eventRooms/{eventId}/rsvps/{userId}`
- `scheduledAnnouncements/{announcementId}`

Community roles are `owner`, `admin`, `moderator`, and `member`. Owners can manage settings, roles, rooms, events, announcements, and community moderation. Admins can manage rooms/events/announcements and moderate members but cannot delete the community or demote the owner. Moderators can moderate community-room behavior and create announcements where allowed, but cannot manage roles or billing. Guests can browse public communities and join allowed public community rooms, but durable community creation, roles, RSVP, and scheduled announcements require Google login.

Premium gates are enforced server-side through `shared/billingCatalog.js`: owned community count, rooms per community, member capacity, active event rooms, RSVP capacity, scheduled announcements, cover themes, featured placeholders, and analytics access. Joining public communities, basic chat, leaving, reporting, blocking, and safety tools remain free.

Firestore index TODOs before scale:

- `communities` by `visibility`, `category`, `deletedAt`, `lastActiveAt`, and `createdAt`
- `communities/{communityId}/members` by `role` and `joinedAt`
- `eventRooms` by `status`, `startsAt`, and `communityId`
- `scheduledAnnouncements` by `publishStatus` and `scheduledFor`
- `communities/{communityId}/activity` by `createdAt`
- `rooms/{roomId}/tools` by `updatedAt`, `status`, `toolType`, and `categorySlug`; collection-group `tools` by `updatedAt` for admin tool moderation
- `reports` by `targetType`, `status`, and `createdAt`

## Socket Events

Client emits:

- `guest:ready`
- `room:create`
- `room:join`
- `room:restore`
- `room:leave`
- `room:rename`
- `room:lock`
- `room:rules`
- `room:theme`
- `room:role`
- `room:delete`
- `room:read`
- `room:announcement:create`
- `categoryTool:create`
- `categoryTool:update`
- `categoryTool:delete`
- `categoryTool:vote`
- `categoryTool:joinMatch`
- `categoryTool:startTimer`
- `categoryTool:pauseTimer`
- `categoryTool:completeTimer`
- `categoryTool:markSolved`
- `categoryTool:pollVote`
- `message:send`
- `message:react`
- `message:delete`
- `moderation:report`
- `moderation:mute`
- `moderation:unmute`
- `moderation:kick`
- `moderation:ban`
- `moderation:unban`
- `moderation:clear_recent`
- `typing:start`
- `typing:stop`

Server emits:

- `connection:status`
- `rooms:update`
- `room:joined`
- `room:state`
- `room:error`
- `room:closed`
- `room:kicked`
- `room:announcement`
- `room:activity`
- `categoryTool:updated`
- `users:update`
- `typing:update`
- `message:new`
- `message:updated`
- `message:deleted`
- `notification:new`
- `notifications:unread`
- `community:update`
- `community:activity`
- `community:announcement`
- `event:update`
- `scheduled-announcement:published`

## Admin API

All admin routes return safe serialized JSON only. Preferred access is a Firebase ID token in `Authorization: Bearer <token>` from a signed-in email listed in `ADMIN_EMAILS`. The `x-admin-key` fallback is intended for local/dev work and requires explicit production opt-in.

- `GET /api/admin/overview`
- `GET /api/admin/system-status`
- `POST /api/admin/jobs/run`
- `GET /api/admin/analytics`
- `GET /api/admin/errors`
- `GET /api/admin/reports`
- `POST /api/admin/reports/:reportId/status`
- `POST /api/admin/reports/clear`
- `POST /api/admin/rooms/:roomId/delete`
- `POST /api/admin/rooms/cleanup-expired`
- `GET /api/admin/rooms/:roomId/members`
- `POST /api/admin/rooms/:roomId/members/:memberId/remove`
- `GET /api/admin/rooms/:roomId/activity`
- `DELETE /api/admin/rooms/:roomId/announcements/:announcementId`
- `GET /api/admin/notifications/summary`
- `GET /api/admin/communities`
- `GET /api/admin/communities/:communityId`
- `POST /api/admin/communities/:communityId/delete`
- `GET /api/admin/events`
- `POST /api/admin/events/:eventId/cancel`
- `GET /api/admin/scheduled-announcements`
- `POST /api/admin/scheduled-announcements/:announcementId/cancel`
- `GET /api/admin/communities/:communityId/activity`
- `GET /api/admin/communities/:communityId/members`
- `GET /api/admin/billing`
- `POST /api/admin/billing/grant`
- `POST /api/admin/billing/revoke`
- `GET /api/admin/logs`

## Safety And Limits

Current caps and limits live in `shared/chatConfig.js`:

- Max in-memory messages per room plus persisted message-load and retention limits.
- Max active public rooms.
- Max online users per room.
- Display name, room title, category, and message length limits.
- Message cooldown and repeated-message protection.
- Report cooldown and report rate limits per session.
- Kick rejoin cooldown.
- Typing timeout and throttle values.
- Fixed reaction emoji set.
- Community, event, RSVP, scheduled-announcement, and slug validation.
- Phase 8 scheduler caps due announcements to a bounded batch per tick.

All room/message/reaction/typing/moderation socket payloads are validated server-side. Owner moderation is checked on the server, not only hidden in the UI. Text is treated as plain text, and the UI does not render raw HTML.

## Hostinger VPS Notes

1. Install Node.js on the VPS.
2. Upload or pull the project.
3. Run `npm install`.
4. Run `npm run build`.
5. Configure `.env` outside git with production Firebase Admin env, `CLIENT_ORIGIN`, `ADMIN_EMAILS`, optional Razorpay env, and optional Redis env.
6. Start with `NODE_ENV=production PORT=4000 npm run start`.
7. Use a process manager such as PM2 for long-running production hosting:

```bash
pm2 start server/index.js --name nexus-chat
pm2 save
pm2 startup
```

Razorpay webhook URL should point to:

```text
https://your-domain.com/api/payments/webhook
```

Firestore backup readiness:

- Use managed Firestore export for production backups.
- Keep `.env` backups outside git and never commit service account JSON.
- Treat billing records and moderation records as sensitive operational data.
- Restore drills and retention policy are future operational work before large public launch.

## Future Nginx / Socket Proxy Note

Socket.io uses the proxy-friendly path:

```text
/socket.io
```

When adding Nginx later, proxy both normal HTTP traffic and websocket upgrades to the Node server. Keep `/socket.io` upgrade headers enabled. Use `ADMIN_KEY` in production only when the explicit `ALLOW_ADMIN_KEY_IN_PRODUCTION=true` fallback is deliberately required.

Minimal Nginx websocket shape:

```nginx
location / {
  proxy_pass http://127.0.0.1:4000;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

location /socket.io/ {
  proxy_pass http://127.0.0.1:4000/socket.io/;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
  proxy_read_timeout 86400;
  proxy_send_timeout 86400;
}
```

Use SSL through Certbot or Cloudflare before public traffic. For early load testing, use two browser tabs locally now; add k6/artillery/websocket load scripts before scale. A single VPS is reasonable for early users, but multi-process/multi-instance hosting should enable Redis and review Firestore cost.

Socket diagnostics are available at `GET /api/socket-status`. The server defaults to `SOCKET_PING_INTERVAL_MS=25000`, `SOCKET_PING_TIMEOUT_MS=30000`, and `SOCKET_CONNECT_TIMEOUT_MS=20000`; only tune these if a proxy/mobile network needs more tolerance.

## Current Limitations

- When persistence is disabled or Firebase cannot initialize, rooms, recent messages, reports, and moderation logs remain in memory only.
- Presence, typing, and active member socket mappings are intentionally live in memory even when Firestore is enabled.
- Guest session moderation and local browser identity are weaker than authenticated user identity.
- Admin access is still MVP-grade: Firebase email allowlisting is available, and key fallback exists for local/dev only by default. Move to hardened claims/roles and audit policy before serious production operations.
- Firestore rules and index deployment still need environment-specific review before scale.
- Billing is an MVP entitlement layer, not a full subscription-management center. Razorpay recurring subscription lifecycle, refunds, invoices, and tax workflows need production hardening before launch.
- Phase 8 community analytics are lightweight and approximate where exact reads would be expensive.
- Scheduled announcements use the Node server interval. Use a real worker or Cloud Scheduler style system before multi-instance production.
- Event reminder fanout is intentionally bounded and basic.
- Browser push is optional and requires HTTPS, Firebase Cloud Messaging, user permission, and logged-in token registration.
- No AI chatbot features, file upload, voice, video, public feed, or Discord-style channel system.

## Future Phase 12 Notes

- Public launch feedback triage, legal owner review, and official support workflow.
- Operational incident runbooks and bug feedback follow-through.
- Deeper load testing with k6/artillery/websocket scenarios.
- Distributed job locking or a dedicated worker before multi-instance deployment.
- More robust entitlement expiry scheduling, refunds, invoices, and subscription lifecycle handling.
- Email notifications only after preference, consent, and safety policy are ready.
- Consider optional media uploads only after safety, storage, and moderation policy are ready.
