import "server-only";
import { db } from "./db";
import { audit } from "./audit";
import { DUPLICATE_MAX_DISTANCE } from "./marketplace/dhash";
import { processUpload, watermarkListingPhoto, ImageRejected } from "./marketplace/image-core";
import { STAFF_ROLES, hasAnyRole } from "@/config/roles";

/**
 * Uploaded images (listing photos, showroom covers, dispute evidence, Official
 * Shop product photos and payment receipts).
 * Bytes live in MediaObject.bytes for now; a blob store (R2/S3) can take over
 * by filling `url` instead — nothing outside this module reads `bytes`.
 *
 * Listing photos are uploaded clean and watermarked when they are attached to
 * a listing (the watermark carries the listing code, which only exists then).
 * Until attached, a photo is visible to its owner only.
 */

export const MEDIA_PURPOSES = ["listing", "showroom_cover", "dispute_evidence", "product", "payment_proof"] as const;
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];

export { ImageRejected };

export function mediaUrl(id: string): string {
  return `/api/media/${id}`;
}

export async function storeUpload(ownerId: string, purpose: MediaPurpose, input: Uint8Array) {
  const img = await processUpload(input);
  const row = await db.mediaObject.create({
    data: {
      ownerId,
      purpose,
      mime: img.mime,
      bytes: new Uint8Array(img.bytes),
      width: img.width,
      height: img.height,
      sha256: img.sha256,
      phash: img.phash,
    },
    select: { id: true, width: true, height: true },
  });
  return { ...row, url: mediaUrl(row.id) };
}

type Access = { status: 200; body: Uint8Array; mime: string; cache: string } | { status: 403 | 404 };

/**
 * Who may see a media object:
 * - listing photos attached to a listing, and showroom covers in use: everyone;
 * - unattached listing photos: their owner (the sell wizard shows them);
 * - dispute evidence: the two parties to the trade, and staff;
 * - shop product photos: everyone once the product is published, staff before;
 * - payment receipts: the buyer who uploaded them, and staff.
 */
export async function readMedia(id: string, viewer: { userId: string; role: string | null } | null): Promise<Access> {
  if (!/^[a-z0-9]{20,32}$/i.test(id)) return { status: 404 };
  const m = await db.mediaObject.findUnique({ where: { id }, select: { id: true, ownerId: true, purpose: true, mime: true, bytes: true } });
  if (!m?.bytes) return { status: 404 };
  const isOwner = viewer?.userId === m.ownerId;
  const isStaff = Boolean(viewer && hasAnyRole(viewer.role, STAFF_ROLES));
  const ok = (cache: string): Access => ({ status: 200, body: m.bytes!, mime: m.mime, cache });
  const PUBLIC = "public, max-age=31536000, immutable";
  const PRIVATE = "private, no-store";

  if (m.purpose === "listing") {
    const attached = await db.listingImage.findFirst({ where: { mediaId: id }, select: { listing: { select: { status: true } } } });
    if (attached && attached.listing.status !== "removed") return ok(PUBLIC);
    if (isOwner || isStaff) return ok(PRIVATE);
    return { status: attached ? 403 : 404 };
  }
  if (m.purpose === "showroom_cover") {
    const inUse = await db.profile.findFirst({ where: { coverMediaId: id }, select: { userId: true } });
    if (inUse) return ok(PUBLIC);
    return isOwner || isStaff ? ok(PRIVATE) : { status: 404 };
  }
  if (m.purpose === "product") {
    const attached = await db.productImage.findFirst({ where: { mediaId: id }, select: { product: { select: { status: true } } } });
    if (attached && attached.product.status !== "draft") return ok(PUBLIC);
    return isOwner || isStaff ? ok(PRIVATE) : { status: attached ? 403 : 404 };
  }
  if (m.purpose === "payment_proof") {
    return isOwner || isStaff ? ok(PRIVATE) : { status: 403 };
  }
  if (m.purpose === "dispute_evidence") {
    if (isOwner || isStaff) return ok(PRIVATE);
    if (!viewer) return { status: 403 };
    const dispute = await db.dispute.findFirst({
      where: { evidenceMediaIds: { has: id } },
      select: { trade: { select: { buyerId: true, sellerId: true } } },
    });
    if (dispute && (dispute.trade.buyerId === viewer.userId || dispute.trade.sellerId === viewer.userId)) return ok(PRIVATE);
    return { status: 403 };
  }
  return { status: 404 };
}

/**
 * Attach the seller's uploaded photos to a listing: check ownership, stamp
 * the watermark, keep the order (first = cover), and look for the same photo
 * on other sellers' listings. A match flags the listing for staff; it never
 * blocks the seller (a shop may legitimately reuse its own studio shots).
 */
