import {
  CHAT_LIMITS,
  COMMUNITY_ACTIVITY_TYPES,
  COMMUNITY_RESERVED_SLUGS,
  COMMUNITY_ROLES,
  COMMUNITY_VISIBILITIES,
  EVENT_RSVP_STATUSES,
  EVENT_STATUSES,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  MODERATION_ACTION_TYPES,
  NOTIFICATION_PREFERENCES,
  NOTIFICATION_TYPES,
  REACTION_EMOJIS,
  REPORT_REASONS,
  REPORT_STATUSES,
  ROOM_ACTIVITY_TYPES,
  ROOM_SNOOZE_OPTIONS,
  ROOM_ROLES,
  MODERATION_DURATIONS,
  SCHEDULED_ANNOUNCEMENT_STATUSES,
  SCHEDULED_ANNOUNCEMENT_TARGETS,
} from '../../shared/chatConfig.js';
import {
  CATEGORY_MESSAGE_TYPES,
  CATEGORY_TOOL_STATUS,
  CATEGORY_TOOL_TYPES,
  detectCodingSecretRisk,
  getCategoryLabel,
  getCategorySlug,
  getSafeHubLinks,
  getRoomTemplate,
  isValidCategory,
} from '../../shared/categoryConfig.js';

const FALLBACK_NAMES = ['Guest', 'NexusUser', 'MHGuest'];
const BAD_WORDS = ['badword-placeholder'];

export function createRateLimiter({ windowMs, max }) {
  const buckets = new Map();

  return {
    check(key) {
      const now = Date.now();
      const bucket = (buckets.get(key) || []).filter((timestamp) => now - timestamp < windowMs);

      if (bucket.length >= max) {
        buckets.set(key, bucket);
        return false;
      }

      bucket.push(now);
      buckets.set(key, bucket);
      return true;
    },
  };
}

export function createRepeatedMessageGuard({ windowMs, max }) {
  const buckets = new Map();

  return {
    check(key, content) {
      const now = Date.now();
      const normalized = content.toLowerCase();
      const bucket = (buckets.get(key) || []).filter((item) => now - item.timestamp < windowMs);
      const repeatedCount = bucket.filter((item) => item.content === normalized).length;

      if (repeatedCount >= max) {
        buckets.set(key, bucket);
        return false;
      }

      bucket.push({ content: normalized, timestamp: now });
      buckets.set(key, bucket);
      return true;
    },
  };
}

export function sanitizeDisplayName(value) {
  const text = normalizePlainText(value)
    .replace(/[^\p{L}\p{N}\s._-]/gu, '')
    .slice(0, CHAT_LIMITS.MAX_DISPLAY_NAME_LENGTH)
    .trim();

  if (text.length >= CHAT_LIMITS.MIN_DISPLAY_NAME_LENGTH) {
    return text;
  }

  return FALLBACK_NAMES[Math.floor(Math.random() * FALLBACK_NAMES.length)];
}

export function sanitizeRoomTitle(value) {
  const text = normalizePlainText(value).slice(0, CHAT_LIMITS.MAX_ROOM_TITLE_LENGTH).trim();
  return text || 'Nexus Room';
}

export function sanitizeCategory(value) {
  const normalized = normalizePlainText(value).slice(0, CHAT_LIMITS.MAX_CATEGORY_LENGTH).trim();
  return isValidCategory(normalized) ? getCategoryLabel(normalized) : getCategoryLabel('random');
}

export function sanitizeHandle(value) {
  const handle = String(value || '')
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/[._-]{2,}/g, (match) => match[0])
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, CHAT_LIMITS.MAX_HANDLE_LENGTH);

  if (!handle) {
    return '';
  }

  if (handle.length < CHAT_LIMITS.MIN_HANDLE_LENGTH) {
    throw new Error(`Handle must be at least ${CHAT_LIMITS.MIN_HANDLE_LENGTH} characters.`);
  }

  return handle;
}

export function sanitizeProfileStatus(value) {
  return normalizePlainText(value).slice(0, CHAT_LIMITS.MAX_PROFILE_STATUS_LENGTH).trim();
}

export function sanitizeRoomRules(value) {
  return normalizePlainText(value).slice(0, CHAT_LIMITS.MAX_ROOM_RULES_LENGTH).trim();
}

export function sanitizeCommunityName(value) {
  const text = normalizePlainText(value).slice(0, CHAT_LIMITS.MAX_COMMUNITY_NAME_LENGTH).trim();

  if (text.length < CHAT_LIMITS.MIN_COMMUNITY_NAME_LENGTH) {
    throw new Error('Community name is too short.');
  }

  return text;
}

