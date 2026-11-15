// Postgres via node-postgres. The website pods keep no data of their own, so any number of copies can run
// behind a load balancer while this one database holds everything.
import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, types, type PoolClient } from "pg";

// Postgres sends COUNT(*) and SUM(...) as 64-bit numbers or numerics (strings by default). The app wants plain numbers.
types.setTypeParser(20, (v) => Number(v));
types.setTypeParser(1700, (v) => parseFloat(v));

const SCHEMA_LOCK = 727274; // only one pod at a time may create or upgrade the tables
const NO_ID = new Set(["sessions"]); // tables without an "id" column

// Dates are stored as "YYYY-MM-DD HH:MM:SS" text in UTC, exactly like before. dv_dt('-7 days') means "7 days ago".
const DDL = `
  CREATE OR REPLACE FUNCTION dv_dt(off interval DEFAULT interval '0') RETURNS text LANGUAGE sql STABLE AS
    $$ SELECT to_char((now() AT TIME ZONE 'utc') + off, 'YYYY-MM-DD HH24:MI:SS') $$;
  CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, pass_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT dv_dt());
  CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at BIGINT NOT NULL);
  CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES users(id), name TEXT NOT NULL DEFAULT 'My Business',
    vertical TEXT NOT NULL DEFAULT 'general', modules TEXT NOT NULL DEFAULT '["appointments"]',
    hours TEXT NOT NULL, staff INTEGER NOT NULL DEFAULT 1, plan TEXT NOT NULL DEFAULT 'free',
    owner_phone TEXT, review_link TEXT, deposit_hold_min INTEGER NOT NULL DEFAULT 120,
    wa_phone_id TEXT, wa_token TEXT, rz_key_id TEXT, rz_key_secret TEXT,
    rescue_number TEXT, credits DOUBLE PRECISION NOT NULL DEFAULT 0, onboarded INTEGER NOT NULL DEFAULT 0,
    last_digest TEXT, created_at TEXT NOT NULL DEFAULT dv_dt());
  CREATE TABLE IF NOT EXISTS services (id SERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, duration_min INTEGER NOT NULL, price DOUBLE PRECISION, deposit DOUBLE PRECISION NOT NULL DEFAULT 0, spots INTEGER NOT NULL DEFAULT 1, active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS customers (id SERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, phone TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', opted_in INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT dv_dt(), UNIQUE(tenant_id, phone));
  CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, service_id INTEGER NOT NULL, customer_name TEXT NOT NULL, phone TEXT NOT NULL,
    start TEXT NOT NULL, "end" TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'confirmed', channel TEXT NOT NULL DEFAULT 'web',
    deposit_due DOUBLE PRECISION NOT NULL DEFAULT 0, deposit_paid INTEGER NOT NULL DEFAULT 0, token TEXT NOT NULL,
    reminded24 INTEGER NOT NULL DEFAULT 0, reminded2 INTEGER NOT NULL DEFAULT 0, review_asked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT dv_dt());
  CREATE INDEX IF NOT EXISTS idx_b_tenant_start ON bookings(tenant_id, start);
  CREATE INDEX IF NOT EXISTS idx_b_token ON bookings(token);
  CREATE TABLE IF NOT EXISTS blocks (id SERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, start TEXT NOT NULL, "end" TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '');
  CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, price DOUBLE PRECISION, stock INTEGER, active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, phone TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', items TEXT NOT NULL, total DOUBLE PRECISION, status TEXT NOT NULL DEFAULT 'new', paid INTEGER NOT NULL DEFAULT 0, channel TEXT NOT NULL DEFAULT 'whatsapp', token TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT dv_dt());
  CREATE INDEX IF NOT EXISTS idx_o_token ON orders(token);
  CREATE TABLE IF NOT EXISTS enquiries (id SERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, phone TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', summary TEXT NOT NULL, stage TEXT NOT NULL DEFAULT 'new', value DOUBLE PRECISION NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT dv_dt(), updated_at TEXT NOT NULL DEFAULT dv_dt());
  CREATE TABLE IF NOT EXISTS packs (id SERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, sessions INTEGER NOT NULL, price DOUBLE PRECISION NOT NULL, service_id INTEGER);
  CREATE TABLE IF NOT EXISTS customer_packs (id SERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, phone TEXT NOT NULL, pack_id INTEGER NOT NULL, remaining INTEGER NOT NULL, paid INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT dv_dt());
  CREATE TABLE IF NOT EXISTS waitlist (id SERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, service_id INTEGER NOT NULL, phone TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', date TEXT NOT NULL, notified INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT dv_dt());
  CREATE TABLE IF NOT EXISTS campaigns (id SERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, body TEXT NOT NULL, segment TEXT NOT NULL, sent INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT dv_dt());
  CREATE TABLE IF NOT EXISTS outbox (id SERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, phone TEXT NOT NULL, body TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'transactional', delivered INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT dv_dt());
  CREATE TABLE IF NOT EXISTS chat_messages (id SERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, phone TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, channel TEXT NOT NULL DEFAULT 'whatsapp', created_at TEXT NOT NULL DEFAULT dv_dt());
  CREATE INDEX IF NOT EXISTS idx_chat_tenant_phone ON chat_messages(tenant_id, phone);
  CREATE TABLE IF NOT EXISTS knowledge (id SERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, q TEXT NOT NULL, a TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS calls (id SERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, from_phone TEXT NOT NULL, rescued INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT dv_dt());
  CREATE TABLE IF NOT EXISTS payments (id SERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, kind TEXT NOT NULL, ref_id INTEGER NOT NULL, amount DOUBLE PRECISION NOT NULL, provider TEXT NOT NULL, provider_ref TEXT, status TEXT NOT NULL DEFAULT 'created', created_at TEXT NOT NULL DEFAULT dv_dt());
`;

