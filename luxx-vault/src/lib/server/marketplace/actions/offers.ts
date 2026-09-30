"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { notify } from "@/lib/server/notify";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { assertTier, type Viewer } from "@/lib/server/viewer";
import { formatPeso } from "@/lib/pricing";
import { detectScam } from "@/lib/scam-detect";
import { uniqueCode } from "../codes";
import { findOrCreateConversation, systemMessage } from "../conversations";
import { assertSeller, getSpot, runAction, UserError, type ActionState } from "../context";
import { REPORT_HIDE_THRESHOLD, valuationOf } from "../listings";
import { OFFER_HOURS } from "../trades";

const HOUR = 3_600_000;
const Amount = z.preprocess((v) => Number(String(v ?? "").replace(/[,₱\s]/g, "")), z.number("Enter an amount in pesos.").min(100, "Enter an amount in pesos.").max(1_000_000_000));
const Message = z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined), z.string().max(500, "Keep the note under 500 characters.").optional());
const Id = z.string().regex(/^[a-z0-9]{20,32}$/i);

/** Offer notes may not carry contact or payment details: those belong nowhere near a deal. */
function checkNote(note: string | undefined) {
  if (!note) return;
  const { flags } = detectScam(note);
  if (flags.some((f) => f === "phone_number" || f === "bank_account" || f === "external_link" || f === "off_platform_payment")) {
    throw new UserError("Please keep phone numbers, account details, links and outside payment out of offer notes. Use the chat for questions.");
  }
}

async function offerRate(viewer: Viewer) {
  await assertRateLimit(`offer:${viewer.userId}`, 20, HOUR, "You've sent a lot of offers this hour. Please wait a little.");
}

/** Buyer → seller, on a listing. `mode=asking` buys at today's price; otherwise a custom amount (open-to-offers listings only). */
export async function makeListingOffer(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const viewer = await assertTier(3);
    const listingId = Id.parse(form.get("listingId"));
    const mode = form.get("mode") === "asking" ? "asking" : "offer";
    const note = Message.parse(form.get("message"));
    checkNote(note);

    const listing = await db.listing.findUnique({ where: { id: listingId } });
    if (!listing || listing.status !== "active" || listing.expiresAt < new Date() || listing.reportCount >= REPORT_HIDE_THRESHOLD) {
      throw new UserError("This listing is no longer available.");
    }
    if (listing.sellerId === viewer.userId) throw new UserError("You can't make an offer on your own listing.");
    const { spot } = await getSpot();
    const price = valuationOf(listing, spot).pricePhp;

    let amount: number;
    if (mode === "asking") {
      if (price === null) throw new UserError("Live prices are unavailable right now. Please try again in a few minutes.");
      amount = price;
    } else {
      if (!listing.openToOffers) throw new UserError("This seller isn't taking offers. You can buy at the asking price.");
      const parsed = Amount.safeParse(form.get("amount"));
      if (!parsed.success) return { ok: false, fieldErrors: { amount: parsed.error.issues[0]?.message ?? "Enter an amount." } };
      amount = Math.round(parsed.data);
      if (price !== null && amount > price * 2) return { ok: false, fieldErrors: { amount: "That's more than double the asking price. Please check the amount." } };
    }
    const already = await db.offer.findFirst({ where: { listingId, fromUserId: viewer.userId, status: "pending", expiresAt: { gt: new Date() } } });
    if (already) throw new UserError("You already have an offer waiting on this listing. Withdraw it in Offers to send a new one.");
    await offerRate(viewer);

    const offer = await db.offer.create({
      data: { listingId, fromUserId: viewer.userId, toUserId: listing.sellerId, amountPhp: amount, weightGrams: listing.weightGrams, message: note ?? null, expiresAt: new Date(Date.now() + OFFER_HOURS * HOUR) },
    });
    await notify(listing.sellerId, {
      kind: "offer_received",
      title: mode === "asking" ? `A buyer wants ${listing.code} at your price` : `New offer on ${listing.code}`,
      body: `${formatPeso(amount)} for “${listing.title}”. It expires in ${OFFER_HOURS} hours.`,
      href: "/account/offers",
      channels: ["email"],
    });
    await audit({ actorId: viewer.userId, action: "offer.created", targetType: "offer", targetId: offer.id, meta: { listing: listing.code, amountPhp: amount, mode } });
    return { ok: true, message: mode === "asking" ? "Request sent. The seller has 48 hours to confirm." : "Offer sent. The seller has 48 hours to reply.", href: "/account/offers?tab=sent" };
  });
}

