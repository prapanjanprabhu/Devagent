import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { all, get, run, tenantById, type Tenant } from "@/lib/db";
import { agentReply, type Msg } from "@/lib/agent";
import { notify } from "@/lib/notify";
import { optOut } from "@/lib/crm";

// Meta webhook verification handshake.
export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === (process.env.WA_VERIFY_TOKEN || "devagent-verify")) return new NextResponse(q.get("hub.challenge") ?? "");
  return new NextResponse("forbidden", { status: 403 });
}

/** Each business connects its own WhatsApp number; the inbound payload's phone_number_id selects the tenant. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = process.env.WA_APP_SECRET; // REQUIRED in production: verifies the payload really came from Meta
  if (secret) {
    const sig = req.headers.get("x-hub-signature-256") ?? "", exp = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
    if (sig.length !== exp.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(exp))) return new NextResponse("bad signature", { status: 401 });
  }
  let payload: any; try { payload = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }
  for (const change of payload?.entry?.[0]?.changes ?? []) {
    const v = change.value, msg = v?.messages?.[0];
    if (msg?.type !== "text") continue;
    const phoneId = String(v.metadata?.phone_number_id ?? "");
    const t = (phoneId && await get<Tenant>("SELECT * FROM tenants WHERE wa_phone_id=?", phoneId)) || (process.env.DEFAULT_TENANT ? await tenantById(process.env.DEFAULT_TENANT) : undefined);
    if (!t) continue;
    const phone = "+" + String(msg.from).replace(/\D/g, ""), text = String(msg.text?.body ?? "").slice(0, 2000);
    if (/^\s*stop\s*$/i.test(text)) { await optOut(t.id, phone); await notify(t.id, phone, "You've been unsubscribed from promotional messages."); continue; }
    await run("INSERT INTO chat_messages(tenant_id,phone,role,content) VALUES (?,?,?,?)", t.id, phone, "user", text);
    const history = (await all<Msg>("SELECT role,content FROM chat_messages WHERE tenant_id=? AND phone=? ORDER BY id DESC LIMIT 12", t.id, phone)).reverse();
    while (history.length && history[0].role !== "user") history.shift();
    const reply = await agentReply(t, history, "whatsapp", phone);
    await run("INSERT INTO chat_messages(tenant_id,phone,role,content) VALUES (?,?,?,?)", t.id, phone, "assistant", reply);
    await notify(t.id, phone, reply);
  }
  return NextResponse.json({ ok: true });
}
