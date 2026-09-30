"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Market } from "@/lib/market";

/**
 * One shared poll of /api/prices for every live widget on the page (header
 * ticker, hero, market strip, tools). Polls every 60 s while the tab is
 * visible, pauses when it is hidden, and refreshes at once when it comes back.
 * The browser never calls a price source directly (brief §10).
 */

const POLL_MS = 60_000;

let market: Market | null = null;
let failed = false;
const listeners = new Set<() => void>();
let timer: number | null = null;
let lastFetch = 0;
let inflight: Promise<void> | null = null;

function emit() {
  listeners.forEach((l) => l());
}

async function load() {
  inflight ??= (async () => {
    try {
      const res = await fetch("/api/prices", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      market = (await res.json()) as Market;
      failed = false;
    } catch {
      // Keep the last good market on screen; the widgets say it could not refresh.
      failed = true;
    } finally {
      lastFetch = Date.now();
      inflight = null;
      emit();
    }
  })();
  return inflight;
}

function schedule() {
  if (timer != null) window.clearTimeout(timer);
  timer = null;
  if (document.visibilityState !== "visible" || listeners.size === 0) return;
  const wait = Math.max(0, POLL_MS - (Date.now() - lastFetch));
  timer = window.setTimeout(async () => {
    await load();
    schedule();
  }, wait);
}

function onVisibility() {
  schedule();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    document.addEventListener("visibilitychange", onVisibility);
    schedule();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer != null) window.clearTimeout(timer);
      timer = null;
    }
  };
}

/** Seed the shared store with a server-rendered market, if it is newer than what we hold. */
function seed(initial: Market | undefined) {
  if (!initial) return;
  if (!market || new Date(initial.checkedAt) > new Date(market.checkedAt)) {
    market = initial;
    lastFetch = Math.max(lastFetch, Date.now());
    emit();
  }
}

export type LiveMarket = { market: Market | null; stale: boolean };

/**
 * The live market. Pass the server-rendered `initial` so the first paint
 * already has real numbers; without it the widget fetches on mount.
 */
export function useLiveMarket(initial?: Market): LiveMarket {
  const current = useSyncExternalStore(
    subscribe,
    () => market ?? initial ?? null,
    () => initial ?? null,
  );
  const stale = useSyncExternalStore(
    subscribe,
    () => failed,
    () => false,
  );

  useEffect(() => {
    seed(initial);
    // No server market and nothing fetched yet: ask now rather than in 60 s.
    if (!market) void load();
    // Only the first seed matters; later server renders arrive through the poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { market: current, stale };
}
