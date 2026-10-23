import Image from "next/image";
import Link from "next/link";
import { LiveCards } from "@/components/landing/LiveCards";

const REPO = "https://github.com/Milliebanned/fulmen";

const NAVLINKS = [
  ["Product", "#product"],
  ["How it works", "#how"],
  ["Built on Strike", "#strike"],
  ["FAQ", "#faq"],
] as const;

const STEPS = [
  {
    n: "01",
    title: "Find",
    text: "Every liquid Strike perp is scored 0 to 100 from hourly funding, momentum, where top traders concentrate, and liquidity. Thin and erratic markets are filtered out.",
  },
  {
    n: "02",
    title: "Explain",
    text: "Each idea comes with direction, entry, stop, target and the reasons behind it. An AI analyst restates only the live numbers, never invents any.",
  },
  {
    n: "03",
    title: "Prove",
    text: "Replay the rule on up to 90 days of Strike history, for one market or all of them, with fees and funding shown separately from price moves.",
  },
  {
    n: "04",
    title: "Trade",
    text: "Size the position from the risk you choose. A hard guard caps leverage at 5x and risk at 2% of equity. Practise on a paper account at live prices.",
  },
] as const;

const UNDER_THE_HOOD = [
  ["~3s", "live mark prices over Strike's WebSocket"],
  ["Hourly", "funding, accrued the way Strike settles it"],
  ["90 days", "of hourly history in every backtest"],
  ["5x · 2%", "hard caps on leverage and risk per trade"],
] as const;

const ENDPOINTS = [
  "Market stats",
  "Funding rates",
  "Klines",
  "Sparklines",
  "Fear and greed",
  "Copy-trader discovery",
  "PnL leaderboard",
  "Platform stats",
  "Funding history",
  "Mark-price WebSocket",
] as const;

const FAQ = [
  [
    "Is this trading real money?",
    "By default no. The portfolio is a paper account that fills at Strike's live mark prices, with no slippage or fees. Live order routing through Strike's builder codes is written and testnet-first, but it is switched off unless a builder code is configured and has not yet been proven end to end with a funded wallet.",
  ],
  [
    "Is it financial advice?",
    "No. Scores are transparent heuristics, not predictions. Funding carry can be erased by one adverse price move, which is why every idea carries a stop.",
  ],
  [
    "Where does the data come from?",
    "Strike's own public API: market stats, hourly funding, klines, copy-trader discovery, the PnL leaderboard and the mark-price WebSocket. No keys needed for any of it.",
  ],
  [
    "What does smart money mean here?",
    "Strike's public data shows which assets its highest copy-score traders concentrate on, not whether they are long or short. So Fulmen calls it attention, not positioning.",
  ],
  [
    "How good is the strategy?",
    "We show the real numbers. Across the liquid markets we tested over 90 days the rule was roughly break-even after fees, with funding a steady positive and price noise deciding the rest. We did not tune it to look better.",
  ],
] as const;

