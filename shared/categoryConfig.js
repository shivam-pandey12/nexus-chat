export const GENERAL_CATEGORY_SAFETY_RULES = [
  'Be respectful.',
  'Do not spam.',
  'Do not share OTPs, passwords, phone numbers, addresses, payment details, or private documents.',
  'Report suspicious behavior.',
];

export const CATEGORY_FEATURE_HOOKS = [
  'focus_ready',
  'goal_ready',
  'match_ready',
  'event_ready',
  'code_friendly',
  'help_queue_ready',
  'idea_room_ready',
  'official_ready',
  'announcement_ready',
  'community_ready',
  'analytics_ready',
];

export const CATEGORY_TOOL_TYPES = [
  'focus_timer',
  'study_goal',
  'doubt_marker',
  'study_checklist',
  'code_snippet_mode',
  'bug_report_template',
  'secret_warning',
  'fix_solved_marker',
  'match_lobby',
  'match_invite',
  'score_post',
  'idea_board',
  'prompt_card',
  'feedback_request',
  'draft_pin',
  'help_queue',
  'solved_marker',
  'support_status',
  'priority_tag',
  'topic_spinner',
  'icebreaker_prompt',
  'quick_poll',
  'temporary_room_boost',
  'official_badge',
  'hub_link_panel',
  'product_feedback',
  'official_announcement',
];

export const CATEGORY_MESSAGE_TYPES = ['text', 'code_snippet', 'match_invite', 'score_card', 'topic_card', 'poll_card'];

export const CATEGORY_TOOL_STATUS = [
  'idle',
  'running',
  'paused',
  'completed',
  'open',
  'in_progress',
  'solved',
  'fixed',
  'closed',
  'received',
  'planned',
  'dismissed',
];

export const CATEGORY_TOOL_DEFINITIONS = {
  focus_timer: tool('focus_timer', 'Focus Timer', 'Shared focus sessions for Study rooms.', 'timer'),
  study_goal: tool('study_goal', 'Study Goal', 'A visible room goal that can be completed.', 'target'),
  doubt_marker: tool('doubt_marker', 'Doubt Marker', 'Track open and solved study doubts.', 'help'),
  study_checklist: tool('study_checklist', 'Study Checklist', 'Small checklist for session targets.', 'check'),
  code_snippet_mode: tool('code_snippet_mode', 'Code Snippet', 'Send safe plain-text code blocks.', 'code'),
  bug_report_template: tool('bug_report_template', 'Bug Template', 'Insert a structured debugging template.', 'bug'),
  secret_warning: tool('secret_warning', 'Secret Warning', 'Warn before credential-looking messages.', 'shield'),
  fix_solved_marker: tool('fix_solved_marker', 'Fix Found', 'Mark a thread or message as fixed.', 'check'),
  match_lobby: tool('match_lobby', 'Match Lobby', 'Create a lightweight player lobby card.', 'gamepad'),
  match_invite: tool('match_invite', 'Match Invite', 'Post a polished match invite card.', 'link'),
  score_post: tool('score_post', 'Score Card', 'Post a simple result card.', 'trophy'),
  idea_board: tool('idea_board', 'Idea Board', 'Collect short idea cards.', 'sparkles'),
  prompt_card: tool('prompt_card', 'Prompt Card', 'Pin a manually written creative prompt.', 'palette'),
  feedback_request: tool('feedback_request', 'Feedback Request', 'Ask for structured lightweight feedback.', 'message'),
  draft_pin: tool('draft_pin', 'Draft Pin', 'Pin one draft/message in room info.', 'pin'),
  help_queue: tool('help_queue', 'Help Queue', 'Track open support requests.', 'queue'),
  solved_marker: tool('solved_marker', 'Solved Marker', 'Mark support items solved.', 'check'),
  support_status: tool('support_status', 'Support Status', 'Show open/in-progress/solved states.', 'status'),
  priority_tag: tool('priority_tag', 'Priority Tag', 'Normal or urgent help priority.', 'alert'),
  topic_spinner: tool('topic_spinner', 'Topic Spinner', 'Post a safe static conversation topic.', 'shuffle'),
  icebreaker_prompt: tool('icebreaker_prompt', 'Icebreaker', 'Post a safe casual prompt.', 'sparkles'),
  quick_poll: tool('quick_poll', 'Quick Poll', 'Create a 2-4 option live poll.', 'poll'),
  temporary_room_boost: tool('temporary_room_boost', 'Temp Boost', 'Nudge quick room participation.', 'clock'),
  official_badge: tool('official_badge', 'Official Badge', 'Admin-only official MH Horizon signal.', 'badge'),
  hub_link_panel: tool('hub_link_panel', 'Hub Links', 'Show trusted MH Horizon hub links.', 'link'),
  product_feedback: tool('product_feedback', 'Product Feedback', 'Collect product bugs, ideas, and improvements.', 'message'),
  official_announcement: tool('official_announcement', 'Official Announcement', 'Stronger official announcement styling.', 'bell'),
};

