import { randomBytes } from "node:crypto";
import { all, get, run, tx, type Tenant } from "./db";
import { notify } from "./notify";
import { cleanPhone, upsertCustomer } from "./booking";
import { atActionCap } from "./plans";

export type Product = { id: number; tenant_id: string; name: string; price: number | null; stock: number | null; active: number };
export const activeProducts = (tid: string) => all<Product>("SELECT * FROM products WHERE tenant_id=? AND active=1 ORDER BY id", tid);

/** Create an order from [{product_id, qty}]. Price stays null (to be quoted) if any item has no price. Stock is decremented atomically. */
export async function createOrder(t: Tenant, a: { phone: string; name: string; items: { product_id: number; qty: number }[]; channel: string }):
  Promise<{ ok: true; id: number; total: number | null } | { ok: false; error: string }> {
  const phone = cleanPhone(a.phone ?? ""), name = (a.name ?? "").trim().slice(0, 80);
  if (phone.replace(/\D/g, "").length < 7) return { ok: false, error: "A valid phone number is required." };
  if (!a.items?.length) return { ok: false, error: "No items." };
  if (await atActionCap(t)) return { ok: false, error: "Monthly order limit reached for this business." };
  return await tx(async () => {
      const lines: { name: string; qty: number; price: number | null }[] = [];
      let total: number | null = 0;
      for (const it of a.items) {
        const qty = Math.floor(it.qty);
        const p = await get<Product>("SELECT * FROM products WHERE id=? AND tenant_id=? AND active=1", it.product_id, t.id);
        if (!p || !(qty > 0 && qty <= 100)) throw new Error("Unknown product or bad quantity.");
        // One atomic update: if another pod just sold the last ones, no row changes and we stop.
        if (p.stock !== null && (await run("UPDATE products SET stock=stock-? WHERE id=? AND stock>=?", qty, p.id, qty)).changes === 0) {
          const left = (await get<{ stock: number }>("SELECT stock FROM products WHERE id=?", p.id))?.stock ?? 0;
          throw new Error(`Only ${left} of ${p.name} left.`);
        }
        lines.push({ name: p.name, qty, price: p.price });
        total = total !== null && p.price !== null ? total + p.price * qty : null;
      }
      await upsertCustomer(t.id, phone, name);
      const id = (await run("INSERT INTO orders(tenant_id,phone,name,items,total,channel,token) VALUES (?,?,?,?,?,?,?)", t.id, phone, name, JSON.stringify(lines), total, a.channel, randomBytes(12).toString("hex"))).id;
      await notify(t.id, phone, `Thanks${name ? " " + name : ""}! Order #${id} received: ${lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}${total !== null ? ` - total ${total}` : " - we'll confirm the price shortly"}.`);
      return { ok: true as const, id, total };
    }) as any;
}

export const ORDER_STATUSES = ["new", "confirmed", "ready", "delivered", "cancelled"] as const;
export async function setOrderStatus(tid: string, id: number, status: string, paid?: boolean) {
  if (!(ORDER_STATUSES as readonly string[]).includes(status)) return;
  const o = await get<{ phone: string }>("SELECT phone FROM orders WHERE id=? AND tenant_id=?", id, tid);
  if (!o) return;
  await run("UPDATE orders SET status=?, paid=COALESCE(?,paid) WHERE id=?", status, paid === undefined ? null : paid ? 1 : 0, id);
  if (status === "ready" || status === "delivered") await notify(tid, o.phone, `Your order #${id} is ${status}.`);
}

// ---------- leads & enquiries ----------
export const STAGES = ["new", "contacted", "qualified", "won", "lost"] as const;
export async function captureEnquiry(t: Tenant, a: { phone: string; name: string; summary: string; value?: number }) {
  const phone = cleanPhone(a.phone);
  if (!a.summary?.trim()) return { ok: false, error: "Summary required." };
  await upsertCustomer(t.id, phone, a.name ?? "");
  const id = (await run("INSERT INTO enquiries(tenant_id,phone,name,summary,value) VALUES (?,?,?,?,?)", t.id, phone, (a.name ?? "").slice(0, 80), a.summary.slice(0, 1000), Math.max(0, a.value ?? 0))).id;
  if (t.owner_phone) await notify(t.id, t.owner_phone, `New enquiry #${id} from ${a.name || phone}: ${a.summary.slice(0, 200)}`);
  return { ok: true, id };
}
export async function setEnquiryStage(tid: string, id: number, stage: string) {
  if ((STAGES as readonly string[]).includes(stage)) await run("UPDATE enquiries SET stage=?, updated_at=dv_dt() WHERE id=? AND tenant_id=?", stage, id, tid);
}
