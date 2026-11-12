import Link from "next/link";
import { PLANS } from "@/lib/plans";
import { Icon, Mark } from "@/components/icons";

const features: [string, string, string, boolean?][] = [
  ["bot", "An AI front desk that finishes the job", "Answers on WhatsApp and the web, then books the appointment, takes the order or captures the enquiry - using only your real services, prices and hours.", true],
  ["cal", "A real calendar", "Availability, held slots, reschedules, blocked time, walk-ins and no-show tracking."],
  ["card", "Deposits & packs", "Hold slots with a deposit paid to your own Razorpay; sell prepaid session packs."],
  ["bell", "Reminders & waitlist", "24h and 2h reminders. Cancelled slots are offered to your waitlist automatically."],
  ["funnel", "Orders, leads, classes", "Switch on the modules your trade needs: catalog, enquiry board, multi-seat classes."],
  ["spark", "Grow agent", "Win-backs, review requests and pack reminders - drafted for you, sent in one click."],
  ["phone", "Call Rescue", "Missed a call? The caller is WhatsApped instantly and the assistant books them.", true],
  ["chart", "Campaigns & analytics", "Segmented broadcasts with opt-out, no-show rate, revenue and a daily owner digest."],
];
const faq: [string, string][] = [
  ["Do my customers need to install anything?", "No. They message your business on WhatsApp, or use your booking page or website chat widget."],
  ["Who owns the customer data?", "You do. Each business's data is kept separate from every other business on the platform."],
  ["What does the AI do when it doesn't know something?", "It never invents prices or policies. It answers from what you've configured, and can capture an enquiry for you to follow up."],
  ["Can I take deposits?", "Yes - connect your own Razorpay and deposits settle straight to your account. Unpaid holds are released automatically and offered to your waitlist."],
  ["Is there a commission on bookings?", "No. Pricing is a flat monthly plan, and Call Rescue is charged only per rescued call."],
];
const perks: Record<string, string[]> = {
  free: ["50 bookings or orders / month", "100 broadcasts / month", "AI front desk, reminders, deposits", "Waitlist, analytics, customer list"],
  booking: ["Unlimited bookings & orders", "1,000 broadcasts / month", "Grow agent included", "Everything in Free"],
  frontdesk: ["Unlimited broadcasts", "Everything in Booking"],
};

