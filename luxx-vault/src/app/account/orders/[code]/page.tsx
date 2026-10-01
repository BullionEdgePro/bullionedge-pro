import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Lock, MapPin, Phone, ShieldAlert, Store, Truck } from "lucide-react";
import { InlineAction } from "@/components/marketplace/inline-action";
import { LayawaySchedule, OrderItems, OrderTimeline, PaymentHistory, orderInclude } from "@/components/shop/order-parts";
import { ReceiptForm } from "@/components/shop/order-forms";
import { Badge } from "@/components/ui/badge";
import { FormAlert } from "@/components/ui/field";
import { cityName, provinceName, regionShort } from "@/lib/locations";
import { formatPhMobile } from "@/lib/phone";
import { formatPeso } from "@/lib/pricing";
import { ORDER_STATUSES, PAYMENT_METHODS, buyerCanCancel, nextAmountDue, statusLabel, type OrderStatus } from "@/lib/shop";
import { db } from "@/lib/server/db";
import { normaliseCode } from "@/lib/server/marketplace/codes";
import { cancelMyOrder } from "@/lib/server/shop/actions";
import { sweepUnpaidOrders } from "@/lib/server/shop/orders";
import { getShopSettings, pickupBranches } from "@/lib/server/shop/settings";
import { requireViewer } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "Order", robots: { index: false } };

type Props = { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | undefined>> };

const dateTime = (d: Date) => d.toLocaleString("en-PH", { weekday: "short", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });

export default async function OrderPage({ params, searchParams }: Props) {
  const code = normaliseCode(decodeURIComponent((await params).code), "OR");
  if (!code) notFound();
  const viewer = await requireViewer(`/account/orders/${code}`);
  await sweepUnpaidOrders();
  const sp = await searchParams;
  const order = await db.shopOrder.findUnique({ where: { code }, include: orderInclude });
  // Someone else's order looks exactly like one that doesn't exist.
  if (!order || order.buyerId !== viewer.userId) notFound();
  const settings = await getShopSettings();

  const total = Number(order.totalPhp);
  const due = nextAmountDue(
    { plan: order.plan, totalPhp: total, paidPhp: Number(order.paidPhp), downPaymentPhp: order.downPaymentPhp === null ? null : Number(order.downPaymentPhp) },
    order.installments.map((i) => ({ seq: i.seq, amountPhp: Number(i.amountPhp) })),
  );
  const submitted = order.payments.some((p) => p.status === "submitted");
  const awaitingMoney = ["pending_payment", "layaway", "payment_review"].includes(order.status) && due > 0;
  const canTransfer = awaitingMoney && (order.paymentMethod === "transfer" || order.plan === "layaway") && Boolean(settings.paymentInstructions?.trim());
  const branch = pickupBranches().find((b) => b.name === order.branch);
  const tone = ORDER_STATUSES[order.status as OrderStatus]?.tone ?? "neutral";

  return (
    <div className="grid gap-6">
      <div>
        <Link href="/account/orders" className="text-sm text-muted hover:text-champagne">
          ← All orders
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl tracking-wide tabular">{order.code}</h1>
          <Badge tone={tone}>{statusLabel(order.status, order.fulfilment)}</Badge>
          {order.plan === "layaway" && <Badge tone="gold">Layaway</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted">
          {PAYMENT_METHODS[order.paymentMethod as keyof typeof PAYMENT_METHODS]?.label} · placed {dateTime(order.createdAt)}
        </p>
      </div>

      {sp.cancelled && order.status === "cancelled" && <FormAlert tone="success">Order cancelled. The pieces went back on sale.</FormAlert>}

      {sp.placed && (
        <FormAlert tone="success">
          {order.paymentMethod === "cod"
            ? "Order placed. We'll call you to confirm before sending it."
            : order.paymentMethod === "in_store"
              ? `Order placed. The pieces are reserved for you${order.payBy ? ` until ${dateTime(order.payBy)}` : ""}.`
              : "Order placed. Pay using the details below, then upload your receipt here."}
        </FormAlert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid content-start gap-6">
          {/* ------------------------------------------- what to do now */}
          {order.status === "pending_payment" && order.paymentMethod === "in_store" && order.plan === "full" && (
            <Panel icon={<Store className="size-5" aria-hidden />} title={`Pay ${formatPeso(due, true)} when you pick it up`}>
              <p>
                At <strong className="text-fg">{order.branch}</strong>
                {branch ? `, ${branch.address}` : ""}. Bring a valid ID and your order number <strong className="text-fg tabular">{order.code}</strong>.
              </p>
              {order.payBy && (
                <p className="flex items-center gap-2 text-warning">
                  <Clock className="size-4" aria-hidden /> Reserved until {dateTime(order.payBy)}. After that the pieces go back on sale.
                </p>
              )}
            </Panel>
          )}

          {order.status === "awaiting_confirmation" && (
            <Panel icon={<Phone className="size-5" aria-hidden />} title="We'll call to confirm">
              <p>
                Expect a call or text at <strong className="text-fg tabular">{formatPhMobile(order.contactPhone)}</strong> from Luxx4less. Once confirmed, we prepare your order and you pay{" "}
                {formatPeso(total, true)} in cash when it reaches you.
              </p>
            </Panel>
          )}

          {awaitingMoney && order.paymentMethod === "in_store" && order.plan === "layaway" && (
            <Panel icon={<Store className="size-5" aria-hidden />} title={`Next payment: ${formatPeso(due, true)}`}>
              <p>
                Pay at <strong className="text-fg">{order.branch}</strong>
                {canTransfer ? ", or by GCash or bank transfer using the details below" : ""}. Mention order <strong className="text-fg tabular">{order.code}</strong>.
              </p>
              {order.payBy && <p className="text-warning">Pay the down payment by {dateTime(order.payBy)} to keep the reservation.</p>}
            </Panel>
          )}

          {canTransfer && (
            <section aria-labelledby="pay-title" className="grid gap-4 rounded-2xl border border-champagne/40 bg-[linear-gradient(150deg,rgb(214_178_110/0.10),transparent_60%)] p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="pay-title" className="text-xl">
                  Send {formatPeso(due, true)}
                </h2>
                {order.payBy && Number(order.paidPhp) === 0 && <p className="text-sm text-warning">by {dateTime(order.payBy)}</p>}
              </div>
              <div className="rounded-xl border border-line bg-velvet/60 p-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-champagne uppercase">
                  <Lock className="size-3.5" aria-hidden /> Luxx4less payment details
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-line text-fg">{settings.paymentInstructions}</p>
                <p className="mt-3 text-xs text-muted">
                  Put <strong className="text-fg tabular">{order.code}</strong> in the message or note of the transfer.
                </p>
              </div>
              <p className="flex gap-2 rounded-xl bg-danger-tint p-3 text-sm text-fg/90">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                Only pay to the details on this page. Luxx4less never sends different account details by chat, text or Messenger. If someone does, it isn&rsquo;t us.
              </p>
              {submitted ? (
                <p className="text-sm text-muted">We&rsquo;re checking your receipt. You can send another one for a further payment.</p>
              ) : null}
              <ReceiptForm code={order.code} amountDue={due} />
            </section>
          )}

          {awaitingMoney && order.paymentMethod === "transfer" && !settings.paymentInstructions?.trim() && (
            <Panel icon={<Clock className="size-5" aria-hidden />} title="Payment details coming">
              <p>We&rsquo;ll message you with how to pay. Your pieces stay reserved meanwhile.</p>
            </Panel>
          )}

          {order.status === "ready" && (
            <Panel icon={<Store className="size-5" aria-hidden />} title={order.fulfilment === "meetup" ? "Ready for meet-up" : "Ready for pickup"}>
              <p>
                {order.fulfilment === "meetup" ? "We'll call to agree on the place and time." : `At ${order.branch}${branch ? `, ${branch.address}` : ""}.`} Bring a valid ID and your order number.
              </p>
            </Panel>
          )}
          {order.status === "shipped" && (
            <Panel icon={<Truck className="size-5" aria-hidden />} title="On the way">
              <p>
                {order.courier} · tracking <strong className="text-fg tabular">{order.trackingNumber}</strong>
                {order.paymentMethod === "cod" && Number(order.paidPhp) < total ? `. Have ${formatPeso(total - Number(order.paidPhp), true)} in cash ready.` : "."}
              </p>
            </Panel>
          )}

          <OrderItems order={order} />
          <LayawaySchedule order={order} />
          <PaymentHistory order={order} />

          {buyerCanCancel({ status: order.status, paidPhp: Number(order.paidPhp) }, submitted) && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line p-4 text-sm">
              <span className="text-muted">Changed your mind?</span>
              <InlineAction action={cancelMyOrder} fields={{ code: order.code }} variant="secondary" confirm="Cancel this order? The pieces go back on sale.">
                Cancel order
              </InlineAction>
            </div>
          )}
        </div>

        <aside className="grid content-start gap-6">
          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="mb-4 font-display text-sm tracking-[0.2em] text-champagne uppercase">Progress</h2>
            <OrderTimeline order={order} />
          </section>
          <section className="grid gap-2 rounded-2xl border border-line bg-surface p-5 text-sm">
            <h2 className="font-display text-sm tracking-[0.2em] text-champagne uppercase">Contact and delivery</h2>
            <p>{order.contactName}</p>
            <p className="text-muted tabular">{formatPhMobile(order.contactPhone)}</p>
            {order.fulfilment === "delivery" && (
              <p className="flex gap-2 text-muted">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                {[order.addressLine, cityName(order.cityCode), provinceName(order.provinceCode), regionShort(order.regionCode)].filter(Boolean).join(", ")}
              </p>
            )}
            {order.fulfilment === "pickup" && <p className="text-muted">Pickup at {order.branch}</p>}
            {order.buyerNote && <p className="mt-1 border-t border-line pt-2 whitespace-pre-line text-muted">{order.buyerNote}</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="flex gap-4 rounded-2xl border border-champagne/40 bg-[linear-gradient(150deg,rgb(214_178_110/0.10),transparent_60%)] p-5 sm:p-6">
      <span className="grid size-10 shrink-0 place-items-center rounded-full border border-champagne/50 text-champagne">{icon}</span>
      <div className="grid gap-2 text-sm text-muted">
        <h2 className="text-xl text-fg">{title}</h2>
        {children}
      </div>
    </section>
  );
}
