export function createJobService({
  logger = console,
  roomService,
  communityService,
  notificationService,
  billingService,
  repositories = {},
  io,
} = {}) {
  const enabled = String(process.env.JOBS_ENABLED || 'true').toLowerCase() !== 'false';
  const intervalMs = Math.max(15_000, Number(process.env.JOB_INTERVAL_MS || 60_000));
  const runs = [];
  let timer = null;
  let running = false;
  let startedAt = null;

  async function runAll(trigger = 'interval') {
    if (running) {
      return { skipped: true, reason: 'already-running' };
    }

    running = true;
    const started = Date.now();
    const summary = { trigger, startedAt: new Date(started).toISOString(), jobs: [] };

    try {
      await runJob(summary, 'expire-temp-rooms', async () => {
        const count = roomService?.cleanupExpiredRooms?.() || 0;
        if (count > 0) {
          io?.emit?.('rooms:update', { rooms: roomService.getPublicRooms() });
        }
        return { expiredRooms: count };
      });

      await runJob(summary, 'scheduled-announcements-and-events', async () => {
        const result = await communityService?.processSchedulers?.({
          roomService,
          notificationService,
          emit(event, payload) {
            io?.emit?.(event, payload);
          },
        });
        return result || { published: 0, events: [] };
      });

      await runJob(summary, 'repository-cleanup', async () => {
        const results = await Promise.allSettled([
          repositories.notificationRepository?.cleanupOld?.(),
          repositories.activityRepository?.cleanupOld?.(),
          repositories.communityActivityRepository?.cleanupOld?.(),
          repositories.reportRepository?.cleanupOld?.(),
          repositories.moderationLogRepository?.cleanupOld?.(),
        ]);
        return { cleanupTasks: results.length, failures: results.filter((item) => item.status === 'rejected').length };
      });

      await runJob(summary, 'entitlement-expiry-scan', async () => {
        const result = await billingService?.expireEntitlements?.();
        return result || { scanned: 0, expired: 0, note: 'expiry handled lazily by entitlement reads' };
      });

      summary.durationMs = Date.now() - started;
      summary.ok = summary.jobs.every((job) => job.ok);
      runs.unshift(summary);
      runs.splice(20);
      logger.info?.('Background jobs completed.', summary);
      return summary;
    } finally {
      running = false;
    }
  }

  function start() {
    if (!enabled || timer) {
      return;
    }

    startedAt = new Date().toISOString();
    runAll('boot').catch((error) => logger.warn?.('Boot jobs skipped safely.', { error }));
    timer = setInterval(() => {
      runAll('interval').catch((error) => logger.warn?.('Interval jobs skipped safely.', { error }));
    }, intervalMs);
    timer.unref?.();
    logger.info?.('Background jobs started.', { intervalMs });
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    start,
    stop,
    runAll,
    getStatus() {
      return {
        enabled,
        running,
        intervalMs,
        startedAt,
        lastRun: runs[0] || null,
        recentRuns: runs.slice(0, 5),
        note: 'Single-instance scheduler. TODO Phase 10: distributed lock for multi-instance workers.',
      };
    },
  };
}

async function runJob(summary, name, task) {
  const started = Date.now();

  try {
    const result = await task();
    summary.jobs.push({ name, ok: true, durationMs: Date.now() - started, result });
  } catch (error) {
    summary.jobs.push({
      name,
      ok: false,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : 'Job failed.',
    });
  }
}
