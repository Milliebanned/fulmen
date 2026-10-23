# Fulmen submission pack

Deadline: Fri Oct 23 2026, 10:00 AM Eastern = 07:00 AM Pacific. Aim to submit by 06:00 AM Pacific.

Items marked [FILL] need your input.

## A. Copy-paste form answers

**Project name:** Fulmen

**One-line pitch:** Fulmen turns live Strike market data into explained, risk-guarded trade ideas you can paper-trade in one click, with builder-code live execution written and next to be proven on testnet.

**Description (about 100 words):**
Fulmen is a signal-to-trade terminal for Strike Finance. It ranks every liquid Strike perp by a transparent 0 to 100 conviction score built from funding carry, momentum, smart-money attention, liquidity and a volatility penalty. For any market it shows direction, entry, stop, a 2R target and plain-language reasons, plus a AI-written rationale that cites only the live numbers. A risk-guarded order ticket sizes the position from risk per trade and caps leverage at 5x and risk at 2%. Trades are paper-traded at Strike's live WebSocket mark price with automatic stops and targets and hourly funding accrual the way Strike settles it.

**How it interacts with Strike:**
Fulmen reads Strike's public, unauthenticated API at https://api.strikefinance.org:
- `GET /price/v2/marketStats` (prices, volume, open interest, 24h stats)
- `GET /price/v2/premiumIndex` (hourly funding rates)
- `GET /price/v2/sparklines` (24h price series)
- `GET /price/v2/fearGreed` (sentiment)
- `GET /v2/copy/discover?platform=strike` (top copy-score traders, used for smart-money attention)
- `GET /stat/v1/stats/leaderboard` (7d PnL leaders)
- `GET /stat/v1/dashboard/summary` and `/liquidations` (platform stats, recent liquidations used as a risk flag)
- `wss://api.strikefinance.org/ws/price`, stream `!markprice@arr` (live mark prices for fills, PnL, stops, funding)

The paper broker applies Strike's funding convention (hourly, positive rate means longs pay shorts). Order tickets link out to https://app.strikefinance.org. Live order routing through Strike's trade API with a builder code (X-Builder-Fee-Bps) is the next step and is not yet part of the working prototype.

**Tech stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind 4. Anthropic Claude API (server-side route `/api/explain`) for rationales, with a deterministic fallback. No database; paper state in browser localStorage. Deployed on [FILL: Vercel URL].

**What is original:** The conviction model (funding-carry-first scoring combined with smart-money attention, liquidity filtering and a volatility penalty), the risk-guard sizing that derives position size from a fixed stop-out loss, the paper broker with Strike-accurate hourly funding accrual, the grounded Claude explanation layer, and the whole UI were written during the hackathon (Oct 21 to 23, 2026). Strike's public API and Anthropic's API are the only external services. [FILL: confirm no code was reused from earlier projects.]

**Team:** [FILL: names, roles, handles]
**GitHub:** [FILL: repo URL]
**Live demo:** [FILL: URL]
**Demo video:** [FILL: URL]
**Contact:** [FILL: email / Discord / X handle]

## B. Evidence map

### Required submission items

| # | Requirement | Evidence | Status |
|---|---|---|---|
| 1 | Meaningful Strike integration | 8 endpoint families plus the mark-price WebSocket drive every number in the UI (`src/lib/strike.ts`, `src/lib/useStrike.ts`); funding convention replicated in `src/lib/paper.ts`; builder-code execution in `src/lib/execution/` (opt-in) and revenue path in the README roadmap | Done for data, backtest, chart and paper trading. Live builder-code execution is written (testnet-first, signing unit-checked) but not yet proven end-to-end with a funded wallet (state this honestly) |
| 2 | Working prototype / MVP | Next.js app: signal board, idea view, order ticket, paper portfolio, smart-money card | Done locally; needs user: confirm the deployed URL works |
| 3 | Documentation | `README.md` (what it does, scoring table, endpoints, run steps, scope notes); this file; `docs/PITCH.md` | Done |
| 4 | Demonstration | `docs/DEMO_SCRIPT.md` is the script | Needs user: record, upload, paste link |
| 5 | GitHub repo | Source is local at /Users/Apple/Strike/fulmen | Needs user: create public repo, push, add [FILL] link. Check no `.env.local` is committed |

