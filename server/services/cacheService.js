import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const DEFAULT_PREFIX = 'nexuschat';

export async function createCacheService({ logger = console } = {}) {
  const enabled = String(process.env.REDIS_ENABLED || '').toLowerCase() === 'true';
  const prefix = sanitizePrefix(process.env.REDIS_PREFIX || DEFAULT_PREFIX);
  const memory = createMemoryCache(prefix);

  if (!enabled) {
    logger.warn?.('Redis disabled, using in-memory cache/rate-limit store.');
    return {
      ...memory,
      getStatus: () => ({ enabled: false, provider: 'memory', state: 'fallback', prefix, reason: 'disabled' }),
    };
  }

  if (!process.env.REDIS_URL) {
    logger.warn?.('REDIS_ENABLED=true but REDIS_URL is missing; using in-memory cache/rate-limit store.');
    return {
      ...memory,
      getStatus: () => ({ enabled: false, provider: 'memory', state: 'fallback', prefix, reason: 'url-missing' }),
    };
  }

  try {
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (error) => logger.warn?.('Redis pub client warning', { error }));
    subClient.on('error', (error) => logger.warn?.('Redis sub client warning', { error }));

    await Promise.all([pubClient.connect(), subClient.connect()]);
    logger.info?.('Redis cache connected.');

    return createRedisCache({ pubClient, subClient, prefix, logger });
  } catch (error) {
    logger.warn?.('Redis unavailable; using in-memory cache/rate-limit store.', { error });
    return {
      ...memory,
      getStatus: () => ({ enabled: true, provider: 'memory', state: 'fallback', prefix, reason: 'connect-failed' }),
    };
  }
}

function createRedisCache({ pubClient, subClient, prefix, logger }) {
  const keyFor = (key) => `${prefix}:${String(key || '')}`;

  return {
    async get(key) {
      return pubClient.get(keyFor(key));
    },
    async set(key, value, ttlMs) {
      const options = Number(ttlMs) > 0 ? { PX: Number(ttlMs) } : undefined;
      await pubClient.set(keyFor(key), String(value ?? ''), options);
    },
    async del(key) {
      await pubClient.del(keyFor(key));
    },
    async incr(key, ttlMs) {
      const redisKey = keyFor(key);
      const value = await pubClient.incr(redisKey);

      if (value === 1 && Number(ttlMs) > 0) {
        await pubClient.pExpire(redisKey, Number(ttlMs));
      }

      return value;
    },
    async expire(key, ttlMs) {
      await pubClient.pExpire(keyFor(key), Number(ttlMs));
    },
    async addPresence(roomId, sessionId, ttlMs = 90_000) {
      await this.set(`presence:${roomId}:${sessionId}`, Date.now(), ttlMs);
    },
    async removePresence(roomId, sessionId) {
      await this.del(`presence:${roomId}:${sessionId}`);
    },
    async countPresence(roomId) {
      const keys = await pubClient.keys(keyFor(`presence:${roomId}:*`));
      return keys.length;
    },
    async acquireLock(key, ttlMs = 60_000) {
      const result = await pubClient.set(keyFor(`lock:${key}`), '1', { NX: true, PX: ttlMs });
      return result === 'OK';
    },
    async close() {
      await Promise.allSettled([subClient.quit(), pubClient.quit()]);
      logger.info?.('Redis cache closed.');
    },
    createSocketAdapter() {
      return createAdapter(pubClient, subClient);
    },
    getStatus() {
      return { enabled: true, provider: 'redis', state: pubClient.isOpen ? 'connected' : 'disconnected', prefix };
    },
  };
}

function createMemoryCache(prefix) {
  const store = new Map();
  const isExpired = (entry) => entry?.expiresAt && entry.expiresAt <= Date.now();

  function pruneKey(key) {
    const entry = store.get(key);
    if (isExpired(entry)) {
      store.delete(key);
      return true;
    }
    return false;
  }

  return {
    async get(key) {
      const cleanKey = String(key || '');
      if (pruneKey(cleanKey)) {
        return null;
      }
      return store.get(cleanKey)?.value ?? null;
    },
    async set(key, value, ttlMs) {
      store.set(String(key || ''), {
        value: String(value ?? ''),
        expiresAt: Number(ttlMs) > 0 ? Date.now() + Number(ttlMs) : null,
      });
    },
    async del(key) {
      store.delete(String(key || ''));
    },
    async incr(key, ttlMs) {
      const cleanKey = String(key || '');
      if (pruneKey(cleanKey)) {
        store.delete(cleanKey);
      }
      const current = Number(store.get(cleanKey)?.value || 0) + 1;
      store.set(cleanKey, {
        value: String(current),
        expiresAt: Number(ttlMs) > 0 ? Date.now() + Number(ttlMs) : store.get(cleanKey)?.expiresAt || null,
      });
      return current;
    },
    async expire(key, ttlMs) {
      const cleanKey = String(key || '');
      const entry = store.get(cleanKey);
      if (entry) {
        entry.expiresAt = Date.now() + Number(ttlMs);
      }
    },
    async addPresence(roomId, sessionId, ttlMs = 90_000) {
      await this.set(`presence:${roomId}:${sessionId}`, Date.now(), ttlMs);
    },
    async removePresence(roomId, sessionId) {
      await this.del(`presence:${roomId}:${sessionId}`);
    },
    async countPresence(roomId) {
      const prefixKey = `presence:${roomId}:`;
      let count = 0;
      for (const key of store.keys()) {
        if (!pruneKey(key) && key.startsWith(prefixKey)) {
          count += 1;
        }
      }
      return count;
    },
    async acquireLock(key, ttlMs = 60_000) {
      const lockKey = `lock:${key}`;
      if (await this.get(lockKey)) {
        return false;
      }
      await this.set(lockKey, '1', ttlMs);
      return true;
    },
    async close() {
      store.clear();
    },
    createSocketAdapter() {
      return null;
    },
    getStatus() {
      return { enabled: false, provider: 'memory', state: 'fallback', prefix };
    },
  };
}

function sanitizePrefix(prefix) {
  return String(prefix || DEFAULT_PREFIX).replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 40) || DEFAULT_PREFIX;
}
