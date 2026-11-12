import { describe, expect, it } from "vitest";
import { get, run } from "@/lib/db";
import { cancelByCustomer, confirmDeposit, createBooking, getSlots, joinWaitlist, runSchedulers } from "@/lib/booking";
import { countOutbox, makeTenant, nextWeekday } from "./helpers";

const person = (name: string, i = 1) => ({ name, phone: `+9198000000${String(i).padStart(2, "0")}`, channel: "web" });

describe("slots", () => {
  it("offers slots inside opening hours and none on a closed day", () => {
    const { tenant, serviceId } = makeTenant();
    const slots = getSlots(tenant, serviceId, nextWeekday());
    expect(slots[0].endsWith("T09:00")).toBe(true);
    expect(slots.at(-1)!.endsWith("T17:30")).toBe(true);
    const sunday = new Date(); sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7 || 7));
    expect(getSlots(tenant, serviceId, sunday.toISOString().slice(0, 10))).toEqual([]);
  });

  it("rejects a bad date", () => {
    const { tenant, serviceId } = makeTenant();
    expect(getSlots(tenant, serviceId, "not-a-date")).toEqual([]);
  });
});

describe("booking", () => {
  it("books a slot and blocks a double booking with one staff member", () => {
    const { tenant, serviceId } = makeTenant();
    const start = `${nextWeekday()}T10:00`;
    const a = createBooking(tenant, { serviceId, start, ...person("Asha", 1) });
    expect(a.ok).toBe(true);
    const b = createBooking(tenant, { serviceId, start, ...person("Bob", 2) });
    expect(b).toMatchObject({ ok: false, error: "That time is no longer available." });
  });

  it("allows two bookings at the same time when there are two staff", () => {
    const { tenant, serviceId } = makeTenant({ staff: 2 });
    const start = `${nextWeekday()}T10:00`;
    expect(createBooking(tenant, { serviceId, start, ...person("A", 1) }).ok).toBe(true);
    expect(createBooking(tenant, { serviceId, start, ...person("B", 2) }).ok).toBe(true);
    expect(createBooking(tenant, { serviceId, start, ...person("C", 3) }).ok).toBe(false);
  });

  it("needs a name and a real phone number", () => {
    const { tenant, serviceId } = makeTenant();
    const start = `${nextWeekday()}T11:00`;
    expect(createBooking(tenant, { serviceId, start, name: "", phone: "+919800000001", channel: "web" }).ok).toBe(false);
    expect(createBooking(tenant, { serviceId, start, name: "X", phone: "12", channel: "web" }).ok).toBe(false);
  });

  it("does not let one business book another business's service", () => {
    const a = makeTenant(), b = makeTenant();
    const r = createBooking(b.tenant, { serviceId: a.serviceId, start: `${nextWeekday()}T10:00`, ...person("Mallory") });
    expect(r).toMatchObject({ ok: false, error: "Unknown service." });
  });

  it("stops new bookings once the free plan limit is reached", () => {
    const { tenant, serviceId } = makeTenant({ plan: "free" });
    for (let i = 0; i < 50; i++) run("INSERT INTO bookings(tenant_id,service_id,customer_name,phone,start,end,token) VALUES (?,?,?,?,?,?,?)", tenant.id, serviceId, "x", "+919800000000", "2030-01-01T10:00", "2030-01-01T10:30", `t${i}`);
    const r = createBooking(tenant, { serviceId, start: `${nextWeekday()}T10:00`, ...person("Late") });
    expect(r.ok).toBe(false);
  });

  it("lets the customer cancel only with their own phone number", () => {
    const { tenant, serviceId } = makeTenant();
    const r = createBooking(tenant, { serviceId, start: `${nextWeekday()}T12:00`, ...person("Meera", 5) });
    if (!r.ok) throw new Error("booking failed");
    expect(cancelByCustomer(tenant, r.booking.id, "+919899999999").ok).toBe(false);
    expect(cancelByCustomer(tenant, r.booking.id, "+919800000005").ok).toBe(true);
  });
});

describe("deposits and waitlist", () => {
  it("holds the slot until the deposit is paid", () => {
    const { tenant, serviceId } = makeTenant({ deposit: 150 });
    const r = createBooking(tenant, { serviceId, start: `${nextWeekday()}T14:00`, ...person("Dev", 4) });
    if (!r.ok) throw new Error("booking failed");
    expect(r.booking.status).toBe("pending_deposit");
    expect(r.payUrl).toContain("/pay/");
    expect(confirmDeposit(tenant.id, r.booking.id)).toBe(true);
    expect(get<{ status: string }>("SELECT status FROM bookings WHERE id=?", r.booking.id)!.status).toBe("confirmed");
  });

  it("frees an unpaid slot after the hold time and tells the waitlist", () => {
    const { tenant, serviceId } = makeTenant({ deposit: 150 });
    const date = nextWeekday(), start = `${date}T15:00`;
    const r = createBooking(tenant, { serviceId, start, ...person("Late payer", 6) });
    if (!r.ok) throw new Error("booking failed");
    expect(joinWaitlist(tenant, serviceId, date, "+919800000077", "Wendy").ok).toBe(true);
    run("UPDATE bookings SET created_at=datetime('now','-5 hours') WHERE id=?", r.booking.id);
    runSchedulers();
    expect(get<{ status: string }>("SELECT status FROM bookings WHERE id=?", r.booking.id)!.status).toBe("cancelled");
    expect(countOutbox(tenant.id, "%slot opened%")).toBe(1);
    expect(getSlots(tenant, serviceId, date)).toContain(start);
  });
});

describe("reminders", () => {
  it("sends the 2 hour reminder once and skips the 24 hour one for a last-minute booking", () => {
    const { tenant, serviceId } = makeTenant();
    const soon = new Date(Date.now() + 90 * 60000), p = (x: number) => String(x).padStart(2, "0");
    const start = `${soon.getFullYear()}-${p(soon.getMonth() + 1)}-${p(soon.getDate())}T${p(soon.getHours())}:${p(soon.getMinutes())}`;
    const r = createBooking(tenant, { serviceId, start, ...person("Soon", 8), skipSlotCheck: true });
    if (!r.ok) throw new Error("booking failed");
    runSchedulers(); runSchedulers();
    expect(countOutbox(tenant.id, "%in about 2 hours%")).toBe(1);
    expect(countOutbox(tenant.id, "%coming up%")).toBe(0);
  });
});
