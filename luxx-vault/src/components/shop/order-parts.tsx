import { TradeTimeline } from "@/components/marketplace/trade-timeline";
import { MediaImage } from "@/components/marketplace/media-image";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { formatPeso } from "@/lib/pricing";
import { PAYMENT_METHODS, coveredInstallments, type PaymentMethod } from "@/lib/shop";
import { mediaUrl } from "@/lib/server/media";
import type { Prisma } from "@/generated/prisma/client";

/** The order with everything its pages show. */
export const orderInclude = {
  items: true,
  payments: { orderBy: { createdAt: "asc" } },
  installments: { orderBy: { seq: "asc" } },
} satisfies Prisma.ShopOrderInclude;
export type FullOrder = Prisma.ShopOrderGetPayload<{ include: typeof orderInclude }>;

const when = (d: Date) => d.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Manila" });

/** The order's path as a gold thread: placed, paid (or confirmed), handed over, done. */
export function OrderTimeline({ order }: { order: FullOrder }) {
  const cod = order.paymentMethod === "cod";
  const handover = order.fulfilment === "delivery" ? "On the way" : order.fulfilment === "meetup" ? "Ready for meet-up" : `Ready for pickup${order.branch ? ` at ${order.branch}` : ""}`;
  const steps = cod
    ? [
        { key: "placed", label: "Order placed", at: order.createdAt },
        { key: "confirmed", label: "Confirmed by phone" },
        { key: "handover", label: handover, detail: order.trackingNumber ? `${order.courier} · ${order.trackingNumber}` : null },
        { key: "done", label: "Paid and received", at: order.completedAt },
      ]
    : [
        { key: "placed", label: "Order placed", at: order.createdAt },
        ...(order.plan === "layaway" ? [{ key: "down", label: "Down payment in", detail: order.downPaymentPhp ? formatPeso(Number(order.downPaymentPhp)) : null }] : []),
        { key: "paid", label: "Paid in full", at: order.paidAt },
        { key: "handover", label: handover, detail: order.trackingNumber ? `${order.courier} · ${order.trackingNumber}` : null },
        { key: "done", label: "Completed", at: order.completedAt },
      ];
  const rank: Record<string, number> = cod
    ? { awaiting_confirmation: 1, preparing: 2, ready: 3, shipped: 3, completed: 4 }
    : order.plan === "layaway"
      ? { pending_payment: 1, payment_review: Number(order.paidPhp) > 0 ? 2 : 1, layaway: 2, preparing: 3, ready: 4, shipped: 4, completed: 5 }
      : { pending_payment: 1, payment_review: 1, preparing: 2, ready: 3, shipped: 3, completed: 4 };
  return (
    <TradeTimeline
      status={order.status}
      steps={steps}
      doneCount={rank[order.status] ?? 0}
      endNote={order.status === "cancelled" ? { label: "Cancelled", detail: order.cancelReason } : undefined}
    />
  );
}

