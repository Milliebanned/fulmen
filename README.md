# ⚡ Fulmen — signal → trade terminal for Strike

> *Fulmen* (Latin): a lightning strike.

Fulmen turns live **Strike Finance** market data into **explained, risk-guarded trade ideas** you can act on in one click.
Most traders face the same question: *what should I trade, and why?* Fulmen answers it from Strike's own data, shows its
reasoning, sizes the trade so a stop-out costs a fixed % of equity, and tracks the result live.

Built for the **Strike Hackathon** (Oct 21–23, 2026).

## What it does

1. **Signal board** — ranks every liquid Strike perp by a transparent *conviction score* (0–100).
2. **Explained trade idea** — direction, entry, stop, 2R target, and the reasons behind it (funding, momentum,
   smart-money attention, liquidity, risk flags). A Claude-written rationale cites only the live numbers.
3. **Risk-guarded order ticket** — position size is derived from your risk-per-trade; the guard hard-caps leverage (5x) and risk (2%).
4. **Live paper portfolio** — fills at Strike's live mark price over its WebSocket, auto stop/target, and accrues
   **hourly funding the way Strike settles it**.
5. **Smart-money attention** — where Strike's highest copy-score traders concentrate (weighted by score and 7d PnL).

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
> - Execution is **paper trading** at live prices. Real execution through Strike's trading API with a **builder code**
>   is the planned next step (see Roadmap) — we did not fake it.
> - Signals are heuristics, **not financial advice**.

## How Fulmen uses Strike

All public, unauthenticated endpoints from `https://api.strikefinance.org`:

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
broker accrues exactly that.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Optional: set `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`) in `.env.local` to get Claude-written rationales.
Without a key Fulmen falls back to a deterministic summary of the same facts — nothing breaks.

Stack: Next.js 16 (App Router), React 19, Tailwind 4, TypeScript. No database; paper state lives in `localStorage`.

## Project layout

- `src/lib/strike.ts` — typed Strike API client
- `src/lib/signals.ts` — markets, smart-money attention, conviction scoring, position sizing + risk guard
- `src/lib/paper.ts` — paper broker (fills, stops/targets, hourly funding accrual)
- `src/lib/useStrike.ts` — data polling + live WebSocket hook
- `src/app/api/explain/route.ts` — Claude rationale (server-side, key never reaches the browser)
- `src/app/page.tsx` — the terminal UI

## Roadmap (future potential)

1. **Live execution via builder codes** — route orders through Strike's trade API with `X-Builder-Fee-Bps`, so every
   fill sends volume to Strike and earns the app a fee share (max 100 bps), a self-funding growth loop.
2. Auto-trade rules ("open the top idea above conviction 70") with the same risk guard.
3. Position-aware smart money using Strike's authenticated endpoints.
4. Alerts (Telegram/Discord) when a new high-conviction idea appears.

## License

MIT
