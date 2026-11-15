import { requireCtx } from "@/lib/auth";
import { findOpportunities } from "@/lib/crm";
import { PLANS } from "@/lib/plans";
import ActionForm from "@/components/ActionForm";
import { Empty, Locked, PageHeader } from "@/components/ui";
import { sendOpportunityAction } from "../actions";

export default async function Grow() {
  const { tenant: t } = await requireCtx();
  if (!PLANS[t.plan].growth) return <><PageHeader title="Grow agent" /><Locked title="The Grow agent is part of the paid plans">Win-backs, review requests and pack reminders - drafted for you, sent from your own number.</Locked></>;
  const ops = await findOpportunities(t);
  return (
    <>
      <PageHeader title="Grow agent" sub="Your customer list, worked for you. Review each draft, then send it in one click." />
      {!t.review_link && <div className="notice" style={{ marginBottom: 14 }}>Add a Google review link in <a href="/business-setup">Business setup</a> to enable review requests.</div>}
      <div className="bento g3">
        {ops.map((o) => (
          <ActionForm key={o.key} action={sendOpportunityAction} className="card card-b col" success="Message queued">
            <input type="hidden" name="key" value={o.key} />
            <div className="row between"><span className="badge info plain">{o.kind}</span><span className="sm strong">{o.name || o.phone}</span></div>
            <p className="sm muted" style={{ flex: 1 }}>{o.draft}</p><button className="btn s">Send</button>
          </ActionForm>))}
      </div>
      {!ops.length && <div className="card"><Empty icon="spark" title="No opportunities right now">They appear as customers drift away or finish visits.</Empty></div>}
    </>
  );
}
