import crypto from 'node:crypto';

import {
  PRODUCT_CATALOG,
  PROFILE_COSMETICS,
  ROOM_THEME_PRESETS,
  getPlanLimits,
  getProduct,
  getTheme,
  isEntitlementActive,
  listPublicProducts,
  resolvePlanTier,
} from '../../shared/billingCatalog.js';

// Project-owner access still resolves from a verified Firebase email on the backend.
// Additional test/support accounts can be configured with FULL_ACCESS_EMAILS.
const OWNER_FULL_ACCESS_EMAILS = new Set(['shivam63pandey@gmail.com']);

export function createEntitlementService({ repositories = {} } = {}) {
  const billingRepository = repositories.billingRepository || {};
  const userRepository = repositories.userRepository || {};
  const verifiedEmailCache = new Map();

  async function getSummary(identity) {
    const userId = getUserId(identity);

    if (!userId) {
      return buildSummary([]);
    }

    const entitlements = await billingRepository.listEntitlements?.(userId, 100);
    return (await hasFullAccess(identity)) ? buildFullAccessSummary(userId, entitlements || []) : buildSummary(entitlements || []);
  }

  async function getFeatureLimits(identity) {
    return (await getSummary(identity)).limits;
  }

  async function hasFeature(identity, featureKey) {
    const summary = await getSummary(identity);
    return Boolean(summary.limits?.[featureKey]);
  }

  async function canUseRoomTheme(identity, themeId) {
    const theme = getTheme(themeId);

    if (!theme.productId) {
      return true;
    }

    const summary = await getSummary(identity);
    return summary.limits.roomThemes.includes(theme.themeId) || summary.ownedProductIds.includes(theme.productId);
  }

  async function canUseProfileCosmetic(identity, cosmeticProductId) {
    if (!cosmeticProductId) {
      return true;
    }

    const summary = await getSummary(identity);
    return summary.ownedProductIds.includes(cosmeticProductId);
  }

  function rememberVerifiedIdentity(identity = {}) {
    const userId = getUserId(identity);
    const email = normalizeEmail(identity.email || identity.authEmail);

    if (userId && email) {
      verifiedEmailCache.set(userId, email);
    }
  }

  async function grantProduct({ userId, productId, source = 'razorpay', sourceRef = '', metadata = {} }) {
    const product = getProduct(productId);

    if (!userId) {
      throw new Error('Login is required for premium access.');
    }

    if (!product) {
      throw new Error('Product was not found.');
    }

    const now = new Date().toISOString();
    const startsAt = now;
    const expiresAt = product.durationDays
      ? new Date(Date.now() + product.durationDays * 24 * 60 * 60 * 1000).toISOString()
      : null;
    const entitlementId = createEntitlementId(product, sourceRef);
    const entitlement = {
      entitlementId,
      userId,
      type: product.entitlementGrant.type,
      productId: product.productId,
      planTier: product.entitlementGrant.planTier || null,
      status: 'active',
      startsAt,
      expiresAt,
      source,
      createdAt: now,
      updatedAt: now,
      metadata: {
        ...metadata,
        cosmeticId: product.entitlementGrant.cosmeticId || null,
        roomThemeId: product.entitlementGrant.roomThemeId || null,
        badgeId: product.entitlementGrant.badgeId || null,
        sourceRef,
      },
    };

    await billingRepository.saveEntitlement?.(entitlement);
    return entitlement;
  }

  async function revokeEntitlement({ userId, entitlementId, actor = 'admin', reason = '' }) {
    if (!userId || !entitlementId) {
      throw new Error('User and entitlement are required.');
    }

    await billingRepository.revokeEntitlement?.(userId, entitlementId, {
      revokedBy: actor,
      revokeReason: String(reason || '').slice(0, 240),
    });

    return { userId, entitlementId, status: 'cancelled' };
  }

  function getCatalog() {
    return {
      products: listPublicProducts(),
      plans: PRODUCT_CATALOG.filter((product) => product.entitlementGrant.type === 'plan').map((product) => product.productId),
      themes: ROOM_THEME_PRESETS,
      freeLimits: getPlanLimits('free'),
    };
  }

  function buildSummary(entitlements = []) {
    const activeEntitlements = entitlements.filter((entitlement) => isEntitlementActive(entitlement));
    const planTier = resolvePlanTier(activeEntitlements);
    const ownedProductIds = activeEntitlements.map((entitlement) => entitlement.productId).filter(Boolean);
    const ownedThemeIds = new Set(getPlanLimits(planTier).roomThemes);
    const ownedCosmeticIds = [];
    const ownedBadgeIds = [];

    activeEntitlements.forEach((entitlement) => {
      if (entitlement.metadata?.roomThemeId) {
        ownedThemeIds.add(entitlement.metadata.roomThemeId);
      }

      if (entitlement.metadata?.cosmeticId) {
        ownedCosmeticIds.push(entitlement.metadata.cosmeticId);
      }

      if (entitlement.metadata?.badgeId) {
        ownedBadgeIds.push(entitlement.metadata.badgeId);
      }
    });

    return {
      planTier,
      limits: getPlanLimits(planTier),
      entitlements: entitlements.map(serializeEntitlement),
      activeEntitlements: activeEntitlements.map(serializeEntitlement),
      ownedProductIds: [...new Set(ownedProductIds)],
      ownedThemeIds: [...ownedThemeIds],
      ownedCosmeticIds: [...new Set(ownedCosmeticIds)],
      ownedBadgeIds: [...new Set(ownedBadgeIds)],
    };
  }

  function buildFullAccessSummary(userId, entitlements = []) {
    const activeProductIds = new Set(
      entitlements.filter((entitlement) => isEntitlementActive(entitlement)).map((entitlement) => entitlement.productId).filter(Boolean),
    );
    const virtualEntitlements = PRODUCT_CATALOG.filter((product) => !activeProductIds.has(product.productId)).map((product) =>
      createFullAccessEntitlement(userId, product),
    );
    const summary = buildSummary([...entitlements, ...virtualEntitlements]);

    return {
      ...summary,
      fullAccess: true,
      ownedProductIds: [...new Set([...summary.ownedProductIds, ...PRODUCT_CATALOG.map((product) => product.productId)])],
      ownedThemeIds: [...new Set([...summary.ownedThemeIds, ...ROOM_THEME_PRESETS.map((theme) => theme.themeId)])],
      ownedCosmeticIds: [
        ...new Set([
          ...summary.ownedCosmeticIds,
          ...PROFILE_COSMETICS.filter((cosmetic) => cosmetic.type !== 'badge').map((cosmetic) => cosmetic.cosmeticId),
        ]),
      ],
      ownedBadgeIds: [
        ...new Set([
          ...summary.ownedBadgeIds,
          ...PROFILE_COSMETICS.filter((cosmetic) => cosmetic.type === 'badge').map((cosmetic) => cosmetic.cosmeticId),
        ]),
      ],
    };
  }

  async function hasFullAccess(identity) {
    const userId = getUserId(identity);

    if (!userId) {
      return false;
    }

    const email = await resolveVerifiedEmail(identity, userId);
    return Boolean(email && getFullAccessEmails().has(email));
  }

  async function resolveVerifiedEmail(identity, userId) {
    const identityEmail = normalizeEmail(typeof identity === 'object' ? identity?.email || identity?.authEmail : '');

    if (identityEmail) {
      verifiedEmailCache.set(userId, identityEmail);
      return identityEmail;
    }

    if (verifiedEmailCache.has(userId)) {
      return verifiedEmailCache.get(userId);
    }

    let profile = null;

    try {
      profile = await userRepository.get?.(userId);
    } catch {
      profile = null;
    }

    const profileEmail = normalizeEmail(profile?.authEmail || profile?.email);
    verifiedEmailCache.set(userId, profileEmail);
    return profileEmail;
  }

  return {
    canUseProfileCosmetic,
    canUseRoomTheme,
    getCatalog,
    getFeatureLimits,
    getSummary,
    grantProduct,
    hasFeature,
    rememberVerifiedIdentity,
    revokeEntitlement,
  };
}

