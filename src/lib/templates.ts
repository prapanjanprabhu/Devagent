import { all, get, run, tx, DEFAULT_HOURS, type Tenant } from "./db";

export type Draft = {
  vertical: string; modules: string[]; hours?: Record<string, [string, string] | null>;
  services: { name: string; duration_min: number; price: number | null; deposit: number; spots: number }[];
  products: { name: string; price: number | null; stock: number | null }[];
  answers: { q: string; a: string }[];
};

export const VERTICALS: Record<string, { label: string; modules: string[]; keywords: string[]; services: Draft["services"]; products: Draft["products"] }> = {
  salon: { label: "Salon / barber / spa", modules: ["appointments"], keywords: ["salon", "barber", "spa", "hair", "beauty", "nail", "tattoo", "massage"],
    services: [{ name: "Haircut", duration_min: 30, price: null, deposit: 0, spots: 1 }, { name: "Colouring", duration_min: 90, price: null, deposit: 0, spots: 1 }], products: [] },
  clinic: { label: "Clinic / dentist / therapist", modules: ["appointments"], keywords: ["clinic", "doctor", "dentist", "dental", "physio", "therapist", "psycholog", "medical"],
    services: [{ name: "Consultation", duration_min: 30, price: null, deposit: 0, spots: 1 }], products: [] },
  fitness: { label: "Gym / studio / classes", modules: ["appointments", "classes"], keywords: ["gym", "yoga", "fitness", "pilates", "dance", "class", "coaching", "tutor", "school"],
    services: [{ name: "Group class", duration_min: 60, price: null, deposit: 0, spots: 15 }], products: [] },
  restaurant: { label: "Restaurant / cloud kitchen / bakery", modules: ["commerce", "appointments"], keywords: ["restaurant", "cafe", "kitchen", "bakery", "food", "catering", "pizza"],
    services: [{ name: "Table reservation", duration_min: 90, price: 0, deposit: 0, spots: 1 }], products: [{ name: "Sample item", price: null, stock: null }] },
  shop: { label: "Shop / boutique / florist", modules: ["commerce"], keywords: ["shop", "store", "boutique", "florist", "flower", "electronics", "retail"],
    services: [], products: [{ name: "Sample product", price: null, stock: null }] },
  repair: { label: "Repair / cleaning / consultant", modules: ["leadgen", "appointments"], keywords: ["repair", "cleaning", "consult", "plumb", "electric", "agent", "estate", "car wash", "driving"],
    services: [{ name: "Site visit / consultation", duration_min: 60, price: null, deposit: 0, spots: 1 }], products: [] },
  general: { label: "Any business", modules: ["appointments"], keywords: [], services: [{ name: "Appointment", duration_min: 30, price: null, deposit: 0, spots: 1 }], products: [] },
};

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Deterministic fallback for "describe your business". Never invents prices - only numbers the owner typed next to a service name. */
export function draftFromDescription(text: string): Draft {
  const low = text.toLowerCase();
  const vKey = Object.keys(VERTICALS).find((k) => VERTICALS[k].keywords.some((w) => low.includes(w))) ?? "general";
  const v = VERTICALS[vKey];
  const services = v.services.map((s) => ({ ...s }));
  // "Haircut 400", "colouring from 2000"
  const prices = [...text.matchAll(/([A-Za-z][A-Za-z &]{2,30}?)\s+(?:from\s+|at\s+|for\s+|[-:@]\s*)?(?:rs\.?|₹|\$)?\s*(\d{2,6})\b/gi)];
  for (const m of prices) {
    const name = m[1].trim().replace(/^(and|with|open|closed)\s+/i, ""); const price = Number(m[2]);
    if (/\b(am|pm|min|mins|seats?|chairs?|open|closed)\b/i.test(name) || !name) continue;
    const hit = services.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (hit) hit.price = price; else if (vKey !== "shop" && vKey !== "restaurant") services.push({ name: name[0].toUpperCase() + name.slice(1), duration_min: 30, price, deposit: 0, spots: 1 });
  }
  let hours: Draft["hours"];
  const hm = low.match(/(\d{1,2})\s*(am|pm)?\s*[-–to]+\s*(\d{1,2})\s*(am|pm)/);
  if (hm) {
    const to24 = (h: number, ap?: string) => (ap === "pm" && h < 12 ? h + 12 : ap === "am" && h === 12 ? 0 : h);
    const o = to24(Number(hm[1]), hm[2] ?? hm[4]), c = to24(Number(hm[3]), hm[4]);
    if (o < c) {
      const fmt = (n: number) => `${String(n).padStart(2, "0")}:00`;
      hours = {}; DAYS.forEach((_, i) => (hours![String(i)] = [fmt(o), fmt(c)]));
      DAYS.forEach((d, i) => { if (new RegExp(`closed[^.]*\\b${d}`).test(low)) hours![String(i)] = null; });
    }
  }
  return { vertical: vKey, modules: v.modules, hours, services, products: v.products.map((p) => ({ ...p })), answers: [] };
}

export function applyDraft(t: Tenant, d: Draft) {
  tx(() => {
    run("UPDATE tenants SET vertical=?, modules=?, hours=? WHERE id=?", d.vertical, JSON.stringify(d.modules), JSON.stringify(d.hours ?? JSON.parse(t.hours) ?? DEFAULT_HOURS), t.id);
    run("DELETE FROM services WHERE tenant_id=? AND id NOT IN (SELECT service_id FROM bookings WHERE tenant_id=?)", t.id, t.id);
    for (const s of d.services) run("INSERT INTO services(tenant_id,name,duration_min,price,deposit,spots) VALUES (?,?,?,?,?,?)", t.id, s.name.slice(0, 80), s.duration_min, s.price, s.deposit, s.spots);
    for (const p of d.products) run("INSERT INTO products(tenant_id,name,price,stock) VALUES (?,?,?,?)", t.id, p.name.slice(0, 80), p.price, p.stock);
    for (const a of d.answers) run("INSERT INTO knowledge(tenant_id,q,a) VALUES (?,?,?)", t.id, a.q.slice(0, 200), a.a.slice(0, 1000));
  });
}
export { all, get };
