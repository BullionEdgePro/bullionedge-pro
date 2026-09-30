import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/server/db";
import { mediaUrl } from "@/lib/server/media";
import { placeLabel } from "@/lib/locations";
import { getSpot } from "./context";
import { normaliseCode } from "./codes";
import { PAGE_SIZE, type MarketFilters } from "./search-params";
import { statsFor } from "./stats";
import { median, valueItem, type Valuation } from "./valuation";

/** Hidden from search while this many reports are open (brief §9: auto-hide pending review). */
export const REPORT_HIDE_THRESHOLD = 3;

/**
 * Lazy housekeeping: listings and wanted posts past their date become
 * "expired" the next time anyone looks. No cron needed, and nothing expired is
 * ever shown as available.
 */
export async function sweepExpired(): Promise<void> {
  const now = new Date();
  await Promise.all([
    db.listing.updateMany({ where: { status: "active", expiresAt: { lt: now } }, data: { status: "expired" } }),
    db.buyRequest.updateMany({ where: { status: "open", expiresAt: { lt: now } }, data: { status: "expired" } }),
    db.offer.updateMany({ where: { status: "pending", expiresAt: { lt: now } }, data: { status: "expired" } }),
  ]);
}

export type SellerSummary = {
  userId: string;
  handle: string;
  displayName: string;
  tier: 0 | 1 | 2 | 3 | 4;
  trustScore: number;
  trustLabel: string;
};

export type ListingCard = {
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
  openToOffers: boolean;
  luxxTested: boolean;
  hasCertificate: boolean;
  pawnable: boolean | null;
  coverUrl: string | null;
  place: string;
  status: string;
  createdAt: Date;
  seller: SellerSummary;
};

export const listingCardSelect = {
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
  openToOffers: true,
  luxxTestedAt: true,
  hasCertificate: true,
  pawnable: true,
  regionCode: true,
  cityCode: true,
  status: true,
  createdAt: true,
  sellerId: true,
  images: { orderBy: { position: "asc" }, take: 1, select: { mediaId: true } },
  seller: { select: { profile: { select: { handle: true, displayName: true } }, name: true } },
} satisfies Prisma.ListingSelect;

type ListingRow = Prisma.ListingGetPayload<{ select: typeof listingCardSelect }>;

export function valuationOf(row: Pick<ListingRow, "metal" | "karat" | "finenessPermille" | "weightGrams" | "pricingMode" | "pricePhp" | "premiumPct">, spot: Awaited<ReturnType<typeof getSpot>>["spot"]) {
  return valueItem(
    {
      metal: row.metal,
      karat: row.karat,
      finenessPermille: row.finenessPermille,
      weightGrams: Number(row.weightGrams),
      pricingMode: row.pricingMode,
      pricePhp: row.pricePhp === null ? null : Number(row.pricePhp),
      premiumPct: row.premiumPct === null ? null : Number(row.premiumPct),
    },
    spot,
  );
}

/** Rows → cards with live valuation and seller trust (one batched stats query). */
export async function toCards(rows: ListingRow[]): Promise<ListingCard[]> {
  const { spot } = await getSpot();
  const stats = await statsFor(rows.map((r) => r.sellerId));
  return rows.map((r) => {
    const s = stats.get(r.sellerId);
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
      valuation: valuationOf(r, spot),
      openToOffers: r.openToOffers,
      luxxTested: Boolean(r.luxxTestedAt),
      hasCertificate: r.hasCertificate,
      pawnable: r.pawnable,
      coverUrl: r.images[0] ? mediaUrl(r.images[0].mediaId) : null,
      place: placeLabel(r.cityCode, r.regionCode),
      status: r.status,
      createdAt: r.createdAt,
      seller: {
        userId: r.sellerId,
        handle: r.seller.profile?.handle ?? "",
        displayName: r.seller.profile?.displayName ?? r.seller.name,
        tier: s?.tier ?? 0,
        trustScore: s?.trust.score ?? 0,
        trustLabel: s?.trust.label ?? "New",
      },
    };
  });
}

