"use server";

import { requireFaceForAction } from "@/lib/server/face/gate";
import { purposeForAmount } from "@/lib/face-policy";
import { refresh } from "next/cache";
import { z } from "zod";
import { brand } from "@/config/brand";
import { audit } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { notify } from "@/lib/server/notify";
import { payments } from "@/lib/server/payments";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { assertTier } from "@/lib/server/viewer";
import { formatPeso } from "@/lib/pricing";
import { systemMessage } from "../conversations";
import { assertSeller, runAction, UserError, type ActionState } from "../context";
import { AUTO_RELEASE_DAYS, COURIERS, DISPUTE_REASONS, notifyStaff, releaseTrade, reopenAfterTrade } from "../trades";

const Code = z.string().regex(/^TR-[A-Z0-9]{5}$/);
const DAY = 86_400_000;



async function loadTrade(form: FormData) {
  const viewer = await assertTier(3);
  const code = Code.parse(form.get("code"));
  const trade = await db.trade.findUnique({ where: { code }, include: { conversation: { select: { id: true } } } });
  if (!trade || (trade.buyerId !== viewer.userId && trade.sellerId !== viewer.userId)) throw new UserError("That trade isn't yours.");
  const role = trade.buyerId === viewer.userId ? ("buyer" as const) : ("seller" as const);
  const other = role === "buyer" ? trade.sellerId : trade.buyerId;
  return { viewer, trade, role, other, href: `/account/trades/${trade.code}` };
}

/** Buyer pays into the protected hold (mock provider today: no money moves). */
export async function payIntoHold(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const { viewer, trade, role, href } = await loadTrade(form);
    if (role !== "buyer") throw new UserError("Only the buyer pays into the hold.");
    if (trade.status !== "awaiting_payment") throw new UserError("This trade isn't waiting for payment.");
    await requireFaceForAction(purposeForAmount(Number(trade.amountPhp)));
    const provider = payments();
    const hold = await provider.createHold({ tradeId: trade.id, tradeCode: trade.code, amountPhp: Number(trade.amountPhp), buyerId: trade.buyerId, sellerId: trade.sellerId });
    if (hold.status === "redirect") {
      // Real providers: store the reference and send the buyer to pay; the webhook marks the hold.
      await db.trade.update({ where: { id: trade.id }, data: { paymentRef: hold.ref, paymentProvider: provider.id } });
      return { ok: true, href: hold.checkoutUrl };
    }
    const claimed = await db.trade.updateMany({
      where: { id: trade.id, status: "awaiting_payment" },
      data: { status: "payment_held", paymentRef: hold.ref, paymentProvider: provider.id },
    });
    if (claimed.count !== 1) throw new UserError("This trade was just updated. Please refresh.");
    await audit({ actorId: viewer.userId, action: "trade.payment_held", targetType: "trade", targetId: trade.id, meta: { code: trade.code, amountPhp: Number(trade.amountPhp), provider: provider.id, testMode: provider.testMode } });
    if (trade.conversation) await systemMessage(trade.conversation.id, `${formatPeso(Number(trade.amountPhp))} is now in the protected hold. Seller: ship with tracking, or arrange a meet-up, on the trade page.`);
    await notify(trade.sellerId, { kind: "trade_update", title: `Payment held · ${trade.code}`, body: "The buyer's payment is in the protected hold. Please ship or arrange the meet-up.", href, channels: ["email"] });
    refresh();
    return { ok: true, message: provider.testMode ? "Test payment held. No real money moved." : "Payment held." };
  });
}

const ShipSchema = z.discriminatedUnion("fulfilment", [
  z.object({ fulfilment: z.literal("shipping"), courier: z.enum(COURIERS, "Choose the courier."), trackingNumber: z.string().trim().min(5, "Enter the tracking number.").max(40) }),
  z.object({ fulfilment: z.literal("meetup"), courier: z.any().optional(), trackingNumber: z.any().optional() }),
  z.object({ fulfilment: z.literal("luxx_meetup"), courier: z.any().optional(), trackingNumber: z.any().optional() }),
]);

