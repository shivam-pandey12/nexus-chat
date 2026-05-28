export function createAnalyticsService({ repositories = {}, logger = console } = {}) {
  const analyticsRepository = repositories.analyticsRepository;
  const enabled = analyticsRepository?.isEnabled !== false && Boolean(analyticsRepository?.incrementDaily);

  function track(type, metadata = {}) {
    if (!enabled) {
      return;
    }

    const safeType = String(type || '').replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 80);

    if (!safeType) {
      return;
    }

    analyticsRepository
      .incrementDaily(new Date(), safeType, sanitizeAnalyticsMetadata(metadata))
      .catch((error) => logger.warn?.('Analytics write skipped safely.', { type: safeType, error }));
  }

  async function getOverview(limit = 14) {
    if (!analyticsRepository?.listDaily) {
      return { enabled: false, days: [] };
    }

    return {
      enabled: true,
      days: await analyticsRepository.listDaily(Math.max(1, Math.min(Number(limit) || 14, 60))),
    };
  }

  function getStatus() {
    return {
      enabled,
      provider: enabled ? 'firestore' : 'memory',
      privacy: 'aggregate-only',
    };
  }

  return {
    track,
    getOverview,
    getStatus,
  };
}

function sanitizeAnalyticsMetadata(metadata = {}) {
  const output = {};
  const allowed = ['category', 'roomId', 'communityId', 'eventId', 'productId', 'planTier', 'status', 'type'];

  for (const key of allowed) {
    const value = metadata[key];

    if (typeof value === 'string' && value.trim()) {
      output[key] = value.trim().slice(0, 80);
    }
  }

  return output;
}
