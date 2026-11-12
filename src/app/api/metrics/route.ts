import { NextRequest, NextResponse } from "next/server";
import { all, get } from "@/lib/db";
import { schedulerStats } from "@/lib/metrics";
import { startedAt, versionInfo } from "@/lib/runtime";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

/** Prometheus text format. Set METRICS_TOKEN to require "Authorization: Bearer <token>". */
export function GET(req: NextRequest) {
  const token = process.env.METRICS_TOKEN;
  if (token && req.headers.get("authorization") !== `Bearer ${token}`) return new NextResponse("unauthorized", { status: 401 });

  const v = versionInfo(), mem = process.memoryUsage();
  const n = (sql: string) => get<{ c: number }>(sql)?.c ?? 0;
  const L: string[] = [];
  const metric = (name: string, help: string, type: "gauge" | "counter", rows: [string, number][]) => {
    L.push(`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`);
    for (const [labels, value] of rows) L.push(`${name}${labels} ${value}`);
  };

  metric("devagent_up", "1 when the app is running", "gauge", [["", 1]]);
  metric("devagent_build_info", "Build information", "gauge", [[`{version="${esc(v.version)}",commit="${esc(v.commit)}"}`, 1]]);
  metric("devagent_uptime_seconds", "Seconds since process start", "gauge", [["", Math.round((Date.now() - startedAt) / 1000)]]);
  metric("process_resident_memory_bytes", "Resident memory", "gauge", [["", mem.rss]]);
  metric("nodejs_heap_used_bytes", "V8 heap used", "gauge", [["", mem.heapUsed]]);
  metric("devagent_tenants_total", "Businesses on the platform", "gauge", [["", n("SELECT COUNT(*) c FROM tenants")]]);
  metric("devagent_bookings_total", "Bookings by status", "gauge",
    all<{ status: string; c: number }>("SELECT status, COUNT(*) c FROM bookings GROUP BY status").map((r): [string, number] => [`{status="${esc(r.status)}"}`, r.c]));
  metric("devagent_orders_total", "Orders", "gauge", [["", n("SELECT COUNT(*) c FROM orders")]]);
  metric("devagent_messages_total", "Messages queued by delivery state", "gauge",
    all<{ delivered: number; c: number }>("SELECT delivered, COUNT(*) c FROM outbox GROUP BY delivered").map((r): [string, number] => [`{delivered="${r.delivered ? "true" : "false"}"}`, r.c]));
  metric("devagent_scheduler_runs_total", "Scheduler ticks", "counter", [["", schedulerStats.runs]]);
  metric("devagent_scheduler_errors_total", "Scheduler ticks that failed", "counter", [["", schedulerStats.errors]]);
  metric("devagent_scheduler_last_run_timestamp_seconds", "Unix time of the last scheduler tick", "gauge", [["", schedulerStats.lastRun ? Math.round(schedulerStats.lastRun / 1000) : 0]]);

  return new NextResponse(L.join("\n") + "\n", { headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" } });
}
