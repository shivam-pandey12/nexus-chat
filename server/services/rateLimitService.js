import { RATE_LIMITS } from '../../shared/chatConfig.js';

export function createRateLimitService({ cacheService, logger = console } = {}) {
  const cache = cacheService || createNullCache();

  async function consume(action, identity, options = {}) {
    const limits = normalizeLimits(options.limits || RATE_LIMITS[action]);

    if (!limits.length) {
      return { ok: true };
    }

    const cleanIdentity = sanitizeIdentity(identity);

    if (!cleanIdentity) {
      return { ok: false, retryAfterMs: limits[0].windowMs, message: 'Please wait a moment and try again.' };
    }

    for (const limit of limits) {
      const bucket = Math.floor(Date.now() / limit.windowMs);
      const key = `rate:${action}:${cleanIdentity}:${limit.windowMs}:${bucket}`;
      const count = await cache.incr(key, limit.windowMs + 1000);

      if (count > limit.max) {
        logger.warn?.('Rate limit exceeded', { action, identity: cleanIdentity, windowMs: limit.windowMs });
        return {
          ok: false,
          retryAfterMs: limit.windowMs,
          message: 'Too many attempts. Please wait a moment and try again.',
        };
      }
    }

    return { ok: true };
  }

  async function assertAllowed(action, identity, options = {}) {
    const result = await consume(action, identity, options);

    if (!result.ok) {
      const error = new Error(result.message);
      error.statusCode = 429;
      error.retryAfterMs = result.retryAfterMs;
      throw error;
    }

    return result;
  }

  function middleware(action, options = {}) {
    return async (request, response, next) => {
      try {
        await assertAllowed(action, identifyRequest(request, options.identity), options);
        next();
      } catch (error) {
        response.status(429).json({ error: error.message || 'Please wait a moment and try again.' });
      }
    };
  }

  return {
    consume,
    assertAllowed,
    middleware,
    identifyRequest,
  };
}

export function identifyRequest(request, preferred = '') {
  if (typeof preferred === 'function') {
    return preferred(request);
  }

  return (
    preferred ||
    request?.user?.userId ||
    request?.user?.sessionId ||
    request?.get?.('x-session-id') ||
    request?.ip ||
    request?.socket?.remoteAddress ||
    'anonymous'
  );
}

function normalizeLimits(limits) {
  if (!limits) {
    return [];
  }

  return (Array.isArray(limits) ? limits : [limits])
    .map((limit) => ({
      windowMs: Math.max(1000, Number(limit.windowMs) || 60_000),
      max: Math.max(1, Number(limit.max) || 10),
    }))
    .filter((limit) => limit.windowMs && limit.max);
}

function sanitizeIdentity(identity) {
  return String(identity || '')
    .replace(/[^a-zA-Z0-9@._:-]/g, '')
    .slice(0, 120);
}

function createNullCache() {
  return {
    async incr() {
      return 1;
    },
  };
}
