// Historical backtest of Fulmen's funding-carry rule on Strike markets.
// Data: hourly klines (/price/v2/klines) + hourly funding history (/stat/v1/stats/coin/history/funding, max 90d).
// `runBacktest` is pure and unit-testable; `fetchAndBacktest` does the network calls.

import { STRIKE_API } from "./strike";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export interface Candle {
  t: number; // open time, ms
  o: number;
  h: number;
  l: number;
  c: number;
}

/** [timestampMs, hourlyRate]; positive = longs pay shorts */
export type FundingPoint = [number, number];

export interface BacktestParams {
  feePerSide: number; // fraction of notional, e.g. 0.0005 = 0.05%
  riskPct: number; // equity risked per trade at the stop (sizing as in the order ticket)
  maxLeverage: number;
  rewardR: number; // target distance in multiples of the stop distance
  minAprPct: number; // stay flat when |funding APR| is below this
  startEquity: number;
}

export const DEFAULT_PARAMS: BacktestParams = {
  feePerSide: 0.0005,
  riskPct: 0.01,
  maxLeverage: 5,
  rewardR: 2,
  minAprPct: 0,
  startEquity: 10_000,
};

export interface TradeRecord {
  side: "long" | "short";
  entryT: number;
  exitT: number;
  entry: number;
  exit: number;
  reason: "stop" | "target" | "flip" | "end";
  pricePnl: number;
  fundingPnl: number;
  fees: number;
  net: number;
}

export interface BacktestOk {
  ok: true;
  symbol: string;
  params: BacktestParams;
  equity: [number, number][]; // [t, equity]
  startEquity: number;
  endEquity: number;
  totalReturnPct: number;
  pricePnl: number; // USD
  fundingPnl: number; // USD
  fees: number; // USD
  winRatePct: number | null;
  maxDrawdownPct: number;
  trades: number;
  tradeLog: TradeRecord[];
  days: number;
  bars: number;
  fundingCoveragePct: number;
  avgFundingApr: number; // % mean of the hourly funding series * 8760
  buyHoldPct: number;
  caveats: string[];
}

export interface BacktestFail {
  ok: false;
  symbol: string;
  reason: string;
}

