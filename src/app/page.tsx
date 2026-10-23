import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { LiveBacktestCard } from "@/components/landing/LiveBacktestCard";
import { LiveCards } from "@/components/landing/LiveCards";
import { LazyFundingFlow3D, LazyHero3D } from "@/components/landing/Lazy3D";
import ScoreStack3D from "@/components/landing/ScoreStack3D";

const REPO = "https://github.com/Milliebanned/fulmen";

const NAVLINKS = [
  ["Score", "#score"],
  ["Funding", "#funding"],
  ["Proof", "#proof"],
  ["FAQ", "#faq"],
] as const;

// The "logo wall" of the reference, used for what Fulmen is actually built on.
const SOURCES = [
  ["Hourly funding", "M3 12h4l3-8 4 16 3-8h4"],
  ["Live candles", "M6 4v16M6 8h3v6H6M15 6v14M15 10h3v6h-3"],
  ["Mark-price feed", "M4 14a8 8 0 0 1 16 0M12 14l4-5"],
  ["Copy-trader data", "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M2 20a6 6 0 0 1 12 0M16 11a3 3 0 1 0 0-6M17 14a5 5 0 0 1 5 6"],
  ["PnL leaderboard", "M5 20V10M12 20V4M19 20v-7"],
  ["Fear and greed", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"],
  ["Platform stats", "M4 19h16M7 16v-4M12 16V8M17 16v-7"],
  ["90-day history", "M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 8v4l3 2"],
] as const;

const FAQ = [
  [
    "Is this trading real money?",
    "By default no. The portfolio is a paper account that fills at Strike's live mark prices, with no slippage or fees. Live order routing through Strike's builder codes is written and testnet-first, but it is switched off unless a builder code is configured, and it has not yet been proven end to end with a funded wallet.",
  ],
  [
    "Is it financial advice?",
    "No. Scores are transparent heuristics, not predictions. Funding carry can be erased by one adverse price move, which is why every idea carries a stop.",
  ],
  [
    "Where does the data come from?",
    "Strike's own public API: market stats, hourly funding, klines, copy-trader discovery, the PnL leaderboard and the mark-price WebSocket. No keys are needed for any of it.",
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

export default function Landing() {
  return (
    <main className="overflow-x-clip text-ink">
      {/* ───────────── Hero: big rounded panel on a deep-blue field ───────────── */}
      <section
        className="relative isolate p-2.5 sm:p-5"
        style={{ background: "radial-gradient(ellipse 80% 70% at 30% 0%, #2a5fe8 0%, #11308f 45%, #07123d 100%)" }}
      >
        <div
          className="rise relative mx-auto flex min-h-[calc(100svh-1.25rem)] max-w-[1500px] flex-col overflow-hidden rounded-[28px] p-3 shadow-[0_40px_120px_rgba(3,10,50,0.6)] sm:rounded-[34px] sm:p-5"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 22% 18%, rgba(127,170,255,0.75) 0%, rgba(190,214,255,0.55) 40%, transparent 70%), linear-gradient(180deg, #e6efff 0%, #f6f9ff 62%, #ffffff 100%)",
          }}
        >
          {/* nav pill inside the panel */}
          <nav className="relative z-20 flex items-center justify-between gap-3 rounded-full bg-white/90 py-2 pl-4 pr-2 shadow-sm backdrop-blur" aria-label="Primary">
            <Link href="/" className="flex items-center gap-2 text-sm font-bold tracking-tight">
              <LogoMark className="h-7 w-7" />
              Fulmen
            </Link>
            <div className="hidden items-center gap-1 text-[12px] font-medium text-ink/70 md:flex">
              {NAVLINKS.map(([label, href]) => (
                <a key={href} href={href} className="rounded-full px-4 py-1.5 transition hover:bg-panel2 hover:text-ink">
                  {label}
                </a>
              ))}
            </div>
            <Link href="/dashboard" className="rounded-full px-4 py-2 text-[12px] font-semibold text-[#0b1d5e] transition hover:bg-panel2">
              Open terminal →
            </Link>
          </nav>

          {/* headline + 3D object */}
          <div className="relative z-10 flex flex-1 flex-col">
            <div className="relative pt-10 sm:pt-14 lg:max-w-[50%]">
              <h1 className="text-balance text-[38px] font-medium leading-[1.04] tracking-[-0.03em] text-[#0b1d5e] sm:text-5xl lg:text-[58px]">
                Meet Fulmen, the <span className="text-[#3f74ff]">signal-to-trade</span> terminal for Strike
              </h1>
              <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-[#0b1d5e]/70">
                It finds the trade, explains why, sizes the risk, and tests the rule on history before you place it.
              </p>
            </div>

            <div className="pointer-events-none absolute -right-2 top-2 hidden h-[80%] w-[52%] lg:block">
              <div className="pointer-events-auto relative h-full w-full">
                <LazyHero3D className="h-full w-full" />
                <LiveCards />
              </div>
            </div>
            <div className="relative mt-4 h-56 w-full lg:hidden">
              <LazyHero3D className="h-full w-full" />
            </div>

            {/* bottom row: CTA left, data wall right (the reference's logo grid) */}
            <div className="mt-auto grid items-end gap-8 pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,640px)]">
              <div>
                <p className="text-sm font-medium text-[#0b1d5e]/80">Built on Strike&apos;s live data</p>
                <Link
                  href="/dashboard"
                  className="mt-5 inline-flex items-center gap-3 rounded-full bg-[#0b1d5e] py-3.5 pl-6 pr-5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(11,29,94,0.35)] transition hover:-translate-y-0.5"
                >
                  Launch the terminal
                  <span className="h-2.5 w-2.5 rounded-full bg-[#5b95ff] shadow-[0_0_0_4px_rgba(91,149,255,0.3)]" />
                </Link>
                <p className="mt-3 text-xs text-[#0b1d5e]/55">Paper trading by default. No sign-up.</p>
              </div>

              <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-[#d5e2fb] bg-white/60 backdrop-blur sm:grid-cols-4">
                {SOURCES.map(([label, path], i) => (
                  <div
                    key={label}
                    className={`flex h-[84px] flex-col items-center justify-center gap-2 border-[#e1eafb] text-[#0b1d5e] ${
                      i % 4 !== 3 ? "sm:border-r" : ""
                    } ${i < 4 ? "sm:border-b" : ""} ${i % 2 === 0 ? "border-r sm:border-r" : ""} border-b sm:border-b-0`}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d={path} />
                    </svg>
                    <span className="text-[11px] font-semibold tracking-tight">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── Score: exploded 3D stack ───────────── */}
      <section id="score" className="scroll-mt-6 px-3 py-28 sm:px-6">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">The score</p>
            <h2 className="mt-3 text-balance text-4xl font-medium leading-[1.08] tracking-[-0.02em] text-[#0b1d5e] sm:text-5xl">
              Four signals. One number. Nothing hidden.
            </h2>
            <p className="mt-5 max-w-md leading-relaxed text-[#0b1d5e]/70">
              Every liquid Strike perp is scored from 0 to 100. Funding carry leads, momentum and smart-money attention confirm it, liquidity
              keeps it tradable, and a volatility penalty pulls down markets that can erase the carry in one candle.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-[#0b1d5e]/80">
              {["Open any idea and every layer is shown with its numbers", "Thin or erratic markets are filtered out, not ranked", "Hover a layer to lift it out of the stack"].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative h-[520px] sm:h-[640px]">
            <ScoreStack3D className="h-full w-full" />
          </div>
        </div>
      </section>

      {/* ───────────── Funding: WebGL flow ───────────── */}
      <section id="funding" className="scroll-mt-6 px-3 sm:px-6">
        <div
          className="relative mx-auto max-w-6xl overflow-hidden rounded-[36px] px-6 py-20 sm:px-14"
          style={{ background: "radial-gradient(ellipse 90% 90% at 50% 0%, #2557e6 0%, #102c85 50%, #07123d 100%)" }}
        >
          <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">The edge</p>
              <h2 className="mt-3 text-balance text-4xl font-medium leading-[1.08] tracking-[-0.02em] text-white sm:text-5xl">
                Longs pay shorts. Every single hour.
              </h2>
              <p className="mt-5 max-w-md leading-relaxed text-white/75">
                On Strike, funding settles hourly. When the rate is positive, longs pay shorts, and when it turns negative the flow reverses.
                Fulmen leans toward the side that gets paid, then sizes it so a wrong call has a known, capped cost.
              </p>
              <div className="mt-7 flex flex-wrap gap-3 text-xs font-semibold text-white">
                {["Hourly rate × 8,760 = APR", "Stop on every idea", "2R target"].map((t) => (
                  <span key={t} className="rounded-full border border-white/25 bg-white/10 px-3.5 py-2 backdrop-blur">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="relative h-[380px] sm:h-[440px]">
              <LazyFundingFlow3D className="h-full w-full" />
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── Proof: a real backtest on a tilted card ───────────── */}
      <section id="proof" className="scroll-mt-6 px-3 py-28 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">The proof</p>
            <h2 className="mt-3 text-balance text-4xl font-medium leading-[1.08] tracking-[-0.02em] text-[#0b1d5e] sm:text-5xl">
              Test the rule on history before you risk a cent.
            </h2>
            <p className="mt-5 leading-relaxed text-[#0b1d5e]/70">
              This curve is not a mock-up. It is computed in your browser, right now, from Strike&apos;s own 90-day funding and price history.
              We show the numbers whether they flatter us or not.
            </p>
          </div>
          <div className="mx-auto mt-14 max-w-3xl">
            <LiveBacktestCard />
          </div>
          <div className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-3">
            {[
              ["5x", "maximum leverage, enforced"],
              ["2%", "maximum equity risked per trade"],
              ["0", "parameters tuned to look better"],
            ].map(([big, small]) => (
              <div key={small} className="rounded-3xl border border-white/70 bg-white/60 p-5 text-center shadow-sm backdrop-blur">
                <div className="num text-4xl font-bold text-[#0b1d5e]">{big}</div>
                <p className="mt-1 text-xs leading-snug text-[#0b1d5e]/65">{small}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── Built on Strike ───────────── */}
      <section className="px-3 pb-24 sm:px-6">
        <div className="card mx-auto grid max-w-6xl gap-10 p-8 sm:p-12 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Built on Strike</p>
            <h2 className="mt-3 text-balance text-3xl font-medium tracking-[-0.02em] text-[#0b1d5e] sm:text-4xl">Every number on screen comes from Strike.</h2>
            <p className="mt-4 leading-relaxed text-[#0b1d5e]/70">
              Fulmen reads Strike&apos;s public endpoints straight from the browser. There is nothing to sign up for and no server in between. Funding is treated the way
              Strike settles it: hourly, positive means longs pay shorts.
            </p>
          </div>
          <div className="rounded-3xl bg-panel2 p-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent">
              <span className="h-2 w-2 rounded-full bg-accent" /> Builder codes
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#0b1d5e]/75">
              Strike lets apps route orders for users and keep a share of each fill, up to 1%. Fulmen has the path written: wallet connect, request signing and bracket
              orders with a live stop and target, testnet-first.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-[#0b1d5e]/60">
              <b className="text-[#0b1d5e]">Honest status:</b> the code is in the repo and its signing is unit-checked. It is off by default and has not yet been run end to
              end with a funded wallet, so the app runs in paper mode.
            </p>
          </div>
        </div>
      </section>

      {/* ───────────── FAQ ───────────── */}
      <section id="faq" className="scroll-mt-6 px-3 pb-24 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-accent">FAQ</p>
          <h2 className="mt-3 text-center text-4xl font-medium tracking-[-0.02em] text-[#0b1d5e]">Straight answers.</h2>
          <div className="mt-10 space-y-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="card group p-5 open:shadow-lg">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-[#0b1d5e]">
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
      <section className="px-3 pb-8 sm:px-6">
        <div
          className="mx-auto max-w-6xl rounded-[36px] px-6 py-20 text-center"
          style={{ background: "radial-gradient(ellipse 80% 120% at 50% 0%, #4f86ff 0%, #1d46d4 45%, #0a1a5c 100%)" }}
        >
          <h2 className="mx-auto max-w-2xl text-balance text-4xl font-medium leading-[1.08] tracking-[-0.02em] text-white sm:text-5xl">
            See what Strike is paying you to hold, right now.
          </h2>
          <Link href="/dashboard" className="mt-9 inline-block rounded-full bg-white px-8 py-4 text-sm font-bold text-[#0b1d5e] shadow-xl transition hover:-translate-y-0.5">
            Launch the terminal →
          </Link>
        </div>

        <footer className="mx-auto mt-8 flex max-w-6xl flex-col items-center justify-between gap-3 px-2 text-xs text-[#0b1d5e]/60 sm:flex-row">
          <div className="flex items-center gap-2 font-semibold text-[#0b1d5e]">
            <LogoMark className="h-6 w-6" /> Fulmen
          </div>
          <p className="max-w-xl text-center leading-relaxed sm:text-left">
            Independent project, not affiliated with Strike. Paper trading by default. Signals are heuristics, not financial advice.
          </p>
          <div className="flex gap-4 font-medium">
            <a href={REPO} target="_blank" rel="noreferrer" className="hover:text-[#0b1d5e]">
              GitHub
            </a>
            <a href="https://docs.strikefinance.org" target="_blank" rel="noreferrer" className="hover:text-[#0b1d5e]">
              Strike docs
            </a>
          </div>
        </footer>
      </section>
    </main>
  );
}
