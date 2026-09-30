"use client";

import { motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Metal } from "@/config/catalog";
import { cn } from "@/lib/cn";
import {
  chartGeometry,
  formatManilaDate,
  formatPct,
  formatPerGram,
  formatPesoChange,
  formatPointTime,
  nearestIndex,
  type ChartPoint,
} from "@/lib/prices-format";
import { formatPeso } from "@/lib/pricing";

export const CHART_RANGES = ["1D", "1W", "1M", "6M", "1Y", "5Y", "20Y"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];
const RANGE_DAYS: Record<ChartRange, number> = { "1D": 1, "1W": 7, "1M": 30, "6M": 182, "1Y": 365, "5Y": 1826, "20Y": 7305 };
const RANGE_LABEL: Record<ChartRange, string> = {
  "1D": "1 day",
  "1W": "1 week",
  "1M": "1 month",
  "6M": "6 months",
  "1Y": "1 year",
  "5Y": "5 years",
  "20Y": "20 years",
};

const HEIGHT = 280;

type ApiPoint = { t: string; phpPerGram: number; usdPerOz: number };
type Loaded = { key: string; points: ChartPoint[] | null };

/** Series already fetched in this tab, by "metal:range". History doesn't change within a visit. */
const seriesCache = new Map<string, ChartPoint[]>();
const NO_POINTS: ChartPoint[] = [];

// useLayoutEffect warns on the server; this component renders there too.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Hand-built SVG area chart of ₱ per gram (brief §7, PARITY P9). Champagne
 * line over a soft gradient, a crosshair and tooltip that follow the pointer
 * or the arrow keys, and an honest short-history state instead of invented
 * data while our own history is still young.
 */
