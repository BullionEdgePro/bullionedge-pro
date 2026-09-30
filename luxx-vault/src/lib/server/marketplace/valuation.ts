/**
 * Live valuation of marketplace items: melt value from today's spot, the
 * asking price (fixed, or pegged to spot), and how far the price sits above or
 * below melt. Pure, so the server, the sell wizard and the tests share it.
 * The server always recomputes; a price from the browser is never trusted.
 */
import { BELOW_MELT_WARNING, type Metal } from "@/config/catalog";
import { meltValuePhp, premiumOverMeltPct, purityFromKarat, purityFromPermille } from "@/lib/market";

/** Pure-metal ₱ per gram by metal (from getMarket()). Missing = no live price. */
export type SpotTable = Partial<Record<Metal, number>>;

export type ValuationInput = {
  metal?: string | null;
  karat?: number | null;
  finenessPermille?: number | null;
  weightGrams: number;
  pricingMode: string;
  pricePhp?: number | null;
  premiumPct?: number | null;
};

export type Valuation = {
  /** Metal content at today's spot, or null for stones and when prices are unavailable. */
  meltPhp: number | null;
  /** What the buyer pays today, or null when a spot-pegged price can't be computed. */
  pricePhp: number | null;
  /** Price vs melt in percent (+8.2 = 8.2% above melt). */
  premiumPct: number | null;
  /** Priced below BELOW_MELT_WARNING × melt: show "Verify before buying". */
  belowMelt: boolean;
  /** Price is pegged to spot and moves with the market. */
  live: boolean;
};

const METAL_SET = new Set(["gold", "silver", "platinum", "palladium"]);

/** Fraction of pure metal, or null when the item has no declared metal content. */
export function itemPurity(item: Pick<ValuationInput, "metal" | "karat" | "finenessPermille">): number | null {
  if (!item.metal || !METAL_SET.has(item.metal)) return null;
  if (item.metal === "gold" && item.karat) return purityFromKarat(item.karat);
  if (item.finenessPermille && item.finenessPermille > 0 && item.finenessPermille <= 1000) return purityFromPermille(item.finenessPermille);
  return null;
}

export function meltFor(item: ValuationInput, spot: SpotTable): number | null {
  const purity = itemPurity(item);
  const perGram = item.metal ? spot[item.metal as Metal] : undefined;
  if (purity === null || !perGram) return null;
  const melt = meltValuePhp(perGram, item.weightGrams, purity);
  return melt > 0 ? melt : null;
}

export function valueItem(item: ValuationInput, spot: SpotTable): Valuation {
  const meltPhp = meltFor(item, spot);
  const live = item.pricingMode === "spot_premium";
  let pricePhp: number | null = null;
  if (live) {
    pricePhp = meltPhp !== null && item.premiumPct !== null && item.premiumPct !== undefined ? roundPeso(meltPhp * (1 + item.premiumPct / 100)) : null;
  } else if (item.pricePhp && item.pricePhp > 0) {
    pricePhp = item.pricePhp;
  }
  const premiumPct = pricePhp !== null && meltPhp !== null ? premiumOverMeltPct(pricePhp, meltPhp) : null;
  const belowMelt = pricePhp !== null && meltPhp !== null && pricePhp < BELOW_MELT_WARNING * meltPhp;
  return { meltPhp, pricePhp, premiumPct, belowMelt, live };
}

/** Whole pesos: listings are priced to the peso, never to the centavo. */
export function roundPeso(v: number): number {
  return Math.round(v);
}

/**
 * A starting point for the asking price, as a premium range over melt. It is
 * guidance for the seller, never a valuation: workmanship, brand and stones
 * are theirs to price.
 */
export function suggestedPremiumRange(category: string, form?: string | null): { low: number; high: number } {
  if (form === "scrap") return { low: -5, high: 2 };
  if (category === "gold_bullion" || form === "bar" || form === "coin") return { low: 2, high: 8 };
  if (category === "silver" || category === "platinum" || category === "palladium") return { low: 5, high: 30 };
  return { low: 5, high: 25 };
}

export function median(values: readonly number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid]! : (v[mid - 1]! + v[mid]!) / 2;
}

/** "+8.2% over melt", "−12.0% under melt", "At melt". */
export function premiumLabel(pct: number | null): string {
  if (pct === null) return "";
  if (Math.abs(pct) < 0.05) return "At melt";
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}% ${pct > 0 ? "over" : "under"} melt`;
}
