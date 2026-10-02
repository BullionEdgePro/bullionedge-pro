import "server-only";
import { cache } from "react";
import { feeFor, settleFees, type FeeRules } from "@/lib/fees";
import { formatPeso } from "@/lib/pricing";
import { audit } from "./audit";
import { db } from "./db";
import { UserError } from "./marketplace/context";
import { notify } from "./notify";

/**
 * Luxx4less marketplace fees (owner, 2 Oct 2026). Listing is free; when a
 * trade completes (the payment is released to the seller), the seller owes a
 * commission at the rate in /admin/fees. Sellers pay by GCash or bank with a
 * receipt that staff confirm. A fee left unpaid past its due date pauses that
 * seller's new selling until it is paid; trades already under way carry on.
 */

const DAY = 86_400_000;

export const getMarketSettings = cache(async () => db.marketSettings.upsert({ where: { id: "market" }, create: { id: "market" }, update: {} }));

export type MarketSettingsRow = Awaited<ReturnType<typeof getMarketSettings>>;

export function feeRulesOf(s: MarketSettingsRow): FeeRules {
  return { feePct: Number(s.feePct), feeMinPhp: s.feeMinPhp === null ? null : Number(s.feeMinPhp), feeMaxPhp: s.feeMaxPhp === null ? null : Number(s.feeMaxPhp) };
}

/**
 * Charge the fee on a completed trade, once. Called right after the payment is
 * released. A failure here never undoes the release: it is logged, and staff
 * can see the trade without a fee.
 */
export async function chargeTradeFee(tradeId: string): Promise<void> {
  const trade = await db.trade.findUnique({ where: { id: tradeId }, select: { id: true, code: true, sellerId: true, amountPhp: true, status: true, feePhp: true } });
  if (!trade || trade.status !== "released" || trade.feePhp !== null) return;
  const settings = await getMarketSettings();
  const rules = feeRulesOf(settings);
  const fee = feeFor(Number(trade.amountPhp), rules);
  const dueAt = new Date(Date.now() + settings.feePayDays * DAY);
  const claimed = await db.trade.updateMany({ where: { id: trade.id, feePhp: null }, data: { feePct: rules.feePct, feePhp: fee, feeDueAt: fee > 0 ? dueAt : null, feePaidAt: fee > 0 ? null : new Date() } });
  if (claimed.count !== 1 || fee <= 0) return;
  await audit({ actorId: null, action: "fee.charged", targetType: "trade", targetId: trade.id, meta: { code: trade.code, feePct: rules.feePct, feePhp: fee, amountPhp: Number(trade.amountPhp) } });
  // Credit from an earlier overpayment may already cover it.
  await recomputeSellerFees(trade.sellerId);
  await notify(trade.sellerId, {
    kind: "trade_update",
    title: `Luxx4less fee · ${trade.code}`,
    body: `Congratulations on the sale. The ${rules.feePct}% Luxx4less fee is ${formatPeso(fee, true)}, due by ${dueAt.toLocaleDateString("en-PH", { day: "numeric", month: "long", timeZone: "Asia/Manila" })}.`,
    href: "/account/fees",
    channels: ["email"],
  });
}

async function feeLines(sellerId: string) {
  return db.trade.findMany({
    where: { sellerId, status: "released", feePhp: { gt: 0 } },
    orderBy: { releasedAt: "asc" },
    select: { id: true, code: true, amountPhp: true, feePct: true, feePhp: true, feeDueAt: true, feePaidAt: true, feeWaivedAt: true, releasedAt: true, category: true, metal: true, karat: true, goldType: true, form: true, weightGrams: true },
  });
}

/** A seller's fees, payments and standing, worked out from the database. */
export async function sellerFees(sellerId: string, now = new Date()) {
  const [trades, payments] = await Promise.all([
    feeLines(sellerId),
    db.feePayment.findMany({ where: { sellerId }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const paidPhp = payments.filter((p) => p.status === "confirmed").reduce((s, p) => s + Number(p.amountPhp), 0);
  const settled = settleFees(
    trades.map((t) => ({ id: t.id, feePhp: Number(t.feePhp), releasedAt: t.releasedAt ?? t.feeDueAt ?? now, dueAt: t.feeDueAt ?? now, waived: Boolean(t.feeWaivedAt) })),
    paidPhp,
    now,
  );
  return { trades, payments, paidPhp, ...settled, checking: payments.some((p) => p.status === "submitted") };
}

/** Mark which fees are paid after a payment decision or a waiver (oldest first). */
export async function recomputeSellerFees(sellerId: string): Promise<void> {
  const f = await sellerFees(sellerId);
  const now = new Date();
  for (const t of f.trades) {
    const isPaid = f.paid.has(t.id) || Boolean(t.feeWaivedAt);
    if (isPaid !== Boolean(t.feePaidAt)) await db.trade.update({ where: { id: t.id }, data: { feePaidAt: isPaid ? now : null } });
  }
}

/**
 * The selling gate: new listings, renewals, offers and accepting an offer as
 * the seller all stop while a fee is past due. Shipping a trade already paid
 * for is never blocked (that would hurt the buyer).
 */
export async function assertNoOverdueFees(userId: string): Promise<void> {
  const f = await sellerFees(userId);
  if (f.overdue && !f.checking) {
    throw new UserError(`You have ${formatPeso(f.overduePhp, true)} in Luxx4less fees past their due date. Pay them in Account › Fees to keep selling.`);
  }
}

/** For pages: the same standing without throwing. */
export async function overdueFees(userId: string): Promise<{ overdue: boolean; overduePhp: number; checking: boolean }> {
  const f = await sellerFees(userId);
  return { overdue: f.overdue && !f.checking, overduePhp: f.overduePhp, checking: f.checking };
}

/** Daily cron: one reminder per fee once it is past due. */
export async function remindOverdueFees(): Promise<number> {
  const due = await db.trade.findMany({
    where: { status: "released", feePhp: { gt: 0 }, feePaidAt: null, feeWaivedAt: null, feeRemindedAt: null, feeDueAt: { lt: new Date() } },
    select: { id: true, code: true, sellerId: true, feePhp: true },
    take: 200,
  });
  for (const t of due) {
    await notify(t.sellerId, {
      kind: "trade_update",
      title: `Fee past due · ${t.code}`,
      body: `The Luxx4less fee of ${formatPeso(Number(t.feePhp), true)} is past its due date. New listings and offers are paused until it's paid.`,
      href: "/account/fees",
      channels: ["email"],
    });
    await db.trade.update({ where: { id: t.id }, data: { feeRemindedAt: new Date() } });
  }
  return due.length;
}
