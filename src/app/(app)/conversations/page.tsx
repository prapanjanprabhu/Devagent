import Link from "next/link";
import { requireCtx } from "@/lib/auth";
import { all } from "@/lib/db";
import ActionForm from "@/components/ActionForm";
import Tabs from "@/components/Tabs";
import { Icon } from "@/components/icons";
import { Empty, PageHeader } from "@/components/ui";
import { replyAction } from "../actions";

export default async function Conversations({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { tenant: t } = await requireCtx();
  const threads = await all<{ phone: string; last: string; n: number; preview: string }>(
      "SELECT phone, MAX(created_at) AS last, COUNT(*) AS n, (SELECT content FROM chat_messages c2 WHERE c2.tenant_id=c.tenant_id AND c2.phone=c.phone ORDER BY id DESC LIMIT 1) AS preview FROM chat_messages c WHERE c.tenant_id=? GROUP BY c.tenant_id, c.phone ORDER BY last DESC LIMIT 100", t.id);
  const p = (await searchParams).p ?? threads[0]?.phone;
  const msgs = p ? await all<{ role: string; content: string; created_at: string }>("SELECT role,content,created_at FROM chat_messages WHERE tenant_id=? AND phone=? ORDER BY id", t.id, p) : [];
  const out = await all<{ phone: string; body: string; kind: string; delivered: number; created_at: string }>("SELECT phone,body,kind,delivered,created_at FROM outbox WHERE tenant_id=? ORDER BY id DESC LIMIT 40", t.id);
  const chats = (
    <div className="card chatbox">
      <div className="threads">
        {threads.map((x) => (<Link key={x.phone} href={`/conversations?p=${encodeURIComponent(x.phone)}`} className="thread" aria-current={x.phone === p}><div className="row between"><b className="sm">{x.phone}</b><span className="tiny muted">{x.n}</span></div><div className="tiny muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.preview}</div></Link>))}
        {!threads.length && <Empty icon="chat" title="No conversations yet">WhatsApp chats appear here.</Empty>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
        {p ? (<>
          <div className="card-h"><b>{p}</b><span className="tiny muted">AI replies automatically · you can step in</span></div>
          <div className="msgs">{msgs.map((m, i) => <div key={i} className={`bub ${m.role === "user" ? "user" : "assistant"}`}>{m.content}</div>)}</div>
          <ActionForm action={replyAction} className="composer" success="Reply sent" reset closeModal={false}><input type="hidden" name="phone" value={p} /><input name="body" placeholder="Reply as owner…" aria-label="Reply" autoComplete="off" /><button className="btn"><Icon n="arrow" className="sm" /> Send</button></ActionForm>
        </>) : <Empty icon="chat" title="Select a conversation" />}
      </div>
    </div>
  );
  const outbox = (
    <div className="card"><div className="card-h"><h3>Every message sent</h3><span className="muted sm">“sent” = delivered via WhatsApp · “logged only” = WhatsApp not connected</span></div>
      <div className="scroll" style={{ maxHeight: "calc(100vh - 270px)" }}><table className="tbl"><thead><tr><th>Time</th><th>To</th><th>Type</th><th>Message</th><th>Status</th></tr></thead><tbody>
        {out.map((m, i) => <tr key={i}><td className="num muted">{m.created_at}</td><td className="num">{m.phone}</td><td><span className="badge plain">{m.kind}</span></td><td className="sm">{m.body}</td><td>{m.delivered ? <span className="badge ok">sent</span> : <span className="badge warn">logged only</span>}</td></tr>)}
      </tbody></table>{!out.length && <Empty title="Nothing sent yet" />}</div></div>
  );
  return (<><PageHeader title="Chats" sub="Customer conversations and every outgoing message." /><Tabs tabs={[{ id: "chats", label: "Conversations", badge: threads.length, content: chats }, { id: "outbox", label: "Outbox", content: outbox }]} /></>);
}