function Bolt({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center justify-center rounded-xl bg-ink-black text-white ${className}`} aria-hidden>
      ⚡
    </span>
  );
}

function Frame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[0_30px_80px_rgba(30,60,160,0.28)]">
      <div className="flex items-center gap-1.5 border-b border-line bg-panel2 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
      </div>
      <Image src={src} alt={alt} width={1456} height={815} className="h-auto w-full" />
    </div>
  );
}

export default function Landing() {
  return (
    <main className="overflow-x-clip text-ink">
      {/* ───────────── Hero (structure from the reference pin, recoloured to Fulmen blue) ───────────── */}
      <section
        className="relative isolate px-3 pb-24 pt-24 sm:px-6"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 0%, #4f86ff 0%, #2456e6 32%, #123099 62%, #0a1a5c 100%)",
        }}
      >
        {/* floating nav pill */}
        <header className="fixed inset-x-0 top-4 z-50 flex justify-center px-3">
          <nav
            className="flex w-full max-w-5xl items-center justify-between gap-3 rounded-full border border-white/70 bg-white/90 py-2 pl-3 pr-2 shadow-lg backdrop-blur-md"
            aria-label="Primary"
          >
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
              <Bolt className="h-8 w-8 text-sm" />
              Fulmen
            </Link>
            <div className="hidden items-center gap-1 text-[13px] font-medium text-ink/70 md:flex">
              {NAVLINKS.map(([label, href]) => (
                <a key={href} href={href} className="rounded-full px-3.5 py-1.5 transition hover:bg-panel2 hover:text-ink">
                  {label}
                </a>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <a href={REPO} target="_blank" rel="noreferrer" className="hidden rounded-full px-3.5 py-1.5 text-[13px] font-medium text-ink/70 hover:text-ink sm:block">
                GitHub
              </a>
              <Link href="/dashboard" className="rounded-full bg-ink-black px-4 py-2 text-[13px] font-semibold text-white transition hover:opacity-90">
                Launch app →
              </Link>
            </div>
          </nav>
        </header>

        {/* big rounded statement panel */}
        <div className="relative mx-auto max-w-5xl">
          <div
            className="rise relative rounded-[40px] px-6 py-20 text-center shadow-[0_40px_120px_rgba(5,15,70,0.55)] sm:px-14 sm:py-28"
            style={{ background: "linear-gradient(180deg, #d6e5ff 0%, #a9c7ff 100%)" }}
          >
            <span className="mx-auto inline-flex items-center gap-2 rounded-full bg-white/70 px-3.5 py-1.5 text-xs font-semibold text-[#1d49c4] shadow-sm">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-accent" />
              Built for the Strike Hackathon
            </span>

            <h1 className="mx-auto mt-7 max-w-3xl text-balance text-[28px] font-medium leading-[1.25] tracking-tight text-[#0b1d5e] sm:text-4xl md:text-[44px]">
              Fulmen is a trading terminal for Strike that finds the trade, explains why, sizes the risk, and tests
              the rule on history before you place it.
            </h1>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link href="/dashboard" className="rounded-full bg-ink-black px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5">
                Launch the terminal →
              </Link>
              <a href="#how" className="rounded-full bg-white/80 px-6 py-3 text-sm font-semibold text-[#0b1d5e] shadow-sm transition hover:bg-white">
                See how it works
              </a>
            </div>
            <p className="mt-5 text-xs text-[#0b1d5e]/70">Paper trading by default. Live Strike data. No sign-up.</p>

            <LiveCards />
          </div>
        </div>

        <p className="mx-auto mt-14 max-w-3xl text-center text-xs font-medium uppercase tracking-[0.2em] text-white/60">
          Powered by Strike&apos;s public API &nbsp;·&nbsp; Live WebSocket &nbsp;·&nbsp; Gemini or Claude analyst
        </p>
      </section>

      {/* ───────────── Product ───────────── */}
      <section id="product" className="scroll-mt-24 px-3 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-accent">The product</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-balance text-center text-3xl font-bold tracking-tight sm:text-4xl">
            One loop, four pages. Everything between a hunch and a sized trade.
          </h2>

          <div className="mt-16 grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">Signals</span>
              <h3 className="mt-4 text-2xl font-bold tracking-tight">See why a market is ranked, not just that it is.</h3>
              <p className="mt-3 leading-relaxed text-muted">
                A conviction score from 0 to 100 breaks into funding carry, momentum, smart-money attention and liquidity. The chart
                draws entry, stop and target as shaded risk and reward zones, and the order ticket sizes the trade to the risk you pick.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-ink/80">
                {["Reasons in plain English, with the numbers", "Risk guard: max 5x leverage, max 2% risk", "Live candles update from Strike's WebSocket"].map((t) => (
                  <li key={t} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <Frame src="/shots/signals.jpg" alt="Fulmen Signals page: ranked markets, explained trade idea and candlestick chart" />
          </div>

          <div className="mt-24 grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="order-2 lg:order-1">
              <Frame src="/shots/backtest.jpg" alt="Fulmen Backtest page: equity curve and all-markets comparison" />
            </div>
            <div className="order-1 lg:order-2">
              <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">Backtest</span>
              <h3 className="mt-4 text-2xl font-bold tracking-tight">Show the receipts, even when they are flat.</h3>
              <p className="mt-3 leading-relaxed text-muted">
                Run the rule across every liquid market on 90 days of Strike history. Funding, price and fees are split out, so you can
                see what actually earned money. We did not tune it, and the page says so.
              </p>
            </div>
          </div>

          <div className="mt-24 grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">Dashboard and portfolio</span>
              <h3 className="mt-4 text-2xl font-bold tracking-tight">A paper account that behaves like Strike.</h3>
              <p className="mt-3 leading-relaxed text-muted">
                Fills at the live mark, automatic stops and targets, and funding that accrues at Strike&apos;s hourly rate. Track exposure,
                win rate and profit factor from your own trades. Nothing is invented.
              </p>
            </div>
            <Frame src="/shots/dashboard.jpg" alt="Fulmen Dashboard: stat cards, top ideas, smart-money donut and analyst" />
          </div>
        </div>
      </section>

      {/* ───────────── How it works ───────────── */}
      <section id="how" className="scroll-mt-24 px-3 py-24 sm:px-6">
        <div
          className="mx-auto max-w-6xl rounded-[40px] px-5 py-16 sm:px-12"
          style={{ background: "linear-gradient(160deg, #1b43c9 0%, #2f6df6 55%, #5b8dff 100%)" }}
        >
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/70">How it works</p>
          <h2 className="mx-auto mt-3 max-w-xl text-balance text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Find. Explain. Prove. Trade.
          </h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-3xl border border-white/30 bg-white/12 p-6 backdrop-blur-sm" style={{ background: "rgba(255,255,255,0.12)" }}>
                <div className="num text-sm font-bold text-white/60">{s.n}</div>
                <h3 className="mt-6 text-xl font-bold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/80">{s.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 grid grid-cols-2 gap-4 border-t border-white/20 pt-10 lg:grid-cols-4">
            {UNDER_THE_HOOD.map(([big, small]) => (
              <div key={big}>
                <div className="num text-3xl font-bold text-white">{big}</div>
                <p className="mt-1 text-xs leading-snug text-white/75">{small}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── Built on Strike ───────────── */}
      <section id="strike" className="scroll-mt-24 px-3 py-24 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Built on Strike</p>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">Every number on screen comes from Strike.</h2>
            <p className="mt-4 leading-relaxed text-muted">
              Fulmen reads Strike&apos;s public endpoints directly from the browser, so there is nothing to sign up for and nothing in between.
              Funding is treated the way Strike settles it: hourly, positive means longs pay shorts.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {ENDPOINTS.map((e) => (
                <span key={e} className="rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-semibold text-ink/80 shadow-sm">
                  {e}
                </span>
              ))}
            </div>
          </div>
          <div className="card p-7">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent">
              <span className="h-2 w-2 rounded-full bg-accent" /> The growth loop
            </div>
            <h3 className="mt-3 text-xl font-bold tracking-tight">Builder codes turn ideas into Strike volume.</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Strike lets apps route orders for users and keep a share of each fill, up to 1%. Fulmen has that path written: wallet connect,
              request signing, and bracket orders with a live stop and target, testnet-first.
            </p>
            <div className="mt-5 rounded-2xl bg-panel2 p-4 text-xs leading-relaxed text-ink/80">
              <b className="text-ink">Honest status:</b> the code is in the repo and its signing is unit-checked. It is disabled by default and has not
              yet been run end to end with a funded wallet, so the app ships in paper mode.
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── FAQ ───────────── */}
      <section id="faq" className="scroll-mt-24 px-3 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-accent">FAQ</p>
          <h2 className="mt-3 text-center text-3xl font-bold tracking-tight sm:text-4xl">Straight answers.</h2>
          <div className="mt-10 space-y-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="card group p-5 open:shadow-lg">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {q}
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-panel2 text-lg leading-none transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── Final CTA + footer ───────────── */}
      <section className="px-3 pb-10 sm:px-6">
        <div
          className="mx-auto max-w-6xl rounded-[40px] px-6 py-20 text-center"
          style={{ background: "radial-gradient(ellipse 80% 120% at 50% 0%, #4f86ff 0%, #1d46d4 45%, #0a1a5c 100%)" }}
        >
          <h2 className="mx-auto max-w-2xl text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
            See what Strike is paying you to hold, right now.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/75">Live data, a paper account and no sign-up. Open the terminal and try an idea.</p>
          <Link href="/dashboard" className="mt-8 inline-block rounded-full bg-white px-7 py-3.5 text-sm font-bold text-[#0b1d5e] shadow-xl transition hover:-translate-y-0.5">
            Launch the terminal →
          </Link>
        </div>

        <footer className="mx-auto mt-8 flex max-w-6xl flex-col items-center justify-between gap-3 px-2 text-xs text-muted sm:flex-row">
          <div className="flex items-center gap-2 font-semibold text-ink">
            <Bolt className="h-6 w-6 text-xs" /> Fulmen
          </div>
          <p className="max-w-xl text-center leading-relaxed sm:text-left">
            Built for the Strike Hackathon. Independent project, not affiliated with Strike. Paper trading only by default. Signals are heuristics, not
            financial advice.
          </p>
          <div className="flex gap-4 font-medium">
            <a href={REPO} target="_blank" rel="noreferrer" className="hover:text-ink">
              GitHub
            </a>
            <a href="https://docs.strikefinance.org" target="_blank" rel="noreferrer" className="hover:text-ink">
              Strike docs
            </a>
          </div>
        </footer>
      </section>
    </main>
  );
}
