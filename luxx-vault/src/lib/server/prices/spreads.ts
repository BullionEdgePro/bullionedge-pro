import "server-only";
import { db } from "../db";

export type SpreadRow = { metal: string; purity: number; productType: string; buyRatio: number; sellRatio: number; updatedAt: string };

/**
 * The owner's buy/sell spreads. There are deliberately no built-in defaults:
 * "We buy at" and "We sell at" are business prices, so they appear on the site
 * only after the owner sets them in /admin/prices.
 */
export async function getSpreads(): Promise<SpreadRow[]> {
  const rows = await db.spread.findMany({ orderBy: [{ metal: "asc" }, { purity: "desc" }] });
  return rows.map((r) => ({
    metal: r.metal,
    purity: r.purity,
    productType: r.productType,
    buyRatio: Number(r.buyRatio),
    sellRatio: Number(r.sellRatio),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export function findSpread(spreads: SpreadRow[], metal: string, purity: number, productType = "jewelry"): SpreadRow | undefined {
  return spreads.find((s) => s.metal === metal && s.purity === purity && s.productType === productType);
}
