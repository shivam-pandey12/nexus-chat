import { CATEGORY_MESSAGE_TYPES, CATEGORY_TOOL_TYPES, getCategoryOptions } from './categoryConfig.js';

export const ROOM_CATEGORIES = getCategoryOptions().map((category) => category.label);

export const COMMUNITY_CATEGORIES = getCategoryOptions().map((category) => category.label);

export { CATEGORY_MESSAGE_TYPES, CATEGORY_TOOL_TYPES };

export const COMMUNITY_VISIBILITIES = ['public', 'private', 'unlisted'];

export const COMMUNITY_ROLES = ['owner', 'admin', 'moderator', 'member'];

export const COMMUNITY_RESERVED_SLUGS = [
  'admin',
  'pricing',
  'billing',
  'store',
  'api',
  'support',
  'safety',
  'mh-horizon',
  'nexus',
];

export const EVENT_STATUSES = ['scheduled', 'live', 'ended', 'cancelled'];

export const EVENT_RSVP_STATUSES = ['interested', 'going', 'cancelled'];

export const SCHEDULED_ANNOUNCEMENT_STATUSES = ['draft', 'scheduled', 'published', 'cancelled'];

export const SCHEDULED_ANNOUNCEMENT_TARGETS = ['room', 'community', 'event'];

export const REACTION_EMOJIS = ['👍', '😂', '❤️', '🔥', '👀'];

export const REPORT_REASONS = [
  'Spam',
  'Harassment',
  'Hate or abuse',
  'Inappropriate content',
  'Scam or suspicious behavior',
  'Other',
];

export const REPORT_STATUSES = ['open', 'reviewed', 'dismissed', 'actioned'];

export const FEEDBACK_TYPES = [
  'feedback',
  'bug_report',
  'abuse_safety_concern',
  'billing_issue',
  'feature_suggestion',
];

export const FEEDBACK_STATUSES = ['open', 'reviewed', 'resolved', 'dismissed'];

export const MODERATION_ACTION_TYPES = [
  'mute',
  'unmute',
  'kick',
  'ban',
  'unban',
  'role_change',
  'delete_message',
  'clear_messages',
  'close_room',
  'report_action',
  'billing_action',
  'community_action',
  'event_action',
  'scheduled_announcement_action',
  'system_notice',
];

export const NOTIFICATION_TYPES = [
  'mention',
  'reply',
  'room_announcement',
  'moderation_action',
  'report_status',
  'room_invite_or_join_activity',
  'billing_status',
  'system_notice',
  'community_invite',
  'community_announcement',
  'event_starting',
  'event_live',
  'event_cancelled',
  'community_role_changed',
  'community_report_status',
];

export const NOTIFICATION_PREFERENCES = {
  mentions: true,
  replies: true,
  roomAnnouncements: true,
  moderationUpdates: true,
  reportUpdates: true,
  billingStatus: true,
  systemNotices: true,
  communityAnnouncements: true,
  eventReminders: true,
  communityActivity: true,
  pushEnabled: false,
  pushMentions: true,
  pushReplies: true,
  pushAnnouncements: true,
  pushEventReminders: true,
  pushSafetyUpdates: true,
  pushBillingSystem: true,
};

export const ROOM_ACTIVITY_TYPES = [
  'room_created',
  'user_joined',
  'announcement_posted',
  'room_renamed',
  'room_locked',
  'room_unlocked',
  'role_changed',
  'moderation_action',
  'theme_changed',
  'room_deleted',
  'category_tool_created',
  'category_tool_updated',
  'category_tool_completed',
  'system_notice',
];

export const COMMUNITY_ACTIVITY_TYPES = [
  'community_created',
  'member_joined',
  'member_left',
  'role_changed',
  'room_created',
  'room_closed',
  'announcement_posted',
  'event_created',
  'event_cancelled',
  'moderation_action',
  'community_deleted',
  'system_notice',
];

export const ROOM_SNOOZE_OPTIONS = [
  { label: '1 hour', value: '1h', ms: 60 * 60 * 1000 },
  { label: '8 hours', value: '8h', ms: 8 * 60 * 60 * 1000 },
  { label: '24 hours', value: '24h', ms: 24 * 60 * 60 * 1000 },
  { label: 'Until I unmute', value: 'manual', ms: null },
];

export const ROOM_ROLES = ['owner', 'moderator', 'member'];

