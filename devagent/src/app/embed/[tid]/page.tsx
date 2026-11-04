"use client";
import { use, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";

type M = { role: "user" | "assistant"; content: string };

export default function Embed({ params }: { params: Promise<{ tid: string }> }) {
  const { tid } = use(params);
  const [msgs, setMsgs] = useState<M[]>([{ role: "assistant", content: "Hi! Ask me anything, or tell me when you'd like to book." }]);
  const [text, setText] = useState(""), [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    const next = [...msgs, { role: "user" as const, content: text.trim() }];
    setMsgs(next); setText(""); setBusy(true);
    try {
      // The greeting is UI-only; the API requires history to start with a user turn.
      const r = await fetch(`/api/t/${tid}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next.slice(1) }) });
      const d = await r.json();
      setMsgs([...next, { role: "assistant", content: d.reply ?? "Something went wrong." }]);
    } catch { setMsgs([...next, { role: "assistant", content: "Network error. Please try again." }]); }
    setBusy(false);
  }
  return (
    <div className="embed">
      <div className="embed-h"><span className="mark" /><div><b>Chat with us</b><div className="tiny" style={{ color: "var(--ink-text)" }}>AI assistant · replies instantly</div></div></div>
      <div className="msgs" aria-live="polite">{msgs.map((m, i) => <div key={i} className={`bub ${m.role === "user" ? "assistant" : "user"}`}>{m.content}</div>)}{busy && <div className="bub user muted">Typing…</div>}<div ref={end} /></div>
      <form className="composer" onSubmit={send}><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" aria-label="Message" autoComplete="off" /><button className="btn" disabled={busy} aria-label="Send"><Icon n="arrow" className="sm" /></button></form>
    </div>
  );
}