/** Seller → buyer, answering a wanted post. Selling needs Tier 4 and two-step sign-in. */
export async function makeWantedOffer(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const viewer = await assertSeller();
    const requestId = Id.parse(form.get("buyRequestId"));
    const note = Message.parse(form.get("message"));
    checkNote(note);
    const amount = Amount.safeParse(form.get("amount"));
    const weight = z.preprocess((v) => Number(v), z.number().min(0.01).max(100_000)).safeParse(form.get("weightGrams"));
    const fieldErrors: Record<string, string> = {};
    if (!amount.success) fieldErrors.amount = "Enter your price in pesos.";
    if (!weight.success) fieldErrors.weightGrams = "Enter the exact weight in grams.";
    if (!amount.success || !weight.success) return { ok: false, fieldErrors };

    const request = await db.buyRequest.findUnique({ where: { id: requestId } });
    if (!request || request.status !== "open" || request.expiresAt < new Date()) throw new UserError("This wanted post is no longer open.");
    if (request.buyerId === viewer.userId) throw new UserError("You can't answer your own wanted post.");
    const already = await db.offer.findFirst({ where: { buyRequestId: requestId, fromUserId: viewer.userId, status: "pending", expiresAt: { gt: new Date() } } });
    if (already) throw new UserError("You already have an offer waiting on this post.");
    await offerRate(viewer);

    const offer = await db.offer.create({
      data: {
        buyRequestId: requestId,
        fromUserId: viewer.userId,
        toUserId: request.buyerId,
        amountPhp: Math.round(amount.data),
        weightGrams: weight.data,
        message: note ?? null,
        expiresAt: new Date(Date.now() + OFFER_HOURS * HOUR),
      },
    });
    await notify(request.buyerId, {
      kind: "offer_received",
      title: `A seller answered ${request.code}`,
      body: `${formatPeso(Math.round(amount.data))} for ${weight.data} g. It expires in ${OFFER_HOURS} hours.`,
      href: "/account/offers",
      channels: ["email"],
    });
    await audit({ actorId: viewer.userId, action: "offer.created", targetType: "offer", targetId: offer.id, meta: { request: request.code, amountPhp: Math.round(amount.data) } });
    return { ok: true, message: "Offer sent. The buyer has 48 hours to reply.", href: "/account/offers?tab=sent" };
  });
}

async function loadOffer(form: FormData) {
  const id = Id.parse(form.get("offerId"));
  const offer = await db.offer.findUnique({
    where: { id },
    include: { listing: true, buyRequest: true },
  });
  if (!offer) throw new UserError("That offer no longer exists.");
  if (offer.status === "pending" && offer.expiresAt < new Date()) {
    await db.offer.update({ where: { id }, data: { status: "expired" } });
    throw new UserError("That offer has expired.");
  }
  return offer;
}

function offerSubject(offer: Awaited<ReturnType<typeof loadOffer>>): string {
  return offer.listing ? `${offer.listing.code} · ${offer.listing.title}` : offer.buyRequest ? `${offer.buyRequest.code} · ${offer.buyRequest.title}` : "your offer";
}

