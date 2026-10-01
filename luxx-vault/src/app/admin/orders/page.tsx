import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { formatPeso } from "@/lib/pricing";
import { ORDER_STATUSES, statusLabel, type OrderStatus } from "@/lib/shop";
import { db } from "@/lib/server/db";
import { timeAgo } from "@/lib/server/marketplace/describe";
import { ORDER_STAFF, sweepUnpaidOrders } from "@/lib/server/shop/orders";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Shop orders" };

const VIEWS = [
  { key: "action", label: "Needs action", where: { OR: [{ status: { in: ["payment_review", "awaiting_confirmation", "preparing"] } }, { payments: { some: { status: "submitted" } } }] } },
  { key: "unpaid", label: "Waiting for payment", where: { status: "pending_payment" } },
  { key: "layaway", label: "Layaway", where: { status: "layaway" } },
  { key: "handover", label: "Ready or shipped", where: { status: { in: ["ready", "shipped"] } } },
  { key: "completed", label: "Completed", where: { status: "completed" } },
  { key: "cancelled", label: "Cancelled", where: { status: "cancelled" } },
] as const satisfies readonly { key: string; label: string; where: Prisma.ShopOrderWhereInput }[];

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole(ORDER_STAFF, "/admin/orders");
  await sweepUnpaidOrders();
  const raw = (await searchParams).view;
  const view = VIEWS.find((v) => v.key === raw) ?? VIEWS[0];
  const [orders, counts] = await Promise.all([
    db.shopOrder.findMany({
      where: view.where,
      orderBy: { createdAt: view.key === "action" ? "asc" : "desc" },
      take: 200,
      include: {
        buyer: { select: { name: true } },
        items: { select: { title: true, quantity: true } },
        payments: { where: { status: "submitted" }, select: { id: true } },
        installments: { where: { paidAt: null, dueAt: { lt: new Date() } }, select: { seq: true } },
      },
    }),
    Promise.all(VIEWS.map((v) => db.shopOrder.count({ where: v.where }))),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl">Shop orders</h1>
        <p className="mt-1 text-sm text-muted">Orders from the official shop. Unpaid orders cancel themselves after their hold and the pieces go back on sale.</p>
      </div>
      <nav className="flex flex-wrap gap-1 rounded-2xl border border-line p-1 sm:w-fit sm:rounded-full" aria-label="Views">
        {VIEWS.map((v, i) => (
          <Link
            key={v.key}
            href={`/admin/orders?view=${v.key}`}
            aria-current={view.key === v.key ? "page" : undefined}
            className={cn("rounded-full px-4 py-1.5 text-sm font-semibold", view.key === v.key ? "bg-gold-tint text-champagne" : "text-muted hover:text-fg")}
          >
            {v.label}
            {counts[i]! > 0 && <span className="ml-1.5 text-xs tabular opacity-80">{counts[i]}</span>}
          </Link>
        ))}
      </nav>
      {orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">Nothing here.</p>
      ) : (
        <ul className="grid gap-3">
          {orders.map((o) => {
            const pieces = o.items.reduce((s, i) => s + i.quantity, 0);
            return (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.code}`} className="grid gap-1 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-champagne/45 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="grid min-w-0 gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-xs tracking-[0.2em] text-champagne tabular">{o.code}</span>
                      <Badge tone={ORDER_STATUSES[o.status as OrderStatus]?.tone ?? "neutral"}>{statusLabel(o.status, o.fulfilment)}</Badge>
                      {o.payments.length > 0 && <Badge tone="ice">Receipt to check</Badge>}
                      {o.plan === "layaway" && <Badge tone="gold">Layaway</Badge>}
                      {o.installments.length > 0 && o.status === "layaway" && <Badge tone="danger">Overdue</Badge>}
                    </div>
                    <p className="truncate font-semibold">
                      {o.items[0]?.title}
                      {pieces > 1 ? ` and ${pieces - 1} more` : ""}
                    </p>
                    <p className="text-sm text-muted">
                      {o.buyer.name} · {o.paymentMethod.replace("_", " ")} · {o.fulfilment}
                      {o.branch ? ` (${o.branch})` : ""} · {timeAgo(o.createdAt)}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-display text-xl text-gold tabular">{formatPeso(Number(o.totalPhp))}</p>
                    {Number(o.paidPhp) > 0 && Number(o.paidPhp) < Number(o.totalPhp) && <p className="text-xs text-muted tabular">{formatPeso(Number(o.paidPhp))} paid</p>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
