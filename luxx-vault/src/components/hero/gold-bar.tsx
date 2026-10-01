"use client";

import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import { emblemSvg } from "@/components/brand/logo-svg";
import { CENTERED, type LayoutRef } from "./bar-layout";

/** Scroll progress 0→1 written by the hero's ScrollTrigger; read every frame (no React renders). */
export type ProgressRef = RefObject<number>;

/** On-screen footprint of the bar in world units at rest pose (length × projected height). */
const FOOTPRINT = { w: 2.9, h: 1.55 };

const GOLD = new THREE.Color("#DDB057");
/** Struck lettering: a darker, satin gold so it reads at any angle. */
const STAMP = new THREE.Color("#8F6A2C");
const BAR = { length: 2.6, height: 0.62, depth: 1.28, taper: 0.14 };

/** A cast bar: rounded box whose upper half tapers inward like a real mould draft. */
function useBarGeometry() {
  return useMemo(() => {
    const g = new RoundedBoxGeometry(BAR.length, BAR.height, BAR.depth, 6, 0.09);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = (y + BAR.height / 2) / BAR.height; // 0 bottom → 1 top
      const s = 1 - BAR.taper * t;
      pos.setX(i, pos.getX(i) * s);
      pos.setZ(i, pos.getZ(i) * s);
    }
    // Keep RoundedBox's own normals: recomputing merges seams and leaves a
    // stepped highlight along the bevels. The 14% taper barely tilts them.
    pos.needsUpdate = true;
    return g;
  }, []);
}

/**
 * Tell three.js to re-upload a texture after its canvas was redrawn. A module
 * function because textures are mutable GPU-backed objects (like DOM nodes),
 * which the React Compiler would otherwise flag as a mutated hook value.
 */
function reupload(t: THREE.Texture) {
  t.needsUpdate = true;
}

