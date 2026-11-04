"use client";
import { useRef, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export const toast = (message: string, kind: "ok" | "err" = "ok") => window.dispatchEvent(new CustomEvent("dv:toast", { detail: { message, kind } }));
export type ActionResult = void | { ok?: boolean; message?: string; error?: string };

/**
 * Submits a server action without a full page reload: shows a toast, closes any enclosing modal,
 * resets the form (optional) and refreshes server data. Actions may return {message} or {error}.
 */
export default function ActionForm({ action, children, className, success = "Saved", reset = false, closeModal = true }: {
  action: (fd: FormData) => Promise<ActionResult>; children: ReactNode; className?: string; success?: string; reset?: boolean; closeModal?: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} className={className} aria-busy={pending} onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      if (submitter?.name) fd.set(submitter.name, submitter.value);
      start(async () => {
        try {
          const r = await action(fd);
          if (r && (r.error || r.ok === false)) { toast(r.error ?? "Something went wrong", "err"); return; }
          toast((r && r.message) || success);
          if (reset) ref.current?.reset();
          if (closeModal) window.dispatchEvent(new Event("dv:close-modal"));
          router.refresh();
        } catch (err: any) {
          if (String(err?.digest ?? err?.message).includes("NEXT_REDIRECT")) throw err; // let Next follow the redirect
          toast("Something went wrong", "err");
        }
      });
    }}>
      <fieldset disabled={pending} style={{ border: 0, padding: 0, margin: 0, display: "contents" }}>{children}</fieldset>
    </form>
  );
}
