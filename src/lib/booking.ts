import { randomBytes } from "node:crypto";
import { all, get, lockKey, run, tx, type Booking, type Hours, type Service, type Tenant } from "./db";
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

export async function upsertCustomer(tenantId: string, phone: string, name: string) {
  if (/^0+$/.test(phone.replace(/\D/g, ""))) return; // placeholder number for anonymous walk-ins
  await run(`INSERT INTO customers(tenant_id,phone,name) VALUES (?,?,?) ON CONFLICT(tenant_id,phone) DO UPDATE SET name=CASE WHEN excluded.name!='' THEN excluded.name ELSE customers.name END`, tenantId, phone, name);
}

/** Free start times (local ISO) for a service on YYYY-MM-DD. */
export async function getSlots(t: Tenant, serviceId: number, date: string): Promise<string[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const svc = await getService(t.id, serviceId);
  if (!svc) return [];
  const h = (JSON.parse(t.hours) as Hours)[new Date(`${date}T00:00`).getDay()];
  if (!h) return [];
  const booked = await all<{ start: string; end: string; service_id: number; spots: number }>(
      `SELECT b.start,b.end,b.service_id,s.spots FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.tenant_id=? AND b.status IN ${LIVE} AND b.start LIKE ?`, t.id, `${date}%`);
  const blocks = await all<{ start: string; end: string }>(`SELECT start,"end" FROM blocks WHERE tenant_id=? AND start<? AND "end">?`, t.id, `${date}T23:59`, `${date}T00:00`);
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
export async function createBooking(t: Tenant, a: { serviceId: number; start: string; name: string; phone: string; channel: string; skipSlotCheck?: boolean }): Promise<BookResult> {
  const name = a.name?.trim().slice(0, 80), phone = cleanPhone(a.phone ?? "");
  if (!name || phone.replace(/\D/g, "").length < 7) return { ok: false, error: "A name and a valid phone number are required." };
  const svc = await getService(t.id, a.serviceId);
  if (!svc) return { ok: false, error: "Unknown service." };
  if (await atActionCap(t)) return { ok: false, error: "This business has reached its monthly booking limit. Please contact them directly." };
  const end = addMin(a.start, svc.duration_min);
  return await tx(async () => {
      await lockKey(`calendar:${t.id}`); // two pods cannot sell the same slot: the second waits until the first has committed
      if (!a.skipSlotCheck && !(await getSlots(t, svc.id, a.start.slice(0, 10))).includes(a.start)) return { ok: false as const, error: "That time is no longer available." };
      // A prepaid pack covers the session: no deposit, and one session is used up.
      const pack = await get<{ id: number }>(`SELECT cp.id FROM customer_packs cp JOIN packs p ON p.id=cp.pack_id WHERE cp.tenant_id=? AND cp.phone=? AND cp.paid=1 AND cp.remaining>0 AND (p.service_id IS NULL OR p.service_id=?) ORDER BY cp.id LIMIT 1`, t.id, phone, svc.id);
      const deposit = pack || a.channel === "cockpit" ? 0 : svc.deposit;
      if (pack) await run("UPDATE customer_packs SET remaining=remaining-1 WHERE id=?", pack.id);
      await upsertCustomer(t.id, phone, name);
      const token = randomBytes(12).toString("hex");
      const id = (await run(`INSERT INTO bookings(tenant_id,service_id,customer_name,phone,start,"end",status,channel,deposit_due,token) VALUES (?,?,?,?,?,?,?,?,?,?)`,
              t.id, svc.id, name, phone, a.start, end, deposit > 0 ? "pending_deposit" : "confirmed", a.channel, deposit, token)).id;
      const booking = (await getBooking(t.id, id))!;
      const base = process.env.BASE_URL || "http://localhost:3000";
      const payUrl = deposit > 0 ? `${base}/pay/${token}` : undefined;
      const when = a.start.replace("T", " at ");
      await notify(t.id, phone, deposit > 0
              ? `Hi ${name}, we're holding ${svc.name} on ${when}. Pay the ${deposit} deposit to confirm: ${payUrl} (held for ${t.deposit_hold_min} min).`
              : `Hi ${name}, you're booked: ${svc.name} on ${when}. Manage your booking: ${base}/m/${token}`);
      return { ok: true as const, booking, payUrl };
    });
}

export async function confirmDeposit(tenantId: string, bookingId: number) {
  const b = await getBooking(tenantId, bookingId);
  if (!b || b.status !== "pending_deposit") return false;
  await run("UPDATE bookings SET status='confirmed', deposit_paid=1 WHERE id=?", b.id);
  await notify(tenantId, b.phone, `Deposit received - your ${b.service_name} on ${b.start.replace("T", " at ")} is confirmed. See you then!`);
  return true;
}

export async function setStatus(t: Tenant, id: number, status: "confirmed" | "completed" | "cancelled" | "no_show") {
  const b = await getBooking(t.id, id);
  if (!b) return false;
  await run("UPDATE bookings SET status=? WHERE id=?", status, id);
  if (status === "cancelled") {
    await notify(t.id, b.phone, `Your ${b.service_name} booking on ${b.start.replace("T", " at ")} was cancelled.`);
    await offerFreedSlot(t, b);
  }
  return true;
}

/** Cancellation frees a slot: offer it to waitlisted customers for that service and day. */
async function offerFreedSlot(t: Tenant, b: Booking) {
  const date = b.start.slice(0, 10);
  const w = await all<{ id: number; phone: string; name: string }>("SELECT id,phone,name FROM waitlist WHERE tenant_id=? AND service_id=? AND date=? AND notified=0 ORDER BY id LIMIT 3", t.id, b.service_id, date);
  const base = process.env.BASE_URL || "http://localhost:3000";
  for (const x of w) {
    await notify(t.id, x.phone, `Good news${x.name ? " " + x.name : ""}! A ${b.service_name} slot opened on ${b.start.replace("T", " at ")}. First come, first served: ${base}/book/${t.id}`);
    await run("UPDATE waitlist SET notified=1 WHERE id=?", x.id);
  }
  return w.length;
}

export async function cancelByCustomer(t: Tenant, id: number, phone: string) {
  const b = await getBooking(t.id, id);
  if (!b || b.phone !== cleanPhone(phone)) return { ok: false, error: "Booking not found." };
  if (b.status === "cancelled") return { ok: false, error: "Already cancelled." };
  await setStatus(t, id, "cancelled");
  return { ok: true };
}

export async function moveBooking(t: Tenant, id: number, newStart: string): Promise<{ ok: boolean; error?: string }> {
  const b = await getBooking(t.id, id);
  if (!b) return { ok: false, error: "Not found." };
  const svc = await getService(t.id, b.service_id);
  if (!svc) return { ok: false, error: "Service inactive." };
  return await tx(async () => {
      await lockKey(`calendar:${t.id}`);
      await run("UPDATE bookings SET status='cancelled' WHERE id=?", id); // free own slot for the availability check
      if (!(await getSlots(t, svc.id, newStart.slice(0, 10))).includes(newStart)) { await run("UPDATE bookings SET status=? WHERE id=?", b.status, id); return { ok: false, error: "That time is not available." }; }
      await run(`UPDATE bookings SET status=?, start=?, "end"=?, reminded24=0, reminded2=0 WHERE id=?`, b.status, newStart, addMin(newStart, svc.duration_min), id);
      await notify(t.id, b.phone, `Your ${svc.name} was moved to ${newStart.replace("T", " at ")}.`);
      return { ok: true };
    });
}

export const upcomingForPhone = (t: Tenant, phone: string) =>
  all<Booking>(`SELECT b.*, s.name AS service_name FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.tenant_id=? AND b.phone=? AND b.status IN ('confirmed','pending_deposit') AND b.start>? ORDER BY b.start`, t.id, cleanPhone(phone), nowLocal());

export async function joinWaitlist(t: Tenant, serviceId: number, date: string, phone: string, name: string) {
  if (!await getService(t.id, serviceId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Invalid request." };
  const p = cleanPhone(phone);
  if (await get("SELECT 1 FROM waitlist WHERE tenant_id=? AND service_id=? AND date=? AND phone=? AND notified=0", t.id, serviceId, date, p)) return { ok: true };
  await run("INSERT INTO waitlist(tenant_id,service_id,phone,name,date) VALUES (?,?,?,?,?)", t.id, serviceId, p, name.slice(0, 80), date);
  return { ok: true };
}

export const addBlock = async (tenantId: string, start: string, end: string, reason: string) =>
  start < end && await run(`INSERT INTO blocks(tenant_id,start,"end",reason) VALUES (?,?,?,?)`, tenantId, start, end, reason.slice(0, 120));

// ---------- scheduled work (called every minute from instrumentation.ts) ----------
export async function runSchedulers() {
  const now = nowLocal();
  for (const t of await all<Tenant>("SELECT * FROM tenants")) {
    // 1) 24h and 2h reminders, once each.
    // A booking made inside the 2h window never gets the 24h reminder (it would be sent seconds before the 2h one).
    await run("UPDATE bookings SET reminded24=1 WHERE tenant_id=? AND status='confirmed' AND reminded24=0 AND start<=?", t.id, addMin(now, 120));
    for (const [col, hours, label] of [["reminded24", 24, "coming up"], ["reminded2", 2, "in about 2 hours"]] as const) {
      for (const b of await all<Booking>(`SELECT b.*, s.name AS service_name FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.tenant_id=? AND b.status='confirmed' AND b.${col}=0 AND b.start>? AND b.start<=?`, t.id, now, addMin(now, hours * 60))) {
        await notify(t.id, b.phone, `Reminder: ${b.service_name} ${label} (${b.start.replace("T", " at ")}). Manage: ${process.env.BASE_URL || "http://localhost:3000"}/m/${b.token}`);
        await run(`UPDATE bookings SET ${col}=1${col === "reminded2" ? ", reminded24=1" : ""} WHERE id=?`, b.id);
      }
    }
    // 2) Unpaid deposits: free the slot once the hold expires or the appointment time arrives, then offer it to the waitlist.
    for (const b of await all<Booking>(`SELECT b.*, s.name AS service_name FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.tenant_id=? AND b.status='pending_deposit'`, t.id)) {
      const holdEnds = toLocalISO(new Date(new Date(b.created_at.replace(" ", "T") + "Z").getTime() + t.deposit_hold_min * 60000));
      if (now >= holdEnds || now >= b.start) {
        await run("UPDATE bookings SET status='cancelled' WHERE id=?", b.id);
        await notify(t.id, b.phone, `Your held ${b.service_name} slot (${b.start.replace("T", " at ")}) was released because the deposit wasn't paid.`);
        await offerFreedSlot(t, b);
      }
    }
    // 3) One review request after a completed visit (needs a review link).
    if (t.review_link) {
      for (const b of await all<Booking>("SELECT * FROM bookings WHERE tenant_id=? AND status='completed' AND review_asked=0", t.id)) {
        await notify(t.id, b.phone, `Thanks for visiting ${t.name}! If you enjoyed it, a quick review helps a lot: ${t.review_link}`, "marketing");
        await run("UPDATE bookings SET review_asked=1 WHERE id=?", b.id);
      }
    }
    // 4) Daily digest to the owner at/after 20:00, once per day.
    const today = now.slice(0, 10);
    if (t.owner_phone && now.slice(11) >= "20:00" && t.last_digest !== today) {
      const c = async (s: string) => (await get<{ c: number }>(s, t.id, `${today}%`))!.c;
      const booked = await c("SELECT COUNT(*) c FROM bookings WHERE tenant_id=? AND start LIKE ? AND status!='cancelled'");
      const tomorrow = (await get<{ c: number }>("SELECT COUNT(*) c FROM bookings WHERE tenant_id=? AND start LIKE ? AND status IN ('confirmed','pending_deposit')", t.id, `${addMin(today + "T00:00", 1440).slice(0, 10)}%`))!.c;
      await notify(t.id, t.owner_phone, `${t.name} daily digest: ${booked} booking(s) today, ${tomorrow} tomorrow.`);
      await run("UPDATE tenants SET last_digest=? WHERE id=?", today, t.id);
    }
  }
}
