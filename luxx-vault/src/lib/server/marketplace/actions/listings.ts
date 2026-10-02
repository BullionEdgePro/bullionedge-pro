"use server";

import { requireFaceForAction } from "@/lib/server/face/gate";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { LISTING_LIFETIME_DAYS, NEW_SELLER_LIMITS } from "@/config/catalog";
import { audit } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { attachListingPhotos } from "@/lib/server/media";
import { assertNoOverdueFees } from "@/lib/server/fees";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { getViewer } from "@/lib/server/viewer";
import { isValidLocation } from "@/lib/locations";
import { formatPeso } from "@/lib/pricing";
import { uniqueCode } from "../codes";
import { assertSeller, getSpot, runAction, UserError, type ActionState } from "../context";
import { parseListingForm } from "../listing-input";
import { releasedSalesCount } from "../stats";
import { valueItem } from "../valuation";

const DAY = 86_400_000;

async function checkNewSellerLimits(sellerId: string, pricePhp: number | null, excludeListingId?: string) {
  const sales = await releasedSalesCount(sellerId);
  if (sales >= NEW_SELLER_LIMITS.tradesToGraduate) return;
  const active = await db.listing.count({
    where: { sellerId, status: { in: ["active", "reserved"] }, ...(excludeListingId ? { id: { not: excludeListingId } } : {}) },
  });
  if (active >= NEW_SELLER_LIMITS.maxActiveListings) {
    throw new UserError(
      `New sellers can have ${NEW_SELLER_LIMITS.maxActiveListings} listings up at a time until they complete ${NEW_SELLER_LIMITS.tradesToGraduate} trades. You have completed ${sales}.`,
    );
  }
  if (pricePhp !== null && pricePhp > NEW_SELLER_LIMITS.maxListingValuePhp) {
    throw new UserError(
      `Until your first ${NEW_SELLER_LIMITS.tradesToGraduate} completed trades, each listing can be up to ${formatPeso(NEW_SELLER_LIMITS.maxListingValuePhp)}.`,
    );
  }
}

/** Create (no `code`) or update (with `code`) a listing from the wizard. */
export async function saveListing(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const viewer = await assertSeller();
    await assertNoOverdueFees(viewer.userId);
    await requireFaceForAction("session");
    const editCode = typeof form.get("code") === "string" ? String(form.get("code")) : "";
    const existing = editCode
      ? await db.listing.findUnique({ where: { code: editCode }, select: { id: true, code: true, sellerId: true, status: true } })
      : null;
    if (editCode && (!existing || existing.sellerId !== viewer.userId)) throw new UserError("That listing isn't yours.");
    if (existing && !["active", "expired", "draft"].includes(existing.status)) throw new UserError("Reserved, sold or removed listings can't be edited.");

    const parsed = parseListingForm(form, { requireDeclaration: !existing });
    if ("errors" in parsed) return { ok: false, error: "Please check the highlighted details.", fieldErrors: parsed.errors };
    const d = parsed.data;
    if (!isValidLocation(d.regionCode, d.cityCode, d.provinceCode || null)) {
      return { ok: false, error: "Please check the location.", fieldErrors: { cityCode: "Choose a city in the selected region." } };
    }

    // Price the item on the server from today's spot: never trust a price computed in the browser.
    const { spot } = await getSpot();
    const v = valueItem(
      { metal: d.metal, karat: d.karat, finenessPermille: d.finenessPermille, weightGrams: d.weightGrams, pricingMode: d.pricingMode, pricePhp: d.pricePhp, premiumPct: d.premiumPct },
      spot,
    );
    if (d.pricingMode === "spot_premium" && v.pricePhp === null) {
      throw new UserError("Live prices are unavailable right now, so a spot-pegged price can't be set. Use a fixed price or try again shortly.");
    }
    if (v.belowMelt && !d.acknowledgeBelowMelt) {
      return {
        ok: false,
        error: "This price is well below today's melt value.",
        fieldErrors: { acknowledgeBelowMelt: "Buyers will see a “Verify before buying” warning. Tick the box to confirm the price is right." },
      };
    }
    await checkNewSellerLimits(viewer.userId, v.pricePhp, existing?.id);

    const data = {
      title: d.title,
      category: d.category,
      metal: d.metal ?? null,
      karat: d.karat ?? null,
      finenessPermille: d.finenessPermille ?? null,
      goldType: d.goldType ?? null,
      form: d.form ?? null,
      weightGrams: d.weightGrams,
      pricingMode: d.pricingMode,
      pricePhp: d.pricingMode === "fixed" ? d.pricePhp! : null,
      premiumPct: d.pricingMode === "spot_premium" ? d.premiumPct! : null,
      openToOffers: d.openToOffers,
      description: d.description,
      hasCertificate: d.hasCertificate,
      hasReceipt: d.hasReceipt,
      pawnable: d.pawnable === "unknown" ? null : d.pawnable === "yes",
      regionCode: d.regionCode,
      provinceCode: d.provinceCode || null,
      cityCode: d.cityCode,
    };

    let listing: { id: string; code: string; sellerId: string };
    if (existing) {
      await db.listing.update({ where: { id: existing.id }, data });
      listing = existing;
    } else {
      await assertRateLimit(`listing:create:${viewer.userId}`, 20, DAY, "You've posted a lot of listings today. Please try again tomorrow.");
      const code = await uniqueCode("LX", async (c) => Boolean(await db.listing.findUnique({ where: { code: c }, select: { id: true } })));
      const now = new Date();
      listing = await db.listing.create({
        data: { ...data, code, sellerId: viewer.userId, status: "active", declaredOwnerAt: now, expiresAt: new Date(now.getTime() + LISTING_LIFETIME_DAYS * DAY) },
        select: { id: true, code: true, sellerId: true },
      });
    }

    try {
      const { flagged } = await attachListingPhotos(listing, d.photos);
      if (flagged) {
        // Not blocked: staff take a look. The seller is told plainly so an honest mistake is easy to fix.
        await audit({ actorId: viewer.userId, action: "listing.duplicate_photo", targetType: "listing", targetId: listing.id, meta: { photos: flagged } });
      }
    } catch (err) {
      if (!existing) await db.listing.delete({ where: { id: listing.id } });
      throw err;
    }
    await audit({ actorId: viewer.userId, action: existing ? "listing.updated" : "listing.created", targetType: "listing", targetId: listing.id, meta: { code: listing.code, pricePhp: v.pricePhp } });
    revalidatePath("/marketplace");
    redirect(`/marketplace/${listing.code}?${existing ? "updated" : "published"}=1`);
  });
}

