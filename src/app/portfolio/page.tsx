"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useApp } from "@/lib/store";
import { unrealized, START_EQUITY, type Closed } from "@/lib/paper";
import { fmt, price, GUARD } from "@/lib/signals";
import { Bar, Card, Delta, Donut, DONUT_COLORS, Loading, Pill, cx } from "@/components/ui";

const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const tone = (n: number) => (n >= 0 ? "text-up" : "text-down");

function duration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

const REASON: Record<Closed["reason"], string> = {
  stop: "bg-down/12 text-down",
  target: "bg-up/12 text-up",
  manual: "bg-panel2 text-muted",
};

function Kpi({ label, value, sub, children }: { label: string; value: string; sub?: string; children?: ReactNode }) {
  return (
    <Card title={label} right={<span />}>
      <div className="px-4 pb-4 pt-1">
        <div className="num text-2xl font-bold tracking-tight">{value}</div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
          {children}
          {sub && <span>{sub}</span>}
        </div>
      </div>
    </Card>
  );
}

function Stat({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="rounded-xl bg-panel2 px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className={cx("num mt-0.5 text-base font-bold", cls)}>{value}</div>
    </div>
  );
}

const TH = "px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted whitespace-nowrap";
const TD = "px-3 py-2.5 whitespace-nowrap";

