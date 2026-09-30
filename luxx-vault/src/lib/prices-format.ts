/**
 * Display helpers for prices, tables, tools and the chart. Pure (no I/O), so
 * the server pages, the client widgets and the unit tests share one version.
 */
import { BELOW_MELT_WARNING, GOLD_KARATS, OTHER_FINENESS, type Metal } from "@/config/catalog";
import { UNITS, type Market, type Unit } from "./market";
import { formatPeso } from "./pricing";

export const DASH = "—";

/** Manila time, fixed, so the server render and the browser agree (no hydration drift). */
const manilaTime = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  hour: "numeric",
  minute: "2-digit",
});
const manilaDateTime = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});
const manilaDate = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", day: "numeric", month: "short", year: "numeric" });
const shortDate = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", day: "numeric", month: "short" });
const monthYear = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", year: "numeric" });

export function formatManilaTime(iso: string): string {
  return manilaTime.format(new Date(iso));
}
export function formatManilaDateTime(iso: string): string {
  return manilaDateTime.format(new Date(iso));
}
export function formatManilaDate(isoOrDay: string): string {
  return manilaDate.format(new Date(isoOrDay));
}

/** Axis/tooltip label for a chart point: time for intraday, day for weeks, month for years. */
export function formatPointTime(t: string, spanDays: number): string {
  const d = new Date(t);
  if (spanDays <= 1.5) return manilaTime.format(d);
  if (spanDays <= 200) return shortDate.format(d);
  return monthYear.format(d);
}

/** ₱ per gram: centavos below ₱1,000 (silver), whole pesos above (gold, platinum). */
export function formatPerGram(php: number | null | undefined): string {
  if (php == null || !Number.isFinite(php) || php <= 0) return DASH;
  return formatPeso(php, php < 1000);
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2, minimumFractionDigits: 2 });
export function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return DASH;
  return usd.format(value);
}