export function sanitizeCommunitySlug(value, fallback = '') {
  const source = value || fallback || '';
  const slug = String(source)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, CHAT_LIMITS.MAX_COMMUNITY_SLUG_LENGTH);

  if (slug.length < CHAT_LIMITS.MIN_COMMUNITY_SLUG_LENGTH || COMMUNITY_RESERVED_SLUGS.includes(slug)) {
    throw new Error('Community slug is not available.');
  }

  return slug;
}

export function sanitizeCommunityDescription(value) {
  return normalizePlainText(value).slice(0, CHAT_LIMITS.MAX_COMMUNITY_DESCRIPTION_LENGTH).trim();
}

export function sanitizeCommunityRules(value) {
  return normalizePlainText(value).slice(0, CHAT_LIMITS.MAX_COMMUNITY_RULES_LENGTH).trim();
}

export function sanitizeCommunityCategory(value) {
  const normalized = normalizePlainText(value).slice(0, CHAT_LIMITS.MAX_CATEGORY_LENGTH).trim();
  return isValidCategory(normalized) ? getCategoryLabel(normalized) : getCategoryLabel('random');
}

export function sanitizeRoomTemplateId(value, category) {
  const templateId = normalizePlainText(value).replace(/[^a-z0-9-]/gi, '').slice(0, 80).trim();

  if (!templateId) {
    return '';
  }

  const template = getRoomTemplate(templateId, getCategorySlug(category));

  if (!template) {
    throw new Error('Room template is invalid for this category.');
  }

  return template.templateId;
}

export function sanitizeCommunityVisibility(value) {
  return COMMUNITY_VISIBILITIES.includes(value) ? value : 'public';
}

export function sanitizeCommunityRole(value) {
  if (COMMUNITY_ROLES.includes(value)) {
    return value;
  }

  throw new Error('Community role is invalid.');
}

export function sanitizeCommunityTags(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((tag) =>
          normalizePlainText(tag)
            .replace(/^#+/, '')
            .replace(/[^\p{L}\p{N}\s_-]/gu, '')
            .trim()
            .slice(0, CHAT_LIMITS.MAX_COMMUNITY_TAG_LENGTH),
        )
        .filter(Boolean),
    ),
  ].slice(0, CHAT_LIMITS.MAX_COMMUNITY_TAGS);
}

export function sanitizeCoverTheme(value) {
  return ['classic', 'ivory_royale', 'midnight_gold', 'soft_blue_glass', 'study_calm', 'gamehub_arena'].includes(value)
    ? value
    : 'classic';
}

export function sanitizeCommunityActivityType(value) {
  if (COMMUNITY_ACTIVITY_TYPES.includes(value)) {
    return value;
  }

  throw new Error('Community activity type is invalid.');
}

export function sanitizeEventStatus(value) {
  if (EVENT_STATUSES.includes(value)) {
    return value;
  }

  return 'scheduled';
}

export function sanitizeRsvpStatus(value) {
  if (EVENT_RSVP_STATUSES.includes(value)) {
    return value;
  }

  throw new Error('RSVP status is invalid.');
}

export function sanitizeEventTitle(value) {
  const title = normalizePlainText(value).slice(0, CHAT_LIMITS.MAX_EVENT_TITLE_LENGTH).trim();

  if (!title) {
    throw new Error('Event title is required.');
  }

  return title;
}

export function sanitizeEventDescription(value) {
  return normalizePlainText(value).slice(0, CHAT_LIMITS.MAX_EVENT_DESCRIPTION_LENGTH).trim();
}

export function sanitizeEventTimes(startsAt, endsAt) {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error('Event time range is invalid.');
  }

  return {
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(end).toISOString(),
  };
}

export function sanitizeScheduledAnnouncementStatus(value) {
  if (SCHEDULED_ANNOUNCEMENT_STATUSES.includes(value)) {
    return value;
  }

  return 'scheduled';
}

export function sanitizeScheduledAnnouncementTarget(value) {
  if (SCHEDULED_ANNOUNCEMENT_TARGETS.includes(value)) {
    return value;
  }

  throw new Error('Announcement target is invalid.');
}

export function sanitizeScheduledAnnouncementTitle(value) {
  const title = normalizePlainText(value).slice(0, CHAT_LIMITS.MAX_SCHEDULED_ANNOUNCEMENT_TITLE_LENGTH).trim();

  if (!title) {
    throw new Error('Announcement title is required.');
  }

  return title;
}

