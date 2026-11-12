import { NextRequest, NextResponse } from "next/server";
import { tenantById } from "@/lib/db";
import { joinWaitlist } from "@/lib/booking";
import { ipOf, limited } from "@/lib/ratelimit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ tid: string }> }) {
  const t = tenantById((await params).tid);
  if (!t) return NextResponse.json({ ok: false }, { status: 404 });
  if (limited(`wl:${ipOf(req)}`, 10, 60_000)) return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  return NextResponse.json(joinWaitlist(t, Number(b.serviceId), String(b.date ?? ""), String(b.phone ?? ""), String(b.name ?? "")));
}
