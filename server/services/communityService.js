import crypto from 'node:crypto';

import {
  CHAT_LIMITS,
  COMMUNITY_ACTIVITY_TYPES,
  COMMUNITY_ROLES,
  EVENT_STATUSES,
} from '../../shared/chatConfig.js';
import { getPlanLimits } from '../../shared/billingCatalog.js';
import {
  getCategoryConfig,
  getCategoryDefaultRules,
  getCategoryFeatureHooks,
  getCategoryForAnalytics,
  getCategorySlug,
  isValidCategory,
} from '../../shared/categoryConfig.js';
import {
  sanitizeCategory,
  sanitizeCommunityActivityType,
  sanitizeCommunityCategory,
  sanitizeCommunityDescription,
  sanitizeCommunityName,
  sanitizeCommunityRole,
  sanitizeCommunityRules,
  sanitizeCommunitySlug,
  sanitizeCommunityTags,
  sanitizeCommunityVisibility,
  sanitizeCoverTheme,
  sanitizeEventDescription,
  sanitizeEventStatus,
  sanitizeEventTimes,
  sanitizeEventTitle,
  sanitizeIdentifier,
  sanitizeReportDetails,
  sanitizeRsvpStatus,
  sanitizeScheduledAnnouncementBody,
  sanitizeScheduledAnnouncementStatus,
  sanitizeScheduledAnnouncementTarget,
  sanitizeScheduledAnnouncementTitle,
} from './safetyService.js';

const DEFAULT_RULES = getCategoryDefaultRules('study').join(' ');

