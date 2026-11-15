import { randomBytes } from "node:crypto";
import { afterAll } from "vitest";
import pg from "pg";

// Tests need a Postgres server. Locally: "docker compose up -d db" (port 5440). In GitHub Actions: a postgres service.
// Every test file gets its own empty schema inside that database, and it is deleted again at the end.
const url = process.env.DATABASE_URL || "postgres://devagent:devagent@localhost:5440/devagent";
const schema = `t_${randomBytes(6).toString("hex")}`;

process.env.DATABASE_URL = url;
process.env.DB_SCHEMA = schema;
process.env.BASE_URL = "http://localhost:3000";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.WA_TOKEN;
delete process.env.WA_PHONE_ID;

afterAll(async () => {
  const { closeDb } = await import("@/lib/db");
  await closeDb();
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await c.end();
});
