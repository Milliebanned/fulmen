"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  INTERVAL_MS,
  applyLive,
  fmtPrice,
  fmtVol,
  makeScale,
  niceTicks,
  padRange,
  parseKlines,
  type Candle,
} from "@/lib/chartMath";

const API = "https://api.strikefinance.org";
const INTERVALS = ["15m", "1h", "4h"] as const;
type Interval = (typeof INTERVALS)[number];

const C = {
  up: "#16a34a",
  down: "#e11d6a",
  bolt: "#d97706",
  grid: "#e7ebf4",
  muted: "#6f7990",
};

interface Props {
  symbol: string;
  side?: "long" | "short";
  entry?: number;
  stop?: number;
  target?: number;
  livePrice?: number;
}

function fmtTime(t: number, interval: Interval, withDate: boolean) {
  const d = new Date(t);
  const hm = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const md = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (withDate) return interval === "4h" ? md : `${md} ${hm}`;
  return interval === "4h" ? md : hm;
}

const isPos = (x: number | undefined): x is number => typeof x === "number" && Number.isFinite(x) && x > 0;

export function PriceChart({ symbol, side, entry, stop, target, livePrice }: Props) {
  const [interval, setIntervalSel] = useState<Interval>("1h");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(640);
  const wrapRef = useRef<HTMLDivElement>(null);
  const loadedKey = useRef("");

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => {
      const w = Math.floor(e[0].contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const key = `${symbol}|${interval}`;
    let alive = true;
    const ctrl = new AbortController();
    if (loadedKey.current !== key) {
      setStatus("loading");
      setCandles([]);
      setHover(null);
    }
    const load = async () => {
      try {
        const res = await fetch(
          `${API}/price/v2/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=120`,
          { signal: ctrl.signal },
        );
        if (!res.ok) throw new Error(String(res.status));
        const rows = parseKlines(await res.json());
        if (!alive) return;
        loadedKey.current = key;
        setCandles(rows);
        setStatus("ok");
      } catch {
        if (!alive || ctrl.signal.aborted) return;
        // a failed background refresh keeps the stale candles on screen
        if (loadedKey.current !== key) setStatus("error");
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      ctrl.abort();
      clearInterval(id);
    };
  }, [symbol, interval]);

  const ms = INTERVAL_MS[interval];
  const data = useMemo(() => applyLive(candles, livePrice, ms), [candles, livePrice, ms]);

  const compact = width < 480;
  const H = compact ? 280 : 340;
  const padL = 6;
  const padR = compact ? 58 : 70;
  const padT = 10;
  const padB = 22;
  const volH = Math.round((H - padT - padB) * 0.16);
  const plotW = Math.max(40, width - padL - padR);
  const priceB = H - padB - volH - 6;

  const geo = useMemo(() => {
    if (!data.length) return null;
    const lines = [entry, stop, target].filter(isPos);
    const lo0 = Math.min(...data.map((d) => d.l), ...lines);
    const hi0 = Math.max(...data.map((d) => d.h), ...lines);
    const [lo, hi] = padRange(lo0, hi0, 0.06);
    const ticks = niceTicks(lo, hi, compact ? 4 : 5);
    const step = ticks.length > 1 ? ticks[1] - ticks[0] : hi - lo;
    const y = makeScale(lo, hi, priceB, padT);
    const maxV = Math.max(...data.map((d) => d.v), 0);
    const yv = (v: number) => (maxV > 0 ? H - padB - (v / maxV) * volH : H - padB);
    const slot = plotW / data.length;
    const x = (i: number) => padL + slot * (i + 0.5);
    return { y, yv, x, slot, ticks, step };
  }, [data, entry, stop, target, compact, plotW, priceB, H, volH]);

  const last = data[data.length - 1];
  const shown = hover !== null && data[hover] ? data[hover] : last;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!geo || !data.length) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * width;
    const i = Math.round((px - padL) / geo.slot - 0.5);
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  const levels: { v: number; label: string; color: string }[] = [];
  if (isPos(target)) levels.push({ v: target, label: "TP", color: C.up });
  if (isPos(entry)) levels.push({ v: entry, label: "ENTRY", color: C.bolt });
  if (isPos(stop)) levels.push({ v: stop, label: "SL", color: C.down });

  const tickLabel = (v: number) => fmtPrice(v, geo?.step);
  const lvlLabel = (v: number) => fmtPrice(v, geo ? geo.step / 10 : undefined);

  const labelEvery = Math.max(1, Math.ceil(data.length / (compact ? 4 : 7)));
  const change = shown ? shown.c - shown.o : 0;
  const changePct = shown && shown.o > 0 ? (change / shown.o) * 100 : 0;

  return (
    <div className="card p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
          {symbol} chart
          {side ? <span className={side === "long" ? "text-up" : "text-down"}> · {side}</span> : null}
        </div>
        <div className="flex gap-1">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              type="button"
              onClick={() => setIntervalSel(iv)}
              className={`rounded-md border px-2 py-0.5 text-[11px] transition-colors ${
                iv === interval ? "border-bolt/60 bg-bolt/10 text-bolt" : "border-line text-muted hover:text-ink"
              }`}
            >
              {iv}
            </button>
          ))}
        </div>
      </div>

      <div className="num mb-1 flex min-h-[18px] flex-wrap gap-x-3 text-[11px] text-muted">
        {shown ? (
          <>
            <span>{fmtTime(shown.t, interval, true)}</span>
            <span>O <b className="font-medium text-ink">{fmtPrice(shown.o)}</b></span>
            <span>H <b className="font-medium text-ink">{fmtPrice(shown.h)}</b></span>
            <span>L <b className="font-medium text-ink">{fmtPrice(shown.l)}</b></span>
            <span>C <b className="font-medium text-ink">{fmtPrice(shown.c)}</b></span>
            <span className={change >= 0 ? "text-up" : "text-down"}>
              {change >= 0 ? "+" : ""}
              {changePct.toFixed(2)}%
            </span>
            <span>Vol {fmtVol(shown.v)}</span>
          </>
        ) : null}
      </div>

      <div ref={wrapRef} className="relative w-full" style={{ height: H }}>
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted">Loading candles…</div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-down">
            Could not load chart data for {symbol}.
          </div>
        )}
        {status === "ok" && !data.length && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted">
            No candle data for {symbol} on {interval}.
          </div>
        )}
        {geo && data.length > 0 && (
          <svg
            width={width}
            height={H}
            viewBox={`0 0 ${width} ${H}`}
            className="block touch-pan-y select-none"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
            role="img"
            aria-label={`${symbol} ${interval} candlestick chart`}
          >
            {geo.ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={padL + plotW} y1={geo.y(t)} y2={geo.y(t)} stroke={C.grid} strokeWidth={1} />
                <text x={padL + plotW + 6} y={geo.y(t) + 3} fontSize={10} fill={C.muted} className="num">
                  {tickLabel(t)}
                </text>
              </g>
            ))}

            {isPos(entry) && isPos(stop) && (
              <rect
                x={padL}
                width={plotW}
                y={Math.min(geo.y(entry), geo.y(stop))}
                height={Math.abs(geo.y(stop) - geo.y(entry))}
                fill={C.down}
                opacity={0.1}
              />
            )}
            {isPos(entry) && isPos(target) && (
              <rect
                x={padL}
                width={plotW}
                y={Math.min(geo.y(entry), geo.y(target))}
                height={Math.abs(geo.y(target) - geo.y(entry))}
                fill={C.up}
                opacity={0.1}
              />
            )}

            {data.map((d, i) =>
              i % labelEvery === 0 && i > 0 && i < data.length - 1 ? (
                <text key={d.t} x={geo.x(i)} y={H - 6} fontSize={10} fill={C.muted} textAnchor="middle" className="num">
                  {fmtTime(d.t, interval, false)}
                </text>
              ) : null,
            )}

            {data.map((d, i) => {
              const top = geo.yv(d.v);
              const bw = Math.max(1, geo.slot * 0.7);
              return (
                <rect
                  key={`v${d.t}`}
                  x={geo.x(i) - bw / 2}
                  y={top}
                  width={bw}
                  height={Math.max(0, H - padB - top)}
                  fill={d.c >= d.o ? C.up : C.down}
                  opacity={0.28}
                />
              );
            })}

            {data.map((d, i) => {
              const col = d.c >= d.o ? C.up : C.down;
              const cx = geo.x(i);
              const bw = Math.max(1, geo.slot * 0.7);
              const yo = geo.y(d.o);
              const yc = geo.y(d.c);
              return (
                <g key={d.t}>
                  <line x1={cx} x2={cx} y1={geo.y(d.h)} y2={geo.y(d.l)} stroke={col} strokeWidth={1} />
                  <rect x={cx - bw / 2} y={Math.min(yo, yc)} width={bw} height={Math.max(1, Math.abs(yo - yc))} fill={col} />
                </g>
              );
            })}

            {levels.map((l) => {
              const y = geo.y(l.v);
              return (
                <g key={l.label}>
                  <line
                    x1={padL}
                    x2={padL + plotW}
                    y1={y}
                    y2={y}
                    stroke={l.color}
                    strokeWidth={1.2}
                    strokeDasharray={l.label === "ENTRY" ? undefined : "5 4"}
                  />
                  <rect x={padL + plotW + 1} y={y - 7} width={padR - 2} height={14} rx={3} fill={l.color} />
                  <text x={padL + plotW + 4} y={y + 3} fontSize={9.5} fontWeight={600} fill="#ffffff" className="num">
                    {lvlLabel(l.v)}
                  </text>
                  <text x={padL + 4} y={y - 4} fontSize={9.5} fontWeight={600} fill={l.color}>
                    {l.label}
                  </text>
                </g>
              );
            })}

            {last && (
              <g>
                <line
                  x1={padL}
                  x2={padL + plotW}
                  y1={geo.y(last.c)}
                  y2={geo.y(last.c)}
                  stroke="#0e1220"
                  strokeOpacity={0.35}
                  strokeDasharray="2 3"
                />
                <rect x={padL + plotW + 1} y={geo.y(last.c) - 7} width={padR - 2} height={14} rx={3} fill="#0e1220" />
                <text x={padL + plotW + 4} y={geo.y(last.c) + 3} fontSize={9.5} fill="#ffffff" className="num">
                  {lvlLabel(last.c)}
                </text>
              </g>
            )}

            {hover !== null && data[hover] && (
              <g pointerEvents="none">
                <line x1={geo.x(hover)} x2={geo.x(hover)} y1={padT} y2={H - padB} stroke={C.muted} strokeDasharray="3 3" opacity={0.7} />
                <line x1={padL} x2={padL + plotW} y1={geo.y(data[hover].c)} y2={geo.y(data[hover].c)} stroke={C.muted} strokeDasharray="3 3" opacity={0.5} />
              </g>
            )}
          </svg>
        )}
      </div>
    </div>
  );
}