export type BacktestResult = BacktestOk | BacktestFail;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function runBacktest(
  symbol: string,
  candles: Candle[],
  funding: FundingPoint[],
  overrides: Partial<BacktestParams> = {},
): BacktestResult {
  const p: BacktestParams = { ...DEFAULT_PARAMS, ...overrides };
  const fail = (reason: string): BacktestFail => ({ ok: false, symbol, reason });

  const bars = candles
    .filter((c) => [c.t, c.o, c.h, c.l, c.c].every(Number.isFinite) && c.c > 0)
    .sort((a, b) => a.t - b.t);
  if (bars.length < 24 * 7) return fail(`Only ${bars.length} hourly candles available (need at least 7 days).`);

  // funding keyed by hour bucket
  const fByHour = new Map<number, number>();
  for (const [t, r] of funding) if (Number.isFinite(t) && Number.isFinite(r)) fByHour.set(Math.floor(t / HOUR), r);
  if (fByHour.size === 0) return fail("No funding history available for this market.");

  // restrict to the window where funding history exists
  const fMin = Math.min(...fByHour.keys()) * HOUR;
  const win = bars.filter((b) => b.t >= fMin);
  if (win.length < 24 * 7) return fail(`Only ${(win.length / 24).toFixed(1)} days of overlapping price and funding data (need 7).`);
  let covered = 0;
  for (const b of win) if (fByHour.has(Math.floor(b.t / HOUR))) covered++;
  const coverage = covered / win.length;
  if (coverage < 0.8) return fail(`Funding history covers only ${(coverage * 100).toFixed(0)}% of the price window.`);

  const fr = (t: number) => fByHour.get(Math.floor(t / HOUR)) ?? 0;

  let cash = p.startEquity;
  let pos: null | {
    side: "long" | "short";
    qty: number;
    entry: number;
    stop: number;
    target: number;
    entryT: number;
    entryFee: number;
    funding: number;
  } = null;

  const equity: [number, number][] = [];
  const log: TradeRecord[] = [];
  let sumPrice = 0;
  let sumFunding = 0;
  let sumFees = 0;

  const close = (t: number, px: number, reason: TradeRecord["reason"]) => {
    if (!pos) return;
    const dir = pos.side === "long" ? 1 : -1;
    const pricePnl = dir * (px - pos.entry) * pos.qty;
    const exitFee = pos.qty * px * p.feePerSide;
    cash += pricePnl - exitFee;
    sumPrice += pricePnl;
    sumFees += exitFee;
    log.push({
      side: pos.side,
      entryT: pos.entryT,
      exitT: t,
      entry: pos.entry,
      exit: px,
      reason,
      pricePnl,
      fundingPnl: pos.funding,
      fees: pos.entryFee + exitFee,
      net: pricePnl + pos.funding - pos.entryFee - exitFee,
    });
    pos = null;
  };

  for (let i = 0; i < win.length; i++) {
    const b = win[i];

    // Daily re-evaluation at UTC midnight. Uses only data from BEFORE this bar (no lookahead).
    if (b.t % DAY === 0 && i >= 24) {
      const past = win.slice(i - 24, i);
      const avgHourly = past.reduce((s, x) => s + fr(x.t), 0) / past.length;
      const apr = avgHourly * 8760 * 100;
      const want: "long" | "short" | null = Math.abs(apr) < p.minAprPct || avgHourly === 0 ? null : avgHourly > 0 ? "short" : "long";
      if (pos && (pos as { side: string }).side !== want) close(b.t, b.o, "flip");
      if (!pos && want) {
        const hi = Math.max(...past.map((x) => x.h));
        const lo = Math.min(...past.map((x) => x.l));
        const stopPct = clamp(((hi - lo) / b.o) * 0.6, 0.012, 0.08);
        const notional = Math.min((p.riskPct * cash) / stopPct, p.maxLeverage * cash);
        const qty = notional / b.o;
        const fee = notional * p.feePerSide;
        cash -= fee;
        sumFees += fee;
        const sgn: number = want === "long" ? 1 : -1;
        pos = {
          side: want,
          qty,
          entry: b.o,
          stop: b.o * (1 - sgn * stopPct),
          target: b.o * (1 + sgn * stopPct * p.rewardR),
          entryT: b.t,
          entryFee: fee,
          funding: 0,
        };
      }
    }

    if (pos) {
      const cur = pos as NonNullable<typeof pos>;
      const long = cur.side === "long";
      // hourly funding accrual: longs pay when rate > 0
      const fp = (long ? -1 : 1) * fr(b.t) * cur.qty * b.o;
      cur.funding += fp;
      cash += fp;
      sumFunding += fp;

      // stop/target on the bar's range; if both touched in one bar assume the stop (conservative)
      const stopHit = long ? b.l <= cur.stop : b.h >= cur.stop;
      const targetHit = long ? b.h >= cur.target : b.l <= cur.target;
      if (stopHit) {
        const gap = long ? Math.min(cur.stop, b.o) : Math.max(cur.stop, b.o); // gap-through fills at open
        close(b.t + HOUR, gap, "stop");
      } else if (targetHit) {
        close(b.t + HOUR, cur.target, "target");
      }
    }

    // mark to market at bar close
    let mtm = cash;
    if (pos) {
      const cur = pos as NonNullable<typeof pos>;
      mtm += (cur.side === "long" ? 1 : -1) * (b.c - cur.entry) * cur.qty;
    }
    equity.push([b.t + HOUR, mtm]);
  }

  if (pos) close(win[win.length - 1].t + HOUR, win[win.length - 1].c, "end");
  // replace last point with realised (includes exit fee)
  equity[equity.length - 1] = [equity[equity.length - 1][0], cash];

  let peak = p.startEquity;
  let mdd = 0;
  for (const [, e] of equity) {
    peak = Math.max(peak, e);
    mdd = Math.max(mdd, (peak - e) / peak);
  }

  const wins = log.filter((t) => t.net > 0).length;
  const days = (win[win.length - 1].t + HOUR - win[0].t) / DAY;
  const fVals = win.map((b) => fr(b.t));
  const avgFundingApr = (fVals.reduce((s, x) => s + x, 0) / fVals.length) * 8760 * 100;

  const caveats = [
    `Backtest window: ${days.toFixed(0)} days of hourly data (Strike exposes at most 90 days of funding history). Small sample; past performance does not predict future results.`,
    "Funding is accrued every hour from Strike's recorded hourly rate (positive = longs pay shorts), the same way Strike settles it. The exact hour a recorded rate applies to is not documented; we apply it to the candle that opens at that timestamp.",
    "Side is chosen once per UTC day from the trailing 24h average funding; stop = clamp(0.6 x trailing 24h range, 1.2%, 8%), target = 2R. Only data before each decision is used.",
    `Sized to risk ${(p.riskPct * 100).toFixed(1)}% of equity at the stop (max ${p.maxLeverage}x), compounding. Fees ${(p.feePerSide * 100).toFixed(3)}% per side; no slippage, spread or liquidation modelling.`,
    "Stop/target are checked on hourly high/low; when both fall in the same candle the stop is assumed. Intra-hour order is unknown.",
  ];
  if (coverage < 0.999) caveats.push(`Funding was missing for ${((1 - coverage) * 100).toFixed(1)}% of hours; those hours accrue zero funding.`);
  if (log.length < 10) caveats.push(`Only ${log.length} trades: win rate and drawdown are statistically weak.`);
  const thin = win.filter((b) => b.h === b.l).length / win.length;
  if (thin > 0.2) caveats.push(`${(thin * 100).toFixed(0)}% of candles show no price movement (thin market); results may be unreliable.`);

  return {
    ok: true,
    symbol,
    params: p,
    equity,
    startEquity: p.startEquity,
    endEquity: cash,
    totalReturnPct: (cash / p.startEquity - 1) * 100,
    pricePnl: sumPrice,
    fundingPnl: sumFunding,
    fees: sumFees,
    winRatePct: log.length ? (wins / log.length) * 100 : null,
    maxDrawdownPct: mdd * 100,
    trades: log.length,
    tradeLog: log,
    days,
    bars: win.length,
    fundingCoveragePct: coverage * 100,
    avgFundingApr,
    buyHoldPct: (win[win.length - 1].c / win[0].o - 1) * 100,
    caveats,
  };
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { cache: "no-store", signal });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url.replace(STRIKE_API, "")}`);
  return res.json() as Promise<T>;
}

export async function fetchFundingHistory(symbol: string, days = 90, signal?: AbortSignal): Promise<FundingPoint[]> {
  const r = await getJson<{ data: [number, number][] }>(
    `${STRIKE_API}/stat/v1/stats/coin/history/funding?symbol=${encodeURIComponent(symbol)}&days=${days}`,
    signal,
  );
  return (r.data ?? []).map(([t, v]) => [Number(t), Number(v)] as FundingPoint);
}

export async function fetchCandles(symbol: string, startTime: number, signal?: AbortSignal): Promise<Candle[]> {
  const out: Candle[] = [];
  let from = startTime;
  for (let page = 0; page < 4; page++) {
    const rows = await getJson<unknown[][]>(
      `${STRIKE_API}/price/v2/klines?symbol=${encodeURIComponent(symbol)}&interval=1h&limit=1500&startTime=${from}`,
      signal,
    );
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const r of rows) out.push({ t: Number(r[0]), o: Number(r[1]), h: Number(r[2]), l: Number(r[3]), c: Number(r[4]) });
    const last = out[out.length - 1].t;
    if (rows.length < 1500 || last + HOUR <= from) break;
    from = last + HOUR;
  }
  // dedupe by open time
  return [...new Map(out.map((c) => [c.t, c])).values()];
}

export async function fetchAndBacktest(
  symbol: string,
  overrides: Partial<BacktestParams> = {},
  signal?: AbortSignal,
): Promise<BacktestResult> {
  const funding = await fetchFundingHistory(symbol, 90, signal);
  if (funding.length === 0) return { ok: false, symbol, reason: "Strike returned no funding history for this market." };
  const start = Math.min(...funding.map((f) => f[0]));
  const candles = await fetchCandles(symbol, start, signal);
  return runBacktest(symbol, candles, funding, overrides);
}
