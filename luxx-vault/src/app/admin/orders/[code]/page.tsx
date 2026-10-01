import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Phone } from "lucide-react";
import { MediaImage } from "@/components/marketplace/media-image";
import { LayawaySchedule, OrderItems, OrderTimeline, PaymentHistory, orderInclude } from "@/components/shop/order-parts";
import { AdvanceForm, RecordPaymentForm, ReviewPaymentForm, StaffCancelForm } from "@/components/shop/staff-order-forms";
import { Badge, TierBadge } from "@/components/ui/badge";
import { FormAlert } from "@/components/ui/field";
import { cityName, provinceName, regionShort } from "@/lib/locations";
import { formatPhMobile } from "@/lib/phone";
import { formatPeso } from "@/lib/pricing";
import { OPEN_STATUSES, ORDER_STATUSES, PAYMENT_METHODS, balanceOf, staffSteps, statusLabel, type OrderStatus } from "@/lib/shop";
import { db } from "@/lib/server/db";
import { mediaUrl } from "@/lib/server/media";
import { normaliseCode } from "@/lib/server/marketplace/codes";
import { COURIERS } from "@/lib/server/marketplace/trades";
import { ORDER_STAFF } from "@/lib/server/shop/orders";
import { requireRole } from "@/lib/server/session";
import { tierFor } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "Shop order" };

/** What the last action did, shown after the page reloads with the new state. */
const DONE: Record<string, string> = {
  confirmed: "Payment confirmed. The buyer was told.",
  rejected: "Receipt rejected. The buyer was told why.",
  recorded: "Payment recorded.",
  recorded_completed: "Payment recorded and the order is completed.",
  confirm_cod: "Order confirmed. The buyer was told.",
  mark_ready: "Marked ready. The buyer was told.",
  mark_shipped: "Marked shipped. The buyer has the tracking number.",
  complete: "Order completed. The buyer was told.",
  cancelled: "Order cancelled. The pieces went back on sale.",
  cancelled_refund: "Order cancelled and the pieces went back on sale. Remember to refund what the buyer paid.",
};

const dateTime = (d: Date) => d.toLocaleString("en-PH", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });

export default async function AdminOrderPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const code = normaliseCode(decodeURIComponent((await params).code), "OR");
  if (!code) notFound();
  await requireRole(ORDER_STAFF, `/admin/orders/${code}`);
  const order = await db.shopOrder.findUnique({
    where: { code },
    include: { ...orderInclude, buyer: { select: { id: true, name: true, email: true, emailVerified: true, createdAt: true } } },
  });
  if (!order) notFound();
  const done = DONE[(await searchParams).done ?? ""];
  const [tier, history] = await Promise.all([
    tierFor(order.buyer.id, order.buyer.emailVerified),
    db.shopOrder.groupBy({ by: ["status"], where: { buyerId: order.buyer.id }, _count: true }),
  ]);
  const balance = balanceOf({ totalPhp: Number(order.totalPhp), paidPhp: Number(order.paidPhp) });
  const open = (OPEN_STATUSES as readonly string[]).includes(order.status);
  const toCheck = order.payments.filter((p) => p.status === "submitted");
  const steps = staffSteps(order);
  const completedBefore = history.find((h) => h.status === "completed")?._count ?? 0;
  const cancelledBefore = history.find((h) => h.status === "cancelled")?._count ?? 0;

  return (
    <div className="grid gap-6">
      <div>
        <Link href="/admin/orders" className="text-sm text-muted hover:text-champagne">
          ← Shop orders
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl tracking-wide tabular">{order.code}</h1>
          <Badge tone={ORDER_STATUSES[order.status as OrderStatus]?.tone ?? "neutral"}>{statusLabel(order.status, order.fulfilment)}</Badge>
          {order.plan === "layaway" && <Badge tone="gold">Layaway</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted">
          {PAYMENT_METHODS[order.paymentMethod as keyof typeof PAYMENT_METHODS]?.label} · {order.fulfilment}
          {order.branch ? ` at ${order.branch}` : ""} · placed {dateTime(order.createdAt)}
          {order.payBy && open ? ` · hold ends ${dateTime(order.payBy)}` : ""}
        </p>
      </div>

      {done && <FormAlert tone="success">{done}</FormAlert>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid content-start gap-6">
          {toCheck.map((p) => (
            <section key={p.id} className="grid gap-4 rounded-2xl border border-ice/40 bg-ice-tint/40 p-5 sm:grid-cols-[10rem_minmax(0,1fr)]">
              {p.proofMediaId ? (
                <a href={mediaUrl(p.proofMediaId)} target="_blank" rel="noreferrer" className="block" title="Open the receipt full size">
                  <MediaImage src={mediaUrl(p.proofMediaId)} alt="Payment receipt" isPrivate sizes="160px" className="aspect-[3/4] rounded-xl border border-line" imgClassName="object-contain" />
                </a>
              ) : (
                <div />
              )}
              <div className="grid content-start gap-3">
                <h2 className="text-xl">Receipt to check</h2>
                <p className="text-sm text-muted tabular">
                  {formatPeso(Number(p.amountPhp), true)} · ref <strong className="text-fg">{p.reference}</strong> · sent {dateTime(p.createdAt)}
                </p>
                <p className="text-sm text-muted">Look for this amount and reference in the GCash or bank account before confirming. A screenshot alone proves nothing.</p>
                <ReviewPaymentForm paymentId={p.id} amount={Number(p.amountPhp)} />
              </div>
            </section>
          ))}

          {open && (steps.length > 0 || balance > 0) && (
            <section className="grid gap-5 rounded-2xl border border-champagne/40 bg-surface p-5 sm:p-6">
              <h2 className="text-xl">Next step</h2>
              {steps.map((s) => (
                <div key={s} className="grid gap-2">
                  {s === "complete" && order.paymentMethod === "cod" && balance > 0 && (
                    <p className="text-sm text-muted">Completing records {formatPeso(balance, true)} cash collected.</p>
                  )}
                  <AdvanceForm orderId={order.id} step={s} couriers={COURIERS} />
                </div>
              ))}
              {balance > 0 && (
                <details className="rounded-xl border border-line p-4" open={order.paymentMethod === "in_store" && steps.length === 0}>
                  <summary className="cursor-pointer text-sm font-semibold">Record a payment received ({formatPeso(balance, true)} owed)</summary>
                  <div className="mt-4">
                    <RecordPaymentForm orderId={order.id} balance={balance} pickup={order.fulfilment === "pickup"} defaultMethod={order.paymentMethod} />
                  </div>
                </details>
              )}
            </section>
          )}

          <OrderItems order={order} />
          <LayawaySchedule order={order} />
          <PaymentHistory order={order} staff />
          {open && <StaffCancelForm orderId={order.id} />}
        </div>

        <aside className="grid content-start gap-6">
          <section className="grid gap-2 rounded-2xl border border-line bg-surface p-5 text-sm">
            <h2 className="font-display text-sm tracking-[0.2em] text-champagne uppercase">Buyer</h2>
            <Link href={`/admin/customers/${order.buyer.id}`} className="font-semibold text-fg hover:text-champagne">
              {order.buyer.name}
            </Link>
            <p className="text-muted">{order.buyer.email}</p>
            <TierBadge tier={tier} className="w-fit" />
            <p className="text-xs text-muted">
              {completedBefore} completed · {cancelledBefore} cancelled orders
            </p>
            <div className="mt-2 grid gap-1.5 border-t border-line pt-3">
              <p className="font-semibold">{order.contactName}</p>
              <a href={`tel:${order.contactPhone}`} className="flex items-center gap-2 text-champagne tabular hover:underline">
                <Phone className="size-4" aria-hidden /> {formatPhMobile(order.contactPhone)}
              </a>
              {order.fulfilment === "delivery" && (
                <p className="flex gap-2 text-muted">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {[order.addressLine, cityName(order.cityCode), provinceName(order.provinceCode), regionShort(order.regionCode)].filter(Boolean).join(", ")}
                </p>
              )}
              {order.buyerNote && <p className="mt-1 rounded-lg bg-surface-sunk p-2 whitespace-pre-line text-muted">{order.buyerNote}</p>}
            </div>
          </section>
          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="mb-4 font-display text-sm tracking-[0.2em] text-champagne uppercase">Progress</h2>
            <OrderTimeline order={order} />
          </section>
        </aside>
      </div>
    </div>
  );
}
