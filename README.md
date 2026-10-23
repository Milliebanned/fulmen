# ⚡ Fulmen — signal → trade terminal for Strike

> *Fulmen* (Latin): a lightning strike.

Fulmen turns live **Strike Finance** market data into **explained, risk-guarded trade ideas** you can act on in one click.
Most traders face the same question: *what should I trade, and why?* Fulmen answers it from Strike's own data, shows its
reasoning, sizes the trade so a stop-out costs a fixed % of equity, and tracks the result live.

Built for the **Strike Hackathon** (Oct 21–23, 2026).

## What it does

1. **Signal board** — ranks every liquid Strike perp by a transparent *conviction score* (0–100).
2. **Explained trade idea** — direction, entry, stop, 2R target, and the reasons behind it (funding, momentum,
   smart-money attention, liquidity, risk flags). An AI-written rationale (Gemini or Claude) cites only the live numbers.
3. **Risk-guarded order ticket** — position size is derived from your risk-per-trade; the guard hard-caps leverage (5x) and risk (2%).
4. **Live paper portfolio** — fills at Strike's live mark price over its WebSocket, auto stop/target, and accrues
   **hourly funding the way Strike settles it**.
5. **Smart-money attention** — where Strike's highest copy-score traders concentrate (weighted by score and 7d PnL).
6. **Candlestick chart** — 15m/1h/4h candles with the idea's entry, stop and target drawn as shaded risk/reward zones, last candle updating live.
7. **90-day backtest per market, plus an all-markets table** — replays the rule on Strike's own history (hourly funding from
   `/stat/v1/stats/coin/history/funding` plus klines): side chosen daily from trailing funding, volatility-based stop,
   2R target, 0.05%/side fees, 1% risk sizing capped at 5x. It reports return, win rate, max drawdown, the
   price-vs-funding PnL split and buy-and-hold for comparison, with caveats.

> **Backtest honesty:** run across 8 liquid markets over 90 days, the rule was roughly break-even after fees (about half
> the markets positive, average return near zero in our runs). Funding was a steady positive contributor; price moves and
> trading costs decided the net result. We did not tune parameters to look better (a quick sweep showed the edge is small and
> unstable). The app shows the per-market and all-market numbers as computed, with caveats.

## How the conviction score works

| Component | Weight | Source |
|---|---|---|
| Funding carry | 40% | `premiumIndex.fundingRate` (hourly) × 8,760 → APR. We take the side that **gets paid**: shorts when funding is positive, longs when negative. |
| Momentum alignment | 20% | 24h change from `marketStats`, signed toward the idea's side |
| Smart-money attention | 18% | `/v2/copy/discover` — share of top-trader attention per asset |
| Liquidity | 22% | min(24h volume, open interest) — thin markets are filtered and penalised |
| Volatility penalty | −0…18 | 24h range; erratic markets can erase carry in one candle |

Markets below $50K 24h volume or $25K open interest are excluded.

> **Honest scope notes**
> - Strike's public data shows *what* top traders focus on, not whether they are long or short (positions need auth), so
>   we label it **attention**, not positioning.
> - The portfolio panel is **paper trading** at live prices (no slippage, spread or fees). Live order routing via a **builder code**
>   is implemented (`src/lib/execution/`, `LiveTradePanel`) and disabled unless `NEXT_PUBLIC_STRIKE_BUILDER_CODE` is set. Its
>   signing is unit-checked, but it has **not been run end-to-end with a real wallet and funds** — we don't claim it is proven.
> - Signals are heuristics, **not financial advice**.

## How Fulmen uses Strike

Data comes from Strike's public, unauthenticated endpoints at `https://api.strikefinance.org`; live execution (opt-in) uses the signed builder-code endpoints:

| Purpose | Endpoint |
|---|---|
| Prices, volume, OI, 24h stats | `GET /price/v2/marketStats` |
| Hourly funding rates | `GET /price/v2/premiumIndex` |
| 24h sparklines | `GET /price/v2/sparklines` |
| Sentiment | `GET /price/v2/fearGreed` |
| Smart-money attention | `GET /v2/copy/discover?platform=strike` |
| PnL leaders | `GET /stat/v1/stats/leaderboard` |
| Platform stats / liquidations | `GET /stat/v1/dashboard/summary`, `/liquidations` |
| Live mark prices | `wss://api.strikefinance.org/ws/price` → `!markprice@arr` |

Funding detail: Strike settles funding **hourly** (`F_hourly = F_8h / 8`); positive rate means longs pay shorts. Fulmen's paper
broker accrues that rate continuously (pro-rata per tick), not as discrete hourly payments.

## Routes

| Route | Page |
|---|---|
| `/` | Landing page |
| `/dashboard` | Overview: stat cards, top ideas, smart-money donut, analyst |
| `/signals` | Trading desk: signal board, explained idea, chart, order ticket, live execution |
| `/backtest` | Per-market and all-markets backtest |
| `/portfolio` | Paper account: positions, history, stats, exposure |

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Optional live execution: set `NEXT_PUBLIC_STRIKE_BUILDER_CODE` (and `NEXT_PUBLIC_STRIKE_ENV=testnet`). See `.env.example`.

Optional AI rationales: set `GEMINI_API_KEY` (free tier, https://aistudio.google.com/apikey) and/or `ANTHROPIC_API_KEY` in
`.env.local`. Order is Gemini, then Claude, then a deterministic summary of the same facts, so nothing breaks without a key.

Stack: Next.js 16 (App Router), React 19, Tailwind 4, TypeScript. No database; paper state lives in `localStorage`.

## Project layout

- `src/lib/strike.ts` — typed Strike API client
- `src/lib/signals.ts` — markets, smart-money attention, conviction scoring, position sizing + risk guard
- `src/lib/paper.ts` — paper broker (fills, stops/targets, hourly funding accrual)
- `src/lib/backtest.ts`, `src/components/BacktestPanel.tsx` — 90-day backtest
- `src/components/PriceChart.tsx`, `src/lib/chartMath.ts` — SVG candlestick chart
- `src/lib/execution/*`, `src/components/LiveTradePanel.tsx` — builder-code connect, signing, bracket orders (opt-in, testnet-first)
- `tests/` — unit tests (`npm test`)
- `src/lib/useStrike.ts` — data polling + live WebSocket hook
- `src/app/api/explain/route.ts` — AI rationale via Gemini/Claude with template fallback (server-side, keys never reach the browser)
- `src/app/page.tsx` (landing), `src/app/(app)/{dashboard,signals,backtest,portfolio}` — one page per section
- `src/lib/store.tsx` — shared app state (live data, WebSocket prices, paper account) mounted in the layout
- `src/components/AppShell.tsx`, `ui.tsx`, `AnalystCard.tsx` — navigation shell and shared UI

## Roadmap (future potential)

1. **Prove live execution end-to-end** — the builder-code order flow (`X-Builder-Fee-Bps`, bracket orders with stop and
   target) is written and testnet-first; next is a funded testnet run, then fills and fee accrual. Every fill sends volume
   to Strike and earns the app a fee share (max 100 bps).
2. Auto-trade rules ("open the top idea above conviction 70") with the same risk guard.
3. Position-aware smart money using Strike's authenticated endpoints.
4. Alerts (Telegram/Discord) when a new high-conviction idea appears.

## License

MIT
