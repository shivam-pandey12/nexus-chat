const TRUE_VALUES = new Set(['true', '1', 'yes', 'on']);
const LAUNCH_MODES = new Set(['dev', 'beta', 'public']);

export function validateEnv({ logger = console, isDev = process.env.NODE_ENV !== 'production' } = {}) {
  const warnings = [];
  const errors = [];
  const production = !isDev && process.env.NODE_ENV === 'production';

  if (isEnabled('PERSISTENCE_ENABLED') && !hasFirebaseAdminEnv()) {
    const message = 'PERSISTENCE_ENABLED=true requires Firebase Admin credentials.';
    (production ? errors : warnings).push(message);
  }

  if (isEnabled('BILLING_ENABLED')) {
    for (const key of ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET']) {
      if (!process.env[key]) {
        const message = `BILLING_ENABLED=true requires ${key}.`;
        (production ? errors : warnings).push(message);
      }
    }
  }

  if (isEnabled('REDIS_ENABLED') && !process.env.REDIS_URL) {
    const message = 'REDIS_ENABLED=true requires REDIS_URL.';
    (production ? errors : warnings).push(message);
  }

  if (isEnabled('FCM_ENABLED')) {
    if (!process.env.VITE_FIREBASE_VAPID_KEY) {
      const message = 'FCM_ENABLED=true requires VITE_FIREBASE_VAPID_KEY for browser token registration.';
      (production ? errors : warnings).push(message);
    }

    if (!hasFirebaseAdminEnv()) {
      const message = 'FCM_ENABLED=true requires Firebase Admin credentials for push delivery.';
      (production ? errors : warnings).push(message);
    }

    if (!isEnabled('PERSISTENCE_ENABLED')) {
      warnings.push('FCM_ENABLED=true works best with PERSISTENCE_ENABLED=true so device tokens persist.');
    }
  }

  if (production && !String(process.env.ADMIN_EMAILS || '').trim()) {
    warnings.push('ADMIN_EMAILS is strongly recommended in production.');
  }

  if (process.env.LAUNCH_MODE && !LAUNCH_MODES.has(String(process.env.LAUNCH_MODE).toLowerCase())) {
    warnings.push('LAUNCH_MODE should be dev, beta, or public.');
  }

  for (const warning of warnings) {
    logger.warn?.(warning);
  }

  for (const error of errors) {
    logger.error?.(error);
  }

  return { ok: errors.length === 0, warnings, errors, summary: safeEnvSummary() };
}

export function safeEnvSummary() {
  const launch = getLaunchConfig();

  return {
    nodeEnv: process.env.NODE_ENV || 'production',
    port: Number(process.env.PORT || 4000),
    clientOriginConfigured: Boolean(process.env.CLIENT_ORIGIN),
    persistenceEnabled: isEnabled('PERSISTENCE_ENABLED'),
    firebaseAdminConfigured: hasFirebaseAdminEnv(),
    billingEnabled: isEnabled('BILLING_ENABLED'),
    razorpayConfigured: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
    redisEnabled: isEnabled('REDIS_ENABLED'),
    redisConfigured: Boolean(process.env.REDIS_URL),
    fcmEnabled: isEnabled('FCM_ENABLED'),
    fcmConfigured: Boolean(process.env.VITE_FIREBASE_VAPID_KEY && hasFirebaseAdminEnv()),
    pwaEnabled: true,
    jobsEnabled: !isDisabled('JOBS_ENABLED'),
    logLevel: process.env.LOG_LEVEL || 'info',
    trustProxy: isEnabled('TRUST_PROXY'),
    adminEmailsConfigured: Boolean(String(process.env.ADMIN_EMAILS || '').trim()),
    fullAccessEmailsConfigured: Boolean(String(process.env.FULL_ACCESS_EMAILS || '').trim()),
    adminKeyFallbackProductionAllowed: isEnabled('ALLOW_ADMIN_KEY_IN_PRODUCTION'),
    launchMode: launch.mode,
    maintenanceMode: launch.maintenanceMode,
    signupsEnabled: launch.signupsEnabled,
    guestChatEnabled: launch.guestChatEnabled,
    communitiesEnabled: launch.communitiesEnabled,
    storeEnabled: launch.storeEnabled,
  };
}

export function getLaunchConfig() {
  return {
    mode: normalizeLaunchMode(process.env.LAUNCH_MODE),
    maintenanceMode: isEnabled('MAINTENANCE_MODE'),
    signupsEnabled: readEnabledWithDefault('SIGNUPS_ENABLED', true),
    guestChatEnabled: readEnabledWithDefault('GUEST_CHAT_ENABLED', true),
    communitiesEnabled: readEnabledWithDefault('COMMUNITIES_ENABLED', true),
    storeEnabled: readEnabledWithDefault('STORE_ENABLED', true),
  };
}

export function isEnabled(key) {
  return TRUE_VALUES.has(String(process.env[key] || '').toLowerCase());
}

export function isDisabled(key) {
  return String(process.env[key] || '').toLowerCase() === 'false';
}

function hasFirebaseAdminEnv() {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ||
      (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY),
  );
}

function normalizeLaunchMode(value) {
  const mode = String(value || '').trim().toLowerCase();

  if (LAUNCH_MODES.has(mode)) {
    return mode;
  }

  return process.env.NODE_ENV === 'production' ? 'public' : 'dev';
}

function readEnabledWithDefault(key, fallback) {
  if (process.env[key] === undefined || process.env[key] === '') {
    return fallback;
  }

  return isEnabled(key);
}
