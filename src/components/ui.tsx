"use client";

// Shared presentational pieces for every page (light fintech theme, see globals.css).

import type { ReactNode } from "react";
import type { Reason } from "@/lib/signals";

export const cx = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(" ");

export function Spark({ data, up }: { data: number[]; up: boolean }) {
  if (data.length < 2) return <div className="h-7 w-20" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 80},${26 - ((v - min) / (max - min || 1)) * 24}`)
    .join(" ");
  return (
    <svg viewBox="0 0 80 28" className="h-7 w-20" aria-hidden>
      <polyline fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth="1.8" strokeLinecap="round" points={pts} />
    </svg>
  );
}

export function Pill({ side }: { side: "long" | "short" }) {
  return (
    <span
      className={cx(
        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        side === "long" ? "bg-up/12 text-up" : "bg-down/12 text-down",
      )}
    >
      {side}
    </span>
  );
}

export function Bar({ value, color = "var(--accent)" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel2">
      <div className="h-full rounded-full" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, background: color }} />
    </div>
  );
}

/** Dotted progress, echoing the reference's waffle bars. */
export function Dots({ value, color = "var(--accent)" }: { value: number; color?: string }) {
  const on = Math.round(Math.min(1, Math.max(0, value)) * 24);
  return (
    <div className="flex flex-wrap gap-[3px]" aria-hidden>
      {Array.from({ length: 24 }, (_, i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: i < on ? color : "var(--line)" }} />
      ))}
    </div>
  );
}

export function Delta({ v, suffix = "" }: { v: number; suffix?: string }) {
  return (
    <span className={cx("num text-[11px] font-semibold", v >= 0 ? "text-up" : "text-down")}>
      {v >= 0 ? "+" : ""}
      {v.toFixed(2)}%{suffix}
    </span>
  );
}

export const toneColor: Record<Reason["tone"], string> = {
  good: "text-up",
  warn: "text-bolt",
  neutral: "text-muted",
};

export function Card({
  title,
  right,
  children,
  className,
  id,
  tint = "var(--accent)",
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  tint?: string;
}) {
  return (
    <section id={id} className={cx("card", className)}>
      <header className="flex items-center justify-between px-4 pb-1 pt-3.5">
        <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
          <span
            className="h-4 w-4 rounded-md"
            style={{ background: `color-mix(in srgb, ${tint} 18%, white)`, boxShadow: `inset 0 0 0 4px color-mix(in srgb, ${tint} 55%, white)` }}
          />
          {title}
        </h2>
        {right ?? <span className="text-muted">›</span>}
      </header>
      {children}
    </section>
  );
}

export function PageTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Donut({ items }: { items: { label: string; value: number; color: string }[] }) {
  const R = 42;
  const C = 2 * Math.PI * R;
  const arcs = items.reduce<{ label: string; color: string; len: number; off: number }[]>((acc, it) => {
    const off = acc.length ? acc[acc.length - 1].off + acc[acc.length - 1].len : 0;
    return [...acc, { label: it.label, color: it.color, len: C * Math.max(0, it.value), off }];
  }, []);
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
      <circle cx="60" cy="60" r={R} fill="none" stroke="var(--panel-2)" strokeWidth="14" />
      {arcs.map((a) => (
        <circle
          key={a.label}
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke={a.color}
          strokeWidth="14"
          strokeDasharray={`${a.len} ${C - a.len}`}
          strokeDashoffset={-a.off}
        />
      ))}
    </svg>
  );
}

export const DONUT_COLORS = ["#2f6df6", "#e11d6a", "#16a34a", "#f59e0b", "#6d5ef6"];

/** Gate for pages that need live data: shows loading / error / empty states. */
export function Loading({ error, empty }: { error: string | null; empty?: boolean }) {
  if (error) return <div className="card p-4 text-sm text-down">Could not reach Strike: {error}</div>;
  if (empty)
    return (
      <div className="card p-6 text-center text-sm text-muted">
        No liquid markets pass the volume and open-interest filters right now. Data refreshes every 20 seconds.
      </div>
    );
  return <div className="p-10 text-center text-muted">Loading live Strike markets…</div>;
}
