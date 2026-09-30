import "server-only";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { notify } from "@/lib/server/notify";
import { paymentsFor } from "@/lib/server/payments";
import { systemMessage } from "./conversations";

export const AUTO_RELEASE_DAYS = 7;
export const OFFER_HOURS = 48;

export const TRADE_STEPS = [
  { status: "awaiting_payment", label: "Awaiting payment" },
  { status: "payment_held", label: "Payment held" },
  { status: "shipped", label: "Shipped or meet-up set" },
  { status: "received", label: "Received" },
  { status: "released", label: "Released to seller" },
] as const;

export const TRADE_STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Awaiting payment",
  payment_held: "Payment held",
  shipped: "On its way",
  received: "Received",
  released: "Completed",
  disputed: "In dispute",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

export const COURIERS = ["LBC", "J&T Express", "Lalamove", "Grab Express", "2GO", "Ninja Van", "Flash Express", "Other courier"] as const;
export const DISPUTE_REASONS = [
  { value: "not_received", label: "The item never arrived" },
  { value: "not_as_described", label: "Not as described (weight, karat, condition)" },
  { value: "fake", label: "I believe it is not genuine" },
  { value: "damaged", label: "It arrived damaged" },
  { value: "seller_unresponsive", label: "The other side stopped responding" },
  { value: "other", label: "Something else" },
] as const;

export const IN_PROGRESS = ["awaiting_payment", "payment_held", "shipped", "received", "disputed"] as const;

/**
 * Release the held payment to the seller: provider payout, trade and listing
 * closed, audit entry, both sides told. Used by the buyer's confirmation, the
 * seven-day auto-release and a dispute decided for the seller.
 */
export async function releaseTrade(tradeId: string, actorId: string | null, reason: "buyer_confirmed" | "auto_release" | "dispute_seller") {
  const trade = await db.trade.findUnique({ where: { id: tradeId }, include: { conversation: { select: { id: true } } } });
  if (!trade || trade.status === "released") return;
  if (!trade.paymentRef) throw new Error("This trade has no held payment to release.");
  // Claim the transition first so a double click or two tabs can't pay out twice.
  const claimed = await db.trade.updateMany({
    where: { id: tradeId, status: { in: reason === "dispute_seller" ? ["disputed"] : ["shipped", "received"] } },
    data: { status: "released", releasedAt: new Date(), autoReleaseAt: null },
  });
  if (claimed.count !== 1) return;
  try {
    await paymentsFor(trade.paymentProvider).release(trade.paymentRef, Number(trade.amountPhp));
  } catch (err) {
    // The provider refused: put the trade back exactly as it was so it can be retried.
    await db.trade.update({ where: { id: tradeId }, data: { status: trade.status, releasedAt: null, autoReleaseAt: trade.autoReleaseAt } });
    throw err;
  }
  if (trade.listingId) await db.listing.update({ where: { id: trade.listingId }, data: { status: "sold" } });
  await audit({ actorId, action: "trade.released", targetType: "trade", targetId: trade.id, meta: { code: trade.code, reason, amountPhp: Number(trade.amountPhp), provider: trade.paymentProvider } });
  const line =
    reason === "auto_release"
      ? "Payment released to the seller automatically, seven days after shipping with no dispute opened."
      : reason === "dispute_seller"
        ? "Luxx4less decided the dispute for the seller. The held payment was released."
        : "The buyer confirmed the item arrived as described. Payment released to the seller.";
  if (trade.conversation) await systemMessage(trade.conversation.id, line);
  const href = `/account/trades/${trade.code}`;
  await notify(trade.sellerId, { kind: "trade_update", title: `Payment released · ${trade.code}`, body: line, href, channels: ["email"] });
  await notify(trade.buyerId, { kind: "trade_update", title: `Trade complete · ${trade.code}`, body: "You can now leave a review for the seller.", href });
}

/**
 * Lazy auto-release (no cron): shipped trades past their release date, with
 * no open dispute, are released the next time either side looks at trades.
 */
export async function settleDueTrades(userId?: string) {
  const due = await db.trade.findMany({
    where: {
      status: "shipped",
      autoReleaseAt: { lt: new Date() },
      disputes: { none: { status: "open" } },
      ...(userId ? { OR: [{ buyerId: userId }, { sellerId: userId }] } : {}),
    },
    select: { id: true },
    take: 50,
  });
  for (const t of due) {
    try {
      await releaseTrade(t.id, null, "auto_release");
    } catch (err) {
      console.error("[auto-release]", t.id, err);
    }
  }
}

/** Put the item back on the market after a trade that didn't go ahead. */
export async function reopenAfterTrade(trade: { listingId: string | null; buyRequestId: string | null }, listingStatus: "active" | "expired") {
  if (trade.listingId) {
    await db.listing.updateMany({ where: { id: trade.listingId, status: "reserved" }, data: { status: listingStatus } });
  }
  if (trade.buyRequestId) {
    await db.buyRequest.updateMany({ where: { id: trade.buyRequestId, status: "fulfilled" }, data: { status: "open" } });
  }
}

/** Staff who handle disputes and reports get an in-app note (never customers' data by email). */
export async function notifyStaff(title: string, body: string, href: string) {
  const staff = await db.user.findMany({
    where: { OR: [{ role: { contains: "support" } }, { role: { contains: "admin" } }] },
    select: { id: true },
    take: 25,
  });
  await Promise.all(staff.map((s) => notify(s.id, { kind: "trade_update", title, body, href })));
}
