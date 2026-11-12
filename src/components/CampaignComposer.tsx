"use client";
import { useState } from "react";
import ActionForm, { type ActionResult } from "./ActionForm";
import { Field } from "./ui";

export default function CampaignComposer({ segments, action, business, left }: { segments: { key: string; label: string; n: number }[]; action: (fd: FormData) => Promise<ActionResult>; business: string; left: string }) {
  const [seg, setSeg] = useState(segments[0].key), [body, setBody] = useState("Hi {name}! We have something special this week at " + business + ".");
  const n = segments.find((s) => s.key === seg)?.n ?? 0;
  return (
    <div className="bento g2" style={{ alignItems: "start" }}>
      <ActionForm action={action} className="card card-b col" success="Campaign queued" reset={false}>
        <div className="f"><label>Campaign name</label><input name="name" placeholder="Weekend offer" /></div>
        <Field label="Send to"><select name="segment" value={seg} onChange={(e) => setSeg(e.target.value)}>{segments.map((s) => <option key={s.key} value={s.key}>{s.label} ({s.n})</option>)}</select></Field>
        <Field label="Message" hint="Use {name} to personalise. “Reply STOP to opt out” is added automatically."><textarea name="body" rows={6} required value={body} onChange={(e) => setBody(e.target.value)} /></Field>
        <div className="row between"><span className="sm muted">{n} recipient{n === 1 ? "" : "s"} · {left}</span><button className="btn" disabled={!n}>Send to {n}</button></div>
      </ActionForm>
      <div className="phone" style={{ margin: "0 auto", width: "100%" }}>
        <div className="phone-h"><span className="mark" /><div><b style={{ color: "#fff" }}>{business}</b><div className="tiny" style={{ color: "var(--ink-text)" }}>What your customer receives</div></div></div>
        <div className="msgs" style={{ minHeight: 180 }}><div className="bub assistant" style={{ animation: "none", alignSelf: "flex-start" }}>{body.replaceAll("{name}", "Priya")}<div className="tiny" style={{ opacity: .7, marginTop: 6 }}>Reply STOP to opt out.</div></div></div>
      </div>
    </div>
  );
}
