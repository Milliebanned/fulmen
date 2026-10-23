# Fulmen: one-page pitch for the Strike team

## Problem
Strike lists many perp markets. A trader opening the app sees prices and funding but has to decide alone which market to trade, which side, and how large. Most skip the sizing question, which is where accounts blow up. Funding, momentum, liquidity and top-trader activity all sit in Strike's data, but nobody combines them into a ranked, explained, sized idea.

## Product
Fulmen is a signal-to-trade terminal built only on Strike's public API and mark-price WebSocket.
- **Ranks** every liquid market with a transparent 0 to 100 conviction score: funding carry 40%, liquidity 22%, momentum 20%, smart-money attention 18%, minus a volatility penalty.
- **Explains** each idea: direction (take the side that gets paid funding), entry, stop, 2R target, reasons, and a Claude-written rationale that cites only live numbers.
- **Sizes** the trade from a fixed loss at the stop, with a hard guard of 5x leverage and 2% risk per trade.
- **Tracks** outcomes in a paper portfolio using live marks and Strike's hourly funding convention.

Status: working prototype, paper trading. Live execution via builder code is in progress, not shipped.

## Why it helps Strike
- **Volume and OI:** ideas point traders at liquid markets with a reason to hold a position (funding carry encourages longer holds, which supports open interest).
- **Retention:** paper mode lets newcomers practise on live Strike prices before depositing.
- **Safer flow:** a sizing guard reduces liquidations, which keeps users on the platform.
- **Distribution:** every idea ends in a Strike trade, so the app is a top-of-funnel for Strike.

## Revenue model (illustrative, assumptions only)
Strike's builder codes let an app attach a fee in basis points to orders it routes, up to 100 bps, so Strike receives the volume and the builder earns a share. Fulmen has no live users and no traction numbers. The maths below is a formula, not a forecast.

Monthly builder revenue = traders x average monthly volume per trader x fee (bps / 10,000)

Example with assumed inputs:
| Assumed traders | Assumed monthly volume each | Assumed fee | Monthly volume routed | Builder revenue |
|---|---|---|---|---|
| 100 | $50,000 | 2 bps | $5.0M | $1,000 |
| 1,000 | $50,000 | 2 bps | $50M | $10,000 |
| 1,000 | $50,000 | 5 bps | $50M | $25,000 |

All inputs are placeholders to show sensitivity. The point for Strike: the same volume also pays Strike its own trading fees, so each routed dollar is additive to Strike. Check the current builder fee rules in Strike's docs before relying on the numbers.

## Roadmap
1. Live execution through Strike's trade API with a builder code (next; needs verified order flow).
2. Auto-trade rules, such as "open the top idea above conviction 70" under the same risk guard.
3. Position-aware smart money using Strike's authenticated endpoints, turning attention into direction.
4. Alerts via Telegram or Discord when a new high-conviction idea appears.
5. Backtest the conviction score and publish results, so weights are evidence-based.

## Honest risks
Signals are heuristics and unbacktested; smart-money data currently shows attention, not direction; paper results ignore slippage and fees; Strike builder-code terms must be confirmed.

## Ask
- Feedback and early access to Strike's authenticated and trading endpoints, plus builder-code onboarding, to ship live execution.
- Introductions to active Strike traders for a pilot.
- If Strike and partners are considering direct investment in hackathon projects: a conversation about funding the next three months of work on execution, backtesting and alerts. [FILL: amount and terms you want, if any.]

Contact: [FILL] | Repo: [FILL] | Live demo: [FILL]
