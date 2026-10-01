import "server-only";
import { ADMIN_ROLES, hasAnyRole, type Role } from "@/config/roles";
import { audit } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { notify, type NotifyInput } from "@/lib/server/notify";
import { OPEN_STATUSES, coveredInstallments, money, statusAfterPayment, statusLabel } from "@/lib/shop";

/** Staff who look after shop orders: told about new orders and receipts to check. */
export const ORDER_STAFF: readonly Role[] = ["support", "admin", "super_admin"];
export const SHOP_ADMINS = ADMIN_ROLES;

/** Tell every shop admin (owner included). A failed notice never fails the order. */
export async function notifyShopStaff(input: NotifyInput): Promise<void> {
  const staff = await db.user.findMany({ where: { role: { contains: "admin" }, banned: { not: true } }, select: { id: true, role: true } });
  for (const s of staff.filter((u) => hasAnyRole(u.role, SHOP_ADMINS))) {
    await notify(s.id, input).catch((err) => console.warn("[shop] staff notice failed", err));
  }
}

/** Put an order's pieces back on sale (each product exactly once per order). */
async function releaseStock(orderId: string): Promise<void> {
  const items = await db.shopOrderItem.findMany({ where: { orderId, productId: { not: null } }, select: { productId: true, quantity: true } });
  for (const i of items) {
    await db.product.updateMany({ where: { id: i.productId! }, data: { stock: { increment: i.quantity } } });
  }
}

/**
 * Cancel an order and release its pieces. Claimed with a conditional update,
 * so two clicks (or the sweep and a person at once) can't restock twice.
 * Returns false when the order had already moved on.
 */
export async function cancelShopOrder(orderId: string, reason: string, actorId: string | null): Promise<boolean> {
  const claimed = await db.shopOrder.updateMany({
    where: { id: orderId, status: { in: [...OPEN_STATUSES] } },
    data: { status: "cancelled", cancelReason: reason, cancelledAt: new Date(), payBy: null },
  });
  if (claimed.count !== 1) return false;
  await releaseStock(orderId);
  // Receipts still waiting for a check no longer apply.
  await db.shopPayment.updateMany({ where: { orderId, status: "submitted" }, data: { status: "rejected", reviewNote: "Order cancelled", reviewedAt: new Date() } });
  const o = await db.shopOrder.findUniqueOrThrow({ where: { id: orderId }, select: { code: true, buyerId: true, paidPhp: true } });
  await audit({ actorId, action: "shop.order.cancelled", targetType: "shop_order", targetId: orderId, meta: { code: o.code, reason, paidPhp: Number(o.paidPhp) } });
  const refund = Number(o.paidPhp) > 0 ? ` We'll return the ₱${Number(o.paidPhp).toLocaleString("en-PH")} you paid; staff will contact you about it.` : "";
  await notify(o.buyerId, { kind: "order_update", title: `Order cancelled · ${o.code}`, body: `${reason}${refund}`, href: `/account/orders/${o.code}`, channels: ["email"] });
  return true;
}

/**
 * Unpaid orders past their pay-by date are cancelled and their pieces go back
 * on sale. Lazy (run when shop pages load) and daily from the cron. Orders
 * with a receipt waiting for staff are left alone: the delay is ours.
 */
export async function sweepUnpaidOrders(): Promise<number> {
  const stale = await db.shopOrder.findMany({
    where: { status: "pending_payment", paidPhp: 0, payBy: { lt: new Date() }, payments: { none: { status: "submitted" } } },
    select: { id: true },
    take: 50,
  });
  let n = 0;
  for (const o of stale) {
    if (await cancelShopOrder(o.id, "Not paid in time, so the pieces went back on sale.", null)) n++;
  }
  return n;
}

/**
 * Work an order out again from its confirmed payments: amount paid, which
 * layaway instalments are covered, and the step it is on. Called after every
 * payment decision. Tells the buyer when the step changes.
 */
export async function recomputeShopOrder(orderId: string): Promise<{ from: string; to: string }> {
  const order = await db.shopOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: { payments: { select: { status: true, amountPhp: true } }, installments: { select: { seq: true, amountPhp: true, paidAt: true } } },
  });
  const paid = money(order.payments.filter((p) => p.status === "confirmed").reduce((s, p) => s + Number(p.amountPhp), 0));
  const hasSubmitted = order.payments.some((p) => p.status === "submitted");
  const to = statusAfterPayment(
    { status: order.status, plan: order.plan, paymentMethod: order.paymentMethod, totalPhp: Number(order.totalPhp), downPaymentPhp: order.downPaymentPhp === null ? null : Number(order.downPaymentPhp) },
    paid,
    hasSubmitted,
  );
  const fullyPaid = paid + 0.004 >= Number(order.totalPhp);
  await db.shopOrder.update({
    where: { id: orderId },
    data: { paidPhp: paid, status: to, paidAt: fullyPaid ? (order.paidAt ?? new Date()) : null, ...(paid > 0 ? { payBy: null } : {}) },
  });
  if (order.installments.length) {
    const covered = coveredInstallments(
      order.installments.map((i) => ({ seq: i.seq, amountPhp: Number(i.amountPhp) })),
      paid,
    );
    const now = new Date();
    for (const i of order.installments) {
      const isPaid = covered.has(i.seq);
      if (isPaid !== Boolean(i.paidAt)) {
        await db.shopInstallment.update({ where: { orderId_seq: { orderId, seq: i.seq } }, data: { paidAt: isPaid ? now : null } });
      }
    }
  }
  if (to !== order.status) {
    await notify(order.buyerId, {
      kind: "order_update",
      title: `${statusLabel(to, order.fulfilment)} · ${order.code}`,
      body:
        to === "preparing"
          ? "Paid in full, thank you. We're preparing your order."
          : to === "layaway"
            ? "Your down payment is in. The pieces are reserved for you until the layaway is paid."
            : to === "pending_payment"
              ? "We couldn't confirm your last payment. Open the order to see why."
              : "Your order was updated.",
      href: `/account/orders/${order.code}`,
      channels: ["email"],
    });
  }
  return { from: order.status, to };
}

/** Installment reminders (daily cron): due within three days and not reminded yet. */
export async function remindDueInstallments(): Promise<number> {
  const soon = new Date(Date.now() + 3 * 24 * 3600_000);
  const due = await db.shopInstallment.findMany({
    where: { paidAt: null, remindedAt: null, seq: { gt: 0 }, dueAt: { lte: soon }, order: { status: "layaway" } },
    include: { order: { select: { code: true, buyerId: true } } },
    take: 200,
  });
  for (const i of due) {
    await notify(i.order.buyerId, {
      kind: "order_update",
      title: `Layaway payment due · ${i.order.code}`,
      body: `Payment ${i.seq} of ₱${Number(i.amountPhp).toLocaleString("en-PH")} is due on ${i.dueAt.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", day: "numeric", month: "long" })}.`,
      href: `/account/orders/${i.order.code}`,
      channels: ["email"],
    });
    await db.shopInstallment.update({ where: { id: i.id }, data: { remindedAt: new Date() } });
  }
  return due.length;
}
