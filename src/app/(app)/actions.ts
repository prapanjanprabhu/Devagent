"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCtx, endSession } from "@/lib/auth";
import { get, run } from "@/lib/db";
import { addBlock, confirmDeposit, createBooking, moveBooking, setStatus, cleanPhone } from "@/lib/booking";
import { createOrder, setEnquiryStage, setOrderStatus, captureEnquiry } from "@/lib/commerce";
import { sendCampaign, findOpportunities, optOut, SEGMENTS, type Segment } from "@/lib/crm";
import { notify } from "@/lib/notify";
import { PLANS } from "@/lib/plans";
import { applyDraft, draftFromDescription, VERTICALS } from "@/lib/templates";
import { aiDraft } from "@/lib/agent";

const s = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? "").trim().slice(0, max);
const n = (fd: FormData, k: string) => { const v = s(fd, k, 20); return v === "" ? null : Number(v); };
const nonNeg = (v: number | null) => (v === null || Number.isNaN(v) ? null : Math.max(0, v));
const rv = (p: string) => revalidatePath(p);

export async function logoutAction() { await endSession(); redirect("/login"); }

// ----- calendar -----
export async function bookingStatusAction(fd: FormData) {
  const { tenant } = await requireCtx(); const st = s(fd, "status") as "confirmed" | "completed" | "cancelled" | "no_show";
  if (["confirmed", "completed", "cancelled", "no_show"].includes(st)) await setStatus(tenant, Number(fd.get("id")), st);
  rv("/calendar"); rv("/dashboard");
}
export async function depositReceivedAction(fd: FormData) { const { tenant } = await requireCtx(); await confirmDeposit(tenant.id, Number(fd.get("id"))); rv("/calendar"); }
export async function moveBookingAction(fd: FormData) { const { tenant } = await requireCtx(); const r = await moveBooking(tenant, Number(fd.get("id")), s(fd, "start")); rv("/calendar"); return r.ok ? { message: "Booking moved" } : { error: r.error ?? "Could not move" }; }
export async function walkInAction(fd: FormData) {
  const { tenant } = await requireCtx();
  const r = await createBooking(tenant, { serviceId: Number(fd.get("service")), start: s(fd, "start"), name: s(fd, "name") || "Walk-in", phone: s(fd, "phone") || "0000000000", channel: "cockpit" });
  rv("/calendar"); rv("/dashboard");
  return r.ok ? { message: "Booking added" } : { error: r.error };
}
export async function blockTimeAction(fd: FormData) { const { tenant } = await requireCtx(); if (!await addBlock(tenant.id, s(fd, "start"), s(fd, "end"), s(fd, "reason"))) return { error: "End must be after start" }; rv("/calendar"); return { message: "Time blocked" }; }
export async function removeBlockAction(fd: FormData) { const { tenant } = await requireCtx(); await run("DELETE FROM blocks WHERE id=? AND tenant_id=?", Number(fd.get("id")), tenant.id); rv("/calendar"); }

// ----- orders / pipeline / customers / packs -----
export async function orderStatusAction(fd: FormData) { const { tenant } = await requireCtx(); await setOrderStatus(tenant.id, Number(fd.get("id")), s(fd, "status"), fd.get("paid") ? true : undefined); rv("/orders"); }
export async function addProductAction(fd: FormData) {
  const { tenant } = await requireCtx(); if (!s(fd, "name")) return;
  await run("INSERT INTO products(tenant_id,name,price,stock) VALUES (?,?,?,?)", tenant.id, s(fd, "name", 80), nonNeg(n(fd, "price")), nonNeg(n(fd, "stock"))); rv("/orders");
}
export async function toggleProductAction(fd: FormData) { const { tenant } = await requireCtx(); await run("UPDATE products SET active=1-active WHERE id=? AND tenant_id=?", Number(fd.get("id")), tenant.id); rv("/orders"); }
export async function walkInOrderAction(fd: FormData) {
  const { tenant } = await requireCtx();
  try {
    const r = await createOrder(tenant, { phone: s(fd, "phone") || "0000000000", name: s(fd, "name"), items: [{ product_id: Number(fd.get("product")), qty: Number(fd.get("qty")) || 1 }], channel: "cockpit" });
    rv("/orders"); return r.ok ? { message: "Order added" } : { error: r.error };
  } catch (e: any) { return { error: String(e?.message ?? "Could not add order") }; }
}
export async function stageAction(fd: FormData) { const { tenant } = await requireCtx(); await setEnquiryStage(tenant.id, Number(fd.get("id")), s(fd, "stage")); rv("/pipeline"); }
export async function addEnquiryAction(fd: FormData) {
  const { tenant } = await requireCtx(); await captureEnquiry(tenant, { phone: s(fd, "phone") || "0000000000", name: s(fd, "name"), summary: s(fd, "summary", 1000), value: n(fd, "value") ?? 0 }); rv("/pipeline");
}
export async function optOutAction(fd: FormData) { const { tenant } = await requireCtx(); await optOut(tenant.id, s(fd, "phone")); rv("/customers"); }
export async function sellPackAction(fd: FormData) {
  const { tenant } = await requireCtx(); const p = await get<{ sessions: number }>("SELECT sessions FROM packs WHERE id=? AND tenant_id=?", Number(fd.get("pack")), tenant.id);
  if (p && s(fd, "phone")) await run("INSERT INTO customer_packs(tenant_id,phone,pack_id,remaining,paid) VALUES (?,?,?,?,1)", tenant.id, cleanPhone(s(fd, "phone")), Number(fd.get("pack")), p.sessions);
  rv("/classes");
}

