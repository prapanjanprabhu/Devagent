"use client";
import { useState } from "react";

declare global { interface Window { Razorpay?: new (o: any) => { open(): void } } }

export default function PayButton({ token, name }: { token: string; name: string }) {
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  async function pay() {
    setBusy(true); setMsg("");
    if (!window.Razorpay) await new Promise<void>((res, rej) => { const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js"; s.onload = () => res(); s.onerror = () => rej(); document.body.appendChild(s); }).catch(() => setMsg("Could not load the payment form."));
    const o = await fetch(`/api/pay/${token}`, { method: "POST" }).then((r) => r.json());
    if (!o.ok || !window.Razorpay) { setMsg(o.error ?? "Payment unavailable."); setBusy(false); return; }
    new window.Razorpay({
      key: o.keyId, amount: o.amount, currency: "INR", order_id: o.orderId, name: "Deposit", prefill: { name },
      handler: async (r: any) => { const v = await fetch(`/api/pay/${token}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r) }).then((x) => x.json()); setMsg(v.ok ? "Paid - your booking is confirmed!" : "We couldn't verify the payment."); if (v.ok) location.reload(); },
    }).open();
    setBusy(false);
  }
  return (<><button className="btn l block" disabled={busy} onClick={pay}>{busy ? "Opening…" : "Pay deposit"}</button>{msg && <p className="sm" role="status">{msg}</p>}</>);
}
