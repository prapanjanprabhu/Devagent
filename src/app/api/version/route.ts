import { NextResponse } from "next/server";
import { versionInfo } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(versionInfo());
}