export function createCommunityService({ repositories = {}, entitlementService } = {}) {
  const communityRepository = repositories.communityRepository || {};
  const communityMemberRepository = repositories.communityMemberRepository || {};
  const communityRoomRepository = repositories.communityRoomRepository || {};
  const communityAnnouncementRepository = repositories.communityAnnouncementRepository || {};
  const communityActivityRepository = repositories.communityActivityRepository || {};
  const eventRepository = repositories.eventRepository || {};
  const rsvpRepository = repositories.rsvpRepository || {};
  const scheduledAnnouncementRepository = repositories.scheduledAnnouncementRepository || {};

  const communities = new Map();
  const communityMembers = new Map();
  const communityRooms = new Map();
  const communityAnnouncements = new Map();
  const communityActivities = new Map();
  const events = new Map();
  const eventRsvps = new Map();
  const scheduledAnnouncements = new Map();

  async function initializeFromPersistence() {
    const [persistedCommunities, persistedEvents, persistedScheduled] = await Promise.all([
      communityRepository.listActive?.(CHAT_LIMITS.MAX_COMMUNITIES_LOAD),
      eventRepository.listRecent?.(CHAT_LIMITS.MAX_EVENTS_LOAD),
      scheduledAnnouncementRepository.listRecent?.(CHAT_LIMITS.MAX_SCHEDULED_ANNOUNCEMENTS_LOAD),
    ]);

    for (const community of persistedCommunities || []) {
      if (community?.communityId && !community.deletedAt) {
        communities.set(community.communityId, normalizeCommunity(community));
      }
    }

    for (const event of persistedEvents || []) {
      if (event?.eventId) {
        events.set(event.eventId, normalizeEvent(event));
      }
    }

    for (const announcement of persistedScheduled || []) {
      if (announcement?.announcementId && announcement.publishStatus !== 'published') {
        scheduledAnnouncements.set(announcement.announcementId, normalizeScheduledAnnouncement(announcement));
      }
    }
  }

  async function listCommunities(filters = {}) {
    const persisted = await communityRepository.listActive?.(CHAT_LIMITS.MAX_COMMUNITIES_LOAD);
    hydrateCommunities(communities, persisted);
    const query = String(filters.search || '').trim().toLowerCase();
    const category = filters.category && filters.category !== 'All' ? getCategorySlug(filters.category) : '';

    return [...communities.values()]
      .filter((community) => !community.deletedAt && community.visibility === 'public')
      .filter((community) => !category || getCategorySlug(community.categorySlug || community.category) === category)
      .filter((community) => {
        if (!query) {
          return true;
        }

        return (
          community.name.toLowerCase().includes(query) ||
          community.description.toLowerCase().includes(query) ||
          community.tags.some((tag) => tag.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => new Date(b.lastActiveAt || b.createdAt).getTime() - new Date(a.lastActiveAt || a.createdAt).getTime())
      .slice(0, CHAT_LIMITS.MAX_COMMUNITIES_LOAD)
      .map(toPublicCommunity);
  }

  async function getCommunity(identifier, viewer = null) {
    const community = await findOrLoadCommunity(identifier);

    if (!community || community.deletedAt) {
      throw new Error('Community not found.');
    }

    const membership = viewer?.userId ? await getMemberRecord(community, viewer) : null;
    const canManage = canManageCommunity(community, membership, viewer);

    if (community.visibility === 'private' && !membership && !isCommunityOwner(community, viewer) && !viewer?.admin) {
      throw new Error('This community is private.');
    }

    return {
      community: toPublicCommunity(community),
      membership: membership ? serializeMember(membership) : null,
      rooms: await listCommunityRooms(community.communityId),
      events: await listEvents({ communityId: community.communityId, includePrivate: Boolean(membership) }),
      announcements: await listCommunityAnnouncements(community.communityId),
      activity: await listCommunityActivity(community.communityId),
      members: canManage ? await listMembers(community.communityId, viewer) : [],
      analytics: canManage ? await getCommunityAnalytics(community.communityId) : null,
    };
  }

  async function createCommunity(owner, payload = {}) {
    requireLoggedIn(owner);
    const limits = await getLimits(owner.userId);
    const ownedCount = await countOwnedCommunities(owner.userId);

    if (ownedCount >= limits.communities) {
      throw new Error('Community limit reached for your current plan.');
    }

    const name = sanitizeCommunityName(payload.name);
    const slug = sanitizeCommunitySlug(payload.slug, name);

    if (await isSlugTaken(slug)) {
      throw new Error('Community slug is already taken.');
    }

    const now = new Date().toISOString();
    const category = sanitizeCommunityCategory(payload.category);
    const community = normalizeCommunity({
      communityId: createId('com'),
      slug,
      name,
      description: sanitizeCommunityDescription(payload.description),
      category,
      visibility: sanitizeCommunityVisibility(payload.visibility),
      ownerUserId: owner.userId,
      ownerName: owner.displayName,
      avatar: sanitizeCommunityAvatar(payload.avatar),
      coverTheme: await sanitizeOwnedCoverTheme(owner.userId, payload.coverTheme),
      createdAt: now,
      updatedAt: now,
      lastActiveAt: now,
      deletedAt: null,
      memberCountSnapshot: 1,
      roomCountSnapshot: 0,
      rules: sanitizeCommunityRules(payload.rules) || getCategoryRuleText(category),
      tags: sanitizeCommunityTags(payload.tags),
      planRequired: '',
      featuredUntil: null,
      safetyLevel: 'standard',
    });

    const ownerMember = normalizeMember({
      memberId: memberIdFor(owner),
      communityId: community.communityId,
      userId: owner.userId,
      sessionId: owner.sessionId,
      displayName: owner.displayName,
      avatar: owner.avatar,
      role: 'owner',
      joinedAt: now,
      lastVisitedAt: now,
    });

    communities.set(community.communityId, community);
    upsertNested(communityMembers, community.communityId, ownerMember.memberId, ownerMember);
    await communityRepository.save?.(community);
    await communityMemberRepository.upsert?.(community.communityId, ownerMember);
    await addActivity(community.communityId, 'community_created', owner, { name: community.name });
    return toPublicCommunity(community);
  }

  async function updateCommunity(communityId, actor, payload = {}) {
    const community = await requireCommunity(communityId);
    const member = await requireCommunityPermission(community, actor, ['owner', 'admin']);
    const nextCategory = payload.category === undefined ? community.category : sanitizeCommunityCategory(payload.category);
    const updates = {
      name: payload.name === undefined ? community.name : sanitizeCommunityName(payload.name),
      description: payload.description === undefined ? community.description : sanitizeCommunityDescription(payload.description),
      ...createCategorySnapshot(payload.category === undefined ? community.legacyCategory || nextCategory : nextCategory),
      visibility: payload.visibility === undefined ? community.visibility : sanitizeCommunityVisibility(payload.visibility),
      avatar: payload.avatar === undefined ? community.avatar : sanitizeCommunityAvatar(payload.avatar),
      coverTheme:
        payload.coverTheme === undefined ? community.coverTheme : await sanitizeOwnedCoverTheme(community.ownerUserId, payload.coverTheme),
      rules: payload.rules === undefined ? community.rules : sanitizeCommunityRules(payload.rules) || getCategoryRuleText(nextCategory),
      tags: payload.tags === undefined ? community.tags : sanitizeCommunityTags(payload.tags),
      updatedAt: new Date().toISOString(),
    };

    if (payload.slug !== undefined && member.role === 'owner') {
      const nextSlug = sanitizeCommunitySlug(payload.slug, updates.name);

      if (nextSlug !== community.slug && (await isSlugTaken(nextSlug))) {
        throw new Error('Community slug is already taken.');
      }

      updates.slug = nextSlug;
    }

    Object.assign(community, updates);
    await communityRepository.update?.(community.communityId, community);
    await addActivity(community.communityId, 'system_notice', actor, { action: 'community_updated' });
    return toPublicCommunity(community);
  }

  async function deleteCommunity(communityId, actor) {
    const community = await requireCommunity(communityId);

    if (!isCommunityOwner(community, actor)) {
      throw new Error('Only the community owner can delete this community.');
    }

    const deletedAt = new Date().toISOString();
    community.deletedAt = deletedAt;
    community.updatedAt = deletedAt;
    await communityRepository.softDelete?.(community.communityId, deletedAt);
    await addActivity(community.communityId, 'community_deleted', actor, { name: community.name });
    return toPublicCommunity(community);
  }

  async function deleteCommunityAsAdmin(communityId, actor = { admin: true, displayName: 'Admin' }) {
    const community = await requireCommunity(communityId);
    const deletedAt = new Date().toISOString();
    community.deletedAt = deletedAt;
    community.updatedAt = deletedAt;
    await communityRepository.softDelete?.(community.communityId, deletedAt);
    await addActivity(community.communityId, 'community_deleted', { ...actor, admin: true }, { name: community.name });
    return toPublicCommunity(community);
  }

  async function joinCommunity(communityId, user) {
    requireLoggedIn(user);
    const community = await requireCommunity(communityId);
    const existing = await getMemberRecord(community, user);
    enforceCommunityBan(existing);

    if (community.visibility === 'private' && !existing) {
      throw new Error('This community is private.');
    }

    const now = new Date().toISOString();
    const member = normalizeMember({
      ...(existing || {}),
      memberId: memberIdFor(user),
      communityId: community.communityId,
      userId: user.userId,
      sessionId: user.sessionId,
      displayName: user.displayName,
      avatar: user.avatar,
      role: existing?.role || 'member',
      joinedAt: existing?.joinedAt || now,
      lastVisitedAt: now,
      bannedUntil: existing?.bannedUntil || null,
    });

    upsertNested(communityMembers, community.communityId, member.memberId, member);
    await communityMemberRepository.upsert?.(community.communityId, member);

    if (!existing) {
      community.memberCountSnapshot = Number(community.memberCountSnapshot || 0) + 1;
      await communityRepository.update?.(community.communityId, community);
      await addActivity(community.communityId, 'member_joined', user, { displayName: user.displayName });
    }

    return { community: toPublicCommunity(community), membership: serializeMember(member) };
  }

  async function leaveCommunity(communityId, user) {
    requireLoggedIn(user);
    const community = await requireCommunity(communityId);

    if (isCommunityOwner(community, user)) {
      throw new Error('Transfer or delete the community before leaving as owner.');
    }

    const member = await getMemberRecord(community, user);

    if (member) {
      await communityMemberRepository.remove?.(community.communityId, member.memberId);
      deleteNested(communityMembers, community.communityId, member.memberId);
      community.memberCountSnapshot = Math.max(0, Number(community.memberCountSnapshot || 1) - 1);
      await communityRepository.update?.(community.communityId, community);
      await addActivity(community.communityId, 'member_left', user, { displayName: user.displayName });
    }

    return { communityId: community.communityId, left: true };
  }

  async function setFavorite(communityId, user, isFavorite) {
    requireLoggedIn(user);
    const community = await requireCommunity(communityId);
    const member = (await getMemberRecord(community, user)) || (await joinCommunity(communityId, user)).membership;
    const updates = {
      ...(member.memberId ? member : await getMemberRecord(community, user)),
      isFavorite: Boolean(isFavorite),
      lastVisitedAt: new Date().toISOString(),
    };
    await communityMemberRepository.upsert?.(community.communityId, normalizeMember(updates));
    upsertNested(communityMembers, community.communityId, updates.memberId, normalizeMember(updates));
    return { communityId: community.communityId, isFavorite: Boolean(isFavorite) };
  }

  async function listMembers(communityId, actor = null) {
    const community = await requireCommunity(communityId);
    const member = actor?.userId ? await getMemberRecord(community, actor) : null;

    if (community.visibility === 'private' && !member && !isCommunityOwner(community, actor) && !actor?.admin) {
      throw new Error('This community is private.');
    }

    const members = await communityMemberRepository.listByCommunity?.(community.communityId, CHAT_LIMITS.MAX_COMMUNITY_MEMBERS_LOAD);
    const memoryMembers = [...(communityMembers.get(community.communityId)?.values() || [])];
    return dedupeById([...(members || []), ...memoryMembers], 'memberId')
      .slice(0, CHAT_LIMITS.MAX_COMMUNITY_MEMBERS_LOAD)
      .map(serializeMember);
  }

  async function setMemberRole(communityId, actor, targetMemberId, role) {
    const community = await requireCommunity(communityId);
    await requireCommunityPermission(community, actor, ['owner']);
    const target = await getCommunityMemberById(community.communityId, targetMemberId);
    const cleanRole = sanitizeCommunityRole(role);

    if (target.role === 'owner' || cleanRole === 'owner') {
      throw new Error('Community ownership cannot be changed here.');
    }

    if (!target.userId && ['admin', 'moderator'].includes(cleanRole)) {
      throw new Error('Guest members cannot receive durable community staff roles.');
    }

    target.role = cleanRole;
    target.updatedAt = new Date().toISOString();
    await communityMemberRepository.updateRole?.(community.communityId, target.memberId, cleanRole);
    upsertNested(communityMembers, community.communityId, target.memberId, target);
    await addActivity(community.communityId, 'role_changed', actor, { target: target.displayName, role: cleanRole });
    return serializeMember(target);
  }

  async function removeMember(communityId, actor, targetMemberId) {
    const community = await requireCommunity(communityId);
    const actorMember = await requireCommunityPermission(community, actor, ['owner', 'admin', 'moderator']);
    const target = await getCommunityMemberById(community.communityId, targetMemberId);
    assertCanModerateCommunityMember(actorMember, target);
    await communityMemberRepository.remove?.(community.communityId, target.memberId);
    deleteNested(communityMembers, community.communityId, target.memberId);
    await addActivity(community.communityId, 'moderation_action', actor, { action: 'remove_member', target: target.displayName });
    return serializeMember(target);
  }

  async function banMember(communityId, actor, targetMemberId, payload = {}) {
    const community = await requireCommunity(communityId);
    const actorMember = await requireCommunityPermission(community, actor, ['owner', 'admin', 'moderator']);
    const target = await getCommunityMemberById(community.communityId, targetMemberId);
    assertCanModerateCommunityMember(actorMember, target);
    const bannedUntil = resolveBanUntil(payload.duration || '24h');
    const updates = {
      bannedUntil,
      banReason: sanitizeReportDetails(payload.reason),
      banActionBy: actorRef(actor),
      banCreatedAt: new Date().toISOString(),
    };
    Object.assign(target, updates);
    await communityMemberRepository.updateModeration?.(community.communityId, target.memberId, updates);
    upsertNested(communityMembers, community.communityId, target.memberId, target);
    await addActivity(community.communityId, 'moderation_action', actor, { action: 'ban_member', target: target.displayName });
    return serializeMember(target);
  }

  async function unbanMember(communityId, actor, targetMemberId) {
    const community = await requireCommunity(communityId);
    await requireCommunityPermission(community, actor, ['owner', 'admin']);
    const target = await getCommunityMemberById(community.communityId, targetMemberId);
    Object.assign(target, { bannedUntil: null, banReason: '', banActionBy: null, banCreatedAt: null });
    await communityMemberRepository.updateModeration?.(community.communityId, target.memberId, {
      bannedUntil: null,
      banReason: '',
      banActionBy: null,
      banCreatedAt: null,
    });
    upsertNested(communityMembers, community.communityId, target.memberId, target);
    await addActivity(community.communityId, 'moderation_action', actor, { action: 'unban_member', target: target.displayName });
    return serializeMember(target);
  }

  async function prepareRoomCreate(actor, payload = {}) {
    if (!payload.communityId) {
      return {};
    }

    const community = await requireCommunity(payload.communityId);
    const member = await requireCommunityPermission(community, actor, ['owner', 'admin']);
    const limits = await getLimits(community.ownerUserId);
    const rooms = await listCommunityRooms(community.communityId);

    if (rooms.length >= limits.roomsPerCommunity) {
      throw new Error('Community room limit reached for this plan.');
    }

    return {
      communityId: community.communityId,
      communityName: community.name,
      communityRoleContext: member.role,
      roomPurpose: sanitizeRoomPurpose(payload.roomPurpose),
    };
  }

  async function attachRoom(room, actor) {
    if (!room?.communityId) {
      return null;
    }

    const community = await requireCommunity(room.communityId);
    const summary = toCommunityRoomSummary(room, community);
    upsertNested(communityRooms, community.communityId, summary.roomId, summary);
    await communityRoomRepository.upsert?.(community.communityId, summary);
    community.roomCountSnapshot = Math.max(Number(community.roomCountSnapshot || 0), (await listCommunityRooms(community.communityId)).length || 1);
    community.lastActiveAt = new Date().toISOString();
    await communityRepository.update?.(community.communityId, community);
    await addActivity(community.communityId, 'room_created', actor, { roomId: room.roomId, title: room.title });
    return summary;
  }

  async function validateRoomJoin(room, user) {
    if (room?.communityId) {
      const community = await requireCommunity(room.communityId);
      const member = user?.userId ? await getMemberRecord(community, user) : await getGuestCommunityRecord(community, user);

      if (community.visibility === 'private' && !member && !isCommunityOwner(community, user)) {
        throw new Error('Join the private community before entering this room.');
      }

      enforceCommunityBan(member);
    }

    if (room?.eventRoomId) {
      const event = await getEvent(room.eventRoomId);

      const status = resolveEventStatus(event);

      if (status === 'cancelled') {
        throw new Error('This event was cancelled.');
      }

      if (status === 'ended' && event.afterEndBehavior === 'closed') {
        throw new Error('This event room has ended.');
      }
    }
  }

  async function validateRoomMessage(room, user) {
    await validateRoomJoin(room, user);

    if (!room?.eventRoomId) {
      return;
    }

    const event = await getEvent(room.eventRoomId);
    const status = resolveEventStatus(event);

    if (status === 'scheduled') {
      throw new Error('This event has not started yet.');
    }

    if (status === 'ended' || status === 'cancelled') {
      throw new Error('This event is read-only now.');
    }
  }

  async function listCommunityRooms(communityId) {
    const cleanCommunityId = sanitizeIdentifier(communityId, 'Community');
    const rooms = await communityRoomRepository.listByCommunity?.(
      cleanCommunityId,
      CHAT_LIMITS.MAX_COMMUNITY_ROOMS_LOAD,
    );
    const memoryRooms = [...(communityRooms.get(cleanCommunityId)?.values() || [])];
    return dedupeById([...(rooms || []), ...memoryRooms], 'roomId')
      .slice(0, CHAT_LIMITS.MAX_COMMUNITY_ROOMS_LOAD)
      .map(serializeCommunityRoom);
  }

  async function createEvent(actor, payload = {}, roomService) {
    requireLoggedIn(actor);
    const community = payload.communityId ? await requireCommunity(payload.communityId) : null;

    if (community) {
      await requireCommunityPermission(community, actor, ['owner', 'admin']);
    }

    const limits = await getLimits(actor.userId);
    const activeEvents = dedupeById(
      [
        ...((await eventRepository.listByHost?.(actor.userId, CHAT_LIMITS.MAX_EVENTS_LOAD)) || []),
        ...[...events.values()].filter((event) => event.hostUserId === actor.userId),
      ],
      'eventId',
    );

    if (activeEvents.filter((event) => ['scheduled', 'live'].includes(resolveEventStatus(event))).length >= limits.activeEventRooms) {
      throw new Error('Active event room limit reached for your current plan.');
    }

    const eventId = createId('evt');
    const times = sanitizeEventTimes(payload.startsAt, payload.endsAt);
    const title = sanitizeEventTitle(payload.title);
    const category = sanitizeCategory(payload.category || community?.category);
    const room = await roomService.createRoom({
      title,
      type: payload.visibility === 'private' ? 'private' : 'public',
      category,
      owner: actor,
      communityId: community?.communityId || '',
      communityName: community?.name || '',
      roomPurpose: sanitizeRoomPurpose(payload.roomPurpose || 'Event chat'),
      eventRoomId: eventId,
    });
    const now = new Date().toISOString();
    const event = normalizeEvent({
      eventId,
      roomId: room.roomId,
      communityId: community?.communityId || '',
      title,
      description: sanitizeEventDescription(payload.description),
      startsAt: times.startsAt,
      endsAt: times.endsAt,
      status: resolveEventStatus({ startsAt: times.startsAt, endsAt: times.endsAt, status: 'scheduled' }),
      hostUserId: actor.userId,
      hostName: actor.displayName,
      category,
      visibility: payload.visibility === 'private' ? 'private' : 'public',
      maxMembers: Math.min(Number(payload.maxMembers || limits.roomMembers), limits.roomMembers),
      rsvpCapacity: limits.eventRsvpCapacity,
      reminderEnabled: payload.reminderEnabled !== false,
      afterEndBehavior: payload.afterEndBehavior === 'closed' ? 'closed' : 'read_only',
      createdAt: now,
      updatedAt: now,
    });
    events.set(event.eventId, event);
    await eventRepository.save?.(event);

    if (community) {
      await attachRoom(room, actor);
      await addActivity(community.communityId, 'event_created', actor, { eventId: event.eventId, title: event.title });
    }

    return { event: serializeEvent(event), room };
  }

  async function listEvents(filters = {}) {
    const persisted = filters.communityId
      ? await eventRepository.listByCommunity?.(filters.communityId, CHAT_LIMITS.MAX_EVENTS_LOAD)
      : await eventRepository.listRecent?.(CHAT_LIMITS.MAX_EVENTS_LOAD);
    hydrateEvents(events, persisted);
    return [...events.values()]
      .filter((event) => !filters.communityId || event.communityId === filters.communityId)
      .filter((event) => filters.includePrivate || event.visibility !== 'private')
      .filter((event) => filters.includeCancelled || event.status !== 'cancelled')
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .slice(0, CHAT_LIMITS.MAX_EVENTS_LOAD)
      .map(serializeEvent);
  }

  async function getEvent(eventId) {
    const cleanEventId = sanitizeIdentifier(eventId, 'Event');
    const event = events.get(cleanEventId) || normalizeEvent(await eventRepository.get?.(cleanEventId));

    if (event?.eventId) {
      events.set(event.eventId, event);
      return event;
    }

    return null;
  }

  async function updateEvent(eventId, actor, payload = {}) {
    const event = await requireEvent(eventId);
    await requireEventManager(event, actor);
    const times =
      payload.startsAt || payload.endsAt
        ? sanitizeEventTimes(payload.startsAt || event.startsAt, payload.endsAt || event.endsAt)
        : { startsAt: event.startsAt, endsAt: event.endsAt };
    Object.assign(event, {
      title: payload.title === undefined ? event.title : sanitizeEventTitle(payload.title),
      description: payload.description === undefined ? event.description : sanitizeEventDescription(payload.description),
      startsAt: times.startsAt,
      endsAt: times.endsAt,
      status: sanitizeEventStatus(payload.status || resolveEventStatus(event)),
      reminderEnabled: payload.reminderEnabled === undefined ? event.reminderEnabled : Boolean(payload.reminderEnabled),
      updatedAt: new Date().toISOString(),
    });
    await eventRepository.update?.(event.eventId, event);
    return serializeEvent(event);
  }

  async function cancelEvent(eventId, actor) {
    const event = await requireEvent(eventId);
    await requireEventManager(event, actor);
    event.status = 'cancelled';
    event.updatedAt = new Date().toISOString();
    await eventRepository.update?.(event.eventId, event);

    if (event.communityId) {
      await addActivity(event.communityId, 'event_cancelled', actor, { eventId: event.eventId, title: event.title });
    }

    return serializeEvent(event);
  }

  async function setRsvp(eventId, actor, status) {
    requireLoggedIn(actor);
    const event = await requireEvent(eventId);
    const cleanStatus = sanitizeRsvpStatus(status);
    const memoryCount = [...(eventRsvps.get(event.eventId)?.values() || [])].filter((item) => item.status !== 'cancelled').length;
    const count = Math.max(Number((await rsvpRepository.countByEvent?.(event.eventId)) || 0), memoryCount);

    if (cleanStatus !== 'cancelled' && count >= Number(event.rsvpCapacity || CHAT_LIMITS.MAX_RSVP_LOAD)) {
      throw new Error('This event RSVP list is full.');
    }

    const now = new Date().toISOString();
    const rsvp = {
      userId: actor.userId,
      eventId: event.eventId,
      status: cleanStatus,
      createdAt: now,
      updatedAt: now,
    };
    upsertNested(eventRsvps, event.eventId, actor.userId, rsvp);
    await rsvpRepository.upsert?.(event.eventId, rsvp);
    return rsvp;
  }

  async function createScheduledAnnouncement(actor, payload = {}, roomService) {
    requireLoggedIn(actor);
    const targetType = sanitizeScheduledAnnouncementTarget(payload.targetType);
    const targetId = sanitizeIdentifier(payload.targetId, 'Announcement target');

    await requireAnnouncementPermission(targetType, targetId, actor, roomService);

    const limits = await getLimits(actor.userId);
    const scheduledFor = new Date(payload.scheduledFor).getTime();

    if (!Number.isFinite(scheduledFor)) {
      throw new Error('Scheduled time is invalid.');
    }

    const existing = dedupeById(
      [
        ...((await scheduledAnnouncementRepository.listByCreator?.(
          actor.userId,
          CHAT_LIMITS.MAX_SCHEDULED_ANNOUNCEMENTS_LOAD,
        )) || []),
        ...[...scheduledAnnouncements.values()].filter((item) => item.createdByUserId === actor.userId),
      ],
      'announcementId',
    );

    if (existing.filter((item) => item.publishStatus === 'scheduled').length >= limits.scheduledAnnouncements) {
      throw new Error('Scheduled announcement limit reached for your current plan.');
    }

    const now = new Date().toISOString();
    const announcement = normalizeScheduledAnnouncement({
      announcementId: createId('sch'),
      targetType,
      targetId,
      title: sanitizeScheduledAnnouncementTitle(payload.title),
      body: sanitizeScheduledAnnouncementBody(payload.body),
      createdByUserId: actor.userId,
      createdBySessionId: actor.sessionId,
      createdByName: actor.displayName,
      createdAt: now,
      updatedAt: now,
      scheduledFor: new Date(scheduledFor).toISOString(),
      publishStatus: sanitizeScheduledAnnouncementStatus(payload.publishStatus || 'scheduled'),
      publishedAt: null,
    });
    scheduledAnnouncements.set(announcement.announcementId, announcement);
    await scheduledAnnouncementRepository.save?.(announcement);
    return serializeScheduledAnnouncement(announcement);
  }

  async function listScheduledAnnouncements(actor, filters = {}) {
    requireLoggedIn(actor);
    const scheduled = await scheduledAnnouncementRepository.listByCreator?.(
      actor.userId,
      CHAT_LIMITS.MAX_SCHEDULED_ANNOUNCEMENTS_LOAD,
    );
    hydrateScheduled(scheduledAnnouncements, scheduled);
    return [...scheduledAnnouncements.values()]
      .filter((item) => item.createdByUserId === actor.userId)
      .filter((item) => !filters.status || item.publishStatus === filters.status)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, CHAT_LIMITS.MAX_SCHEDULED_ANNOUNCEMENTS_LOAD)
      .map(serializeScheduledAnnouncement);
  }

  async function updateScheduledAnnouncement(announcementId, actor, payload = {}, roomService) {
    const announcement = await requireScheduledAnnouncement(announcementId);

    if (announcement.createdByUserId !== actor.userId) {
      throw new Error('Only the creator can edit this scheduled announcement.');
    }

    if (announcement.publishStatus === 'published') {
      throw new Error('Published announcements cannot be edited.');
    }

    await requireAnnouncementPermission(announcement.targetType, announcement.targetId, actor, roomService);
    Object.assign(announcement, {
      title: payload.title === undefined ? announcement.title : sanitizeScheduledAnnouncementTitle(payload.title),
      body: payload.body === undefined ? announcement.body : sanitizeScheduledAnnouncementBody(payload.body),
      scheduledFor: payload.scheduledFor ? new Date(new Date(payload.scheduledFor).getTime()).toISOString() : announcement.scheduledFor,
      publishStatus:
        payload.publishStatus === undefined ? announcement.publishStatus : sanitizeScheduledAnnouncementStatus(payload.publishStatus),
      updatedAt: new Date().toISOString(),
    });
    await scheduledAnnouncementRepository.update?.(announcement.announcementId, announcement);
    return serializeScheduledAnnouncement(announcement);
  }

  async function cancelScheduledAnnouncement(announcementId, actor) {
    const announcement = await requireScheduledAnnouncement(announcementId);

    if (actor?.admin || announcement.createdByUserId === actor.userId) {
      announcement.publishStatus = 'cancelled';
      announcement.updatedAt = new Date().toISOString();
      await scheduledAnnouncementRepository.update?.(announcement.announcementId, announcement);
      return serializeScheduledAnnouncement(announcement);
    }

    throw new Error('Only the creator or admin can cancel this announcement.');
  }

  async function processSchedulers({ roomService, notificationService, emit = () => {} } = {}) {
    const now = new Date();
    const due = await scheduledAnnouncementRepository.listDue?.(
      now.toISOString(),
      CHAT_LIMITS.MAX_DUE_SCHEDULED_ANNOUNCEMENTS_PER_TICK,
    );
    hydrateScheduled(scheduledAnnouncements, due);
    const published = [];

    for (const announcement of [...scheduledAnnouncements.values()]
      .filter((item) => item.publishStatus === 'scheduled' && new Date(item.scheduledFor).getTime() <= now.getTime())
      .slice(0, CHAT_LIMITS.MAX_DUE_SCHEDULED_ANNOUNCEMENTS_PER_TICK)) {
      try {
        const result = await publishScheduledAnnouncement(announcement, roomService, notificationService, emit);
        published.push(result);
      } catch (error) {
        console.warn(`Scheduled announcement skipped safely. ${error instanceof Error ? error.message : 'Publish failed.'}`);
      }
    }

    const changedEvents = await processEventTransitions({ notificationService, emit });
    return { published, events: changedEvents };
  }

  async function publishScheduledAnnouncement(announcement, roomService, notificationService, emit) {
    const actor = {
      userId: announcement.createdByUserId,
      sessionId: announcement.createdBySessionId,
      displayName: announcement.createdByName,
    };
    let publishedTarget = null;

    if (announcement.targetType === 'room') {
      publishedTarget = await roomService.publishScheduledAnnouncement?.(announcement.targetId, actor, announcement);
      emit('scheduled-announcement:published', { announcement: serializeScheduledAnnouncement(announcement), roomId: announcement.targetId });
    } else if (announcement.targetType === 'community') {
      publishedTarget = await addCommunityAnnouncement(announcement.targetId, actor, announcement);
      emit('community:announcement', { communityId: announcement.targetId, announcement: publishedTarget });
      const members = await communityMemberRepository.listByCommunity?.(
        announcement.targetId,
        CHAT_LIMITS.MAX_COMMUNITY_MEMBERS_LOAD,
      );
      await Promise.all(
        (members || [])
          .filter((member) => member.userId && member.userId !== actor.userId)
          .slice(0, CHAT_LIMITS.MAX_UNREAD_FANOUT_PER_MESSAGE)
          .map((member) =>
            notificationService?.createNotification?.({
              userId: member.userId,
              type: 'community_announcement',
              title: announcement.title,
              body: announcement.body,
              targetView: 'community-home',
              metadata: {
                communityId: announcement.targetId,
                announcementId: publishedTarget.announcementId,
                ...toCategoryMetadata(community),
              },
            }),
          ),
      );
    } else if (announcement.targetType === 'event') {
      const event = await requireEvent(announcement.targetId);
      publishedTarget = { ...serializeScheduledAnnouncement(announcement), eventId: event.eventId };
      emit('event:update', { event: serializeEvent(event), announcement: publishedTarget });
    }

    announcement.publishStatus = 'published';
    announcement.publishedAt = new Date().toISOString();
    announcement.updatedAt = announcement.publishedAt;
    await scheduledAnnouncementRepository.update?.(announcement.announcementId, announcement);
    scheduledAnnouncements.set(announcement.announcementId, announcement);
    return { scheduled: serializeScheduledAnnouncement(announcement), publishedTarget };
  }

  async function processEventTransitions({ notificationService, emit }) {
    const persisted = await eventRepository.listRecent?.(CHAT_LIMITS.MAX_EVENTS_LOAD);
    hydrateEvents(events, persisted);
    const changed = [];

    for (const event of [...events.values()]) {
      if (event.status === 'cancelled') {
        continue;
      }

      const nextStatus = resolveEventStatus(event);

      if (nextStatus !== event.status) {
        event.status = nextStatus;
        event.updatedAt = new Date().toISOString();
        await eventRepository.update?.(event.eventId, event);
        emit('event:update', { event: serializeEvent(event) });
        changed.push(serializeEvent(event));

        if (nextStatus === 'live') {
          await notifyEventRsvps(notificationService, event, 'event_live', `${event.title} is live now`);
        }
      }
    }

    return changed;
  }

  async function getAdminOverview() {
    const [communityList, eventList, scheduledList, activity] = await Promise.all([
      communityRepository.listActive?.(100),
      eventRepository.listRecent?.(100),
      scheduledAnnouncementRepository.listRecent?.(100),
      communityActivityRepository.listRecent?.(100),
    ]);
    hydrateCommunities(communities, communityList);
    hydrateEvents(events, eventList);
    hydrateScheduled(scheduledAnnouncements, scheduledList);

    return {
      communities: (communityList?.length ? communityList : [...communities.values()]).map(toPublicCommunity),
      events: (eventList?.length ? eventList : [...events.values()]).map(serializeEvent),
      scheduledAnnouncements: (scheduledList?.length ? scheduledList : [...scheduledAnnouncements.values()]).map(serializeScheduledAnnouncement),
      activity: (activity?.length ? activity : [...communityActivities.values()].flat())
        .slice(0, CHAT_LIMITS.MAX_COMMUNITY_ACTIVITY_LOAD)
        .map(serializeActivity),
    };
  }

  async function getAdminCommunity(communityId) {
    const admin = { userId: '__admin__', admin: true, displayName: 'Admin' };
    const details = await getCommunity(communityId, admin);
    return {
      ...details,
      members: await listMembers(communityId, admin),
    };
  }

  async function listCommunityActivity(communityId) {
    const community = await requireCommunity(communityId);
    const activity = await communityActivityRepository.listByCommunity?.(
      community.communityId,
      CHAT_LIMITS.MAX_COMMUNITY_ACTIVITY_LOAD,
    );
    const memoryActivity = communityActivities.get(community.communityId) || [];
    return dedupeById([...(activity || []), ...memoryActivity], 'activityId')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, CHAT_LIMITS.MAX_COMMUNITY_ACTIVITY_LOAD)
      .map(serializeActivity);
  }

  async function listCommunityAnnouncements(communityId) {
    const community = await requireCommunity(communityId);
    const announcements = await communityAnnouncementRepository.listRecent?.(
      community.communityId,
      CHAT_LIMITS.MAX_COMMUNITY_ANNOUNCEMENTS_LOAD,
    );
    const memoryAnnouncements = [...(communityAnnouncements.get(community.communityId)?.values() || [])];
    return dedupeById([...(announcements || []), ...memoryAnnouncements], 'announcementId')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, CHAT_LIMITS.MAX_COMMUNITY_ANNOUNCEMENTS_LOAD)
      .map(serializeAnnouncement);
  }

  async function addCommunityAnnouncement(communityId, actor, payload = {}) {
    const community = await requireCommunity(communityId);
    const now = new Date().toISOString();
    const announcement = serializeAnnouncement({
      announcementId: createId('cann'),
      communityId: community.communityId,
      title: sanitizeScheduledAnnouncementTitle(payload.title),
      body: sanitizeScheduledAnnouncementBody(payload.body),
      createdByUserId: actor.userId || null,
      createdBySessionId: actor.sessionId || '',
      createdByName: actor.displayName || 'Nexus',
      createdAt: now,
      active: true,
      publishStatus: 'published',
    });
    upsertNested(communityAnnouncements, community.communityId, announcement.announcementId, announcement);
    await communityAnnouncementRepository.create?.(community.communityId, announcement);
    await addActivity(community.communityId, 'announcement_posted', actor, { title: announcement.title });
    return announcement;
  }

  async function addActivity(communityId, type, actor, metadata = {}) {
    const cleanType = COMMUNITY_ACTIVITY_TYPES.includes(type) ? sanitizeCommunityActivityType(type) : 'system_notice';
    const activity = serializeActivity({
      activityId: createId('cact'),
      communityId,
      type: cleanType,
      actorUserId: actor?.userId || null,
      actorSessionId: actor?.sessionId || '',
      actorName: actor?.displayName || 'Nexus',
      createdAt: new Date().toISOString(),
      metadata: sanitizeMetadata(metadata),
    });
    const current = communityActivities.get(communityId) || [];
    communityActivities.set(communityId, [activity, ...current].slice(0, CHAT_LIMITS.MAX_COMMUNITY_ACTIVITY_LOAD));
    await communityActivityRepository.create?.(communityId, activity);
    return activity;
  }

  return {
    addActivity,
    attachRoom,
    banMember,
    cancelEvent,
    cancelScheduledAnnouncement,
    createCommunity,
    createEvent,
    createScheduledAnnouncement,
    deleteCommunity,
    deleteCommunityAsAdmin,
    getAdminCommunity,
    getAdminOverview,
    getCommunity,
    getEvent,
    initializeFromPersistence,
    joinCommunity,
    leaveCommunity,
    listCommunities,
    listCommunityActivity,
    listCommunityAnnouncements,
    listCommunityRooms,
    listEvents,
    listMembers,
    listScheduledAnnouncements,
    prepareRoomCreate,
    processSchedulers,
    removeMember,
    setFavorite,
    setMemberRole,
    setRsvp,
    unbanMember,
    updateCommunity,
    updateEvent,
    updateScheduledAnnouncement,
    validateRoomJoin,
    validateRoomMessage,
  };

  async function requireCommunity(communityId) {
    const community = await findOrLoadCommunity(communityId);

    if (!community || community.deletedAt) {
      throw new Error('Community not found.');
    }

    return community;
  }

  async function findOrLoadCommunity(identifier) {
    const text = String(identifier || '').trim();

    if (!text) {
      return null;
    }

    const byMemory =
      communities.get(text) ||
      [...communities.values()].find((community) => community.slug === text || community.communityId === text);

    if (byMemory) {
      return byMemory;
    }

    const persisted = (await communityRepository.get?.(text)) || (await communityRepository.findBySlug?.(text));

    if (!persisted?.communityId) {
      return null;
    }

    const community = normalizeCommunity(persisted);
    communities.set(community.communityId, community);
    return community;
  }

  async function requireEvent(eventId) {
    const event = await getEvent(eventId);

    if (!event?.eventId) {
      throw new Error('Event not found.');
    }

    return event;
  }

  async function requireScheduledAnnouncement(announcementId) {
    const cleanId = sanitizeIdentifier(announcementId, 'Scheduled announcement');
    const announcement =
      scheduledAnnouncements.get(cleanId) || normalizeScheduledAnnouncement(await scheduledAnnouncementRepository.get?.(cleanId));

    if (!announcement?.announcementId) {
      throw new Error('Scheduled announcement not found.');
    }

    scheduledAnnouncements.set(announcement.announcementId, announcement);
    return announcement;
  }

  async function requireAnnouncementPermission(targetType, targetId, actor, roomService) {
    if (targetType === 'community') {
      const community = await requireCommunity(targetId);
      await requireCommunityPermission(community, actor, ['owner', 'admin', 'moderator']);
      return;
    }

    if (targetType === 'event') {
      const event = await requireEvent(targetId);
      await requireEventManager(event, actor);
      return;
    }

    const room = await roomService.findOrLoadRoom?.(targetId);

    if (!room) {
      throw new Error('Target room was not found.');
    }

    if (room.ownerUserId !== actor.userId && room.ownerSessionId !== actor.sessionId) {
      throw new Error('Only the room owner can schedule room announcements.');
    }
  }

  async function requireEventManager(event, actor) {
    if (actor?.admin) {
      return true;
    }

    if (event.hostUserId === actor?.userId) {
      return true;
    }

    if (event.communityId) {
      const community = await requireCommunity(event.communityId);
      await requireCommunityPermission(community, actor, ['owner', 'admin']);
      return true;
    }

    throw new Error('Only the event host can manage this event.');
  }

  async function requireCommunityPermission(community, actor, allowedRoles) {
    if (actor?.admin) {
      return { role: 'owner', userId: actor.userId || 'admin', memberId: 'admin' };
    }

    if (!actor?.userId) {
      throw new Error('Account login is required for this community action.');
    }

    const member = await getMemberRecord(community, actor);

    if (!member) {
      throw new Error('Join the community before doing that.');
    }

    enforceCommunityBan(member);

    if (!allowedRoles.includes(member.role)) {
      throw new Error('Community permissions are not high enough.');
    }

    return member;
  }

  async function getMemberRecord(community, user) {
    if (!user?.userId) {
      return null;
    }

    const memberId = memberIdFor(user);
    const record = (await communityMemberRepository.get?.(community.communityId, memberId)) ||
      communityMembers.get(community.communityId)?.get(memberId);
    return record ? normalizeMember(record) : null;
  }

  async function getGuestCommunityRecord(community, user) {
    if (!user?.sessionId) {
      return null;
    }

    const memberId = memberIdFor(user);
    const record = (await communityMemberRepository.get?.(community.communityId, memberId)) ||
      communityMembers.get(community.communityId)?.get(memberId);
    return record ? normalizeMember(record) : null;
  }

  async function getCommunityMemberById(communityId, memberId) {
    const cleanMemberId = sanitizeIdentifier(memberId, 'Community member');
    const record = (await communityMemberRepository.get?.(communityId, cleanMemberId)) ||
      communityMembers.get(communityId)?.get(cleanMemberId);

    if (!record) {
      throw new Error('Community member not found.');
    }

    return normalizeMember(record);
  }

  async function countOwnedCommunities(userId) {
    const persisted = await communityRepository.listByOwner?.(userId, CHAT_LIMITS.MAX_COMMUNITIES_LOAD);
    hydrateCommunities(communities, persisted);
    return [...communities.values()].filter((community) => community.ownerUserId === userId && !community.deletedAt).length;
  }

  async function isSlugTaken(slug) {
    const fromMemory = [...communities.values()].some((community) => community.slug === slug && !community.deletedAt);
    return fromMemory || Boolean(await communityRepository.findBySlug?.(slug));
  }

  async function getLimits(userId) {
    return userId ? (await entitlementService?.getFeatureLimits?.(userId)) || getPlanLimits('free') : getPlanLimits('free');
  }

  async function sanitizeOwnedCoverTheme(userId, value) {
    const theme = sanitizeCoverTheme(value);
    const limits = await getLimits(userId);

    if (!limits.communityCoverThemes?.includes(theme)) {
      throw new Error('That community cover theme requires a higher plan.');
    }

    return theme;
  }
}