/** What the public may browse: active, unexpired, not auto-hidden by reports. */
export const PUBLIC_LISTING: Prisma.ListingWhereInput = {
  status: "active",
  reportCount: { lt: REPORT_HIDE_THRESHOLD },
};

function listingWhere(f: MarketFilters): Prisma.ListingWhereInput {
  const and: Prisma.ListingWhereInput[] = [PUBLIC_LISTING, { expiresAt: { gt: new Date() } }];
  if (f.q) {
    const code = normaliseCode(f.q, "LX");
    and.push({
      OR: [
        { title: { contains: f.q, mode: "insensitive" } },
        { description: { contains: f.q, mode: "insensitive" } },
        ...(code ? [{ code }] : []),
        { seller: { profile: { OR: [{ displayName: { contains: f.q, mode: "insensitive" } }, { handle: { contains: f.q.toLowerCase() } }] } } },
      ],
    });
  }
  if (f.category) and.push({ category: f.category });
  if (f.metal) and.push({ metal: f.metal });
  if (f.karat) and.push({ karat: f.karat });
  if (f.goldType) and.push({ goldType: f.goldType });
  if (f.form) and.push({ form: f.form });
  if (f.minGrams !== null) and.push({ weightGrams: { gte: f.minGrams } });
  if (f.maxGrams !== null) and.push({ weightGrams: { lte: f.maxGrams } });
  if (f.region) and.push({ regionCode: f.region });
  if (f.city) and.push({ cityCode: f.city });
  if (f.offers) and.push({ openToOffers: true });
  if (f.tested) and.push({ luxxTestedAt: { not: null } });
  return { AND: and };
}

/** Upper bound on rows valued in memory per search (spot-pegged prices can't be sorted in SQL). */
const SCAN_LIMIT = 1500;

export async function searchListings(f: MarketFilters): Promise<{ items: ListingCard[]; total: number; page: number; pages: number; capped: boolean }> {
  const rows = await db.listing.findMany({ where: listingWhere(f), select: listingCardSelect, orderBy: { createdAt: "desc" }, take: SCAN_LIMIT + 1 });
  const capped = rows.length > SCAN_LIMIT;
  let cards = await toCards(rows.slice(0, SCAN_LIMIT));

  if (f.minPrice !== null) cards = cards.filter((c) => c.valuation.pricePhp !== null && c.valuation.pricePhp >= f.minPrice!);
  if (f.maxPrice !== null) cards = cards.filter((c) => c.valuation.pricePhp !== null && c.valuation.pricePhp <= f.maxPrice!);

  const last = Number.POSITIVE_INFINITY;
  switch (f.sort) {
    case "price_asc":
      cards.sort((a, b) => (a.valuation.pricePhp ?? last) - (b.valuation.pricePhp ?? last));
      break;
    case "price_desc":
      cards.sort((a, b) => (b.valuation.pricePhp ?? -1) - (a.valuation.pricePhp ?? -1));
      break;
    case "premium":
      cards.sort((a, b) => (a.valuation.premiumPct ?? last) - (b.valuation.premiumPct ?? last));
      break;
    case "trust":
      cards.sort((a, b) => b.seller.trustScore - a.seller.trustScore || b.createdAt.getTime() - a.createdAt.getTime());
      break;
    default:
      break; // newest: already ordered by the query
  }

  const total = cards.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(f.page, pages);
  return { items: cards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total, page, pages, capped };
}

// ------------------------------------------------------------------ wanted posts

export type WantedCard = {
  id: string;
  code: string;
  title: string;
  category: string;
  metal: string | null;
  karat: number | null;
  goldType: string | null;
  form: string | null;
  minGrams: number | null;
  maxGrams: number | null;
  budgetMaxPhp: number | null;
  place: string;
  createdAt: Date;
  expiresAt: Date;
  offerCount: number;
  buyer: { handle: string; displayName: string; tier: 0 | 1 | 2 | 3 | 4 };
};

