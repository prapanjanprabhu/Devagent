"use client";
import { cloneElement, isValidElement, useEffect, useRef, type ReactElement, type ReactNode } from "react";
import { Icon } from "./icons";

/** Native <dialog> (focus trap + Esc for free). Closes when any ActionForm inside it reports success. */
export default function Modal({ trigger, title, children, defaultOpen = false, width }: { trigger: ReactNode; title: string; children: ReactNode; defaultOpen?: boolean; width?: number }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (defaultOpen && !d.open) d.showModal();
    const close = () => d.open && d.close();
    window.addEventListener("dv:close-modal", close);
    return () => window.removeEventListener("dv:close-modal", close);
  }, [defaultOpen]);
  const open = () => ref.current?.showModal();
  const t = isValidElement(trigger) ? cloneElement(trigger as ReactElement<any>, { onClick: open, type: "button" }) : trigger;
  return (
    <>
      {t}
      <dialog ref={ref} className="dlg" style={width ? { width: `min(${width}px,calc(100vw - 24px))` } : undefined}
        onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }} aria-label={title}>
        <div className="dlg-h"><h3>{title}</h3><button type="button" className="ibtn" aria-label="Close" onClick={() => ref.current?.close()}><Icon n="x" /></button></div>
        {children}
      </dialog>
    </>
  );
}
