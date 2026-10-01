import "server-only";
import { db } from "@/lib/server/db";
import { mediaUrl } from "@/lib/server/media";
import { getSpot } from "@/lib/server/marketplace/context";
import { money } from "@/lib/shop";
import { productValuation } from "./products";

export type BagLine = {
  productId: string;
  code: string;
  title: string;
  coverUrl: string | null;
  coverMediaId: string | null;
  metal: string | null;
  karat: number | null;
  finenessPermille: number | null;
  weightGrams: number;
  quantity: number;
  stock: number;
  /** Today's price for one piece, or null when a spot-pegged price can't be worked out. */
  unitPricePhp: number | null;
  live: boolean;
  layawayAllowed: boolean;
  /** Why this line can't be ordered as it stands, or null. */
  problem: string | null;
};

export type Bag = {
  lines: BagLine[];
  subtotalPhp: number;
  /** Every line can be ordered as it stands. */
  ready: boolean;
  allLayawayAllowed: boolean;
  pricesDelayed: boolean;
  hasLivePrices: boolean;
};

/** The bag with today's prices. Nothing about price is stored in the bag itself. */
export async function getBag(userId: string): Promise<Bag> {
  const [rows, { spot, delayed }] = await Promise.all([
    db.cartItem.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: { product: { include: { images: { orderBy: { position: "asc" }, take: 1, select: { mediaId: true } } } } },
    }),
    getSpot(),
  ]);
  const lines: BagLine[] = rows.map(({ product: p, quantity }) => {
    const v = productValuation(p, spot);
    const problem =
      p.status !== "active"
        ? "No longer available"
        : p.stock <= 0
          ? "Sold out"
          : quantity > p.stock
            ? `Only ${p.stock} left: lower the quantity`
            : v.pricePhp === null
              ? "Its price returns when live gold prices are back"
              : null;
    return {
      productId: p.id,
      code: p.code,
      title: p.title,
      coverUrl: p.images[0] ? mediaUrl(p.images[0].mediaId) : null,
      coverMediaId: p.images[0]?.mediaId ?? null,
      metal: p.metal,
      karat: p.karat,
      finenessPermille: p.finenessPermille,
      weightGrams: Number(p.weightGrams),
      quantity,
      stock: p.stock,
      unitPricePhp: v.pricePhp,
      live: v.live,
      layawayAllowed: p.layawayAllowed,
      problem,
    };
  });
  const subtotalPhp = money(lines.reduce((s, l) => s + (l.problem ? 0 : (l.unitPricePhp ?? 0) * l.quantity), 0));
  return {
    lines,
    subtotalPhp,
    ready: lines.length > 0 && lines.every((l) => !l.problem),
    allLayawayAllowed: lines.every((l) => l.layawayAllowed),
    pricesDelayed: delayed,
    hasLivePrices: lines.some((l) => l.live),
  };
}

export async function bagCount(userId: string): Promise<number> {
  const agg = await db.cartItem.aggregate({ where: { userId }, _sum: { quantity: true } });
  return agg._sum.quantity ?? 0;
}
