import type { CopyTrader, RawMarket, RawPremium } from "./strike";

export type Side = "long" | "short";

export interface Market {
  symbol: string;
  name: string;
  category: string;
  mark: number;
  change24h: number; // %
  high24h: number;
  low24h: number;
  vol24h: number; // USD
  oiUsd: number;
  fundingHourly: number; // fraction per hour; positive = longs pay shorts
  fundingApr: number; // % annualised (hourly * 8760)
  closes: number[];
}

export interface SmartMoney {
  /** symbol -> share of smart-money weight (0..1) */
  attention: Record<string, number>;
  traders: number;
  top: { symbol: string; share: number; traders: number }[];
}

export interface Reason {
  tag: "Funding" | "Momentum" | "Smart money" | "Liquidity" | "Risk";
  text: string;
  tone: "good" | "warn" | "neutral";
}

export interface Idea {
  market: Market;
  side: Side;
  conviction: number; // 0..100
  parts: { carry: number; momentum: number; attention: number; liquidity: number };
  reasons: Reason[];
  entry: number;
  stop: number;
  target: number;
  stopPct: number;
  liqHeat: number; // recent liquidation notional, USD (7d)
}

const num = (s: string | number | undefined | null) => {
  const n = typeof s === "number" ? s : parseFloat(s ?? "");
  return Number.isFinite(n) ? n : 0;
};
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function buildMarkets(
  raw: RawMarket[],
  premium: RawPremium[],
  sparks: Record<string, { closes: string[] }>,
): Market[] {
  const prem = new Map(premium.map((p) => [p.symbol, p]));
  return raw
    .filter((m) => m.active && m.visibleOnUI !== false)
    .map((m) => {
      const s = m.marketStats;
      const mark = num(s.markPrice) || num(s.lastPrice);
      const p = prem.get(m.symbol);
      const fundingHourly = num(p?.fundingRate ?? s.fundingRate);
      return {
        symbol: m.symbol,
        name: m.assetName || m.symbol.replace("-USD", ""),
        category: m.category,
        mark,
        change24h: num(s.priceChangePercentage24h),
        high24h: num(s.high24h) || mark,
        low24h: num(s.low24h) || mark,
        vol24h: num(s.volume24h),
        oiUsd: num(s.openInterest),
        fundingHourly,
        fundingApr: fundingHourly * 8760 * 100,
        closes: (sparks[m.symbol]?.closes ?? []).map(num),
      };
    })
    .filter((m) => m.mark > 0);
}

/**
 * "Smart money" here = attention of high copy-score traders, weighted by score and 7d PnL.
 * Public Strike data exposes which assets top traders focus on, not their live direction,
 * so we deliberately call it attention, not positioning.
 */
export function buildSmartMoney(traders: CopyTrader[]): SmartMoney {
  const weight: Record<string, number> = {};
  const count: Record<string, number> = {};
  let total = 0;
  let used = 0;
  for (const t of traders) {
    const score = num(t.copy_score) / 100;
    if (score <= 0) continue;
    const pnl7 = num(t.pnl?.["7d"]);
    const w = score * (pnl7 > 0 ? 1.5 : 0.6);
    const assets = (t.top_assets ?? []).filter((a) => a.symbol && a.symbol !== "ALL");
    if (!assets.length) continue;
    used++;
    for (const a of assets) {
      weight[a.symbol] = (weight[a.symbol] ?? 0) + w;
      count[a.symbol] = (count[a.symbol] ?? 0) + 1;
      total += w;
    }
  }
  const attention: Record<string, number> = {};
  for (const k of Object.keys(weight)) attention[k] = total ? weight[k] / total : 0;
  const top = Object.keys(attention)
    .sort((a, b) => attention[b] - attention[a])
    .slice(0, 8)
    .map((symbol) => ({ symbol, share: attention[symbol], traders: count[symbol] }));
  return { attention, traders: used, top };
}

