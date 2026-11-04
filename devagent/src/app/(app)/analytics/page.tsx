import { requireCtx } from "@/lib/auth";
import { analytics } from "@/lib/crm";
import { Bar, PageHeader, Stat } from "@/components/ui";

const Dist = ({ title, d }: { title: string; d: Record<string, number> }) => {
  const max = Math.max(0, ...Object.values(d));
  return (<div className="card card-b"><b>{title}</b><div style={{ marginTop: 6 }}>{Object.keys(d).length ? Object.entries(d).map(([k, v]) => <Bar key={k} label={k} v={v} max={max} />) : <p className="sm muted">No data yet.</p>}</div></div>);
};

export default async function Analytics() {
  const { tenant: t } = await requireCtx();
  const a = analytics(t.id);
  return (
    <>
      <PageHeader title="Analytics" sub="Last 30 days" />
      <div className="bento g4" style={{ marginBottom: 14 }}>
        <Stat dark icon="check" l="Completed" v={a.status.completed ?? 0} />
        <Stat icon="alert" l="No-show rate" v={a.noShowRate === null ? "-" : `${a.noShowRate}%`} />
        <Stat icon="tag" l="Revenue (listed prices)" v={a.revenue} />
        <Stat icon="bag" l={`Orders · ${a.orderValue}`} v={a.orders} />
      </div>
      <div className="bento g3"><Dist title="Bookings by status" d={a.status} /><Dist title="By channel" d={a.channel} /><Dist title="Enquiries by stage" d={a.enquiries} /></div>
    </>
  );
}
