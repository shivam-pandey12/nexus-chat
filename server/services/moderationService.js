import crypto from 'node:crypto';

import { CHAT_LIMITS } from '../../shared/chatConfig.js';
import {
  sanitizeModerationActionType,
  sanitizeReportDetails,
  sanitizeReportReason,
  sanitizeReportStatus,
  sanitizeReportTargetType,
} from './safetyService.js';

export function createModerationService({ repositories = {} } = {}) {
  const reports = [];
  const logs = [];
  const reportCooldowns = new Map();
  const reportWindows = new Map();
  const reportRepository = repositories.reportRepository || {};
  const moderationLogRepository = repositories.moderationLogRepository || {};
  const userRepository = repositories.userRepository || {};

  async function initializeFromPersistence() {
    const [persistedReports, persistedLogs] = await Promise.all([
      reportRepository.listRecent?.(CHAT_LIMITS.MAX_REPORTS_IN_MEMORY),
      moderationLogRepository.listRecent?.(CHAT_LIMITS.MAX_MODERATION_LOGS_IN_MEMORY),
    ]);

    reports.push(...(persistedReports || []).map(hydrateReport));
    logs.push(...(persistedLogs || []).map(hydrateLog));
    trimToCap(reports, CHAT_LIMITS.MAX_REPORTS_IN_MEMORY);
    trimToCap(logs, CHAT_LIMITS.MAX_MODERATION_LOGS_IN_MEMORY);
  }

  function createReport({ reporter, targetType, targetId, roomId, reason, details }) {
    const cleanTargetType = sanitizeReportTargetType(targetType);
    const cleanReason = sanitizeReportReason(reason);
    const cleanDetails = sanitizeReportDetails(details);
    enforceReportRate(reporter.sessionId);

    const report = {
      reportId: createId('report'),
      reporterSessionId: reporter.sessionId,
      reporterUserId: reporter.userId || null,
      reporterName: reporter.displayName,
      targetType: cleanTargetType,
      targetId: String(targetId || '').trim(),
      roomId: String(roomId || '').trim(),
      reason: cleanReason,
      details: cleanDetails,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      status: 'open',
    };

    reports.push(report);
    trimToCap(reports, CHAT_LIMITS.MAX_REPORTS_IN_MEMORY);
    writeLater(reportRepository.create?.(report), 'report create');
    return serializeReport(report);
  }

  function updateReportStatus(reportId, status, actor) {
    const report = reports.find((item) => item.reportId === reportId);

    if (!report) {
      throw new Error('Report not found.');
    }

    report.status = sanitizeReportStatus(status);
    report.updatedAt = new Date().toISOString();
    writeLater(reportRepository.create?.(report), 'report update');

    if (report.status === 'actioned' && report.reporterUserId) {
      writeLater(userRepository.incrementStat?.(report.reporterUserId, 'helpfulReports'), 'helpful report stat');
    }

    addLog({
      roomId: report.roomId,
      actor,
      actionType: 'report_action',
      targetRoomId: report.roomId,
      reason: `Report marked ${report.status}`,
      details: report.reportId,
    });

    return serializeReport(report);
  }

  function clearReports(actor) {
    const count = reports.length;
    reports.splice(0, reports.length);
    writeLater(reportRepository.clearAll?.(), 'report clear');
    addLog({
      roomId: '',
      actor,
      actionType: 'report_action',
      reason: 'Reports cleared',
      details: `${count} reports cleared`,
    });
    return count;
  }

  function addLog({
    roomId = '',
    actor,
    actionType,
    targetSessionId = '',
    targetMessageId = '',
    targetRoomId = '',
    reason = '',
    details = '',
  }) {
    const log = {
      logId: createId('log'),
      roomId: String(roomId || ''),
      actorSessionId: actor?.sessionId || 'admin',
      actorUserId: actor?.userId || null,
      actorName: actor?.displayName || 'Admin',
      actionType: sanitizeModerationActionType(actionType),
      targetSessionId: String(targetSessionId || ''),
      targetMessageId: String(targetMessageId || ''),
      targetRoomId: String(targetRoomId || ''),
      reason: sanitizeReportDetails(reason),
      details: sanitizeReportDetails(details),
      createdAt: new Date().toISOString(),
    };

    logs.push(log);
    trimToCap(logs, CHAT_LIMITS.MAX_MODERATION_LOGS_IN_MEMORY);
    writeLater(moderationLogRepository.create?.(log), 'moderation log create');
    return serializeLog(log);
  }

  function listReports(limit = 100) {
    return reports.slice(-limit).reverse().map(serializeReport);
  }

  function listLogs(limit = 100) {
    return logs.slice(-limit).reverse().map(serializeLog);
  }

  function getRecentReports(limit = 10) {
    return listReports(limit);
  }

  function getRecentLogs(limit = 10) {
    return listLogs(limit);
  }

  function enforceReportRate(sessionId) {
    const now = Date.now();
    const lastReportAt = reportCooldowns.get(sessionId) || 0;

    if (now - lastReportAt < CHAT_LIMITS.REPORT_COOLDOWN_MS) {
      throw new Error('Please wait before sending another report.');
    }

    const window = (reportWindows.get(sessionId) || []).filter(
      (timestamp) => now - timestamp < CHAT_LIMITS.REPORT_RATE_WINDOW_MS,
    );

    if (window.length >= CHAT_LIMITS.REPORT_RATE_MAX) {
      reportWindows.set(sessionId, window);
      throw new Error('Report limit reached. Try again later.');
    }

    window.push(now);
    reportWindows.set(sessionId, window);
    reportCooldowns.set(sessionId, now);
  }

  return {
    addLog,
    clearReports,
    createReport,
    getRecentLogs,
    getRecentReports,
    initializeFromPersistence,
    listLogs,
    listReports,
    updateReportStatus,
  };
}

function hydrateReport(report) {
  return {
    ...report,
    updatedAt: report.updatedAt || null,
  };
}

function hydrateLog(log) {
  return {
    ...log,
  };
}

function serializeReport(report) {
  return {
    reportId: report.reportId,
    reporterSessionId: report.reporterSessionId,
    reporterUserId: report.reporterUserId || null,
    reporterName: report.reporterName,
    targetType: report.targetType,
    targetId: report.targetId,
    roomId: report.roomId,
    reason: report.reason,
    details: report.details,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt || null,
    status: report.status,
  };
}

function serializeLog(log) {
  return {
    logId: log.logId,
    roomId: log.roomId,
    actorSessionId: log.actorSessionId,
    actorName: log.actorName,
    actionType: log.actionType,
    targetSessionId: log.targetSessionId,
    targetMessageId: log.targetMessageId,
    targetRoomId: log.targetRoomId,
    reason: log.reason,
    details: log.details,
    createdAt: log.createdAt,
  };
}

function trimToCap(items, cap) {
  if (items.length > cap) {
    items.splice(0, items.length - cap);
  }
}

function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function writeLater(task, label) {
  if (!task?.catch) {
    return;
  }

  task.catch((error) => {
    console.warn(
      `Phase 4 persistence ${label} failed; in-memory moderation state kept. ${
        error instanceof Error ? error.message : 'Repository error.'
      }`,
    );
  });
}
