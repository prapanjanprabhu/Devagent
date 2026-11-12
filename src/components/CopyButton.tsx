"use client";
import { Icon } from "./icons";
import { toast } from "./ActionForm";

export default function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  return (
    <button type="button" className="btn ghost s" onClick={async () => { try { await navigator.clipboard.writeText(text); toast("Copied to clipboard"); } catch { toast("Copy failed - select and copy manually", "err"); } }}>
      <Icon n="copy" className="sm" />{label}
    </button>
  );
}