export function OrderItems({ order }: { order: FullOrder }) {
  return (
    <section aria-labelledby="items-title" className="grid gap-4 rounded-2xl border border-line bg-surface p-5">
      <h2 id="items-title" className="font-display text-sm tracking-[0.2em] text-champagne uppercase">
        Pieces
      </h2>
      <ul className="grid gap-3">
        {order.items.map((i) => (
          <li key={i.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 text-sm">
            <MediaImage src={i.coverMediaId ? mediaUrl(i.coverMediaId) : null} alt={i.title} sizes="56px" className="aspect-square rounded-lg" />
            <span className="min-w-0">
              <span className="line-clamp-2 font-semibold">{i.title}</span>
              <span className="text-xs text-muted tabular">
                {i.code} · {Number(i.weightGrams)} g{i.karat ? ` · ${i.karat}K` : ""}
                {i.quantity > 1 ? ` · ${i.quantity} × ${formatPeso(Number(i.unitPricePhp))}` : ""}
              </span>
            </span>
            <span className="font-semibold tabular">{formatPeso(Number(i.unitPricePhp) * i.quantity)}</span>
          </li>
        ))}
      </ul>
      <dl className="grid gap-1.5 border-t border-line pt-3 text-sm tabular">
        <div className="flex justify-between">
          <dt className="text-muted">Subtotal</dt>
          <dd>{formatPeso(Number(order.subtotalPhp), true)}</dd>
        </div>
        {order.fulfilment === "delivery" && (
          <div className="flex justify-between">
            <dt className="text-muted">Delivery</dt>
            <dd>{Number(order.deliveryFeePhp) > 0 ? formatPeso(Number(order.deliveryFeePhp), true) : "—"}</dd>
          </div>
        )}
        <div className="flex justify-between font-semibold">
          <dt>Total</dt>
          <dd className="text-gold">{formatPeso(Number(order.totalPhp), true)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Paid</dt>
          <dd>{formatPeso(Number(order.paidPhp), true)}</dd>
        </div>
        <div className="flex justify-between font-semibold">
          <dt>Still to pay</dt>
          <dd>{formatPeso(Math.max(0, Number(order.totalPhp) - Number(order.paidPhp)), true)}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted">Prices were locked when the order was placed on {when(order.createdAt)}.</p>
    </section>
  );
}

export function LayawaySchedule({ order }: { order: FullOrder }) {
  if (!order.installments.length) return null;
  const covered = coveredInstallments(
    order.installments.map((i) => ({ seq: i.seq, amountPhp: Number(i.amountPhp) })),
    Number(order.paidPhp),
  );
  const now = new Date();
  return (
    <section aria-labelledby="layaway-title" className="grid gap-3 rounded-2xl border border-champagne/25 bg-surface p-5">
      <h2 id="layaway-title" className="font-display text-sm tracking-[0.2em] text-champagne uppercase">
        Layaway schedule
      </h2>
      <ol className="grid gap-2 text-sm tabular">
        {order.installments.map((i) => {
          const paid = covered.has(i.seq);
          const late = !paid && i.dueAt < now && order.status !== "cancelled";
          return (
            <li key={i.seq} className="flex items-center justify-between gap-3">
              <span className={cn(paid ? "text-muted line-through decoration-champagne/50" : "text-fg")}>
                {i.seq === 0 ? "Down payment" : `Payment ${i.seq}`} · {when(i.dueAt)}
              </span>
              <span className="flex items-center gap-2">
                {paid ? <Badge tone="success">Paid</Badge> : late ? <Badge tone="danger">Overdue</Badge> : null}
                <span className="font-semibold">{formatPeso(Number(i.amountPhp))}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function PaymentHistory({ order, staff = false }: { order: FullOrder; staff?: boolean }) {
  if (!order.payments.length) return null;
  const label = (m: string) => (m === "cod" ? "Cash on delivery" : (PAYMENT_METHODS[m as PaymentMethod]?.label ?? m));
  return (
    <section aria-labelledby="payments-title" className="grid gap-3 rounded-2xl border border-line bg-surface p-5">
      <h2 id="payments-title" className="font-display text-sm tracking-[0.2em] text-champagne uppercase">
        Payments
      </h2>
      <ul className="grid gap-3 text-sm">
        {order.payments.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3 last:border-0 last:pb-0">
            <span className="min-w-0">
              <span className="font-semibold tabular">{formatPeso(Number(p.amountPhp), true)}</span>
              <span className="text-muted">
                {" "}
                · {label(p.method)} · {when(p.createdAt)}
                {p.reference ? ` · ref ${p.reference}` : ""}
              </span>
              {p.status === "rejected" && p.reviewNote && <span className="block text-xs text-danger">{p.reviewNote}</span>}
              {staff && p.status === "confirmed" && p.reviewNote && <span className="block text-xs text-muted">{p.reviewNote}</span>}
            </span>
            <Badge tone={p.status === "confirmed" ? "success" : p.status === "rejected" ? "danger" : "ice"}>{p.status === "submitted" ? "Being checked" : p.status === "confirmed" ? "Confirmed" : "Not accepted"}</Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}