export const MODERATION_DURATIONS = {
  mute: [
    { label: 'Room session', value: 'session', ms: 0 },
    { label: '5 minutes', value: '5m', ms: 5 * 60 * 1000 },
    { label: '15 minutes', value: '15m', ms: 15 * 60 * 1000 },
    { label: '1 hour', value: '1h', ms: 60 * 60 * 1000 },
  ],
  kick: [{ label: 'Short cooldown', value: 'cooldown', ms: 2 * 60 * 1000 }],
  ban: [
    { label: '24 hours', value: '24h', ms: 24 * 60 * 60 * 1000 },
    { label: '7 days', value: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
    { label: 'Until removed', value: 'permanent', ms: null },
  ],
};

export const CHAT_LIMITS = {
  MAX_MESSAGES_PER_ROOM: 300,
  MAX_PERSISTED_MESSAGES_PER_ROOM: 1000,
  PERSISTED_MESSAGE_LOAD_LIMIT: 100,
  MAX_ACTIVE_PUBLIC_ROOMS: 80,
  MAX_ONLINE_USERS_PER_ROOM: 750,
  MAX_DISPLAY_NAME_LENGTH: 24,
  MIN_DISPLAY_NAME_LENGTH: 2,
  MAX_ROOM_TITLE_LENGTH: 54,
  MAX_CATEGORY_LENGTH: 32,
  MAX_HANDLE_LENGTH: 24,
  MIN_HANDLE_LENGTH: 3,
  MAX_PROFILE_STATUS_LENGTH: 160,
  MAX_ROOM_RULES_LENGTH: 600,
  MAX_MESSAGE_LENGTH: 500,
  MAX_REPLY_SNIPPET_LENGTH: 88,
  MESSAGE_COOLDOWN_MS: 750,
  MESSAGE_RATE_WINDOW_MS: 7000,
  MESSAGE_RATE_MAX: 8,
  REPEATED_MESSAGE_WINDOW_MS: 12000,
  REPEATED_MESSAGE_MAX: 2,
  REPORT_DETAILS_MAX_LENGTH: 400,
  REPORT_COOLDOWN_MS: 60000,
  REPORT_RATE_WINDOW_MS: 600000,
  REPORT_RATE_MAX: 5,
  MAX_REPORTS_IN_MEMORY: 500,
  MAX_FEEDBACK_LOAD: 120,
  MAX_FEEDBACK_TITLE_LENGTH: 90,
  MAX_FEEDBACK_MESSAGE_LENGTH: 1200,
  MAX_FEEDBACK_CONTEXT_LENGTH: 180,
  MAX_FEEDBACK_EMAIL_LENGTH: 180,
  MAX_FEEDBACK_NAME_LENGTH: 48,
  MAX_FEEDBACK_USER_AGENT_LENGTH: 240,
  MAX_MODERATION_LOGS_IN_MEMORY: 500,
  MAX_ROOM_MEMBERS_QUERY: 200,
  MAX_MY_ROOMS_QUERY: 120,
  MAX_BLOCKED_USERS_QUERY: 200,
  MAX_ADMIN_USERS_QUERY: 250,
  MAX_NOTIFICATIONS_LOAD: 50,
  MAX_NOTIFICATION_BODY_LENGTH: 240,
  MAX_NOTIFICATION_TITLE_LENGTH: 90,
  MAX_ROOM_ACTIVITY_LOAD: 50,
  MAX_ANNOUNCEMENT_HISTORY_LOAD: 20,
  MAX_ACTIVE_ANNOUNCEMENTS_PER_ROOM: 8,
  MAX_ANNOUNCEMENT_TITLE_LENGTH: 80,
  MAX_ANNOUNCEMENT_BODY_LENGTH: 600,
  MAX_CATEGORY_TOOLS_LOAD: 60,
  MAX_CATEGORY_TOOL_TITLE_LENGTH: 90,
  MAX_CATEGORY_TOOL_BODY_LENGTH: 1200,
  MAX_CATEGORY_TOOL_METADATA_FIELDS: 16,
  MAX_CATEGORY_TOOL_METADATA_VALUE_LENGTH: 500,
  MAX_CATEGORY_TOOL_OPTIONS: 4,
  MAX_CATEGORY_TOOL_OPTION_LENGTH: 80,
  MAX_CODE_SNIPPET_LENGTH: 4000,
  MAX_CARD_MESSAGE_BODY_LENGTH: 1200,
  MAX_SCORE_LABEL_LENGTH: 42,
  MAX_SCORE_VALUE_LENGTH: 24,
  MAX_COMMUNITY_NAME_LENGTH: 56,
  MIN_COMMUNITY_NAME_LENGTH: 3,
  MAX_COMMUNITY_SLUG_LENGTH: 40,
  MIN_COMMUNITY_SLUG_LENGTH: 3,
  MAX_COMMUNITY_DESCRIPTION_LENGTH: 420,
  MAX_COMMUNITY_RULES_LENGTH: 900,
  MAX_COMMUNITY_TAGS: 8,
  MAX_COMMUNITY_TAG_LENGTH: 24,
  MAX_COMMUNITIES_LOAD: 60,
  MAX_COMMUNITY_MEMBERS_LOAD: 200,
  MAX_COMMUNITY_ROOMS_LOAD: 50,
  MAX_COMMUNITY_ACTIVITY_LOAD: 50,
  MAX_COMMUNITY_ANNOUNCEMENTS_LOAD: 20,
  MAX_ACTIVE_COMMUNITY_ANNOUNCEMENTS: 8,
  MAX_EVENT_TITLE_LENGTH: 80,
  MAX_EVENT_DESCRIPTION_LENGTH: 500,
  MAX_EVENTS_LOAD: 60,
  MAX_RSVP_LOAD: 200,
  MAX_SCHEDULED_ANNOUNCEMENTS_LOAD: 50,
  MAX_DUE_SCHEDULED_ANNOUNCEMENTS_PER_TICK: 25,
  MAX_SCHEDULED_ANNOUNCEMENT_TITLE_LENGTH: 90,
  MAX_SCHEDULED_ANNOUNCEMENT_BODY_LENGTH: 700,
  MAX_MENTIONS_PER_MESSAGE: 8,
  MAX_UNREAD_FANOUT_PER_MESSAGE: 750,
  KICK_REJOIN_COOLDOWN_MS: 120000,
  CLEAR_RECENT_MESSAGE_COUNT: 50,
  MAX_LINKS_PER_MESSAGE: 2,
  MAX_REPEATED_CHARACTER_RUN: 18,
  TYPING_TTL_MS: 3200,
  TYPING_THROTTLE_MS: 900,
};

export const RATE_LIMITS = {
  messages: [
    { windowMs: CHAT_LIMITS.MESSAGE_RATE_WINDOW_MS, max: CHAT_LIMITS.MESSAGE_RATE_MAX },
    { windowMs: CHAT_LIMITS.MESSAGE_COOLDOWN_MS, max: 1 },
  ],
  roomCreate: [
    { windowMs: 60 * 1000, max: 5 },
    { windowMs: 60 * 60 * 1000, max: 25 },
  ],
  communityCreate: [
    { windowMs: 60 * 1000, max: 5 },
    { windowMs: 60 * 60 * 1000, max: 25 },
  ],
  reports: [
    { windowMs: 60 * 1000, max: 3 },
    { windowMs: 60 * 60 * 1000, max: 15 },
  ],
  feedback: [
    { windowMs: 60 * 1000, max: 3 },
    { windowMs: 60 * 60 * 1000, max: 12 },
  ],
  reactions: [{ windowMs: 60 * 1000, max: 60 }],
  typing: [{ windowMs: 60 * 1000, max: 30 }],
  announcements: [
    { windowMs: 60 * 1000, max: 5 },
    { windowMs: 60 * 60 * 1000, max: 30 },
  ],
  categoryTools: [
    { windowMs: 60 * 1000, max: 18 },
    { windowMs: 60 * 60 * 1000, max: 120 },
  ],
  categoryToolVotes: [{ windowMs: 60 * 1000, max: 45 }],
  categoryToolTimers: [{ windowMs: 60 * 1000, max: 12 }],
  categoryToolUrgent: [{ windowMs: 10 * 60 * 1000, max: 3 }],
  categoryCardMessages: [{ windowMs: 60 * 1000, max: 18 }],
  events: [
    { windowMs: 60 * 1000, max: 5 },
    { windowMs: 60 * 60 * 1000, max: 25 },
  ],
  rsvp: [{ windowMs: 60 * 1000, max: 20 }],
  paymentOrders: [{ windowMs: 10 * 60 * 1000, max: 3 }],
  profileChanges: [{ windowMs: 15 * 60 * 1000, max: 20 }],
  pushTokens: [{ windowMs: 15 * 60 * 1000, max: 12 }],
  adminFailedAttempts: [{ windowMs: 15 * 60 * 1000, max: 5 }],
};

export const TEMP_ROOM_EXPIRY_OPTIONS = [
  { label: '1 hour', value: '1h', ms: 60 * 60 * 1000 },
  { label: '6 hours', value: '6h', ms: 6 * 60 * 60 * 1000 },
  { label: '24 hours', value: '24h', ms: 24 * 60 * 60 * 1000 },
  { label: '7 days', value: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
];

export const DEFAULT_TEMP_ROOM_EXPIRY_MS = TEMP_ROOM_EXPIRY_OPTIONS[2].ms;
