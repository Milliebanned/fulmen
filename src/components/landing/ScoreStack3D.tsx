"use client";

import { LogoGlyph } from "@/components/Logo";

import { useEffect, useRef } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

/* Tunables */
const STAGE = 520; // design-space px; the stage is scaled to fit its container
const MAX_TILT_Z = 11; // deg, horizontal pointer tilt
const MAX_TILT_X = 7; // deg, vertical pointer tilt
const EASE = 0.12; // pointer-tilt smoothing per frame

interface Layer {
  key: string;
  name: string;
  weight: number;
  color: string;
  z: number;
  hint: string;
}

// Bottom to top. Weights sum to 100; the volatility penalty is subtracted afterwards.
const LAYERS: readonly Layer[] = [
  { key: "liq", name: "Liquidity", weight: 22, color: "#f59e0b", z: 0, hint: "can you exit cleanly" },
  { key: "smart", name: "Smart money", weight: 18, color: "#6d5ef6", z: 120, hint: "who is positioned" },
  { key: "mom", name: "Momentum", weight: 20, color: "#16a34a", z: 240, hint: "trend behind the carry" },
  { key: "fund", name: "Funding carry", weight: 40, color: "#2f6df6", z: 360, hint: "rate you collect, annualised" },
];

const CSS = `
.ss-root{position:relative;width:100%;max-width:560px;aspect-ratio:1/1;margin-inline:auto;touch-action:pan-y;-webkit-tap-highlight-color:transparent}
.ss-root:not([data-ready]) .ss-stage{opacity:0}
.ss-stage{position:absolute;left:50%;top:50%;width:${STAGE}px;height:${STAGE}px;transform:translate(-50%,-50%) scale(var(--ss-s,1));transform-origin:50% 50%;perspective:1700px;perspective-origin:50% 38%;transition:opacity .4s}
.ss-float{position:absolute;inset:0;transform-style:preserve-3d;animation:ss-float 7s ease-in-out infinite}
.ss-tilt{position:absolute;inset:0;transform-style:preserve-3d;transform:translateY(150px) rotateX(calc(58deg + var(--ss-ty,0deg))) rotateZ(calc(-28deg + var(--ss-tx,0deg)))}
.ss-shadow{position:absolute;left:96px;top:140px;width:330px;height:240px;border-radius:44px;background:radial-gradient(closest-side,rgba(18,48,153,.55),rgba(18,48,153,.18) 70%,transparent);filter:blur(22px);transform:translateZ(-150px)}
.ss-slab{--zz:0px;position:absolute;left:110px;top:160px;width:300px;height:200px;box-sizing:border-box;padding:20px 22px;border-radius:30px;cursor:default;color:#0e1220;outline:none;overflow:hidden;
  background:linear-gradient(150deg,rgba(255,255,255,.82) 0%,color-mix(in srgb,var(--c) 30%,rgba(255,255,255,.55)) 62%,color-mix(in srgb,var(--c) 52%,rgba(255,255,255,.35)) 100%);
  border:1.5px solid rgba(255,255,255,.9);
  box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--c) 55%,white),inset 0 -26px 40px -24px color-mix(in srgb,var(--c) 60%,transparent),0 0 34px -4px color-mix(in srgb,var(--c) 55%,transparent),0 18px 30px -18px rgba(18,48,153,.45);
  transform:translateZ(var(--zz));transition:transform .45s cubic-bezier(.2,.8,.2,1),opacity .3s,box-shadow .3s}
.ss-slab::before{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(115deg,rgba(255,255,255,.7) 0%,rgba(255,255,255,0) 38%);pointer-events:none}
.ss-slab:is(:hover,:focus-visible){transform:translateZ(calc(var(--zz) + 54px));box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--c) 80%,white),0 0 54px -2px color-mix(in srgb,var(--c) 75%,transparent),0 30px 40px -18px rgba(18,48,153,.5)}
.ss-slab:focus-visible{outline:3px solid #0a1a5c;outline-offset:4px}
.ss-stack:has(.ss-slab:is(:hover,:focus-visible)) .ss-slab:not(:is(:hover,:focus-visible)){opacity:.42}
.ss-row{position:relative;display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.ss-name{font-size:24px;font-weight:700;letter-spacing:-.01em;line-height:1.1}
.ss-hint{margin-top:4px;font-size:13px;font-weight:500;color:rgba(14,18,32,.62)}
.ss-weight{font-family:var(--font-geist-mono),ui-monospace,monospace;font-size:34px;font-weight:700;line-height:1;color:color-mix(in srgb,var(--c) 85%,#0e1220)}
.ss-track{position:absolute;left:22px;right:22px;bottom:22px;height:10px;border-radius:99px;background:rgba(14,18,32,.12);overflow:hidden}
.ss-fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,color-mix(in srgb,var(--c) 70%,white),var(--c));box-shadow:0 0 12px var(--c)}
.ss-penalty{--zz:-64px;--c:#e11d6a;background:repeating-linear-gradient(135deg,rgba(225,29,106,.2) 0 8px,rgba(255,255,255,.35) 8px 16px);border-style:dashed;border-color:rgba(225,29,106,.7);box-shadow:inset 0 0 0 1px rgba(225,29,106,.25),0 0 28px -6px rgba(225,29,106,.55)}
.ss-penalty .ss-name{font-size:20px;color:#9f1247}
.ss-orb-wrap{position:absolute;left:${STAGE / 2}px;top:${STAGE / 2}px;width:0;height:0;transform-style:preserve-3d;transform:translateZ(500px) rotateZ(28deg) rotateX(-58deg);pointer-events:none}
.ss-orb{position:absolute;left:-52px;top:-52px;width:104px;height:104px;border-radius:50%;display:grid;place-items:center;
  background:radial-gradient(circle at 34% 28%,#fff 0%,#cfe0ff 22%,#2f6df6 62%,#0a1a5c 100%);box-shadow:inset -8px -10px 18px rgba(10,26,92,.55),0 0 0 6px rgba(255,255,255,.35),0 0 60px 14px rgba(47,109,246,.55)}
.ss-orb-glow{position:absolute;left:-90px;top:-90px;width:180px;height:180px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,255,255,.75),rgba(169,199,255,.35) 55%,transparent);animation:ss-pulse 3.4s ease-in-out infinite}
.ss-orb-num{position:relative;font-family:var(--font-geist-mono),ui-monospace,monospace;font-size:44px;line-height:1;font-weight:700;color:#fff;text-shadow:0 2px 10px rgba(10,26,92,.6)}
.ss-orb-label{position:absolute;left:70px;top:-16px;white-space:nowrap;padding:6px 14px;border-radius:99px;font-size:15px;font-weight:700;letter-spacing:.01em;color:#fff;background:#0a1a5c;box-shadow:0 8px 20px rgba(10,26,92,.35)}
@keyframes ss-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
@keyframes ss-pulse{0%,100%{opacity:.75;transform:scale(1)}50%{opacity:1;transform:scale(1.12)}}
@media (prefers-reduced-motion:reduce){.ss-float,.ss-orb-glow{animation:none}.ss-slab{transition:none}}
`;

