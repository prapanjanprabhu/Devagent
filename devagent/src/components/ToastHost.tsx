"use client";
import { useEffect, useState } from "react";
import { Icon } from "./icons";

type T = { id: number; message: string; kind: "ok" | "err" };
export default function ToastHost() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const { message, kind } = (e as CustomEvent).detail, id = ++n;
      setItems((x) => [...x.slice(-3), { id, message, kind }]);
      setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3600);
    };
    window.addEventListener("dv:toast", on);
    return () => window.removeEventListener("dv:toast", on);
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => <div key={t.id} className={`toast ${t.kind === "err" ? "err" : ""}`}><Icon n={t.kind === "err" ? "alert" : "check"} />{t.message}</div>)}
    </div>
  );
}
