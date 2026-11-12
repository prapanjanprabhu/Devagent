import { requireCtx } from "@/lib/auth";
import { VERTICALS } from "@/lib/templates";
import { Mark } from "@/components/icons";
import ActionForm from "@/components/ActionForm";
import { Field } from "@/components/ui";
import { draftAction, skipOnboardingAction } from "../(app)/actions";

export const metadata = { title: "Set up your business" };
export default async function Onboarding() {
  await requireCtx();
  const ai = !!process.env.ANTHROPIC_API_KEY;
  return (
    <div className="centered">
      <div style={{ width: "min(760px,100%)", display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="row"><Mark /><b style={{ fontSize: 17 }}>Devagent</b></div>
        <div><h1 style={{ fontSize: 28 }}>Let&apos;s set up your front desk</h1><p className="muted">Two minutes. You can change everything later.</p></div>
        <div className="bento g21" style={{ alignItems: "stretch" }}>
          <ActionForm action={draftAction} className="card card-b col" success="Setting up…" closeModal={false}>
            <b>Describe your business</b>
            <p className="sm muted">{ai ? "Claude drafts your services, hours and FAQ." : "A built-in parser drafts your setup (add ANTHROPIC_API_KEY for AI drafting)."} Prices are only filled in when you type them.</p>
            <Field label="Business name"><input name="name" placeholder="Glow Salon" autoFocus /></Field>
            <Field label="About your business"><textarea name="description" rows={4} required placeholder="3-chair unisex salon, open 10am–8pm, closed Sunday. Haircut 400, colouring from 2000." /></Field>
            <button className="btn l">Set up my business</button>
          </ActionForm>
          <ActionForm action={skipOnboardingAction} className="card card-b col" success="Template applied" closeModal={false}>
            <b>Or start from a template</b>
            <Field label="Business name"><input name="name" /></Field>
            <Field label="Type"><select name="vertical">{Object.entries(VERTICALS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
            <button className="btn ghost l" style={{ marginTop: "auto" }}>Use template</button>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}