/** Seller ships with tracking, or sets a meet-up (optionally at the Luxx4less Antipolo branch for in-person testing). */
export async function markShipped(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const { viewer, trade, role, href } = await loadTrade(form);
    if (role !== "seller") throw new UserError("Only the seller can mark the item as sent.");
    await assertSeller();
    await requireFaceForAction("session");
    if (trade.status !== "payment_held") throw new UserError("Ship only after the payment is held.");
    const parsed = ShipSchema.safeParse({ fulfilment: form.get("fulfilment"), courier: form.get("courier"), trackingNumber: form.get("trackingNumber") });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
      return { ok: false, fieldErrors };
    }
    const d = parsed.data;
    const autoReleaseAt = new Date(Date.now() + AUTO_RELEASE_DAYS * DAY);
    const claimed = await db.trade.updateMany({
      where: { id: trade.id, status: "payment_held" },
      data: {
        status: "shipped",
        fulfilment: d.fulfilment,
        courier: d.fulfilment === "shipping" ? d.courier : null,
        trackingNumber: d.fulfilment === "shipping" ? d.trackingNumber : null,
        autoReleaseAt,
      },
    });
    if (claimed.count !== 1) throw new UserError("This trade was just updated. Please refresh.");
    const antipolo = brand.branches.find((b) => b.main);
    const line =
      d.fulfilment === "shipping"
        ? `Sent with ${d.courier}, tracking ${d.trackingNumber}.`
        : d.fulfilment === "luxx_meetup"
          ? `Meet-up at Luxx4less ${antipolo?.name ?? "Antipolo"} for in-person testing. Agree the time here in the chat.`
          : "Meet-up chosen. Pick a busy public place, such as a mall help desk or a bank lobby, and agree the time here in the chat.";
    await audit({ actorId: viewer.userId, action: "trade.shipped", targetType: "trade", targetId: trade.id, meta: { code: trade.code, fulfilment: d.fulfilment } });
    if (trade.conversation) await systemMessage(trade.conversation.id, `${line} The payment is released when the buyer confirms, or automatically in ${AUTO_RELEASE_DAYS} days if no dispute is opened.`);
    await notify(trade.buyerId, { kind: "trade_update", title: `On its way · ${trade.code}`, body: line, href, channels: ["email"] });
    refresh();
    return { ok: true, message: "Marked as sent." };
  });
}

/** Buyer confirms the item arrived and matches the listing → payment released. */
export async function confirmReceived(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const { viewer, trade, role } = await loadTrade(form);
    if (role !== "buyer") throw new UserError("Only the buyer can confirm receipt.");
    if (trade.status !== "shipped") throw new UserError("Confirm only once the item has been sent.");
    // Confirming releases the money to the seller.
    await requireFaceForAction("session");
    if (form.get("confirm") !== "on") return { ok: false, fieldErrors: { confirm: "Please tick the box to confirm." } };
    await releaseTrade(trade.id, viewer.userId, "buyer_confirmed");
    refresh();
    return { ok: true, message: "Thank you. The payment was released to the seller." };
  });
}

/** Either side can call off a trade before any payment is held. */
export async function cancelTrade(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const { viewer, trade, other, href } = await loadTrade(form);
    if (trade.status !== "awaiting_payment") throw new UserError("A trade can be cancelled only before payment. After that, open a dispute.");
    const claimed = await db.trade.updateMany({ where: { id: trade.id, status: "awaiting_payment" }, data: { status: "cancelled" } });
    if (claimed.count !== 1) throw new UserError("This trade was just updated. Please refresh.");
    await reopenAfterTrade(trade, "active");
    await audit({ actorId: viewer.userId, action: "trade.cancelled", targetType: "trade", targetId: trade.id, meta: { code: trade.code } });
    if (trade.conversation) await systemMessage(trade.conversation.id, "The trade was cancelled before payment. Nothing was charged.");
    await notify(other, { kind: "trade_update", title: `Trade cancelled · ${trade.code}`, body: "The other side cancelled before payment. Nothing was charged.", href });
    refresh();
    return { ok: true, message: "Trade cancelled." };
  });
}

const DisputeSchema = z.object({
  reason: z.enum(DISPUTE_REASONS.map((r) => r.value) as [string, ...string[]], "Choose a reason."),
  details: z.string().trim().min(20, "Describe what happened in at least 20 characters.").max(3000),
  evidence: z.array(z.string().regex(/^[a-z0-9]{20,32}$/i)).max(6, "Up to 6 photos."),
});

