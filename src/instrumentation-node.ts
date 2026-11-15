export async function startBackground() {
  const { runSchedulers } = await import("./lib/booking");
  const { closeDb, withLeader } = await import("./lib/db");
  const { schedulerStats } = await import("./lib/metrics");
  const { logger } = await import("./lib/logger");

  // Every website pod runs this timer, but the database lock lets only one pod do the work each time.
  // Without it, two pods would send every reminder twice.
  const tick = async () => {
    try {
      const ranHere = await withLeader("scheduler", runSchedulers);
      if (ranHere) schedulerStats.runs++;
      schedulerStats.lastRun = Date.now();
    } catch (e) {
      schedulerStats.errors++;
      schedulerStats.lastError = String((e as Error)?.message ?? e);
      logger.error("scheduler failed", { error: schedulerStats.lastError });
    }
  };
  const timer = setInterval(tick, 60_000);
  logger.info("devagent started", { node: process.version, env: process.env.NODE_ENV, commit: process.env.GIT_SHA || "dev" });

  // Kubernetes and Docker send SIGTERM on stop: stop the timer, close database connections, exit cleanly.
  for (const sig of ["SIGTERM", "SIGINT"] as const) {
    process.once(sig, () => {
      logger.info("shutting down", { signal: sig });
      clearInterval(timer);
      closeDb().catch(() => {}).finally(() => process.exit(0));
    });
  }
}