/** Signed percent, e.g. "+1.24%"; "—" when unknown. */
export function formatPct(pct: number | null | undefined, digits = 2): string {
  if (pct == null || !Number.isFinite(pct)) return DASH;
  const rounded = Number(pct.toFixed(digits));
  if (rounded === 0) return `0.${"0".repeat(digits)}%`;
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded).toFixed(digits)}%`;
}

/** Signed peso change, e.g. "+₱12.40"; "—" when unknown. */
export function formatPesoChange(php: number | null | undefined): string {
  if (php == null || !Number.isFinite(php)) return DASH;
  const cents = Math.abs(php) < 1000;
  if (Math.abs(php) < 0.005) return formatPeso(0, true);
  return `${php > 0 ? "+" : "−"}${formatPeso(Math.abs(php), cents)}`;
}

export type Direction = "up" | "down" | "flat";
export function direction(value: number | null | undefined): Direction | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (Math.abs(value) < 0.005) return "flat";
  return value > 0 ? "up" : "down";
}

/* ------------------------------------------------------------------ tables */

export type KaratRow = { karat: number; permille: number; purityPct: number; partsPer24: number; phpPerGram: number | null };

/** Gold 24K → 6K at today's price. `pure` is ₱/g of pure gold; null when there's no price. */
export function karatRows(pure: number | null): KaratRow[] {
  return GOLD_KARATS.map(({ karat, permille }) => ({
    karat,
    permille,
    purityPct: permille / 10,
    // Parts of pure gold in 24, from the fineness actually used (24K at .999 is 23.98 parts).
    partsPer24: Number(((permille / 1000) * 24).toFixed(2)),
    phpPerGram: pure && pure > 0 ? (pure * permille) / 1000 : null,
  }));
}

export type FinenessRow = { permille: number; purityPct: number; phpPerGram: number | null };

export function finenessRows(metal: Exclude<Metal, "gold">, pure: number | null): FinenessRow[] {
  return OTHER_FINENESS[metal].map((permille) => ({
    permille,
    purityPct: permille / 10,
    phpPerGram: pure && pure > 0 ? (pure * permille) / 1000 : null,
  }));
}

/** All purities a metal is quoted in, as the spreads table stores them (karat for gold, fineness otherwise). */
export function purityOptions(metal: Metal): { value: number; label: string; fraction: number }[] {
  if (metal === "gold") return GOLD_KARATS.map((k) => ({ value: k.karat, label: `${k.karat}K`, fraction: k.permille / 1000 }));
  return OTHER_FINENESS[metal].map((p) => ({ value: p, label: `${p}`, fraction: p / 1000 }));
}

/** Fraction of pure metal for a stored purity (karat for gold, fineness otherwise). */
export function fractionFor(metal: Metal, purity: number): number | null {
  return purityOptions(metal).find((o) => o.value === purity)?.fraction ?? null;
}

/* ------------------------------------------------------------------ units */

/** One amount in every unit we support. */
export function convertAll(amount: number, from: Unit): Record<Unit, number> {
  const grams = amount * (UNITS.find((u) => u.value === from)?.grams ?? 1);
  const out = {} as Record<Unit, number>;
  for (const u of UNITS) out[u.value] = grams / u.grams;
  return out;
}

/** Parse a user-typed number: accepts "1,234.5", rejects blanks, negatives and junk. */
export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[,\s₱]/g, "");
  if (!/^\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* ------------------------------------------------------------------ offer checks */

/** Above this multiple of melt, an offer is flagged "well above melt". */
export const WELL_ABOVE_MELT = 1.6;

export type OfferVerdict = "suspicious" | "below-melt" | "near-melt" | "typical" | "well-above";

/**
 * How a price compares with today's melt value.
 * - suspicious: below BELOW_MELT_WARNING × melt — nobody sells real gold under its scrap value
 * - below-melt: under melt but within the warning band
 * - near-melt / typical: at or above melt (workmanship and margin push jewellery above melt)
 * - well-above: more than WELL_ABOVE_MELT × melt
 */
export function offerVerdict(pricePhp: number, meltPhp: number): { verdict: OfferVerdict; ratio: number; premiumPct: number } | null {
  if (!(pricePhp > 0) || !(meltPhp > 0)) return null;
  const ratio = pricePhp / meltPhp;
  const premiumPct = (ratio - 1) * 100;
  let verdict: OfferVerdict;
  if (ratio < BELOW_MELT_WARNING) verdict = "suspicious";
  else if (ratio < 1) verdict = "below-melt";
  else if (ratio < 1.05) verdict = "near-melt";
  else if (ratio <= WELL_ABOVE_MELT) verdict = "typical";
  else verdict = "well-above";
  return { verdict, ratio, premiumPct };
}

/* ------------------------------------------------------------------ spreads */

export type PublicSpread = { metal: string; purity: number; productType: string; buyRatio: number; sellRatio: number };

export function findPublicSpread(spreads: readonly PublicSpread[], metal: string, purity: number, productType = "jewelry") {
  return spreads.find((s) => s.metal === metal && s.purity === purity && s.productType === productType);
}

/** Round a peso estimate down to the nearest ₱10 so it never reads as more exact than it is. */
export function roundEstimate(php: number): number {
  return Math.floor(php / 10) * 10;
}

/* ------------------------------------------------------------------ chart */

export type ChartPoint = { t: string; v: number };

export type ChartGeometry = {
  line: string;
  area: string;
  xs: number[];
  ys: number[];
  min: number;
  max: number;
  ticks: { value: number; y: number }[];
};

/** "Nice" round tick values covering [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

/**
 * Paths for an area chart in a width × height box. X is placed by time (so a
 * gap in the data shows as a longer segment, not a squeezed one); Y is padded
 * so the line never touches the edges.
 */
export function chartGeometry(points: readonly ChartPoint[], width: number, height: number, pad = { top: 16, bottom: 12 }): ChartGeometry | null {
  if (points.length < 2) return null;
  const times = points.map((p) => new Date(p.t).getTime());
  const t0 = times[0]!;
  const t1 = times[times.length - 1]!;
  const values = points.map((p) => p.v);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max === min) {
    // A flat line sits in the middle rather than on an edge.
    const bump = Math.max(Math.abs(max) * 0.005, 0.01);
    min -= bump;
    max += bump;
  } else {
    const headroom = (max - min) * 0.08;
    min -= headroom;
    max += headroom;
  }
  const span = t1 - t0 || 1;
  const innerH = height - pad.top - pad.bottom;
  const xs = times.map((t) => ((t - t0) / span) * width);
  const ys = values.map((v) => pad.top + (1 - (v - min) / (max - min)) * innerH);
  const r = (n: number) => Math.round(n * 100) / 100;
  const line = xs.map((x, i) => `${i ? "L" : "M"}${r(x)},${r(ys[i]!)}`).join("");
  const area = `${line}L${r(xs[xs.length - 1]!)},${height}L${r(xs[0]!)},${height}Z`;
  const ticks = niceTicks(min, max, 4).map((value) => ({ value, y: pad.top + (1 - (value - min) / (max - min)) * innerH }));
  return { line, area, xs, ys, min, max, ticks };
}

/** Index of the point whose x is closest to `x`. */
export function nearestIndex(xs: readonly number[], x: number): number {
  let best = 0;
  let bestD = Infinity;
  xs.forEach((px, i) => {
    const d = Math.abs(px - x);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/* ------------------------------------------------------------------ status */

export type MarketStatus = { tone: "live" | "closed" | "delayed" | "none"; text: string };

/** One line describing how fresh the prices are. Never presents an old number as live (brief §10). */
export function marketStatus(market: Market | null, stale = false): MarketStatus {
  if (!market || !Object.values(market.metals).some(Boolean)) return { tone: "none", text: "Prices unavailable right now" };
  if (market.delayed || stale) return { tone: "delayed", text: `Prices delayed · last update ${formatManilaDateTime(market.checkedAt)}` };
  if (market.marketClosed) return { tone: "closed", text: `Markets closed · last close, checked ${formatManilaDateTime(market.checkedAt)}` };
  return { tone: "live", text: `Live · updated ${formatManilaTime(market.checkedAt)} Manila time` };
}