/** Who buys and who sells in this offer's deal, whichever way the offer happens to point. */
function sides(offer: Awaited<ReturnType<typeof loadOffer>>): { buyerId: string; sellerId: string } {
  if (offer.listing) {
    const sellerId = offer.listing.sellerId;
    return { sellerId, buyerId: offer.fromUserId === sellerId ? offer.toUserId : offer.fromUserId };
  }
  const buyerId = offer.buyRequest!.buyerId;
  return { buyerId, sellerId: offer.fromUserId === buyerId ? offer.toUserId : offer.fromUserId };
}

export async function declineOffer(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const viewer = await assertTier(3);
    const offer = await loadOffer(form);
    if (offer.toUserId !== viewer.userId || offer.status !== "pending") throw new UserError("You can't decline this offer.");
    await db.offer.update({ where: { id: offer.id }, data: { status: "declined", respondedAt: new Date() } });
    await notify(offer.fromUserId, { kind: "offer_declined", title: "Offer declined", body: `${formatPeso(Number(offer.amountPhp))} for ${offerSubject(offer)} was declined.`, href: "/account/offers?tab=sent" });
    refresh();
    return { ok: true, message: "Offer declined." };
  });
}

export async function withdrawOffer(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const viewer = await assertTier(3);
    const offer = await loadOffer(form);
    if (offer.fromUserId !== viewer.userId || offer.status !== "pending") throw new UserError("You can't withdraw this offer.");
    await db.offer.update({ where: { id: offer.id }, data: { status: "withdrawn", respondedAt: new Date() } });
    await notify(offer.toUserId, { kind: "offer_declined", title: "Offer withdrawn", body: `The offer of ${formatPeso(Number(offer.amountPhp))} for ${offerSubject(offer)} was withdrawn.`, href: "/account/offers" });
    refresh();
    return { ok: true, message: "Offer withdrawn." };
  });
}

export async function counterOffer(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const viewer = await assertTier(3);
    const offer = await loadOffer(form);
    if (offer.toUserId !== viewer.userId || offer.status !== "pending") throw new UserError("You can't counter this offer.");
    const { sellerId } = sides(offer);
    if (viewer.userId === sellerId) await assertSeller();
    const amount = Amount.safeParse(form.get("amount"));
    if (!amount.success) return { ok: false, fieldErrors: { amount: "Enter your counter in pesos." } };
    const note = Message.parse(form.get("message"));
    checkNote(note);
    const value = Math.round(amount.data);
    if (value === Math.round(Number(offer.amountPhp))) throw new UserError("That's the same amount. Accept the offer instead.");
    await offerRate(viewer);

    const counter = await db.$transaction(async (tx) => {
      const claimed = await tx.offer.updateMany({ where: { id: offer.id, status: "pending" }, data: { status: "countered", respondedAt: new Date() } });
      if (claimed.count !== 1) throw new UserError("That offer was just answered.");
      return tx.offer.create({
        data: {
          listingId: offer.listingId,
          buyRequestId: offer.buyRequestId,
          fromUserId: viewer.userId,
          toUserId: offer.fromUserId,
          amountPhp: value,
          weightGrams: offer.weightGrams,
          message: note ?? null,
          counterOfId: offer.id,
          expiresAt: new Date(Date.now() + OFFER_HOURS * HOUR),
        },
      });
    });
    await notify(offer.fromUserId, {
      kind: "offer_received",
      title: "You have a counter-offer",
      body: `${formatPeso(value)} for ${offerSubject(offer)} (you offered ${formatPeso(Number(offer.amountPhp))}).`,
      href: "/account/offers",
      channels: ["email"],
    });
    await audit({ actorId: viewer.userId, action: "offer.countered", targetType: "offer", targetId: counter.id, meta: { of: offer.id, amountPhp: value } });
    refresh();
    return { ok: true, message: "Counter-offer sent." };
  });
}

/**
 * Accept: the listing is reserved (or the wanted post fulfilled), every other
 * pending offer on it is declined, a trade is opened at the agreed amount with
 * a snapshot of the item, and the two are put in one conversation with a note
 * from Luxx4less about the protected hold. All in one transaction.
 */
