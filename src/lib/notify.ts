import { get, run, tenantById } from "./db";

const digits = (p: string) => p.replace(/\D/g, "");
export const isPlaceholderPhone = (p: string) => /^0+$/.test(digits(p));

/**
 * Queue a message for a customer. Always logged to the outbox; sent through the WhatsApp Cloud API when the
 * tenant (or the platform env) has credentials. Marketing messages skip customers who opted out.
 */
export function notify(tenantId: string, phone: string, body: string, kind: "transactional" | "marketing" = "transactional"): boolean {
  if (isPlaceholderPhone(phone)) return false; // walk-ins entered without a number: nobody to message
  if (kind === "marketing") {
    const c = get<{ opted_in: number }>("SELECT opted_in FROM customers WHERE tenant_id=? AND phone=?", tenantId, phone);
    if (c && !c.opted_in) return false;
  }
  const id = run("INSERT INTO outbox(tenant_id,phone,body,kind) VALUES (?,?,?,?)", tenantId, phone, body, kind).id;
  const t = tenantById(tenantId);
  const token = t?.wa_token || process.env.WA_TOKEN, phoneId = t?.wa_phone_id || process.env.WA_PHONE_ID;
  if (token && phoneId) {
    void sendWhatsApp(phoneId, token, phone, body).then((ok) => ok && run("UPDATE outbox SET delivered=1 WHERE id=?", id));
  }
  return true;
}

export async function sendWhatsApp(phoneId: string, token: string, to: string, body: string): Promise<boolean> {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(phoneId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: digits(to), type: "text", text: { body } }),
    });
    return res.ok;
  } catch { return false; }
}
