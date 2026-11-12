import Link from "next/link";
import { redirect } from "next/navigation";
import { signup, startSession } from "@/lib/auth";
import AuthShell from "@/components/AuthShell";
import { Field } from "@/components/ui";
import { ipLimitedAction } from "../login/guard";

async function doSignup(fd: FormData) {
  "use server";
  if (await ipLimitedAction("signup", 10)) redirect("/signup?error=" + encodeURIComponent("Too many attempts. Try again later."));
  const r = signup(String(fd.get("name") ?? ""), String(fd.get("email") ?? ""), String(fd.get("password") ?? ""));
  if (!r.ok) redirect("/signup?error=" + encodeURIComponent(r.error));
  await startSession(r.userId);
  redirect("/onboarding");
}

export const metadata = { title: "Create account" };
export default async function Signup({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthShell title="Start free" sub="No card needed. Live in minutes.">
      <form action={doSignup} className="col" style={{ gap: 14 }}>
        <Field label="Your name"><input name="name" required autoFocus autoComplete="name" /></Field>
        <Field label="Email"><input name="email" type="email" required autoComplete="email" /></Field>
        <Field label="Password" hint="6+ characters"><input name="password" type="password" minLength={6} required autoComplete="new-password" /></Field>
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn l block">Create account</button>
      </form>
      <p className="sm muted">Already registered? <Link href="/login" className="strong" style={{ color: "var(--brand)" }}>Log in</Link></p>
    </AuthShell>
  );
}