export function sanitizeScheduledAnnouncementBody(value) {
  const body = normalizePlainText(value).slice(0, CHAT_LIMITS.MAX_SCHEDULED_ANNOUNCEMENT_BODY_LENGTH).trim();

  if (!body) {
    throw new Error('Announcement body is required.');
  }

  return body;
}

export function sanitizeAnnouncementTitle(value) {
  const title = normalizePlainText(value).slice(0, CHAT_LIMITS.MAX_ANNOUNCEMENT_TITLE_LENGTH).trim();

  if (!title) {
    throw new Error('Announcement title is required.');
  }

  return title;
}

export function sanitizeAnnouncementBody(value) {
  const body = normalizePlainText(value).slice(0, CHAT_LIMITS.MAX_ANNOUNCEMENT_BODY_LENGTH).trim();

  if (!body) {
    throw new Error('Announcement body is required.');
  }

  return body;
}

export function sanitizeNotificationType(value) {
  if (!NOTIFICATION_TYPES.includes(value)) {
    throw new Error('Notification type is invalid.');
  }

  return value;
}

export function sanitizeNotificationTitle(value) {
  return normalizePlainText(value).slice(0, CHAT_LIMITS.MAX_NOTIFICATION_TITLE_LENGTH).trim() || 'Nexus update';
}

export function sanitizeNotificationBody(value) {
  return normalizePlainText(value).slice(0, CHAT_LIMITS.MAX_NOTIFICATION_BODY_LENGTH).trim();
}

export function sanitizeActivityType(value) {
  if (!ROOM_ACTIVITY_TYPES.includes(value)) {
    throw new Error('Room activity type is invalid.');
  }

  return value;
}

export function sanitizeNotificationPreferences(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  return Object.fromEntries(
    Object.entries(NOTIFICATION_PREFERENCES).map(([key, fallback]) => [key, source[key] === undefined ? fallback : Boolean(source[key])]),
  );
}

export function sanitizeRoomNotificationState(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const snooze = ROOM_SNOOZE_OPTIONS.find((option) => option.value === source.snooze);
  let mutedUntil = null;

  if (source.notificationsMuted || source.mutedUntil || source.snooze === 'manual') {
    if (source.snooze === 'manual') {
      mutedUntil = 'manual';
    } else if (snooze?.ms) {
      mutedUntil = new Date(Date.now() + snooze.ms).toISOString();
    } else if (source.mutedUntil) {
      const timestamp = new Date(source.mutedUntil).getTime();
      mutedUntil = Number.isFinite(timestamp) && timestamp > Date.now() ? new Date(timestamp).toISOString() : null;
    }
  }

  return {
    notificationsEnabled: source.notificationsEnabled === undefined ? true : Boolean(source.notificationsEnabled),
    notificationsMuted: Boolean(mutedUntil),
    mutedUntil,
  };
}

export function sanitizeMessageContent(value) {
  const normalized = applyBadWordPlaceholder(normalizePlainText(value)).trim();

  if (normalized.length > CHAT_LIMITS.MAX_MESSAGE_LENGTH) {
    throw new Error(`Message must be ${CHAT_LIMITS.MAX_MESSAGE_LENGTH} characters or less.`);
  }

  if (hasExcessiveRepeatedCharacters(normalized)) {
    throw new Error('Message looks repetitive. Please rewrite it before sending.');
  }

  if (countLinks(normalized) > CHAT_LIMITS.MAX_LINKS_PER_MESSAGE) {
    throw new Error('Too many links in one message.');
  }

  const text = normalized;

  if (!text) {
    throw new Error('Message cannot be empty.');
  }

  return text;
}

export function sanitizeCategoryMessageType(value) {
  const clean = String(value || 'text').trim();
  return CATEGORY_MESSAGE_TYPES.includes(clean) ? clean : 'text';
}

export function sanitizeCodeSnippetContent(value) {
  const text = String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .slice(0, CHAT_LIMITS.MAX_CODE_SNIPPET_LENGTH)
    .trim();

  if (!text) {
    throw new Error('Code snippet cannot be empty.');
  }

  return text;
}

export function sanitizeCardMessageBody(value) {
  const text = applyBadWordPlaceholder(normalizePlainText(value)).slice(0, CHAT_LIMITS.MAX_CARD_MESSAGE_BODY_LENGTH).trim();

  if (!text) {
    throw new Error('Card message text is required.');
  }

  return text;
}

