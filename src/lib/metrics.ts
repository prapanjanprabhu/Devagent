// Tiny in-memory counters for the background scheduler (shown on /status and /api/metrics).
const g = globalThis as unknown as { __dvMetrics?: { runs: number; errors: number; lastRun: number | null; lastError: string | null } };
export const schedulerStats = (g.__dvMetrics ??= { runs: 0, errors: 0, lastRun: null, lastError: null });
