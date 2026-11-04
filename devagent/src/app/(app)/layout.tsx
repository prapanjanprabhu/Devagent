import { redirect } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import { get, hasModule } from "@/lib/db";
import { nowLocal } from "@/lib/booking";
import { PLANS, actionsThisMonth } from "@/lib/plans";
import Shell, { type NavItem } from "@/components/Shell";
import { Icon } from "@/components/icons";
import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { tenant: t, isAdmin, user } = await requireCtx();
  if (!t.onboarded) redirect("/onboarding");
  const c = (sql: string, ...a: any[]) => get<{ c: number }>(sql, t.id, ...a)!.c;
  const bookable = hasModule(t, "appointments") || hasModule(t, "classes");
  const attention = c("SELECT COUNT(*) c FROM bookings WHERE tenant_id=? AND ((status='confirmed' AND start<?) OR status='pending_deposit')", nowLocal());
  const newOrders = c("SELECT COUNT(*) c FROM orders WHERE tenant_id=? AND status='new'");
  const openEnq = c("SELECT COUNT(*) c FROM enquiries WHERE tenant_id=? AND stage IN ('new','contacted')");
  const nav: NavItem[] = [
    { href: "/dashboard", label: "Overview", icon: "home", group: "Workspace" },
    { href: "/conversations", label: "Chats", icon: "chat", group: "Workspace" },
    ...(bookable ? [{ href: "/calendar", label: "Calendar", icon: "cal", group: "Workspace", count: attention }] : []),
    ...(hasModule(t, "commerce") ? [{ href: "/orders", label: "Orders", icon: "bag", group: "Business", count: newOrders }] : []),
    ...(hasModule(t, "leadgen") ? [{ href: "/pipeline", label: "Pipeline", icon: "funnel", group: "Business", count: openEnq }] : []),
    ...(bookable ? [{ href: "/classes", label: "Classes & packs", icon: "grid", group: "Business" }] : []),
    { href: "/customers", label: "Customers", icon: "users", group: "Business" },
    { href: "/campaigns", label: "Campaigns", icon: "mega", group: "Growth" },
    { href: "/grow", label: "Grow agent", icon: "spark", group: "Growth" },
    { href: "/analytics", label: "Analytics", icon: "chart", group: "Growth" },
    { href: "/business-setup", label: "Business setup", icon: "sliders", group: "Configure" },
    { href: "/agent-config", label: "AI agent", icon: "bot", group: "Configure" },
    { href: "/connect-whatsapp", label: "Connect", icon: "link", group: "Configure" },
    { href: "/billing", label: "Plans & credits", icon: "card", group: "Configure" },
    ...(isAdmin ? [{ href: "/admin", label: "Platform admin", icon: "shield", group: "Configure" }] : []),
  ];
  const quick = [
    ...(bookable ? [{ label: "New booking", href: "/calendar?add=1", icon: "cal", group: "Create", kw: "walk-in appointment" }, { label: "Block time off", href: "/calendar?block=1", icon: "clock", group: "Create" }] : []),
    ...(hasModule(t, "commerce") ? [{ label: "New order", href: "/orders?add=1", icon: "bag", group: "Create" }] : []),
    ...(hasModule(t, "leadgen") ? [{ label: "New enquiry", href: "/pipeline?add=1", icon: "funnel", group: "Create" }] : []),
    { label: "Send a campaign", href: "/campaigns", icon: "mega", group: "Create", kw: "broadcast whatsapp" },
    { label: "Add a service", href: "/business-setup?add=service", icon: "plus", group: "Create" },
  ];
  const cap = PLANS[t.plan].actionCap;
  return (
    <Shell nav={nav} quick={quick} user={user.name} plan={`${PLANS[t.plan].label} plan`} usage={{ used: actionsThisMonth(t.id), cap: cap === Infinity ? null : cap }} publicUrl={`/book/${t.id}`}
      logout={<form action={logoutAction}><button className="ibtn" aria-label="Log out" title="Log out" style={{ background: "transparent", border: "1px solid var(--ink-line)", color: "#fff" }}><Icon n="out" className="sm" /></button></form>}>
      {children}
    </Shell>
  );
}
