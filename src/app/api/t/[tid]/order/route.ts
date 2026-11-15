import { NextRequest, NextResponse } from "next/server";
import { tenantById, hasModule } from "@/lib/db";
import { createOrder } from "@/lib/commerce";
import { ipOf, limited } from "@/lib/ratelimit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ tid: string }> }) {
  const t = await tenantById((await params).tid);
  if (!t || !hasModule(t, "commerce")) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (limited(`ord:${ipOf(req)}`, 10, 60_000)) return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  try {
    const r = await createOrder(t, { phone: String(b.phone ?? ""), name: String(b.name ?? ""), items: Array.isArray(b.items) ? b.items.map((i: any) => ({ product_id: Number(i.product_id), qty: Number(i.qty) })) : [], channel: "web" });
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  } catch (e: any) { return NextResponse.json({ ok: false, error: String(e.message) }, { status: 400 }); }
}
