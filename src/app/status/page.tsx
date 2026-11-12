import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import { Mark } from "@/components/icons";
import { get } from "@/lib/db";
import { schedulerStats } from "@/lib/metrics";
import { versionInfo } from "@/lib/runtime";

export const dynamic = "force-dynamic";
export const metadata = { title: "System status" };

const fmt = (s: number) => { const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60); return `${d ? d + "d " : ""}${h || d ? h + "h " : ""}${m}m ${s % 60}s`; };

/** Public, read-only health view. Shows service health only - no business data. */
export default function Status() {
  const v = versionInfo();
  let db = { ok: false, ms: 0 };
  try { const t0 = Date.now(); get("SELECT 1"); db = { ok: true, ms: Date.now() - t0 }; } catch { /* shown as down */ }
  const lastRun = schedulerStats.lastRun ? Math.round((Date.now() - schedulerStats.lastRun) / 1000) : null;
  const ok = db.ok && schedulerStats.errors === 0;
  const rows: [string, string, boolean][] = [
    ["Web app", "Operational", true],
    ["Database", db.ok ? `Operational · ${db.ms} ms` : "Down", db.ok],
    ["Scheduler", lastRun === null ? "Waiting for first run (every 60s)" : `Last run ${lastRun}s ago · ${schedulerStats.runs} runs · ${schedulerStats.errors} errors`, schedulerStats.errors === 0],
  ];
  return (
    <div className="centered" id="content"><AutoRefresh seconds={5} />
      <div className="card" style={{ width: "min(640px,100%)" }}>
        <div className="row between"><div className="row"><Mark /><b style={{ fontSize: 17 }}>Devagent status</b></div><span className={`badge ${ok ? "ok" : "bad"}`}>{ok ? "All systems operational" : "Degraded"}</span></div>
        <div className="card" style={{ boxShadow: "none", width: "100%" }}>
          {rows.map(([name, text, good]) => (
            <div key={name} className="row between" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-2)" }}><b className="sm">{name}</b><span className="row sm"><span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 99, flex: "none", background: good ? "var(--brand-2)" : "#D64545", boxShadow: `0 0 0 3px ${good ? "var(--brand-soft)" : "#FBE3E3"}` }} />{text}</span></div>))}
        </div>
        <div className="bento g2">
          <div className="card stat"><span className="l">Uptime</span><span className="v num" style={{ fontSize: 20 }}>{fmt(v.uptimeSeconds)}</span></div>
          <div className="card stat"><span className="l">Version</span><span className="v num" style={{ fontSize: 20 }}>v{v.version}</span></div>
          <div className="card stat"><span className="l">Commit</span><span className="v num" style={{ fontSize: 20 }}>{v.commit.slice(0, 7)}</span></div>
          <div className="card stat"><span className="l">Built</span><span className="v num" style={{ fontSize: 14 }}>{v.builtAt ? new Date(v.builtAt).toLocaleString() : "local build"}</span></div>
        </div>
        <p className="sm muted">Node {v.node} · {v.env} · refreshes every 5 seconds</p>
        <div className="row wrap sm">{["/api/health", "/api/ready", "/api/version", "/api/metrics"].map((p) => <a key={p} className="btn ghost s" href={p}>{p}</a>)}<Link href="/" className="btn ghost s">Home</Link></div>
      </div>
    </div>
  );
}
