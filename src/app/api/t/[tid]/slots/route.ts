import { NextRequest, NextResponse } from "next/server";
import { tenantById } from "@/lib/db";
import { getSlots } from "@/lib/booking";

export async function GET(req: NextRequest, { params }: { params: Promise<{ tid: string }> }) {
  const t = tenantById((await params).tid);
  if (!t) return NextResponse.json({ slots: [] }, { status: 404 });
  const q = req.nextUrl.searchParams;
  return NextResponse.json({ slots: getSlots(t, Number(q.get("service")), q.get("date") ?? "") });
}
