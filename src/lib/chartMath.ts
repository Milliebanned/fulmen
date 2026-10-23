// Pure helpers for the price chart (no React, no DOM).

export interface Candle {
  t: number; // open time (ms)
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

/** Pad a [min,max] range so it is never zero-width and has breathing room. */
export function padRange(min: number, max: number, frac = 0.06): [number, number] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (max < min) [min, max] = [max, min];
  let span = max - min;
  if (span <= 0) span = Math.abs(max) * 0.02 || 1;
  const pad = span * frac;
  return [min - pad - (max === min ? span / 2 : 0), max + pad + (max === min ? span / 2 : 0)];
}

/** Round a raw step to 1/2/2.5/5/10 x 10^n. */
export function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  const m = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return m * p;
}

/** Decimal places needed to display multiples of `step` exactly. */
export function decimalsForStep(step: number): number {
  if (!(step > 0) || !Number.isFinite(step)) return 2;
  let d = 0;
  let s = step;
  while (d < 12 && Math.abs(Math.round(s) - s) > 1e-9 * Math.max(1, s)) {
    s *= 10;
    d++;
  }
  return d;
}

export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (max <= min) return [min];
  const step = niceStep((max - min) / Math.max(1, count));
  const dec = decimalsForStep(step);
  const out: number[] = [];
  const start = Math.ceil(min / step - 1e-9);
  for (let i = start; i * step <= max + step * 1e-9 && out.length < 50; i++) {
    out.push(Number((i * step).toFixed(Math.min(dec, 12))));
  }
  return out;
}

/** Significant-digit price formatting; `step` (tick spacing) fixes decimals when given. */
export function fmtPrice(v: number, step?: number): string {
  if (!Number.isFinite(v)) return "–";
  const a = Math.abs(v);
  if (step && step > 0) {
    const d = Math.min(decimalsForStep(step), 12);
    return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  if (a === 0) return "0";
  if (a >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (a >= 1) return v.toLocaleString("en-US", { maximumFractionDigits: 4 });
  // < 1: keep 4 significant digits
  const d = Math.min(12, Math.max(2, 3 - Math.floor(Math.log10(a))) + 1);
  return v.toFixed(d).replace(/0+$/, "").replace(/\.$/, "");
}

export function fmtVol(v: number): string {
  if (!Number.isFinite(v)) return "–";
  const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return (v / 1e3).toFixed(2) + "K";
  return v.toFixed(a >= 10 ? 1 : 2);
}

/** Linear scale; degenerate domains map to the middle of the range. */
export function makeScale(d0: number, d1: number, r0: number, r1: number) {
  const span = d1 - d0;
  return (x: number) => (span === 0 || !Number.isFinite(span) ? (r0 + r1) / 2 : r0 + ((x - d0) / span) * (r1 - r0));
}

/** Parse Strike kline rows; drops malformed rows. */
export function parseKlines(rows: unknown): Candle[] {
  if (!Array.isArray(rows)) return [];
  const out: Candle[] = [];
  for (const r of rows) {
    if (!Array.isArray(r)) continue;
    const [t, o, h, l, c, v] = [Number(r[0]), Number(r[1]), Number(r[2]), Number(r[3]), Number(r[4]), Number(r[5])];
    if (![t, o, h, l, c].every(Number.isFinite)) continue;
    out.push({ t, o, h: Math.max(h, o, c), l: Math.min(l, o, c), c, v: Number.isFinite(v) ? v : 0 });
  }
  return out.sort((a, b) => a.t - b.t);
}

export const INTERVAL_MS: Record<string, number> = { "15m": 900_000, "1h": 3_600_000, "4h": 14_400_000 };

/** Apply a live price to the candle series (updates or opens the current candle). */
export function applyLive(candles: Candle[], price: number | undefined, ms: number, now = Date.now()): Candle[] {
  if (!candles.length || price === undefined || !Number.isFinite(price) || price <= 0) return candles;
  const last = candles[candles.length - 1];
  if (now >= last.t + ms) {
    const t = last.t + Math.floor((now - last.t) / ms) * ms;
    return [...candles, { t, o: last.c, h: Math.max(last.c, price), l: Math.min(last.c, price), c: price, v: 0 }];
  }
  return [...candles.slice(0, -1), { ...last, c: price, h: Math.max(last.h, price), l: Math.min(last.l, price) }];
}