export async function searchWanted(f: MarketFilters): Promise<{ items: WantedCard[]; total: number; page: number; pages: number }> {
  const and: Prisma.BuyRequestWhereInput[] = [{ status: "open", expiresAt: { gt: new Date() }, reportCount: { lt: REPORT_HIDE_THRESHOLD } }];
  if (f.q) {
    const code = normaliseCode(f.q, "WP");
    and.push({ OR: [{ title: { contains: f.q, mode: "insensitive" } }, { description: { contains: f.q, mode: "insensitive" } }, ...(code ? [{ code }] : [])] });
  }
  if (f.category) and.push({ category: f.category });
  if (f.metal) and.push({ metal: f.metal });
  if (f.karat) and.push({ karat: f.karat });
  if (f.goldType) and.push({ goldType: f.goldType });
  if (f.form) and.push({ form: f.form });
  if (f.region) and.push({ regionCode: f.region });
  if (f.city) and.push({ cityCode: f.city });
  if (f.minGrams !== null) and.push({ OR: [{ maxGrams: null }, { maxGrams: { gte: f.minGrams } }] });
  if (f.maxGrams !== null) and.push({ OR: [{ minGrams: null }, { minGrams: { lte: f.maxGrams } }] });
  if (f.minPrice !== null) and.push({ OR: [{ budgetMaxPhp: null }, { budgetMaxPhp: { gte: f.minPrice } }] });
  if (f.maxPrice !== null) and.push({ budgetMaxPhp: { lte: f.maxPrice } });
  const where = { AND: and };
  const orderBy: Prisma.BuyRequestOrderByWithRelationInput =
    f.sort === "price_desc" ? { budgetMaxPhp: { sort: "desc", nulls: "last" } } : f.sort === "price_asc" ? { budgetMaxPhp: { sort: "asc", nulls: "last" } } : { createdAt: "desc" };
  const total = await db.buyRequest.count({ where });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(f.page, pages);
  const rows = await db.buyRequest.findMany({
    where,
    orderBy,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { buyer: { select: { name: true, profile: { select: { handle: true, displayName: true } } } }, _count: { select: { offers: true } } },
  });
  const stats = await statsFor(rows.map((r) => r.buyerId));
  return {
    total,
    page,
    pages,
    items: rows.map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      category: r.category,
      metal: r.metal,
      karat: r.karat,
      goldType: r.goldType,
      form: r.form,
      minGrams: r.minGrams === null ? null : Number(r.minGrams),
      maxGrams: r.maxGrams === null ? null : Number(r.maxGrams),
      budgetMaxPhp: r.budgetMaxPhp === null ? null : Number(r.budgetMaxPhp),
      place: placeLabel(r.cityCode, r.regionCode),
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      offerCount: r._count.offers,
      buyer: { handle: r.buyer.profile?.handle ?? "", displayName: r.buyer.profile?.displayName ?? r.buyer.name, tier: stats.get(r.buyerId)?.tier ?? 0 },
    })),
  };
}

// ------------------------------------------------------------------ market stats

export type MarketStats = {
  activeListings: number;
  openWanted: number;
  medianPremium: { karat: 18 | 21 | 24; pct: number | null; sample: number }[];
  delayed: boolean;
};

/** Counts and median premium over melt for 18K/21K/24K, from live valuations of active listings. */
export async function marketStats(): Promise<MarketStats> {
  const now = new Date();
  const [activeListings, openWanted, gold] = await Promise.all([
    db.listing.count({ where: { ...PUBLIC_LISTING, expiresAt: { gt: now } } }),
    db.buyRequest.count({ where: { status: "open", expiresAt: { gt: now }, reportCount: { lt: REPORT_HIDE_THRESHOLD } } }),
    db.listing.findMany({
      where: { ...PUBLIC_LISTING, expiresAt: { gt: now }, metal: "gold", karat: { in: [18, 21, 24] } },
      select: { metal: true, karat: true, finenessPermille: true, weightGrams: true, pricingMode: true, pricePhp: true, premiumPct: true },
      take: 3000,
    }),
  ]);
  const { spot, delayed } = await getSpot();
  const medianPremium = ([18, 21, 24] as const).map((karat) => {
    const pcts = gold
      .filter((g) => g.karat === karat)
      .map((g) => valuationOf(g, spot).premiumPct)
      .filter((p): p is number => p !== null);
    return { karat, pct: median(pcts), sample: pcts.length };
  });
  return { activeListings, openWanted, medianPremium, delayed };
}
