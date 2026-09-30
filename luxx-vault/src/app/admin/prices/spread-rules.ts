/**
 * Rules for the owner's buy/sell spreads, shared by the editor (live
 * warnings) and the server action (the real check). Ratios are stored as a
 * fraction of melt value (0.92 = 92%); the editor works in percent.
 */
import { METALS, type Metal } from "@/config/catalog";
import { purityOptions } from "@/lib/prices-format";

export const PRODUCT_TYPES = [
  { value: "jewelry", label: "Jewellery" },
  { value: "bullion", label: "Bars and coins" },
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number]["value"];

export type SpreadKey = `${Metal}:${number}:${ProductType}`;

export function spreadKey(metal: Metal, purity: number, productType: ProductType): SpreadKey {
  return `${metal}:${purity}:${productType}`;
}

/** Every row the editor offers: each metal's purities, for jewellery and for bullion. */
export function allSpreadSlots(): { key: SpreadKey; metal: Metal; purity: number; productType: ProductType }[] {
  return PRODUCT_TYPES.flatMap(({ value: productType }) =>
    METALS.flatMap(({ value: metal }) => purityOptions(metal).map((o) => ({ key: spreadKey(metal, o.value, productType), metal, purity: o.value, productType }))),
  );
}

export type RowCheck =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "ok"; buyRatio: number; sellRatio: number; warnings: string[] };

function parsePct(raw: string): number | null | "bad" {
  const v = raw.trim().replace(/%$/, "");
  if (!v) return null;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(v)) return "bad";
  return Number(v);
}

/** Check one row as typed (percent of melt). Errors block saving; warnings are sanity prompts. */
export function checkSpreadRow(buyRaw: string, sellRaw: string): RowCheck {
  const buy = parsePct(buyRaw);
  const sell = parsePct(sellRaw);
  if (buy === null && sell === null) return { kind: "empty" };
  if (buy === "bad" || sell === "bad") return { kind: "error", message: "Use a percentage with up to two decimals, e.g. 92.5." };
  if (buy === null || sell === null) return { kind: "error", message: "Set both “we buy” and “we sell”, or clear both." };
  if (buy <= 0 || sell <= 0) return { kind: "error", message: "Percentages must be above zero." };
  if (buy > 150 || sell > 300) return { kind: "error", message: "That is far outside any real spread (buy ≤ 150%, sell ≤ 300%)." };
  if (buy >= sell) return { kind: "error", message: "“We buy” must be lower than “we sell”, or every round trip loses money." };
  const warnings: string[] = [];
  if (buy >= 100) warnings.push("You would pay at or above melt value.");
  if (sell <= 100) warnings.push("You would sell at or below melt value.");
  if (buy < 60) warnings.push("An unusually low buying rate; customers may see it as unfair.");
  if (sell > 200) warnings.push("An unusually high selling rate.");
  return { kind: "ok", buyRatio: Number((buy / 100).toFixed(4)), sellRatio: Number((sell / 100).toFixed(4)), warnings };
}

/** Ratio → the percent string shown in the input (0.925 → "92.5"). */
export function toPctInput(ratio: number | undefined): string {
  if (ratio == null) return "";
  return String(Number((ratio * 100).toFixed(2)));
}