function normalizeCommunity(community = {}) {
  const categorySnapshot = createCategorySnapshot(community.legacyCategory || community.categorySlug || community.category || 'random');
  return {
    communityId: community.communityId || createId('com'),
    slug: community.slug || community.communityId || '',
    name: community.name || 'Nexus Community',
    description: community.description || '',
    ...categorySnapshot,
    visibility: community.visibility || 'public',
    ownerUserId: community.ownerUserId || '',
    ownerName: community.ownerName || 'Nexus Host',
    avatar: community.avatar || 'nexus',
    coverTheme: community.coverTheme || 'classic',
    createdAt: community.createdAt || new Date().toISOString(),
    updatedAt: community.updatedAt || community.createdAt || new Date().toISOString(),
    lastActiveAt: community.lastActiveAt || community.updatedAt || community.createdAt || new Date().toISOString(),
    deletedAt: community.deletedAt || null,
    memberCountSnapshot: Number(community.memberCountSnapshot || 0),
    roomCountSnapshot: Number(community.roomCountSnapshot || 0),
    rules: community.rules || getCategoryRuleText(categorySnapshot.categorySlug),
    tags: Array.isArray(community.tags) ? community.tags.slice(0, CHAT_LIMITS.MAX_COMMUNITY_TAGS).map(String) : [],
    planRequired: community.planRequired || '',
    featuredUntil: community.featuredUntil || null,
    safetyLevel: community.safetyLevel || 'standard',
  };
}

