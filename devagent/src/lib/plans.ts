import { get, type Tenant } from "./db";

export const PLANS = {
  free: { label: "Free", usd: 0, inr: 0, actionCap: 50, broadcastCap: 100, growth: false },
  booking: { label: "Booking", usd: 15, inr: 999, actionCap: Infinity, broadcastCap: 1000, growth: true },
  frontdesk: { label: "Front Desk", usd: 39, inr: 2499, actionCap: Infinity, broadcastCap: Infinity, growth: true },
} as const;
export const RESCUE_PRICE_INR = 5;

const monthStart = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; };

/** Bookings + orders created this month (cancelled ones still count as used capacity). */
export function actionsThisMonth(tenantId: string): number {
  const b = get<{ c: number }>("SELECT COUNT(*) c FROM bookings WHERE tenant_id=? AND created_at>=?", tenantId, monthStart())!.c;
  const o = get<{ c: number }>("SELECT COUNT(*) c FROM orders WHERE tenant_id=? AND created_at>=?", tenantId, monthStart())!.c;
  return b + o;
}
export const atActionCap = (t: Tenant) => actionsThisMonth(t.id) >= PLANS[t.plan].actionCap;
export const broadcastsThisMonth = (tenantId: string) =>
  get<{ c: number }>("SELECT COUNT(*) c FROM outbox WHERE tenant_id=? AND kind='marketing' AND created_at>=?", tenantId, monthStart())!.c;
