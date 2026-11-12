import type { ReactNode } from "react";
import { Icon } from "./icons";

export const PageHeader = ({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) => (
  <div className="page-h"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{children && <div className="row wrap">{children}</div>}</div>
);
export const Empty = ({ icon = "inbox", title, children }: { icon?: string; title: string; children?: ReactNode }) => (
  <div className="empty"><Icon n={icon} /><b>{title}</b>{children && <span>{children}</span>}</div>
);
export const Status = ({ s }: { s: string }) => <span className={`badge ${s}`}>{s.replace("_", " ")}</span>;
export const Stat = ({ v, l, icon, dark }: { v: ReactNode; l: string; icon?: string; dark?: boolean }) => (
  <div className={`card stat ${dark ? "dark" : ""}`}><span className="l">{icon && <Icon n={icon} className="sm" />}{l}</span><span className="v num">{v}</span></div>
);
export const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <div className="f"><label>{label}</label>{children}{hint && <span className="hint">{hint}</span>}</div>
);
export const Locked = ({ title, children, href = "/billing", cta = "See plans" }: { title: string; children: ReactNode; href?: string; cta?: string }) => (
  <div className="card"><Empty icon="shield" title={title}>{children}</Empty><div style={{ textAlign: "center", paddingBottom: 24 }}><a className="btn" href={href}>{cta}</a></div></div>
);
export const Bar = ({ label, v, max }: { label: string; v: number; max: number }) => (
  <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 34px", gap: 10, alignItems: "center", margin: "7px 0" }}>
    <span className="sm muted" style={{ textTransform: "capitalize" }}>{label.replace("_", " ")}</span>
    <div className="meter"><i style={{ width: `${max ? (v / max) * 100 : 0}%` }} /></div><b className="num sm" style={{ textAlign: "right" }}>{v}</b>
  </div>
);
