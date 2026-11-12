import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET as health } from "@/app/api/health/route";
import { GET as ready } from "@/app/api/ready/route";
import { GET as version } from "@/app/api/version/route";
import { GET as metrics } from "@/app/api/metrics/route";

describe("ops endpoints", () => {
  it("health says ok", async () => {
    const res = health();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok" });
  });

  it("ready checks the database", async () => {
    const res = ready();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ready", checks: { database: { ok: true } } });
  });

  it("version shows the build info", async () => {
    process.env.GIT_SHA = "abc1234";
    const body = await version().json();
    expect(body).toMatchObject({ name: "devagent", commit: "abc1234" });
  });

  it("metrics are in prometheus format", async () => {
    const res = metrics(new NextRequest("http://localhost/api/metrics"));
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).toContain("# TYPE devagent_up gauge");
    expect(text).toContain("devagent_up 1");
    expect(text).toContain("devagent_scheduler_runs_total");
  });

  it("metrics need the token when one is set", async () => {
    process.env.METRICS_TOKEN = "secret";
    expect(metrics(new NextRequest("http://localhost/api/metrics")).status).toBe(401);
    const ok = metrics(new NextRequest("http://localhost/api/metrics", { headers: { authorization: "Bearer secret" } }));
    expect(ok.status).toBe(200);
    delete process.env.METRICS_TOKEN;
  });
});