function toPublicCommunity(community) {
  const categorySnapshot = createCategorySnapshot(community.legacyCategory || community.categorySlug || community.category || 'random');
  return {
    communityId: community.communityId,
    slug: community.slug,
    name: community.name,
    description: community.description,
    ...categorySnapshot,
    visibility: community.visibility,
    ownerUserId: community.ownerUserId,
    ownerName: community.ownerName,
    avatar: community.avatar,
    coverTheme: community.coverTheme,
    createdAt: community.createdAt,
    updatedAt: community.updatedAt,
    lastActiveAt: community.lastActiveAt,
    deletedAt: community.deletedAt || null,
    memberCountSnapshot: Number(community.memberCountSnapshot || 0),
    roomCountSnapshot: Number(community.roomCountSnapshot || 0),
    rules: community.rules || getCategoryRuleText(categorySnapshot.categorySlug),
    tags: community.tags || [],
    featuredUntil: community.featuredUntil || null,
    safetyLevel: community.safetyLevel || 'standard',
  };
}

function normalizeMember(member = {}) {
  return {
    memberId: member.memberId || memberIdFor(member),
    communityId: member.communityId || '',
    userId: member.userId || null,
    sessionId: member.sessionId || '',
    displayName: member.displayName || 'Member',
    avatar: member.avatar || 'nexus',
    role: COMMUNITY_ROLES.includes(member.role) ? member.role : 'member',
    joinedAt: member.joinedAt || new Date().toISOString(),
    lastVisitedAt: member.lastVisitedAt || member.joinedAt || new Date().toISOString(),
    isFavorite: Boolean(member.isFavorite),
    bannedUntil: member.bannedUntil || null,
    banReason: member.banReason || '',
    banActionBy: member.banActionBy || null,
    banCreatedAt: member.banCreatedAt || null,
  };
}

