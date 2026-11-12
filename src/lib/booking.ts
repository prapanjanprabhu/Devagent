import { randomBytes } from "node:crypto";
import { all, get, run, tx, type Booking, type Hours, type Service, type Tenant } from "./db";
import { notify } from "./notify";
import { atActionCap } from "./plans";

const pad = (n: number) => String(n).padStart(2, "0");
export const toLocalISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const addMin = (iso: string, m: number) => toLocalISO(new Date(new Date(iso).getTime() + m * 60000));
export const nowLocal = () => toLocalISO(new Date());
const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const hhmm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const cleanPhone = (p: string) => { const t = p.trim(); return (t.startsWith("+") ? "+" : "") + t.replace(/\D/g, ""); };
const LIVE = "('confirmed','pending_deposit','completed')";

const getService = (tenantId: string, id: number) => get<Service>("SELECT * FROM services WHERE id=? AND tenant_id=? AND active=1", id, tenantId);
export const activeServices = (tenantId: string) => all<Service>("SELECT * FROM services WHERE tenant_id=? AND active=1 ORDER BY id", tenantId);
const getBooking = (tenantId: string, id: number) =>
  get<Booking>("SELECT b.*, s.name AS service_name FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.id=? AND b.tenant_id=?", id, tenantId);

export function upsertCustomer(tenantId: string, phone: string, name: string) {
  if (/^0+$/.test(phone.replace(/\D/g, ""))) return; // placeholder number for anonymous walk-ins
  run(`INSERT INTO customers(tenant_id,phone,name) VALUES (?,?,?) ON CONFLICT(tenant_id,phone) DO UPDATE SET name=CASE WHEN excluded.name!='' THEN excluded.name ELSE customers.name END`, tenantId, phone, name);
}

/** Free start times (local ISO) for a service on YYYY-MM-DD. */
export function getSlots(t: Tenant, serviceId: number, date: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const svc = getService(t.id, serviceId);
  if (!svc) return [];
  const h = (JSON.parse(t.hours) as Hours)[new Date(`${date}T00:00`).getDay()];
  if (!h) return [];
  const booked = all<{ start: string; end: string; service_id: number; spots: number }>(
    `SELECT b.start,b.end,b.service_id,s.spots FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.tenant_id=? AND b.status IN ${LIVE} AND b.start LIKE ?`, t.id, `${date}%`);
  const blocks = all<{ start: string; end: string }>("SELECT start,end FROM blocks WHERE tenant_id=? AND start<? AND end>?", t.id, `${date}T23:59`, `${date}T00:00`);
  const now = nowLocal(), out: string[] = [];
  for (let m = toMin(h[0]); m + svc.duration_min <= toMin(h[1]); m += 30) {
    const start = `${date}T${hhmm(m)}`, end = addMin(start, svc.duration_min);
    if (start <= now || blocks.some((b) => start < b.end && end > b.start)) continue;
    const taken = svc.spots > 1
      ? booked.filter((b) => b.service_id === svc.id && b.start === start).length
      : booked.filter((b) => b.spots === 1 && start < b.end && end > b.start).length;
    if (taken < (svc.spots > 1 ? svc.spots : Math.max(1, t.staff))) out.push(start);
  }
  return out;
}

export type BookResult = { ok: true; booking: Booking; payUrl?: string } | { ok: false; error: string };
export function createBooking(t: Tenant, a: { serviceId: number; start: string; name: string; phone: string; channel: string; skipSlotCheck?: boolean }): BookResult {
  const name = a.name?.trim().slice(0, 80), phone = cleanPhone(a.phone ?? "");
  if (!name || phone.replace(/\D/g, "").length < 7) return { ok: false, error: "A name and a valid phone number are required." };
  const svc = getService(t.id, a.serviceId);
  if (!svc) return { ok: false, error: "Unknown service." };
  if (atActionCap(t)) return { ok: false, error: "This business has reached its monthly booking limit. Please contact them directly." };
  const end = addMin(a.start, svc.duration_min);
  return tx(() => {
    if (!a.skipSlotCheck && !getSlots(t, svc.id, a.start.slice(0, 10)).includes(a.start)) return { ok: false as const, error: "That time is no longer available." };
    // A prepaid pack covers the session: no deposit, and one session is used up.
    const pack = get<{ id: number }>(`SELECT cp.id FROM customer_packs cp JOIN packs p ON p.id=cp.pack_id WHERE cp.tenant_id=? AND cp.phone=? AND cp.paid=1 AND cp.remaining>0 AND (p.service_id IS NULL OR p.service_id=?) ORDER BY cp.id LIMIT 1`, t.id, phone, svc.id);
    const deposit = pack || a.channel === "cockpit" ? 0 : svc.deposit;
    if (pack) run("UPDATE customer_packs SET remaining=remaining-1 WHERE id=?", pack.id);
    upsertCustomer(t.id, phone, name);
    const token = randomBytes(12).toString("hex");
    const id = run(`INSERT INTO bookings(tenant_id,service_id,customer_name,phone,start,end,status,channel,deposit_due,token) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      t.id, svc.id, name, phone, a.start, end, deposit > 0 ? "pending_deposit" : "confirmed", a.channel, deposit, token).id;
    const booking = getBooking(t.id, id)!;
    const base = process.env.BASE_URL || "http://localhost:3000";
    const payUrl = deposit > 0 ? `${base}/pay/${token}` : undefined;
    const when = a.start.replace("T", " at ");
    notify(t.id, phone, deposit > 0
      ? `Hi ${name}, we're holding ${svc.name} on ${when}. Pay the ${deposit} deposit to confirm: ${payUrl} (held for ${t.deposit_hold_min} min).`
      : `Hi ${name}, you're booked: ${svc.name} on ${when}. Manage your booking: ${base}/m/${token}`);
    return { ok: true as const, booking, payUrl };
  });
}

