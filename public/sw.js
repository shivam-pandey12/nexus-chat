const CACHE_VERSION = 'nexus-chat-pwa-v11-3';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = '/offline.html';
const SHELL_ASSETS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/nexus-icon.svg',
  '/icons/nexus-maskable.svg',
  '/icons/nexus-badge.svg',
];

const API_OR_PRIVATE_PATHS = [
  '/socket.io',
  '/socket.io/',
  '/api',
  '/api/',
  '/api/admin',
  '/api/admin/',
  '/api/payments',
  '/api/payments/',
  '/api/me',
  '/api/me/',
  '/admin',
  '/admin/',
  '/billing',
  '/payments',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('nexus-chat-pwa-') && ![APP_SHELL_CACHE, STATIC_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request, !isApiOrPrivate(url.pathname)));
    return;
  }

  if (isApiOrPrivate(url.pathname)) {
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener('push', (event) => {
  const payload = readPushPayload(event);
  const notification = payload.notification || {};
  const data = {
    ...(payload.data || {}),
    ...(notification.data || {}),
  };

  const title = cleanText(notification.title || data.title || 'Nexus Chat update', 80);
  const body = cleanText(notification.body || data.body || 'Open Nexus Chat for the latest room update.', 140);

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/nexus-icon.svg',
      badge: '/icons/nexus-badge.svg',
      tag: cleanText(data.notificationId || data.roomId || data.targetView || 'nexus-chat', 80),
      renotify: false,
      data: {
        targetUrl: sanitizeTargetUrl(data.targetUrl || notification.click_action || '/'),
        targetView: cleanText(data.targetView || '', 40),
        roomId: cleanText(data.roomId || '', 120),
        notificationId: cleanText(data.notificationId || '', 120),
      },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = sanitizeTargetUrl(data.targetUrl || '/');

  event.waitUntil(openOrFocusClient(targetUrl, data));
});

async function networkFirstNavigation(request, shouldCache = true) {
  try {
    const response = await fetch(request);

    if (shouldCache) {
      const cache = await caches.open(APP_SHELL_CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }

    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match(OFFLINE_URL);
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone()).catch(() => {});
  }

  return response;
}

async function openOrFocusClient(targetUrl, data) {
  const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  for (const client of clientsList) {
    const clientUrl = new URL(client.url);

    if (clientUrl.origin === self.location.origin) {
      await client.focus();
      client.postMessage({ type: 'nexus-notification-click', targetUrl, ...data });
      return;
    }
  }

  return self.clients.openWindow(targetUrl);
}

function isApiOrPrivate(pathname) {
  return API_OR_PRIVATE_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/icons/') ||
    pathname === '/manifest.webmanifest' ||
    pathname === OFFLINE_URL ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.webp') ||
    pathname.endsWith('.woff2')
  );
}

function readPushPayload(event) {
  if (!event.data) {
    return {};
  }

  try {
    return event.data.json();
  } catch {
    return { data: { body: event.data.text() } };
  }
}

function sanitizeTargetUrl(value) {
  const text = String(value || '/').trim();

  if (!text.startsWith('/')) {
    return '/';
  }

  return /^\/[a-zA-Z0-9/_?=&.-]*$/.test(text) ? text.slice(0, 180) : '/';
}

function cleanText(value, maxLength) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}