function serializeMember(member = {}) {
  return {
    memberId: member.memberId,
    communityId: member.communityId,
    userId: member.userId || null,
    sessionId: member.sessionId || '',
    displayName: member.displayName || 'Member',
    avatar: member.avatar || 'nexus',
    role: member.role || 'member',
    joinedAt: member.joinedAt || null,
    lastVisitedAt: member.lastVisitedAt || null,
    isFavorite: Boolean(member.isFavorite),
    bannedUntil: member.bannedUntil || null,
    banReason: member.banReason || '',
  };
}

function normalizeEvent(event = {}) {
  if (!event) {
    return null;
  }

  const categorySnapshot = createCategorySnapshot(event.categorySlug || event.category || 'random');
  return {
    eventId: event.eventId || createId('evt'),
    roomId: event.roomId || '',
    communityId: event.communityId || '',
    title: event.title || 'Nexus Event',
    description: event.description || '',
    startsAt: event.startsAt || new Date().toISOString(),
    endsAt: event.endsAt || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    status: sanitizeEventStatus(event.status || 'scheduled'),
    hostUserId: event.hostUserId || '',
    hostName: event.hostName || 'Host',
    ...categorySnapshot,
    visibility: event.visibility === 'private' ? 'private' : 'public',
    maxMembers: Number(event.maxMembers || 50),
    rsvpCapacity: Number(event.rsvpCapacity || 50),
    reminderEnabled: event.reminderEnabled !== false,
    afterEndBehavior: event.afterEndBehavior === 'closed' ? 'closed' : 'read_only',
    createdAt: event.createdAt || new Date().toISOString(),
    updatedAt: event.updatedAt || event.createdAt || new Date().toISOString(),
  };
}