export const SAFE_HUB_LINKS = [
  { id: 'gamehub', label: 'GameHub', url: 'https://mhhorizon.example/gamehub' },
  { id: 'focusforge', label: 'FocusForge', url: 'https://mhhorizon.example/focusforge' },
  { id: 'informative-hub', label: 'Informative Hub', url: 'https://mhhorizon.example/informative-hub' },
  { id: 'recipify-hub', label: 'Recipify Hub', url: 'https://mhhorizon.example/recipify' },
  { id: 'mockhorizon', label: 'MockHorizon', url: 'https://mhhorizon.example/mockhorizon' },
  { id: 'mh-horizon', label: 'MH Horizon', url: 'https://mhhorizon.example' },
];

export const STATIC_TOPIC_PROMPTS = [
  'What is one underrated game?',
  'What is the best study hack you actually use?',
  'Tea or coffee during deep work?',
  'What tiny feature makes an app feel premium?',
  'What is one project you want to finish this week?',
  'Which room theme fits today?',
  'What is a clean habit more people should try?',
  'What is one bug that taught you something?',
];

const CATEGORY_TOOL_ASSIGNMENTS = {
  study: {
    featureModules: ['study_focus', 'study_doubts'],
    enabledTools: ['focus_timer', 'study_goal', 'doubt_marker', 'study_checklist'],
    roomToolbarItems: ['focus_timer', 'study_goal', 'doubt_marker'],
    roomInfoSections: ['focus_timer', 'study_goal', 'doubt_marker', 'study_checklist'],
  },
  coding: {
    featureModules: ['coding_snippets', 'coding_safety'],
    enabledTools: ['code_snippet_mode', 'bug_report_template', 'secret_warning', 'fix_solved_marker'],
    roomToolbarItems: ['code_snippet_mode', 'bug_report_template', 'fix_solved_marker'],
    roomInfoSections: ['secret_warning', 'fix_solved_marker'],
  },
  gaming: {
    featureModules: ['gaming_match'],
    enabledTools: ['match_lobby', 'match_invite', 'score_post'],
    roomToolbarItems: ['match_lobby', 'match_invite', 'score_post'],
    roomInfoSections: ['match_lobby'],
  },
  creative: {
    featureModules: ['creative_board'],
    enabledTools: ['idea_board', 'prompt_card', 'feedback_request', 'draft_pin'],
    roomToolbarItems: ['idea_board', 'prompt_card', 'feedback_request'],
    roomInfoSections: ['idea_board', 'prompt_card', 'draft_pin'],
  },
  random: {
    featureModules: ['casual_engagement'],
    enabledTools: ['topic_spinner', 'icebreaker_prompt', 'quick_poll'],
    roomToolbarItems: ['topic_spinner', 'quick_poll'],
    roomInfoSections: ['quick_poll', 'topic_spinner'],
  },
  help: {
    featureModules: ['help_queue'],
    enabledTools: ['help_queue', 'solved_marker', 'support_status', 'priority_tag'],
    roomToolbarItems: ['help_queue', 'priority_tag', 'solved_marker'],
    roomInfoSections: ['help_queue', 'support_status'],
  },
  'mh-horizon': {
    featureModules: ['mh_official'],
    enabledTools: ['official_badge', 'hub_link_panel', 'product_feedback', 'official_announcement'],
    roomToolbarItems: ['hub_link_panel', 'product_feedback', 'official_announcement'],
    roomInfoSections: ['official_badge', 'hub_link_panel', 'product_feedback'],
  },
};

const CATEGORY_TOOL_LIMITS_BY_PLAN = {
  free: {
    activeToolsPerRoom: 18,
    activePolls: 1,
    ideaCards: 12,
    helpQueueItems: 12,
    studyChecklistItems: 8,
    matchLobbies: 1,
    productFeedbackItems: 20,
    focusTimerMaxMinutes: 60,
    customFocusTimer: false,
  },
  plus: {
    activeToolsPerRoom: 32,
    activePolls: 3,
    ideaCards: 30,
    helpQueueItems: 28,
    studyChecklistItems: 16,
    matchLobbies: 3,
    productFeedbackItems: 60,
    focusTimerMaxMinutes: 90,
    customFocusTimer: true,
  },
  pro: {
    activeToolsPerRoom: 60,
    activePolls: 6,
    ideaCards: 80,
    helpQueueItems: 60,
    studyChecklistItems: 30,
    matchLobbies: 6,
    productFeedbackItems: 150,
    focusTimerMaxMinutes: 180,
    customFocusTimer: true,
  },
  community: {
    activeToolsPerRoom: 120,
    activePolls: 12,
    ideaCards: 200,
    helpQueueItems: 150,
    studyChecklistItems: 60,
    matchLobbies: 12,
    productFeedbackItems: 400,
    focusTimerMaxMinutes: 240,
    customFocusTimer: true,
  },
};