/** Open a dispute while the payment is held: the release stops until staff decide. */
export async function openDispute(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const { viewer, trade, other, href } = await loadTrade(form);
    if (!["payment_held", "shipped", "received"].includes(trade.status)) throw new UserError("A dispute can be opened while the payment is held, before release.");
    let evidence: unknown = [];
    try {
      evidence = JSON.parse(String(form.get("evidence") ?? "[]"));
    } catch {
      evidence = [];
    }
    const parsed = DisputeSchema.safeParse({ reason: form.get("reason"), details: form.get("details"), evidence });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
      return { ok: false, fieldErrors };
    }
    const d = parsed.data;
    if (d.evidence.length) {
      const owned = await db.mediaObject.count({ where: { id: { in: d.evidence }, ownerId: viewer.userId, purpose: "dispute_evidence" } });
      if (owned !== new Set(d.evidence).size) throw new UserError("One of the photos couldn't be attached. Please upload it again.");
    }
    await assertRateLimit(`dispute:${viewer.userId}`, 5, DAY);
    const dispute = await db.$transaction(async (tx) => {
      const claimed = await tx.trade.updateMany({ where: { id: trade.id, status: { in: ["payment_held", "shipped", "received"] } }, data: { status: "disputed", autoReleaseAt: null } });
      if (claimed.count !== 1) throw new UserError("This trade was just updated. Please refresh.");
      return tx.dispute.create({ data: { tradeId: trade.id, openedById: viewer.userId, reason: d.reason, details: d.details, evidenceMediaIds: [...new Set(d.evidence)] } });
    });
    await audit({ actorId: viewer.userId, action: "dispute.opened", targetType: "dispute", targetId: dispute.id, meta: { trade: trade.code, reason: d.reason, statusBefore: trade.status } });
    if (trade.conversation) await systemMessage(trade.conversation.id, "A dispute was opened. The payment stays in the hold until Luxx4less staff review both sides. Please keep all discussion here.");
    await notify(other, { kind: "trade_update", title: `Dispute opened · ${trade.code}`, body: "The payment is paused while Luxx4less reviews. You can add your side in the chat.", href, channels: ["email"] });
    await notifyStaff(`New dispute · ${trade.code}`, DISPUTE_REASONS.find((r) => r.value === d.reason)?.label ?? d.reason, "/admin/disputes");
    refresh();
    return { ok: true, message: "Dispute opened. Our team will review it and contact you both here." };
  });
}

const ReviewSchema = z.object({
  rating: z.preprocess((v) => Number(v), z.number().int().min(1, "Choose 1 to 5 stars.").max(5)),
  body: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined), z.string().max(1000).optional()),
});

/** After release, each side rates the other once. */
export async function leaveReview(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const { viewer, trade, other, role } = await loadTrade(form);
    if (trade.status !== "released") throw new UserError("Reviews open once the trade is complete.");
    const parsed = ReviewSchema.safeParse({ rating: form.get("rating"), body: form.get("body") });
    if (!parsed.success) return { ok: false, fieldErrors: { rating: parsed.error.issues[0]?.message ?? "Choose a rating." } };
    const exists = await db.review.findUnique({ where: { tradeId_authorId: { tradeId: trade.id, authorId: viewer.userId } } });
    if (exists) throw new UserError("You've already reviewed this trade.");
    await db.review.create({ data: { tradeId: trade.id, authorId: viewer.userId, subjectId: other, rating: parsed.data.rating, body: parsed.data.body ?? null } });
    await notify(other, { kind: "review", title: `New ${parsed.data.rating}-star review`, body: `The ${role} of ${trade.code} left you a review.`, href: "/account/trades" });
    refresh();
    return { ok: true, message: "Thank you for your review." };
  });
}

/** Keep a completed trade off the public trade tape (either side; cannot be undone by the other). */
export async function hideFromTape(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const { viewer, trade } = await loadTrade(form);
    await db.trade.update({ where: { id: trade.id }, data: { hideFromTape: true } });
    await audit({ actorId: viewer.userId, action: "trade.hidden_from_tape", targetType: "trade", targetId: trade.id });
    refresh();
    return { ok: true, message: "This trade won't appear on the trade tape." };
  });
}
