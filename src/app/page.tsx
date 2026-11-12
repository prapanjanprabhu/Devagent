import Link from "next/link";
import { PLANS } from "@/lib/plans";
import { Icon, Mark } from "@/components/icons";

const features: [string, string, string, boolean?][] = [
  ["bot", "An AI front desk that finishes the job", "Answers on WhatsApp and the web, then books the appointment, takes the order or captures the enquiry, using only your real services, prices and hours.", true],
  ["cal", "A real calendar", "Availability, held slots, reschedules, blocked time, walk-ins and no-show tracking."],
  ["card", "Deposits & packs", "Hold slots with a deposit paid to your own Razorpay. Sell prepaid session packs."],
  ["bell", "Reminders & waitlist", "24h and 2h reminders. Cancelled slots are offered to your waitlist automatically."],
  ["funnel", "Orders, leads, classes", "Switch on what your trade needs: catalog, enquiry board, multi-seat classes."],
  ["spark", "Grow agent", "Win-backs, review requests and pack reminders, drafted for you and sent in one click."],
  ["users", "Customer list", "Every booking and order builds your customer record automatically."],
  ["phone", "Call Rescue", "Missed a call? The caller is WhatsApped instantly and the assistant books them.", true],
  ["chat", "Website chat widget", "One script tag puts the same assistant on your own website."],
  ["chart", "Campaigns & analytics", "Segmented broadcasts with opt-out, no-show rate, revenue and a daily owner digest."],
];
const prod: [string, string, string][] = [
  ["check", "Tested on every push", "20 automated tests cover booking rules, deposits, the waitlist and reminders."],
  ["grid", "Runs in Docker", "Multi-stage image, non-root user, health check and a data volume."],
  ["chart", "Observable", "Prometheus metrics, a Grafana dashboard and a live status page."],
  ["zap", "Shipped by CI", "GitHub Actions builds, smoke-tests and publishes the image."],
];
const faq: [string, string][] = [
  ["Do my customers need to install anything?", "No. They message your business on WhatsApp, or use your booking page or website chat widget."],
  ["Who owns the customer data?", "You do. Each business's data is kept separate from every other business on the platform."],
  ["What does the AI do when it doesn't know something?", "It never invents prices or policies. It answers from what you've configured, and can capture an enquiry for you to follow up."],
  ["Can I take deposits?", "Yes. Connect your own Razorpay and deposits settle straight to your account. Unpaid holds are released automatically and offered to your waitlist."],
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
      <header className="l-top">
        <div className="l-wrap">
          <nav className="l-nav" aria-label="Primary">
            <Link href="/" className="brand" style={{ padding: 0 }}><Mark /> Devagent</Link>
            <div className="links nav-l"><a href="#features">Features</a><a href="#how">How it works</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a><Link href="/login" className="btn ghost s">Log in</Link><Link href="/signup" className="btn lime s">Start free</Link></div>
          </nav>
        </div>
      </header>

      <section className="l-hero">
        <div className="l-wrap">
          <div className="hero-g">
            <div>
              <span className="pill"><i /> AI front desk · WhatsApp + web</span>
              <h1>Never lose a customer to an <em>unanswered</em> message.</h1>
              <p className="lead">Devagent answers your customers around the clock, fills your calendar, takes deposits and sends the reminders, all from your own WhatsApp number with zero commission.</p>
              <div className="row wrap hero-cta" style={{ marginTop: 28, gap: 12 }}>
                <Link href="/signup" className="btn lime l">Start free <Icon n="arrow" /></Link>
                <a href="#how" className="btn l" style={{ background: "rgba(255,255,255,.08)", border: "1px solid var(--ink-line)" }}>See how it works</a>
              </div>
              <div className="hero-facts"><span><Icon n="check" />No card needed</span><span><Icon n="check" />0% commission</span><span><Icon n="check" />Your own number</span></div>
            </div>

            <div className="hero-art" aria-hidden="true">
              <div className="chip-float"><Icon n="check" className="sm" /> Deposit received · 150</div>
              <div className="mock">
                <div className="mock-bar"><i /><i /><i /><span>devagent · overview (illustration)</span></div>
                <div className="mock-body">
                  <div className="mock-side"><b><span className="mark" style={{ width: 18, height: 18, borderRadius: 6 }} />Devagent</b><span className="on" /><span /><span /><span /><span /><span /></div>
                  <div className="mock-main">
                    <div className="mock-kpis">
                      <div className="mock-kpi dark"><small>Today</small><b>6</b></div>
                      <div className="mock-kpi"><small>Awaiting deposit</small><b>2</b></div>
                      <div className="mock-kpi"><small>No-show rate</small><b>4%</b></div>
                    </div>
                    <div className="mock-row"><b>10:00</b>Meera · Haircut<span className="badge ok">confirmed</span></div>
                    <div className="mock-row"><b>11:30</b>Asha · Colouring<span className="badge pending_deposit">deposit</span></div>
                    <div className="mock-row"><b>14:00</b>Dev · Consultation<span className="badge ok">confirmed</span></div>
                    <div className="mock-row"><b>16:30</b>Priya · Group class<span className="badge info">3 of 12</span></div>
                  </div>
                </div>
              </div>
              <div className="phone">
                <div className="phone-h"><span className="mark" /><div><b>Glow Salon</b><div className="tiny" style={{ color: "var(--ink-text)" }}>example chat</div></div></div>
                <div className="msgs">
                  <div className="bub user">Can I get a cut this Saturday?</div>
                  <div className="bub assistant">2:30 pm is free. Shall I book it?</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main>
        <section className="l-sec l-wrap" id="features">
          <div className="eyebrow">Everything in one front desk</div>
          <h2>Built for businesses that live on appointments</h2>
          <p className="sub">One place for bookings, orders, leads and follow-ups, with an assistant that works while you&apos;re busy.</p>
          <div className="feat">{features.map(([ic, t, d, big]) => (
            <div key={t} className={`card ${big ? "big" : ""}`}><span className="ic"><Icon n={ic} /></span><h3>{t}</h3><p className="sm muted">{d}</p></div>))}</div>
        </section>

        <section className="l-sec l-wrap" id="how" style={{ paddingTop: 0 }}>
          <div className="eyebrow">How it works</div><h2>Live the same day</h2>
          <div className="steps">{[["Describe your business", "One sentence becomes your services, hours and FAQ. Prices are only set when you type them."], ["Share your link or connect WhatsApp", "Use the booking page and website widget straight away; connect your own WhatsApp number when you're ready."], ["Let the AI work", "It books, reminds, recovers no-shows and reports back. You step in only when a human is needed."]].map(([t, d], i) => (
            <div key={t} className="card step"><div className="n">0{i + 1}</div><h3 style={{ margin: "10px 0 6px" }}>{t}</h3><p className="sm muted">{d}</p></div>))}</div>
        </section>

        <div className="prod-wrap"><section className="prod" id="engineering">
          <div className="l-wrap"><div className="prod-g">
            <div>
              <div className="eyebrow">Under the hood</div>
              <h2>Built like production software</h2>
              <p className="sub">Not just a pretty front end. Every push is tested, built into a container, smoke-tested and published, and the running app reports its own health.</p>
              <div className="prod-cards">{prod.map(([ic, t, d]) => <div key={t} className="prod-card"><b><Icon n={ic} className="sm" />{t}</b><p>{d}</p></div>)}</div>
              <div className="row wrap" style={{ marginTop: 22 }}><Link href="/status" className="btn lime">See live system status <Icon n="arrow" className="sm" /></Link><a href="/api/health" className="btn ghost" style={{ background: "transparent", color: "#fff", borderColor: "var(--ink-line)" }}>/api/health</a></div>
            </div>
            <div className="term" aria-label="Terminal example">
              <div className="term-h"><i /><i /><i /><span>terminal</span></div>
              <pre><span className="p">$</span> docker compose --profile monitoring up -d --build{"\n"}<span className="ok"> ✔</span> Container devagent             <span className="d">Started</span>{"\n"}<span className="ok"> ✔</span> Container devagent-prometheus  <span className="d">Started</span>{"\n"}<span className="ok"> ✔</span> Container devagent-grafana     <span className="d">Started</span>{"\n\n"}<span className="p">$</span> curl localhost:3100/api/health{"\n"}{`{"status":"ok","uptimeSeconds":22}`}{"\n\n"}<span className="p">$</span> curl localhost:3100/api/ready{"\n"}{`{"status":"ready","checks":{"database":{"ok":true}}}`}{"\n\n"}<span className="p">$</span> curl localhost:3100/api/version{"\n"}{`{"name":"devagent","version":"0.2.0",`}{"\n"}{` "commit":"2ba6214","env":"production"}`}</pre>
            </div>
          </div></div>
        </section></div>

        <section className="l-sec l-wrap" id="pricing">
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

        <section className="l-wrap"><div className="cta"><div><h2>Ready to stop missing customers?</h2><p style={{ opacity: .9, marginTop: 6 }}>Set up in two minutes. Free for small businesses.</p></div><Link href="/signup" className="btn lime l">Start free <Icon n="arrow" /></Link></div></section>
      </main>

      <footer className="l-foot"><div className="l-wrap"><div className="foot-g">
        <div><Link href="/" className="brand" style={{ padding: 0 }}><Mark /> Devagent</Link><p className="sm" style={{ marginTop: 10, maxWidth: 260 }}>AI front desk for appointment businesses.</p></div>
        <div><h4>Product</h4><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a></div>
        <div><h4>Account</h4><Link href="/signup">Start free</Link><Link href="/login">Log in</Link></div>
        <div><h4>Engineering</h4><Link href="/status">System status</Link><a href="/api/health">Health</a><a href="/api/version">Version</a></div>
      </div></div></footer>
    </>
  );
}
