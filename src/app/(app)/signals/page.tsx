"use client";

import { AnalystCard } from "@/components/AnalystCard";
import { LiveTradePanel } from "@/components/LiveTradePanel";
import { PriceChart } from "@/components/PriceChart";
import { Bar, Card, Loading, PageTitle, Pill, Spark, cx, toneColor } from "@/components/ui";
import { GUARD, fmt, price } from "@/lib/signals";
import { STRIKE_APP } from "@/lib/strike";
import { useApp } from "@/lib/store";

export default function SignalsPage() {
  const app = useApp();
  const { snap, idea, sizing, lv, mark } = app;

  if (!snap || !idea || !sizing) return <Loading error={app.error} empty={!!snap && !idea} />;

  return (
    <>
      <PageTitle
        title="Signals"
        subtitle="Pick a market, read why Fulmen likes it, size it with the risk guard, and trade it."
      />
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Signal board */}
        <Card
          title={`Signal board · ${snap.ideas.length}`}
          className="self-start lg:sticky lg:top-24 lg:col-span-3"
          right={<span className="text-[10px] text-muted">by conviction</span>}
        >
          <ul className="scroll-thin max-h-[680px] divide-y divide-line overflow-y-auto pb-2">
            {snap.ideas.map((i) => {
              const active = i.market.symbol === idea.market.symbol;
              const m = i.market;
              return (
                <li key={m.symbol}>
                  <button
                    onClick={() => app.select(m.symbol)}
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
                        <span className="num font-semibold" style={{ color: active ? "#fbbf24" : "var(--bolt)" }}>
                          {i.conviction}
                        </span>
                        <span className="num">
                          {m.fundingApr >= 0 ? "+" : ""}
                          {m.fundingApr.toFixed(0)}% fund
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
                    <h2 className="text-2xl font-bold">{idea.market.symbol}</h2>
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
            livePrice={app.marks[idea.market.symbol]}
          />

          <Card
            title="Order ticket · risk guard on"
            tint="#16a34a"
            right={
              <span className="text-[10px] text-muted">
                max {GUARD.maxLeverage}x · max {GUARD.maxRiskPct * 100}% risk
              </span>
            }
          >
            <div className="grid gap-4 p-4 pt-2 sm:grid-cols-2">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted">Risk per trade: {(app.riskPct * 100).toFixed(1)}% of equity</label>
                <input
                  type="range"
                  min={0.0025}
                  max={0.03}
                  step={0.0025}
                  value={app.riskPct}
                  onChange={(e) => app.setRiskPct(parseFloat(e.target.value))}
                  className="mt-2 w-full accent-[var(--ink-black)]"
                />
                {app.riskPct > GUARD.maxRiskPct && <p className="mt-1 text-[11px] text-bolt">Guard caps risk at {GUARD.maxRiskPct * 100}%.</p>}
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
                  onClick={app.openTrade}
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
          <AnalystCard />
        </div>
      </div>
    </>
  );
}