function serializeEvent(event) {
  const status = resolveEventStatus(event);
  return {
    ...event,
    ...createCategorySnapshot(event.categorySlug || event.category || 'random'),
    status: event.status === 'cancelled' ? 'cancelled' : status,
  };
}

function normalizeScheduledAnnouncement(announcement = {}) {
  if (!announcement) {
    return null;
  }

  return {
    announcementId: announcement.announcementId || createId('sch'),
    targetType: announcement.targetType || 'community',
    targetId: announcement.targetId || '',
    title: announcement.title || 'Announcement',
    body: announcement.body || '',
    createdByUserId: announcement.createdByUserId || null,
    createdBySessionId: announcement.createdBySessionId || '',
    createdByName: announcement.createdByName || 'Nexus',
    createdAt: announcement.createdAt || new Date().toISOString(),
    updatedAt: announcement.updatedAt || announcement.createdAt || new Date().toISOString(),
    scheduledFor: announcement.scheduledFor || new Date().toISOString(),
    publishStatus: announcement.publishStatus || 'scheduled',
    publishedAt: announcement.publishedAt || null,
  };
}

function serializeScheduledAnnouncement(announcement) {
  return { ...announcement };
}

function serializeAnnouncement(announcement = {}) {
  return {
    announcementId: announcement.announcementId,
    communityId: announcement.communityId || '',
    title: announcement.title || 'Announcement',
    body: announcement.body || '',
    createdByUserId: announcement.createdByUserId || null,
    createdBySessionId: announcement.createdBySessionId || '',
    createdByName: announcement.createdByName || 'Nexus',
    createdAt: announcement.createdAt || new Date().toISOString(),
    active: announcement.active !== false,
    publishStatus: announcement.publishStatus || 'published',
  };
}