type State = { pool: Pool; ready?: Promise<void> };
const g = globalThis as unknown as { __dvPg?: State };
const schema = () => process.env.DB_SCHEMA; // tests give every file its own schema

// Lazy: importing this file (for example during "next build") never opens a connection.
function state(): State {
  if (!g.__dvPg) {
    const sch = schema();
    g.__dvPg = {
      pool: new Pool({
        connectionString: process.env.DATABASE_URL || "postgres://devagent:devagent@localhost:5440/devagent",
        max: Number(process.env.DB_POOL_MAX || 10),
        connectionTimeoutMillis: 8000,
        idleTimeoutMillis: 30000,
        ...(sch ? { options: `-c search_path=${sch}` } : {}),
      }),
    };
    g.__dvPg.pool.on("error", () => { /* an idle connection dropped; the pool replaces it on the next query */ });
  }
  return g.__dvPg;
}

async function init(pool: Pool) {
  const c = await pool.connect();
  try {
    await c.query("SELECT pg_advisory_lock($1)", [SCHEMA_LOCK]);
    if (schema()) await c.query(`CREATE SCHEMA IF NOT EXISTS "${schema()}"`);
    await c.query(DDL);
  } finally {
    await c.query("SELECT pg_advisory_unlock($1)", [SCHEMA_LOCK]).catch(() => {});
    c.release();
  }
}

function ready() {
  const s = state();
  // If the database is not reachable yet (pod started before it), forget the failure so the next query tries again.
  return (s.ready ??= init(s.pool).catch((e) => { s.ready = undefined; throw e; }));
}

// Queries inside tx() automatically use the transaction's connection. "after" holds work that must wait for COMMIT.
const inTx = new AsyncLocalStorage<{ client: PoolClient; after: Array<() => void> }>();

/** Turns "?" placeholders into $1, $2 ... (skipping anything inside quotes). */
function toPg(sql: string) {
  let n = 0, out = "", q = "";
  for (const ch of sql) {
    if (q) { if (ch === q) q = ""; out += ch; }
    else if (ch === "'" || ch === '"') { q = ch; out += ch; }
    else if (ch === "?") out += `$${++n}`;
    else out += ch;
  }
  return out;
}

type P = string | number | null;
async function exec(sql: string, params: P[]) {
  await ready();
  const store = inTx.getStore();
  return (store?.client ?? state().pool).query(toPg(sql), params);
}

