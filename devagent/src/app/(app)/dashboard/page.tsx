import Link from "next/link";
import { requireCtx } from "@/lib/auth";
import { all, get, hasModule, type Booking } from "@/lib/db";
import { nowLocal } from "@/lib/booking";
import { PLANS, actionsThisMonth } from "@/lib/plans";
import ActionForm from "@/components/ActionForm";
import CopyButton from "@/components/CopyButton";
import { Icon } from "@/components/icons";
import { Empty, PageHeader, Stat, Status } from "@/components/ui";
import { bookingStatusAction, depositReceivedAction } from "../actions";

export default async function Overview() {
  const { tenant: t, user } = await requireCtx();
  const now = nowLocal(), today = now.slice(0, 10);
  const c = (sql: string, ...a: any[]) => get<{ c: number }>(sql, t.id, ...a)!.c;
  const agenda = all<Booking>("SELECT b.*, s.name AS service_name FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.tenant_id=? AND b.start LIKE ? AND b.status!='cancelled' ORDER BY b.start", t.id, `${today}%`);
  const needsOutcome = all<Booking>("SELECT b.*, s.name AS service_name FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.tenant_id=? AND b.status='confirmed' AND b.start<? ORDER BY b.start DESC LIMIT 20", t.id, now);
  const deposits = all<Booking>("SELECT b.*, s.name AS service_name FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.tenant_id=? AND b.status='pending_deposit' ORDER BY b.start LIMIT 20", t.id);
  const unpaidOrders = hasModule(t, "commerce") ? c("SELECT COUNT(*) c FROM orders WHERE tenant_id=? AND paid=0 AND status NOT IN ('cancelled','delivered')") : 0;
  const staleEnq = hasModule(t, "leadgen") ? c("SELECT COUNT(*) c FROM enquiries WHERE tenant_id=? AND stage IN ('new','contacted') AND updated_at<=datetime('now','-2 day')") : 0;
  const upcoming = c("SELECT COUNT(*) c FROM bookings WHERE tenant_id=? AND status IN ('confirmed','pending_deposit') AND start>=?", now);
  const rescued = c("SELECT COUNT(*) c FROM calls WHERE tenant_id=? AND rescued=1 AND created_at>=datetime('now','-7 day')");
  const wl = c("SELECT COUNT(*) c FROM waitlist WHERE tenant_id=? AND notified=1 AND created_at>=datetime('now','-7 day')");
  const used = actionsThisMonth(t.id), cap = PLANS[t.plan].actionCap;
  const base = process.env.BASE_URL || "http://localhost:3000";
  const hr = new Date().getHours(), hello = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
  const attention = needsOutcome.length + deposits.length + (unpaidOrders ? 1 : 0) + (staleEnq ? 1 : 0);
  const snippet = `<script src="${base}/widget.js" data-tenant="${t.id}" defer></script>`;
  return (
    <>
      <PageHeader title={`${hello}, ${user.name.split(" ")[0]}`} sub={`${t.name} · ${new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}`}>
        {(hasModule(t, "appointments") || hasModule(t, "classes")) && <Link className="btn" href="/calendar?add=1"><Icon n="plus" className="sm" /> New booking</Link>}
      </PageHeader>
      <div className="bento g4" style={{ marginBottom: 14 }}>
        <Stat dark icon="cal" l="Today" v={agenda.length} />
        <Stat icon="clock" l="Upcoming" v={upcoming} />
        <Stat icon="alert" l="Needs attention" v={attention} />
        <div className="card stat"><span className="l"><Icon n="zap" className="sm" /> Plan usage</span>
          <span className="v num">{used}<span className="muted sm" style={{ fontWeight: 500 }}>{cap === Infinity ? " this month" : ` / ${cap}`}</span></span>
          {cap !== Infinity && <div className="meter"><i style={{ width: `${Math.min(100, (used / cap) * 100)}%` }} /></div>}</div>
      </div>
      <div className="bento g21" style={{ alignItems: "start" }}>
        <section className="card">
          <div className="card-h"><h3>Today&apos;s agenda</h3><Link href="/calendar" className="sm strong" style={{ color: "var(--brand)" }}>Open calendar →</Link></div>
          <div className="scroll list" style={{ maxHeight: "calc(100vh - 500px)", minHeight: 150 }}>
            {agenda.map((b) => (
              <div key={b.id}><span className="time">{b.start.slice(11)}</span>
                <div className="grow1"><b>{b.customer_name}</b> <span className="muted">· {b.service_name}</span><div className="tiny muted">{b.phone}</div></div>
                <Status s={b.status} />
                {b.status === "confirmed" && b.start < now && (
                  <ActionForm action={bookingStatusAction} className="row" success="Marked">
                    <input type="hidden" name="id" value={b.id} /><button className="btn ok s" name="status" value="completed">Done</button><button className="btn bad s" name="status" value="no_show">No-show</button></ActionForm>)}
              </div>))}
            {!agenda.length && <Empty icon="cal" title="Nothing scheduled today">Share your booking page to fill the day.</Empty>}
          </div>
        </section>
        <section className="card">
          <div className="card-h"><h3>Needs attention</h3><span className="badge warn plain">{attention}</span></div>
          <div className="scroll list" style={{ maxHeight: "calc(100vh - 500px)", minHeight: 150 }}>
            {deposits.map((b) => (
              <div key={`d${b.id}`}><span className="badge pending_deposit plain">Deposit</span>
                <div className="grow1 sm"><b>{b.customer_name}</b><div className="tiny muted">{b.service_name} · {b.start.replace("T", " ")}</div></div>
                <ActionForm action={depositReceivedAction} success="Deposit confirmed"><input type="hidden" name="id" value={b.id} /><button className="btn s">Received</button></ActionForm></div>))}
            {needsOutcome.map((b) => (
              <div key={`o${b.id}`}><span className="badge info plain">Outcome</span>
                <div className="grow1 sm"><b>{b.customer_name}</b><div className="tiny muted">{b.service_name} · {b.start.replace("T", " ")}</div></div>
                <ActionForm action={bookingStatusAction} className="row" success="Marked"><input type="hidden" name="id" value={b.id} /><button className="btn ok s" name="status" value="completed">Done</button><button className="btn bad s" name="status" value="no_show">No-show</button></ActionForm></div>))}
            {unpaidOrders > 0 && <div><span className="badge warn plain">Orders</span><div className="grow1 sm">{unpaidOrders} unpaid order(s)</div><Link className="btn ghost s" href="/orders">Review</Link></div>}
            {staleEnq > 0 && <div><span className="badge warn plain">Leads</span><div className="grow1 sm">{staleEnq} enquiries gone quiet</div><Link className="btn ghost s" href="/pipeline">Follow up</Link></div>}
            {!attention && <Empty icon="check" title="All clear">Nothing needs you right now.</Empty>}
          </div>
        </section>
      </div>
      <div className="bento g3" style={{ marginTop: 14 }}>
        <div className="card card-b"><div className="row between"><b>Website chat widget</b><CopyButton text={snippet} label="Copy snippet" /></div><code className="tiny muted" style={{ display: "block", marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{snippet}</code></div>
        <div className="card card-b"><div className="row between"><b>Booking page</b><CopyButton text={`${base}/book/${t.id}`} label="Copy link" /></div><Link className="tiny" style={{ color: "var(--brand)" }} href={`/book/${t.id}`} target="_blank">/book/{t.id}</Link>
          <div className="tiny muted" style={{ marginTop: 4 }}>Recovered 7d: {rescued} missed-call leads · {wl} waitlist slots</div></div>
        <div className="card card-b"><div className="row between"><b>AI & WhatsApp</b></div>
          <div className="row wrap" style={{ marginTop: 8 }}><span className={`badge ${process.env.ANTHROPIC_API_KEY ? "ok" : "warn"}`}>{process.env.ANTHROPIC_API_KEY ? "Claude agent on" : "Fallback replies"}</span>
            <span className={`badge ${t.wa_phone_id ? "ok" : "warn"}`}>{t.wa_phone_id ? "WhatsApp connected" : "WhatsApp not connected"}</span>{!t.wa_phone_id && <Link href="/connect-whatsapp" className="tiny strong" style={{ color: "var(--brand)" }}>Connect →</Link>}</div></div>
      </div>
    </>
  );
}
