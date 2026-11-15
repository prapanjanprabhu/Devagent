import { NextResponse } from "next/server";
import { get } from "@/lib/db";

export const dynamic = "force-dynamic";

// Readiness: can we actually serve traffic? Checks the database.
export async function GET() {
  try {
    const t0 = Date.now();
    await get("SELECT 1 AS ok");
    return NextResponse.json({ status: "ready", checks: { database: { ok: true, ms: Date.now() - t0 } } });
  } catch (e) {
    return NextResponse.json({ status: "not_ready", checks: { database: { ok: false } } }, { status: 503 });
  }
}