export function confirmDeposit(tenantId: string, bookingId: number) {
  const b = getBooking(tenantId, bookingId);
  if (!b || b.status !== "pending_deposit") return false;
  run("UPDATE bookings SET status='confirmed', deposit_paid=1 WHERE id=?", b.id);
  notify(tenantId, b.phone, `Deposit received - your ${b.service_name} on ${b.start.replace("T", " at ")} is confirmed. See you then!`);
  return true;
}

export function setStatus(t: Tenant, id: number, status: "confirmed" | "completed" | "cancelled" | "no_show") {
  const b = getBooking(t.id, id);
  if (!b) return false;
  run("UPDATE bookings SET status=? WHERE id=?", status, id);
  if (status === "cancelled") {
    notify(t.id, b.phone, `Your ${b.service_name} booking on ${b.start.replace("T", " at ")} was cancelled.`);
    offerFreedSlot(t, b);
  }
  return true;
}

/** Cancellation frees a slot: offer it to waitlisted customers for that service and day. */
function offerFreedSlot(t: Tenant, b: Booking) {
  const date = b.start.slice(0, 10);
  const w = all<{ id: number; phone: string; name: string }>("SELECT id,phone,name FROM waitlist WHERE tenant_id=? AND service_id=? AND date=? AND notified=0 ORDER BY id LIMIT 3", t.id, b.service_id, date);
  const base = process.env.BASE_URL || "http://localhost:3000";
  for (const x of w) {
    notify(t.id, x.phone, `Good news${x.name ? " " + x.name : ""}! A ${b.service_name} slot opened on ${b.start.replace("T", " at ")}. First come, first served: ${base}/book/${t.id}`);
    run("UPDATE waitlist SET notified=1 WHERE id=?", x.id);
  }
  return w.length;
}

export function cancelByCustomer(t: Tenant, id: number, phone: string) {
  const b = getBooking(t.id, id);
  if (!b || b.phone !== cleanPhone(phone)) return { ok: false, error: "Booking not found." };
  if (b.status === "cancelled") return { ok: false, error: "Already cancelled." };
  setStatus(t, id, "cancelled");
  return { ok: true };
}

export function moveBooking(t: Tenant, id: number, newStart: string): { ok: boolean; error?: string } {
  const b = getBooking(t.id, id);
  if (!b) return { ok: false, error: "Not found." };
  const svc = getService(t.id, b.service_id);
  if (!svc) return { ok: false, error: "Service inactive." };
  return tx(() => {
    run("UPDATE bookings SET status='cancelled' WHERE id=?", id); // free own slot for the availability check
    if (!getSlots(t, svc.id, newStart.slice(0, 10)).includes(newStart)) { run("UPDATE bookings SET status=? WHERE id=?", b.status, id); return { ok: false, error: "That time is not available." }; }
    run("UPDATE bookings SET status=?, start=?, end=?, reminded24=0, reminded2=0 WHERE id=?", b.status, newStart, addMin(newStart, svc.duration_min), id);
    notify(t.id, b.phone, `Your ${svc.name} was moved to ${newStart.replace("T", " at ")}.`);
    return { ok: true };
  });
}

