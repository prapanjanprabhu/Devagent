import { notFound } from "next/navigation";
import { get, tenantById, type Booking } from "@/lib/db";
import { Mark } from "@/components/icons";
import { Status } from "@/components/ui";
import PayButton from "./PayButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pay deposit" };

export default async function Pay({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const b = await get<Booking & { service_name: string }>("SELECT b.*, s.name AS service_name FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.token=?", token);
  if (!b) notFound();
  const t = (await tenantById(b.tenant_id))!;
  return (
    <div className="centered" id="content"><div className="card">
      <div className="row"><Mark /><b>{t.name}</b></div>
      <div><h2>{b.service_name}</h2><p className="muted">{b.start.replace("T", " at ")}</p></div>
      {b.status === "pending_deposit" ? (<>
        <div className="card card-b row between"><span className="muted">Deposit due</span><b style={{ fontSize: 22 }} className="num">{b.deposit_due}</b></div>
        {t.rz_key_id ? <PayButton token={token} name={b.customer_name} /> : <div className="notice">Online payment isn&apos;t enabled for this business. Please pay them directly - they can mark your deposit as received.</div>}
      </>) : <div className="row"><span className="muted">Status</span><Status s={b.status} /></div>}
    </div></div>
  );
}
