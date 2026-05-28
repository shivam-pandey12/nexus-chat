# Nexus Chat Public Launch Checklist

Use this checklist before a beta or public deployment. Record failures, screenshots, env differences, and follow-up owners instead of treating unchecked items as passed.

## Core Chat

- [ ] Landing CTA paths open Guest Entry, Explore Rooms, and Create Room.
- [ ] Guest identity validates name/avatar and persists locally.
- [ ] Google login restores an account profile and logout returns to guest-safe behavior.
- [ ] Public, private invite, and temp room create/join flows work.
- [ ] Invalid, deleted, locked, and expired room states are readable.
- [ ] Live messages, replies, reactions, typing, online users, reconnect, and mobile composer layout work in two tabs.

## Safety And Admin

- [ ] Message, user, room, community, and event reporting paths work.
- [ ] Block/show once/unblock behavior remains safe.
- [ ] Mute, unmute, kick, ban, unban, owner/mod role checks, and spam guards work server-side.
- [ ] Admin Firebase email access works and production key fallback is deliberate.
- [ ] No raw HTML injection or unsafe private data exposure is visible.

## Persistence And Notifications

- [ ] Firestore enabled mode survives server restart for rooms, latest messages, reports, logs, My Rooms, favorites, notifications, communities, and events.
- [ ] Memory fallback mode starts with Firebase disabled or unavailable.
- [ ] Temp cleanup, scheduled announcements, event transitions, unread counts, mentions, replies, announcements, and room snooze states work.

## Billing And Premium

- [ ] Billing disabled mode keeps free chat usable.
- [ ] Pricing, Store, Billing, disabled/test labels, owned/apply states, and premium theme application work.
- [ ] Razorpay create order, verify, webhook verification, entitlement grant, and idempotency are checked in the intended environment.
- [ ] Admin manual entitlement grant/revoke is guarded and logged.

## Communities And Events

- [ ] Create/join/leave community, community roles, room creation, community moderation, and discovery views work.
- [ ] Event scheduling, lobby/live/ended behavior, RSVP, and scheduled announcement publish flow work.

## Launch Systems

- [ ] `npm run build`, `npm run check`, and backend syntax checks pass.
- [ ] `LAUNCH_MODE`, maintenance, signup, guest-chat, billing, Store, and Communities flags show expected UI and server behavior.
- [ ] Feedback modal accepts guest and logged-in feedback and admin can review status.
- [ ] Onboarding is skippable and safety reminder text is present.
- [ ] Privacy, Terms, Refund, Safety, Contact, Updates, footer links, SEO tags, robots, and sitemap placeholders are reviewed.

## Deployment And Recovery

- [ ] `.env` is backed up outside git and service-account material is not committed.
- [ ] `npm install`, `npm run build`, `npm run start`, PM2 restart, health, status, logs, and Nginx websocket upgrade are checked.
- [ ] SSL is active and `CLIENT_ORIGIN`, Firebase, Razorpay, Redis, admin, jobs, and launch env values match production intent.
- [ ] Firestore export/backup plan and rollback commit/build note are ready.
