import { requireCtx } from "@/lib/auth";
import { PLANS, RESCUE_PRICE_INR, actionsThisMonth } from "@/lib/plans";
import ActionForm from "@/components/ActionForm";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { addCreditsAction, setPlanAction } from "../actions";

const PERKS: Record<string, string[]> = {
  free: ["50 bookings or orders / month", "100 broadcasts / month", "AI front desk, reminders, deposits", "Waitlist, analytics, customer list"],
  booking: ["Unlimited bookings & orders", "1,000 broadcasts / month", "Grow agent: win-backs & reviews", "Everything in Free"],
  frontdesk: ["Unlimited broadcasts", "Everything in Booking"],
};

export default async function Billing() {
  const { tenant: t } = await requireCtx();
  const demo = process.env.DEV_BILLING === "1", used = actionsThisMonth(t.id), cap = PLANS[t.plan].actionCap;
  return (
    <>
      <PageHeader title="Plans & credits" sub={<>Current plan <b>{PLANS[t.plan].label}</b> · {used}{cap === Infinity ? "" : ` / ${cap}`} bookings & orders this month</>} />
      {!demo && <div className="notice" style={{ marginBottom: 14 }}><Icon n="alert" className="sm" /><span>Subscription checkout isn&apos;t wired in this build, so plan changes are disabled. For local testing set <code>DEV_BILLING=1</code>.</span></div>}
      <div className="price-g" style={{ marginTop: 0 }}>
        {(Object.keys(PLANS) as (keyof typeof PLANS)[]).map((k) => (
          <ActionForm key={k} action={setPlanAction} className={`card pcard ${k === "booking" ? "pop" : ""}`}>
            <input type="hidden" name="plan" value={k} />
            <div className="row between"><b>{PLANS[k].label}</b>{t.plan === k && <span className="badge ok plain">Current</span>}</div>
            <div className="big">${PLANS[k].usd}<span className="sm" style={{ fontWeight: 500, opacity: .7 }}> / ₹{PLANS[k].inr} mo</span></div>
            <ul>{PERKS[k].map((p) => <li key={p}><Icon n="check" className="sm" />{p}</li>)}</ul>
            <button className={`btn ${k === "booking" ? "lime" : "ghost"} block`} style={{ marginTop: "auto" }} disabled={!demo || t.plan === k}>{t.plan === k ? "Your plan" : "Choose"}</button>
          </ActionForm>))}
      </div>
      <div className="card card-b row between" style={{ marginTop: 14 }}>
        <div><b>Call Rescue credits</b><div className="sm muted">Charged ₹{RESCUE_PRICE_INR} per rescued call only · balance <b>₹{t.credits}</b></div></div>
        <ActionForm action={addCreditsAction} success="Credits added"><button className="btn ghost" disabled={!demo}>Add ₹100 (demo)</button></ActionForm>
      </div>
    </>
  );
}
