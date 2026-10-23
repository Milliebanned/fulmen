"use client";

// A real 90-day backtest curve (ADA-USD, funding-carry rule) shown on a tilted glass card.
// Numbers are computed live from Strike history; nothing here is decorative data.

import { useEffect, useRef, useState } from "react";
import { fetchAndBacktest, type BacktestResult } from "@/lib/backtest";

const SYMBOL = "ADA-USD";

function Curve({ points }: { points: [number, number][] }) {
  const W = 600;
  const H = 180;
  const ys = points.map((p) => p[1]);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const t0 = points[0][0];
  const t1 = points[points.length - 1][0];
  const x = (t: number) => ((t - t0) / (t1 - t0 || 1)) * W;
  const y = (v: number) => H - 8 - ((v - min) / (max - min || 1)) * (H - 24);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(" ");
  const base = y(points[0][1]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label="90-day equity curve">
      <defs>
        <linearGradient id="lbc-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7aa5ff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#7aa5ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" x2={W} y1={base} y2={base} stroke="#ffffff" strokeOpacity="0.25" strokeDasharray="4 5" />
      <path d={`${d} L${W},${H} L0,${H} Z`} fill="url(#lbc-fill)" />
      <path d={d} fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}

export function LiveBacktestCard() {
  const [r, setR] = useState<BacktestResult | null>(null);
  const [failed, setFailed] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetchAndBacktest(SYMBOL, undefined, ac.signal)
      .then(setR)
      .catch(() => !ac.signal.aborted && setFailed(true));
    return () => ac.abort();
  }, []);

  const tilt = (e: React.PointerEvent) => {
    const s = stage.current;
    const c = card.current;
    if (!s || !c) return;
    const b = s.getBoundingClientRect();
    const px = (e.clientX - b.left) / b.width - 0.5;
    const py = (e.clientY - b.top) / b.height - 0.5;
    c.style.transform = `rotateX(${(8 - py * 14).toFixed(2)}deg) rotateY(${(-12 + px * 18).toFixed(2)}deg)`;
  };
  const rest = () => {
    if (card.current) card.current.style.transform = "rotateX(8deg) rotateY(-12deg)";
  };

  const ok = r && r.ok ? r : null;
  const stat = (label: string, value: string, good?: boolean) => (
    <div className="rounded-2xl bg-white/10 px-3.5 py-2.5 backdrop-blur-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/60">{label}</div>
      <div className={`num mt-0.5 text-lg font-bold ${good === undefined ? "text-white" : good ? "text-[#7dffb0]" : "text-[#ff9bb8]"}`}>{value}</div>
    </div>
  );

  return (
    <div ref={stage} onPointerMove={tilt} onPointerLeave={rest} className="[perspective:1400px]">
      <div
        ref={card}
        className="relative rounded-[28px] border border-white/25 p-5 shadow-[0_40px_90px_rgba(5,15,70,0.55)] transition-transform duration-200 ease-out [transform-style:preserve-3d] sm:p-7"
        style={{ transform: "rotateX(8deg) rotateY(-12deg)", background: "linear-gradient(150deg, rgba(120,160,255,0.35), rgba(20,50,170,0.55))" }}
      >
        <div className="flex items-center justify-between [transform:translateZ(30px)]">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">{SYMBOL} · last 90 days · funding-carry rule</div>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">computed live</span>
        </div>

        <div className="mt-4 [transform:translateZ(55px)]">
          {ok ? <Curve points={ok.equity} /> : <div className={`h-40 rounded-2xl bg-white/10 ${failed ? "" : "animate-pulse"}`} />}
          {failed && <p className="mt-2 text-xs text-white/70">Strike history is unreachable right now.</p>}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 [transform:translateZ(80px)]">
          {ok ? (
            <>
              {stat("Return", `${ok.totalReturnPct >= 0 ? "+" : ""}${ok.totalReturnPct.toFixed(1)}%`, ok.totalReturnPct >= 0)}
              {stat("Max drawdown", `-${ok.maxDrawdownPct.toFixed(1)}%`, false)}
              {stat("Trades", String(ok.trades))}
              {stat("Funding earned", `${ok.fundingPnl >= 0 ? "+" : "-"}$${Math.abs(Math.round(ok.fundingPnl))}`, ok.fundingPnl >= 0)}
            </>
          ) : (
            [0, 1, 2, 3].map((i) => <div key={i} className="h-[60px] rounded-2xl bg-white/10" />)
          )}
        </div>
      </div>
    </div>
  );
}
