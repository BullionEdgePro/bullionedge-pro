import "server-only";
import { NEW_SELLER_LIMITS } from "@/config/catalog";
import { db } from "@/lib/server/db";
import { mediaUrl } from "@/lib/server/media";
import type { Viewer } from "@/lib/server/viewer";
import type { WizardDefaults } from "@/components/marketplace/sell-wizard";
import { getSpot } from "./context";
import { releasedSalesCount } from "./stats";

/** Everything the sell wizard needs: live spot, the seller's limits, and defaults (blank, or an existing listing). */
export async function wizardProps(viewer: Viewer, code?: string) {
  const [{ spot, delayed }, sales, activeCount, listing] = await Promise.all([
    getSpot(),
    releasedSalesCount(viewer.userId),
    db.listing.count({ where: { sellerId: viewer.userId, status: { in: ["active", "reserved"] } } }),
    code ? db.listing.findUnique({ where: { code }, include: { images: { orderBy: { position: "asc" }, select: { mediaId: true } } } }) : null,
  ]);
  const p = viewer.profile;
  const defaults: WizardDefaults = listing
    ? {
        code: listing.code,
        photos: listing.images.map((i) => ({ id: i.mediaId, url: mediaUrl(i.mediaId) })),
        title: listing.title,
        category: listing.category,
        metal: listing.metal ?? "",
        karat: listing.karat ? String(listing.karat) : "",
        finenessPermille: listing.finenessPermille ? String(listing.finenessPermille) : "",
        goldType: listing.goldType ?? "",
        form: listing.form ?? "",
        weightGrams: String(Number(listing.weightGrams)),
        pricingMode: listing.pricingMode === "spot_premium" ? "spot_premium" : "fixed",
        pricePhp: listing.pricePhp ? String(Number(listing.pricePhp)) : "",
        premiumPct: listing.premiumPct !== null ? String(Number(listing.premiumPct)) : "",
        openToOffers: listing.openToOffers,
        description: listing.description,
        hasCertificate: listing.hasCertificate,
        hasReceipt: listing.hasReceipt,
        pawnable: listing.pawnable === null ? "unknown" : listing.pawnable ? "yes" : "no",
        regionCode: listing.regionCode,
        provinceCode: listing.provinceCode ?? "",
        cityCode: listing.cityCode,
      }
    : {
        photos: [],
        title: "",
        category: "",
        metal: "",
        karat: "",
        finenessPermille: "",
        goldType: "",
        form: "",
        weightGrams: "",
        pricingMode: "fixed",
        pricePhp: "",
        premiumPct: "",
        openToOffers: true,
        description: "",
        hasCertificate: false,
        hasReceipt: false,
        pawnable: "unknown",
        regionCode: p?.regionCode ?? "",
        provinceCode: p?.provinceCode ?? "",
        cityCode: p?.cityCode ?? "",
      };
  return {
    listing,
    defaults,
    spot,
    pricesDelayed: delayed,
    limits: {
      newSeller: sales < NEW_SELLER_LIMITS.tradesToGraduate,
      maxListingValuePhp: NEW_SELLER_LIMITS.maxListingValuePhp,
      activeCount,
      maxActive: NEW_SELLER_LIMITS.maxActiveListings,
      tradesToGraduate: NEW_SELLER_LIMITS.tradesToGraduate,
      sales,
    },
  };
}
