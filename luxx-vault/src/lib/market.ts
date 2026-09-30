/**
 * Market data shapes and melt-value maths shared by the server (price engine,
 * marketplace checks) and the browser (ticker, calculators). No I/O here.
 */
import { GOLD_KARATS, type Metal } from "@/config/catalog";
import { GRAMS_PER_TROY_OUNCE } from "./pricing";

export type MetalPrice = {
  metal: Metal;
  usdPerOz: number;
  /** Pure metal, ₱ per gram. */
  phpPerGram: number;
  /** ISO time the source set this price. */
  observedAt: string;
  source: string;
  /** Change against the price about 24 hours earlier, in percent; null until we have one. */
  change24hPct: number | null;
};

export type Market = {
  metals: Record<Metal, MetalPrice | null>;
  usdPhp: number | null;
  fxSource: string | null;
  /** When the server last asked the sources. */
  checkedAt: string;
  /** True when any shown price is older than STALE_AFTER_MS: the UI must say "Prices delayed". */
  delayed: boolean;
  /** Spot metals don't trade at the weekend; prices are the last close, which is correct, not delayed. */
  marketClosed: boolean;
  /** Plain-English notes for the sources footer (failover used, FX sources disagree …). */
  notes: string[];
};

/** Brief §10: after 10 minutes without fresh data, show a delayed state instead of a live-looking number. */
export const STALE_AFTER_MS = 10 * 60_000;

/**
 * Spot precious metals trade from Sunday 23:00 to Friday 22:00 UTC (Monday 07:00
 * to Saturday 06:00 in Manila). Outside that window the last close is the price.
 */
export function isMetalsMarketClosed(at: Date = new Date()): boolean {
  const day = at.getUTCDay();
  const hour = at.getUTCHours();
  if (day === 6) return true;
  if (day === 5 && hour >= 22) return true;
  if (day === 0 && hour < 23) return true;
  return false;
}

/** Fineness (parts per thousand) → fraction. */
export function purityFromPermille(permille: number): number {
  return permille / 1000;
}

/** Gold karat → fraction, using the market fineness table (24K = .999, 22K = .916 …). */
export function purityFromKarat(karat: number): number {
  const row = GOLD_KARATS.find((k) => k.karat === karat);
  return row ? row.permille / 1000 : Math.min(karat / 24, 0.999);
}

/** Value of the metal content alone: what it is worth melted, before any dealer spread. */
export function meltValuePhp(pureMetalPhpPerGram: number, grams: number, purity: number): number {
  if (!(pureMetalPhpPerGram > 0) || !(grams > 0) || !(purity > 0)) return 0;
  return pureMetalPhpPerGram * grams * purity;
}

/**
 * Purity from a specific-gravity reading (hydrostatic weighing), for gold–silver–copper
 * alloys. Uses the standard two-component estimate between pure gold (19.32) and a
 * typical alloy base (10.5). Indicative only: stones, hollow pieces and solder skew it.
 */
export function purityFromSpecificGravity(sg: number): number | null {
  const GOLD = 19.32;
  const BASE = 10.5;
  if (!(sg > BASE) || sg > GOLD + 0.2) return null;
  const fraction = (GOLD * (sg - BASE)) / (sg * (GOLD - BASE));
  return Math.max(0, Math.min(0.999, fraction));
}

export const UNITS = [
  { value: "g", label: "Grams", grams: 1 },
  { value: "ozt", label: "Troy ounces", grams: GRAMS_PER_TROY_OUNCE },
  { value: "kg", label: "Kilograms", grams: 1000 },
  { value: "tola", label: "Tola", grams: 11.6638 },
  { value: "tael", label: "Tael (HK)", grams: 37.429 },
] as const;
export type Unit = (typeof UNITS)[number]["value"];

export function toGrams(amount: number, unit: Unit): number {
  return amount * (UNITS.find((u) => u.value === unit)?.grams ?? 1);
}

/** How a price compares with melt value, e.g. +8.2 (% above melt). */
export function premiumOverMeltPct(pricePhp: number, meltPhp: number): number | null {
  if (!(meltPhp > 0) || !(pricePhp > 0)) return null;
  return ((pricePhp - meltPhp) / meltPhp) * 100;
}
