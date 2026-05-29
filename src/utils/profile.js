import { AVATARS } from '../data/avatars.js';
import { CHAT_LIMITS } from '../../shared/chatConfig.js';

const PROFILE_KEY = 'nexusChat.profile.v1';
const THEME_KEY = 'nexusChat.theme.v1';
const FALLBACK_NAMES = ['Guest', 'NexusUser', 'MHGuest'];
const AUTH_PROVIDERS = new Set(['google', 'password', 'email']);

export function loadProfile() {
  try {
    const stored = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');

    if (!stored?.sessionId) {
      return null;
    }

    return {
      sessionId: stored.sessionId,
      displayName: sanitizeDisplayName(stored.displayName),
      avatar: isKnownAvatar(stored.avatar) ? stored.avatar : AVATARS[0].id,
      userId: sanitizeOptionalId(stored.userId),
      authProvider: sanitizeAuthProvider(stored.authProvider),
      handle: sanitizeHandle(stored.handle),
      status: sanitizeStatus(stored.status || stored.bio),
      profileRingId: sanitizeOptionalId(stored.profileRingId) || '',
      badgeIds: sanitizeBadgeIds(stored.badgeIds),
      photoMode: sanitizePhotoMode(stored.photoMode, stored.photoURL || stored.googlePhotoURL),
      photoURL: getActivePhotoURL(stored),
      googlePhotoURL: sanitizeUrl(stored.googlePhotoURL || stored.photoURL),
      email: sanitizeEmail(stored.email),
    };
  } catch {
    return null;
  }
}

export function saveProfile(profile) {
  const cleanProfile = {
    sessionId: profile.sessionId || createSessionId(),
    displayName: sanitizeDisplayName(profile.displayName),
    avatar: isKnownAvatar(profile.avatar) ? profile.avatar : AVATARS[0].id,
    userId: sanitizeOptionalId(profile.userId),
    authProvider: sanitizeAuthProvider(profile.authProvider),
    handle: sanitizeHandle(profile.handle),
    status: sanitizeStatus(profile.status || profile.bio),
    profileRingId: sanitizeOptionalId(profile.profileRingId) || '',
    badgeIds: sanitizeBadgeIds(profile.badgeIds),
    photoMode: sanitizePhotoMode(profile.photoMode, profile.photoURL || profile.googlePhotoURL),
    photoURL: getActivePhotoURL(profile),
    googlePhotoURL: sanitizeUrl(profile.googlePhotoURL || profile.photoURL),
    email: sanitizeEmail(profile.email),
  };

  localStorage.setItem(PROFILE_KEY, JSON.stringify(cleanProfile));
  return cleanProfile;
}

export function createGuestProfile({ displayName, avatar }) {
  return saveProfile({
    sessionId: createSessionId(),
    displayName,
    avatar,
  });
}

export function createLinkedProfile({
  sessionId,
  displayName,
  avatar,
  userId,
  authProvider = 'google',
  handle = '',
  status = '',
  photoMode = 'google',
  photoURL = '',
  googlePhotoURL = '',
  email = '',
}) {
  return saveProfile({
    sessionId: sessionId || createSessionId(),
    displayName,
    avatar,
    userId,
    authProvider,
    handle,
    status,
    photoMode,
    photoURL: photoMode === 'avatar' ? '' : photoURL || googlePhotoURL,
    googlePhotoURL: googlePhotoURL || photoURL,
    email,
  });
}

export function sanitizeDisplayName(value) {
  const text = String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .replace(/[^\p{L}\p{N}\s._-]/gu, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CHAT_LIMITS.MAX_DISPLAY_NAME_LENGTH);

  return text || FALLBACK_NAMES[Math.floor(Math.random() * FALLBACK_NAMES.length)];
}

export function loadTheme() {
  return localStorage.getItem(THEME_KEY) || 'light';
}

export function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}

function createSessionId() {
  const random = crypto.getRandomValues(new Uint32Array(4));
  return `guest_${[...random].map((value) => value.toString(16)).join('')}`;
}

function isKnownAvatar(id) {
  return AVATARS.some((avatar) => avatar.id === id);
}

function sanitizeOptionalId(value) {
  const text = String(value || '').trim();
  return /^[a-zA-Z0-9_-]{3,120}$/.test(text) ? text : null;
}

function sanitizeHandle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, CHAT_LIMITS.MAX_HANDLE_LENGTH);
}

function sanitizeStatus(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CHAT_LIMITS.MAX_PROFILE_STATUS_LENGTH);
}

function sanitizeBadgeIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(sanitizeOptionalId).filter(Boolean).slice(0, 4);
}

function sanitizeUrl(value) {
  const text = String(value || '').trim();

  if (!text || text.length > 500) {
    return '';
  }

  try {
    const url = new URL(text);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function sanitizePhotoMode(value, photoURL) {
  if (value === 'avatar') {
    return 'avatar';
  }

  return sanitizeUrl(photoURL) ? 'google' : 'avatar';
}

function getActivePhotoURL(profile) {
  const photoMode = sanitizePhotoMode(profile?.photoMode, profile?.photoURL || profile?.googlePhotoURL);
  return photoMode === 'google' ? sanitizeUrl(profile?.photoURL || profile?.googlePhotoURL) : '';
}

function sanitizeEmail(value) {
  const text = String(value || '').trim().toLowerCase();
  return /^[^\s@<>]{1,120}@[^\s@<>]{1,120}\.[^\s@<>]{2,24}$/.test(text) ? text : '';
}

function sanitizeAuthProvider(value) {
  const provider = String(value || '').trim().toLowerCase();
  return AUTH_PROVIDERS.has(provider) ? provider : null;
}
