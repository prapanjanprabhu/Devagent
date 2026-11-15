import { requireCtx } from "@/lib/auth";
import { all } from "@/lib/db";
import ActionForm from "@/components/ActionForm";
import { Icon } from "@/components/icons";
import { Empty, PageHeader } from "@/components/ui";
import { optOutAction } from "../actions";

export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { tenant: t } = await requireCtx();
  const q = ((await searchParams).q ?? "").trim().slice(0, 60), like = `%${q}%`;
  const rows = await all<{ phone: string; name: string; opted_in: number; total: number; done: number; noshow: number; last_visit: string | null }>(
      `SELECT c.phone, c.name, c.opted_in, COUNT(b.id) total, COUNT(b.id) FILTER (WHERE b.status='completed') AS done, COUNT(b.id) FILTER (WHERE b.status='no_show') AS noshow, MAX(b.start) last_visit
     FROM customers c LEFT JOIN bookings b ON b.tenant_id=c.tenant_id AND b.phone=c.phone WHERE c.tenant_id=? AND (c.name ILIKE ? OR c.phone ILIKE ?) GROUP BY c.id ORDER BY c.created_at DESC LIMIT 300`, t.id, like, like);
  return (
    <>
      <PageHeader title="Customers" sub={`${rows.length} ${q ? "matching" : "in your list"} - added automatically when they book or order`}>
        <form className="row" action="/customers"><div className="search" style={{ cursor: "text", width: 260 }}><Icon n="search" className="sm" /><input name="q" defaultValue={q} placeholder="Search name or phone" aria-label="Search customers" style={{ border: 0, height: 32, padding: 0, boxShadow: "none", background: "transparent" }} /></div></form>
      </PageHeader>
      <div className="card"><div className="scroll" style={{ maxHeight: "calc(100vh - 190px)" }}>
        <table className="tbl"><thead><tr><th>Customer</th><th>Bookings</th><th>Completed</th><th>No-shows</th><th>Last booking</th><th>Marketing</th></tr></thead><tbody>
          {rows.map((c) => (
            <tr key={c.phone}><td><b>{c.name || "-"}</b><div className="tiny muted">{c.phone}</div></td><td className="num">{c.total}</td><td className="num">{c.done}</td><td className="num">{c.noshow || "-"}</td><td className="num">{c.last_visit?.replace("T", " ") ?? "-"}</td>
              <td>{c.opted_in ? <ActionForm action={optOutAction} success="Opted out"><input type="hidden" name="phone" value={c.phone} /><button className="btn ghost s">Opt out</button></ActionForm> : <span className="badge bad plain">Opted out</span>}</td></tr>))}
        </tbody></table>
        {!rows.length && <Empty icon="users" title={q ? "No matches" : "No customers yet"}>{q ? "Try a different search." : "They appear when someone books or orders."}</Empty>}
      </div></div>
    </>
  );
}
