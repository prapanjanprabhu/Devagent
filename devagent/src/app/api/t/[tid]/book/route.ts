import { NextRequest, NextResponse } from "next/server";
import { tenantById } from "@/lib/db";
import { createBooking } from "@/lib/booking";
import { ipOf, limited } from "@/lib/ratelimit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ tid: string }> }) {
  const t = tenantById((await params).tid);
  if (!t) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (limited(`book:${ipOf(req)}`, 10, 60_000)) return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  const r = createBooking(t, { serviceId: Number(b.serviceId), start: String(b.start ?? ""), name: String(b.name ?? ""), phone: String(b.phone ?? ""), channel: "web" });
  return NextResponse.json(r.ok ? { ok: true, booking: { id: r.booking.id, start: r.booking.start, status: r.booking.status }, payUrl: r.payUrl } : r, { status: r.ok ? 200 : 400 });
}