const DEFAULT_TOOL_SETTINGS = {
  focus_timer: { optionsMinutes: [25, 45, 60], defaultMinutes: 25 },
  study_goal: { maxActive: 1 },
  doubt_marker: { statuses: ['open', 'solved'] },
  study_checklist: { maxItemsKey: 'studyChecklistItems' },
  quick_poll: { minOptions: 2, maxOptions: 4, maxActiveKey: 'activePolls' },
  match_lobby: { maxActiveKey: 'matchLobbies' },
  idea_board: { maxActiveKey: 'ideaCards' },
  help_queue: { maxActiveKey: 'helpQueueItems' },
  product_feedback: { maxActiveKey: 'productFeedbackItems' },
  hub_link_panel: { allowedLinks: SAFE_HUB_LINKS.map((link) => link.id) },
};

const CATEGORY_ADMIN_SAFETY_NOTES = {
  study: 'Watch for cheating requests, private document sharing, and scam tutoring.',
  coding: 'Watch for leaked secrets, suspicious credential requests, and unsafe off-platform support.',
  gaming: 'Watch for abuse, cheating promotion, and spam invites.',
  creative: 'Watch for harassment, plagiarism, and abusive feedback.',
  random: 'Watch for spam, sensitive personal prompts, and chaotic poll abuse.',
  help: 'Watch for OTP/password/payment requests and impersonated support.',
  'mh-horizon': 'Watch for impersonation, fake official claims, and suspicious hub links.',
};

