import { requireCtx } from "@/lib/auth";
import { all, hasModule, type Hours, type Service } from "@/lib/db";
import ActionForm from "@/components/ActionForm";
import Modal from "@/components/Modal";
import Tabs from "@/components/Tabs";
import { Icon } from "@/components/icons";
import { Empty, Field, PageHeader } from "@/components/ui";
import { addPackAction, addServiceAction, saveHoursAction, saveProfileAction, toggleServiceAction } from "../actions";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MODS: [string, string, string][] = [["appointments", "Bookings & appointments", "Book, remind, waitlist"], ["commerce", "Orders & products", "Catalog and orders in chat"], ["leadgen", "Leads & enquiries", "Capture what the AI can't close"], ["classes", "Classes & fees", "Multi-seat classes and packs"]];

export default async function BusinessSetup({ searchParams }: { searchParams: Promise<{ drafted?: string; add?: string }> }) {
  const { tenant: t } = await requireCtx();
  const sp = await searchParams, hours = JSON.parse(t.hours) as Hours;
  const svcs = await all<Service>("SELECT * FROM services WHERE tenant_id=? ORDER BY id", t.id);
  const packs = await all<{ id: number; name: string; sessions: number; price: number }>("SELECT * FROM packs WHERE tenant_id=?", t.id);

  const profile = (
    <ActionForm action={saveProfileAction} className="bento g2" success="Business profile saved">
      <div className="card card-b col">
        <h3>Profile</h3>
        <Field label="Business name"><input name="name" defaultValue={t.name} /></Field>
        <div className="fgrid c2"><Field label="Owner WhatsApp" hint="Daily digest and new-enquiry alerts"><input name="owner_phone" defaultValue={t.owner_phone ?? ""} placeholder="+91…" /></Field>
          <Field label="Staff / rooms" hint="1:1 bookings at the same time"><input name="staff" type="number" min="1" max="50" defaultValue={t.staff} /></Field></div>
        <Field label="Google review link" hint="Enables automatic review requests"><input name="review_link" defaultValue={t.review_link ?? ""} placeholder="https://g.page/r/…" /></Field>
        <Field label="Hold unpaid-deposit slots for (minutes)"><input name="hold" type="number" min="5" max="1440" defaultValue={t.deposit_hold_min} /></Field>
      </div>
      <div className="card card-b col">
        <h3>What your AI handles</h3>
        {MODS.map(([k, l, h]) => <label key={k} className="switch"><input type="checkbox" name={`mod_${k}`} defaultChecked={hasModule(t, k)} /><div><b>{l}</b><span>{h}</span></div></label>)}
        <div style={{ marginTop: "auto" }}><button className="btn block">Save profile</button></div>
      </div>
    </ActionForm>
  );
  const hoursTab = (
    <ActionForm action={saveHoursAction} className="card card-b col" success="Opening hours saved">
      <div className="row between"><h3>Opening hours</h3><span className="sm muted">Server local time · leave a day unchecked to close it</span></div>
      <div className="fgrid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(270px,1fr))" }}>
        {DAYS.map((d, i) => (
          <div key={d} className="row" style={{ gap: 10 }}>
            <label className="row" style={{ width: 118, gap: 8 }}><input type="checkbox" name={`on${i}`} defaultChecked={!!hours[i]} /><b className="sm">{d}</b></label>
            <input type="time" name={`open${i}`} defaultValue={hours[i]?.[0] ?? "09:00"} /><span className="muted">–</span><input type="time" name={`close${i}`} defaultValue={hours[i]?.[1] ?? "18:00"} />
          </div>))}
      </div>
      <div><button className="btn">Save hours</button></div>
    </ActionForm>
  );
  const services = (
    <div className="card">
      <div className="card-h"><h3>Services</h3>
        <Modal title="Add service" defaultOpen={sp.add === "service"} trigger={<button className="btn s"><Icon n="plus" className="sm" /> Add service</button>}>
          <ActionForm action={addServiceAction} className="dlgform" success="Service added" reset>
            <div className="dlg-b"><Field label="Name"><input name="name" required /></Field>
              <div className="fgrid c2"><Field label="Duration (min)"><input name="duration" type="number" min="5" max="480" defaultValue="30" required /></Field><Field label="Seats per slot" hint="1 = one-to-one · 15 = a class"><input name="spots" type="number" min="1" max="500" defaultValue="1" /></Field>
                <Field label="Price" hint="Blank = on request"><input name="price" type="number" min="0" step="any" /></Field><Field label="Deposit to hold slot" hint="0 = none"><input name="deposit" type="number" min="0" step="any" defaultValue="0" /></Field></div></div>
            <div className="dlg-f"><button className="btn">Add service</button></div></ActionForm>
        </Modal></div>
      <table className="tbl"><thead><tr><th>Name</th><th>Minutes</th><th>Price</th><th>Deposit</th><th>Seats</th><th>Status</th><th /></tr></thead><tbody>
        {svcs.map((s) => (
          <tr key={s.id}><td><b>{s.name}</b></td><td className="num">{s.duration_min}</td><td className="num">{s.price ?? <span className="muted">on request</span>}</td><td className="num">{s.deposit || "-"}</td><td className="num">{s.spots}</td>
            <td>{s.active ? <span className="badge ok plain">Live</span> : <span className="badge plain">Hidden</span>}</td>
            <td><ActionForm action={toggleServiceAction} success="Updated"><input type="hidden" name="id" value={s.id} /><button className="btn ghost s">{s.active ? "Hide" : "Show"}</button></ActionForm></td></tr>))}
      </tbody></table>
      {!svcs.length && <Empty icon="tag" title="No services yet">Add what customers can book.</Empty>}
    </div>
  );
  const packTab = (
    <div className="card">
      <div className="card-h"><h3>Prepaid packs</h3>
        <Modal title="Add pack" trigger={<button className="btn s"><Icon n="plus" className="sm" /> Add pack</button>}>
          <ActionForm action={addPackAction} className="dlgform" success="Pack added" reset>
            <div className="dlg-b"><Field label="Name"><input name="name" placeholder="10-class card" required /></Field>
              <div className="fgrid c2"><Field label="Sessions"><input name="sessions" type="number" min="1" defaultValue="10" /></Field><Field label="Price"><input name="price" type="number" min="0" step="any" /></Field></div>
              <Field label="Valid for"><select name="service"><option value="">Any service</option>{svcs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field></div>
            <div className="dlg-f"><button className="btn">Add pack</button></div></ActionForm>
        </Modal></div>
      {packs.length ? <table className="tbl"><tbody>{packs.map((p) => <tr key={p.id}><td><b>{p.name}</b></td><td className="num">{p.sessions} sessions</td><td className="num">{p.price}</td></tr>)}</tbody></table> : <Empty icon="tag" title="No packs yet">Sell bundles like a 10-class card - customers using one skip the deposit.</Empty>}
    </div>
  );
  return (
    <>
      <PageHeader title="Business setup" sub="How your front desk is configured." />
      {sp.drafted && <div className="notice" style={{ marginBottom: 14 }}><Icon n="spark" className="sm" /><span><b>Your AI drafted this setup.</b> Check services and prices - nothing was guessed; a blank price means “price on request”.</span></div>}
      <Tabs initial={sp.add === "service" ? "services" : undefined} tabs={[{ id: "profile", label: "Profile & modules", content: profile }, { id: "hours", label: "Opening hours", content: hoursTab }, { id: "services", label: "Services", badge: svcs.length, content: services }, { id: "packs", label: "Packs", content: packTab }]} />
    </>
  );
}