export function buildIdeas(
  markets: Market[],
  sm: SmartMoney,
  liq7d: Record<string, number>,
  fearGreed: number,
): Idea[] {
  const maxAtt = Math.max(0.0001, ...Object.values(sm.attention));
  const ideas: Idea[] = [];

  for (const m of markets) {
    // too thin to trade responsibly: need real volume AND real open interest
    if (m.vol24h < 50_000 || m.oiUsd < 25_000) continue;
    const carrySide: Side = m.fundingApr >= 0 ? "short" : "long"; // be paid, not pay
    const dir = carrySide === "long" ? 1 : -1;

    const carry = clamp(Math.abs(m.fundingApr) / 150, 0, 1);
    const momAligned = Math.tanh((dir * m.change24h) / 6); // -1..1 (trend with our side)
    const momentum = (momAligned + 1) / 2;
    const attention = clamp((m.symbol in sm.attention ? sm.attention[m.symbol] : 0) / maxAtt, 0, 1);
    const liquidity = clamp(
      Math.min(
        (Math.log10(Math.max(m.vol24h, 1)) - 4) / 2.5,
        (Math.log10(Math.max(m.oiUsd, 1)) - 4) / 2.5,
      ),
      0,
      1,
    );

    const range = m.mark ? (m.high24h - m.low24h) / m.mark : 0.04;
    const stopPct = clamp(range * 0.6, 0.012, 0.08);
    // Erratic, thin markets can eat the carry in one candle: penalise high volatility.
    const volPenalty = clamp((stopPct - 0.035) / 0.045, 0, 1) * 18;

    const conviction = Math.max(
      0,
      Math.round(100 * (0.4 * carry + 0.2 * momentum + 0.18 * attention + 0.22 * liquidity) - volPenalty),
    );
    const entry = m.mark;
    const stop = carrySide === "long" ? entry * (1 - stopPct) : entry * (1 + stopPct);
    const target = carrySide === "long" ? entry * (1 + stopPct * 2) : entry * (1 - stopPct * 2);

    const reasons: Reason[] = [];
    const who = carrySide === "short" ? "Longs are paying shorts" : "Shorts are paying longs";
    reasons.push({
      tag: "Funding",
      text: `${who}: ${m.fundingApr >= 0 ? "+" : ""}${m.fundingApr.toFixed(0)}% APR (hourly ${(m.fundingHourly * 100).toFixed(4)}%). Holding the ${carrySide} side collects it.`,
      tone: Math.abs(m.fundingApr) > 40 ? "good" : "neutral",
    });
    reasons.push({
      tag: "Momentum",
      text: `Price ${m.change24h >= 0 ? "up" : "down"} ${Math.abs(m.change24h).toFixed(2)}% in 24h, ${
        momAligned > 0.1 ? "moving with" : momAligned < -0.1 ? "moving against" : "flat relative to"
      } the ${carrySide} idea.`,
      tone: momAligned > 0.1 ? "good" : momAligned < -0.1 ? "warn" : "neutral",
    });
    const share = sm.attention[m.symbol] ?? 0;
    reasons.push({
      tag: "Smart money",
      text: share
        ? `Top-scored traders concentrate ${(share * 100).toFixed(1)}% of their attention here.`
        : "No notable concentration of top-trader attention.",
      tone: attention > 0.5 ? "good" : "neutral",
    });
    reasons.push({
      tag: "Liquidity",
      text: `$${fmt(m.vol24h)} 24h volume, $${fmt(m.oiUsd)} open interest.`,
      tone: liquidity > 0.5 ? "good" : "warn",
    });
    const liqHeat = liq7d[m.symbol] ?? 0;
    if (volPenalty > 4 || momAligned < -0.5 || fearGreed > 80 || fearGreed < 20 || liqHeat > m.oiUsd * 0.5) {
      reasons.push({
        tag: "Risk",
        text: `Elevated risk: ${volPenalty > 4 ? `very volatile (24h range ${(range * 100).toFixed(1)}%); ` : ""}${
          momAligned < -0.5 ? "strong move against the idea; " : ""
        }${fearGreed > 80 || fearGreed < 20 ? `market sentiment extreme (${fearGreed}); ` : ""}${
          liqHeat > m.oiUsd * 0.5 ? `heavy recent liquidations ($${fmt(liqHeat)} in 7d); ` : ""
        }size down.`,
        tone: "warn",
      });
    }

    ideas.push({
      market: m,
      side: carrySide,
      conviction,
      parts: { carry, momentum, attention, liquidity },
      reasons,
      entry,
      stop,
      target,
      stopPct,
      liqHeat,
    });
  }
  return ideas.sort((a, b) => b.conviction - a.conviction);
}

export function fmt(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(2);
}

export function price(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (n >= 1) return n.toFixed(3);
  return n.toPrecision(4);
}

/** Position sizing with a hard risk guard. */
export interface Sizing {
  riskUsd: number;
  notional: number;
  leverage: number;
  qty: number;
  capped: boolean;
  fundingPerDay: number;
}

export const GUARD = { maxLeverage: 5, maxRiskPct: 0.02 };

export function size(idea: Idea, equity: number, riskPct: number): Sizing {
  const risk = Math.min(riskPct, GUARD.maxRiskPct) * equity;
  let notional = risk / idea.stopPct;
  const maxNotional = equity * GUARD.maxLeverage;
  const capped = notional > maxNotional;
  if (capped) notional = maxNotional;
  const fundingPerDay = notional * Math.abs(idea.market.fundingHourly) * 24;
  return {
    riskUsd: notional * idea.stopPct,
    notional,
    leverage: notional / equity,
    qty: notional / idea.entry,
    capped,
    fundingPerDay,
  };
}
