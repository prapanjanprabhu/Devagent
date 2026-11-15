import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { get, run, tenantById, DEFAULT_HOURS, type Tenant } from "./db";

const COOKIE = "dv_session";
const hashPw = (pw: string, salt = randomBytes(16).toString("hex")) => `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
function verifyPw(pw: string, stored: string) {
  const [salt, h] = stored.split(":");
  const a = Buffer.from(h, "hex"), b = scryptSync(pw, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}
const newId = () => randomBytes(5).toString("hex"); // public tenant id used in /book/:id

export async function signup(name: string, email: string, password: string): Promise<{ ok: true; userId: number } | { ok: false; error: string }> {
  email = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Enter a valid email." };
  if (password.length < 6) return { ok: false, error: "Password needs 6+ characters." };
  if (await get("SELECT 1 FROM users WHERE email=?", email)) return { ok: false, error: "That email is already registered." };
  const u = await run("INSERT INTO users(email,name,pass_hash) VALUES (?,?,?)", email, name.trim().slice(0, 80) || email, hashPw(password));
  await run("INSERT INTO tenants(id,owner_id,name,hours) VALUES (?,?,?,?)", newId(), u.id, `${name.trim().split(" ")[0] || "My"}'s Business`, JSON.stringify(DEFAULT_HOURS));
  return { ok: true, userId: u.id };
}
export async function login(email: string, password: string): Promise<number | null> {
  const u = await get<{ id: number; pass_hash: string }>("SELECT id,pass_hash FROM users WHERE email=?", email.trim().toLowerCase());
  // Verify against a dummy hash when the user is missing so timing does not reveal registered emails.
  const ok = verifyPw(password, u?.pass_hash ?? hashPw("x"));
  return u && ok ? u.id : null;
}
export async function startSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  await run("INSERT INTO sessions(token,user_id,expires_at) VALUES (?,?,?)", token, userId, Date.now() + 7 * 864e5);
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 86400 });
}
export async function endSession() {
  const c = await cookies(); const t = c.get(COOKIE)?.value;
  if (t) await run("DELETE FROM sessions WHERE token=?", t);
  c.delete(COOKIE);
}

export type Ctx = { user: { id: number; email: string; name: string }; tenant: Tenant; isAdmin: boolean };
async function getCtx(): Promise<Ctx | null> {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  const s = await get<{ user_id: number; expires_at: number }>("SELECT user_id,expires_at FROM sessions WHERE token=?", t);
  if (!s || s.expires_at < Date.now()) return null;
  const user = await get<Ctx["user"]>("SELECT id,email,name FROM users WHERE id=?", s.user_id);
  const tenant = user && await get<Tenant>("SELECT * FROM tenants WHERE owner_id=?", user.id);
  if (!user || !tenant) return null;
  return { user, tenant: (await tenantById(tenant.id))!, isAdmin: !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL.toLowerCase() };
}
export async function requireCtx(): Promise<Ctx> {
  const c = await getCtx();
  if (!c) redirect("/login");
  return c;
}
