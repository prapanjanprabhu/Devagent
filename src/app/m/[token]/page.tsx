import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { get, tenantById, type Booking } from "@/lib/db";
import { setStatus } from "@/lib/booking";
import { Mark } from "@/components/icons";
import { Status } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your booking" };

/** A customer's own booking, reached through an unguessable signed link sent over WhatsApp. */
export default async function Manage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const b = await get<Booking & { service_name: string }>("SELECT b.*, s.name AS service_name FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.token=?", token);
  if (!b) notFound();
  const t = (await tenantById(b.tenant_id))!;
  async function cancel() {
    "use server";
    const cur = await get<Booking>("SELECT * FROM bookings WHERE token=?", token);
    if (cur && ["confirmed", "pending_deposit"].includes(cur.status)) await setStatus((await tenantById(cur.tenant_id))!, cur.id, "cancelled");
    revalidatePath(`/m/${token}`);
  }
  const active = b.status === "confirmed" || b.status === "pending_deposit";
  return (
    <div className="centered" id="content"><div className="card">
      <div className="row"><Mark /><b>{t.name}</b></div>
      <div><h2>{b.service_name}</h2><p className="muted">{b.start.replace("T", " at ")}</p></div>
      <div className="row"><span className="muted">Status</span><Status s={b.status} /></div>
      {active && <form action={cancel}><button className="btn bad block">Cancel this booking</button></form>}
      <a className="btn ghost block" href={`/book/${t.id}`}>Book again</a>
    </div></div>
  );
}
