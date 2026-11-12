import { NextResponse } from "next/server";
import { createDepositOrder } from "@/lib/payments";

export async function POST(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const r = await createDepositOrder((await params).token);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