/** Stamp on the top face, drawn to a canvas: the marks a refinery strikes into a bar. */
function useStampTexture() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 8;
    return t;
  }, []);

  useEffect(() => {
    const c = tex.image as HTMLCanvasElement;
    // The emblem, in white (white = struck into the metal on the alpha/bump maps).
    const emblem = new Image();
    emblem.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(emblemSvg({ id: "stamp", detail: "mono", color: "#fff" }))}`;
    const draw = () => {
      const ctx = c.getContext("2d")!;
      const { width: w, height: h } = c;
      const face = getComputedStyle(document.documentElement).getPropertyValue("--font-cinzel").trim() || "serif";
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#fff";
      // Hallmark frame
      ctx.lineWidth = 6;
      ctx.strokeRect(60, 56, w - 120, h - 112);
      ctx.lineWidth = 2;
      ctx.strokeRect(76, 72, w - 152, h - 144);
      if (emblem.complete && emblem.naturalWidth) ctx.drawImage(emblem, 110, 116, 280, 280);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const tx = 668;
      ctx.font = `700 92px ${face}`;
      ctx.fillText("LUXX4LESS", tx, 196);
      ctx.font = `600 46px ${face}`;
      ctx.fillText("FINE GOLD  999.9", tx, 296);
      ctx.font = `600 28px ${face}`;
      ctx.fillText("ANTIPOLO  ·  PHILIPPINES", tx, 360);
      reupload(tex);
    };
    draw();
    // Redraw once Cinzel and the emblem image have loaded.
    let alive = true;
    emblem.onload = () => alive && draw();
    document.fonts.ready.then(() => alive && draw());
    return () => {
      alive = false;
    };
  }, [tex]);

  return tex;
}

function Bar({ progress, layout }: { progress: ProgressRef; layout: LayoutRef }) {
  const mover = useRef<THREE.Group>(null);
  const group = useRef<THREE.Group>(null);
  const geometry = useBarGeometry();
  const stamp = useStampTexture();

  useEffect(() => () => {
    geometry.dispose();
    stamp.dispose();
  }, [geometry, stamp]);

  const topW = BAR.length * (1 - BAR.taper) - 0.34;
  const topD = BAR.depth * (1 - BAR.taper) - 0.26;

  useFrame((state, delta) => {
    const g = group.current;
    const m = mover.current;
    if (!g || !m) return;
    const L = layout.current ?? CENTERED;
    const { width: vw, height: vh } = state.viewport;
    const p = progress.current ?? 0;
    const t = state.clock.elapsedTime;
    // Scroll drives most of the turn; a slow idle drift keeps it alive at rest.
    const targetY = -0.55 + p * Math.PI * 1.35 + Math.sin(t * 0.35) * 0.06;
    const targetX = 0.42 - p * 0.3;
    const k = 1 - Math.exp(-delta * 6);
    g.rotation.y += (targetY - g.rotation.y) * k;
    g.rotation.x += (targetX - g.rotation.x) * k;
    // Final stretch: the bar settles lower and smaller, a seal above the product grid.
    const sink = Math.min(1, Math.max(0, (p - 0.55) / 0.4));
    const ease = sink * sink * (3 - 2 * sink);
    // Fit the bar to the free zone, then place it (canvas fractions → world units).
    const fit = Math.min((L.zoneWidth * vw * 0.72) / FOOTPRINT.w, (L.zoneHeight * vh * 0.8) / FOOTPRINT.h, 1.2);
    const restY = (0.5 - L.zoneCenterY) * vh;
    const settleY = (0.5 - L.settleCenterY) * vh;
    m.position.y = restY + (settleY - restY) * ease + Math.sin(t * 0.8) * 0.03 * (1 - ease);
    m.scale.setScalar(fit * (1 - ease * 0.3));
  });

  return (
    <group ref={mover}>
      <ContactShadows position={[0, -0.5, 0]} opacity={0.55} scale={7} blur={2.6} far={2} color="#000000" />
      <group ref={group}>
        <mesh geometry={geometry} castShadow>
          <meshStandardMaterial color={GOLD} metalness={1} roughness={0.22} envMapIntensity={1.5} />
        </mesh>
        {/* Satin-finish stamp sits a hair above the top face */}
        <mesh position={[0, BAR.height / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[topW, topD]} />
          <meshStandardMaterial
            color={STAMP}
            metalness={1}
            roughness={0.5}
            alphaMap={stamp}
            bumpMap={stamp}
            bumpScale={-2.5}
            transparent
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      </group>
    </group>
  );
}

/** Studio lighting from light panels inside the scene — no HDRI download. */
function Studio() {
  return (
    <Environment resolution={256} frames={1}>
      {/* A warm base so every reflection angle reads as gold, never black */}
      <color attach="background" args={["#3b2a1c"]} />
      <Lightformer form="rect" intensity={1.4} color="#ffe9c4" position={[0, 8, 0]} scale={[24, 24, 1]} rotation-x={Math.PI / 2} />
      <Lightformer form="rect" intensity={4} color="#fff4df" position={[0, 5, -2]} scale={[10, 2, 1]} rotation-x={Math.PI / 2} />
      <Lightformer form="rect" intensity={2.2} color="#ffe2b0" position={[-5, 1, 1]} scale={[3, 6, 1]} rotation-y={Math.PI / 2} />
      <Lightformer form="rect" intensity={1.6} color="#bfd8e4" position={[5, 1, 0]} scale={[3, 6, 1]} rotation-y={-Math.PI / 2} />
      <Lightformer form="ring" intensity={3} color="#ffffff" position={[2, 3, 4]} scale={1.6} />
      <Lightformer form="rect" intensity={0.8} color="#6b4f8a" position={[0, -3, 2]} scale={[8, 2, 1]} rotation-x={-Math.PI / 2} />
      {/* Warm fill behind the camera so the long faces read as gold, not brown */}
      <Lightformer form="rect" intensity={1.6} color="#ffd9a0" position={[0, 0.2, 7]} scale={[14, 2.2, 1]} />
      <Lightformer form="rect" intensity={0.9} color="#fff1d6" position={[0, -1.4, 6]} scale={[10, 1, 1]} />
    </Environment>
  );
}

const DEFAULT_LAYOUT: LayoutRef = { current: CENTERED };

export default function GoldBarCanvas({
  progress,
  active = true,
  onReady,
  transparent = true,
  layout,
  maxDpr = 1.75,
}: {
  progress: ProgressRef;
  active?: boolean;
  onReady?: () => void;
  transparent?: boolean;
  layout?: LayoutRef;
  /** Cap on device pixel ratio: phones render at 1.5x, which looks the same at arm's length and costs far less. */
  maxDpr?: number;
}) {
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, maxDpr]}
      camera={{ position: [0, 1.15, 5.6], fov: 32 }}
      gl={{ antialias: true, alpha: transparent, preserveDrawingBuffer: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.92;
        onReady?.();
      }}
      aria-hidden
    >
      <Studio />
      <Bar progress={progress} layout={layout ?? DEFAULT_LAYOUT} />
    </Canvas>
  );
}
