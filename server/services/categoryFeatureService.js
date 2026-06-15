import crypto from 'node:crypto';

import { getPlanLimits } from '../../shared/billingCatalog.js';
import { CHAT_LIMITS } from '../../shared/chatConfig.js';
import {
  STATIC_TOPIC_PROMPTS,
  getCategoryConfig,
  getSafeHubLinks,
  getToolConfig,
  getToolLimitsForPlan,
  isToolEnabledForCategory,
} from '../../shared/categoryConfig.js';
import {
  assertPlainObject,
  sanitizeCategoryToolBody,
  sanitizeCategoryToolMetadata,
  sanitizeCategoryToolStatus,
  sanitizeCategoryToolTitle,
  sanitizeCategoryToolType,
  sanitizeHubLinkIds,
  sanitizeIdentifier,
  sanitizePollOptions,
  sanitizePriorityTag,
  sanitizeTimerMinutes,
} from './safetyService.js';

const MOD_TOOLS = new Set([
  'focus_timer',
  'study_goal',
  'study_checklist',
  'match_lobby',
  'prompt_card',
  'draft_pin',
  'hub_link_panel',
  'official_announcement',
]);

const ADMIN_ONLY_TOOLS = new Set(['official_badge']);
const USER_CREATABLE_TOOLS = new Set([
  'doubt_marker',
  'fix_solved_marker',
  'idea_board',
  'feedback_request',
  'help_queue',
  'priority_tag',
  'topic_spinner',
  'icebreaker_prompt',
  'quick_poll',
  'room_event',
  'product_feedback',
]);