export function sanitizeCategoryToolType(value) {
  const toolType = String(value || '').trim();

  if (!CATEGORY_TOOL_TYPES.includes(toolType)) {
    throw new Error('Category tool is invalid.');
  }

  return toolType;
}

export function sanitizeCategoryToolStatus(value, fallback = 'open') {
  const status = String(value || fallback).trim();
  return CATEGORY_TOOL_STATUS.includes(status) ? status : fallback;
}

export function sanitizeCategoryToolTitle(value, fallback = 'Room tool') {
  return normalizePlainText(value).slice(0, CHAT_LIMITS.MAX_CATEGORY_TOOL_TITLE_LENGTH).trim() || fallback;
}

export function sanitizeCategoryToolBody(value) {
  return normalizePlainText(value).slice(0, CHAT_LIMITS.MAX_CATEGORY_TOOL_BODY_LENGTH).trim();
}

export function sanitizeCategoryToolMetadata(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const entries = Object.entries(source).slice(0, CHAT_LIMITS.MAX_CATEGORY_TOOL_METADATA_FIELDS);
  const output = {};

  for (const [rawKey, rawValue] of entries) {
    const key = String(rawKey || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);

    if (!key) {
      continue;
    }

    output[key] = sanitizeMetadataValue(rawValue);
  }

  return output;
}

export function sanitizePollOptions(value) {
  if (!Array.isArray(value)) {
    throw new Error('Poll options are required.');
  }

  const options = [
    ...new Set(
      value
        .map((option) => normalizePlainText(option).slice(0, CHAT_LIMITS.MAX_CATEGORY_TOOL_OPTION_LENGTH).trim())
        .filter(Boolean),
    ),
  ].slice(0, CHAT_LIMITS.MAX_CATEGORY_TOOL_OPTIONS);

  if (options.length < 2) {
    throw new Error('Polls need at least two options.');
  }

  return options;
}

export function sanitizeTimerMinutes(value, maxMinutes = 60) {
  const minutes = Math.round(Number(value) || 0);
  const boundedMax = Math.max(5, Math.min(Number(maxMinutes) || 60, 240));

  if (minutes < 5 || minutes > boundedMax) {
    throw new Error(`Focus timer must be between 5 and ${boundedMax} minutes.`);
  }

  return minutes;
}

export function sanitizePriorityTag(value) {
  return String(value || '').trim() === 'urgent' ? 'urgent' : 'normal';
}

export function sanitizeHubLinkIds(value) {
  const ids = Array.isArray(value) ? value : [];
  const allowed = new Set(getSafeHubLinks().map((link) => link.id));
  return [...new Set(ids.map((id) => String(id || '').trim()).filter((id) => allowed.has(id)))].slice(0, 6);
}

export function sanitizeScorePayload(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    teamA: normalizePlainText(source.teamA).slice(0, CHAT_LIMITS.MAX_SCORE_LABEL_LENGTH).trim() || 'Team A',
    teamB: normalizePlainText(source.teamB).slice(0, CHAT_LIMITS.MAX_SCORE_LABEL_LENGTH).trim() || 'Team B',
    scoreA: normalizePlainText(source.scoreA).slice(0, CHAT_LIMITS.MAX_SCORE_VALUE_LENGTH).trim() || '0',
    scoreB: normalizePlainText(source.scoreB).slice(0, CHAT_LIMITS.MAX_SCORE_VALUE_LENGTH).trim() || '0',
    result: normalizePlainText(source.result).slice(0, CHAT_LIMITS.MAX_CATEGORY_TOOL_TITLE_LENGTH).trim(),
  };
}

export function hasHighConfidenceCodingSecret(value) {
  const result = detectCodingSecretRisk(value);
  return result.severity === 'high';
}

export function sanitizeReplySnippet(value) {
  return normalizePlainText(value).slice(0, CHAT_LIMITS.MAX_REPLY_SNIPPET_LENGTH).trim();
}

export function normalizeRoomType(value) {
  if (['public', 'private', 'temp'].includes(value)) {
    return value;
  }

  return 'public';
}

