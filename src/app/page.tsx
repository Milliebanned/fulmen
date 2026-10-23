"use client";

import { useEffect, useMemo, useState } from "react";
import { GUARD, fmt, price, size, type Idea, type Reason } from "@/lib/signals";
import { STRIKE_APP } from "@/lib/strike";
import { PriceChart } from "@/components/PriceChart";
import { BacktestPanel } from "@/components/BacktestPanel";
import { LiveTradePanel } from "@/components/LiveTradePanel";
import { LIVE_ENABLED, STRIKE_ENV } from "@/lib/execution/config";
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
      <polyline fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth="1.8" strokeLinecap="round" points={pts} />
    </svg>
  );
}

function Pill({ side }: { side: "long" | "short" }) {
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

function Bar({ value, color = "var(--accent)" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel2">
      <div className="h-full rounded-full" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, background: color }} />
    </div>
  );
}

/** Dotted progress, echoing the reference's waffle bars. */
function Dots({ value, color = "var(--accent)" }: { value: number; color?: string }) {
  const on = Math.round(Math.min(1, Math.max(0, value)) * 24);
  return (
    <div className="flex flex-wrap gap-[3px]" aria-hidden>
      {Array.from({ length: 24 }, (_, i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: i < on ? color : "var(--line)" }} />
      ))}
    </div>
  );
}

function Delta({ v, suffix = "" }: { v: number; suffix?: string }) {
  return (
    <span className={cx("num text-[11px] font-semibold", v >= 0 ? "text-up" : "text-down")}>
      {v >= 0 ? "+" : ""}
      {v.toFixed(2)}%{suffix}
    </span>
  );
}

const toneColor: Record<Reason["tone"], string> = {
  good: "text-up",
  warn: "text-bolt",
  neutral: "text-muted",
};

function Card({
  title,
  right,
  children,
  className,
  id,
  tint = "var(--accent)",
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
  tint?: string;
}) {
  return (
    <section id={id} className={cx("card scroll-mt-4", className)}>
      <header className="flex items-center justify-between px-4 pb-1 pt-3.5">
        <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
          <span className="h-4 w-4 rounded-md" style={{ background: `color-mix(in srgb, ${tint} 18%, white)`, boxShadow: `inset 0 0 0 4px color-mix(in srgb, ${tint} 55%, white)` }} />
          {title}
        </h2>
        {right ?? <span className="text-muted">›</span>}
      </header>
      {children}
    </section>
  );
}

