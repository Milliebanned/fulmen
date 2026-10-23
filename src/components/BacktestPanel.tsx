"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchAndBacktest, type BacktestOk, type BacktestResult } from "@/lib/backtest";

const usd = (n: number) => `${n < 0 ? "-" : n > 0 ? "+" : ""}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const pct = (n: number, d = 1) => `${n > 0 ? "+" : ""}${n.toFixed(d)}%`;
const tone = (n: number) => (n > 0 ? "text-up" : n < 0 ? "text-down" : "text-muted");

function EquityChart({ r }: { r: BacktestOk }) {
  const W = 600;
  const H = 150;
  const pts = r.equity;
  const { path, area, base, min, max } = useMemo(() => {
    const ys = pts.map((p) => p[1]);
    const lo = Math.min(...ys, r.startEquity);
    const hi = Math.max(...ys, r.startEquity);
    const pad = (hi - lo) * 0.1 || 1;
    const min = lo - pad;
    const max = hi + pad;
    const x = (i: number) => (i / Math.max(1, pts.length - 1)) * W;
    const y = (v: number) => H - ((v - min) / (max - min)) * H;
    const path = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
    return { path, area: `${path}L${W},${H}L0,${H}Z`, base: y(r.startEquity), min, max };
  }, [pts, r.startEquity]);
  const up = r.endEquity >= r.startEquity;
  const color = up ? "var(--up)" : "var(--down)";
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-36 w-full" role="img" aria-label="Backtest equity curve">
        <line x1="0" x2={W} y1={base} y2={base} stroke="var(--line)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        <path d={area} fill={color} opacity="0.1" />
        <path d={path} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="num pointer-events-none absolute left-1 top-0 text-[10px] text-muted">${Math.round(max).toLocaleString("en-US")}</div>
      <div className="num pointer-events-none absolute bottom-0 left-1 text-[10px] text-muted">${Math.round(min).toLocaleString("en-US")}</div>
    </div>
  );
}

function Tile({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel2 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className={`num mt-0.5 text-base font-semibold ${cls}`}>{value}</div>
    </div>
  );
}

export function BacktestPanel({ symbol }: { symbol: string }) {
  const [state, setState] = useState<{ symbol: string; res?: BacktestResult; error?: string }>({ symbol: "" });

  useEffect(() => {
    const ac = new AbortController();
    fetchAndBacktest(symbol, {}, ac.signal)
      .then((res) => setState({ symbol, res }))
      .catch((e) => {
        if (!ac.signal.aborted) setState({ symbol, error: e instanceof Error ? e.message : "Request failed" });
      });
    return () => ac.abort();
  }, [symbol]);

  const loading = state.symbol !== symbol;
  const r = !loading ? state.res : undefined;

  return (
    <section className="rounded-xl border border-line bg-panel">
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h3 className="text-[11px] uppercase tracking-[0.14em] text-muted">Backtest · funding-carry rule</h3>
        <span className="num text-[11px] text-muted">{symbol}</span>
      </header>
      <div className="p-4">
        {loading && <div className="h-48 animate-pulse rounded-lg bg-panel2" aria-label="Loading backtest" />}
        {!loading && state.error && (
          <p className="text-sm text-down">Could not run backtest: {state.error}</p>
        )}
        {!loading && r && !r.ok && (
          <p className="text-sm text-muted">
            Not enough data to backtest {symbol}. <span className="text-xs">{r.reason}</span>
          </p>
        )}
        {!loading && r?.ok && (
          <div className="space-y-4">
            <p className="text-xs text-muted">
              Following the rule on {r.symbol.replace("-USD", "")} for the last {r.days.toFixed(0)} days ({r.trades} trades), $
              {r.startEquity.toLocaleString("en-US")} start.
            </p>
            <EquityChart r={r} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Tile label="Return" value={pct(r.totalReturnPct)} cls={tone(r.totalReturnPct)} />
              <Tile label="Win rate" value={r.winRatePct === null ? "n/a" : `${r.winRatePct.toFixed(0)}%`} />
              <Tile label="Max drawdown" value={`-${r.maxDrawdownPct.toFixed(1)}%`} cls="text-down" />
              <Tile label="Trades" value={String(r.trades)} />
              <Tile label="Buy & hold" value={pct(r.buyHoldPct)} cls="text-muted" />
            </div>
            <div className="rounded-lg border border-line bg-panel2 px-3 py-2">
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-muted">Where the PnL came from</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className={`num text-sm font-semibold ${tone(r.pricePnl)}`}>{usd(r.pricePnl)}</div>
                  <div className="text-[10px] text-muted">price</div>
                </div>
                <div>
                  <div className={`num text-sm font-semibold ${tone(r.fundingPnl)}`}>{usd(r.fundingPnl)}</div>
                  <div className="text-[10px] text-muted">funding</div>
                </div>
                <div>
                  <div className={`num text-sm font-semibold ${tone(-r.fees)}`}>{usd(-r.fees)}</div>
                  <div className="text-[10px] text-muted">fees</div>
                </div>
              </div>
            </div>
            <ul className="space-y-1 text-[11px] leading-snug text-muted">
              {r.caveats.map((c) => (
                <li key={c}>• {c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