export const ROOM_CATEGORIES = {
  study: {
    id: 'study',
    slug: 'study',
    label: 'Study',
    shortLabel: 'Study',
    description: 'Focused rooms for study sessions, doubts, revision, and exam preparation.',
    longDescription: 'Use Study rooms for focused sessions, doubt solving, revision planning, and group learning.',
    iconType: 'book',
    accentClass: 'category-study',
    themeClass: 'category-ambience-study',
    defaultRoomTheme: 'study_calm',
    defaultRules: [
      'Stay focused and respectful.',
      'Help others clearly and keep doubt solving honest.',
      'Do not encourage cheating or ask for private documents.',
    ],
    safetyReminder: 'Keep study discussions safe. Never share private personal details or exam scams.',
    roomTitleSuggestions: ['Night Study Sprint', 'JEE Doubt Room', 'Class 12 Revision Room', 'Focus Session'],
    roomDescriptionSuggestions: [
      'A focused room for solving doubts and staying productive.',
      'Join for a calm study session with clear goals.',
    ],
    defaultRoomTypeSuggestion: 'public',
    discoveryTags: ['study', 'revision', 'doubts', 'focus'],
    featureHooks: ['focus_ready', 'goal_ready', 'announcement_ready', 'event_ready', 'analytics_ready'],
    analyticsKey: 'study',
    notificationGroup: 'study_rooms',
    communityGroup: 'learning',
    allowedRoomTypes: ['public', 'private', 'temp', 'event'],
    premiumThemeSuggestions: ['study_calm', 'ivory_royale'],
    emptyStateTitle: 'No study rooms yet',
    emptyStateBody: 'Start a calm room for doubts, revision, or a focus sprint.',
    createRoomMicrocopy: 'Perfect for focused learning, doubt solving, and revision sessions.',
    adminDescription: 'Rooms focused on learning, revision, academic help, and study groups.',
  },
  coding: {
    id: 'coding',
    slug: 'coding',
    label: 'Coding',
    shortLabel: 'Code',
    description: 'Developer rooms for bugs, projects, review, and web building help.',
    longDescription: 'Use Coding rooms for project discussion, bug triage, code review conversations, and safer developer help.',
    iconType: 'code',
    accentClass: 'category-coding',
    themeClass: 'category-ambience-coding',
    defaultRoomTheme: 'soft_blue_glass',
    defaultRules: [
      'Explain code problems clearly and keep feedback constructive.',
      'Never share API keys, private keys, tokens, service account JSON, passwords, or credentials.',
      'Remove secrets before pasting logs or snippets.',
    ],
    safetyReminder: 'Coding help should stay credential-safe. Redact keys, tokens, secrets, and private configs.',
    roomTitleSuggestions: ['Bug Fix Help', 'Web Dev Support', 'Project Build Room', 'Code Review Chat'],
    roomDescriptionSuggestions: [
      'A developer room for debugging and practical project help.',
      'Bring the issue, not private credentials.',
    ],
    defaultRoomTypeSuggestion: 'public',
    discoveryTags: ['coding', 'debugging', 'web-dev', 'projects'],
    featureHooks: ['code_friendly', 'help_queue_ready', 'announcement_ready', 'analytics_ready'],
    analyticsKey: 'coding',
    notificationGroup: 'coding_rooms',
    communityGroup: 'builders',
    allowedRoomTypes: ['public', 'private', 'temp', 'event'],
    premiumThemeSuggestions: ['soft_blue_glass', 'study_calm'],
    emptyStateTitle: 'No coding rooms yet',
    emptyStateBody: 'Start a bug-fix room or a project discussion.',
    createRoomMicrocopy: 'Built for debugging, web projects, code reviews, and secret-safe help.',
    adminDescription: 'Developer support, project discussion, debugging, and code review rooms.',
  },
  gaming: {
    id: 'gaming',
    slug: 'gaming',
    label: 'Gaming',
    shortLabel: 'Gaming',
    description: 'Player rooms for GameHub, match chat, events, and game feedback.',
    longDescription: 'Use Gaming rooms for match coordination, tournaments, game feedback, and respectful player conversation.',
    iconType: 'gamepad',
    accentClass: 'category-gaming',
    themeClass: 'category-ambience-gaming',
    defaultRoomTheme: 'gamehub_arena',
    defaultRules: [
      'Keep match talk respectful.',
      'Do not promote cheating, harassment, or abusive rivalry.',
      'Avoid spam invites and suspicious off-platform links.',
    ],
    safetyReminder: 'Compete cleanly. Keep player talk respectful and avoid spammy invites.',
    roomTitleSuggestions: ['GameHub Players', 'Match Chat', 'Tournament Room', 'Game Feedback'],
    roomDescriptionSuggestions: [
      'A live player room for matches, tips, and game feedback.',
      'Keep the energy high and the chat clean.',
    ],
    defaultRoomTypeSuggestion: 'public',
    discoveryTags: ['gaming', 'gamehub', 'match', 'tournament'],
    featureHooks: ['match_ready', 'event_ready', 'announcement_ready', 'community_ready', 'analytics_ready'],
    analyticsKey: 'gaming',
    notificationGroup: 'gaming_rooms',
    communityGroup: 'players',
    allowedRoomTypes: ['public', 'private', 'temp', 'event'],
    premiumThemeSuggestions: ['gamehub_arena', 'midnight_gold'],
    emptyStateTitle: 'No gaming rooms live',
    emptyStateBody: 'Create a GameHub match chat or player event room.',
    createRoomMicrocopy: 'For player coordination, match chat, tournaments, and polished game feedback.',
    adminDescription: 'GameHub, player, match, tournament, and game feedback rooms.',
  },
  creative: {
    id: 'creative',
    slug: 'creative',
    label: 'Creative',
    shortLabel: 'Creative',
    description: 'Rooms for writing, design, stories, content planning, and ideas.',
    longDescription: 'Use Creative rooms for original ideas, writing prompts, design critique, and thoughtful feedback.',
    iconType: 'palette',
    accentClass: 'category-creative',
    themeClass: 'category-ambience-creative',
    defaultRoomTheme: 'ivory_royale',
    defaultRules: [
      'Respect original work and credit people clearly.',
      'Give feedback without harassment.',
      'Do not copy or repost work without permission.',
    ],
    safetyReminder: 'Protect creative work. Keep critique respectful and credit creators.',
    roomTitleSuggestions: ['Story Ideas', 'Design Feedback', 'Writing Room', 'Content Planning'],
    roomDescriptionSuggestions: [
      'A warm room for ideas, critique, and original work.',
      'Share drafts thoughtfully and respect creator ownership.',
    ],
    defaultRoomTypeSuggestion: 'public',
    discoveryTags: ['creative', 'writing', 'design', 'feedback'],
    featureHooks: ['idea_room_ready', 'announcement_ready', 'community_ready', 'analytics_ready'],
    analyticsKey: 'creative',
    notificationGroup: 'creative_rooms',
    communityGroup: 'creators',
    allowedRoomTypes: ['public', 'private', 'temp', 'event'],
    premiumThemeSuggestions: ['ivory_royale', 'study_calm'],
    emptyStateTitle: 'No creative rooms yet',
    emptyStateBody: 'Open a writing room, design critique, or idea lounge.',
    createRoomMicrocopy: 'A good fit for writing, design, story discussion, and thoughtful feedback.',
    adminDescription: 'Original work, writing, design, content planning, and creator feedback rooms.',
  },
  random: {
    id: 'random',
    slug: 'random',
    label: 'Random',
    shortLabel: 'Random',
    description: 'Casual rooms for quick talks and general conversation.',
    longDescription: 'Use Random rooms for lightweight conversation when another preset does not fit.',
    iconType: 'shuffle',
    accentClass: 'category-random',
    themeClass: 'category-ambience-random',
    defaultRoomTheme: 'classic',
    defaultRules: ['Keep casual chat respectful.', 'Do not spam or share private information.'],
    safetyReminder: 'Casual does not mean careless. Keep private information out of public chat.',
    roomTitleSuggestions: ['Chill Room', 'Quick Talk', 'Casual Chat', 'Open Lounge'],
    roomDescriptionSuggestions: [
      'A quick room for a clean, casual conversation.',
      'Drop in, talk respectfully, and keep personal details private.',
    ],
    defaultRoomTypeSuggestion: 'temp',
    discoveryTags: ['random', 'casual', 'quick-talk'],
    featureHooks: ['announcement_ready', 'analytics_ready'],
    analyticsKey: 'random',
    notificationGroup: 'random_rooms',
    communityGroup: 'general',
    allowedRoomTypes: ['public', 'private', 'temp', 'event'],
    premiumThemeSuggestions: ['classic', 'midnight_gold'],
    emptyStateTitle: 'No casual rooms yet',
    emptyStateBody: 'Create a quick room for a clean live conversation.',
    createRoomMicrocopy: 'For general chat, quick links, and temporary conversation spaces.',
    adminDescription: 'General-purpose and casual conversation rooms.',
  },
  help: {
    id: 'help',
    slug: 'help',
    label: 'Help',
    shortLabel: 'Help',
    description: 'Support-style rooms for questions, doubts, and problem solving.',
    longDescription: 'Use Help rooms for structured questions and support-style conversation without exposing private credentials.',
    iconType: 'help',
    accentClass: 'category-help',
    themeClass: 'category-ambience-help',
    defaultRoomTheme: 'soft_blue_glass',
    defaultRules: [
      'Ask clearly and help without pressuring people.',
      'Do not ask for OTPs, passwords, payment details, or private account access.',
      'Report suspicious support claims.',
    ],
    safetyReminder: 'Help rooms never need OTPs, passwords, payment details, or account access.',
    roomTitleSuggestions: ['Quick Help', 'Question Room', 'Problem Solving', 'Support Lounge'],
    roomDescriptionSuggestions: [
      'A focused room for questions and practical help.',
      'Solve the issue without sharing private access.',
    ],
    defaultRoomTypeSuggestion: 'public',
    discoveryTags: ['help', 'support', 'questions', 'problem-solving'],
    featureHooks: ['help_queue_ready', 'announcement_ready', 'analytics_ready'],
    analyticsKey: 'help',
    notificationGroup: 'help_rooms',
    communityGroup: 'support',
    allowedRoomTypes: ['public', 'private', 'temp', 'event'],
    premiumThemeSuggestions: ['soft_blue_glass', 'study_calm'],
    emptyStateTitle: 'No help rooms yet',
    emptyStateBody: 'Create a quick help room or a question space.',
    createRoomMicrocopy: 'Useful for support-style rooms, doubts, and structured problem solving.',
    adminDescription: 'Question, support, doubt, and help-oriented rooms.',
  },
  'mh-horizon': {
    id: 'mh-horizon',
    slug: 'mh-horizon',
    label: 'MH Horizon',
    shortLabel: 'MH',
    description: 'Official ecosystem discussion rooms for MH Horizon products and updates.',
    longDescription: 'Use MH Horizon rooms for ecosystem updates, product feedback, and official community conversation.',
    iconType: 'badge',
    accentClass: 'category-mh-horizon',
    themeClass: 'category-ambience-mh-horizon',
    defaultRoomTheme: 'midnight_gold',
    defaultRules: [
      'Follow official room rules and keep product feedback constructive.',
      'Do not impersonate MH Horizon staff or make fake official claims.',
      'Report suspicious links, billing claims, or support requests.',
    ],
    safetyReminder: 'Official discussion should stay trustworthy. Watch for impersonation and fake support claims.',
    roomTitleSuggestions: ['Official Updates', 'Product Feedback', 'GameHub Discussion', 'FocusForge Discussion'],
    roomDescriptionSuggestions: [
      'A trusted MH Horizon room for updates and feedback.',
      'Discuss the ecosystem without impersonation or fake claims.',
    ],
    defaultRoomTypeSuggestion: 'public',
    discoveryTags: ['mh-horizon', 'official', 'feedback', 'updates'],
    featureHooks: ['official_ready', 'announcement_ready', 'community_ready', 'analytics_ready'],
    analyticsKey: 'mh_horizon',
    notificationGroup: 'mh_horizon_rooms',
    communityGroup: 'mh_horizon',
    allowedRoomTypes: ['public', 'private', 'temp', 'event'],
    premiumThemeSuggestions: ['midnight_gold', 'ivory_royale'],
    emptyStateTitle: 'No MH Horizon rooms live',
    emptyStateBody: 'Create an ecosystem discussion or product feedback room.',
    createRoomMicrocopy: 'For trusted MH Horizon updates, ecosystem discussion, and product feedback.',
    adminDescription: 'MH Horizon ecosystem, official updates, and product feedback rooms.',
  },
};

