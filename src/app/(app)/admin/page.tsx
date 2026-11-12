import { notFound } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import { all } from "@/lib/db";
import { PageHeader, Stat } from "@/components/ui";

export default async function Admin() {
  const { isAdmin } = await requireCtx();
  if (!isAdmin) notFound(); // set ADMIN_EMAIL to the platform operator's login email
  const rows = all<{ id: string; name: string; plan: string; vertical: string; email: string; bookings: number; created_at: string }>(
    `SELECT t.id, t.name, t.plan, t.vertical, u.email, t.created_at, (SELECT COUNT(*) FROM bookings b WHERE b.tenant_id=t.id) bookings FROM tenants t JOIN users u ON u.id=t.owner_id ORDER BY t.created_at DESC`);
  return (
    <>
      <PageHeader title="Platform admin" sub="All businesses on this Devagent instance." />
      <div className="bento g4" style={{ marginBottom: 14 }}><Stat dark l="Businesses" v={rows.length} /><Stat l="Paid" v={rows.filter((r) => r.plan !== "free").length} /><Stat l="Bookings" v={rows.reduce((s, r) => s + r.bookings, 0)} /></div>
      <div className="card"><table className="tbl"><thead><tr><th>Business</th><th>Owner</th><th>Type</th><th>Plan</th><th>Bookings</th><th>Created</th></tr></thead><tbody>
        {rows.map((r) => <tr key={r.id}><td><a href={`/book/${r.id}`} className="strong">{r.name}</a></td><td>{r.email}</td><td>{r.vertical}</td><td><span className="badge info plain">{r.plan}</span></td><td className="num">{r.bookings}</td><td className="num muted">{r.created_at}</td></tr>)}
      </tbody></table></div>
    </>
  );
}
