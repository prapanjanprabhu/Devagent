// Small in-memory sliding-window limiter (per process). Fine for one server; use Redis if you scale out.
const hits = new Map<string, number[]>();
export function limited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now(), arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
  return arr.length > max;
}
export const ipOf = (req: Request) => (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
