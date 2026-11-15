import Link from "next/link";
import { requireCtx } from "@/lib/auth";
import { all, type Booking } from "@/lib/db";
import { activeServices, addMin, nowLocal } from "@/lib/booking";
import ActionForm from "@/components/ActionForm";
import Modal from "@/components/Modal";
import { Icon } from "@/components/icons";
import { Empty, Field, PageHeader, Stat, Status } from "@/components/ui";
import { blockTimeAction, bookingStatusAction, depositReceivedAction, moveBookingAction, removeBlockAction, walkInAction } from "../actions";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const shift = (date: string, n: number) => iso(new Date(new Date(`${date}T12:00`).getTime() + n * 864e5));

export default async function Calendar({ searchParams }: { searchParams: Promise<{ d?: string; add?: string; block?: string }> }) {
  const { tenant: t } = await requireCtx();
  const sp = await searchParams, now = nowLocal(), today = now.slice(0, 10);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? "") ? sp.d! : today;
  const rows = await all<Booking>("SELECT b.*, s.name AS service_name FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.tenant_id=? AND b.start LIKE ? ORDER BY b.start", t.id, `${day}%`);
  const live = rows.filter((b) => b.status !== "cancelled");
  const blocks = await all<{ id: number; start: string; end: string; reason: string }>(`SELECT * FROM blocks WHERE tenant_id=? AND start<? AND "end">? ORDER BY start`, t.id, `${day}T23:59`, `${day}T00:00`);
  const waiting = (await all<{ c: number }>("SELECT COUNT(*) c FROM waitlist WHERE tenant_id=? AND date=? AND notified=0", t.id, day))[0].c;
  const weekStart = shift(day, -((new Date(`${day}T12:00`).getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => shift(weekStart, i));
  const counts = Object.fromEntries((await all<{ d: string; c: number }>("SELECT substr(start,1,10) d, COUNT(*) c FROM bookings WHERE tenant_id=? AND status!='cancelled' AND start>=? AND start<=? GROUP BY d", t.id, `${week[0]}T00:00`, `${week[6]}T23:59`)).map((r) => [r.d, r.c]));
  const svcs = await activeServices(t.id);
  const label = new Date(`${day}T12:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const defaultStart = `${day >= today ? day : today}T${day === today ? (now.slice(11, 13) < "17" ? String(Number(now.slice(11, 13)) + 1).padStart(2, "0") : "09") : "09"}:00`;
  return (
    <>
      <PageHeader title="Calendar" sub={<>{label}{day === today && <span className="badge ok plain" style={{ marginLeft: 8 }}>Today</span>}</>}>
        <Link className="ibtn" href={`/calendar?d=${shift(day, -1)}`} aria-label="Previous day"><Icon n="chevL" className="sm" /></Link>
        <Link className="btn ghost s" href="/calendar">Today</Link>
        <Link className="ibtn" href={`/calendar?d=${shift(day, 1)}`} aria-label="Next day"><Icon n="chevR" className="sm" /></Link>
        <Modal title="Block time off" defaultOpen={sp.block === "1"} trigger={<button className="btn ghost"><Icon n="clock" className="sm" /> Block time</button>}>
          <ActionForm action={blockTimeAction} className="dlgform" success="Time blocked">
            <div className="dlg-b"><div className="fgrid c2"><Field label="From"><input type="datetime-local" name="start" defaultValue={`${day}T09:00`} required /></Field><Field label="To"><input type="datetime-local" name="end" defaultValue={`${day}T18:00`} required /></Field></div>
              <Field label="Reason (optional)"><input name="reason" placeholder="Holiday, training…" /></Field></div>
            <div className="dlg-f"><button className="btn">Block time</button></div>
          </ActionForm>
        </Modal>
        <Modal title="New booking" defaultOpen={sp.add === "1"} trigger={<button className="btn"><Icon n="plus" className="sm" /> New booking</button>}>
          <ActionForm action={walkInAction} className="dlgform" success="Booking added" reset>
            <div className="dlg-b">
              <Field label="Service"><select name="service">{svcs.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.duration_min} min</option>)}</select></Field>
              <Field label="Start" hint="Must be a free slot within opening hours."><input type="datetime-local" name="start" defaultValue={defaultStart} required /></Field>
              <div className="fgrid c2"><Field label="Name"><input name="name" placeholder="Walk-in" /></Field><Field label="Phone (optional)"><input name="phone" placeholder="+91…" /></Field></div>
            </div>
            <div className="dlg-f"><button className="btn">Add booking</button></div>
          </ActionForm>
        </Modal>
      </PageHeader>

      <div className="row" style={{ gap: 8, marginBottom: 14, overflow: "auto" }}>
        {week.map((d) => (
          <Link key={d} href={`/calendar?d=${d}`} className="card" style={{ flex: 1, minWidth: 92, padding: "9px 12px", textAlign: "center", borderColor: d === day ? "var(--brand)" : undefined, background: d === day ? "var(--brand-soft)" : undefined }} aria-current={d === day ? "date" : undefined}>
            <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".06em" }}>{new Date(`${d}T12:00`).toLocaleDateString(undefined, { weekday: "short" })}</div>
            <b style={{ fontSize: 17 }}>{Number(d.slice(8))}</b>
            <div className="tiny" style={{ color: counts[d] ? "var(--brand)" : "var(--muted)", fontWeight: 600 }}>{counts[d] ? `${counts[d]} booked` : "free"}</div>
          </Link>))}
      </div>

      <div className="bento g21" style={{ alignItems: "start" }}>
        <section className="card" style={{ minHeight: 0 }}>
          <div className="card-h"><h3>Schedule</h3><span className="muted sm">{live.length} booking{live.length === 1 ? "" : "s"}</span></div>
          <div className="list scroll" style={{ maxHeight: "calc(100vh - 360px)", minHeight: 180 }}>
            {rows.map((b) => {
              const open = b.status === "confirmed" || b.status === "pending_deposit", past = b.start < now;
              return (
                <div key={b.id} style={{ opacity: b.status === "cancelled" ? .55 : 1, flexWrap: "wrap" }}>
                  <span className="time">{b.start.slice(11)}</span>
                  <div className="grow1" style={{ minWidth: 160 }}><b>{b.customer_name}</b> <span className="muted">· {b.service_name}</span><div className="tiny muted">{b.phone} · {b.channel}{b.deposit_due > 0 ? ` · deposit ${b.deposit_due}${b.deposit_paid ? " paid" : ""}` : ""}</div></div>
                  <Status s={b.status} />
                  {open && (
                    <div className="row">
                      {b.status === "pending_deposit" && <ActionForm action={depositReceivedAction} success="Deposit confirmed"><input type="hidden" name="id" value={b.id} /><button className="btn s">Deposit received</button></ActionForm>}
                      <ActionForm action={bookingStatusAction} className="row" success="Updated"><input type="hidden" name="id" value={b.id} />
                        {past && <><button className="btn ok s" name="status" value="completed">Done</button><button className="btn bad s" name="status" value="no_show">No-show</button></>}
                        {!past && <button className="btn ghost s" name="status" value="cancelled">Cancel</button>}</ActionForm>
                      <Modal title={`Move ${b.customer_name}`} trigger={<button className="ibtn" aria-label="Move booking" title="Move"><Icon n="cal" className="sm" /></button>}>
                        <ActionForm action={moveBookingAction} className="dlgform" success="Booking moved">
                          <div className="dlg-b"><input type="hidden" name="id" value={b.id} /><Field label="New start"><input type="datetime-local" name="start" defaultValue={b.start} required /></Field></div>
                          <div className="dlg-f"><button className="btn">Move & notify customer</button></div>
                        </ActionForm>
                      </Modal>
                    </div>)}
                </div>);
            })}
            {!rows.length && <Empty icon="cal" title="No bookings this day">{svcs.length ? "Use New booking to add a walk-in." : "Add a service in Business setup first."}</Empty>}
          </div>
        </section>
        <div className="col" style={{ gap: 14 }}>
          <div className="bento" style={{ gridTemplateColumns: "1fr 1fr" }}><Stat l="Booked" v={live.length} /><Stat l="On waitlist" v={waiting} /></div>
          <section className="card">
            <div className="card-h"><h3>Time off</h3></div>
            <div className="list">
              {blocks.map((b) => (
                <div key={b.id}><Icon n="clock" className="sm" /><div className="grow1 sm"><b>{b.start.slice(5).replace("T", " ")} → {b.end.slice(5).replace("T", " ")}</b><div className="tiny muted">{b.reason || "Blocked"}</div></div>
                  <ActionForm action={removeBlockAction} success="Block removed"><input type="hidden" name="id" value={b.id} /><button className="ibtn" aria-label="Remove block"><Icon n="x" className="sm" /></button></ActionForm></div>))}
              {!blocks.length && <div className="muted sm">No time off on this day.</div>}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
void addMin;
