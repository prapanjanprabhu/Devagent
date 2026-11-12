import { all, get, run, type Tenant } from "./db";
import { notify } from "./notify";
import { addMin, nowLocal } from "./booking";
import { PLANS, broadcastsThisMonth } from "./plans";

export const SEGMENTS = {
  all: "All opted-in customers",
  lapsed: "Lapsed - no visit in 60+ days (win-back)",
  recent: "Recent - visited in the last 30 days",
  never: "Never booked yet (first-visit offer)",
  regulars: "Regulars - 3+ completed visits (VIP)",
} as const;
export type Segment = keyof typeof SEGMENTS;

type Cust = { phone: string; name: string; visits: number; last_visit: string | null };
const customers = (tid: string) => all<Cust>(
  `SELECT c.phone, c.name, COUNT(b.id) AS visits, MAX(b.start) AS last_visit FROM customers c
   LEFT JOIN bookings b ON b.tenant_id=c.tenant_id AND b.phone=c.phone AND b.status='completed'
   WHERE c.tenant_id=? AND c.opted_in=1 GROUP BY c.phone`, tid);

export function segmentMembers(tid: string, seg: Segment): Cust[] {
  const now = nowLocal(), d60 = addMin(now, -60 * 1440), d30 = addMin(now, -30 * 1440);
  const all_ = customers(tid);
  switch (seg) {
    case "lapsed": return all_.filter((c) => c.last_visit && c.last_visit < d60);
    case "recent": return all_.filter((c) => c.last_visit && c.last_visit >= d30);
    case "never": return all_.filter((c) => !c.last_visit);
    case "regulars": return all_.filter((c) => c.visits >= 3);
    default: return all_;
  }
}

/** Send a broadcast; `{name}` is replaced per customer. Respects the plan's monthly broadcast cap. */
export function sendCampaign(t: Tenant, name: string, body: string, seg: Segment): { ok: true; sent: number } | { ok: false; error: string } {
  if (!body.trim()) return { ok: false, error: "Write a message first." };
  const members = segmentMembers(t.id, seg);
  const left = PLANS[t.plan].broadcastCap - broadcastsThisMonth(t.id);
  if (members.length > left) return { ok: false, error: `Your ${PLANS[t.plan].label} plan allows ${Math.max(0, left)} more broadcast messages this month; this segment has ${members.length}.` };
  let sent = 0;
  for (const m of members) if (notify(t.id, m.phone, body.replaceAll("{name}", m.name || "there") + `\nReply STOP to opt out.`, "marketing")) sent++;
  run("INSERT INTO campaigns(tenant_id,name,body,segment,sent) VALUES (?,?,?,?,?)", t.id, name.slice(0, 80) || "Broadcast", body, seg, sent);
  return { ok: true, sent };
}

export const optOut = (tid: string, phone: string) => run("UPDATE customers SET opted_in=0 WHERE tenant_id=? AND phone=?", tid, phone);

// ---------- Grow agent: drafted follow-ups the owner approves ----------
export type Opportunity = { key: string; kind: string; phone: string; name: string; draft: string };
export function findOpportunities(t: Tenant): Opportunity[] {
  const out: Opportunity[] = [];
  for (const c of segmentMembers(t.id, "lapsed").slice(0, 25))
    out.push({ key: `win:${c.phone}`, kind: "Win-back", phone: c.phone, name: c.name, draft: `Hi ${c.name || "there"}, it's been a while! We'd love to see you again at ${t.name} - book here: ${process.env.BASE_URL || "http://localhost:3000"}/book/${t.id}` });
  if (t.review_link) {
    for (const b of all<{ phone: string; customer_name: string }>("SELECT DISTINCT phone, customer_name FROM bookings WHERE tenant_id=? AND status='completed' AND start>=? AND review_asked=0 LIMIT 25", t.id, addMin(nowLocal(), -3 * 1440)))
      out.push({ key: `rev:${b.phone}`, kind: "Review request", phone: b.phone, name: b.customer_name, draft: `Thanks for visiting ${t.name}, ${b.customer_name}! A quick review helps a lot: ${t.review_link}` });
  }
  for (const o of all<{ id: number; phone: string; name: string }>("SELECT id,phone,name FROM orders WHERE tenant_id=? AND paid=0 AND status NOT IN ('cancelled','delivered') AND created_at<=datetime('now','-1 day') LIMIT 25", t.id))
    out.push({ key: `ord:${o.id}`, kind: "Unpaid order", phone: o.phone, name: o.name, draft: `Hi ${o.name || "there"}, a quick reminder about order #${o.id} - let us know if you'd like to complete payment.` });
  for (const p of all<{ phone: string; remaining: number; pname: string }>("SELECT cp.phone, cp.remaining, p.name AS pname FROM customer_packs cp JOIN packs p ON p.id=cp.pack_id WHERE cp.tenant_id=? AND cp.paid=1 AND cp.remaining>0 AND cp.created_at<=datetime('now','-30 day')", t.id))
    out.push({ key: `pack:${p.phone}`, kind: "Pack reminder", phone: p.phone, name: "", draft: `You still have ${p.remaining} session(s) left on your ${p.pname} at ${t.name} - book anytime: ${process.env.BASE_URL || "http://localhost:3000"}/book/${t.id}` });
  return out;
}

// ---------- analytics ----------
export function analytics(tid: string) {
  const since = addMin(nowLocal(), -30 * 1440);
  const by = (sql: string) => Object.fromEntries(all<{ k: string; c: number }>(sql, tid, since).map((r) => [r.k, r.c]));
  const status = by("SELECT status k, COUNT(*) c FROM bookings WHERE tenant_id=? AND start>=? GROUP BY status");
  const channel = by("SELECT channel k, COUNT(*) c FROM bookings WHERE tenant_id=? AND start>=? GROUP BY channel");
  const finished = (status.completed ?? 0) + (status.no_show ?? 0);
  const revenue = get<{ s: number | null }>(`SELECT SUM(s.price) s FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.tenant_id=? AND b.start>=? AND b.status='completed'`, tid, since)?.s ?? 0;
  const orders = get<{ c: number; v: number | null }>("SELECT COUNT(*) c, SUM(total) v FROM orders WHERE tenant_id=? AND created_at>=datetime('now','-30 day') AND status!='cancelled'", tid)!;
  const enq = Object.fromEntries(all<{ k: string; c: number }>("SELECT stage k, COUNT(*) c FROM enquiries WHERE tenant_id=? GROUP BY stage", tid).map((r) => [r.k, r.c]));
  return { status, channel, noShowRate: finished ? Math.round(((status.no_show ?? 0) / finished) * 100) : null, revenue, orders: orders.c, orderValue: orders.v ?? 0, enquiries: enq };
}
