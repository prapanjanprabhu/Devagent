import { requireCtx } from "@/lib/auth";
import { all } from "@/lib/db";
import ActionForm from "@/components/ActionForm";
import { Icon } from "@/components/icons";
import { Empty, Field, PageHeader } from "@/components/ui";
import { addAnswerAction, deleteAnswerAction } from "../actions";

export default async function AgentConfig() {
  const { tenant: t } = await requireCtx();
  const faq = await all<{ id: number; q: string; a: string }>("SELECT * FROM knowledge WHERE tenant_id=? ORDER BY id", t.id);
  const ai = !!process.env.ANTHROPIC_API_KEY;
  return (
    <>
      <PageHeader title="AI agent" sub="It only uses your services, products, hours and the answers below - it never invents prices.">
        <span className={`badge ${ai ? "ok" : "warn"}`}>{ai ? "Claude agent active" : "Fallback replies - add ANTHROPIC_API_KEY for full AI booking"}</span>
      </PageHeader>
      <div className="bento g21" style={{ alignItems: "start" }}>
        <div className="col" style={{ gap: 14 }}>
          <ActionForm action={addAnswerAction} className="card card-b col" success="Answer added" reset>
            <b>Teach it an answer</b>
            <div className="fgrid c2"><Field label="When someone asks…"><input name="q" placeholder="Do you take walk-ins?" required /></Field><Field label="Answer with…"><input name="a" placeholder="Yes, subject to availability." required /></Field></div>
            <div><button className="btn s"><Icon n="plus" className="sm" /> Add answer</button></div>
          </ActionForm>
          <div className="card"><div className="card-h"><h3>Known answers</h3><span className="muted sm">{faq.length}</span></div>
            <div className="list scroll" style={{ maxHeight: "calc(100vh - 360px)" }}>
              {faq.map((f) => (<div key={f.id}><div className="grow1"><b className="sm">{f.q}</b><div className="sm muted">{f.a}</div></div>
                <ActionForm action={deleteAnswerAction} success="Removed"><input type="hidden" name="id" value={f.id} /><button className="ibtn" aria-label="Delete answer"><Icon n="x" className="sm" /></button></ActionForm></div>))}
              {!faq.length && <Empty icon="bot" title="No custom answers yet">Add FAQs like parking, cancellation policy or walk-ins.</Empty>}
            </div></div>
        </div>
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="card-h"><h3>Try it live</h3></div>
          <iframe title="Agent preview" src={`/embed/${t.id}`} style={{ width: "100%", height: "min(520px, calc(100vh - 260px))", border: 0, display: "block" }} />
        </div>
      </div>
    </>
  );
}
