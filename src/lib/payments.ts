import { createHmac, timingSafeEqual } from "node:crypto";
import { get, run, tenantById, type Booking } from "./db";
import { confirmDeposit } from "./booking";

/**
 * Deposits settle straight to the business's OWN Razorpay account (keys stored per tenant); the platform takes no commission.
 * NOTE: this path needs real Razorpay keys and has not been exercised against Razorpay's live/test API.
 */
export async function createDepositOrder(token: string): Promise<{ ok: true; orderId: string; keyId: string; amount: number; bookingId: number } | { ok: false; error: string }> {
  const b = await get<Booking>("SELECT * FROM bookings WHERE token=?", token);
  if (!b || b.status !== "pending_deposit") return { ok: false, error: "This deposit is no longer payable." };
  const t = (await tenantById(b.tenant_id))!;
  if (!t.rz_key_id || !t.rz_key_secret) return { ok: false, error: "Online payment isn't enabled for this business." };
  const amount = Math.round(b.deposit_due * 100); // paise
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${t.rz_key_id}:${t.rz_key_secret}`).toString("base64"), "Content-Type": "application/json" },
    body: JSON.stringify({ amount, currency: "INR", receipt: `bk_${b.id}`, notes: { booking_id: String(b.id), tenant: t.id } }),
  });
  if (!res.ok) return { ok: false, error: "Could not start payment." };
  const o = await res.json();
  await run("INSERT INTO payments(tenant_id,kind,ref_id,amount,provider,provider_ref) VALUES (?,?,?,?,?,?)", t.id, "deposit", b.id, b.deposit_due, "razorpay", o.id);
  return { ok: true, orderId: o.id, keyId: t.rz_key_id, amount, bookingId: b.id };
}

/** Verifies Razorpay's checkout signature (HMAC-SHA256 of "order_id|payment_id") before confirming the booking. */
export async function verifyDepositPayment(token: string, orderId: string, paymentId: string, signature: string): Promise<boolean> {
  const b = await get<Booking>("SELECT * FROM bookings WHERE token=?", token);
  if (!b) return false;
  const t = (await tenantById(b.tenant_id))!;
  const pay = await get<{ id: number }>("SELECT id FROM payments WHERE tenant_id=? AND ref_id=? AND provider_ref=? AND status='created'", t.id, b.id, orderId);
  if (!pay || !t.rz_key_secret) return false;
  const exp = createHmac("sha256", t.rz_key_secret).update(`${orderId}|${paymentId}`).digest("hex");
  if (exp.length !== signature.length || !timingSafeEqual(Buffer.from(exp), Buffer.from(signature))) return false;
  await run("UPDATE payments SET status='paid' WHERE id=?", pay.id);
  return await confirmDeposit(t.id, b.id);
}