export default function ScoreStack3D({ className }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const tilt = useRef({ tx: 0, ty: 0, cx: 0, cy: 0, raf: 0 });

  // Scale the fixed design-space stage to the container width.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const fit = () => {
      const w = root.clientWidth;
      if (w > 0) {
        root.style.setProperty("--ss-s", String(w / STAGE));
        root.setAttribute("data-ready", "");
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const t = tilt.current;
    return () => {
      if (t.raf) cancelAnimationFrame(t.raf);
      t.raf = 0;
    };
  }, []);

  const tick = () => {
    const t = tilt.current;
    t.cx += (t.tx - t.cx) * EASE;
    t.cy += (t.ty - t.cy) * EASE;
    const stage = stageRef.current;
    if (stage) {
      stage.style.setProperty("--ss-tx", `${(t.cx * MAX_TILT_Z).toFixed(2)}deg`);
      stage.style.setProperty("--ss-ty", `${(t.cy * MAX_TILT_X).toFixed(2)}deg`);
    }
    if (Math.abs(t.tx - t.cx) > 0.002 || Math.abs(t.ty - t.cy) > 0.002) {
      t.raf = requestAnimationFrame(tick);
    } else {
      t.raf = 0;
    }
  };

  const schedule = () => {
    if (!tilt.current.raf) tilt.current.raf = requestAnimationFrame(tick);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    tilt.current.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    tilt.current.ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
    schedule();
  };

  const onPointerLeave = () => {
    tilt.current.tx = 0;
    tilt.current.ty = 0;
    schedule();
  };

  return (
    <div
      ref={rootRef}
      className={`ss-root ${className ?? ""}`}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      role="group"
      aria-label="Conviction score: four weighted layers minus a volatility penalty"
    >
      <style href="fulmen-score-stack-3d" precedence="default">
        {CSS}
      </style>
      <div ref={stageRef} className="ss-stage">
        <div className="ss-float">
          <div className="ss-tilt ss-stack" style={{ transformStyle: "preserve-3d" }}>
            <div className="ss-shadow" />

            <div
              className="ss-slab ss-penalty"
              tabIndex={0}
              aria-label="Minus volatility penalty: subtracted from the weighted sum"
            >
              <div className="ss-row">
                <div>
                  <div className="ss-name">&minus; Volatility penalty</div>
                  <div className="ss-hint">subtracted from the total</div>
                </div>
              </div>
            </div>

            {LAYERS.map((l) => (
              <div
                key={l.key}
                className="ss-slab"
                tabIndex={0}
                aria-label={`${l.name}, weight ${l.weight} percent of the conviction score`}
                style={{ "--c": l.color, "--zz": `${l.z}px` } as CSSProperties}
              >
                <div className="ss-row">
                  <div>
                    <div className="ss-name">{l.name}</div>
                    <div className="ss-hint">{l.hint}</div>
                  </div>
                  <div className="ss-weight">{l.weight}%</div>
                </div>
                <div className="ss-track" aria-hidden="true">
                  <div className="ss-fill" style={{ width: `${(l.weight / 40) * 100}%` }} />
                </div>
              </div>
            ))}

            <div className="ss-orb-wrap" aria-label="Conviction 0 to 100" role="img">
              <div className="ss-orb-glow" />
              <div className="ss-orb">
                <LogoGlyph className="relative h-14 w-14 text-white" bg="#2f6df6" satellite="#bcd3ff" />
              </div>
              <div className="ss-orb-label">Conviction 0&ndash;100</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