export async function attachListingPhotos(listing: { id: string; code: string; sellerId: string }, mediaIds: string[]) {
  const unique = [...new Set(mediaIds)].slice(0, 8);
  const media = await db.mediaObject.findMany({
    where: { id: { in: unique }, ownerId: listing.sellerId, purpose: "listing" },
    select: { id: true, bytes: true, phash: true },
  });
  if (media.length !== unique.length) throw new Error("One of those photos isn't yours or no longer exists. Please upload it again.");
  const elsewhere = await db.listingImage.findMany({ where: { mediaId: { in: unique }, listingId: { not: listing.id } }, select: { mediaId: true } });
  if (elsewhere.length) throw new Error("A photo is already used on another listing. Please upload it again for this one.");

  const existing = await db.listingImage.findMany({ where: { listingId: listing.id }, select: { mediaId: true } });
  const already = new Set(existing.map((e) => e.mediaId));
  const flagged: { mediaId: string; listingId: string }[] = [];

  for (const m of media) {
    if (!already.has(m.id) && m.bytes) {
      const wm = await watermarkListingPhoto(Buffer.from(m.bytes), listing.code);
      await db.mediaObject.update({ where: { id: m.id }, data: { bytes: new Uint8Array(wm.bytes) } });
    }
  }

  await db.$transaction([
    db.listingImage.deleteMany({ where: { listingId: listing.id, mediaId: { notIn: unique } } }),
    ...unique.map((mediaId, position) =>
      already.has(mediaId)
        ? db.listingImage.updateMany({ where: { listingId: listing.id, mediaId }, data: { position } })
        : db.listingImage.create({ data: { listingId: listing.id, mediaId, position } }),
    ),
  ]);

  for (const m of media) {
    const dup = await findDuplicateListing(m.phash, listing.sellerId);
    if (dup) {
      await db.listingImage.updateMany({ where: { listingId: listing.id, mediaId: m.id }, data: { duplicateOfListingId: dup } });
      flagged.push({ mediaId: m.id, listingId: dup });
    }
  }
  if (flagged.length) {
    await audit({ actorId: null, action: "listing.duplicate_photo_flagged", targetType: "listing", targetId: listing.id, meta: { matches: flagged } });
  }
  return { flagged: flagged.length };
}

/** Another seller's listing carrying a photo within DUPLICATE_MAX_DISTANCE bits of this one, if any. */
async function findDuplicateListing(phash: string, sellerId: string): Promise<string | null> {
  if (!/^[0-9a-f]{16}$/.test(phash)) return null;
  // Hamming distance in SQL: XOR the two 64-bit strings and count the ones (PostgreSQL 14+).
  const rows = await db.$queryRaw<{ listingId: string }[]>`
    SELECT li."listingId"
    FROM media_object m
    JOIN listing_image li ON li."mediaId" = m.id
    JOIN listing l ON l.id = li."listingId"
    WHERE m.purpose = 'listing'
      AND m."ownerId" <> ${sellerId}
      AND l."sellerId" <> ${sellerId}
      AND length(m.phash) = 16
      AND bit_count(('x' || m.phash)::bit(64) # ('x' || ${phash})::bit(64)) <= ${DUPLICATE_MAX_DISTANCE}
    ORDER BY l."createdAt" ASC
    LIMIT 1`;
  return rows[0]?.listingId ?? null;
}

/**
 * Attach photos to an Official Shop product: staff uploads only, stamped with
 * the product code, first photo is the cover. No duplicate check: these are
 * the shop's own photos.
 */
export async function attachProductPhotos(product: { id: string; code: string }, mediaIds: string[]) {
  const unique = [...new Set(mediaIds)].slice(0, 8);
  const media = await db.mediaObject.findMany({ where: { id: { in: unique }, purpose: "product" }, select: { id: true, bytes: true } });
  if (media.length !== unique.length) throw new Error("One of those photos no longer exists. Please upload it again.");
  const elsewhere = await db.productImage.findMany({ where: { mediaId: { in: unique }, productId: { not: product.id } }, select: { mediaId: true } });
  if (elsewhere.length) throw new Error("A photo is already used on another product. Please upload it again for this one.");

  const existing = await db.productImage.findMany({ where: { productId: product.id }, select: { mediaId: true } });
  const already = new Set(existing.map((e) => e.mediaId));
  for (const m of media) {
    if (!already.has(m.id) && m.bytes) {
      const wm = await watermarkListingPhoto(Buffer.from(m.bytes), product.code);
      await db.mediaObject.update({ where: { id: m.id }, data: { bytes: new Uint8Array(wm.bytes) } });
    }
  }
  await db.$transaction([
    db.productImage.deleteMany({ where: { productId: product.id, mediaId: { notIn: unique } } }),
    ...unique.map((mediaId, position) =>
      already.has(mediaId)
        ? db.productImage.updateMany({ where: { productId: product.id, mediaId }, data: { position } })
        : db.productImage.create({ data: { productId: product.id, mediaId, position } }),
    ),
  ]);
}
