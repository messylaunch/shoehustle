import Link from "next/link";
import type { ReactNode } from "react";
import { formatCents } from "@/lib/money";
import { gradeByCode, statusByCode } from "@/lib/constants";

export function Notice({
  kind = "info",
  title,
  children,
}: {
  kind?: "good" | "warn" | "bad" | "info";
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`notice notice-${kind}`}>
      {title ? <strong>{title}</strong> : null}
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const meta = statusByCode(status);
  const kind =
    status === "LISTED"
      ? "good"
      : status === "IN_RESTORATION"
        ? "warn"
        : status === "SOLD"
          ? ""
          : status === "RESERVED"
            ? "info"
            : "";
  return (
    <span className={`badge ${kind ? `badge-${kind}` : ""}`}>
      {meta?.label ?? status}
    </span>
  );
}

export function GradeBadge({ grade }: { grade: string }) {
  const meta = gradeByCode(grade);
  const fresh = grade === "DS" || grade === "VNDS";
  return (
    <span className={`badge ${fresh ? "badge-good" : "badge-info"}`}>
      {meta ? meta.label.split(" — ")[0] : grade}
    </span>
  );
}

export function Money({
  cents,
  className,
}: {
  cents: number | null | undefined;
  className?: string;
}) {
  return (
    <span className={`num ${className ?? ""}`}>{formatCents(cents)}</span>
  );
}

/** Empty-state block, so a blank page always says what to do next. */
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {children ? <div className="muted small">{children}</div> : null}
      {action ? (
        <p style={{ marginTop: "0.8rem", marginBottom: 0 }}>
          <Link className="btn btn-primary" href={action.href}>
            {action.label}
          </Link>
        </p>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}
