"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LIVE_ENABLED, STRIKE_ENV } from "@/lib/execution/config";
import { STRIKE_APP } from "@/lib/strike";
import { useApp } from "@/lib/store";
import { cx } from "./ui";
import { LogoMark } from "./Logo";

export const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/signals", label: "Signals" },
  { href: "/backtest", label: "Backtest" },
  { href: "/portfolio", label: "Portfolio" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { live, toast } = useApp();

  return (
    <div className="mx-auto w-full max-w-[1500px] flex-1 px-3 pb-10 pt-4 sm:px-6">
      <div className="frame p-3 sm:p-5">
        <header className="sticky top-2 z-30 -mx-1 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/60 px-3 py-2 shadow-sm backdrop-blur-md">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark className="h-10 w-10" />
            <div className="leading-tight">
              <div className="text-lg font-bold tracking-tight">Fulmen</div>
              <p className="text-[11px] text-muted">Signal to trade for Strike</p>
            </div>
          </Link>
          <nav
            className="order-last flex w-full justify-center gap-1.5 rounded-full bg-white/70 p-1 text-xs font-semibold shadow-sm sm:order-none sm:w-auto"
            aria-label="Pages"
          >
            {NAV.map((n) => {
              const active = pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cx("rounded-full px-3.5 py-1.5 transition", active ? "bg-ink-black text-white" : "text-ink/70 hover:bg-white")}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 shadow-sm">
              <span className={cx("live-dot h-2 w-2 rounded-full", live ? "bg-up" : "bg-down")} />
              {live ? "Strike live" : "connecting…"}
            </span>
            <span className="rounded-full bg-white/80 px-3 py-1.5 font-semibold text-bolt shadow-sm">
              {LIVE_ENABLED ? `LIVE ${STRIKE_ENV.toUpperCase()} + PAPER` : "PAPER MODE"}
            </span>
            <a href={STRIKE_APP} target="_blank" rel="noreferrer" className="rounded-full bg-ink-black px-4 py-1.5 font-semibold text-white">
              Open Strike ↗
            </a>
          </div>
        </header>

        <main>{children}</main>

        <footer className="mt-6 text-center text-[11px] leading-relaxed text-muted">
          Live data from Strike&apos;s API. The portfolio is paper trading; live orders exist only when a builder code is configured.
          Signals are heuristics, not financial advice.
        </footer>
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-ink-black px-4 py-2 text-sm text-white shadow-lg">{toast}</div>
      )}
    </div>
  );
}