export function serializeEntitlement(entitlement) {
  return {
    entitlementId: entitlement.entitlementId,
    userId: entitlement.userId,
    type: entitlement.type,
    productId: entitlement.productId,
    planTier: entitlement.planTier || null,
    status: entitlement.status,
    startsAt: entitlement.startsAt,
    expiresAt: entitlement.expiresAt || null,
    source: entitlement.source,
    createdAt: entitlement.createdAt,
    updatedAt: entitlement.updatedAt,
    metadata: entitlement.metadata || {},
  };
}

function createEntitlementId(product, sourceRef) {
  const stableRef = sourceRef || crypto.randomBytes(8).toString('hex');
  return `ent_${product.productId}_${stableRef}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 140);
}

function createFullAccessEntitlement(userId, product) {
  const now = new Date().toISOString();

  return {
    entitlementId: `ent_full_access_${product.productId}`,
    userId,
    type: product.entitlementGrant.type,
    productId: product.productId,
    planTier: product.entitlementGrant.planTier || null,
    status: 'active',
    startsAt: now,
    expiresAt: null,
    source: 'support',
    createdAt: now,
    updatedAt: now,
    metadata: {
      fullAccess: true,
      cosmeticId: product.entitlementGrant.cosmeticId || null,
      roomThemeId: product.entitlementGrant.roomThemeId || null,
      badgeId: product.entitlementGrant.badgeId || null,
    },
  };
}

function getUserId(identity) {
  return typeof identity === 'object' ? String(identity?.userId || '').trim() : String(identity || '').trim();
}

function getFullAccessEmails() {
  return new Set([
    ...OWNER_FULL_ACCESS_EMAILS,
    ...String(process.env.FULL_ACCESS_EMAILS || '')
      .split(',')
      .map(normalizeEmail)
      .filter(Boolean),
  ]);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}
