"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { BacktestPanel } from "@/components/BacktestPanel";
import { Card, Loading, PageTitle, Pill, cx } from "@/components/ui";
import { fetchAndBacktest, type BacktestResult } from "@/lib/backtest";

// Module-level cache so navigating away and back does not re-run the sweep.
const CACHE = new Map<string, BacktestResult>();
const CONCURRENCY = 3;

const usd = (n: number) => `${n < 0 ? "-" : n > 0 ? "+" : ""}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const pct = (n: number, d = 1) => `${n > 0 ? "+" : ""}${n.toFixed(d)}%`;
const tone = (n: number) => (n > 0 ? "text-up" : n < 0 ? "text-down" : "text-muted");

type SortKey = "symbol" | "side" | "ret" | "win" | "dd" | "trades" | "fund" | "price" | "bh" | "days";

interface Row {
  symbol: string;
  side: "long" | "short" | null;
  res: BacktestResult | undefined;
}

function val(r: Row, k: SortKey): number | string | null {
  if (k === "symbol") return r.symbol;
  if (k === "side") return r.side;
  const x = r.res;
  if (!x || !x.ok) return null;
  switch (k) {
    case "ret": return x.totalReturnPct;
    case "win": return x.winRatePct;
    case "dd": return x.maxDrawdownPct;
    case "trades": return x.trades;
    case "fund": return x.fundingPnl;
    case "price": return x.pricePnl;
    case "bh": return x.buyHoldPct;
    case "days": return x.days;
  }
}

const COLS: { k: SortKey; label: string; right?: boolean }[] = [
  { k: "symbol", label: "Market" },
  { k: "side", label: "Side now" },
  { k: "ret", label: "Return %", right: true },
  { k: "win", label: "Win rate", right: true },
  { k: "dd", label: "Max DD", right: true },
  { k: "trades", label: "Trades", right: true },
  { k: "fund", label: "Funding PnL $", right: true },
  { k: "price", label: "Price PnL $", right: true },
  { k: "bh", label: "Buy&Hold %", right: true },
  { k: "days", label: "Days", right: true },
];

function Tile({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel2 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className={cx("num mt-0.5 text-base font-semibold", cls)}>{value}</div>
    </div>
  );
}

export default function BacktestPage() {
  const app = useApp();
  const ideas = app.snap?.ideas;
  const symbol = app.selected ?? app.idea?.market.symbol ?? null;

  const [results, setResults] = useState<Record<string, BacktestResult>>(() => Object.fromEntries(CACHE));
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "ret", dir: -1 });
  const acRef = useRef<AbortController | null>(null);

  useEffect(() => () => acRef.current?.abort(), []);

  const symbols = useMemo(() => (ideas ?? []).map((i) => i.market.symbol), [ideas]);

  const run = async () => {
    if (running || symbols.length === 0) return;
    const ac = new AbortController();
    acRef.current = ac;
    setRunning(true);
    setDone(0);
    setResults({});
    CACHE.clear();
    const queue = [...symbols];
    const worker = async () => {
      while (!ac.signal.aborted) {
        const s = queue.shift();
        if (!s) return;
        let res: BacktestResult;
        try {
          res = await fetchAndBacktest(s, {}, ac.signal);
        } catch (e) {
          if (ac.signal.aborted) return;
          res = { ok: false, symbol: s, reason: e instanceof Error ? e.message : "Request failed" };
        }
        if (ac.signal.aborted) return;
        CACHE.set(s, res);
        setResults((prev) => ({ ...prev, [s]: res }));
        setDone((d) => d + 1);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, symbols.length) }, worker));
    if (!ac.signal.aborted) setRunning(false);
  };

  const rows: Row[] = useMemo(() => {
    const base = (ideas ?? []).map((i) => ({ symbol: i.market.symbol, side: i.side as "long" | "short", res: results[i.market.symbol] }));
    return base
      .filter((r) => r.res)
      .sort((a, b) => {
        const x = val(a, sort.k);
        const y = val(b, sort.k);
        if (x === null && y === null) return 0;
        if (x === null) return 1; // missing values always last
        if (y === null) return -1;
        const c = typeof x === "string" && typeof y === "string" ? x.localeCompare(y) : (x as number) - (y as number);
        return c * sort.dir;
      });
  }, [ideas, results, sort]);

  const summary = useMemo(() => {
    const oks = rows.flatMap((r) => (r.res && r.res.ok ? [r.res] : []));
    if (oks.length === 0) return null;
    const sum = (f: (x: (typeof oks)[number]) => number) => oks.reduce((s, x) => s + f(x), 0);
    return {
      n: oks.length,
      profitable: oks.filter((x) => x.totalReturnPct > 0).length,
      avgRet: sum((x) => x.totalReturnPct) / oks.length,
      avgDd: sum((x) => x.maxDrawdownPct) / oks.length,
      funding: sum((x) => x.fundingPnl),
      price: sum((x) => x.pricePnl),
      fees: sum((x) => x.fees),
    };
  }, [rows]);

  if (!app.snap || !ideas || ideas.length === 0) {
    return (
      <>
        <PageTitle title="Backtest" subtitle="Replay the funding-carry rule on the last 90 days of Strike data." />
        <Loading error={app.error} empty={!!app.snap && ideas?.length === 0} />
      </>
    );
  }

  const total = symbols.length;
  const have = Object.keys(results).length;
  const failed = rows.filter((r) => r.res && !r.res.ok).length;

  const head = (k: SortKey) => setSort((s) => (s.k === k ? { k, dir: (s.dir * -1) as 1 | -1 } : { k, dir: k === "symbol" || k === "side" ? 1 : -1 }));

  return (
    <div className="space-y-4">
      <PageTitle title="Backtest" subtitle="Replay the funding-carry rule on the last 90 days of Strike data, per market and across all markets." />

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Market">
        {symbols.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => app.select(s)}
            aria-pressed={s === symbol}
            className={cx(
              "num rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              s === symbol ? "border-ink-black bg-ink-black text-white" : "border-line bg-white text-muted hover:text-foreground",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {symbol && <BacktestPanel symbol={symbol} />}

      <Card
        title="All markets"
        tint="var(--bolt)"
        right={
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="rounded-full bg-ink-black px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {running ? "Running…" : have > 0 ? "Re-run across all markets" : "Run across all markets"}
          </button>
        }
      >
        <div className="space-y-4 px-4 pb-4 pt-2">
          {(running || have > 0) && (
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-muted">
                <span>{running ? "Backtesting…" : "Finished"}</span>
                <span className="num">{done} of {total}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel2">
                <div className="h-full rounded-full bg-ink-black transition-all" style={{ width: `${(done / total) * 100}%` }} />
              </div>
            </div>
          )}

          {have === 0 && !running && (
            <p className="text-sm text-muted">
              Runs the same rule on all {total} markets ({CONCURRENCY} at a time) and compares them. Nothing is shown until it has actually been computed.
            </p>
          )}

          {summary && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Tile label="Profitable" value={`${summary.profitable} of ${summary.n}`} cls={summary.profitable * 2 >= summary.n ? "text-up" : "text-down"} />
              <Tile label="Avg return" value={pct(summary.avgRet)} cls={tone(summary.avgRet)} />
              <Tile label="Avg max DD" value={`-${summary.avgDd.toFixed(1)}%`} cls="text-down" />
              <Tile label="Funding PnL" value={usd(summary.funding)} cls={tone(summary.funding)} />
              <Tile label="Price PnL" value={usd(summary.price)} cls={tone(summary.price)} />
              <Tile label="Fees paid" value={`-$${Math.round(summary.fees).toLocaleString("en-US")}`} cls="text-muted" />
            </div>
          )}

          {rows.length > 0 && (
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="w-full min-w-[820px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-line">
                    {COLS.map((c) => (
                      <th
                        key={c.k}
                        scope="col"
                        aria-sort={sort.k === c.k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                        className={cx("whitespace-nowrap py-2 pr-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted", c.right && "text-right")}
                      >
                        <button type="button" onClick={() => head(c.k)} className="uppercase tracking-[0.1em] hover:text-foreground">
                          {c.label}
                          {sort.k === c.k && <span aria-hidden> {sort.dir === 1 ? "▲" : "▼"}</span>}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const x = r.res!;
                    return (
                      <tr key={r.symbol} className="border-b border-line/60 last:border-0">
                        <td className="py-2 pr-3">
                          <button type="button" onClick={() => app.select(r.symbol)} className="num font-semibold hover:underline">
                            {r.symbol}
                          </button>
                        </td>
                        <td className="py-2 pr-3">{r.side && <Pill side={r.side} />}</td>
                        {x.ok ? (
                          <>
                            <td className={cx("num py-2 pr-3 text-right font-semibold", tone(x.totalReturnPct))}>{pct(x.totalReturnPct)}</td>
                            <td className="num py-2 pr-3 text-right">{x.winRatePct === null ? "–" : `${x.winRatePct.toFixed(0)}%`}</td>
                            <td className="num py-2 pr-3 text-right text-down">-{x.maxDrawdownPct.toFixed(1)}%</td>
                            <td className="num py-2 pr-3 text-right">{x.trades}</td>
                            <td className={cx("num py-2 pr-3 text-right", tone(x.fundingPnl))}>{usd(x.fundingPnl)}</td>
                            <td className={cx("num py-2 pr-3 text-right", tone(x.pricePnl))}>{usd(x.pricePnl)}</td>
                            <td className={cx("num py-2 pr-3 text-right", tone(x.buyHoldPct))}>{pct(x.buyHoldPct)}</td>
                            <td className="num py-2 pr-3 text-right">{x.days.toFixed(0)}</td>
                          </>
                        ) : (
                          <td colSpan={8} className="py-2 pr-3 text-muted">{x.reason}</td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {failed > 0 && !running && (
            <p className="text-[11px] text-muted">{failed} of {have} markets could not be backtested and are excluded from the averages and totals.</p>
          )}

          <p className="text-[11px] leading-relaxed text-muted">
            Results cover at most 90 days (all Strike exposes for funding history) and are in-sample: the rule was not tuned, and a handful of markets
            is a small sample.{" "}
            {summary &&
              `In this run, funding contributed ${usd(summary.funding)} and price moves ${usd(summary.price)}, against ${usd(-summary.fees)} in fees, so the net result was ${
                summary.avgRet >= 0 ? "slightly positive" : "roughly flat to negative"
              } on average (${pct(summary.avgRet)}). `}
            Funding is a steady contributor; price noise and trading costs decide the rest. Past performance does not predict future results. Not
            financial advice.
          </p>
        </div>
      </Card>

      <Card title="How the rule works" tint="var(--up)">
        <div className="space-y-2 px-4 pb-4 pt-2 text-sm leading-relaxed text-muted">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <span className="font-semibold text-foreground">Direction.</span> Once per UTC day, look at the average funding rate of the previous 24 hours. If longs
              were paying shorts, go short and collect funding; if shorts were paying, go long. No lookahead: only data before each decision is used.
            </li>
            <li>
              <span className="font-semibold text-foreground">Stop.</span> Volatility-based: 0.6 x the trailing 24h high-low range, kept between 1.2% and 8% of price.
            </li>
            <li>
              <span className="font-semibold text-foreground">Target.</span> 2R, meaning twice the stop distance. If stop and target fall in the same hourly candle, the stop is assumed.
            </li>
            <li>
              <span className="font-semibold text-foreground">Costs.</span> 0.05% fee per side, charged on entry and exit. No slippage, spread or liquidation modelling.
            </li>
            <li>
              <span className="font-semibold text-foreground">Sizing.</span> Risk 1% of equity at the stop, with leverage capped at 5x, compounding.
            </li>
            <li>
              <span className="font-semibold text-foreground">Flips.</span> If the daily side changes, the open trade is closed at the open and the new side is entered.
            </li>
          </ul>
          <p className="text-xs">The edge being tested is whether funding income adds to, or at least does not erase, the result of trading the crowded side&apos;s opposite. It is a hypothesis check, not a promise.</p>
        </div>
      </Card>
    </div>
  );
}