function Donut({ items }: { items: { label: string; value: number; color: string }[] }) {
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

const DONUT_COLORS = ["#2f6df6", "#e11d6a", "#16a34a", "#f59e0b", "#6d5ef6"];

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
  // One source of truth: stop/target anchored on the same live mark the chart, ticket and paper fill use.
  const lv = idea
    ? (() => {
        const m = mark(idea.market.symbol, idea.entry);
        const dir = idea.side === "long" ? 1 : -1;
        return { m, stop: m * (1 - dir * idea.stopPct), target: m * (1 + dir * idea.stopPct * 2) };
      })()
    : null;

  function openTrade() {
    if (!idea || !sizing) return;
    const m = mark(idea.market.symbol, idea.entry);
    if (!(m > 0) || !lv) return;
    setState((s) => paper.open(s, { symbol: idea.market.symbol, side: idea.side, entry: lv.m, notional: sizing.notional, stop: lv.stop, target: lv.target }));
    setToast(`Paper ${idea.side} ${idea.market.symbol} opened at ${price(m)}`);
    setTimeout(() => setToast(null), 3000);
  }

  const sentiment = snap?.fearGreed?.value ?? 50;
  const donutItems = snap
    ? (() => {
        const top = snap.smart.top.slice(0, 5);
        const rest = Math.max(0, 1 - top.reduce((a, t) => a + t.share, 0));
        return [
          ...top.map((t, i) => ({ label: t.symbol.replace("-USD", ""), value: t.share, color: DONUT_COLORS[i] })),
          { label: "Others", value: rest, color: "#d6dcea" },
        ];
      })()
    : [];

  return (
    <div className="mx-auto w-full max-w-[1500px] flex-1 px-3 pb-10 pt-4 sm:px-6">
      <div className="frame p-3 sm:p-5">
        {/* Top bar */}
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-black text-lg text-white">⚡</div>
            <div className="leading-tight">
              <h1 className="text-lg font-bold tracking-tight">Fulmen</h1>
              <p className="text-[11px] text-muted">Signal to trade for Strike</p>
            </div>
          </div>
          <nav className="order-last flex w-full justify-center gap-1.5 rounded-full bg-white/70 p-1 text-xs font-semibold shadow-sm sm:order-none sm:w-auto" aria-label="Sections">
            {[
              ["Dashboard", "#top", true],
              ["Signals", "#signals", false],
              ["Backtest", "#backtest", false],
              ["Portfolio", "#portfolio", false],
            ].map(([label, href, active]) => (
              <a
                key={label as string}
                href={href as string}
                className={cx("rounded-full px-3.5 py-1.5 transition", active ? "bg-ink-black text-white" : "text-ink/70 hover:bg-white")}
              >
                {label as string}
              </a>
            ))}
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
        <span id="top" />

        {error && !snap && (
          <div className="card p-4 text-sm text-down">Could not reach Strike: {error}</div>
        )}
        {!snap && !error && <div className="p-10 text-center text-muted">Loading live Strike markets…</div>}

        {snap && !idea && (
          <div className="card p-6 text-center text-sm text-muted">
            No liquid markets pass the volume and open-interest filters right now. Data refreshes every 20 seconds.
          </div>
        )}

        {snap && idea && sizing && (
          <>
            {/* KPI row */}
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card title="Paper balance" tint="#2f6df6">
                <div className="px-4 pb-4 pt-1">
                  <div className="flex items-baseline gap-2">
                    <span className="num text-2xl font-bold">${equity.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                    <Delta v={(pnl / state.start) * 100} suffix=" vs start" />
                  </div>
                  <div className="mt-3">
                    <Dots value={Math.min(1, state.positions.reduce((a, p) => a + p.notional, 0) / (equity * 5 || 1))} />
                  </div>
                  <p className="mt-2 text-[10px] text-muted">{state.positions.length} open · exposure vs 5x guard</p>
                </div>
              </Card>
              <Card title="Top idea" tint="#e11d6a">
                <div className="px-4 pb-4 pt-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{snap.ideas[0].market.name}</span>
                    <Pill side={snap.ideas[0].side} />
                    <span className="num ml-auto text-lg font-bold text-bolt">{snap.ideas[0].conviction}</span>
                  </div>
                  <div className="mt-3">
                    <Dots value={snap.ideas[0].conviction / 100} color="var(--down)" />
                  </div>
                  <p className="mt-2 text-[10px] text-muted">highest conviction right now</p>
                </div>
              </Card>
              <Card title="Market sentiment" tint="#16a34a">
                <div className="px-4 pb-4 pt-1">
                  <div className="flex items-baseline gap-2">
                    <span className="num text-2xl font-bold">{snap.fearGreed?.value ?? "—"}</span>
                    <span className="text-xs font-semibold text-muted">{snap.fearGreed?.classification ?? ""}</span>
                  </div>
                  <div className="relative mt-4 h-1.5 rounded-full" style={{ background: "linear-gradient(90deg,#e11d6a,#f59e0b,#16a34a)" }}>
                    <span className="absolute -top-1 h-3.5 w-1.5 rounded-full bg-ink-black" style={{ left: `calc(${Math.min(100, Math.max(0, sentiment))}% - 3px)` }} />
                  </div>
                  <p className="mt-2 text-[10px] text-muted">Strike fear and greed index</p>
                </div>
              </Card>
              <Card title="Strike activity" tint="#f59e0b">
                <div className="px-4 pb-4 pt-1">
                  <div className="num text-2xl font-bold">${snap.summary ? fmt(Number(snap.summary.total_volume_usd)) : "—"}</div>
                  <div className="mt-3">
                    <Dots value={0.72} color="var(--bolt)" />
                  </div>
                  <p className="mt-2 text-[10px] text-muted">
                    all-time volume · {snap.summary ? snap.summary.total_users.toLocaleString() : "—"} traders
                  </p>
                </div>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-12">
              {/* Signal board */}
              <Card
                id="signals"
                title={`Signal board · ${snap.ideas.length}`}
                className="self-start lg:sticky lg:top-4 lg:col-span-3"
                right={<span className="text-[10px] text-muted">by conviction</span>}
              >
                <ul className="scroll-thin max-h-[640px] divide-y divide-line overflow-y-auto pb-2">
                  {snap.ideas.map((i) => {
                    const active = i.market.symbol === idea.market.symbol;
                    const m = i.market;
                    return (
                      <li key={m.symbol}>
                        <button
                          onClick={() => setSelected(m.symbol)}
                          className={cx(
                            "mx-2 my-0.5 grid w-[calc(100%-1rem)] grid-cols-[1fr_auto] items-center gap-2 rounded-xl px-3 py-2.5 text-left transition hover:bg-panel2",
                            active && "bg-ink-black text-white hover:bg-ink-black",
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{m.name}</span>
                              <Pill side={i.side} />
                            </div>
                            <div className={cx("mt-1 flex items-center gap-2 text-[11px]", active ? "text-white/70" : "text-muted")}>
                              <span className="num">{price(mark(m.symbol, m.mark))}</span>
                              <span className="num font-semibold" style={{ color: active ? "#fbbf24" : "var(--bolt)" }}>{i.conviction}</span>
                              <span className="num">{m.fundingApr >= 0 ? "+" : ""}{m.fundingApr.toFixed(0)}% fund</span>
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
              <div className="flex flex-col gap-4 lg:col-span-6">
                <Card
                  title="Trade idea"
                  tint="#6d5ef6"
                  right={<span className="num text-[11px] text-muted">updated {new Date(snap.updatedAt).toLocaleTimeString()}</span>}
                >
                  <div className="p-4 pt-2">
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

                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {(
                        [
                          ["Funding carry", idea.parts.carry, "#2f6df6"],
                          ["Momentum", idea.parts.momentum, "#16a34a"],
                          ["Smart money", idea.parts.attention, "#6d5ef6"],
                          ["Liquidity", idea.parts.liquidity, "#f59e0b"],
                        ] as const
                      ).map(([label, v, c]) => (
                        <div key={label} className="rounded-xl bg-panel2 px-3 py-2">
                          <div className="mb-1.5 flex justify-between text-[10px] uppercase tracking-wider text-muted">
                            <span>{label}</span>
                            <span className="num">{Math.round(v * 100)}</span>
                          </div>
                          <Bar value={v} color={c} />
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
                  </div>
                </Card>

                <PriceChart
                  symbol={idea.market.symbol}
                  side={idea.side}
                  entry={lv?.m}
                  stop={lv?.stop}
                  target={lv?.target}
                  livePrice={marks[idea.market.symbol]}
                />

                <div id="backtest" className="scroll-mt-4">
                  <BacktestPanel symbol={idea.market.symbol} />
                </div>

                <Card title="Order ticket · risk guard on" tint="#16a34a" right={<span className="text-[10px] text-muted">max {GUARD.maxLeverage}x · max {GUARD.maxRiskPct * 100}% risk</span>}>
                  <div className="grid gap-4 p-4 pt-2 sm:grid-cols-2">
                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-muted">Risk per trade: {(riskPct * 100).toFixed(1)}% of equity</label>
                      <input
                        type="range"
                        min={0.0025}
                        max={0.03}
                        step={0.0025}
                        value={riskPct}
                        onChange={(e) => setRiskPct(parseFloat(e.target.value))}
                        className="mt-2 w-full accent-[var(--ink-black)]"
                      />
                      {riskPct > GUARD.maxRiskPct && (
                        <p className="mt-1 text-[11px] text-bolt">Guard caps risk at {GUARD.maxRiskPct * 100}%.</p>
                      )}
                      <dl className="num mt-3 space-y-1 text-sm">
                        {[
                          ["Entry", price(mark(idea.market.symbol, idea.entry))],
                          ["Stop", `${price(lv?.stop ?? idea.stop)} (−${(idea.stopPct * 100).toFixed(1)}%)`],
                          ["Target (2R)", price(lv?.target ?? idea.target)],
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
                        className="mt-3 w-full rounded-full bg-ink-black px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                      >
                        + Open paper {idea.side} {idea.market.name}
                      </button>
                      <a
                        href={STRIKE_APP}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block text-center text-[11px] text-muted underline decoration-dotted hover:text-ink"
                      >
                        Open Strike to trade live ↗
                      </a>
                    </div>
                  </div>
                </Card>

                <LiveTradePanel key={`${idea.market.symbol}:${idea.side}`} idea={idea} sizing={sizing} />
              </div>

              {/* Right column */}
              <div className="flex flex-col gap-4 lg:col-span-3">
                <section className="glass-blue relative overflow-hidden p-4">
                  <div className="mb-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-[#2a4fb0]">
                    <span>Fulmen analyst</span>
                    <span>{aiLoading ? "thinking…" : ai?.source === "gemini" ? "Gemini" : ai?.source === "claude" ? "Claude" : "auto summary"}</span>
                  </div>
                  <div className="mb-3 flex justify-center py-2">
                    <div className="orb" />
                  </div>
                  <div className="rounded-2xl bg-white/80 p-3 shadow-sm">
                    <div className="mb-1 text-[11px] font-bold text-[#1d49c4]">
                      {idea.market.name} {idea.side.toUpperCase()} · {idea.conviction}/100
                    </div>
                    <p className="text-[13px] leading-relaxed text-ink/90">
                      {ai && ai.symbol === idea.market.symbol ? ai.text : aiLoading ? "Reading the live numbers…" : "—"}
                    </p>
                  </div>
                  <p className="mt-2 text-[10px] text-[#2a4fb0]/80">Cites only live Strike data. Not financial advice.</p>
                </section>

                <Card
                  id="portfolio"
                  title="Paper portfolio"
                  tint="#2f6df6"
                  right={<button className="text-[10px] font-semibold text-muted hover:text-ink" onClick={() => setState(paper.emptyState())}>reset</button>}
                >
                  <div className="p-4 pt-1">
                    <div className="num text-2xl font-bold">${equity.toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
                    <div className="mt-0.5">
                      <span className={cx("num text-sm font-semibold", pnl >= 0 ? "text-up" : "text-down")}>
                        {pnl >= 0 ? "+" : ""}
                        {pnl.toFixed(2)}
                      </span>{" "}
                      <Delta v={(pnl / state.start) * 100} />
                    </div>
                    <ul className="mt-3 space-y-2">
                      {state.positions.length === 0 && <li className="text-xs text-muted">No open positions. Open one from the order ticket.</li>}
                      {state.positions.map((p) => {
                        const m = liveMarks[p.symbol] ?? p.entry;
                        const u = paper.unrealized(p, m) + p.fundingPaid;
                        return (
                          <li key={p.id} className="rounded-xl bg-panel2 p-2.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1.5 font-semibold">
                                {p.symbol} <Pill side={p.side} />
                              </span>
                              <button className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-muted shadow-sm hover:text-ink" onClick={() => setState((s) => paper.close(s, p.id, m))}>
                                close
                              </button>
                            </div>
                            <div className="num mt-1 flex justify-between text-muted">
                              <span>
                                {price(p.entry)} → {price(m)}
                              </span>
                              <span className={cx("font-semibold", u >= 0 ? "text-up" : "text-down")}>
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

                <Card title="Smart-money attention" tint="#e11d6a" right={<span className="text-[10px] text-muted">{snap.smart.traders} top traders</span>}>
                  <div className="p-4 pt-2">
                    <div className="flex items-center gap-4">
                      <div className="relative h-28 w-28 shrink-0">
                        <Donut items={donutItems} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="num text-sm font-bold">{snap.smart.traders}</span>
                          <span className="text-[9px] uppercase tracking-wider text-muted">traders</span>
                        </div>
                      </div>
                      <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
                        {donutItems.map((d) => (
                          <li key={d.label} className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                            <button
                              className="flex-1 text-left hover:underline"
                              onClick={() => d.label !== "Others" && setSelected(`${d.label}-USD`)}
                            >
                              {d.label}
                            </button>
                            <span className="num text-muted">{(d.value * 100).toFixed(1)}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p className="pt-3 text-[10px] leading-snug text-muted">
                      Where Strike&apos;s highest copy-score traders concentrate, weighted by score and 7d PnL. Attention, not direction.
                    </p>
                  </div>
                </Card>

                <Card title="7d PnL leaders" tint="#16a34a">
                  <ol className="divide-y divide-line px-1 pb-2 text-xs">
                    {snap.leaders.map((l) => (
                      <li key={l.account_id} className="flex items-center justify-between px-3 py-2">
                        <span className="num w-6 text-muted">#{l.rank}</span>
                        <span className="mx-2 min-w-0 flex-1 truncate">
                          {l.nickname || l.ada_handle || (l.blockchain_address ? `${l.blockchain_address.slice(0, 6)}…${l.blockchain_address.slice(-4)}` : "anonymous")}
                        </span>
                        <span className={cx("num font-semibold", Number(l.total_pnl) >= 0 ? "text-up" : "text-down")}>
                          {Number(l.total_pnl) >= 0 ? "+" : "−"}${fmt(Math.abs(Number(l.total_pnl)))}
                        </span>
                      </li>
                    ))}
                  </ol>
                </Card>
              </div>
            </div>
          </>
        )}

        <footer className="mt-6 text-center text-[11px] leading-relaxed text-muted">
          Built for the Strike Hackathon on Strike&apos;s API. The portfolio panel is paper trading; live orders exist only when a builder code is configured. Signals are heuristics, not financial advice.
        </footer>
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-ink-black px-4 py-2 text-sm text-white shadow-lg">{toast}</div>
      )}
    </div>
  );
}
