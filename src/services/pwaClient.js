import { deleteToken, getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';

import { disablePushToken, registerPushToken } from './api.js';
import { getFirebaseApp, isFirebaseMessagingConfigured } from './firebaseClient.js';

const INSTALL_DISMISSED_KEY = 'nexusChat.pwaInstallDismissed.v11';
const PUSH_TOKEN_ID_KEY = 'nexusChat.pushTokenId.v11';

let deferredInstallPrompt = null;
let serviceWorkerRegistration = null;
let foregroundUnsubscribe = null;

export function getInitialPwaState() {
  return {
    online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
    serviceWorkerSupported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    serviceWorkerReady: false,
    installAvailable: false,
    installDismissed: isInstallDismissed(),
    installed: isStandaloneDisplay(),
    lastTransition: '',
  };
}

export async function registerNexusServiceWorker({ onMessage: handleMessage } = {}) {
  if (!('serviceWorker' in navigator)) {
    return { supported: false, registration: null };
  }

  const url = `/sw.js${buildServiceWorkerQuery()}`;
  serviceWorkerRegistration = await navigator.serviceWorker.register(url, { scope: '/' });

  if (typeof handleMessage === 'function') {
    navigator.serviceWorker.addEventListener('message', (event) => handleMessage(event.data || {}));
  }

  return { supported: true, registration: serviceWorkerRegistration };
}

export function watchNetwork(onChange) {
  const emit = (online, lastTransition) => onChange?.({ online, lastTransition });
  const onOnline = () => emit(true, 'online');
  const onOffline = () => emit(false, 'offline');

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}

export function watchInstallPrompt(onChange) {
  const beforeInstallPrompt = (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    onChange?.({ installAvailable: !isInstallDismissed(), installed: false });
  };
  const appInstalled = () => {
    deferredInstallPrompt = null;
    localStorage.setItem(INSTALL_DISMISSED_KEY, 'installed');
    onChange?.({ installAvailable: false, installed: true, installDismissed: true });
  };

  window.addEventListener('beforeinstallprompt', beforeInstallPrompt);
  window.addEventListener('appinstalled', appInstalled);

  return () => {
    window.removeEventListener('beforeinstallprompt', beforeInstallPrompt);
    window.removeEventListener('appinstalled', appInstalled);
  };
}

export async function promptInstall() {
  if (!deferredInstallPrompt) {
    return { installed: false, unavailable: true };
  }

  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  const accepted = choice?.outcome === 'accepted';
  deferredInstallPrompt = null;

  if (accepted) {
    localStorage.setItem(INSTALL_DISMISSED_KEY, 'installed');
  }

  return { installed: accepted, dismissed: !accepted };
}

export function dismissInstallPrompt() {
  localStorage.setItem(INSTALL_DISMISSED_KEY, 'dismissed');
}

export async function getPushCapability(publicPwaStatus = {}) {
  const fcmStatus = publicPwaStatus?.fcm || {};

  if (!fcmStatus.enabled) {
    return { supported: false, state: 'disabled', reason: 'fcm_disabled', permission: getNotificationPermission() };
  }

  if (!fcmStatus.vapidKeyConfigured || !isFirebaseMessagingConfigured()) {
    return { supported: false, state: 'unconfigured', reason: 'missing_vapid_key', permission: getNotificationPermission() };
  }

  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return { supported: false, state: 'unsupported', reason: 'browser_unsupported', permission: getNotificationPermission() };
  }

  const supported = await isSupported().catch(() => false);

  if (!supported) {
    return { supported: false, state: 'unsupported', reason: 'firebase_messaging_unsupported', permission: getNotificationPermission() };
  }

  return {
    supported: true,
    state: getNotificationPermission() === 'granted' ? 'granted' : getNotificationPermission() === 'denied' ? 'denied' : 'available',
    reason: '',
    permission: getNotificationPermission(),
    tokenRegistered: Boolean(localStorage.getItem(PUSH_TOKEN_ID_KEY)),
    tokenId: localStorage.getItem(PUSH_TOKEN_ID_KEY) || '',
  };
}

export async function enablePushNotifications({ idToken, sessionId, deviceLabel = 'Browser device', publicPwaStatus = {}, onForegroundMessage } = {}) {
  if (!idToken) {
    throw new Error('Google login is required to enable push notifications.');
  }

  const capability = await getPushCapability(publicPwaStatus);

  if (!capability.supported) {
    throw new Error(pushReasonToMessage(capability.reason));
  }

  const permission = await Notification.requestPermission();

  if (permission !== 'granted') {
    throw new Error(permission === 'denied' ? 'Browser notifications are blocked for Nexus Chat.' : 'Notification permission was not granted.');
  }

  const registration = serviceWorkerRegistration || (await navigator.serviceWorker.ready);
  const messaging = getMessaging(getFirebaseApp());
  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    throw new Error('Could not create a push token for this browser.');
  }

  const result = await registerPushToken(idToken, sessionId, {
    token,
    deviceLabel,
  });

  if (result?.push?.tokenId) {
    localStorage.setItem(PUSH_TOKEN_ID_KEY, result.push.tokenId);
  }

  watchForegroundMessages(onForegroundMessage);

  return {
    ...capability,
    permission,
    state: 'registered',
    tokenRegistered: true,
    tokenId: result?.push?.tokenId || '',
  };
}

export async function disablePushNotifications({ idToken, sessionId } = {}) {
  const tokenId = localStorage.getItem(PUSH_TOKEN_ID_KEY);

  if (idToken && tokenId) {
    await disablePushToken(idToken, sessionId, tokenId).catch(() => {});
  }

  localStorage.removeItem(PUSH_TOKEN_ID_KEY);

  if (isFirebaseMessagingConfigured()) {
    try {
      await deleteToken(getMessaging(getFirebaseApp()));
    } catch {
      // Browser token deletion can fail after permission revocation; server-side disable above is enough.
    }
  }

  return { tokenRegistered: false, tokenId: '', state: getNotificationPermission() === 'denied' ? 'denied' : 'available' };
}

export function watchForegroundMessages(onForegroundMessage) {
  if (foregroundUnsubscribe || !isFirebaseMessagingConfigured() || typeof onForegroundMessage !== 'function') {
    return foregroundUnsubscribe;
  }

  try {
    foregroundUnsubscribe = onMessage(getMessaging(getFirebaseApp()), (payload) => onForegroundMessage(payload));
  } catch {
    foregroundUnsubscribe = null;
  }

  return foregroundUnsubscribe;
}

export function getStoredPushTokenId() {
  return localStorage.getItem(PUSH_TOKEN_ID_KEY) || '';
}

function buildServiceWorkerQuery() {
  const params = new URLSearchParams();
  const senderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;

  if (senderId) {
    params.set('senderId', senderId);
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

function getNotificationPermission() {
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

function isInstallDismissed() {
  return Boolean(localStorage.getItem(INSTALL_DISMISSED_KEY));
}

function isStandaloneDisplay() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.startsWith('android-app://')
  );
}

function pushReasonToMessage(reason) {
  return {
    fcm_disabled: 'Push notifications are disabled on this Nexus Chat server.',
    missing_vapid_key: 'Push notifications are not configured for this launch yet.',
    browser_unsupported: 'This browser does not support web push notifications.',
    firebase_messaging_unsupported: 'Firebase Cloud Messaging is unavailable in this browser.',
  }[reason] || 'Push notifications are unavailable right now.';
}