export const ROOM_CATEGORY_TEMPLATES = {
  study: [
    createTemplate('study-focus-sprint', 'study', 'Focus Sprint', 'A calm sprint with a shared focus window.', 'temp', ['Stay on topic for the session.', 'Share goals clearly.'], 'study_calm', ['focus_ready', 'goal_ready'], 'Keep the sprint productive and private details off chat.'),
    createTemplate('study-doubt-solving', 'study', 'Doubt Solving', 'A study room for respectful question solving.', 'public', ['Explain doubts clearly.', 'Do not encourage cheating.'], 'study_calm', ['help_queue_ready'], 'Do not share private documents or exam credentials.'),
    createTemplate('study-revision-room', 'study', 'Revision Room', 'A revision space before a test or class.', 'public', ['Keep revision discussion focused.', 'Correct mistakes respectfully.'], 'ivory_royale', ['goal_ready', 'event_ready'], 'Use safe study resources only.'),
    createTemplate('study-exam-prep', 'study', 'Exam Prep', 'A preparation room for plans, doubts, and revision.', 'private', ['Respect study plans.', 'Avoid cheating requests.'], 'study_calm', ['goal_ready'], 'Never share personal documents or payment details.'),
  ],
  coding: [
    createTemplate('coding-bug-fix', 'coding', 'Bug Fix Help', 'A focused debugging room.', 'public', ['Share reproducible details.', 'Redact credentials before posting logs.'], 'soft_blue_glass', ['code_friendly', 'help_queue_ready'], 'Never paste API keys, tokens, or private keys.'),
    createTemplate('coding-project-discussion', 'coding', 'Project Discussion', 'A room for architecture and implementation talk.', 'private', ['Keep project feedback constructive.'], 'soft_blue_glass', ['code_friendly'], 'Review private code sharing boundaries first.'),
    createTemplate('coding-code-review', 'coding', 'Code Review Room', 'A lightweight review conversation.', 'public', ['Review code respectfully.', 'Do not expose secrets.'], 'soft_blue_glass', ['code_friendly'], 'Remove credentials from snippets and screenshots.'),
    createTemplate('coding-web-dev-support', 'coding', 'Web Dev Support', 'Frontend and backend help with clean context.', 'public', ['State the browser/server issue clearly.'], 'study_calm', ['code_friendly', 'help_queue_ready'], 'Service account JSON and private env values stay private.'),
  ],
  gaming: [
    createTemplate('gaming-match-chat', 'gaming', 'Match Chat', 'Player coordination during a match.', 'temp', ['Keep match talk respectful.'], 'gamehub_arena', ['match_ready'], 'No cheating promotion or abusive match talk.'),
    createTemplate('gaming-tournament-room', 'gaming', 'Tournament Room', 'A room for event chatter and updates.', 'public', ['Follow host rules.', 'Avoid spam invites.'], 'gamehub_arena', ['match_ready', 'event_ready', 'announcement_ready'], 'Use trusted event links only.'),
    createTemplate('gaming-feedback', 'gaming', 'Game Feedback', 'A clean feedback room for gameplay notes.', 'public', ['Critique the game, not the player.'], 'midnight_gold', ['analytics_ready'], 'Report abuse instead of escalating it.'),
    createTemplate('gaming-gamehub-players', 'gaming', 'GameHub Players', 'A player room for GameHub conversation.', 'public', ['Keep the room welcoming.'], 'gamehub_arena', ['community_ready'], 'Avoid spammy invites and suspicious links.'),
  ],
  creative: [
    createTemplate('creative-story-ideas', 'creative', 'Story Ideas', 'A warm space for story sparks.', 'public', ['Respect original ideas.'], 'ivory_royale', ['idea_room_ready'], 'Credit creators before resharing work.'),
    createTemplate('creative-design-feedback', 'creative', 'Design Feedback', 'A room for critique and iteration.', 'public', ['Be specific and kind with feedback.'], 'ivory_royale', ['idea_room_ready'], 'No harassment over creative taste.'),
    createTemplate('creative-writing-room', 'creative', 'Writing Room', 'A focused writing conversation.', 'private', ['Respect drafts and ownership.'], 'study_calm', ['goal_ready', 'idea_room_ready'], 'Do not copy work without permission.'),
    createTemplate('creative-content-planning', 'creative', 'Content Planning', 'Plan posts, videos, and creative releases.', 'private', ['Keep planning organized.'], 'ivory_royale', ['announcement_ready'], 'Keep personal and brand details safe.'),
  ],
  random: [
    createTemplate('random-chill-room', 'random', 'Chill Room', 'A casual live conversation.', 'public', ['Keep it respectful.'], 'classic', [], 'Public chat still needs safe boundaries.'),
    createTemplate('random-quick-talk', 'random', 'Quick Talk', 'A short temporary room.', 'temp', ['Do not spam.'], 'classic', [], 'Avoid sharing personal details in quick rooms.'),
    createTemplate('random-casual-chat', 'random', 'Casual Chat', 'A general room for clean conversation.', 'public', ['Be welcoming.'], 'midnight_gold', ['announcement_ready'], 'Report suspicious behavior.'),
  ],
  help: [
    createTemplate('help-quick-help', 'help', 'Quick Help', 'A short room for one clear question.', 'temp', ['Ask clearly.', 'Do not request private access.'], 'soft_blue_glass', ['help_queue_ready'], 'OTP, password, and payment details are never needed.'),
    createTemplate('help-support-room', 'help', 'Support Room', 'A support-style room with safer boundaries.', 'public', ['Keep the issue and response clear.'], 'soft_blue_glass', ['help_queue_ready', 'announcement_ready'], 'Report impersonation or suspicious support claims.'),
    createTemplate('help-question-room', 'help', 'Question Room', 'A room for focused questions.', 'public', ['Stay on the question.'], 'study_calm', ['help_queue_ready'], 'Never hand over account credentials.'),
    createTemplate('help-problem-solving', 'help', 'Problem Solving', 'Collaborate on a practical issue.', 'private', ['Solve respectfully.'], 'soft_blue_glass', ['help_queue_ready'], 'Private information stays out of shared rooms.'),
  ],
  'mh-horizon': [
    createTemplate('mh-official-updates', 'mh-horizon', 'Official Updates', 'A room for MH Horizon updates.', 'public', ['Follow official room rules.'], 'midnight_gold', ['official_ready', 'announcement_ready'], 'Watch for impersonation and fake official claims.'),
    createTemplate('mh-product-feedback', 'mh-horizon', 'Product Feedback', 'Collect useful ecosystem feedback.', 'public', ['Keep feedback constructive.'], 'ivory_royale', ['official_ready', 'analytics_ready'], 'Report suspicious billing or support claims.'),
    createTemplate('mh-gamehub-discussion', 'mh-horizon', 'GameHub Discussion', 'Discuss GameHub inside MH Horizon.', 'public', ['Keep discussion on product experience.'], 'gamehub_arena', ['official_ready', 'community_ready'], 'Use trusted MH Horizon references only.'),
    createTemplate('mh-focusforge-discussion', 'mh-horizon', 'FocusForge Discussion', 'Talk about focus and study experiences.', 'public', ['Share helpful product feedback.'], 'study_calm', ['official_ready', 'goal_ready'], 'Do not share private study records or account details.'),
    createTemplate('mh-informative-hub', 'mh-horizon', 'Informative Hub Discussion', 'A clean ecosystem info room.', 'public', ['Do not impersonate staff.'], 'midnight_gold', ['official_ready', 'announcement_ready'], 'Verify claims before sharing them.'),
  ],
};

