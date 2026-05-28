export const PLAN_TIERS = ['free', 'plus', 'pro', 'community'];

export const ROOM_THEME_PRESETS = [
  {
    themeId: 'classic',
    title: 'Classic Ivory',
    productId: null,
    description: 'The default MH Horizon ivory and graphite room style.',
    swatches: ['#fffaf0', '#d8b46a', '#25211a'],
  },
  {
    themeId: 'ivory_royale',
    title: 'Ivory Royale',
    productId: 'cosmetic_room_theme_ivory_royale',
    description: 'Warm ivory glass, gold trim, and soft editorial depth.',
    swatches: ['#fff7e4', '#c89d47', '#3b2b18'],
  },
  {
    themeId: 'midnight_gold',
    title: 'Midnight Gold',
    productId: 'cosmetic_room_theme_midnight_gold',
    description: 'Deep black glass with restrained gold and charcoal layers.',
    swatches: ['#070707', '#d6a94d', '#2b2419'],
  },
  {
    themeId: 'soft_blue_glass',
    title: 'Soft Blue Glass',
    productId: 'nexus_pro_monthly',
    description: 'Cool blue highlights over premium dark translucent panels.',
    swatches: ['#08111f', '#8ecaff', '#d9e8ff'],
  },
  {
    themeId: 'study_calm',
    title: 'Study Calm',
    productId: 'nexus_plus_monthly',
    description: 'Quiet beige, sage, and paper tones for focused rooms.',
    swatches: ['#fbf4df', '#93a883', '#3d4034'],
  },
  {
    themeId: 'gamehub_arena',
    title: 'GameHub Arena',
    productId: 'nexus_community_monthly',
    description: 'Polished arena contrast with ember-gold highlights.',
    swatches: ['#11100f', '#d77b41', '#f4d38a'],
  },
];

export const PROFILE_COSMETICS = [
  {
    cosmeticId: 'avatar_ring_gold',
    productId: 'cosmetic_avatar_ring_gold',
    title: 'Golden Orbit Ring',
    type: 'profileRing',
  },
  {
    cosmeticId: 'early_supporter',
    productId: 'cosmetic_early_supporter_badge',
    title: 'Early Supporter Badge',
    type: 'badge',
  },
];

