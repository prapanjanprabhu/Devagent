import { NextRequest, NextResponse } from "next/server";
import { verifyDepositPayment } from "@/lib/payments";

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const b = await req.json().catch(() => ({}));
  const ok = verifyDepositPayment((await params).token, String(b.razorpay_order_id ?? ""), String(b.razorpay_payment_id ?? ""), String(b.razorpay_signature ?? ""));
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
