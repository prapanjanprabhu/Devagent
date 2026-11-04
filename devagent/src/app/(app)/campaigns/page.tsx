import { requireCtx } from "@/lib/auth";
import { all } from "@/lib/db";
import { SEGMENTS, segmentMembers, type Segment } from "@/lib/crm";
import { PLANS, broadcastsThisMonth } from "@/lib/plans";
import CampaignComposer from "@/components/CampaignComposer";
import { Empty, PageHeader } from "@/components/ui";
import { campaignAction } from "../actions";

export default async function Campaigns() {
  const { tenant: t } = await requireCtx();
  const past = all<{ id: number; name: string; segment: string; sent: number; created_at: string }>("SELECT * FROM campaigns WHERE tenant_id=? ORDER BY id DESC LIMIT 8", t.id);
  const cap = PLANS[t.plan].broadcastCap, used = broadcastsThisMonth(t.id);
  const segments = (Object.keys(SEGMENTS) as Segment[]).map((k) => ({ key: k, label: SEGMENTS[k], n: segmentMembers(t.id, k).length }));
  return (
    <>
      <PageHeader title="Campaigns" sub="Offers, festival wishes and win-backs on WhatsApp. Customers who reply STOP are excluded." />
      <CampaignComposer segments={segments} action={campaignAction} business={t.name} left={cap === Infinity ? "unlimited broadcasts" : `${Math.max(0, cap - used)} of ${cap} broadcasts left this month`} />
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h"><h3>Recent campaigns</h3><span className="muted sm">Marketing messages outside WhatsApp&apos;s 24h window need Meta-approved templates.</span></div>
        {past.length ? <table className="tbl"><tbody>{past.map((c) => <tr key={c.id}><td><b>{c.name}</b></td><td className="muted">{SEGMENTS[c.segment as Segment] ?? c.segment}</td><td className="num">{c.sent} sent</td><td className="num muted">{c.created_at}</td></tr>)}</tbody></table> : <Empty icon="mega" title="No campaigns yet" />}
      </div>
    </>
  );
}