const CodeSchema = z.object({ code: z.string().regex(/^LX-[A-Z0-9]{5}$/) });

async function ownListing(form: FormData) {
  const viewer = await getViewer();
  if (!viewer) throw new UserError("Please sign in first.");
  const { code } = CodeSchema.parse({ code: form.get("code") });
  const listing = await db.listing.findUnique({ where: { code }, select: { id: true, code: true, status: true, sellerId: true, pricingMode: true, pricePhp: true } });
  if (!listing || listing.sellerId !== viewer.userId) throw new UserError("That listing isn't yours.");
  return { viewer, listing };
}

export async function renewListing(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    await assertSeller();
    const { viewer, listing } = await ownListing(form);
    await assertNoOverdueFees(viewer.userId);
    if (!["active", "expired"].includes(listing.status)) throw new UserError("Only active or expired listings can be renewed.");
    if (listing.status === "expired") await checkNewSellerLimits(viewer.userId, null, listing.id);
    await db.listing.update({ where: { id: listing.id }, data: { status: "active", expiresAt: new Date(Date.now() + LISTING_LIFETIME_DAYS * DAY) } });
    refresh();
    return { ok: true, message: `Renewed for ${LISTING_LIFETIME_DAYS} days.` };
  });
}

export async function markListingSold(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const { viewer, listing } = await ownListing(form);
    if (listing.status !== "active" && listing.status !== "expired") throw new UserError("Only an available listing can be marked sold.");
    await db.$transaction([
      db.listing.update({ where: { id: listing.id }, data: { status: "sold" } }),
      db.offer.updateMany({ where: { listingId: listing.id, status: "pending" }, data: { status: "declined", respondedAt: new Date() } }),
    ]);
    await audit({ actorId: viewer.userId, action: "listing.marked_sold", targetType: "listing", targetId: listing.id });
    refresh();
    return { ok: true, message: "Marked as sold." };
  });
}

export async function removeListing(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const { viewer, listing } = await ownListing(form);
    if (listing.status === "reserved") throw new UserError("This listing is in a trade. Cancel the trade first.");
    if (listing.status === "removed") return { ok: true };
    await db.$transaction([
      db.listing.update({ where: { id: listing.id }, data: { status: "removed" } }),
      db.offer.updateMany({ where: { listingId: listing.id, status: "pending" }, data: { status: "withdrawn", respondedAt: new Date() } }),
    ]);
    await audit({ actorId: viewer.userId, action: "listing.removed_by_seller", targetType: "listing", targetId: listing.id });
    refresh();
    return { ok: true, message: "Listing taken down." };
  });
}

/** Save or unsave a listing (any signed-in person). Returns the new state. */
export async function toggleSaved(listingId: string): Promise<{ saved: boolean } | { error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { error: "Sign in to save listings." };
  if (!/^[a-z0-9]{20,32}$/i.test(listingId)) return { error: "Unknown listing." };
  const key = { userId_listingId: { userId: viewer.userId, listingId } };
  const existing = await db.savedListing.findUnique({ where: key });
  if (existing) {
    await db.savedListing.delete({ where: key });
    return { saved: false };
  }
  const listing = await db.listing.findUnique({ where: { id: listingId }, select: { id: true } });
  if (!listing) return { error: "Unknown listing." };
  await db.savedListing.create({ data: { userId: viewer.userId, listingId } });
  return { saved: true };
}
