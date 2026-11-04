import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { hasModule, tenantById } from "@/lib/db";
import { activeServices } from "@/lib/booking";
import { activeProducts } from "@/lib/commerce";
import { Icon, Mark } from "@/components/icons";
import BookForm from "./BookForm";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ tid: string }> }): Promise<Metadata> {
  const t = tenantById((await params).tid);
  return { title: t ? `Book with ${t.name}` : "Not found" };
}

export default async function PublicPage({ params }: { params: Promise<{ tid: string }> }) {
  const t = tenantById((await params).tid);
  if (!t) notFound();
  const bookable = hasModule(t, "appointments") || hasModule(t, "classes");
  const services = bookable ? activeServices(t.id) : [], products = hasModule(t, "commerce") ? activeProducts(t.id) : [];
  const hours = JSON.parse(t.hours) as Record<string, [string, string] | null>;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <div className="pub">
      <aside className="pub-side">
        <div className="row"><Mark /><b style={{ fontSize: 17 }}>{t.name}</b></div>
        <div>
          <h1 style={{ fontSize: 34, letterSpacing: "-.03em", lineHeight: 1.1 }}>Book in under a minute.</h1>
          <p style={{ color: "var(--ink-text)", marginTop: 10, maxWidth: 360 }}>Pick a service, choose a time, and you&apos;re set. We&apos;ll remind you on WhatsApp before your visit.</p>
          <div className="col" style={{ marginTop: 22, gap: 6, color: "var(--ink-text)" }}>
            <div className="row sm"><Icon n="clock" className="sm" /><b style={{ color: "#fff" }}>Opening hours</b></div>
            {days.map((d, i) => <div key={d} className="row between sm" style={{ maxWidth: 260 }}><span>{d}</span><span style={{ color: hours[i] ? "#fff" : undefined }}>{hours[i] ? hours[i]!.join(" – ") : "Closed"}</span></div>)}
          </div>
        </div>
        <span className="tiny" style={{ color: "var(--ink-text)" }}>Powered by Devagent</span>
      </aside>
      <main className="pub-main" id="content"><BookForm tid={t.id} services={services} products={products} /></main>
      <script src="/widget.js" data-tenant={t.id} defer />
    </div>
  );
}
