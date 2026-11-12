"use client";
import { useEffect, useState, type ReactNode } from "react";

/** Accessible tabs (arrow keys, aria roles). Panels are server-rendered; selection persists in the URL hash. */
export default function Tabs({ tabs, initial }: { tabs: { id: string; label: string; badge?: number; content: ReactNode }[]; initial?: string }) {
  const [sel, setSel] = useState(initial ?? tabs[0].id);
  useEffect(() => { const h = location.hash.slice(1); if (tabs.some((t) => t.id === h)) setSel(h); }, [tabs]);
  const pick = (id: string) => { setSel(id); history.replaceState(null, "", `#${id}`); };
  const move = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (!d) return;
    const t = tabs[(i + d + tabs.length) % tabs.length]; pick(t.id); document.getElementById(`tab-${t.id}`)?.focus();
  };
  return (
    <>
      <div className="tabs" role="tablist">
        {tabs.map((t, i) => (
          <button key={t.id} id={`tab-${t.id}`} role="tab" aria-selected={sel === t.id} aria-controls={`panel-${t.id}`} tabIndex={sel === t.id ? 0 : -1}
            className="tab" onClick={() => pick(t.id)} onKeyDown={(e) => move(e, i)}>{t.label}{t.badge ? <span className="badge plain" style={{ marginLeft: 6, height: 18 }}>{t.badge}</span> : null}</button>))}
      </div>
      {tabs.map((t) => <div key={t.id} id={`panel-${t.id}`} role="tabpanel" hidden={sel !== t.id}>{t.content}</div>)}
    </>
  );
}
