"use client";

import { useSyncExternalStore } from "react";

/**
 * How much motion this device should get:
 *  - "static": prefers-reduced-motion → still image, no scroll scenes
 *  - "lite":   low-end or data-saver device → pre-rendered image, light CSS motion
 *  - "full":   WebGL hero and scroll scenes
 * Server render and first paint assume "static" so nothing heavy loads before we know.
 */
export type MotionTier = "static" | "lite" | "full";

function detect(): MotionTier {
  // QA override: ?motion=full|lite|static
  const forced = new URLSearchParams(window.location.search).get("motion");
  if (forced === "full" || forced === "lite" || forced === "static") return forced;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "static";
  // Phones and tablets get the still render: the 1 MB 3D engine froze mid-range phones for
  // several seconds (Lighthouse, 1 Oct 2026). Checked before the WebGL probe, which itself costs.
  if (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 1024) return "lite";
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const lowCpu = (nav.hardwareConcurrency ?? 8) <= 4;
  const lowMem = (nav.deviceMemory ?? 8) < 4;
  const saveData = nav.connection?.saveData === true;
  let webgl2 = false;
  try {
    webgl2 = !!document.createElement("canvas").getContext("webgl2");
  } catch {
    webgl2 = false;
  }
  if (lowCpu || lowMem || saveData || !webgl2) return "lite";
  return "full";
}

let cached: MotionTier | null = null;

function subscribe(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const handler = () => {
    cached = detect();
    onChange();
  };
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}

export function useMotionTier(): MotionTier | null {
  return useSyncExternalStore(
    subscribe,
    () => (cached ??= detect()),
    () => null,
  );
}
