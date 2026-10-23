# Fulmen demo video script (target 2:20, hard max 2:30)

Everything below matches what is in the app today: live Strike WebSocket, signal board, explained idea, risk-guarded ticket, paper trading with hourly funding, smart-money attention. Live order execution is implemented but NOT proven end-to-end, so do not demo it or imply it works unless you have run a funded testnet order first.

## Before you hit record

- Run the deployed URL (or `npm run dev`) and let it sit for 2 minutes so the page header shows "Strike WS live" and the paper portfolio is warm.
- Resolution 1920x1080. Browser zoom 100% (try 110% if text is small on a laptop). Hide bookmarks bar (Cmd+Shift+B), close other tabs, turn on Do Not Disturb.
- Recorder: QuickTime (File > New Screen Recording) or OBS or Loom. Record voice separately in a quiet room if you can, then lay it over; or read live and keep the script open on a second screen.
- Do a full dry run once. Pick the trade BEFORE recording (see below).
- Click "reset" on the Paper portfolio card so the portfolio starts clean at $10,000.
- Have `GEMINI_API_KEY` (free) or `ANTHROPIC_API_KEY` set so the rationale label reads "written by Gemini/Claude from live data". If it says "auto summary", the key is missing: either fix it or say "template fallback" in the voiceover. Do not claim Claude wrote it.

### Getting a trade that looks good live
- Funding accrues hourly, so a few seconds of recording shows a tiny number. Two options:
  1. Open the trade BEFORE the video (15 to 60 minutes earlier) on the idea you will feature, so the open position already shows a non-zero "funding +0.0xx" line. In the video say "I opened this earlier".
  2. Open it live and show the live PnL ticking from the WebSocket marks, and point at the funding line with an honest "funding accrues at Strike's hourly rate, so it builds up slowly".
- Prefer a high-conviction idea with real liquidity and a funding APR you can read aloud. Whatever is on top of the board at record time is fine; read the actual numbers on screen, do not use the numbers in this script.
- If a stop or target fires on camera, that is a feature: say so.

## Shot list

| Time | On screen | Action | Voiceover |
|---|---|---|---|
| 0:00-0:12 | Fulmen full page, header visible | Static, then slowly move the cursor over the header pills | "Perps traders get a wall of tickers and have to decide what to trade, and why. Fulmen turns Strike's own data into explained, risk-sized trade ideas." |
| 0:12-0:27 | Header: green "Strike WS live" dot, sentiment pill, Strike volume and trader count | Hover the live dot, then watch the prices on the board tick | "This is live. Prices come from Strike's mark-price WebSocket, and the context pills come from Strike's public API: sentiment, platform volume, trader count. Nothing is mocked." |
| 0:27-0:50 | Signal board (left column) | Scroll the list slowly; point at conviction bars and the sparklines | "The board ranks every liquid Strike market by a conviction score from zero to a hundred. It mixes funding carry, momentum, smart-money attention and liquidity, and penalises very volatile markets. Thin markets are filtered out." |
| 0:50-1:15 | Trade idea card for the top market | Click the top market. Point at side, entry, stop, target. Then read two of the reasons (Funding, Smart money). Then the "Analyst rationale" box | "Click a market and you get a direction, entry, stop and a two-R target. Here is why: funding is [read the APR], so the side that gets paid is the [short or long]. Below that, a AI-written rationale that only cites these live numbers. If there is no API key it falls back to a plain summary of the same facts." |
| 1:15-1:35 | Order ticket (risk guard on) | Drag the risk slider up past 2%; show the "Guard caps risk" message. Point at notional and leverage | "The ticket sizes the position from how much you are willing to lose. Push the slider past two percent and the guard stops you. Leverage is capped at five times." |
| 1:35-2:00 | Click "Open paper long/short ..."; then the Paper portfolio card | Click the button. Show the new position, live PnL moving, the funding line. If you pre-opened one, point at its non-zero funding | "One click opens a paper trade at the live mark price. PnL moves with the WebSocket, stops and targets are checked automatically, and funding accrues hourly the way Strike settles it: positive rate means longs pay shorts." |
| 2:00-2:12 | Smart-money attention card | Click one of the assets in the card; the idea view switches to it | "Here is where Strike's highest copy-score traders concentrate. Public data shows what they focus on, not whether they are long or short, so we call it attention, not positioning." |
| 2:12-2:30 | Back to full page, or a simple end card with the repo and live URL | Static | "Today you can paper-trade these ideas. The code for live execution through Strike's trading API with a builder code is written and next up is proving it on testnet: every fill sends volume to Strike, and the builder fee funds the app. Code is on GitHub, link below. Thanks." |

Word count of the voiceover is about 330 words, about 2:15 at a calm pace. If you run long, cut the sentence about thin markets and the PnL leaders mention.

## Do and don't

- Do read real numbers off the screen. Do keep the cursor slow.
- Don't say "execute on Strike", "real money", or "guaranteed". Don't call signals predictions.
- Don't show `.env.local` or the terminal with keys.
- Export as MP4, H.264, under 100 MB. Upload to YouTube (unlisted is fine) or Loom, and test the link in a private window.
