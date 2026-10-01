import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/marketplace/empty-state";
import { MediaImage } from "@/components/marketplace/media-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatPeso } from "@/lib/pricing";
import { ORDER_STATUSES, statusLabel, type OrderStatus } from "@/lib/shop";
import { db } from "@/lib/server/db";
import { mediaUrl } from "@/lib/server/media";
import { timeAgo } from "@/lib/server/marketplace/describe";
import { sweepUnpaidOrders } from "@/lib/server/shop/orders";
import { requireViewer } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "Shop orders" };

/** What the buyer needs to do next, if anything. */
function todoFor(o: { status: string; paymentMethod: string; fulfilment: string }): string | null {
  if (o.status === "pending_payment") return o.paymentMethod === "in_store" ? "Pay when you pick it up" : "Pay and upload the receipt";
  if (o.status === "layaway") return "Next layaway payment";
  if (o.status === "ready") return o.fulfilment === "meetup" ? "Ready for meet-up" : "Ready for pickup";
  return null;
}

export default async function OrdersPage() {
  const viewer = await requireViewer("/account/orders");
  await sweepUnpaidOrders();
  const orders = await db.shopOrder.findMany({
    where: { buyerId: viewer.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { items: { select: { title: true, quantity: true, coverMediaId: true } } },
  });

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl">Shop orders</h1>
        <p className="mt-1 text-sm text-muted">Pieces you ordered from the official Luxx4less shop.</p>
      </div>
      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          body="When you order from the official shop, you'll follow it here from payment to pickup or delivery."
          actions={
            <Button asChild>
              <Link href="/shop">Browse the shop</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3">
          {orders.map((o) => {
            const todo = todoFor(o);
            const first = o.items[0];
            const pieces = o.items.reduce((s, i) => s + i.quantity, 0);
            return (
              <li key={o.id}>
                <Link
                  href={`/account/orders/${o.code}`}
                  className={cn("flex items-center gap-4 rounded-2xl border bg-surface p-4 transition-colors hover:border-champagne/45 sm:p-5", todo ? "border-champagne/40" : "border-line")}
                >
                  <MediaImage src={first?.coverMediaId ? mediaUrl(first.coverMediaId) : null} alt={first?.title ?? o.code} sizes="64px" className="size-16 shrink-0 rounded-xl" />
                  <div className="grid min-w-0 flex-1 gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-xs tracking-[0.2em] text-champagne tabular">{o.code}</span>
                      <Badge tone={ORDER_STATUSES[o.status as OrderStatus]?.tone ?? "neutral"}>{statusLabel(o.status, o.fulfilment)}</Badge>
                      {o.plan === "layaway" && <Badge tone="gold">Layaway</Badge>}
                    </div>
                    <p className="truncate font-semibold">
                      {first?.title}
                      {pieces > 1 ? ` and ${pieces - 1} more` : ""}
                    </p>
                    <p className="text-sm text-muted tabular">
                      {formatPeso(Number(o.totalPhp))} · {timeAgo(o.createdAt)}
                      {todo && <span className="ml-2 font-semibold text-champagne">{todo}</span>}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