export function assertPlainObject(value, label = 'Payload') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} is invalid.`);
  }

  return value;
}

export function sanitizeIdentifier(value, label = 'Identifier') {
  const text = String(value || '').trim();

  if (!/^[a-zA-Z0-9_-]{3,120}$/.test(text)) {
    throw new Error(`${label} is invalid.`);
  }

  return text;
}

export function sanitizeInviteCode(value) {
  return sanitizeIdentifier(String(value || '').toUpperCase(), 'Room code');
}

export function sanitizeReactionEmoji(value) {
  if (!REACTION_EMOJIS.includes(value)) {
    throw new Error('Reaction is not supported.');
  }

  return value;
}

export function sanitizeReportTargetType(value) {
  if (['message', 'user', 'room', 'community', 'community_member', 'community_room', 'event_room', 'announcement'].includes(value)) {
    return value;
  }

  throw new Error('Report target is invalid.');
}

export function sanitizeReportReason(value) {
  const reason = REPORT_REASONS.find((item) => item.toLowerCase() === String(value || '').toLowerCase());

  if (!reason) {
    throw new Error('Report reason is invalid.');
  }

  return reason;
}

export function sanitizeReportStatus(value) {
  const status = REPORT_STATUSES.find((item) => item === value);

  if (!status) {
    throw new Error('Report status is invalid.');
  }

  return status;
}

export function sanitizeFeedbackType(value) {
  if (FEEDBACK_TYPES.includes(value)) {
    return value;
  }

  throw new Error('Feedback type is invalid.');
}

export function sanitizeFeedbackStatus(value) {
  if (FEEDBACK_STATUSES.includes(value)) {
    return value;
  }

  throw new Error('Feedback status is invalid.');
}

export function sanitizeFeedbackTitle(value) {
  const title = normalizePlainText(value).slice(0, CHAT_LIMITS.MAX_FEEDBACK_TITLE_LENGTH).trim();

  if (!title) {
    throw new Error('Feedback title is required.');
  }

  return title;
}

export function sanitizeFeedbackMessage(value) {
  const message = normalizePlainText(value).slice(0, CHAT_LIMITS.MAX_FEEDBACK_MESSAGE_LENGTH).trim();

  if (!message) {
    throw new Error('Feedback message is required.');
  }

  return message;
}

export function sanitizeFeedbackContext(value) {
  return normalizePlainText(value).slice(0, CHAT_LIMITS.MAX_FEEDBACK_CONTEXT_LENGTH).trim();
}

export function sanitizeFeedbackName(value) {
  return normalizePlainText(value).slice(0, CHAT_LIMITS.MAX_FEEDBACK_NAME_LENGTH).trim();
}

export function sanitizeFeedbackEmail(value) {
  const email = normalizePlainText(value)
    .toLowerCase()
    .replace(/\s+/g, '')
    .slice(0, CHAT_LIMITS.MAX_FEEDBACK_EMAIL_LENGTH);

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

export function sanitizeFeedbackUserAgent(value) {
  return normalizePlainText(value).slice(0, CHAT_LIMITS.MAX_FEEDBACK_USER_AGENT_LENGTH).trim();
}

export function sanitizeModerationActionType(value) {
  if (!MODERATION_ACTION_TYPES.includes(value)) {
    throw new Error('Moderation action is invalid.');
  }

  return value;
}

export function sanitizeRoomRole(value) {
  if (ROOM_ROLES.includes(value)) {
    return value;
  }

  throw new Error('Room role is invalid.');
}

export function sanitizeModerationDuration(actionType, value) {
  const durations = MODERATION_DURATIONS[actionType] || [];
  const duration = durations.find((item) => item.value === value);

  if (!duration) {
    throw new Error('Moderation duration is invalid.');
  }

  return duration;
}

export function sanitizeReportDetails(value) {
  return normalizePlainText(value).slice(0, CHAT_LIMITS.REPORT_DETAILS_MAX_LENGTH).trim();
}

export function isValidSessionId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(value);
}

export function getMessageLimit() {
  return CHAT_LIMITS.MAX_MESSAGE_LENGTH;
}

function sanitizeMetadataValue(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map(sanitizeMetadataValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 12)
        .map(([key, entry]) => [
          String(key || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40),
          sanitizeMetadataValue(entry),
        ])
        .filter(([key]) => key),
    );
  }

  return normalizePlainText(value).slice(0, CHAT_LIMITS.MAX_CATEGORY_TOOL_METADATA_VALUE_LENGTH).trim();
}

function normalizePlainText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ');
}

function applyBadWordPlaceholder(value) {
  let filtered = value;

  for (const word of BAD_WORDS) {
    filtered = filtered.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, 'gi'), '[filtered]');
  }

  return filtered;
}

function hasExcessiveRepeatedCharacters(value) {
  const limit = CHAT_LIMITS.MAX_REPEATED_CHARACTER_RUN;
  return new RegExp(`(.)\\1{${limit},}`, 'u').test(value);
}

function countLinks(value) {
  return (value.match(/\b(?:https?:\/\/|www\.)\S+/gi) || []).length;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
