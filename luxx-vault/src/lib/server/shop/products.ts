import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/server/db";
import { mediaUrl } from "@/lib/server/media";
import { getSpot } from "@/lib/server/marketplace/context";
import { valueItem, type SpotTable, type Valuation } from "@/lib/server/marketplace/valuation";

/** The Official Shop's catalogue: what is on sale, priced live from today's spot. */

export const productCardSelect = {
  id: true,
  code: true,
  title: true,
  category: true,
  metal: true,
  karat: true,
  finenessPermille: true,
  goldType: true,
  form: true,
  weightGrams: true,
  pricingMode: true,
  pricePhp: true,
  premiumPct: true,
  hasCertificate: true,
  pawnable: true,
  stock: true,
  layawayAllowed: true,
  featured: true,
  status: true,
  createdAt: true,
  images: { orderBy: { position: "asc" }, take: 1, select: { mediaId: true } },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;
type Priceable = Pick<ProductRow, "metal" | "karat" | "finenessPermille" | "weightGrams" | "pricingMode" | "pricePhp" | "premiumPct">;

export type ProductCard = {
  id: string;
  code: string;
  title: string;
  category: string;
  metal: string | null;
  karat: number | null;
  finenessPermille: number | null;
  goldType: string | null;
  form: string | null;
  weightGrams: number;
  valuation: Valuation;
  hasCertificate: boolean;
  pawnable: boolean | null;
  stock: number;
  layawayAllowed: boolean;
  featured: boolean;
  status: string;
  coverUrl: string | null;
  createdAt: Date;
};

export function productValuation(p: Priceable, spot: SpotTable): Valuation {
  return valueItem(
    {
      metal: p.metal,
      karat: p.karat,
      finenessPermille: p.finenessPermille,
      weightGrams: Number(p.weightGrams),
      pricingMode: p.pricingMode,
      pricePhp: p.pricePhp === null ? null : Number(p.pricePhp),
      premiumPct: p.premiumPct === null ? null : Number(p.premiumPct),
    },
    spot,
  );
}

export function toProductCard(r: ProductRow, spot: SpotTable): ProductCard {
  return {
    id: r.id,
    code: r.code,
    title: r.title,
    category: r.category,
    metal: r.metal,
    karat: r.karat,
    finenessPermille: r.finenessPermille,
    goldType: r.goldType,
    form: r.form,
    weightGrams: Number(r.weightGrams),
    valuation: productValuation(r, spot),
    hasCertificate: r.hasCertificate,
    pawnable: r.pawnable,
    stock: r.stock,
    layawayAllowed: r.layawayAllowed,
    featured: r.featured,
    status: r.status,
    coverUrl: r.images[0] ? mediaUrl(r.images[0].mediaId) : null,
    createdAt: r.createdAt,
  };
}

export const SHOP_SORTS = [
  { key: "featured", label: "Featured" },
  { key: "newest", label: "Newest" },
  { key: "price_asc", label: "Price: low to high" },
  { key: "price_desc", label: "Price: high to low" },
  { key: "weight_desc", label: "Heaviest" },
] as const;
export type ShopSort = (typeof SHOP_SORTS)[number]["key"];

/**
 * Published products, sold-out ones last. Prices are live (spot-pegged pieces
 * move with the market), so price sorting happens after valuation.
 */
export async function listShopProducts(opts: { category?: string; sort?: ShopSort; limit?: number } = {}): Promise<ProductCard[]> {
  const rows = await db.product.findMany({
    where: { status: "active", ...(opts.category ? { category: opts.category } : {}) },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    take: 400,
    select: productCardSelect,
  });
  const { spot } = await getSpot();
  const cards = rows.map((r) => toProductCard(r, spot));
  const price = (c: ProductCard) => c.valuation.pricePhp ?? Number.POSITIVE_INFINITY;
  const sort = opts.sort ?? "featured";
  if (sort === "newest") cards.sort((a, b) => +b.createdAt - +a.createdAt);
  if (sort === "price_asc") cards.sort((a, b) => price(a) - price(b));
  if (sort === "price_desc") cards.sort((a, b) => (b.valuation.pricePhp ?? -1) - (a.valuation.pricePhp ?? -1));
  if (sort === "weight_desc") cards.sort((a, b) => b.weightGrams - a.weightGrams);
  // In stock first, keeping the chosen order within each group.
  const sorted = [...cards.filter((c) => c.stock > 0), ...cards.filter((c) => c.stock <= 0)];
  return opts.limit ? sorted.slice(0, opts.limit) : sorted;
}

/** Featured pieces for the home page and the marketplace: in stock only. */
export async function featuredProducts(limit = 4): Promise<ProductCard[]> {
  const cards = await listShopProducts({ sort: "featured" });
  return cards.filter((c) => c.stock > 0).slice(0, limit);
}
