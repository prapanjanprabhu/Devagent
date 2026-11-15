import Link from "next/link";
import { redirect } from "next/navigation";
import { login, startSession } from "@/lib/auth";
import AuthShell from "@/components/AuthShell";
import { Field } from "@/components/ui";
import { ipLimitedAction } from "./guard";

async function doLogin(fd: FormData) {
  "use server";
  if (await ipLimitedAction("login", 10)) redirect("/login?error=" + encodeURIComponent("Too many attempts. Try again in 15 minutes."));
  const id = await login(String(fd.get("email") ?? ""), String(fd.get("password") ?? ""));
  if (!id) redirect("/login?error=" + encodeURIComponent("Wrong email or password."));
  await startSession(id);
  redirect("/dashboard");
}

export const metadata = { title: "Log in" };
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthShell title="Welcome back" sub="Log in to your front desk.">
      <form action={doLogin} className="col" style={{ gap: 14 }}>
        <Field label="Email"><input name="email" type="email" required autoFocus autoComplete="email" /></Field>
        <Field label="Password"><input name="password" type="password" required autoComplete="current-password" /></Field>
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn l block">Log in</button>
      </form>
      <p className="sm muted">New to Devagent? <Link href="/signup" className="strong" style={{ color: "var(--brand)" }}>Create a free account</Link></p>
    </AuthShell>
  );
}