### Judging criteria

| Criterion | Evidence | Status |
|---|---|---|
| Innovation and creativity | Carries the full chain from signal to explanation to sized ticket to tracked outcome in one screen; funding-side selection (take the side that gets paid); explanations restricted to live numbers. Differs from copy-trading (Bolt, Strike Copilot) and dashboards (Hizz) by producing sized trade ideas with reasons | Done; judges may still see overlap with Hizz, so lead the video with the idea + ticket, not the dashboard |
| Integration with Strike | See endpoint list above; WebSocket for fills; Strike hourly funding mechanics; copy-trader data for attention; link-out to the Strike app | Done for read side; live order flow via builder code not done |
| Utility and impact | Answers "what do I trade and how big" for any Strike trader; sizing guard reduces blow-ups; paper mode lets users test ideas with no capital | Done; no real-user data exists, so claim nothing about adoption |
| Technical execution | Typed API client, WS hook with live marks, deterministic scoring, paper broker with stop/target and funding logic (5 unit tests, `npm test`), 90-day backtest, candlestick chart, builder-code execution layer with request-signing checks, server-side key handling, rate-limited AI route (Gemini or Claude) with fallback, thin-market filter | Done; needs user: verify the build on the deployed URL |
| Future potential | Builder-code revenue loop (max 100 bps fee share), auto-trade rules, alerts, position-aware smart money; see `docs/PITCH.md` | Done as plan; be clear it is a roadmap |

## C. Limitations (use this text, judges reward candour)

Fulmen is a prototype. Trading is simulated: paper positions fill at Strike's live mark price with no slippage, spread, order book depth or fees, so paper results will flatter real execution. Live order routing through Strike's trade API with a builder code is implemented (testnet-first, disabled unless a builder code is configured) and its request signing is unit-checked, but it has not been run end-to-end with a real wallet and funds, so we do not claim it works in production. The "smart money" signal is attention, not direction: Strike's public data shows which assets top copy-score traders focus on, but not whether they are long or short, since positions need authentication. The conviction score is a transparent heuristic with hand-chosen weights; the backtest covers the funding-side rule (side from trailing funding, volatility stop, 2R target), not the full conviction score, and a high score is not a prediction. Funding carry can be erased by a single adverse price move, which is why every idea carries a stop. The AI rationale restates the live numbers and can be wrong in framing; it is not advice. Paper state lives in one browser's localStorage. Nothing here is financial advice.

## D. Pre-submit checklist (work backwards from 07:00 AM PDT)

- [ ] T-24h or earlier: repo public on GitHub, README renders, no secrets in history (`.env.local` ignored, search for `sk-ant`)
- [ ] Production deploy live (Vercel), `ANTHROPIC_API_KEY` set in the host env, page loads in a private window and shows "Strike WS live"
- [ ] Open an idea, open a paper trade on the deployed URL, confirm it persists on reload
- [ ] Demo video recorded (see DEMO_SCRIPT), under 2:30, uploaded, link tested in a private window with the sign-out state
- [ ] All [FILL] values replaced in the form answers above
- [ ] 05:00 AM PDT: freeze code. No further pushes except fixes for a broken demo
- [ ] 05:30 AM PDT: paste everything into the official form, read each field back
- [ ] 06:00 AM PDT: press Submit (one hour buffer for form errors, outages, link problems)
- [ ] Screenshot the confirmation or save the confirmation email
- [ ] 06:15 AM PDT: reopen every submitted link once (repo, demo, video)
- [ ] Post the announcement from `docs/SOCIAL_POST.md` after submitting, not before
- [ ] Note: your Mac clock is PDT; 10:00 AM Eastern is 07:00 AM PDT. Do not trust a "3 o'clock" assumption.