const CATEGORY_ALIASES = Object.freeze({
  study: 'study',
  coding: 'coding',
  code: 'coding',
  gaming: 'gaming',
  game: 'gaming',
  creative: 'creative',
  random: 'random',
  casual: 'random',
  general: 'random',
  help: 'help',
  support: 'help',
  mhhorizon: 'mh-horizon',
  'mh-horizon': 'mh-horizon',
});

export function normalizeCategory(input) {
  const token = categoryToken(input);
  return CATEGORY_ALIASES[token] || (ROOM_CATEGORIES[token] ? token : 'random');
}

export function getCategoryConfig(category) {
  return decorateCategory(ROOM_CATEGORIES[normalizeCategory(category)] || ROOM_CATEGORIES.random);
}

export function getCategoryLabel(category) {
  return getCategoryConfig(category).label;
}

export function getCategorySlug(category) {
  return getCategoryConfig(category).slug;
}

export function getCategoryThemeClass(category) {
  return getCategoryConfig(category).themeClass;
}

export function getCategoryDefaultRules(category, { includeGeneral = true } = {}) {
  const rules = [...(includeGeneral ? GENERAL_CATEGORY_SAFETY_RULES : []), ...getCategoryConfig(category).defaultRules];
  return [...new Set(rules)];
}

