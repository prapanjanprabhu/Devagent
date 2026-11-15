import { requireCtx } from "@/lib/auth";
import { all } from "@/lib/db";
import { addMin, nowLocal } from "@/lib/booking";
import ActionForm from "@/components/ActionForm";
import Modal from "@/components/Modal";
import Tabs from "@/components/Tabs";
import { Icon } from "@/components/icons";
import { Empty, Field, PageHeader } from "@/components/ui";
import { sellPackAction } from "../actions";

export default async function Classes() {
  const { tenant: t } = await requireCtx();
  const now = nowLocal();
  const sittings = await all<{ service_id: number; start: string; name: string; spots: number; enrolled: number }>(
      `SELECT b.service_id, b.start, s.name, s.spots, COUNT(*) enrolled FROM bookings b JOIN services s ON s.id=b.service_id
     WHERE b.tenant_id=? AND s.spots>1 AND b.status IN ('confirmed','pending_deposit') AND b.start>=? AND b.start<=? GROUP BY b.service_id, b.start, s.id ORDER BY b.start`, t.id, now, addMin(now, 30 * 1440));
  const classes = await all<{ id: number; name: string; duration_min: number; spots: number }>("SELECT * FROM services WHERE tenant_id=? AND spots>1 AND active=1", t.id);
  const packs = await all<{ id: number; name: string; sessions: number; price: number }>("SELECT * FROM packs WHERE tenant_id=?", t.id);
  const held = await all<{ phone: string; remaining: number; name: string; created_at: string }>("SELECT cp.phone, cp.remaining, cp.created_at, p.name FROM customer_packs cp JOIN packs p ON p.id=cp.pack_id WHERE cp.tenant_id=? AND cp.paid=1 ORDER BY cp.id DESC LIMIT 100", t.id);
  const sit = (
    <div className="card">
      <div className="card-h"><h3>Next 30 days</h3><span className="muted sm">{classes.length ? classes.map((c) => `${c.name} (${c.spots} seats)`).join(" · ") : "No classes yet"}</span></div>
      <table className="tbl"><thead><tr><th>When</th><th>Class</th><th style={{ width: "40%" }}>Seats</th></tr></thead><tbody>
        {sittings.map((x) => (
          <tr key={x.service_id + x.start}><td className="num">{x.start.replace("T", " ")}</td><td><b>{x.name}</b></td>
            <td><div className="row"><div className="meter grow1"><i style={{ width: `${(x.enrolled / x.spots) * 100}%` }} /></div><span className="num sm">{x.enrolled} / {x.spots}</span></div></td></tr>))}
      </tbody></table>
      {!sittings.length && <Empty icon="grid" title="Nobody enrolled yet">A class is a service with more than one seat - set seats in Business setup.</Empty>}
    </div>
  );
  const pk = (
    <div className="bento g21" style={{ alignItems: "start" }}>
      <div className="card"><div className="card-h"><h3>Packs in use</h3></div>
        <table className="tbl"><thead><tr><th>Customer</th><th>Pack</th><th>Sessions left</th></tr></thead><tbody>{held.map((h, i) => <tr key={i}><td className="num">{h.phone}</td><td>{h.name}</td><td className="num strong">{h.remaining}</td></tr>)}</tbody></table>
        {!held.length && <Empty icon="tag" title="No packs sold yet">Record a sale once a customer has paid you.</Empty>}</div>
      <div className="card card-b col">
        <b>Record a pack sale</b><p className="sm muted">A customer with a paid pack books without a deposit and uses one session each time.</p>
        {packs.length ? (
          <ActionForm action={sellPackAction} className="col" success="Pack sale recorded" reset>
            <Field label="Pack"><select name="pack">{packs.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sessions} sessions · {p.price}</option>)}</select></Field>
            <Field label="Customer phone"><input name="phone" placeholder="+91…" required /></Field><button className="btn">Record sale</button></ActionForm>
        ) : <p className="sm">Define packs first in <a href="/business-setup#packs" style={{ color: "var(--brand)", fontWeight: 600 }}>Business setup</a>.</p>}
      </div>
    </div>
  );
  return (
    <>
      <PageHeader title="Classes & packs" sub="Multi-seat sessions and prepaid bundles." />
      <Tabs tabs={[{ id: "sittings", label: "Sittings", content: sit }, { id: "packs", label: "Prepaid packs", content: pk }]} />
    </>
  );
}
void Modal; void Icon;
