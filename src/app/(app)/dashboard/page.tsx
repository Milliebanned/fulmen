"use client";

import Link from "next/link";
import { AnalystCard } from "@/components/AnalystCard";
import { Card, DONUT_COLORS, Delta, Donut, Dots, Loading, PageTitle, Pill, Spark, cx } from "@/components/ui";
import { fmt, price } from "@/lib/signals";
import { useApp } from "@/lib/store";

const STEPS = [
  { n: "1", title: "Find", text: "Every liquid Strike perp is scored from funding, momentum, smart-money attention and liquidity.", href: "/signals", cta: "Open Signals" },
  { n: "2", title: "Prove", text: "Replay the rule on 90 days of Strike history, per market or across all of them.", href: "/backtest", cta: "Open Backtest" },
  { n: "3", title: "Trade", text: "Size by risk, hard-capped at 5x and 2%, then paper-trade at live prices.", href: "/portfolio", cta: "Open Portfolio" },
] as const;

export default function Dashboard() {
  const app = useApp();
  const { snap, paper, equity, pnl, mark } = app;

  if (!snap || snap.ideas.length === 0) return <Loading error={app.error} empty={!!snap && snap.ideas.length === 0} />;

  const top = snap.ideas[0];
  const sentiment = snap.fearGreed?.value ?? 50;
  const exposure = paper.positions.reduce((a, p) => a + p.notional, 0);
  const donutItems = (() => {
    const t = snap.smart.top.slice(0, 5);
    const rest = Math.max(0, 1 - t.reduce((a, x) => a + x.share, 0));
    return [
      ...t.map((x, i) => ({ label: x.symbol.replace("-USD", ""), value: x.share, color: DONUT_COLORS[i] })),
      { label: "Others", value: rest, color: "#d6dcea" },
    ];
  })();

  return (
    <>
      <PageTitle title="Dashboard" subtitle="Live Strike markets, ranked and explained." />

      {/* KPI row */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Paper balance" tint="#2f6df6">
          <div className="px-4 pb-4 pt-1">
            <div className="flex items-baseline gap-2">
              <span className="num text-2xl font-bold">${equity.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
              <Delta v={(pnl / paper.start) * 100} suffix=" vs start" />
            </div>
            <div className="mt-3">
              <Dots value={Math.min(1, exposure / (equity * 5 || 1))} />
            </div>
            <p className="mt-2 text-[10px] text-muted">{paper.positions.length} open · exposure vs 5x guard</p>
          </div>
        </Card>
        <Card title="Top idea" tint="#e11d6a">
          <div className="px-4 pb-4 pt-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{top.market.name}</span>
              <Pill side={top.side} />
              <span className="num ml-auto text-lg font-bold text-bolt">{top.conviction}</span>
            </div>
            <div className="mt-3">
              <Dots value={top.conviction / 100} color="var(--down)" />
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
            <p className="mt-2 text-[10px] text-muted">all-time volume · {snap.summary ? snap.summary.total_users.toLocaleString() : "—"} traders</p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Top ideas */}
        <Card
          title="Top ideas right now"
          className="lg:col-span-5"
          right={
            <Link href="/signals" className="text-[11px] font-semibold text-accent hover:underline">
              all {snap.ideas.length} →
            </Link>
          }
        >
          <ul className="divide-y divide-line pb-2">
            {snap.ideas.slice(0, 6).map((i) => (
              <li key={i.market.symbol}>
                <Link
                  href="/signals"
                  onClick={() => app.select(i.market.symbol)}
                  className="mx-2 my-0.5 grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-panel2"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{i.market.name}</span>
                      <Pill side={i.side} />
                    </div>
                    <div className="num mt-0.5 text-[11px] text-muted">
                      {price(mark(i.market.symbol, i.market.mark))} · {i.market.fundingApr >= 0 ? "+" : ""}
                      {i.market.fundingApr.toFixed(0)}% funding
                    </div>
                  </div>
                  <Spark data={i.market.closes} up={i.market.change24h >= 0} />
                  <span className="num w-8 text-right text-lg font-bold text-bolt">{i.conviction}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        {/* Smart money */}
        <Card
          title="Smart-money attention"
          tint="#e11d6a"
          className="lg:col-span-4"
          right={<span className="text-[10px] text-muted">{snap.smart.traders} top traders</span>}
        >
          <div className="p-4 pt-2">
            <div className="flex items-center gap-4">
              <div className="relative h-32 w-32 shrink-0">
                <Donut items={donutItems} />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="num text-base font-bold">{snap.smart.traders}</span>
                  <span className="text-[9px] uppercase tracking-wider text-muted">traders</span>
                </div>
              </div>
              <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
                {donutItems.map((d) => (
                  <li key={d.label} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                    <span className="flex-1">{d.label}</span>
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

        <div className="lg:col-span-3">
          <AnalystCard />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        {/* How it works */}
        <div className="grid gap-3 sm:grid-cols-3 lg:col-span-8">
          {STEPS.map((s) => (
            <Link key={s.n} href={s.href} className="card group p-4 transition hover:-translate-y-0.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-black text-xs font-bold text-white">{s.n}</span>
              <h3 className="mt-3 text-base font-bold">{s.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">{s.text}</p>
              <span className="mt-3 inline-block text-[11px] font-semibold text-accent group-hover:underline">{s.cta} →</span>
            </Link>
          ))}
        </div>

        {/* Leaders */}
        <Card title="7d PnL leaders" tint="#16a34a" className="lg:col-span-4">
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
    </>
  );
}
