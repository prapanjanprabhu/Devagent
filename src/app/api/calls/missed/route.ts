import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { get, run, type Tenant } from "@/lib/db";
import { notify } from "@/lib/notify";
import { cleanPhone } from "@/lib/booking";
import { RESCUE_PRICE_INR } from "@/lib/plans";

/**
 * Call Rescue webhook. Point your telephony provider's "unanswered call" event here with header
 * x-rescue-secret = RESCUE_WEBHOOK_SECRET and JSON {to: <rescue number>, from: <caller>}.
 * The caller is WhatsApp-messaged immediately; the business is charged only for rescued calls (credits).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RESCUE_WEBHOOK_SECRET, got = req.headers.get("x-rescue-secret") ?? "";
  if (!secret || got.length !== secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(secret))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const t = await get<Tenant>("SELECT * FROM tenants WHERE rescue_number=?", String(b.to ?? ""));
  const from = cleanPhone(String(b.from ?? ""));
  if (!t || from.replace(/\D/g, "").length < 7) return NextResponse.json({ error: "unknown number" }, { status: 404 });
  const funded = t.credits >= RESCUE_PRICE_INR;
  await run("INSERT INTO calls(tenant_id,from_phone,rescued) VALUES (?,?,?)", t.id, from, funded ? 1 : 0);
  if (!funded) return NextResponse.json({ ok: true, rescued: false, reason: "no credits" });
  await run("UPDATE tenants SET credits=credits-? WHERE id=?", RESCUE_PRICE_INR, t.id);
  await notify(t.id, from, `Hi! Sorry we missed your call at ${t.name}. Reply here and our assistant will help you right away - or book: ${process.env.BASE_URL || "http://localhost:3000"}/book/${t.id}`);
  return NextResponse.json({ ok: true, rescued: true });
}