export const all = async <T = any>(sql: string, ...a: P[]): Promise<T[]> => (await exec(sql, a)).rows as T[];
export const get = async <T = any>(sql: string, ...a: P[]): Promise<T | undefined> => (await exec(sql, a)).rows[0] as T | undefined;

/** Runs a write. For INSERTs it returns the new row's id; for UPDATE/DELETE it returns how many rows changed. */
export const run = async (sql: string, ...a: P[]) => {
  const table = /^\s*insert\s+into\s+(\w+)/i.exec(sql)?.[1]?.toLowerCase();
  const q = table && !NO_ID.has(table) && !/\breturning\b/i.test(sql) ? `${sql} RETURNING id` : sql;
  const r = await exec(q, a);
  const id = Number(r.rows[0]?.id);
  return { id: Number.isFinite(id) ? id : 0, changes: r.rowCount ?? 0 };
};

/** Everything inside fn is one transaction (all or nothing). Nested calls join the outer one. */
export async function tx<T>(fn: () => Promise<T>): Promise<T> {
  if (inTx.getStore()) return fn();
  await ready();
  const client = await state().pool.connect();
  const store = { client, after: [] as Array<() => void> };
  let result: T;
  try {
    await client.query("BEGIN");
    result = await inTx.run(store, fn);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  for (const f of store.after) { try { f(); } catch { /* a failed side effect must not undo a committed booking */ } }
  return result;
}

/** Runs fn once the surrounding transaction has committed (right away when there is none). Dropped on rollback. */
export function afterCommit(fn: () => void) {
  const store = inTx.getStore();
  if (store) store.after.push(fn); else fn();
}

/** Inside tx(): other pods wait their turn for the same key (for example one business's calendar). */
export const lockKey = (key: string) => get("SELECT pg_advisory_xact_lock(hashtext(?))", key);

/**
 * Runs fn only if this pod wins the lock for "name"; other pods skip it. Used for background jobs so they
 * never run twice at once. The lock is released when fn ends (or automatically if the pod dies).
 */
export async function withLeader(name: string, fn: () => Promise<void>): Promise<boolean> {
  await ready();
  const c = await state().pool.connect();
  try {
    const got = (await c.query("SELECT pg_try_advisory_lock(hashtext($1)) AS ok", [name])).rows[0]?.ok === true;
    if (!got) return false;
    try { await fn(); } finally { await c.query("SELECT pg_advisory_unlock(hashtext($1))", [name]).catch(() => {}); }
    return true;
  } finally {
    c.release();
  }
}

export async function closeDb() {
  const s = g.__dvPg;
  g.__dvPg = undefined;
  await s?.pool.end();
}

export type Hours = Record<string, [string, string] | null>;
export type Tenant = {
  id: string; owner_id: number; name: string; vertical: string; modules: string; hours: string; staff: number; plan: "free" | "booking" | "frontdesk";
  owner_phone: string | null; review_link: string | null; deposit_hold_min: number; wa_phone_id: string | null; wa_token: string | null;
  rz_key_id: string | null; rz_key_secret: string | null; rescue_number: string | null; credits: number; onboarded: number; last_digest: string | null;
};
export type Service = { id: number; tenant_id: string; name: string; duration_min: number; price: number | null; deposit: number; spots: number; active: number };
export type Booking = {
  id: number; tenant_id: string; service_id: number; customer_name: string; phone: string; start: string; end: string; status: string; channel: string;
  deposit_due: number; deposit_paid: number; token: string; reminded24: number; reminded2: number; review_asked: number; created_at: string; service_name?: string;
};
export const DEFAULT_HOURS: Hours = { "0": null, "1": ["09:00", "18:00"], "2": ["09:00", "18:00"], "3": ["09:00", "18:00"], "4": ["09:00", "18:00"], "5": ["09:00", "18:00"], "6": ["10:00", "14:00"] };
export const tenantById = (id: string) => get<Tenant>("SELECT * FROM tenants WHERE id=?", id);
export const hasModule = (t: Tenant, m: string) => (JSON.parse(t.modules) as string[]).includes(m);
