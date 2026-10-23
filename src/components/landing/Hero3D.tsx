"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import * as THREE from "three";
import { LogoGlyph } from "@/components/Logo";

/* ------------------------------------------------------------------ */
/* Tunables                                                            */
/* ------------------------------------------------------------------ */

const ORB_COLOR = "#2f6df6";
const ORB_EMISSIVE = "#1d4ed8";
const RING_EMISSIVE = "#5b8cff";
const TICK_UP = "#16a34a";
const TICK_DOWN = "#e11d6a";
const TICK_NEUTRAL = "#ffffff";
const PARTICLE_COUNT = 80;
const ORB_RADIUS = 1.05;
const FUNDING_RING_RADIUS = 1.85;
/** Whole mark scale: ring diameter is ~3.7 units against ~4.1 visible at z=6.5, fov 35. */
const MARK_SCALE = 0.86;

/* ------------------------------------------------------------------ */
/* Environment detection                                               */
/* ------------------------------------------------------------------ */

let webglCache: boolean | null = null;
function detectWebGL(): boolean {
  if (webglCache !== null) return webglCache;
  try {
    const c = document.createElement("canvas");
    webglCache = Boolean(
      c.getContext("webgl2") ||
        c.getContext("webgl") ||
        c.getContext("experimental-webgl"),
    );
  } catch {
    webglCache = false;
  }
  return webglCache;
}

const noopSubscribe = () => () => {};

function useWebGLSupport(): boolean {
  return useSyncExternalStore(noopSubscribe, detectWebGL, () => true);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

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

/* ------------------------------------------------------------------ */
/* Scene pieces                                                        */
/* ------------------------------------------------------------------ */

/** The Fulmen mark in 3D: a glossy orb (the position) with a ring (hourly funding) and a satellite riding it. */
function Orb({ animate }: { animate: boolean }) {
  const group = useRef<THREE.Group>(null);
  const satellite = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const g = group.current;
    const sat = satellite.current;
    if (!g) return;
    const t = animate ? state.clock.elapsedTime : 0;
    if (animate) {
      const k = 1 - Math.exp(-delta * 3.5);
      g.rotation.y += (state.pointer.x * 0.5 + Math.sin(t * 0.4) * 0.25 - g.rotation.y) * k;
      g.rotation.x += (-state.pointer.y * 0.3 - 0.1 - g.rotation.x) * k;
      g.position.y = Math.sin(t * 0.9) * 0.1;
    } else {
      g.rotation.set(-0.1, -0.25, 0);
      g.position.y = 0;
    }
    if (sat) {
      const a = animate ? t * 0.7 + 0.66 : 0.66;
      sat.position.set(Math.cos(a) * FUNDING_RING_RADIUS, Math.sin(a) * FUNDING_RING_RADIUS, 0);
    }
  });

  return (
    <group ref={group} scale={MARK_SCALE}>
      <mesh>
        <sphereGeometry args={[ORB_RADIUS, 96, 96]} />
        <meshPhysicalMaterial
          color={ORB_COLOR}
          emissive={ORB_EMISSIVE}
          emissiveIntensity={0.1}
          roughness={0.12}
          metalness={0.05}
          clearcoat={1}
          clearcoatRoughness={0.04}
          sheen={0.6}
          sheenColor="#a9c7ff"
          sheenRoughness={0.3}
          iridescence={0.45}
          iridescenceIOR={1.4}
        />
      </mesh>
      <group rotation={[1.22, 0, -0.49]}>
        <mesh>
          <torusGeometry args={[FUNDING_RING_RADIUS, 0.085, 40, 220]} />
          <meshPhysicalMaterial color="#ffffff" emissive={RING_EMISSIVE} emissiveIntensity={0.18} roughness={0.12} metalness={0.2} clearcoat={1} clearcoatRoughness={0.05} />
        </mesh>
        <mesh ref={satellite}>
          <sphereGeometry args={[0.2, 40, 40]} />
          <meshPhysicalMaterial color="#5b95ff" emissive="#2f6df6" emissiveIntensity={0.7} roughness={0.15} clearcoat={1} />
        </mesh>
      </group>
      <pointLight position={[0, 0, -1.2]} color="#3b82f6" intensity={12} distance={7} decay={2} />
    </group>
  );
}

