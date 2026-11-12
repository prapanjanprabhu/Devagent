import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, Mark } from "./icons";

const points = ["Answers customers on WhatsApp and the web, 24/7", "Books your real calendar - no double-booking", "Deposits, reminders and a waitlist that fills cancellations", "Set up in minutes from one sentence about your business"];

export default function AuthShell({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-art">
        <Link href="/" className="brand" style={{ padding: 0, position: "relative" }}><Mark /> Devagent</Link>
        <div><h2>Never lose a customer to an <em>unanswered</em> message.</h2><ul>{points.map((p) => <li key={p}><Icon n="check" className="sm" />{p}</li>)}</ul></div>
        <span className="sm" style={{ color: "var(--ink-text)", position: "relative" }}>Your number · your bank account · 0% commission</span>
      </aside>
      <main className="auth-form" id="content"><div className="auth-card"><div><h1>{title}</h1><p className="muted" style={{ marginTop: 4 }}>{sub}</p></div>{children}</div></main>
    </div>
  );
}
