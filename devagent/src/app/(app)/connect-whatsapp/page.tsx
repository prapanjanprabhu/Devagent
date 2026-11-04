import { requireCtx } from "@/lib/auth";
import ActionForm from "@/components/ActionForm";
import CopyButton from "@/components/CopyButton";
import { Field, PageHeader } from "@/components/ui";
import { connectWhatsAppAction } from "../actions";

export default async function Connect() {
  const { tenant: t } = await requireCtx();
  const base = process.env.BASE_URL || "http://localhost:3000", verify = process.env.WA_VERIFY_TOKEN || "devagent-verify";
  const st = (ok: boolean, a = "Connected", b = "Not connected") => <span className={`badge ${ok ? "ok" : "warn"}`}>{ok ? a : b}</span>;
  return (
    <>
      <PageHeader title="Connect" sub="Your number, your bank account - Devagent takes no commission." />
      <ActionForm action={connectWhatsAppAction} className="bento g3" success="Connection settings saved">
        <section className="card card-b col">
          <div className="row between"><h3>WhatsApp</h3>{st(!!t.wa_phone_id)}</div>
          <p className="sm muted">In Meta&apos;s developer console add a WhatsApp number, set the webhook, subscribe to <code>messages</code>.</p>
          <div className="f"><label>Webhook URL</label><div className="row"><code className="sm grow1" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{base}/api/whatsapp</code><CopyButton text={`${base}/api/whatsapp`} /></div></div>
          <div className="f"><label>Verify token</label><div className="row"><code className="sm grow1">{verify}</code><CopyButton text={verify} /></div></div>
          <Field label="Phone-number ID"><input name="wa_phone_id" defaultValue={t.wa_phone_id ?? ""} /></Field>
          <Field label="Access token" hint={t.wa_token ? "Saved - leave blank to keep" : undefined}><input name="wa_token" type="password" autoComplete="off" /></Field>
        </section>
        <section className="card card-b col">
          <div className="row between"><h3>Razorpay</h3>{st(!!(t.rz_key_id && t.rz_key_secret))}</div>
          <p className="sm muted">Deposits are charged on your own account and settle straight to your bank.</p>
          <Field label="Key ID"><input name="rz_key_id" defaultValue={t.rz_key_id ?? ""} /></Field>
          <Field label="Key secret" hint={t.rz_key_secret ? "Saved - leave blank to keep" : undefined}><input name="rz_key_secret" type="password" autoComplete="off" /></Field>
        </section>
        <section className="card card-b col">
          <div className="row between"><h3>Call Rescue</h3>{st(!!t.rescue_number, "Active", "Off")}</div>
          <p className="sm muted">Point your telephony provider&apos;s missed-call event here with header <code>x-rescue-secret</code> and body <code>{"{to, from}"}</code>.</p>
          <div className="f"><label>Webhook URL</label><div className="row"><code className="sm grow1" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{base}/api/calls/missed</code><CopyButton text={`${base}/api/calls/missed`} /></div></div>
          <Field label="Rescue number" hint="As your provider reports it"><input name="rescue_number" defaultValue={t.rescue_number ?? ""} /></Field>
          <div style={{ marginTop: "auto" }}><button className="btn block">Save connections</button></div>
        </section>
      </ActionForm>
      <p className="sm muted" style={{ marginTop: 12 }}>Google Calendar two-way sync is not part of this build.</p>
    </>
  );
}
