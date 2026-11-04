import { requireCtx } from "@/lib/auth";
import { all, hasModule } from "@/lib/db";
import { STAGES } from "@/lib/commerce";
import ActionForm from "@/components/ActionForm";
import Modal from "@/components/Modal";
import { Icon } from "@/components/icons";
import { Field, Locked, PageHeader } from "@/components/ui";
import { addEnquiryAction, stageAction } from "../actions";

type E = { id: number; phone: string; name: string; summary: string; stage: string; value: number; updated_at: string };
const LABEL: Record<string, string> = { new: "New", contacted: "Contacted", qualified: "Qualified", won: "Won", lost: "Lost" };

export default async function Pipeline({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const { tenant: t } = await requireCtx();
  if (!hasModule(t, "leadgen")) return <><PageHeader title="Pipeline" /><Locked title="Leads & enquiries is switched off" href="/business-setup" cta="Open Business setup">Turn it on so your AI captures enquiries it can&apos;t close in chat.</Locked></>;
  const sp = await searchParams;
  const rows = all<E>("SELECT * FROM enquiries WHERE tenant_id=? ORDER BY updated_at DESC LIMIT 300", t.id);
  const stale = new Date(Date.now() - 2 * 864e5).toISOString().replace("T", " ").slice(0, 19);
  const open = rows.filter((r) => !["won", "lost"].includes(r.stage));
  return (
    <>
      <PageHeader title="Pipeline" sub={`${open.length} open · ${open.reduce((s, r) => s + r.value, 0) || 0} potential value`}>
        <Modal title="New enquiry" defaultOpen={sp.add === "1"} trigger={<button className="btn"><Icon n="plus" className="sm" /> New enquiry</button>}>
          <ActionForm action={addEnquiryAction} className="dlgform" success="Enquiry added" reset>
            <div className="dlg-b"><div className="fgrid c2"><Field label="Name"><input name="name" /></Field><Field label="Phone"><input name="phone" /></Field></div>
              <Field label="What do they want?"><textarea name="summary" rows={3} required /></Field><Field label="Estimated value"><input name="value" type="number" min="0" /></Field></div>
            <div className="dlg-f"><button className="btn">Add enquiry</button></div></ActionForm>
        </Modal>
      </PageHeader>
      <div className="board">
        {STAGES.map((s, si) => {
          const col = rows.filter((r) => r.stage === s);
          return (
            <section key={s} className="lane" aria-label={LABEL[s]}>
              <div className="lane-h"><span>{LABEL[s]}</span><span className={`badge ${s} plain`}>{col.length}</span></div>
              {col.map((e) => (
                <article key={e.id} className="kcard">
                  <div className="row between"><b className="sm">{e.name || e.phone}</b>{e.value > 0 && <span className="badge info plain">{e.value}</span>}</div>
                  <p className="sm muted">{e.summary}</p>
                  <div className="row between"><span className="tiny muted">{e.updated_at <= stale && !["won", "lost"].includes(e.stage) ? <span className="badge warn plain">Quiet 2d+</span> : e.updated_at.slice(5, 16)}</span>
                    <div className="row">
                      <a className="ibtn" aria-label="Message on WhatsApp" href={`https://wa.me/${e.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${e.name || ""}, following up on your enquiry with ${t.name}.`)}`} target="_blank" rel="noreferrer"><Icon n="chat" className="sm" /></a>
                      <ActionForm action={stageAction} className="row" success="Moved"><input type="hidden" name="id" value={e.id} />
                        {si < 3 && <button className="btn soft s" name="stage" value={STAGES[si + 1]}>{LABEL[STAGES[si + 1]]} <Icon n="arrow" className="sm" /></button>}
                        {s !== "lost" && s !== "won" && <button className="ibtn" name="stage" value="lost" aria-label="Mark lost" title="Mark lost"><Icon n="x" className="sm" /></button>}
                        {(s === "won" || s === "lost") && <button className="btn ghost s" name="stage" value="new">Reopen</button>}</ActionForm></div></div>
                </article>))}
              {!col.length && <div className="tiny muted" style={{ textAlign: "center", padding: 14 }}>Empty</div>}
            </section>);
        })}
      </div>
    </>
  );
}