export const upcomingForPhone = (t: Tenant, phone: string) =>
  all<Booking>(`SELECT b.*, s.name AS service_name FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.tenant_id=? AND b.phone=? AND b.status IN ('confirmed','pending_deposit') AND b.start>? ORDER BY b.start`, t.id, cleanPhone(phone), nowLocal());

export function joinWaitlist(t: Tenant, serviceId: number, date: string, phone: string, name: string) {
  if (!getService(t.id, serviceId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Invalid request." };
  const p = cleanPhone(phone);
  if (get("SELECT 1 FROM waitlist WHERE tenant_id=? AND service_id=? AND date=? AND phone=? AND notified=0", t.id, serviceId, date, p)) return { ok: true };
  run("INSERT INTO waitlist(tenant_id,service_id,phone,name,date) VALUES (?,?,?,?,?)", t.id, serviceId, p, name.slice(0, 80), date);
  return { ok: true };
}

export const addBlock = (tenantId: string, start: string, end: string, reason: string) =>
  start < end && run("INSERT INTO blocks(tenant_id,start,end,reason) VALUES (?,?,?,?)", tenantId, start, end, reason.slice(0, 120));

// ---------- scheduled work (called every minute from instrumentation.ts) ----------
export function runSchedulers() {
  const now = nowLocal();
  for (const t of all<Tenant>("SELECT * FROM tenants")) {
    // 1) 24h and 2h reminders, once each.
    // A booking made inside the 2h window never gets the 24h reminder (it would be sent seconds before the 2h one).
    run("UPDATE bookings SET reminded24=1 WHERE tenant_id=? AND status='confirmed' AND reminded24=0 AND start<=?", t.id, addMin(now, 120));
    for (const [col, hours, label] of [["reminded24", 24, "coming up"], ["reminded2", 2, "in about 2 hours"]] as const) {
      for (const b of all<Booking>(`SELECT b.*, s.name AS service_name FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.tenant_id=? AND b.status='confirmed' AND b.${col}=0 AND b.start>? AND b.start<=?`, t.id, now, addMin(now, hours * 60))) {
        notify(t.id, b.phone, `Reminder: ${b.service_name} ${label} (${b.start.replace("T", " at ")}). Manage: ${process.env.BASE_URL || "http://localhost:3000"}/m/${b.token}`);
        run(`UPDATE bookings SET ${col}=1${col === "reminded2" ? ", reminded24=1" : ""} WHERE id=?`, b.id);
      }
    }
    // 2) Unpaid deposits: free the slot once the hold expires or the appointment time arrives, then offer it to the waitlist.
    for (const b of all<Booking>(`SELECT b.*, s.name AS service_name FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.tenant_id=? AND b.status='pending_deposit'`, t.id)) {
      const holdEnds = toLocalISO(new Date(new Date(b.created_at.replace(" ", "T") + "Z").getTime() + t.deposit_hold_min * 60000));
      if (now >= holdEnds || now >= b.start) {
        run("UPDATE bookings SET status='cancelled' WHERE id=?", b.id);
        notify(t.id, b.phone, `Your held ${b.service_name} slot (${b.start.replace("T", " at ")}) was released because the deposit wasn't paid.`);
        offerFreedSlot(t, b);
      }
    }
    // 3) One review request after a completed visit (needs a review link).
    if (t.review_link) {
      for (const b of all<Booking>("SELECT * FROM bookings WHERE tenant_id=? AND status='completed' AND review_asked=0", t.id)) {
        notify(t.id, b.phone, `Thanks for visiting ${t.name}! If you enjoyed it, a quick review helps a lot: ${t.review_link}`, "marketing");
        run("UPDATE bookings SET review_asked=1 WHERE id=?", b.id);
      }
    }
    // 4) Daily digest to the owner at/after 20:00, once per day.
    const today = now.slice(0, 10);
    if (t.owner_phone && now.slice(11) >= "20:00" && t.last_digest !== today) {
      const c = (s: string) => get<{ c: number }>(s, t.id, `${today}%`)!.c;
      const booked = c("SELECT COUNT(*) c FROM bookings WHERE tenant_id=? AND start LIKE ? AND status!='cancelled'");
      const tomorrow = get<{ c: number }>("SELECT COUNT(*) c FROM bookings WHERE tenant_id=? AND start LIKE ? AND status IN ('confirmed','pending_deposit')", t.id, `${addMin(today + "T00:00", 1440).slice(0, 10)}%`)!.c;
      notify(t.id, t.owner_phone, `${t.name} daily digest: ${booked} booking(s) today, ${tomorrow} tomorrow.`);
      run("UPDATE tenants SET last_digest=? WHERE id=?", today, t.id);
    }
  }
}