export function getCategoryFeatureHooks(category) {
  return getCategoryConfig(category).featureHooks.filter((hook) => CATEGORY_FEATURE_HOOKS.includes(hook));
}

export function isValidCategory(category) {
  const token = categoryToken(category);
  return Boolean(CATEGORY_ALIASES[token] || ROOM_CATEGORIES[token]);
}

export function getCategoryOptions() {
  return Object.values(ROOM_CATEGORIES).map((category) => decorateCategory(category));
}

export function getCategoryForAnalytics(category) {
  return getCategoryConfig(category).analyticsKey;
}

export function getCategoryForNotificationGroup(category) {
  return getCategoryConfig(category).notificationGroup;
}

export function getCategoryRoomTemplates(category) {
  return (ROOM_CATEGORY_TEMPLATES[getCategorySlug(category)] || []).map((template) => ({ ...template }));
}

export function getRoomTemplate(templateId, category = '') {
  const cleanTemplateId = String(templateId || '').trim();
  const templates = category
    ? getCategoryRoomTemplates(category)
    : Object.values(ROOM_CATEGORY_TEMPLATES).flat();
  return templates.find((template) => template.templateId === cleanTemplateId) || null;
}

export function isValidRoomTemplate(templateId, category = '') {
  return Boolean(getRoomTemplate(templateId, category));
}

