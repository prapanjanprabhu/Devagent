import { NextRequest, NextResponse } from "next/server";
import { tenantById } from "@/lib/db";
import { agentReply, type Msg } from "@/lib/agent";
import { ipOf, limited } from "@/lib/ratelimit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ tid: string }> }) {
  const t = tenantById((await params).tid);
  if (!t) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (limited(`chat:${ipOf(req)}`, 20, 60_000)) return NextResponse.json({ reply: "You're sending messages too quickly - please wait a moment." }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const messages: Msg[] = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string").slice(-20)
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") return NextResponse.json({ error: "bad request" }, { status: 400 });
  return NextResponse.json({ reply: await agentReply(t, messages, "web") });
}
