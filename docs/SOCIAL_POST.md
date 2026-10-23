# Social post drafts

Post after the form is submitted. Replace [FILL] values. Attach a 20 to 30 second clip or screenshot of the signal board + trade idea.

## Main post (X, fits 280 chars after link)

Built Fulmen for the @StrikeFinance hackathon: live Strike data in, explained and risk-sized trade ideas out.

Ranks every liquid perp, shows why, caps risk at 2% and 5x, then paper-trades it with real hourly funding.

Live execution via builder code is written; proving it on testnet is next.
https://flumen.milliebanned.xyz
https://github.com/Milliebanned/fulmen

## Discord version

Hi all, I built Fulmen for the hackathon. It reads Strike's public API and mark-price WebSocket, ranks every liquid market with a transparent conviction score (funding carry, momentum, top-trader attention, liquidity), explains each idea, sizes it from a fixed risk, and paper-trades it using Strike's hourly funding. It is paper only for now; live execution through a builder code is the next step. Demo: [FILL]. Code: [FILL]. Feedback welcome, especially on the scoring.

## Alternative hooks

1. "Funding rates tell you who is paying whom. I built a terminal that takes the side that gets paid, sizes it so a stop-out costs 1% of equity, and tells you why."
2. "Most perp traders don't lose on direction, they lose on size. Fulmen sizes every Strike trade before you click."
3. "I asked: what would a Strike trade idea look like if it had to cite its own numbers? Fulmen is the answer, built on Strike's public API in under 3 days."
