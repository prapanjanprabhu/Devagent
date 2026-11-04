import { headers } from "next/headers";
import { limited } from "@/lib/ratelimit";

/** True when this client IP exceeded `max` attempts of `scope` within 15 minutes. */
export async function ipLimitedAction(scope: string, max: number) {
  const ip = ((await headers()).get("x-forwarded-for") ?? "local").split(",")[0].trim();
  return limited(`${scope}:${ip}`, max, 15 * 60_000);
}