function serializeActivity(activity = {}) {
  return {
    activityId: activity.activityId || createId('cact'),
    communityId: activity.communityId || '',
    type: COMMUNITY_ACTIVITY_TYPES.includes(activity.type) ? activity.type : 'system_notice',
    actorUserId: activity.actorUserId || null,
    actorSessionId: activity.actorSessionId || '',
    actorName: activity.actorName || 'Nexus',
    createdAt: activity.createdAt || new Date().toISOString(),
    metadata: sanitizeMetadata(activity.metadata),
  };
}

function toCommunityRoomSummary(room, community) {
  return serializeCommunityRoom({
    roomId: room.roomId,
    inviteCode: room.inviteCode,
    communityId: community.communityId,
    communityName: community.name,
    title: room.title,
    type: room.type,
    category: room.category,
    categorySlug: room.categorySlug,
    roomPurpose: room.roomPurpose || '',
    eventRoomId: room.eventRoomId || '',
    ownerUserId: room.ownerUserId || null,
    ownerName: room.ownerName,
    createdAt: room.createdAt,
    lastActiveAt: room.lastActiveAt,
    memberCount: room.memberCount || 0,
    isLocked: Boolean(room.isLocked),
    expiresAt: room.expiresAt || null,
    themeId: room.themeId || 'classic',
  });
}

