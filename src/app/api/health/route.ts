import { NextResponse } from "next/server";
import { startedAt } from "@/lib/runtime";

export const dynamic = "force-dynamic";

// Liveness: is the process up? Used by Docker HEALTHCHECK and load balancers.
export function GET() {
  return NextResponse.json({ status: "ok", uptimeSeconds: Math.round((Date.now() - startedAt) / 1000) });
}
