export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { runSchedulers } = await import("./lib/booking");
  const { schedulerStats } = await import("./lib/metrics");
  const { logger } = await import("./lib/logger");

  const tick = () => {
    try {
      runSchedulers();
      schedulerStats.runs++;
      schedulerStats.lastRun = Date.now();
    } catch (e) {
      schedulerStats.errors++;
      schedulerStats.lastError = String((e as Error)?.message ?? e);
      logger.error("scheduler failed", { error: schedulerStats.lastError });
    }
  };
  const timer = setInterval(tick, 60_000);
  logger.info("devagent started", { node: process.version, env: process.env.NODE_ENV, commit: process.env.GIT_SHA || "dev" });

  // Docker sends SIGTERM on stop: stop the scheduler and exit cleanly.
  for (const sig of ["SIGTERM", "SIGINT"] as const) {
    process.once(sig, () => { logger.info("shutting down", { signal: sig }); clearInterval(timer); process.exit(0); });
  }
}