export function PriceChart({ metal, metalLabel, coverageStart }: { metal: Metal; metalLabel: string; coverageStart: string | null }) {
  const [range, setRange] = useState<ChartRange>("1M");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [pointer, setPointer] = useState<{ key: string; i: number } | null>(null);
  const [width, setWidth] = useState(800);
  const box = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const gradientId = useId().replace(/:/g, "");
  const tabsId = useId();
  const key = `${metal}:${range}`;

  useIsoLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(240, Math.round(entry.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (seriesCache.has(key)) return;
    let cancelled = false;
    fetch(`/api/prices/history?metal=${metal}&range=${range}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { points: ApiPoint[] }) => {
        const points = data.points.map((p) => ({ t: p.t, v: p.phpPerGram }));
        seriesCache.set(key, points);
        if (!cancelled) setLoaded({ key, points });
      })
      .catch(() => !cancelled && setLoaded({ key, points: null }));
    return () => {
      cancelled = true;
    };
  }, [key, metal, range]);

  const cached = seriesCache.get(key);
  const state: { status: "loading" } | { status: "error" } | { status: "ready"; points: ChartPoint[] } = cached
    ? { status: "ready", points: cached }
    : loaded?.key === key
      ? loaded.points
        ? { status: "ready", points: loaded.points }
        : { status: "error" }
      : { status: "loading" };
  const active = pointer?.key === key ? pointer.i : null;
  const setActive = (i: number | null) => setPointer(i == null ? null : { key, i });

  const points = state.status === "ready" ? state.points : NO_POINTS;
  const geo = useMemo(() => chartGeometry(points, width, HEIGHT), [points, width]);
  const spanDays = points.length > 1 ? (new Date(points[points.length - 1]!.t).getTime() - new Date(points[0]!.t).getTime()) / 86_400_000 : 0;

  // Does our history reach back as far as the range asks?
  const shortHistory =
    state.status === "ready" && (points.length < 2 || spanDays < RANGE_DAYS[range] * 0.75) && range !== "1D";
  const startLabel = coverageStart ? formatManilaDate(coverageStart) : points[0] ? formatManilaDate(points[0].t) : null;

  const first = points[0];
  const last = points[points.length - 1];
  const periodChange = first && last && points.length > 1 ? last.v - first.v : null;
  const periodPct = first && last && points.length > 1 ? ((last.v - first.v) / first.v) * 100 : null;

  // Whole pesos unless the ticks are closer than ₱1 apart or fall between pesos.
  const tickCents = geo ? geo.ticks.some((t) => !Number.isInteger(Math.round(t.value * 100) / 100)) : false;

  const shown = active != null ? points[active] : last;

  function onPointer(e: PointerEvent<HTMLDivElement>) {
    if (!geo) return;
    const r = e.currentTarget.getBoundingClientRect();
    setActive(nearestIndex(geo.xs, ((e.clientX - r.left) / r.width) * width));
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (!geo) return;
    const lastI = geo.xs.length - 1;
    const cur = active ?? lastI;
    const step = e.shiftKey ? Math.max(1, Math.round(lastI / 10)) : 1;
    const next =
      e.key === "ArrowLeft" ? Math.max(0, cur - step) : e.key === "ArrowRight" ? Math.min(lastI, cur + step) : e.key === "Home" ? 0 : e.key === "End" ? lastI : null;
    if (next == null) return;
    e.preventDefault();
    setActive(next);
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div aria-live="polite">
          <p className="text-sm text-muted">
            {metalLabel} · ₱ per gram, pure · {active != null && shown ? formatPointTime(shown.t, spanDays) : RANGE_LABEL[range]}
          </p>
          <p className="tabular mt-1 font-display text-3xl text-fg sm:text-4xl">{shown ? formatPerGram(shown.v) : "—"}</p>
          {active == null && periodChange != null ? (
            <p className={cn("tabular mt-1 text-sm", periodChange >= 0 ? "text-success" : "text-danger")}>
              {formatPesoChange(periodChange)} ({formatPct(periodPct)}) over the period shown
            </p>
          ) : (
            <p className="mt-1 text-sm text-transparent select-none" aria-hidden>
              .
            </p>
          )}
        </div>

        <div role="tablist" aria-label="Chart range" id={tabsId} className="flex flex-wrap gap-1 rounded-full border border-line bg-surface-sunk p-1">
          {CHART_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={range === r}
              aria-label={RANGE_LABEL[r]}
              onClick={() => setRange(r)}
              className={cn(
                "tabular h-8 min-w-10 rounded-full px-2.5 text-xs font-semibold transition-colors",
                range === r ? "bg-champagne text-velvet" : "text-muted hover:text-fg",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div ref={box} className="relative" style={{ height: HEIGHT }}>
        {state.status === "loading" ? (
          <div className="absolute inset-0 grid place-items-center rounded-xl border border-dashed border-line text-sm text-muted">Loading history…</div>
        ) : state.status === "error" ? (
          <div className="absolute inset-0 grid place-items-center rounded-xl border border-dashed border-line px-6 text-center text-sm text-muted">
            The price history could not be loaded. Please try again shortly.
          </div>
        ) : !geo ? (
          <div className="absolute inset-0 grid place-items-center rounded-xl border border-dashed border-line px-6 text-center">
            <div className="measure">
              <p className="font-display text-lg text-gold">Not enough history yet</p>
              <p className="mt-2 text-sm text-muted">
                {startLabel
                  ? `History on Luxx4less starts ${startLabel}; longer ranges fill in as it grows.`
                  : "Luxx4less has just started recording prices; the chart fills in as history grows."}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Y gridlines and labels */}
            {geo.ticks.map((t) => (
              <div key={t.value} aria-hidden className="pointer-events-none absolute inset-x-0" style={{ top: t.y }}>
                <div className="border-t border-dashed border-line/70" />
                <span className="tabular absolute right-0 -translate-y-full pb-0.5 text-[0.7rem] text-muted/80">{formatPeso(t.value, tickCents)}</span>
              </div>
            ))}

            <div
              tabIndex={0}
              role="group"
              aria-roledescription="chart"
              aria-label={`${metalLabel} price chart, ${RANGE_LABEL[range]}. Use the left and right arrow keys to read each point.`}
              onPointerMove={onPointer}
              onPointerDown={onPointer}
              onPointerLeave={() => setActive(null)}
              onKeyDown={onKey}
              onBlur={() => setActive(null)}
              className="absolute inset-0 cursor-crosshair touch-pan-y rounded-lg outline-offset-4"
            >
              <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} className="block overflow-visible" aria-hidden>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d6b26e" stopOpacity="0.32" />
                    <stop offset="70%" stopColor="#d6b26e" stopOpacity="0.06" />
                    <stop offset="100%" stopColor="#d6b26e" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <motion.path
                  key={`area-${metal}-${range}-${points.length}`}
                  d={geo.area}
                  fill={`url(#${gradientId})`}
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1.1, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
                />
                <motion.path
                  key={`line-${metal}-${range}-${points.length}`}
                  d={geo.line}
                  fill="none"
                  stroke="#d6b26e"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  initial={reduce ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
                />
              </svg>

              {active != null && geo.xs[active] != null ? (
                <>
                  <div aria-hidden className="pointer-events-none absolute inset-y-0 w-px bg-champagne/45" style={{ left: geo.xs[active] }} />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-velvet bg-champagne shadow-[0_0_12px_rgb(214_178_110/0.8)]"
                    style={{ left: geo.xs[active], top: geo.ys[active] }}
                  />
                  <div
                    className="pointer-events-none absolute top-0 rounded-lg border border-line bg-surface/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
                    style={{
                      left: Math.min(Math.max(geo.xs[active]! - 70, 0), width - 150),
                      width: 140,
                    }}
                  >
                    <p className="text-muted">{formatPointTime(points[active]!.t, spanDays)}</p>
                    <p className="tabular font-semibold text-fg">{formatPerGram(points[active]!.v)} /g</p>
                  </div>
                </>
              ) : null}
            </div>

            {/* X axis: first, middle and last dates */}
            <div aria-hidden className="tabular absolute inset-x-0 -bottom-6 flex justify-between text-[0.7rem] text-muted/80">
              <span>{formatPointTime(points[0]!.t, spanDays)}</span>
              <span className="hidden sm:inline">{formatPointTime(points[Math.floor(points.length / 2)]!.t, spanDays)}</span>
              <span>{formatPointTime(points[points.length - 1]!.t, spanDays)}</span>
            </div>
          </>
        )}
      </div>

      {shortHistory && geo ? (
        <p className="mt-4 text-xs text-muted">
          {startLabel
            ? `History on Luxx4less starts ${startLabel}; longer ranges fill in as it grows.`
            : "Our price history is still short; longer ranges fill in as it grows."}
        </p>
      ) : (
        <div className="mt-4" />
      )}
    </div>
  );
}
