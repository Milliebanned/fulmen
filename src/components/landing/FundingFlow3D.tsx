"use client";

import { Component, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/* ------------------------------------------------------------------ */
/* Tunables                                                            */
/* ------------------------------------------------------------------ */
const PARTICLE_COUNT = 120;
const PULSE_PERIOD = 6; // seconds between "hourly settlement" surges
const BASE_SPEED = 0.07; // arc traversals per second when idle
const SURGE_SPEED = 0.55; // extra traversals per second at peak surge
const STILL_TIME = 0.9; // clock time used for the reduced-motion frame
const SPHERE_X = 3;
const SPHERE_R = 1.15;
const FOV = 40;
const HALF_TAN = Math.tan((FOV / 2) * (Math.PI / 180));
const PINK = "#e11d6a";
const GREEN = "#10c9a0";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Camera distance that keeps both spheres in frame for a given aspect. */
function cameraDistance(aspect: number): number {
  return Math.min(20, Math.max(8, 4.7 / (HALF_TAN * Math.max(aspect, 0.2))));
}

/** 0..1 surge envelope for time since last settlement. */
function surgeAt(cycle: number): number {
  return cycle < 0.25 ? cycle / 0.25 : Math.exp(-(cycle - 0.25) * 1.6);
}

let webglCache: boolean | null = null;
function detectWebGL(): boolean {
  if (webglCache !== null) return webglCache;
  try {
    const c = document.createElement("canvas");
    webglCache = Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    webglCache = false;
  }
  return webglCache;
}
const subscribeNoop = () => () => {};
const getWebGLSnapshot = () => detectWebGL();
const getWebGLServer = () => true;

function subscribeReduced(cb: () => void): () => void {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const getReduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const getReducedServer = () => false;

/* ------------------------------------------------------------------ */
/* Scene pieces                                                        */
/* ------------------------------------------------------------------ */
function CameraRig({ still }: { still: boolean }) {
  const initialised = useRef(false);
  useFrame((state, delta) => {
    const { camera, pointer, size } = state;
    const t = still ? STILL_TIME : state.clock.elapsedTime;
    const dist = cameraDistance(size.width / Math.max(size.height, 1));
    const tx = (still ? 0 : pointer.x * 0.9) + Math.sin(t * 0.15) * 0.55;
    const ty = 0.75 + (still ? 0 : pointer.y * 0.35) + Math.sin(t * 0.21) * 0.14;
    if (!initialised.current || still) {
      camera.position.set(tx, ty, dist);
      initialised.current = true;
    } else {
      const k = 1 - Math.exp(-Math.min(delta, 0.1) * 3);
      camera.position.x += (tx - camera.position.x) * k;
      camera.position.y += (ty - camera.position.y) * k;
      camera.position.z += (dist - camera.position.z) * k;
    }
    camera.lookAt(0, 0.45, 0);
  });
  return null;
}

function Spheres({ still }: { still: boolean }) {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  useFrame((state) => {
    const t = still ? STILL_TIME : state.clock.elapsedTime;
    const s = surgeAt(t % PULSE_PERIOD);
    const bob = still ? 0 : Math.sin(t * 0.7);
    if (left.current) {
      left.current.scale.setScalar(1 - 0.035 * s);
      left.current.position.y = bob * 0.06;
    }
    if (right.current) {
      right.current.scale.setScalar(1 + 0.07 * s);
      right.current.position.y = -bob * 0.06;
    }
  });

  return (
    <>
      <group ref={left} position={[-SPHERE_X, 0, 0]}>
        <mesh>
          <sphereGeometry args={[SPHERE_R, 64, 64]} />
          <meshPhysicalMaterial
            color={PINK}
            emissive="#8a0b40"
            emissiveIntensity={0.55}
            roughness={0.16}
            metalness={0.05}
            clearcoat={1}
            clearcoatRoughness={0.06}
          />
        </mesh>
        <mesh scale={1.22}>
          <sphereGeometry args={[SPHERE_R, 32, 32]} />
          <meshBasicMaterial
            color={PINK}
            transparent
            opacity={0.13}
            side={THREE.BackSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
      <group ref={right} position={[SPHERE_X, 0, 0]}>
        <mesh>
          <sphereGeometry args={[SPHERE_R, 64, 64]} />
          <meshPhysicalMaterial
            color={GREEN}
            emissive="#05604f"
            emissiveIntensity={0.55}
            roughness={0.16}
            metalness={0.05}
            clearcoat={1}
            clearcoatRoughness={0.06}
          />
        </mesh>
        <mesh scale={1.22}>
          <sphereGeometry args={[SPHERE_R, 32, 32]} />
          <meshBasicMaterial
            color={GREEN}
            transparent
            opacity={0.14}
            side={THREE.BackSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
    </>
  );
}

function Stream({ still }: { still: boolean }) {
  const core = useRef<THREE.InstancedMesh>(null);
  const halo = useRef<THREE.InstancedMesh>(null);
  const flow = useRef(0);
  const invalidate = useThree((s) => s.invalidate);

  const curve = useMemo(
    () =>
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-SPHERE_X + 0.75, 0.75, 0),
        new THREE.Vector3(0, 3.3, 0),
        new THREE.Vector3(SPHERE_X - 0.75, 0.75, 0),
      ),
    [],
  );

  const data = useMemo(() => {
    const rnd = mulberry32(20240611);
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      offset: (i + rnd() * 0.8) / PARTICLE_COUNT,
      dy: (rnd() - 0.5) * 0.3,
      dz: (rnd() - 0.5) * 0.7,
      size: 0.6 + rnd() * 0.7,
    }));
  }, []);

  const scratch = useMemo(
    () => ({ obj: new THREE.Object3D(), p: new THREE.Vector3(), a: new THREE.Color(PINK), b: new THREE.Color(GREEN), c: new THREE.Color() }),
    [],
  );

  useEffect(() => {
    const { a, b, c } = scratch;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      c.copy(a).lerp(b, data[i].offset);
      core.current?.setColorAt(i, c);
      halo.current?.setColorAt(i, c);
    }
    if (core.current?.instanceColor) core.current.instanceColor.needsUpdate = true;
    if (halo.current?.instanceColor) halo.current.instanceColor.needsUpdate = true;
    invalidate();
  }, [data, scratch, invalidate]);

  useFrame((state, delta) => {
    const t = still ? STILL_TIME : state.clock.elapsedTime;
    const s = surgeAt(t % PULSE_PERIOD);
    if (!still) flow.current += Math.min(delta, 0.05) * (BASE_SPEED + SURGE_SPEED * s);
    const { obj, p } = scratch;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const d = data[i];
      const u = (d.offset + flow.current) % 1;
      curve.getPoint(u, p);
      const edge = Math.sin(Math.PI * u);
      const spread = edge * (1 + 0.8 * s);
      obj.position.set(p.x, p.y + d.dy * spread, p.z + d.dz * spread);
      const sc = (0.045 + 0.05 * s) * d.size * Math.pow(edge, 0.6);
      obj.scale.setScalar(sc);
      obj.updateMatrix();
      core.current?.setMatrixAt(i, obj.matrix);
      obj.scale.setScalar(sc * 3.2);
      obj.updateMatrix();
      halo.current?.setMatrixAt(i, obj.matrix);
    }
    if (core.current) core.current.instanceMatrix.needsUpdate = true;
    if (halo.current) halo.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <mesh>
        <tubeGeometry args={[curve, 80, 0.011, 6, false]} />
        <meshBasicMaterial color="#a9c7ff" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <instancedMesh ref={core} args={[undefined, undefined, PARTICLE_COUNT]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={halo} args={[undefined, undefined, PARTICLE_COUNT]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          toneMapped={false}
          transparent
          opacity={0.16}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
    </>
  );
}

function SettlementRings({ still }: { still: boolean }) {
  const ringA = useRef<THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>>(null);
  const ringB = useRef<THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>>(null);
  useFrame((state) => {
    const t = still ? STILL_TIME : state.clock.elapsedTime;
    const cycle = t % PULSE_PERIOD;
    const apply = (m: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial> | null, delay: number) => {
      if (!m) return;
      const p = clamp01((cycle - delay) / 2.6);
      const active = cycle >= delay && p < 1;
      m.visible = active;
      if (!active) return;
      m.scale.setScalar(1.15 + p * 2.7);
      m.material.opacity = Math.pow(1 - p, 1.6) * 0.85;
    };
    apply(ringA.current, 0);
    apply(ringB.current, 0.4);
  });
  return (
    <group position={[SPHERE_X, 0, 0]}>
      <mesh ref={ringA} visible={false}>
        <torusGeometry args={[SPHERE_R, 0.018, 8, 128]} />
        <meshBasicMaterial color={GREEN} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={ringB} visible={false}>
        <torusGeometry args={[SPHERE_R, 0.01, 8, 128]} />
        <meshBasicMaterial color="#a9c7ff" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Floor() {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const g = c.getContext("2d");
    if (g) {
      const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, "rgba(3,10,44,0.72)");
      grad.addColorStop(0.55, "rgba(3,10,44,0.3)");
      grad.addColorStop(1, "rgba(3,10,44,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 256);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);

  const floorY = -SPHERE_R - 0.55;
  return (
    <>
      {/* faint mirrored spheres under the floor */}
      <group position={[0, floorY * 2, 0]} scale={[1, -1, 1]}>
        <mesh position={[-SPHERE_X, 0, 0]}>
          <sphereGeometry args={[SPHERE_R, 32, 32]} />
          <meshBasicMaterial color={PINK} transparent opacity={0.16} depthWrite={false} />
        </mesh>
        <mesh position={[SPHERE_X, 0, 0]}>
          <sphereGeometry args={[SPHERE_R, 32, 32]} />
          <meshBasicMaterial color={GREEN} transparent opacity={0.16} depthWrite={false} />
        </mesh>
      </group>
      {/* gradient plane that swallows the reflection and grounds the scene */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY, 0]}>
        <planeGeometry args={[16, 9]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}

function Scene({ still }: { still: boolean }) {
  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[3, 6, 6]} intensity={1.8} />
      <pointLight position={[0, 4, 4]} intensity={70} color="#ffffff" />
      <pointLight position={[-6, 1, 3]} intensity={60} color="#ff4f95" />
      <pointLight position={[6, 1, 3]} intensity={60} color="#3be8c0" />
      <CameraRig still={still} />
      <Floor />
      <Spheres still={still} />
      <Stream still={still} />
      <SettlementRings still={still} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Fallback + boundary                                                 */
/* ------------------------------------------------------------------ */
function FlowFallback({ animate }: { animate: boolean }) {
  return (
    <svg viewBox="0 0 800 400" className="absolute inset-0 h-full w-full" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="ff-pink" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ff8fbd" />
          <stop offset="55%" stopColor="#e11d6a" />
          <stop offset="100%" stopColor="#7a0b3a" />
        </radialGradient>
        <radialGradient id="ff-green" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#8ff5da" />
          <stop offset="55%" stopColor="#10c9a0" />
          <stop offset="100%" stopColor="#05604f" />
        </radialGradient>
      </defs>
      <circle cx="170" cy="215" r="86" fill="url(#ff-pink)" />
      <circle cx="630" cy="215" r="86" fill="url(#ff-green)" />
      <path
        d="M 250 170 Q 400 20 550 170"
        fill="none"
        stroke="#a9c7ff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="4 12"
      >
        {animate ? (
          <animate attributeName="stroke-dashoffset" from="0" to="-32" dur="1.2s" repeatCount="indefinite" />
        ) : null}
      </path>
      <path d="M 536 150 L 556 176 L 524 178 Z" fill="#a9c7ff" />
    </svg>
  );
}

class CanvasBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    /* swallow: fallback is rendered instead */
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/* ------------------------------------------------------------------ */
/* Public component                                                    */
/* ------------------------------------------------------------------ */
export default function FundingFlow3D({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [aspect, setAspect] = useState(16 / 9);
  const reduced = useSyncExternalStore(subscribeReduced, getReduced, getReducedServer);
  const hasWebGL = useSyncExternalStore(subscribeNoop, getWebGLSnapshot, getWebGLServer);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setVisible(e.isIntersecting);
      },
      { threshold: 0.01 },
    );
    io.observe(el);
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r && r.height > 0) setAspect(r.width / r.height);
    });
    ro.observe(el);
    return () => {
      io.disconnect();
      ro.disconnect();
    };
  }, []);

  // Screen-space anchors for the DOM labels (mirrors the camera maths).
  const dist = cameraDistance(aspect);
  const halfW = HALF_TAN * dist * aspect;
  const halfH = HALF_TAN * dist;
  const leftPct = 50 - (SPHERE_X / halfW) * 50;
  const rightPct = 50 + (SPHERE_X / halfW) * 50;
  const labelTop = Math.min(94, 50 + ((0.45 + SPHERE_R + 0.35) / halfH) * 50);
  const captionTop = 50 + ((0.45 - 0.1) / halfH) * 50;

  const fallback = <FlowFallback animate={!reduced} />;
  const frameloop = !visible ? "never" : reduced ? "demand" : "always";

  return (
    <div ref={wrapRef} className={`relative isolate overflow-hidden ${className ?? ""}`}>
      {hasWebGL ? (
        <CanvasBoundary fallback={fallback}>
          <Canvas
            className="!absolute inset-0"
            frameloop={frameloop}
            dpr={[1, 1.75]}
            camera={{ fov: FOV, near: 0.1, far: 60, position: [0, 0.75, 10] }}
            gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
            onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
            aria-hidden="true"
          >
            <Scene still={reduced} />
          </Canvas>
        </CanvasBoundary>
      ) : (
        fallback
      )}

      <div className="pointer-events-none absolute inset-0 text-white">
        <Pill left={leftPct} top={labelTop} color={PINK} text="Longs pay" />
        <Pill left={rightPct} top={labelTop} color={GREEN} text="Shorts receive" />
        <div
          className="absolute max-w-[38%] -translate-x-1/2 -translate-y-1/2 text-center text-[10px] font-medium uppercase leading-snug tracking-[0.18em] text-[#a9c7ff] sm:text-xs"
          style={{ left: "50%", top: `${captionTop}%` }}
        >
          funding settles every hour
        </div>
      </div>
    </div>
  );
}

function Pill({ left, top, color, text }: { left: number; top: number; color: string; text: string }) {
  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/25 bg-[#0a1a5c]/60 px-2.5 py-1 text-[11px] font-semibold shadow-[0_4px_18px_rgba(10,26,92,0.35)] backdrop-blur-md sm:px-3 sm:text-xs"
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      {text}
    </div>
  );
}
