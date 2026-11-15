import { DEFAULT_HOURS, get, run, tenantById, type Tenant } from "@/lib/db";
import { toLocalISO } from "@/lib/booking";

let n = 0;

/** Creates a user + business with one 30-minute service (and optionally a deposit). */
export async function makeTenant(opts: { deposit?: number; staff?: number; plan?: Tenant["plan"] } = {}) {
  n++;
  const u = await run("INSERT INTO users(email,name,pass_hash) VALUES (?,?,?)", `owner${n}@test.dev`, "Owner", "x:x");
  const id = `t${n}${Date.now().toString(36)}`;
  await run("INSERT INTO tenants(id,owner_id,name,hours,staff,plan,onboarded) VALUES (?,?,?,?,?,?,1)", id, u.id, "Test Salon", JSON.stringify(DEFAULT_HOURS), opts.staff ?? 1, opts.plan ?? "free");
  const svc = await run("INSERT INTO services(tenant_id,name,duration_min,price,deposit) VALUES (?,?,?,?,?)", id, "Haircut", 30, 400, opts.deposit ?? 0);
  return { tenant: (await tenantById(id))!, serviceId: svc.id };
}

/** A weekday (Mon-Fri) a few days ahead, as YYYY-MM-DD, so opening hours (09:00-18:00) apply. */
export function nextWeekday(minDaysAhead = 3): string {
  const d = new Date();
  d.setDate(d.getDate() + minDaysAhead);
  while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1);
  return toLocalISO(d).slice(0, 10);
}

export const countOutbox = async (tenantId: string, like: string) =>
  (await get<{ c: number }>("SELECT COUNT(*) c FROM outbox WHERE tenant_id=? AND body LIKE ?", tenantId, like))!.c;