export default function Home() {
  return (
    <>
      <header className="l-hero">
        <div className="l-wrap">
          <nav className="l-nav" aria-label="Primary">
            <Link href="/" className="brand" style={{ padding: 0 }}><Mark /> Devagent</Link>
            <div className="links nav-l"><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a><Link href="/login" className="btn ghost s">Log in</Link><Link href="/signup" className="btn lime s">Start free</Link></div>
          </nav>
          <div className="hero-g">
            <div>
              <span className="pill"><i /> AI front desk · WhatsApp + web</span>
              <h1>Never lose a customer to an <em>unanswered</em> message.</h1>
              <p className="lead">Devagent answers your customers around the clock, fills your calendar, takes deposits and sends the reminders - on your own WhatsApp number, with zero commission.</p>
              <div className="row wrap" style={{ marginTop: 26, gap: 12 }}><Link href="/signup" className="btn lime l">Start free <Icon n="arrow" /></Link><a href="#features" className="btn l" style={{ background: "rgba(255,255,255,.08)", border: "1px solid var(--ink-line)" }}>See how it works</a></div>
              <p className="sm" style={{ color: "var(--ink-text)", marginTop: 14 }}>No card needed · Free plan includes the full AI front desk</p>
            </div>
            <div className="phone" aria-label="Example conversation">
              <div className="phone-h"><span className="mark" /><div><b>Glow Salon</b><div className="tiny" style={{ color: "var(--ink-text)" }}>online · Devagent AI · example</div></div></div>
              <div className="msgs">
                <div className="bub user">Hi! Can I get a cut &amp; colour this Saturday?</div>
                <div className="bub assistant">I have 2:30 pm Saturday free. Shall I book it? A 150 deposit holds the slot.</div>
                <div className="bub user">Yes please 🙌</div>
                <div className="bub assistant">Booked ✓ Pay the deposit here to confirm - I&apos;ll remind you 2h before.</div>
              </div>
              <div className="float"><span className="badge ok plain" style={{ height: 30, width: 30, padding: 0, justifyContent: "center" }}><Icon n="moon" /></span><div><b>10:59 pm</b><div className="tiny muted">booked while you were closed</div></div></div>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="l-sec l-wrap" id="features">
          <div className="eyebrow">Everything in one front desk</div><h2>Built for businesses that live on appointments</h2>
          <div className="feat">{features.map(([ic, t, d, big]) => (
            <div key={t} className={`card ${big ? "big" : ""}`}><span className="ic"><Icon n={ic} /></span><h3>{t}</h3><p className="sm muted">{d}</p></div>))}</div>
        </section>

        <section className="l-sec l-wrap" style={{ paddingTop: 0 }}>
          <div className="eyebrow">How it works</div><h2>Live the same day</h2>
          <div className="steps">{[["Describe your business", "One sentence becomes your services, hours and FAQ. Prices are only set when you type them."], ["Share your link or connect WhatsApp", "Use the booking page and website widget straight away; connect your own WhatsApp number when you're ready."], ["Let the AI work", "It books, reminds, recovers no-shows and reports back - you step in only when a human is needed."]].map(([t, d], i) => (
            <div key={t} className="card step"><div className="n">0{i + 1}</div><h3 style={{ margin: "6px 0" }}>{t}</h3><p className="sm muted">{d}</p></div>))}</div>
        </section>

        <section className="l-sec l-wrap" id="pricing" style={{ paddingTop: 0 }}>
          <div className="eyebrow">Pricing</div><h2>Flat monthly. 0% commission.</h2>
          <div className="price-g">{(Object.keys(PLANS) as (keyof typeof PLANS)[]).map((k) => (
            <div key={k} className={`card pcard ${k === "booking" ? "pop" : ""}`}>
              <div className="row between"><b>{PLANS[k].label}</b>{k === "booking" && <span className="badge plain" style={{ background: "var(--lime)", color: "var(--lime-ink)" }}>Most popular</span>}</div>
              <div className="big">${PLANS[k].usd}<span className="sm" style={{ fontWeight: 500, opacity: .7 }}> / ₹{PLANS[k].inr} per month</span></div>
              <ul>{perks[k].map((p) => <li key={p}><Icon n="check" className="sm" />{p}</li>)}</ul>
              <Link href="/signup" className={`btn ${k === "booking" ? "lime" : "ghost"} block`} style={{ marginTop: "auto" }}>{k === "free" ? "Start free" : "Get started"}</Link>
            </div>))}</div>
          <p className="sm muted" style={{ marginTop: 14 }}>Call Rescue is pay-as-you-go on any plan: ₹5 per rescued call, never for calls you answer.</p>
        </section>

        <section className="l-sec l-wrap faq" id="faq" style={{ paddingTop: 0 }}>
          <div className="eyebrow">FAQ</div><h2 style={{ marginBottom: 14 }}>Common questions</h2>
          {faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
        </section>

        <section className="l-wrap"><div className="cta"><div><h2>Ready to stop missing customers?</h2><p style={{ opacity: .85, marginTop: 6 }}>Set up in two minutes. Free forever for small businesses.</p></div><Link href="/signup" className="btn lime l">Start free <Icon n="arrow" /></Link></div></section>
      </main>

      <footer className="l-foot"><div className="l-wrap row between wrap"><Link href="/" className="brand" style={{ padding: 0 }}><Mark /> Devagent</Link><span className="sm">© Devagent · AI front desk for appointment businesses</span></div></footer>
    </>
  );
}
