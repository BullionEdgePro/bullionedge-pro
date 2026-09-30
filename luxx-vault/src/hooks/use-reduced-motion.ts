"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * prefers-reduced-motion, safe for hydration. motion's own useReducedMotion
 * answers on the very first client render, so a server-rendered component
 * that branches on it hydrates into different markup. This hook answers
 * `false` on the server and during hydration, then the real value — so the
 * first client render always matches the HTML.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