// ----- campaigns / grow -----
export async function campaignAction(fd: FormData) {
  const { tenant } = await requireCtx(); const seg = s(fd, "segment") as Segment;
  if (!(seg in SEGMENTS)) return { error: "Pick a segment" };
  const r = await sendCampaign(tenant, s(fd, "name", 80), s(fd, "body", 1000), seg);
  rv("/campaigns"); return r.ok ? { message: `Queued to ${r.sent} customers` } : { error: r.error };
}
export async function sendOpportunityAction(fd: FormData) {
  const { tenant } = await requireCtx();
  if (!PLANS[tenant.plan].growth) return;
  const o = (await findOpportunities(tenant)).find((x) => x.key === s(fd, "key"));
  if (o) {
    await notify(tenant.id, o.phone, o.draft, "marketing");
    if (o.key.startsWith("rev:")) await run("UPDATE bookings SET review_asked=1 WHERE tenant_id=? AND phone=? AND status='completed'", tenant.id, o.phone);
  }
  rv("/grow");
}

// ----- business setup -----
export async function saveProfileAction(fd: FormData) {
  const { tenant } = await requireCtx();
  const mods = ["appointments", "commerce", "leadgen", "classes"].filter((m) => fd.get(`mod_${m}`));
  const link = s(fd, "review_link", 300);
  await run("UPDATE tenants SET name=?, staff=?, modules=?, owner_phone=?, review_link=?, deposit_hold_min=? WHERE id=?",
        s(fd, "name", 80) || tenant.name, Math.max(1, Math.min(50, Number(fd.get("staff")) || 1)), JSON.stringify(mods.length ? mods : ["appointments"]),
        s(fd, "owner_phone", 30) || null, /^https?:\/\//.test(link) ? link : null, Math.max(5, Math.min(1440, Number(fd.get("hold")) || 120)), tenant.id);
  revalidatePath("/", "layout"); return { message: "Business profile saved" };
}
export async function saveHoursAction(fd: FormData) {
  const { tenant } = await requireCtx();
  const hours: Record<string, [string, string] | null> = {};
  for (let d = 0; d < 7; d++) { const o = s(fd, `open${d}`), c = s(fd, `close${d}`); hours[d] = fd.get(`on${d}`) && /^\d\d:\d\d$/.test(o) && /^\d\d:\d\d$/.test(c) && o < c ? [o, c] : null; }
  await run("UPDATE tenants SET hours=? WHERE id=?", JSON.stringify(hours), tenant.id);
  return { message: "Opening hours saved" };
}
export async function addServiceAction(fd: FormData) {
  const { tenant } = await requireCtx(); const name = s(fd, "name", 80), dur = Math.max(5, Math.min(480, Number(fd.get("duration")) || 0));
  if (!name || !dur) return;
  await run("INSERT INTO services(tenant_id,name,duration_min,price,deposit,spots) VALUES (?,?,?,?,?,?)", tenant.id, name, dur, nonNeg(n(fd, "price")), nonNeg(n(fd, "deposit")) ?? 0, Math.max(1, Math.min(500, Number(fd.get("spots")) || 1)));
  rv("/business-setup");
}
export async function toggleServiceAction(fd: FormData) { const { tenant } = await requireCtx(); await run("UPDATE services SET active=1-active WHERE id=? AND tenant_id=?", Number(fd.get("id")), tenant.id); rv("/business-setup"); }
export async function addPackAction(fd: FormData) {
  const { tenant } = await requireCtx(); if (!s(fd, "name")) return;
  await run("INSERT INTO packs(tenant_id,name,sessions,price,service_id) VALUES (?,?,?,?,?)", tenant.id, s(fd, "name", 80), Math.max(1, Number(fd.get("sessions")) || 1), nonNeg(n(fd, "price")) ?? 0, fd.get("service") ? Number(fd.get("service")) : null);
  rv("/business-setup");
}
export async function addAnswerAction(fd: FormData) { const { tenant } = await requireCtx(); if (s(fd, "q") && s(fd, "a", 1000)) await run("INSERT INTO knowledge(tenant_id,q,a) VALUES (?,?,?)", tenant.id, s(fd, "q"), s(fd, "a", 1000)); rv("/agent-config"); }
export async function deleteAnswerAction(fd: FormData) { const { tenant } = await requireCtx(); await run("DELETE FROM knowledge WHERE id=? AND tenant_id=?", Number(fd.get("id")), tenant.id); rv("/agent-config"); }
export async function connectWhatsAppAction(fd: FormData) {
  const { tenant } = await requireCtx();
  await run("UPDATE tenants SET wa_phone_id=?, wa_token=?, rz_key_id=?, rz_key_secret=?, rescue_number=? WHERE id=?",
        s(fd, "wa_phone_id", 40) || null, s(fd, "wa_token", 500) || tenant.wa_token, s(fd, "rz_key_id", 80) || null, s(fd, "rz_key_secret", 120) || tenant.rz_key_secret, s(fd, "rescue_number", 30) || null, tenant.id);
  rv("/connect-whatsapp"); return { message: "Connection settings saved" };
}

// ----- billing: demo activation only when DEV_BILLING=1 (real checkout is not wired) -----
export async function setPlanAction(fd: FormData) {
  const { tenant } = await requireCtx(); const plan = s(fd, "plan");
  if (process.env.DEV_BILLING !== "1" || !(plan in PLANS)) return;
  await run("UPDATE tenants SET plan=? WHERE id=?", plan, tenant.id); revalidatePath("/", "layout"); return { message: `Switched to ${PLANS[plan as keyof typeof PLANS].label}` };
}
export async function addCreditsAction() { const { tenant } = await requireCtx(); if (process.env.DEV_BILLING === "1") await run("UPDATE tenants SET credits=credits+100 WHERE id=?", tenant.id); rv("/billing"); return { message: "Added 100 credits" }; }

// ----- conversations -----
export async function replyAction(fd: FormData) {
  const { tenant } = await requireCtx(); const phone = s(fd, "phone", 30), body = s(fd, "body", 1000);
  if (!body) return;
  await run("INSERT INTO chat_messages(tenant_id,phone,role,content) VALUES (?,?,?,?)", tenant.id, phone, "assistant", body);
  await notify(tenant.id, phone, body); rv("/conversations"); return { message: "Reply sent" };
}

// ----- onboarding -----
export async function draftAction(fd: FormData) {
  const { tenant } = await requireCtx(); const desc = s(fd, "description", 4000);
  if (!desc) redirect("/onboarding");
  await applyDraft(tenant, (await aiDraft(desc)) ?? draftFromDescription(desc));
  await run("UPDATE tenants SET name=COALESCE(NULLIF(?,''),name), onboarded=1 WHERE id=?", s(fd, "name", 80), tenant.id);
  redirect("/business-setup?drafted=1");
}
export async function skipOnboardingAction(fd: FormData) {
  const { tenant } = await requireCtx(); const v = s(fd, "vertical", 20), k = v in VERTICALS ? v : "general";
  await applyDraft(tenant, { vertical: k, modules: VERTICALS[k].modules, services: VERTICALS[k].services, products: VERTICALS[k].products, answers: [] });
  await run("UPDATE tenants SET name=COALESCE(NULLIF(?,''),name), onboarded=1 WHERE id=?", s(fd, "name", 80), tenant.id);
  redirect("/dashboard");
}