export async function acceptOffer(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const viewer = await assertTier(3);
    const offer = await loadOffer(form);
    if (offer.toUserId !== viewer.userId || offer.status !== "pending") throw new UserError("You can't accept this offer.");
    const { buyerId, sellerId } = sides(offer);
    if (viewer.userId === sellerId) await assertSeller();

    const code = await uniqueCode("TR", async (c) => Boolean(await db.trade.findUnique({ where: { code: c }, select: { id: true } })));
    const sellerProfile = await db.profile.findUnique({ where: { userId: sellerId }, select: { regionCode: true, cityCode: true } });
    const amount = Number(offer.amountPhp);

    const trade = await db.$transaction(async (tx) => {
      const claimed = await tx.offer.updateMany({ where: { id: offer.id, status: "pending", expiresAt: { gt: new Date() } }, data: { status: "accepted", respondedAt: new Date() } });
      if (claimed.count !== 1) throw new UserError("That offer was just answered or has expired.");

      let snapshot;
      if (offer.listing) {
        const locked = await tx.listing.updateMany({ where: { id: offer.listing.id, status: "active" }, data: { status: "reserved" } });
        if (locked.count !== 1) throw new UserError("This listing is no longer available.");
        await tx.offer.updateMany({ where: { listingId: offer.listing.id, status: "pending" }, data: { status: "declined", respondedAt: new Date() } });
        const l = offer.listing;
        snapshot = { category: l.category, metal: l.metal, karat: l.karat, goldType: l.goldType, form: l.form, weightGrams: l.weightGrams, regionCode: l.regionCode, cityCode: l.cityCode };
      } else {
        const r = offer.buyRequest!;
        const locked = await tx.buyRequest.updateMany({ where: { id: r.id, status: "open" }, data: { status: "fulfilled" } });
        if (locked.count !== 1) throw new UserError("This wanted post is no longer open.");
        await tx.offer.updateMany({ where: { buyRequestId: r.id, status: "pending" }, data: { status: "declined", respondedAt: new Date() } });
        snapshot = {
          category: r.category,
          metal: r.metal,
          karat: r.karat,
          goldType: r.goldType,
          form: r.form,
          weightGrams: offer.weightGrams ?? r.minGrams ?? 0,
          regionCode: sellerProfile?.regionCode ?? r.regionCode,
          cityCode: sellerProfile?.regionCode ? sellerProfile.cityCode : r.cityCode,
        };
      }
      const t = await tx.trade.create({
        data: { code, listingId: offer.listingId, buyRequestId: offer.buyRequestId, offerId: offer.id, buyerId, sellerId, amountPhp: amount, ...snapshot },
        select: { id: true, code: true },
      });
      const conversationId = await findOrCreateConversation({ a: buyerId, b: sellerId, listingId: offer.listingId, buyRequestId: offer.buyRequestId, tradeId: t.id }, tx);
      await systemMessage(
        conversationId,
        `Offer of ${formatPeso(amount)} accepted. Trade ${t.code} is open. The buyer pays into the protected hold on the trade page; the seller is paid only after the buyer confirms the item. Never pay outside Luxx4less.`,
        tx,
      );
      return t;
    });

    await audit({ actorId: viewer.userId, action: "offer.accepted", targetType: "trade", targetId: trade.id, meta: { offer: offer.id, code: trade.code, amountPhp: amount } });
    const href = `/account/trades/${trade.code}`;
    await notify(offer.fromUserId, { kind: "offer_accepted", title: `Offer accepted · ${trade.code}`, body: `${formatPeso(amount)} for ${offerSubject(offer)}. Next: ${offer.fromUserId === buyerId ? "pay into the protected hold" : "wait for the buyer's payment"}.`, href, channels: ["email"] });
    await notify(viewer.userId, { kind: "trade_update", title: `Trade ${trade.code} opened`, body: `You accepted ${formatPeso(amount)} for ${offerSubject(offer)}.`, href });
    refresh();
    return { ok: true, message: "Offer accepted. The trade is open.", href };
  });
}
