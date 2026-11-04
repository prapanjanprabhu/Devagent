"use client";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";

type Svc = { id: number; name: string; duration_min: number; price: number | null; deposit: number; spots: number };
type Prod = { id: number; name: string; price: number | null; stock: number | null };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

export default function BookForm({ tid, services, products }: { tid: string; services: Svc[]; products: Prod[] }) {
  const [mode, setMode] = useState<"book" | "order">(services.length ? "book" : "order");
  const [step, setStep] = useState(services.length === 1 ? 2 : 1); // a single service needs no choosing
  const [svc, setSvc] = useState<Svc | null>(services.length === 1 ? services[0] : null);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => new Date(Date.now() + i * 864e5)), []);
  const [date, setDate] = useState(iso(days[0]));
  const [slots, setSlots] = useState<string[] | null>(null);
  const [start, setStart] = useState("");
  const [name, setName] = useState(""), [phone, setPhone] = useState("");
  const [qty, setQty] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [done, setDone] = useState<{ text: string; pay?: string } | null>(null), [wl, setWl] = useState(false);

  useEffect(() => {
    if (!svc) return;
    let live = true; setSlots(null); setStart("");
    fetch(`/api/t/${tid}/slots?service=${svc.id}&date=${date}`).then((r) => r.json()).then((d) => live && setSlots(d.slots ?? []));
    return () => { live = false; };
  }, [tid, svc, date]); // not on step: moving to the details step must keep the chosen time

  const finish = (text: string, pay?: string) => setDone({ text, pay });
  async function book() {
    if (!svc) return; setBusy(true); setErr("");
    const d = await post(`/api/t/${tid}/book`, { serviceId: svc.id, start, name, phone });
    setBusy(false);
    if (d.ok) finish(d.booking.status === "pending_deposit" ? `Your slot is held for ${d.booking.start.replace("T", " at ")}. Pay the deposit to confirm it.` : `You're booked for ${d.booking.start.replace("T", " at ")}. We'll remind you on WhatsApp.`, d.payUrl);
    else { setErr(d.error); if (/no longer available/.test(d.error)) setStep(2); }
  }
  async function waitlist() { const d = await post(`/api/t/${tid}/waitlist`, { serviceId: svc!.id, date, name, phone }); if (d.ok) setWl(true); else setErr(d.error ?? "Add your name and phone below to join the waitlist."); }
  async function order() {
    setBusy(true); setErr("");
    const items = Object.entries(qty).filter(([, q]) => q > 0).map(([id, q]) => ({ product_id: Number(id), qty: q }));
    const d = await post(`/api/t/${tid}/order`, { name, phone, items });
    setBusy(false); d.ok ? finish(`Order #${d.id} placed${d.total != null ? ` - total ${d.total}` : ". We'll confirm the price shortly."}`) : setErr(d.error);
  }

  if (!services.length && !products.length) return <div className="card card-b" style={{ maxWidth: 460 }}><b>Nothing to book yet</b><p className="muted sm">This business hasn&apos;t published any services.</p></div>;
  if (done) return (
    <div className="wiz"><div className="card card-b col" style={{ alignItems: "center", textAlign: "center", padding: 32 }}>
      <span className="badge ok plain" style={{ width: 56, height: 56, padding: 0, justifyContent: "center", borderRadius: "50%" }}><Icon n="check" /></span>
      <h2>All set</h2><p className="muted">{done.text}</p>
      {done.pay && <a className="btn l" href={done.pay}>Pay deposit</a>}
    </div></div>);

  const total = Object.entries(qty).reduce((s, [id, q]) => s + q * (products.find((p) => p.id === Number(id))?.price ?? 0), 0);
  return (
    <div className="wiz">
      {services.length > 0 && products.length > 0 && (
        <div className="row" role="tablist">{(["book", "order"] as const).map((m) => <button key={m} role="tab" aria-selected={mode === m} className={`chip ${mode === m ? "on" : ""}`} onClick={() => { setMode(m); setErr(""); }}>{m === "book" ? "Book a service" : "Place an order"}</button>)}</div>)}

      {mode === "book" && (<>
        <div className="stepper" aria-label={`Step ${step} of 3`}>{[1, 2, 3].map((n) => <i key={n} className={n <= step ? "on" : ""} />)}</div>
        {step === 1 && (<div className="col"><h2>Choose a service</h2>
          {services.map((s) => (
            <button key={s.id} className="opt" aria-pressed={svc?.id === s.id} onClick={() => { setSvc(s); setStep(2); }}>
              <span><b>{s.name}</b><br /><span className="sm muted">{s.duration_min} min{s.spots > 1 ? ` · ${s.spots} seats` : ""}{s.deposit > 0 ? ` · ${s.deposit} deposit` : ""}</span></span>
              <span className="strong num">{s.price ?? "On request"}</span></button>))}</div>)}
        {step === 2 && svc && (<div className="col" style={{ gap: 12 }}>
          <div className="row between"><h2>Pick a time</h2>{services.length > 1 && <button className="btn ghost s" onClick={() => setStep(1)}>{svc.name} · change</button>}</div>
          <div className="days" role="group" aria-label="Date">{days.map((d) => { const v = iso(d); return (
            <button key={v} className="day" aria-pressed={date === v} onClick={() => setDate(v)}><span>{d.toLocaleDateString(undefined, { weekday: "short" })}</span><b>{d.getDate()}</b><span>{d.toLocaleDateString(undefined, { month: "short" })}</span></button>); })}</div>
          {slots === null ? <p className="muted sm">Checking availability…</p> : slots.length ? (
            <div className="slots" role="group" aria-label="Time">{slots.map((s) => <button key={s} className="slot" aria-pressed={start === s} onClick={() => { setStart(s); setStep(3); }}>{s.slice(11)}</button>)}</div>
          ) : (<div className="card card-b col"><b>No free slots on this day</b><p className="sm muted">Pick another date, or join the waitlist and we&apos;ll message you if one opens.</p>
            {wl ? <span className="ok-t">You&apos;re on the waitlist ✓</span> : (<div className="fgrid c2"><input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" /><input placeholder="WhatsApp number" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Phone" /><button className="btn ghost" style={{ gridColumn: "1/-1" }} onClick={waitlist}>Join waitlist</button></div>)}</div>)}
        </div>)}
        {step === 3 && svc && (<form className="col" onSubmit={(e) => { e.preventDefault(); book(); }}>
          <h2>Your details</h2>
          <div className="card card-b row between"><div><b>{svc.name}</b><div className="sm muted">{start.replace("T", " at ")}</div></div><button type="button" className="btn ghost s" onClick={() => setStep(2)}>Change</button></div>
          {svc.deposit > 0 && <div className="notice info">A deposit of {svc.deposit} holds your slot - you&apos;ll get a payment link next.</div>}
          <div className="f"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} required autoFocus autoComplete="name" /></div>
          <div className="f"><label>WhatsApp number</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" required autoComplete="tel" inputMode="tel" /></div>
          <button className="btn l block" disabled={busy}>{busy ? "Booking…" : svc.deposit > 0 ? "Hold my slot" : "Confirm booking"}</button>
        </form>)}
      </>)}

      {mode === "order" && (<form className="col" onSubmit={(e) => { e.preventDefault(); order(); }}>
        <h2>Place an order</h2>
        {products.map((p) => (
          <div key={p.id} className="card card-b row between"><div><b>{p.name}</b><div className="sm muted">{p.price ?? "Price on request"}{p.stock === 0 ? " · sold out" : ""}</div></div>
            <div className="row"><button type="button" className="ibtn" aria-label={`Fewer ${p.name}`} onClick={() => setQty({ ...qty, [p.id]: Math.max(0, (qty[p.id] ?? 0) - 1) })}>−</button><b className="num" style={{ width: 22, textAlign: "center" }}>{qty[p.id] ?? 0}</b>
              <button type="button" className="ibtn" disabled={p.stock === 0} aria-label={`More ${p.name}`} onClick={() => setQty({ ...qty, [p.id]: Math.min(p.stock ?? 100, (qty[p.id] ?? 0) + 1) })}>+</button></div></div>))}
        <div className="fgrid c2"><div className="f"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} required /></div><div className="f"><label>WhatsApp number</label><input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" /></div></div>
        <button className="btn l block" disabled={busy || !Object.values(qty).some((q) => q > 0)}>{busy ? "Placing…" : `Place order${total ? ` · ${total}` : ""}`}</button>
      </form>)}
      {err && <p className="err" role="alert">{err}</p>}
    </div>
  );
}