export function createCategoryFeatureService({ repositories = {}, entitlementService, logger = console } = {}) {
  const repository = repositories.categoryToolRepository || {};
  const toolStore = new Map();

  async function hydrateRoom(room) {
    if (!room?.roomId || room.categoryToolsHydrated) {
      return room;
    }

    try {
      const persisted = await repository.listByRoom?.(room.roomId, CHAT_LIMITS.MAX_CATEGORY_TOOLS_LOAD);
      const merged = persisted?.length ? persisted.map(serializeTool) : getTools(room.roomId);
      setTools(room.roomId, merged);
      room.categoryTools = getTools(room.roomId);
    } catch (error) {
      logger.warn?.('Category tools could not be hydrated; live room continues.', { roomId: room.roomId, error });
      room.categoryTools = getTools(room.roomId);
    }

    room.categoryToolsHydrated = true;
    return room;
  }

  async function createTool(room, actor, payload = {}) {
    const cleanPayload = assertPlainObject(payload, 'Category tool payload');
    const toolType = sanitizeCategoryToolType(cleanPayload.toolType);
    assertToolAllowed(room, toolType);
    assertMember(room, actor);
    assertCreatePermission(room, actor, toolType);
    await assertToolLimit(room, toolType);

    const now = new Date().toISOString();
    const base = {
      toolId: createId('tool'),
      roomId: room.roomId,
      categorySlug: getCategoryConfig(room.categorySlug || room.category).slug,
      toolType,
      title: sanitizeCategoryToolTitle(cleanPayload.title, getToolConfig(toolType)?.title || 'Room tool'),
      body: sanitizeCategoryToolBody(cleanPayload.body),
      status: sanitizeInitialStatus(toolType, cleanPayload.status),
      createdByUserId: actor?.userId || null,
      createdBySessionId: actor?.sessionId || '',
      createdByName: actor?.displayName || 'Guest',
      targetMessageId: cleanPayload.targetMessageId ? sanitizeIdentifier(cleanPayload.targetMessageId, 'Message') : '',
      createdAt: now,
      updatedAt: now,
      closedAt: null,
      metadata: sanitizeToolMetadata(toolType, cleanPayload.metadata || cleanPayload),
    };

    const tool = serializeTool(base);
    upsertTool(room, tool);
    return { room, tool, tools: getTools(room.roomId), action: 'created' };
  }

  async function updateTool(room, actor, payload = {}) {
    const cleanPayload = assertPlainObject(payload, 'Category tool update');
    const tool = requireTool(room, cleanPayload.toolId);
    assertMember(room, actor);
    assertUpdatePermission(room, actor, tool);

    const updates = {};
    if (cleanPayload.title !== undefined) {
      updates.title = sanitizeCategoryToolTitle(cleanPayload.title, tool.title);
    }

    if (cleanPayload.body !== undefined) {
      updates.body = sanitizeCategoryToolBody(cleanPayload.body);
    }

    if (cleanPayload.status !== undefined) {
      updates.status = sanitizeCategoryToolStatus(cleanPayload.status, tool.status || 'open');
    }

    if (cleanPayload.metadata && typeof cleanPayload.metadata === 'object') {
      updates.metadata = {
        ...(tool.metadata || {}),
        ...sanitizeToolMetadata(tool.toolType, { ...(tool.metadata || {}), ...cleanPayload.metadata }),
      };
    }

    const next = {
      ...tool,
      ...updates,
      updatedAt: new Date().toISOString(),
      closedAt: ['closed', 'completed', 'solved', 'fixed', 'dismissed'].includes(updates.status) ? new Date().toISOString() : tool.closedAt,
    };
    upsertTool(room, next);
    return { room, tool: next, tools: getTools(room.roomId), action: 'updated' };
  }

  async function deleteTool(room, actor, payload = {}) {
    const cleanPayload = assertPlainObject(payload, 'Category tool delete');
    const tool = requireTool(room, cleanPayload.toolId);
    assertMember(room, actor);
    assertUpdatePermission(room, actor, tool);

    const next = {
      ...tool,
      status: 'closed',
      closedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    upsertTool(room, next);
    return { room, tool: next, tools: getTools(room.roomId), action: 'closed' };
  }

  async function startTimer(room, actor, payload = {}) {
    assertToolAllowed(room, 'focus_timer');
    assertMember(room, actor);
    assertModerator(room, actor);
    const limits = await getRoomToolLimits(room);
    const minutes = sanitizeTimerMinutes(payload.minutes || payload.durationMinutes || 25, limits.focusTimerMaxMinutes);
    const now = Date.now();
    const tool = findSingleton(room, 'focus_timer') || createSystemTool(room, actor, 'focus_timer', 'Focus Timer');
    const next = {
      ...tool,
      status: 'running',
      updatedAt: new Date().toISOString(),
      closedAt: null,
      metadata: {
        ...(tool.metadata || {}),
        durationMinutes: minutes,
        startedAt: new Date(now).toISOString(),
        endsAt: new Date(now + minutes * 60_000).toISOString(),
        pausedAt: '',
        remainingMs: minutes * 60_000,
      },
    };
    upsertTool(room, next);
    return { room, tool: next, tools: getTools(room.roomId), action: 'timer_started' };
  }

  async function pauseTimer(room, actor, payload = {}) {
    const tool = requireTool(room, payload.toolId || findSingleton(room, 'focus_timer')?.toolId);
    assertToolAllowed(room, 'focus_timer');
    assertModerator(room, actor);
    const endsAt = new Date(tool.metadata?.endsAt || 0).getTime();
    const remainingMs = Math.max(0, Number.isFinite(endsAt) ? endsAt - Date.now() : Number(tool.metadata?.remainingMs || 0));
    const next = {
      ...tool,
      status: 'paused',
      updatedAt: new Date().toISOString(),
      metadata: {
        ...(tool.metadata || {}),
        pausedAt: new Date().toISOString(),
        remainingMs,
      },
    };
    upsertTool(room, next);
    return { room, tool: next, tools: getTools(room.roomId), action: 'timer_paused' };
  }

  async function completeTimer(room, actor, payload = {}) {
    const tool = requireTool(room, payload.toolId || findSingleton(room, 'focus_timer')?.toolId);
    assertToolAllowed(room, 'focus_timer');
    assertModerator(room, actor);
    const next = {
      ...tool,
      status: 'completed',
      updatedAt: new Date().toISOString(),
      closedAt: new Date().toISOString(),
      metadata: {
        ...(tool.metadata || {}),
        completedAt: new Date().toISOString(),
        remainingMs: 0,
      },
    };
    upsertTool(room, next);
    return { room, tool: next, tools: getTools(room.roomId), action: 'timer_completed' };
  }

  async function markSolved(room, actor, payload = {}) {
    const cleanPayload = assertPlainObject(payload, 'Solved marker payload');
    const tool = cleanPayload.toolId ? requireTool(room, cleanPayload.toolId) : null;
    const targetMessageId = cleanPayload.targetMessageId || tool?.targetMessageId;

    if (!targetMessageId) {
      throw new Error('A message target is required.');
    }

    const requestedToolType = cleanPayload.toolType ? sanitizeCategoryToolType(cleanPayload.toolType) : '';
    const toolType =
      tool?.toolType ||
      (requestedToolType && isToolEnabledForCategory(requestedToolType, room.categorySlug || room.category)
        ? requestedToolType
        : isToolEnabledForCategory('help_queue', room.categorySlug || room.category)
          ? 'help_queue'
          : isToolEnabledForCategory('fix_solved_marker', room.categorySlug || room.category)
            ? 'fix_solved_marker'
            : 'doubt_marker');
    assertToolAllowed(room, toolType);
    assertMember(room, actor);

    const existing = tool || createSystemTool(room, actor, toolType, toolType === 'help_queue' ? 'Help request' : 'Study doubt', {
      targetMessageId: sanitizeIdentifier(targetMessageId, 'Message'),
      status: 'open',
    });
    assertAuthorOrModerator(room, actor, existing);

    const solvedStatus = toolType === 'fix_solved_marker' ? 'fixed' : 'solved';
    const next = {
      ...existing,
      status: solvedStatus,
      updatedAt: new Date().toISOString(),
      closedAt: new Date().toISOString(),
      metadata: {
        ...(existing.metadata || {}),
        solvedByName: actor?.displayName || 'User',
        solvedAt: new Date().toISOString(),
      },
    };
    upsertTool(room, next);
    return { room, tool: next, tools: getTools(room.roomId), action: 'solved' };
  }

  async function vote(room, actor, payload = {}) {
    const cleanPayload = assertPlainObject(payload, 'Tool vote');
    const tool = requireTool(room, cleanPayload.toolId);
    assertMember(room, actor);
    assertToolAllowed(room, tool.toolType);

    const voteKey = actor.userId ? `user:${actor.userId}` : `session:${actor.sessionId}`;
    const value = String(cleanPayload.value || 'up').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'up';
    const nextVotes = { ...(tool.metadata?.votes || {}) };
    nextVotes[voteKey] = value;

    if (tool.toolType === 'room_event') {
      const status = ['going', 'maybe', 'not_going'].includes(value) ? value : 'going';
      const rsvps = { ...(tool.metadata?.rsvps || {}), [voteKey]: status };
      const rsvpSummary = summarizeEventRsvps(rsvps);
      const next = {
        ...tool,
        updatedAt: new Date().toISOString(),
        metadata: { ...(tool.metadata || {}), rsvps, rsvpSummary },
      };
      upsertTool(room, next);
      return { room, tool: next, tools: getTools(room.roomId), action: 'event_rsvp' };
    }

    const next = {
      ...tool,
      updatedAt: new Date().toISOString(),
      metadata: { ...(tool.metadata || {}), votes: nextVotes },
    };
    upsertTool(room, next);
    return { room, tool: next, tools: getTools(room.roomId), action: 'voted' };
  }

  async function pollVote(room, actor, payload = {}) {
    const cleanPayload = assertPlainObject(payload, 'Poll vote');
    const tool = requireTool(room, cleanPayload.toolId);
    assertMember(room, actor);
    assertToolAllowed(room, 'quick_poll');

    if (tool.toolType !== 'quick_poll') {
      throw new Error('That tool is not a poll.');
    }

    if (['closed', 'completed', 'dismissed'].includes(tool.status)) {
      throw new Error('This poll is closed.');
    }

    const options = Array.isArray(tool.metadata?.options) ? tool.metadata.options : [];
    const optionIndex = Math.max(0, Math.min(Number(cleanPayload.optionIndex) || 0, options.length - 1));
    const voter = actor.userId ? `user:${actor.userId}` : `session:${actor.sessionId}`;
    const votes = { ...(tool.metadata?.votes || {}), [voter]: optionIndex };
    const results = options.map((_, index) => Object.values(votes).filter((vote) => Number(vote) === index).length);
    const next = {
      ...tool,
      updatedAt: new Date().toISOString(),
      metadata: { ...(tool.metadata || {}), votes, results },
    };
    upsertTool(room, next);
    return { room, tool: next, tools: getTools(room.roomId), action: 'poll_voted' };
  }

  async function joinMatch(room, actor, payload = {}) {
    const cleanPayload = assertPlainObject(payload, 'Match join');
    const tool = requireTool(room, cleanPayload.toolId);
    assertMember(room, actor);
    assertToolAllowed(room, 'match_lobby');

    if (tool.toolType !== 'match_lobby') {
      throw new Error('That tool is not a match lobby.');
    }

    const participantKey = actor.userId ? `user:${actor.userId}` : `session:${actor.sessionId}`;
    const participants = new Set(tool.metadata?.participants || []);
    participants.add(participantKey);
    const playersNeeded = Math.max(1, Number(tool.metadata?.playersNeeded || 1));
    const nextParticipants = [...participants].slice(0, playersNeeded);
    const next = {
      ...tool,
      status: nextParticipants.length >= playersNeeded ? 'closed' : 'open',
      updatedAt: new Date().toISOString(),
      metadata: {
        ...(tool.metadata || {}),
        participants: nextParticipants,
        currentJoinedCount: nextParticipants.length,
      },
    };
    upsertTool(room, next);
    return { room, tool: next, tools: getTools(room.roomId), action: 'match_joined' };
  }

  async function listAdmin(filters = {}) {
    const persisted = await repository.listAdmin?.(filters);
    const memory = [...toolStore.values()].flat().map(serializeTool);
    const source = persisted?.length ? persisted.map(serializeTool) : memory;
    const category = String(filters.category || '').trim();
    const toolType = String(filters.toolType || '').trim();
    const status = String(filters.status || '').trim();
    const limit = Math.min(Number(filters.limit) || 80, 200);

    return source
      .filter((tool) => !category || tool.categorySlug === category)
      .filter((tool) => !toolType || tool.toolType === toolType)
      .filter((tool) => !status || tool.status === status)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .slice(0, limit)
      .map(serializePublicTool);
  }

  async function updateAdminStatus(roomId, toolId, status = 'closed') {
    const cleanRoomId = sanitizeIdentifier(roomId, 'Room');
    const cleanToolId = sanitizeIdentifier(toolId, 'Tool');
    const cleanStatus = sanitizeCategoryToolStatus(status, 'closed');
    const now = new Date().toISOString();
    const tools = getTools(cleanRoomId);
    const existing = tools.find((tool) => tool.toolId === cleanToolId);
    const next = existing
      ? { ...existing, status: cleanStatus, updatedAt: now, closedAt: ['closed', 'dismissed', 'solved', 'fixed'].includes(cleanStatus) ? now : existing.closedAt }
      : {
          toolId: cleanToolId,
          roomId: cleanRoomId,
          categorySlug: 'random',
          toolType: 'topic_spinner',
          title: 'Admin updated tool',
          body: '',
          status: cleanStatus,
          createdByUserId: null,
          createdBySessionId: '',
          createdByName: 'Nexus Admin',
          targetMessageId: '',
          createdAt: now,
          updatedAt: now,
          closedAt: now,
          metadata: {},
        };
    setTools(cleanRoomId, [next, ...tools.filter((tool) => tool.toolId !== cleanToolId)]);
    await repository.update?.(cleanRoomId, cleanToolId, next);
    return serializePublicTool(next);
  }

  async function removeAdminTool(roomId, toolId) {
    const cleanRoomId = sanitizeIdentifier(roomId, 'Room');
    const cleanToolId = sanitizeIdentifier(toolId, 'Tool');
    const now = new Date().toISOString();
    const tools = getTools(cleanRoomId);
    const existing = tools.find((tool) => tool.toolId === cleanToolId);
    const next = existing
      ? { ...existing, status: 'closed', closedAt: now, updatedAt: now }
      : {
          toolId: cleanToolId,
          roomId: cleanRoomId,
          categorySlug: 'random',
          toolType: 'topic_spinner',
          title: 'Admin removed tool',
          body: '',
          status: 'closed',
          createdByUserId: null,
          createdBySessionId: '',
          createdByName: 'Nexus Admin',
          targetMessageId: '',
          createdAt: now,
          updatedAt: now,
          closedAt: now,
          metadata: {},
        };
    setTools(cleanRoomId, [next, ...tools.filter((tool) => tool.toolId !== cleanToolId)]);
    await repository.delete?.(cleanRoomId, cleanToolId, next);
    return serializePublicTool(next);
  }

  function getTools(roomId) {
    return (toolStore.get(roomId) || []).map(serializeTool);
  }

  function setTools(roomId, tools = []) {
    toolStore.set(roomId, tools.map(serializeTool).slice(0, CHAT_LIMITS.MAX_CATEGORY_TOOLS_LOAD));
  }

  function upsertTool(room, tool) {
    const tools = getTools(room.roomId).filter((item) => item.toolId !== tool.toolId);
    const nextTools = [serializeTool(tool), ...tools].slice(0, CHAT_LIMITS.MAX_CATEGORY_TOOLS_LOAD);
    setTools(room.roomId, nextTools);
    room.categoryTools = nextTools;
    room.categoryToolsHydrated = true;
    repository.save?.(room.roomId, serializeTool(tool)).catch?.((error) => logger.warn?.('Category tool persistence skipped safely.', { error }));
  }

  function createSystemTool(room, actor, toolType, title, overrides = {}) {
    return serializeTool({
      toolId: createId('tool'),
      roomId: room.roomId,
      categorySlug: getCategoryConfig(room.categorySlug || room.category).slug,
      toolType,
      title,
      body: '',
      status: overrides.status || 'open',
      createdByUserId: actor?.userId || null,
      createdBySessionId: actor?.sessionId || '',
      createdByName: actor?.displayName || 'Guest',
      targetMessageId: overrides.targetMessageId || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      closedAt: null,
      metadata: sanitizeCategoryToolMetadata(overrides.metadata || {}),
    });
  }

  function requireTool(room, toolId) {
    const cleanToolId = sanitizeIdentifier(toolId, 'Tool');
    const tool = getTools(room.roomId).find((item) => item.toolId === cleanToolId);

    if (!tool) {
      throw new Error('Category tool was not found.');
    }

    return tool;
  }

  function findSingleton(room, toolType) {
    return getTools(room.roomId).find((tool) => tool.toolType === toolType && !['closed', 'completed', 'dismissed'].includes(tool.status));
  }

  async function assertToolLimit(room, toolType) {
    const limits = await getRoomToolLimits(room);
    const activeTools = getTools(room.roomId).filter((tool) => !['closed', 'completed', 'dismissed'].includes(tool.status));

    if (activeTools.length >= limits.activeToolsPerRoom) {
      throw new Error('This room has reached its active tool limit.');
    }

    const capMap = {
      quick_poll: ['activePolls', 'quick_poll'],
      idea_board: ['ideaCards', 'idea_board'],
      help_queue: ['helpQueueItems', 'help_queue'],
      study_checklist: ['studyChecklistItems', 'study_checklist'],
      match_lobby: ['matchLobbies', 'match_lobby'],
      product_feedback: ['productFeedbackItems', 'product_feedback'],
    };
    const cap = capMap[toolType];

    if (cap && activeTools.filter((tool) => tool.toolType === cap[1]).length >= limits[cap[0]]) {
      throw new Error('This room has reached the plan limit for that tool.');
    }
  }

  async function getRoomToolLimits(room) {
    if (!room?.ownerUserId || !entitlementService?.getFeatureLimits) {
      return getToolLimitsForPlan('free');
    }

    try {
      const limits = await entitlementService.getFeatureLimits({ userId: room.ownerUserId });
      return {
        ...getToolLimitsForPlan('free'),
        ...(limits?.categoryTools || getPlanLimits('free').categoryTools || {}),
      };
    } catch {
      return getToolLimitsForPlan('free');
    }
  }

  function assertToolAllowed(room, toolType) {
    if (!isToolEnabledForCategory(toolType, room?.categorySlug || room?.category)) {
      throw new Error('That tool is not available for this room category.');
    }
  }

  function assertMember(room, actor) {
    if (!room?.members?.has(actor?.sessionId)) {
      throw new Error('Join the room before using category tools.');
    }
  }

  function assertCreatePermission(room, actor, toolType) {
    if (ADMIN_ONLY_TOOLS.has(toolType) && !actor?.admin) {
      throw new Error('Only admins can use this official tool.');
    }

    if (MOD_TOOLS.has(toolType)) {
      assertModerator(room, actor);
      return;
    }

    if (!USER_CREATABLE_TOOLS.has(toolType)) {
      throw new Error('That tool cannot be created directly.');
    }
  }

  function assertUpdatePermission(room, actor, tool) {
    if (actor?.admin) {
      return;
    }

    if (isModerator(room, actor)) {
      return;
    }

    if (tool.createdBySessionId && tool.createdBySessionId === actor?.sessionId) {
      return;
    }

    throw new Error('You do not have permission to update this tool.');
  }

  function assertAuthorOrModerator(room, actor, tool) {
    if (isModerator(room, actor) || tool.createdBySessionId === actor?.sessionId) {
      return;
    }

    throw new Error('Only the author or a moderator can mark this solved.');
  }

  function assertModerator(room, actor) {
    if (!isModerator(room, actor)) {
      throw new Error('Only the room owner or moderators can do that.');
    }
  }

  function isModerator(room, actor) {
    if (actor?.admin || room?.ownerSessionId === actor?.sessionId || room?.ownerUserId === actor?.userId) {
      return true;
    }

    return room?.members?.get(actor?.sessionId)?.role === 'moderator';
  }

  return {
    completeTimer,
    createTool,
    deleteTool,
    getTools,
    hydrateRoom,
    joinMatch,
    listAdmin,
    markSolved,
    pauseTimer,
    pollVote,
    removeAdminTool,
    startTimer,
    updateAdminStatus,
    updateTool,
    vote,
  };
}

function sanitizeInitialStatus(toolType, status) {
  if (toolType === 'focus_timer') {
    return sanitizeCategoryToolStatus(status, 'idle');
  }

  if (toolType === 'product_feedback') {
    return sanitizeCategoryToolStatus(status, 'received');
  }

  return sanitizeCategoryToolStatus(status, 'open');
}

function sanitizeToolMetadata(toolType, source = {}) {
  const metadata = sanitizeCategoryToolMetadata(source);

  if (toolType === 'quick_poll') {
    const options = sanitizePollOptions(source.options || source.pollOptions || []);
    return { ...metadata, options, votes: {}, results: options.map(() => 0) };
  }

  if (toolType === 'match_lobby') {
    return {
      ...metadata,
      gameName: sanitizeCategoryToolTitle(source.gameName || source.title, 'Game'),
      mode: sanitizeCategoryToolTitle(source.mode || '', 'Match'),
      playersNeeded: Math.max(1, Math.min(Number(source.playersNeeded) || 2, 100)),
      currentJoinedCount: 0,
      participants: [],
      roomLinkText: sanitizeCategoryToolBody(source.roomLinkText || source.link || ''),
    };
  }

  if (toolType === 'hub_link_panel') {
    return {
      ...metadata,
      hubLinkIds: sanitizeHubLinkIds(source.hubLinkIds || getSafeHubLinks().map((link) => link.id)),
    };
  }

  if (toolType === 'priority_tag') {
    return { ...metadata, priority: sanitizePriorityTag(source.priority) };
  }

  if (toolType === 'room_event') {
    return {
      ...metadata,
      title: sanitizeCategoryToolTitle(source.title || source.eventTitle, 'Room event'),
      description: sanitizeCategoryToolBody(source.description || source.body || ''),
      startsAt: sanitizeRoomEventTime(source.startsAt || source.startTime),
      location: sanitizeCategoryToolTitle(source.location || '', ''),
      rsvps: {},
      rsvpSummary: { going: 0, maybe: 0, notGoing: 0 },
    };
  }

  if (toolType === 'topic_spinner' || toolType === 'icebreaker_prompt') {
    const topic = sanitizeCategoryToolBody(source.topic || source.body || STATIC_TOPIC_PROMPTS[Math.floor(Math.random() * STATIC_TOPIC_PROMPTS.length)]);
    return { ...metadata, topic };
  }

  return metadata;
}

function serializeTool(tool = {}) {
  return {
    toolId: String(tool.toolId || '').slice(0, 120),
    roomId: String(tool.roomId || '').slice(0, 120),
    categorySlug: getCategoryConfig(tool.categorySlug || tool.category || 'random').slug,
    toolType: CATEGORY_TOOL_TYPES_SAFE(tool.toolType),
    title: sanitizeCategoryToolTitle(tool.title, 'Room tool'),
    body: sanitizeCategoryToolBody(tool.body),
    status: sanitizeCategoryToolStatus(tool.status, 'open'),
    createdByUserId: tool.createdByUserId || null,
    createdBySessionId: String(tool.createdBySessionId || '').slice(0, 120),
    createdByName: sanitizeCategoryToolTitle(tool.createdByName, 'Guest'),
    targetMessageId: String(tool.targetMessageId || '').slice(0, 120),
    createdAt: tool.createdAt || new Date().toISOString(),
    updatedAt: tool.updatedAt || tool.createdAt || new Date().toISOString(),
    closedAt: tool.closedAt || null,
    metadata: sanitizeCategoryToolMetadata(tool.metadata || {}),
  };
}

function serializePublicTool(tool = {}) {
  const serialized = serializeTool(tool);
  delete serialized.metadata.votes;
  delete serialized.metadata.participants;
  delete serialized.metadata.voters;
  delete serialized.metadata.rsvps;
  return serialized;
}

function summarizeEventRsvps(rsvps = {}) {
  return Object.values(rsvps).reduce(
    (summary, value) => {
      if (value === 'going') {
        summary.going += 1;
      } else if (value === 'maybe') {
        summary.maybe += 1;
      } else if (value === 'not_going') {
        summary.notGoing += 1;
      }
      return summary;
    },
    { going: 0, maybe: 0, notGoing: 0 },
  );
}

function sanitizeRoomEventTime(value) {
  const timestamp = new Date(value || '').getTime();

  if (!Number.isFinite(timestamp)) {
    throw new Error('Event start time is invalid.');
  }

  return new Date(timestamp).toISOString();
}

function CATEGORY_TOOL_TYPES_SAFE(toolType) {
  try {
    return sanitizeCategoryToolType(toolType);
  } catch {
    return 'topic_spinner';
  }
}

function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(10).toString('hex')}`;
}
