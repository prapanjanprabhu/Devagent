import { describe, expect, it } from "vitest";
import { afterCommit, all, get, run, tx, withLeader } from "@/lib/db";
import { createBooking } from "@/lib/booking";
import { createOrder } from "@/lib/commerce";
import { makeTenant, nextWeekday } from "./helpers";

// Two website pods share one database. These tests fire requests at the same moment
// (separate database connections, like two pods would) and check nothing goes wrong.

const person = (n: number) => ({ name: `P${n}`, phone: `+91980000${String(n).padStart(4, "0")}`, channel: "web" });

describe("two pods at the same time", () => {
  it("sells a single slot only once, even when 8 people click at the same moment", async () => {
    const { tenant, serviceId } = await makeTenant();
    const start = `${nextWeekday()}T10:00`;
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => createBooking(tenant, { serviceId, start, ...person(i + 1) })));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const rows = await all("SELECT id FROM bookings WHERE tenant_id=? AND start=? AND status<>'cancelled'", tenant.id, start);
    expect(rows).toHaveLength(1);
  });

  it("never oversells stock when orders arrive together", async () => {
    const { tenant } = await makeTenant();
    const p = await run("INSERT INTO products(tenant_id,name,price,stock) VALUES (?,?,?,?)", tenant.id, "Shampoo", 100, 3);
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) => createOrder(tenant, { phone: `+91981000${String(i).padStart(4, "0")}`, name: `C${i}`, items: [{ product_id: p.id, qty: 1 }], channel: "web" })),
    );
    const sold = results.filter((r) => r.status === "fulfilled" && (r.value as { ok: boolean }).ok).length;
    expect(sold).toBe(3);
    expect((await get<{ stock: number }>("SELECT stock FROM products WHERE id=?", p.id))?.stock).toBe(0);
  });

  it("lets only one pod run the background job at a time", async () => {
    let running = 0, peak = 0, ran = 0;
    const job = async () => { running++; peak = Math.max(peak, running); ran++; await new Promise((r) => setTimeout(r, 150)); running--; };
    const outcomes = await Promise.all([withLeader("test-job", job), withLeader("test-job", job), withLeader("test-job", job)]);
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    expect(ran).toBe(1);
    expect(peak).toBe(1);
    expect(await withLeader("test-job", job)).toBe(true); // free again once the first run ended
  });
});

describe("transactions", () => {
  it("undoes everything and sends nothing when a step fails", async () => {
    const { tenant } = await makeTenant();
    let sent = false;
    await expect(tx(async () => {
      await run("INSERT INTO knowledge(tenant_id,q,a) VALUES (?,?,?)", tenant.id, "q", "a");
      afterCommit(() => { sent = true; });
      throw new Error("boom");
    })).rejects.toThrow("boom");
    expect(await all("SELECT id FROM knowledge WHERE tenant_id=?", tenant.id)).toHaveLength(0);
    expect(sent).toBe(false);
  });

  it("sends the message only after the data is saved", async () => {
    const { tenant } = await makeTenant();
    let seenInside = -1;
    await tx(async () => {
      await run("INSERT INTO knowledge(tenant_id,q,a) VALUES (?,?,?)", tenant.id, "q2", "a2");
      afterCommit(() => { void all("SELECT id FROM knowledge WHERE tenant_id=?", tenant.id).then((r) => { seenInside = r.length; }); });
    });
    await new Promise((r) => setTimeout(r, 100));
    expect(seenInside).toBe(1); // the side effect ran after COMMIT, so other connections can already see the row
  });
});
