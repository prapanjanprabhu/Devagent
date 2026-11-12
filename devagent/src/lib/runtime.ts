import pkg from "../../package.json";

/** Process start time, used for uptime. */
export const startedAt = Date.now();

/** Build info. GIT_SHA and BUILD_TIME are set by the Docker build / CI. */
export function versionInfo() {
  return {
    name: pkg.name,
    version: pkg.version,
    commit: process.env.GIT_SHA || "dev",
    builtAt: process.env.BUILD_TIME || null,
    node: process.version,
    env: process.env.NODE_ENV || "development",
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
  };
}
