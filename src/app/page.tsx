"use client";

import { useEffect, useMemo, useState } from "react";
import { GUARD, fmt, price, size, type Idea, type Reason } from "@/lib/signals";
import { STRIKE_APP } from "@/lib/strike";
import { PriceChart } from "@/components/PriceChart";
import { BacktestPanel } from "@/components/BacktestPanel";
import { LiveTradePanel } from "@/components/LiveTradePanel";
import { useLiveMarks, useSnapshot } from "@/lib/useStrike";
import * as paper from "@/lib/paper";

const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(" ");

function Spark({ data, up }: { data: number[]; up: boolean }) {
  if (data.length < 2) return <div className="h-7 w-20" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 80},${26 - ((v - min) / (max - min || 1)) * 24}`)
    .join(" ");
  return (
    <svg viewBox="0 0 80 28" className="h-7 w-20" aria-hidden>
      <polyline fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth="1.5" points={pts} />
    </svg>
  );
}

function Pill({ side }: { side: "long" | "short" }) {
  return (
    <span
      className={cx(
        "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        side === "long" ? "bg-up/15 text-up" : "bg-down/15 text-down",
      )}
    >
      {side}
    </span>
  );
}

function Bar({ value, color = "var(--bolt)" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded bg-line">
      <div className="h-full rounded" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
    </div>
  );
}

const toneColor: Record<Reason["tone"], string> = {
  good: "text-up",
  warn: "text-bolt",
  neutral: "text-muted",
};

function Card({ title, right, children, className }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-xl border border-line bg-panel", className)}>
      <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{title}</h2>
        {right}
      </header>
      {children}
    </section>
  );
}

export default function Home() {
  const { snap, error } = useSnapshot();
  const { marks, live } = useLiveMarks();
  const [selected, setSelected] = useState<string | null>(null);
  const [riskPct, setRiskPct] = useState(0.01);
  const [state, setState] = useState<paper.PaperState>(paper.emptyState());
  const [hydrated, setHydrated] = useState(false);
  const [ai, setAi] = useState<{ symbol: string; text: string; source: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(paper.loadState());
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) paper.saveState(state);
  }, [state, hydrated]);

  const mark = (sym: string, fallback: number) => marks[sym] ?? fallback;

  // stops / targets / funding accrual
  const rates = useMemo(
    () => Object.fromEntries((snap?.markets ?? []).map((m) => [m.symbol, m.fundingHourly])),
    [snap],
  );
  useEffect(() => {
    if (!hydrated) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => (s.positions.length ? paper.tick(s, marks, rates) : s));
  }, [marks, rates, hydrated]);

  const idea: Idea | undefined = useMemo(() => {
    if (!snap) return undefined;
    return snap.ideas.find((i) => i.market.symbol === selected) ?? snap.ideas[0];
  }, [snap, selected]);

  // AI rationale for the selected idea
  useEffect(() => {
    if (!idea) return;
    let cancel = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAiLoading(true);
    fetch("/api/explain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        symbol: idea.market.symbol,
        side: idea.side,
        conviction: idea.conviction,
        entry: idea.entry,
        stop: idea.stop,
        target: idea.target,
        fearGreed: snap?.fearGreed?.value,
        reasons: idea.reasons,
      }),
    })
      .then((r) => r.json())
      .then((j) => !cancel && setAi({ symbol: idea.market.symbol, text: j.text, source: j.source }))
      .catch(() => !cancel && setAi(null))
      .finally(() => !cancel && setAiLoading(false));
    return () => {
      cancel = true;
    };
    // re-explain only when the idea identity or side changes, not on every price tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idea?.market.symbol, idea?.side]);

  const liveMarks = useMemo(() => {
    const out: Record<string, number> = {};
    for (const m of snap?.markets ?? []) out[m.symbol] = marks[m.symbol] ?? m.mark;
    return out;
  }, [snap, marks]);

  const equity = paper.equity(state, liveMarks);
  const pnl = equity - state.start;
  const sizing = idea ? size(idea, equity, riskPct) : null;

  function openTrade() {
    if (!idea || !sizing) return;
    const m = mark(idea.market.symbol, idea.entry);
    const stop = idea.side === "long" ? m * (1 - idea.stopPct) : m * (1 + idea.stopPct);
    const target = idea.side === "long" ? m * (1 + idea.stopPct * 2) : m * (1 - idea.stopPct * 2);
    setState((s) => paper.open(s, { symbol: idea.market.symbol, side: idea.side, entry: m, notional: sizing.notional, stop, target }));
    setToast(`Paper ${idea.side} ${idea.market.symbol} opened at ${price(m)}`);
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] flex-1 px-4 pb-10 pt-4 sm:px-6">
      {/* Header */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bolt text-lg text-black">⚡</div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              FULMEN <span className="font-normal text-muted">/ signal → trade for Strike</span>
            </h1>
            <p className="text-xs text-muted">Live Strike data → explained, risk-guarded trade ideas.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1.5">
            <span className={cx("live-dot h-2 w-2 rounded-full", live ? "bg-up" : "bg-down")} />
            {live ? "Strike WS live" : "connecting…"}
          </span>
          {snap?.fearGreed && (
            <span className="rounded-full border border-line bg-panel px-3 py-1.5">
              Sentiment <b className="num">{snap.fearGreed.value}</b> · {snap.fearGreed.classification}
            </span>
          )}
          {snap?.summary && (
            <span className="rounded-full border border-line bg-panel px-3 py-1.5">
              Strike volume <b className="num">${fmt(Number(snap.summary.total_volume_usd))}</b> ·{" "}
              <b className="num">{snap.summary.total_users.toLocaleString()}</b> traders
            </span>
          )}
          <span className="rounded-full border border-bolt/40 bg-bolt/10 px-3 py-1.5 font-semibold text-bolt">PAPER MODE</span>
        </div>
      </header>

      {error && !snap && (
        <div className="rounded-xl border border-down/40 bg-down/10 p-4 text-sm text-down">Could not reach Strike: {error}</div>
      )}
      {!snap && !error && <div className="p-10 text-center text-muted">Loading live Strike markets…</div>}

      {snap && idea && sizing && (
        <div className="grid gap-4 lg:grid-cols-12">
          {/* Signal board */}
          <Card
            title={`Signal board · ${snap.ideas.length} markets`}
            className="lg:col-span-4"
            right={<span className="text-[10px] text-muted">ranked by conviction</span>}
          >
            <ul className="scroll-thin max-h-[640px] divide-y divide-line overflow-y-auto">
              {snap.ideas.map((i) => {
                const active = i.market.symbol === idea.market.symbol;
                const m = i.market;
                return (
                  <li key={m.symbol}>
                    <button
                      onClick={() => setSelected(m.symbol)}
                      className={cx(
                        "grid w-full grid-cols-[1fr_auto] items-center gap-2 px-4 py-2.5 text-left transition hover:bg-panel2",
                        active && "bg-panel2 ring-1 ring-inset ring-bolt/50",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{m.name}</span>
                          <Pill side={i.side} />
                          <span className="num text-[11px] text-muted">{price(mark(m.symbol, m.mark))}</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="w-20">
                            <Bar value={i.conviction / 100} />
                          </div>
                          <span className="num text-[11px] text-bolt">{i.conviction}</span>
                          <span className={cx("num text-[11px]", m.fundingApr >= 0 ? "text-down" : "text-up")}>
                            {m.fundingApr >= 0 ? "+" : ""}
                            {m.fundingApr.toFixed(0)}% fund
                          </span>
                          <span className={cx("num text-[11px]", m.change24h >= 0 ? "text-up" : "text-down")}>
                            {m.change24h >= 0 ? "+" : ""}
                            {m.change24h.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <Spark data={m.closes} up={m.change24h >= 0} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Trade desk */}
          <div className="flex flex-col gap-4 lg:col-span-5">
            <Card
              title="Trade idea"
              right={<span className="num text-[11px] text-muted">updated {new Date(snap.updatedAt).toLocaleTimeString()}</span>}
            >
              <div className="p-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-2xl font-bold">{idea.market.symbol}</h3>
                      <Pill side={idea.side} />
                    </div>
                    <p className="num mt-1 text-sm text-muted">
                      Mark {price(mark(idea.market.symbol, idea.market.mark))} · OI ${fmt(idea.market.oiUsd)} · Vol ${fmt(idea.market.vol24h)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="num text-4xl font-bold text-bolt">{idea.conviction}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted">conviction</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                  {(
                    [
                      ["Funding carry", idea.parts.carry],
                      ["Momentum", idea.parts.momentum],
                      ["Smart money", idea.parts.attention],
                      ["Liquidity", idea.parts.liquidity],
                    ] as const
                  ).map(([label, v]) => (
                    <div key={label}>
                      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">{label}</div>
                      <Bar value={v} color="var(--accent)" />
                    </div>
                  ))}
                </div>

                <ul className="mt-4 space-y-2">
                  {idea.reasons.map((r, k) => (
                    <li key={k} className="flex gap-2 text-sm">
                      <span className={cx("mt-0.5 w-[78px] shrink-0 text-[10px] font-bold uppercase tracking-wider", toneColor[r.tone])}>{r.tag}</span>
                      <span className="text-ink/90">{r.text}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 rounded-lg border border-line bg-panel2 p-3">
                  <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted">
                    <span>Analyst rationale</span>
                    <span>{aiLoading ? "thinking…" : ai?.source === "claude" ? "written by Claude from live data" : "auto summary"}</span>
                  </div>
                  <p className="text-sm leading-relaxed">
                    {ai && ai.symbol === idea.market.symbol ? ai.text : aiLoading ? "Generating rationale from the live numbers…" : "—"}
                  </p>
                </div>
              </div>
            </Card>

            <PriceChart
              symbol={idea.market.symbol}
              side={idea.side}
              entry={mark(idea.market.symbol, idea.entry)}
              stop={idea.stop}
              target={idea.target}
              livePrice={marks[idea.market.symbol]}
            />

            <BacktestPanel symbol={idea.market.symbol} />

            <Card title="Order ticket · risk guard on" right={<span className="text-[10px] text-muted">max {GUARD.maxLeverage}x · max {GUARD.maxRiskPct * 100}% risk</span>}>
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted">Risk per trade: {(riskPct * 100).toFixed(1)}% of equity</label>
                  <input
                    type="range"
                    min={0.0025}
                    max={0.03}
                    step={0.0025}
                    value={riskPct}
                    onChange={(e) => setRiskPct(parseFloat(e.target.value))}
                    className="mt-2 w-full accent-[var(--bolt)]"
                  />
                  {riskPct > GUARD.maxRiskPct && (
                    <p className="mt-1 text-[11px] text-bolt">Guard caps risk at {GUARD.maxRiskPct * 100}%.</p>
                  )}
                  <dl className="num mt-3 space-y-1 text-sm">
                    {[
                      ["Entry", price(mark(idea.market.symbol, idea.entry))],
                      ["Stop", `${price(idea.stop)} (−${(idea.stopPct * 100).toFixed(1)}%)`],
                      ["Target (2R)", price(idea.target)],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <dt className="text-muted">{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div>
                  <dl className="num space-y-1 text-sm">
                    {[
                      ["Notional", `$${fmt(sizing.notional)}`],
                      ["Leverage", `${sizing.leverage.toFixed(2)}x${sizing.capped ? " (capped)" : ""}`],
                      ["Max loss at stop", `$${sizing.riskUsd.toFixed(2)}`],
                      ["Funding / day", `~$${sizing.fundingPerDay.toFixed(2)}`],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <dt className="text-muted">{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <button
                    onClick={openTrade}
                    className={cx(
                      "mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-bold text-black transition hover:brightness-110",
                      idea.side === "long" ? "bg-up" : "bg-down",
                    )}
                  >
                    Open paper {idea.side} {idea.market.name}
                  </button>
                  <a
                    href={`${STRIKE_APP}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block text-center text-[11px] text-muted underline decoration-dotted hover:text-ink"
                  >
                    Open Strike to trade live ↗
                  </a>
                </div>
              </div>
            </Card>

            <LiveTradePanel idea={idea} sizing={sizing} />
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4 lg:col-span-3">
            <Card title="Paper portfolio" right={<button className="text-[10px] text-muted hover:text-ink" onClick={() => setState(paper.emptyState())}>reset</button>}>
              <div className="p-4">
                <div className="num text-2xl font-bold">${equity.toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
                <div className={cx("num text-sm", pnl >= 0 ? "text-up" : "text-down")}>
                  {pnl >= 0 ? "+" : ""}
                  {pnl.toFixed(2)} ({((pnl / state.start) * 100).toFixed(2)}%)
                </div>
                <ul className="mt-3 space-y-2">
                  {state.positions.length === 0 && <li className="text-xs text-muted">No open positions. Open one from the order ticket.</li>}
                  {state.positions.map((p) => {
                    const m = liveMarks[p.symbol] ?? p.entry;
                    const u = paper.unrealized(p, m) + p.fundingPaid;
                    return (
                      <li key={p.id} className="rounded-lg border border-line bg-panel2 p-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-semibold">
                            {p.symbol} <Pill side={p.side} />
                          </span>
                          <button className="text-muted hover:text-ink" onClick={() => setState((s) => paper.close(s, p.id, m))}>
                            close
                          </button>
                        </div>
                        <div className="num mt-1 flex justify-between text-muted">
                          <span>
                            {price(p.entry)} → {price(m)}
                          </span>
                          <span className={u >= 0 ? "text-up" : "text-down"}>
                            {u >= 0 ? "+" : ""}
                            {u.toFixed(2)}
                          </span>
                        </div>
                        <div className="num text-[10px] text-muted">funding {p.fundingPaid >= 0 ? "+" : ""}{p.fundingPaid.toFixed(3)}</div>
                      </li>
                    );
                  })}
                </ul>
                {state.history.length > 0 && (
                  <div className="mt-3 border-t border-line pt-2 text-[11px] text-muted">
                    {state.history.slice(0, 3).map((h) => (
                      <div key={h.id} className="flex justify-between">
                        <span>
                          {h.symbol} {h.side} · {h.reason}
                        </span>
                        <span className={cx("num", h.pnl >= 0 ? "text-up" : "text-down")}>{h.pnl.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Card title="Smart-money attention" right={<span className="text-[10px] text-muted">{snap.smart.traders} top traders</span>}>
              <div className="space-y-2 p-4">
                {snap.smart.top.map((t) => (
                  <button key={t.symbol} className="block w-full text-left" onClick={() => setSelected(t.symbol)}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span>{t.symbol.replace("-USD", "")}</span>
                      <span className="num text-muted">{(t.share * 100).toFixed(1)}%</span>
                    </div>
                    <Bar value={t.share / (snap.smart.top[0]?.share || 1)} color="var(--accent)" />
                  </button>
                ))}
                <p className="pt-1 text-[10px] leading-snug text-muted">
                  Where Strike&apos;s highest copy-score traders concentrate, weighted by score and 7d PnL. Attention, not direction.
                </p>
              </div>
            </Card>

            <Card title="7d PnL leaders">
              <ol className="divide-y divide-line text-xs">
                {snap.leaders.map((l) => (
                  <li key={l.account_id} className="flex items-center justify-between px-4 py-2">
                    <span className="text-muted">#{l.rank}</span>
                    <span className="mx-2 min-w-0 flex-1 truncate">{l.nickname || l.ada_handle || `${l.blockchain_address.slice(0, 6)}…${l.blockchain_address.slice(-4)}`}</span>
                    <span className="num text-up">+${fmt(Number(l.total_pnl))}</span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      )}

      <footer className="mt-6 text-center text-[11px] leading-relaxed text-muted">
        Built for the Strike Hackathon on Strike&apos;s public API. Paper trading only. Signals are heuristics, not financial advice.
      </footer>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-lg border border-bolt/50 bg-panel px-4 py-2 text-sm shadow-lg">{toast}</div>
      )}
    </div>
  );
}