interface Tick {
  x: number;
  y: number;
  z: number;
  speed: number;
  scale: number;
}

const TICK_RANGE = 4.8;

function Ticks({ animate }: { animate: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const ticks = useMemo<Tick[]>(() => {
    const rnd = mulberry32(0xf01a7);
    return Array.from({ length: PARTICLE_COUNT }, () => ({
      x: (rnd() - 0.5) * 5.4,
      y: rnd() * TICK_RANGE,
      z: (rnd() - 0.5) * 3,
      speed: 0.12 + rnd() * 0.3,
      scale: 0.5 + rnd() * 1.1,
    }));
  }, []);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const rnd = mulberry32(0xc0102);
    const up = new THREE.Color(TICK_UP);
    const down = new THREE.Color(TICK_DOWN);
    const neutral = new THREE.Color(TICK_NEUTRAL);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const r = rnd();
      m.setColorAt(i, r < 0.12 ? up : r < 0.24 ? down : neutral);
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const t = animate ? state.clock.elapsedTime : 0;
    for (let i = 0; i < ticks.length; i++) {
      const p = ticks[i];
      const y = ((p.y + t * p.speed) % TICK_RANGE) - TICK_RANGE / 2;
      // fade by shrinking near the ends of the travel range
      const edge = 1 - Math.pow(Math.abs(y) / (TICK_RANGE / 2), 4);
      dummy.position.set(p.x + Math.sin(t * 0.5 + i) * 0.04, y, p.z);
      dummy.scale.setScalar(0.045 * p.scale * Math.max(edge, 0.001));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, PARTICLE_COUNT]} frustumCulled={false}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

/** Studio-style reflections generated locally (no HDR download), so the clearcoat has something to mirror. */
function Reflections() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const rt = pmrem.fromScene(room, 0.04);
    // eslint-disable-next-line react-hooks/immutability -- three.js scene is an external mutable object
    scene.environment = rt.texture;
    scene.environmentIntensity = 1.15;
    return () => {
      scene.environment = null;
      rt.dispose();
      pmrem.dispose();
      room.dispose();
    };
  }, [gl, scene]);
  return null;
}

function Scene({ animate }: { animate: boolean }) {
  return (
    <>
      <Reflections />
      <ambientLight intensity={0.35} color="#dbe7ff" />
      <directionalLight position={[3, 4, 5]} intensity={2.6} color="#cfe0ff" />
      <directionalLight position={[-3, 2, -4]} intensity={2.2} color="#fff4e6" />
      <directionalLight position={[-4, -1, 3]} intensity={0.6} color="#7aa2ff" />
      <Orb animate={animate} />
      <Ticks animate={animate} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Fallback                                                            */
/* ------------------------------------------------------------------ */

function OrbFallback() {
  return (
    <LogoGlyph
      className="h-[70%] text-[#2f6df6] drop-shadow-[0_18px_30px_rgba(47,109,246,0.45)]"
      bg="#eaf1ff"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function Hero3D({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const hasWebGL = useWebGLSupport();
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setVisible(e.isIntersecting);
      },
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const frameloop = reduced ? "demand" : visible ? "always" : "never";

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {hasWebGL ? (
        <Canvas
          frameloop={frameloop}
          dpr={[1, 2]}
          gl={{ alpha: true, antialias: true }}
          camera={{ position: [0, 0, 6.5], fov: 35 }}
          style={{ position: "absolute", inset: 0, background: "transparent" }}
          onCreated={({ gl, scene }) => {
            scene.background = null;
            gl.setClearColor(0x000000, 0);
          }}
        >
          <Scene animate={!reduced} />
        </Canvas>
      ) : (
        <OrbFallback />
      )}
    </div>
  );
}
