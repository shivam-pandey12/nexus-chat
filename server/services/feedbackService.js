import crypto from 'node:crypto';

import { CHAT_LIMITS } from '../../shared/chatConfig.js';
import {
  isValidSessionId,
  sanitizeFeedbackContext,
  sanitizeFeedbackEmail,
  sanitizeFeedbackMessage,
  sanitizeFeedbackName,
  sanitizeFeedbackStatus,
  sanitizeFeedbackTitle,
  sanitizeFeedbackType,
  sanitizeFeedbackUserAgent,
  sanitizeIdentifier,
} from './safetyService.js';

export function createFeedbackService({ repositories = {}, logger = console } = {}) {
  const feedbackRepository = repositories.feedbackRepository || {};
  const memoryEntries = [];

  async function createFeedback(identity = {}, payload = {}, requestMeta = {}) {
    const sessionId = readSessionId(identity.sessionId || payload.sessionId);

    if (!sessionId) {
      throw new Error('Set a guest identity before sending feedback.');
    }

    const entry = {
      feedbackId: `feedback_${crypto.randomUUID()}`,
      userId: readOptionalId(identity.userId, 'User'),
      sessionId,
      name: sanitizeFeedbackName(payload.name || identity.displayName),
      email: sanitizeFeedbackEmail(identity.email || payload.email),
      type: sanitizeFeedbackType(payload.type || 'feedback'),
      title: sanitizeFeedbackTitle(payload.title),
      message: sanitizeFeedbackMessage(payload.message),
      page: sanitizeFeedbackContext(payload.page || payload.targetView),
      context: sanitizeFeedbackContext(payload.context),
      roomId: readOptionalId(payload.roomId, 'Room'),
      status: 'open',
      priority: sanitizeFeedbackContext(payload.priority),
      userAgent: sanitizeFeedbackUserAgent(requestMeta.userAgent),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    remember(entry);

    try {
      await feedbackRepository.create?.(entry);
    } catch (error) {
      logger.warn?.('Feedback persistence skipped safely.', { error });
    }

    return serializeFeedback(entry);
  }

  async function listAdmin({ type = '', status = '', limit = CHAT_LIMITS.MAX_FEEDBACK_LOAD } = {}) {
    const cleanLimit = Math.min(Math.max(Number(limit) || 50, 1), CHAT_LIMITS.MAX_FEEDBACK_LOAD);
    const filters = {
      type: type ? sanitizeFeedbackType(type) : '',
      status: status ? sanitizeFeedbackStatus(status) : '',
      limit: cleanLimit,
    };
    let persisted = [];

    try {
      persisted = (await feedbackRepository.listRecent?.(filters)) || [];
    } catch (error) {
      logger.warn?.('Feedback admin persistence read skipped safely.', { error });
    }

    const merged = new Map(
      [...persisted, ...memoryEntries].map((entry) => [entry.feedbackId || entry.documentId, entry]),
    );

    return [...merged.values()]
      .filter((entry) => (!filters.type || entry.type === filters.type) && (!filters.status || entry.status === filters.status))
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, cleanLimit)
      .map(serializeFeedback);
  }

  async function updateStatus(feedbackId, status) {
    const cleanFeedbackId = sanitizeIdentifier(feedbackId, 'Feedback');
    const cleanStatus = sanitizeFeedbackStatus(status);
    const updatedAt = new Date().toISOString();
    const local = memoryEntries.find((entry) => entry.feedbackId === cleanFeedbackId);

    if (local) {
      local.status = cleanStatus;
      local.updatedAt = updatedAt;
    }

    await feedbackRepository.updateStatus?.(cleanFeedbackId, cleanStatus, updatedAt);
    return { feedbackId: cleanFeedbackId, status: cleanStatus, updatedAt };
  }

  async function getAdminSummary() {
    const recent = await listAdmin({ limit: CHAT_LIMITS.MAX_FEEDBACK_LOAD });

    return {
      sampled: recent.length,
      open: recent.filter((entry) => entry.status === 'open').length,
      bugs: recent.filter((entry) => entry.type === 'bug_report').length,
      safety: recent.filter((entry) => entry.type === 'abuse_safety_concern').length,
    };
  }

  function remember(entry) {
    memoryEntries.unshift(entry);
    memoryEntries.splice(CHAT_LIMITS.MAX_FEEDBACK_LOAD);
  }

  return {
    createFeedback,
    getAdminSummary,
    listAdmin,
    updateStatus,
  };
}

function serializeFeedback(entry) {
  return {
    feedbackId: entry.feedbackId || entry.documentId,
    userId: entry.userId || null,
    sessionId: entry.sessionId || null,
    name: sanitizeFeedbackName(entry.name),
    email: sanitizeFeedbackEmail(entry.email),
    type: sanitizeFeedbackType(entry.type || 'feedback'),
    title: sanitizeFeedbackTitle(entry.title),
    message: sanitizeFeedbackMessage(entry.message),
    page: sanitizeFeedbackContext(entry.page),
    context: sanitizeFeedbackContext(entry.context),
    roomId: readOptionalId(entry.roomId, 'Room'),
    status: sanitizeFeedbackStatus(entry.status || 'open'),
    priority: sanitizeFeedbackContext(entry.priority),
    userAgent: sanitizeFeedbackUserAgent(entry.userAgent),
    createdAt: entry.createdAt || null,
    updatedAt: entry.updatedAt || entry.createdAt || null,
  };
}

function readSessionId(value) {
  return isValidSessionId(value) ? value : '';
}

function readOptionalId(value, label) {
  try {
    return value ? sanitizeIdentifier(value, label) : null;
  } catch {
    return null;
  }
}