function serializeCommunityRoom(room = {}) {
  const categorySnapshot = createCategorySnapshot(room.categorySlug || room.category || 'random');
  return {
    roomId: room.roomId,
    inviteCode: room.inviteCode || '',
    communityId: room.communityId || '',
    communityName: room.communityName || '',
    title: room.title || 'Community Room',
    type: room.type || 'public',
    ...categorySnapshot,
    roomPurpose: room.roomPurpose || '',
    eventRoomId: room.eventRoomId || '',
    ownerUserId: room.ownerUserId || null,
    ownerName: room.ownerName || 'Host',
    createdAt: room.createdAt || new Date().toISOString(),
    lastActiveAt: room.lastActiveAt || room.createdAt || new Date().toISOString(),
    memberCount: Number(room.memberCount || room.memberCountSnapshot || 0),
    isLocked: Boolean(room.isLocked),
    expiresAt: room.expiresAt || null,
    themeId: room.themeId || 'classic',
  };
}

function createCategorySnapshot(category) {
  const config = getCategoryConfig(category);
  const legacyCategory = !isValidCategory(category) && String(category || '').trim()
    ? String(category).trim().slice(0, CHAT_LIMITS.MAX_CATEGORY_LENGTH)
    : '';
  return {
    category: config.label,
    categorySlug: getCategorySlug(config.slug),
    categoryLabel: config.label,
    categoryThemeClass: config.themeClass,
    categoryAccentClass: config.accentClass,
    categoryAnalyticsKey: getCategoryForAnalytics(config.slug),
    categoryFeatureHooks: getCategoryFeatureHooks(config.slug),
    legacyCategory,
  };
}

function getCategoryRuleText(category) {
  return getCategoryDefaultRules(category).join(' ');
}

function toCategoryMetadata(target = {}) {
  const category = getCategoryConfig(target.categorySlug || target.category || 'random');
  return {
    categorySlug: category.slug,
    categoryLabel: category.label,
    categoryAccent: category.accentClass,
    notificationGroup: category.notificationGroup,
  };
}

function sanitizeMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metadata)
      .slice(0, 10)
      .map(([key, value]) => [
        String(key).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40),
        typeof value === 'string' ? value.slice(0, 140) : typeof value === 'number' || typeof value === 'boolean' ? value : '',
      ]),
  );
}

function hydrateCommunities(map, communityList = []) {
  for (const community of communityList || []) {
    if (community?.communityId && !community.deletedAt) {
      map.set(community.communityId, normalizeCommunity(community));
    }
  }
}

function hydrateEvents(map, eventList = []) {
  for (const event of eventList || []) {
    if (event?.eventId) {
      map.set(event.eventId, normalizeEvent(event));
    }
  }
}

function hydrateScheduled(map, announcementList = []) {
  for (const announcement of announcementList || []) {
    if (announcement?.announcementId) {
      map.set(announcement.announcementId, normalizeScheduledAnnouncement(announcement));
    }
  }
}

function upsertNested(root, groupId, itemId, item) {
  if (!groupId || !itemId) {
    return;
  }

  if (!root.has(groupId)) {
    root.set(groupId, new Map());
  }

  root.get(groupId).set(itemId, item);
}

function deleteNested(root, groupId, itemId) {
  root.get(groupId)?.delete(itemId);
}

function dedupeById(items, idKey) {
  const map = new Map();

  for (const item of items || []) {
    const id = item?.[idKey];

    if (id && !map.has(id)) {
      map.set(id, item);
    }
  }

  return [...map.values()];
}

function memberIdFor(user) {
  return user?.userId ? `user_${user.userId}` : user?.memberId || user?.sessionId || '';
}

function requireLoggedIn(user) {
  if (!user?.userId) {
    throw new Error('Account login is required for this action.');
  }
}

function isCommunityOwner(community, actor) {
  return Boolean(community?.ownerUserId && actor?.userId && community.ownerUserId === actor.userId);
}

function canManageCommunity(community, member, actor) {
  return Boolean(actor?.admin || isCommunityOwner(community, actor) || ['owner', 'admin'].includes(member?.role));
}

function assertCanModerateCommunityMember(actorMember, target) {
  if (actorMember.memberId === target.memberId) {
    throw new Error('You cannot moderate yourself.');
  }

  if (target.role === 'owner') {
    throw new Error('The community owner cannot be moderated.');
  }

  if (actorMember.role === 'moderator' && target.role !== 'member') {
    throw new Error('Community moderators can only moderate members.');
  }
}

function enforceCommunityBan(member) {
  if (!member?.bannedUntil) {
    return;
  }

  if (member.bannedUntil === 'permanent') {
    throw new Error('You are banned from this community.');
  }

  const timestamp = new Date(member.bannedUntil).getTime();

  if (Number.isFinite(timestamp) && timestamp > Date.now()) {
    throw new Error('You are temporarily banned from this community.');
  }
}

function resolveBanUntil(duration = '24h') {
  if (duration === 'permanent') {
    return 'permanent';
  }

  if (duration === '7d') {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

function resolveEventStatus(event) {
  if (!event || event.status === 'cancelled') {
    return event?.status || 'scheduled';
  }

  const now = Date.now();
  const start = new Date(event.startsAt).getTime();
  const end = new Date(event.endsAt).getTime();

  if (Number.isFinite(end) && now >= end) {
    return 'ended';
  }

  if (Number.isFinite(start) && now >= start) {
    return 'live';
  }

  return EVENT_STATUSES.includes(event.status) ? event.status : 'scheduled';
}

function sanitizeRoomPurpose(value) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, 90);
}

function sanitizeCommunityAvatar(value) {
  return String(value || 'nexus').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'nexus';
}

function actorRef(actor) {
  return {
    userId: actor?.userId || null,
    sessionId: actor?.sessionId || '',
    displayName: actor?.displayName || 'Nexus',
  };
}

async function notifyEventRsvps(notificationService, event, type, title) {
  if (!notificationService?.createNotification) {
    return;
  }

  // TODO Phase 9: use a scheduled worker/Cloud Task for large event reminder fanout.
  await notificationService.createNotification({
    userId: event.hostUserId,
    type,
    title,
    body: event.description,
    targetView: 'event-lobby',
    metadata: { eventId: event.eventId, roomId: event.roomId, ...toCategoryMetadata(event) },
  });
}

async function getCommunityAnalytics(communityId) {
  return {
    communityId,
    totalMembers: 0,
    activeRooms: 0,
    messagesToday: 0,
    eventRsvps: 0,
    openReports: 0,
    topActiveRooms: [],
    approximate: true,
  };
}

function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}