export default function PortfolioPage() {
  const app = useApp();
  const [confirming, setConfirming] = useState(false);
  const { snap, error, paper, equity, liveMarks } = app;

  if (!snap) return <Loading error={error} />;

  const open = paper.positions;
  const hist = paper.history;
  const rows = open.map((p) => {
    const mark = liveMarks[p.symbol] ?? p.entry;
    const upnl = unrealized(p, mark);
    const pnl = upnl + p.fundingPaid;
    const dir = p.side === "long" ? 1 : -1;
    const risk = (p.entry - p.stop) * dir; // entry-to-stop distance
    const toStop = risk > 0 ? Math.min(1, Math.max(0, ((mark - p.stop) * dir) / risk)) : 0;
    return { p, mark, pnl, pct: p.notional > 0 ? (pnl / p.notional) * 100 : 0, toStop };
  });

  const openPnl = rows.reduce((a, r) => a + r.pnl, 0);
  const realized = hist.reduce((a, h) => a + h.pnl, 0);
  const funding = open.reduce((a, p) => a + p.fundingPaid, 0) + hist.reduce((a, h) => a + h.fundingPaid, 0);
  const start = paper.start || START_EQUITY;
  const eqPct = ((equity - start) / start) * 100;

  // stats from real history only
  const wins = hist.filter((h) => h.pnl > 0);
  const losses = hist.filter((h) => h.pnl < 0);
  const grossWin = wins.reduce((a, h) => a + h.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((a, h) => a + h.pnl, 0));
  const has = hist.length >= 1;
  const best = has ? hist.reduce((a, h) => (h.pnl > a.pnl ? h : a)) : null;
  const worst = has ? hist.reduce((a, h) => (h.pnl < a.pnl ? h : a)) : null;
  const profitFactor = !has ? "n/a" : grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : grossWin > 0 ? "∞" : "n/a";

  // exposure
  const byMarket = new Map<string, number>();
  for (const r of rows) byMarket.set(r.p.symbol, (byMarket.get(r.p.symbol) ?? 0) + r.p.notional);
  const gross = [...byMarket.values()].reduce((a, v) => a + v, 0);
  const lev = equity > 0 ? gross / equity : 0;
  const donut = [...byMarket.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, v], i) => ({ label, value: gross > 0 ? v / gross : 0, color: DONUT_COLORS[i % DONUT_COLORS.length], usd: v }));

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 px-1">
          <span className="rounded-full bg-bolt/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-bolt">
            Paper trading - simulated, no real funds
          </span>
        </div>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
            <p className="mt-0.5 text-sm text-muted">Paper account on live Strike prices</p>
          </div>
          <div className="flex items-center gap-2">
            {confirming && (
              <button
                onClick={() => setConfirming(false)}
                className="rounded-full border border-line bg-panel px-4 py-2 text-xs font-semibold text-muted"
              >
                Cancel
              </button>
            )}
            <button
              onClick={() => {
                if (confirming) {
                  app.resetPaper();
                  setConfirming(false);
                } else setConfirming(true);
              }}
              className={cx(
                "rounded-full px-4 py-2 text-xs font-semibold text-white",
                confirming ? "bg-down" : "bg-ink-black",
              )}
            >
              {confirming ? "Confirm reset" : "Reset account"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Equity" value={usd(equity)}>
          <Delta v={eqPct} />
          <span>vs {usd(start)} start</span>
        </Kpi>
        <Kpi label="Open PnL" value={signed(openPnl)} sub={`${open.length} open`} />
        <Kpi label="Realized PnL" value={signed(realized)} sub={`${hist.length} closed`} />
        <Kpi label="Funding" value={signed(funding)} sub={funding >= 0 ? "net earned" : "net paid"} />
      </div>

      <Card title="Open positions" right={<span className="num text-[11px] text-muted">{open.length}</span>}>
        {rows.length === 0 ? (
          <div className="px-4 pb-6 pt-3 text-center text-sm text-muted">
            No open paper positions.{" "}
            <Link href="/signals" className="font-semibold text-accent underline">
              Find an idea
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-xs">
              <thead>
                <tr className="border-b border-line">
                  {["Market", "Side", "Size", "Entry", "Mark", "Stop", "Target", "PnL $", "PnL %", "Funding", "To stop", ""].map((h) => (
                    <th key={h} className={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, mark, pnl, pct, toStop }) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className={cx(TD, "font-semibold")}>{p.symbol}</td>
                    <td className={TD}><Pill side={p.side} /></td>
                    <td className={cx(TD, "num")}>${fmt(p.notional)}</td>
                    <td className={cx(TD, "num")}>{price(p.entry)}</td>
                    <td className={cx(TD, "num font-semibold")}>{price(mark)}</td>
                    <td className={cx(TD, "num text-down")}>{price(p.stop)}</td>
                    <td className={cx(TD, "num text-up")}>{price(p.target)}</td>
                    <td className={cx(TD, "num font-semibold", tone(pnl))}>{signed(pnl)}</td>
                    <td className={TD}><Delta v={pct} /></td>
                    <td className={cx(TD, "num", tone(p.fundingPaid))}>{signed(p.fundingPaid)}</td>
                    <td className={TD}>
                      <div className="w-20">
                        <Bar value={toStop} color={toStop < 0.25 ? "var(--down)" : toStop < 0.5 ? "var(--bolt)" : "var(--up)"} />
                      </div>
                    </td>
                    <td className={TD}>
                      <button
                        onClick={() => app.closePosition(p.id)}
                        className="rounded-full bg-ink-black px-3 py-1 text-[11px] font-semibold text-white"
                      >
                        Close
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Performance stats">
          <div className="px-4 pb-4 pt-2">
            {!has && <p className="mb-3 text-xs text-muted">No closed trades yet. Stats appear after your first close.</p>}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="Trades" value={String(hist.length)} />
              <Stat label="Win rate" value={has ? `${((wins.length / hist.length) * 100).toFixed(0)}%` : "n/a"} />
              <Stat label="Profit factor" value={profitFactor} />
              <Stat label="Avg win" value={wins.length ? signed(grossWin / wins.length) : "n/a"} cls={wins.length ? "text-up" : undefined} />
              <Stat label="Avg loss" value={losses.length ? signed(-grossLoss / losses.length) : "n/a"} cls={losses.length ? "text-down" : undefined} />
              <Stat label="Best / worst" value={best && worst ? `${signed(best.pnl)} / ${signed(worst.pnl)}` : "n/a"} />
            </div>
          </div>
        </Card>

        <Card title="Exposure">
          <div className="px-4 pb-4 pt-2">
            {gross === 0 ? (
              <p className="text-xs text-muted">Flat. No open exposure.</p>
            ) : (
              <div className="flex items-center gap-4">
                <div className="h-28 w-28 shrink-0">
                  <Donut items={donut} />
                </div>
                <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
                  {donut.map((d) => (
                    <li key={d.label} className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
                      <span className="truncate font-semibold">{d.label}</span>
                      <span className="num ml-auto text-muted">
                        ${fmt(d.usd)} · {(d.value * 100).toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4">
              <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="text-muted">Gross ${fmt(gross)} / equity {usd(equity)}</span>
                <span className={cx("num font-bold", lev > GUARD.maxLeverage ? "text-down" : "")}>
                  {lev.toFixed(2)}x <span className="font-normal text-muted">of {GUARD.maxLeverage}x guard</span>
                </span>
              </div>
              <Bar value={lev / GUARD.maxLeverage} color={lev > GUARD.maxLeverage * 0.8 ? "var(--down)" : "var(--accent)"} />
            </div>
          </div>
        </Card>
      </div>

      <Card title="Trade history" right={<span className="num text-[11px] text-muted">last {Math.min(50, hist.length)}</span>}>
        {hist.length === 0 ? (
          <div className="px-4 pb-6 pt-3 text-center text-sm text-muted">No closed trades yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="border-b border-line">
                  {["Market", "Side", "Entry", "Exit", "PnL", "Reason", "Duration", "Closed"].map((h) => (
                    <th key={h} className={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hist.slice(0, 50).map((h) => (
                  <tr key={h.id + h.closedAt} className="border-b border-line last:border-0">
                    <td className={cx(TD, "font-semibold")}>{h.symbol}</td>
                    <td className={TD}><Pill side={h.side} /></td>
                    <td className={cx(TD, "num")}>{price(h.entry)}</td>
                    <td className={cx(TD, "num")}>{price(h.exit)}</td>
                    <td className={cx(TD, "num font-semibold", tone(h.pnl))}>{signed(h.pnl)}</td>
                    <td className={TD}>
                      <span className={cx("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", REASON[h.reason])}>
                        {h.reason}
                      </span>
                    </td>
                    <td className={cx(TD, "num")}>{duration(h.closedAt - h.openedAt)}</td>
                    <td className={cx(TD, "text-muted")}>{new Date(h.closedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
