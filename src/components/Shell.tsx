"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon, Mark } from "./icons";

export type NavItem = { href: string; label: string; icon: string; group: string; count?: number };
type Cmd = { label: string; href: string; icon: string; group: string; kw?: string };

export default function Shell({ nav, quick, user, plan, usage, publicUrl, version, logout, children }: {
  nav: NavItem[]; quick: Cmd[]; user: string; plan: string; usage: { used: number; cap: number | null }; publicUrl: string; version: string; logout: ReactNode; children: ReactNode;
}) {
  const path = usePathname(), router = useRouter();
  const [open, setOpen] = useState(false), [pal, setPal] = useState(false), [menu, setMenu] = useState(false);
  useEffect(() => { setOpen(false); setMenu(false); }, [path]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPal(true); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);
  const groups = [...new Set(nav.map((n) => n.group))];
  const cmds: Cmd[] = useMemo(() => [...quick, ...nav.map((n) => ({ label: n.label, href: n.href, icon: n.icon, group: "Go to" })), { label: "Open public booking page", href: publicUrl, icon: "ext", group: "Go to" }], [nav, quick, publicUrl]);
  return (
    <div className="shell" data-open={open}>
      <aside className="side" aria-label="Main">
        <Link href="/dashboard" className="brand"><Mark /> Devagent</Link>
        {groups.map((g) => (
          <div key={g} style={{ display: "contents" }}>
            <div className="navh">{g}</div>
            {nav.filter((n) => n.group === g).map((n) => (
              <Link key={n.href} href={n.href} className="nav" aria-current={path === n.href || path.startsWith(n.href + "/") ? "page" : undefined}>
                <Icon n={n.icon} />{n.label}{n.count ? <span className="count">{n.count}</span> : null}
              </Link>))}
          </div>))}
        <div className="side-foot">
          <div className="plan">
            <div className="row between"><b>{plan}</b><span className="tiny" style={{ color: "var(--ink-text)" }}>{usage.cap ? `${usage.used}/${usage.cap}` : `${usage.used} this month`}</span></div>
            {usage.cap ? <div className="meter"><i style={{ width: `${Math.min(100, (usage.used / usage.cap) * 100)}%` }} /></div> : null}
            <Link href="/billing" className="tiny" style={{ color: "var(--lime)", fontWeight: 700, display: "inline-block", marginTop: 8 }}>Manage plan →</Link>
          </div>
          <Link href="/status" className="tiny" style={{ color: "#6F9A8E", padding: "0 8px" }} title="System status">{version} · status ↗</Link>
          <div className="me"><span className="avatar">{user.slice(0, 1).toUpperCase()}</span><span className="grow1 strong" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user}</span>{logout}</div>
        </div>
      </aside>
      <div className="scrim" onClick={() => setOpen(false)} />
      <div className="main">
        <header className="top">
          <button className="ibtn burger" aria-label="Open menu" onClick={() => setOpen(true)}><Icon n="menu" /></button>
          <button className="search" onClick={() => setPal(true)} aria-label="Search or jump to"><Icon n="search" className="sm" /><span className="t">Search or jump to…</span><span className="kbd">Ctrl K</span></button>
          <div className="grow1" />
          <a className="btn ghost s" href={publicUrl} target="_blank" rel="noreferrer"><Icon n="ext" className="sm" /> <span className="t">Public page</span></a>
          <div className="pop">
            <button className="btn lime" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}><Icon n="plus" className="sm" /> New</button>
            {menu && <div className="menu" role="menu">{quick.map((c) => <Link key={c.label} href={c.href} role="menuitem"><Icon n={c.icon} className="sm" />{c.label}</Link>)}</div>}
          </div>
        </header>
        <div className="page" id="content">{children}</div>
      </div>
      {pal && <Palette cmds={cmds} onClose={() => setPal(false)} go={(h) => { setPal(false); h.startsWith("http") ? window.open(h, "_blank") : router.push(h); }} />}
    </div>
  );
}

function Palette({ cmds, onClose, go }: { cmds: Cmd[]; onClose: () => void; go: (h: string) => void }) {
  const [q, setQ] = useState(""), [i, setI] = useState(0), ref = useRef<HTMLInputElement>(null);
  const list = cmds.filter((c) => (c.label + " " + (c.kw ?? "")).toLowerCase().includes(q.toLowerCase()));
  useEffect(() => ref.current?.focus(), []);
  useEffect(() => setI(0), [q]);
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(list.length - 1, x + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
    else if (e.key === "Enter" && list[i]) go(list[i].href); else if (e.key === "Escape") onClose();
  };
  let last = "";
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(10,15,31,.55)", display: "grid", placeItems: "start center", paddingTop: "12vh" }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dlg pal" role="dialog" aria-label="Command palette" style={{ display: "flex", flexDirection: "column", borderRadius: 16, background: "#fff", boxShadow: "var(--sh-lg)", overflow: "hidden" }}>
        <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={key} placeholder="Search pages and actions…" aria-label="Search" />
        <div className="pal-list" role="listbox">
          {list.map((c, n) => { const h = c.group !== last; last = c.group; return (
            <div key={c.label + c.href}>{h && <div className="pal-g">{c.group}</div>}
              <button className="pal-i" role="option" aria-selected={n === i} onMouseEnter={() => setI(n)} onClick={() => go(c.href)}><Icon n={c.icon} className="sm" />{c.label}</button></div>); })}
          {!list.length && <div className="empty">No matches</div>}
        </div>
      </div>
    </div>
  );
}