export function getCategoryTools(category) {
  const config = getCategoryConfig(category);
  return config.enabledTools
    .map((toolType) => getToolConfig(toolType))
    .filter(Boolean);
}

export function isToolEnabledForCategory(toolType, category) {
  const cleanToolType = String(toolType || '').trim();
  return CATEGORY_TOOL_TYPES.includes(cleanToolType) && getCategoryConfig(category).enabledTools.includes(cleanToolType);
}

export function getToolConfig(toolType) {
  const cleanToolType = String(toolType || '').trim();
  const definition = CATEGORY_TOOL_DEFINITIONS[cleanToolType];

  return definition ? { ...definition } : null;
}

export function getDefaultToolSettings(categoryOrToolType, maybeToolType = '') {
  const toolType = maybeToolType || categoryOrToolType;
  const settings = DEFAULT_TOOL_SETTINGS[toolType] || {};
  return { ...settings };
}

export function getToolLimitsForPlan(planTier = 'free') {
  return {
    ...CATEGORY_TOOL_LIMITS_BY_PLAN.free,
    ...(CATEGORY_TOOL_LIMITS_BY_PLAN[planTier] || {}),
  };
}

export function getSafeHubLinks(ids = []) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return SAFE_HUB_LINKS.map((link) => ({ ...link }));
  }

  const wanted = new Set(ids.map((id) => String(id || '').trim()).filter(Boolean));
  return SAFE_HUB_LINKS.filter((link) => wanted.has(link.id)).map((link) => ({ ...link }));
}

export function detectCodingSecretRisk(value = '') {
  const text = String(value || '');
  const matches = [
    ['api_key', /\b(api[_-]?key|apikey)\s*[:=]/i],
    ['private_key', /-----BEGIN\s+(RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE KEY-----/i],
    ['firebase_service_account', /\b(service_account|private_key_id|client_email)\b/i],
    ['token', /\b(access[_-]?token|refresh[_-]?token|secret[_-]?token|token)\s*[:=]/i],
    ['password', /\b(password|passwd|pwd)\s*[:=]/i],
  ]
    .filter(([, pattern]) => pattern.test(text))
    .map(([label]) => label);

  return {
    risk: matches.length > 0,
    severity: matches.some((label) => ['private_key', 'firebase_service_account'].includes(label)) ? 'high' : matches.length ? 'medium' : 'none',
    labels: matches.slice(0, 4),
  };
}

function decorateCategory(category) {
  const assignment = CATEGORY_TOOL_ASSIGNMENTS[category.slug] || CATEGORY_TOOL_ASSIGNMENTS.random;
  const enabledTools = assignment.enabledTools.filter((toolType) => CATEGORY_TOOL_TYPES.includes(toolType));

  return {
    ...category,
    featureModules: [...assignment.featureModules],
    enabledTools,
    defaultToolSettings: Object.fromEntries(enabledTools.map((toolType) => [toolType, getDefaultToolSettings(toolType)])),
    premiumToolGates: {},
    adminSafetyNotes: CATEGORY_ADMIN_SAFETY_NOTES[category.slug] || CATEGORY_ADMIN_SAFETY_NOTES.random,
    roomToolbarItems: assignment.roomToolbarItems.filter((toolType) => enabledTools.includes(toolType)),
    roomInfoSections: assignment.roomInfoSections.filter((toolType) => enabledTools.includes(toolType)),
  };
}

function tool(toolType, label, description, iconType) {
  return {
    toolType,
    label,
    title: label,
    description,
    iconType,
  };
}

function createTemplate(
  templateId,
  category,
  title,
  description,
  suggestedRoomType,
  suggestedRules,
  suggestedTheme,
  featureHooks,
  safetyNote,
) {
  return {
    templateId,
    category,
    title,
    description,
    suggestedRoomType,
    suggestedRules,
    suggestedTheme,
    featureHooks,
    defaultAnnouncement: '',
    safetyNote,
  };
}

function categoryToken(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}
