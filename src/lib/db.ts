// SQLite via Node's built-in node:sqlite (no native deps). getBuiltinModule avoids bundler issues.
import path from "node:path";
import fs from "node:fs";

const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite");

function open() {
  const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "devagent.db"));
  db.exec(`
    PRAGMA busy_timeout = 8000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, pass_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES users(id), name TEXT NOT NULL DEFAULT 'My Business',
      vertical TEXT NOT NULL DEFAULT 'general', modules TEXT NOT NULL DEFAULT '["appointments"]',
      hours TEXT NOT NULL, staff INTEGER NOT NULL DEFAULT 1, plan TEXT NOT NULL DEFAULT 'free',
      owner_phone TEXT, review_link TEXT, deposit_hold_min INTEGER NOT NULL DEFAULT 120,
      wa_phone_id TEXT, wa_token TEXT, rz_key_id TEXT, rz_key_secret TEXT,
      rescue_number TEXT, credits REAL NOT NULL DEFAULT 0, onboarded INTEGER NOT NULL DEFAULT 0,
      last_digest TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, name TEXT NOT NULL, duration_min INTEGER NOT NULL, price REAL, deposit REAL NOT NULL DEFAULT 0, spots INTEGER NOT NULL DEFAULT 1, active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, phone TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', opted_in INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(tenant_id, phone));
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, service_id INTEGER NOT NULL, customer_name TEXT NOT NULL, phone TEXT NOT NULL,
      start TEXT NOT NULL, end TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'confirmed', channel TEXT NOT NULL DEFAULT 'web',
      deposit_due REAL NOT NULL DEFAULT 0, deposit_paid INTEGER NOT NULL DEFAULT 0, token TEXT NOT NULL,
      reminded24 INTEGER NOT NULL DEFAULT 0, reminded2 INTEGER NOT NULL DEFAULT 0, review_asked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS idx_b_tenant_start ON bookings(tenant_id, start);
    CREATE TABLE IF NOT EXISTS blocks (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, name TEXT NOT NULL, price REAL, stock INTEGER, active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, phone TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', items TEXT NOT NULL, total REAL, status TEXT NOT NULL DEFAULT 'new', paid INTEGER NOT NULL DEFAULT 0, channel TEXT NOT NULL DEFAULT 'whatsapp', token TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS enquiries (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, phone TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', summary TEXT NOT NULL, stage TEXT NOT NULL DEFAULT 'new', value REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS packs (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, name TEXT NOT NULL, sessions INTEGER NOT NULL, price REAL NOT NULL, service_id INTEGER);
    CREATE TABLE IF NOT EXISTS customer_packs (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, phone TEXT NOT NULL, pack_id INTEGER NOT NULL, remaining INTEGER NOT NULL, paid INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS waitlist (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, service_id INTEGER NOT NULL, phone TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', date TEXT NOT NULL, notified INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS campaigns (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, name TEXT NOT NULL, body TEXT NOT NULL, segment TEXT NOT NULL, sent INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, phone TEXT NOT NULL, body TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'transactional', delivered INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS chat_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, phone TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, channel TEXT NOT NULL DEFAULT 'whatsapp', created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS knowledge (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, q TEXT NOT NULL, a TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS calls (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, from_phone TEXT NOT NULL, rescued INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, kind TEXT NOT NULL, ref_id INTEGER NOT NULL, amount REAL NOT NULL, provider TEXT NOT NULL, provider_ref TEXT, status TEXT NOT NULL DEFAULT 'created', created_at TEXT NOT NULL DEFAULT (datetime('now')));
  `);
  return db;
}

const g = globalThis as unknown as { __dvDb?: InstanceType<typeof DatabaseSync> };
const raw = () => (g.__dvDb ??= open()); // lazy: build workers import this module without touching the file

type P = string | number | null;
export const all = <T = any>(sql: string, ...a: P[]): T[] => (raw().prepare(sql).all(...a) as any[]).map((r) => ({ ...r }) as T);
export const get = <T = any>(sql: string, ...a: P[]): T | undefined => { const r = raw().prepare(sql).get(...a) as any; return r ? ({ ...r } as T) : undefined; };
export const run = (sql: string, ...a: P[]) => { const r = raw().prepare(sql).run(...a); return { id: Number(r.lastInsertRowid), changes: Number(r.changes) }; };
export const tx = <T>(fn: () => T): T => { raw().exec("BEGIN IMMEDIATE"); try { const r = fn(); raw().exec("COMMIT"); return r; } catch (e) { raw().exec("ROLLBACK"); throw e; } };

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