export const PLAN_LIMITS = {
  free: {
    activeRooms: 3,
    favorites: 10,
    roomMembers: 25,
    tempDurations: ['1h', '6h', '24h'],
    maxModeratorsPerRoom: 1,
    activeAnnouncements: 1,
    permanentRooms: 3,
    roomAnalytics: false,
    customInviteSlug: false,
    priorityListing: false,
    roomThemes: ['classic'],
    communities: 1,
    roomsPerCommunity: 3,
    communityMembers: 100,
    scheduledAnnouncements: 1,
    activeEventRooms: 1,
    eventRsvpCapacity: 50,
    communityCoverThemes: ['classic'],
    featuredCommunity: false,
    communityAnalytics: false,
    categoryTools: {
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
  },
  plus: {
    activeRooms: 12,
    favorites: 50,
    roomMembers: 100,
    tempDurations: ['1h', '6h', '24h'],
    maxModeratorsPerRoom: 4,
    activeAnnouncements: 3,
    permanentRooms: 8,
    roomAnalytics: false,
    customInviteSlug: false,
    priorityListing: true,
    roomThemes: ['classic', 'study_calm'],
    communities: 3,
    roomsPerCommunity: 10,
    communityMembers: 250,
    scheduledAnnouncements: 3,
    activeEventRooms: 3,
    eventRsvpCapacity: 150,
    communityCoverThemes: ['classic', 'study_calm'],
    featuredCommunity: false,
    communityAnalytics: false,
    categoryTools: {
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
  },
  pro: {
    activeRooms: 30,
    favorites: 150,
    roomMembers: 300,
    tempDurations: ['1h', '6h', '24h', '7d'],
    maxModeratorsPerRoom: 8,
    activeAnnouncements: 5,
    permanentRooms: 20,
    roomAnalytics: true,
    customInviteSlug: true,
    priorityListing: true,
    roomThemes: ['classic', 'study_calm', 'soft_blue_glass'],
    communities: 10,
    roomsPerCommunity: 25,
    communityMembers: 750,
    scheduledAnnouncements: 8,
    activeEventRooms: 10,
    eventRsvpCapacity: 400,
    communityCoverThemes: ['classic', 'study_calm', 'soft_blue_glass', 'midnight_gold'],
    featuredCommunity: true,
    communityAnalytics: true,
    categoryTools: {
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
  },
  community: {
    activeRooms: 80,
    favorites: 300,
    roomMembers: 750,
    tempDurations: ['1h', '6h', '24h', '7d'],
    maxModeratorsPerRoom: 20,
    activeAnnouncements: 8,
    permanentRooms: 60,
    roomAnalytics: true,
    customInviteSlug: true,
    priorityListing: true,
    roomThemes: ['classic', 'study_calm', 'soft_blue_glass', 'gamehub_arena'],
    communities: 25,
    roomsPerCommunity: 60,
    communityMembers: 1500,
    scheduledAnnouncements: 20,
    activeEventRooms: 25,
    eventRsvpCapacity: 1000,
    communityCoverThemes: ['classic', 'study_calm', 'soft_blue_glass', 'midnight_gold', 'gamehub_arena', 'ivory_royale'],
    featuredCommunity: true,
    communityAnalytics: true,
    categoryTools: {
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
  },
};

export const PRODUCT_CATALOG = [
  {
    productId: 'nexus_plus_monthly',
    title: 'Nexus Plus',
    description: 'More hosted rooms, larger rooms, premium profile polish, and basic room themes.',
    type: 'subscription',
    planTier: 'plus',
    priceINR: 49,
    priceUSD: 1.99,
    durationDays: 30,
    entitlementGrant: { type: 'plan', planTier: 'plus' },
    featureLimits: PLAN_LIMITS.plus,
  },
  {
    productId: 'nexus_plus_weekly',
    title: 'Nexus Plus Weekly',
    description: 'A short Plus pass for focused events and study rooms.',
    type: 'pass',
    planTier: 'plus',
    priceINR: 19,
    priceUSD: 0.99,
    durationDays: 7,
    entitlementGrant: { type: 'plan', planTier: 'plus' },
    featureLimits: PLAN_LIMITS.plus,
  },
  {
    productId: 'nexus_pro_monthly',
    title: 'Nexus Pro',
    description: 'Advanced hosting, larger rooms, longer temp rooms, analytics lite, and richer themes.',
    type: 'subscription',
    planTier: 'pro',
    priceINR: 99,
    priceUSD: 3.99,
    durationDays: 30,
    entitlementGrant: { type: 'plan', planTier: 'pro' },
    featureLimits: PLAN_LIMITS.pro,
  },
  {
    productId: 'nexus_community_monthly',
    title: 'Community Host',
    description: 'High-capacity room hosting, better role limits, branding, analytics, and creator polish.',
    type: 'subscription',
    planTier: 'community',
    priceINR: 199,
    priceUSD: 6.99,
    durationDays: 30,
    entitlementGrant: { type: 'plan', planTier: 'community' },
    featureLimits: PLAN_LIMITS.community,
  },
  {
    productId: 'cosmetic_avatar_ring_gold',
    title: 'Golden Orbit Avatar Ring',
    description: 'A premium profile ring for your avatar and mini profile.',
    type: 'cosmetic',
    priceINR: 29,
    priceUSD: 0.99,
    durationDays: null,
    entitlementGrant: { type: 'cosmetic', cosmeticId: 'avatar_ring_gold' },
    featureLimits: {},
  },
  {
    productId: 'cosmetic_room_theme_ivory_royale',
    title: 'Ivory Royale Room Theme',
    description: 'A warm royal room theme with gold glass panels.',
    type: 'cosmetic',
    priceINR: 39,
    priceUSD: 1.49,
    durationDays: null,
    entitlementGrant: { type: 'cosmetic', roomThemeId: 'ivory_royale' },
    featureLimits: {},
  },
  {
    productId: 'cosmetic_room_theme_midnight_gold',
    title: 'Midnight Gold Room Theme',
    description: 'A deep black and gold premium theme for serious hosting.',
    type: 'cosmetic',
    priceINR: 39,
    priceUSD: 1.49,
    durationDays: null,
    entitlementGrant: { type: 'cosmetic', roomThemeId: 'midnight_gold' },
    featureLimits: {},
  },
  {
    productId: 'cosmetic_early_supporter_badge',
    title: 'Early Supporter Badge',
    description: 'A one-time profile badge for early Nexus Chat supporters.',
    type: 'cosmetic',
    priceINR: 49,
    priceUSD: 1.99,
    durationDays: null,
    entitlementGrant: { type: 'cosmetic', badgeId: 'early_supporter' },
    featureLimits: {},
  },
];

export function getProduct(productId) {
  return PRODUCT_CATALOG.find((product) => product.productId === productId) || null;
}

export function getPlanLimits(planTier = 'free') {
  return PLAN_LIMITS[planTier] || PLAN_LIMITS.free;
}

export function getTheme(themeId) {
  return ROOM_THEME_PRESETS.find((theme) => theme.themeId === themeId) || ROOM_THEME_PRESETS[0];
}

export function listPublicProducts() {
  return PRODUCT_CATALOG.map(toPublicProduct);
}

export function toPublicProduct(product) {
  return {
    productId: product.productId,
    title: product.title,
    description: product.description,
    type: product.type,
    planTier: product.planTier || null,
    priceINR: product.priceINR,
    priceUSD: product.priceUSD,
    durationDays: product.durationDays,
    entitlementGrant: product.entitlementGrant,
    featureLimits: product.featureLimits,
  };
}

export function isEntitlementActive(entitlement, now = Date.now()) {
  if (!entitlement || entitlement.status !== 'active') {
    return false;
  }

  if (!entitlement.expiresAt) {
    return true;
  }

  const expiresAt = new Date(entitlement.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function resolvePlanTier(entitlements = []) {
  const activePlanEntitlements = entitlements.filter(
    (entitlement) => entitlement.type === 'plan' && isEntitlementActive(entitlement),
  );

  return activePlanEntitlements.reduce((best, entitlement) => {
    const currentIndex = PLAN_TIERS.indexOf(best);
    const nextIndex = PLAN_TIERS.indexOf(entitlement.planTier);
    return nextIndex > currentIndex ? entitlement.planTier : best;
  }, 'free');
}
