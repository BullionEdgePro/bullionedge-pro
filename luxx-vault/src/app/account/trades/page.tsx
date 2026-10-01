import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/marketplace/empty-state";
import { TestModeNote } from "@/components/marketplace/test-mode-note";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatPeso } from "@/lib/pricing";
import { db } from "@/lib/server/db";
import { payments } from "@/lib/server/payments";
import { gramsLabel, itemLabel, timeAgo } from "@/lib/server/marketplace/describe";
import { IN_PROGRESS, settleDueTrades, TRADE_STATUS_LABEL } from "@/lib/server/marketplace/trades";
import { requireViewer } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "Trades" };

const TONE: Record<string, "gold" | "success" | "warning" | "neutral" | "ice" | "danger"> = {
  awaiting_payment: "gold",
  payment_held: "ice",
  shipped: "ice",
  received: "ice",
  released: "success",
  disputed: "warning",
  refunded: "neutral",
  cancelled: "neutral",
};

/** What the viewer needs to do next, if anything. */
function nextFor(status: string, role: "buyer" | "seller"): string | null {
  if (status === "awaiting_payment") return role === "buyer" ? "Pay into the protected hold" : null;
  if (status === "payment_held") return role === "seller" ? "Ship or arrange the meet-up" : null;
  if (status === "shipped") return role === "buyer" ? "Confirm when it arrives" : null;
  return null;
}

export default async function TradesPage() {
  const viewer = await requireViewer("/account/trades");
  await settleDueTrades(viewer.userId);
  const trades = await db.trade.findMany({
    where: { OR: [{ buyerId: viewer.userId }, { sellerId: viewer.userId }] },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      buyer: { select: { name: true, profile: { select: { displayName: true } } } },
      seller: { select: { name: true, profile: { select: { displayName: true } } } },
      listing: { select: { title: true } },
      buyRequest: { select: { title: true } },
    },
  });
  const active = trades.filter((t) => (IN_PROGRESS as readonly string[]).includes(t.status));
  const past = trades.filter((t) => !(IN_PROGRESS as readonly string[]).includes(t.status));

  const row = (t: (typeof trades)[number]) => {
    const role = t.buyerId === viewer.userId ? "buyer" : "seller";
    const other = role === "buyer" ? t.seller : t.buyer;
    const todo = nextFor(t.status, role);
    return (
      <li key={t.id}>
        <Link href={`/account/trades/${t.code}`} className={cn("flex items-center gap-4 rounded-2xl border bg-surface p-4 transition-colors hover:border-champagne/45 sm:p-5", todo ? "border-champagne/40" : "border-line")}>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-xs tracking-[0.2em] text-champagne tabular">{t.code}</span>
              <Badge tone={TONE[t.status] ?? "neutral"}>{TRADE_STATUS_LABEL[t.status] ?? t.status}</Badge>
              <span className="text-xs text-muted">
                You {role === "buyer" ? "buy from" : "sell to"} {other.profile?.displayName ?? other.name}
              </span>
            </div>
            <p className="mt-1.5 truncate font-semibold text-fg">{t.listing?.title ?? t.buyRequest?.title ?? itemLabel(t)}</p>
            <p className="text-sm text-muted tabular">
              {formatPeso(Number(t.amountPhp))} · {gramsLabel(Number(t.weightGrams))} · updated {timeAgo(t.updatedAt)}
            </p>
            {todo && <p className="mt-1.5 text-sm font-semibold text-champagne">Your turn: {todo}</p>}
          </div>
          <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
        </Link>
      </li>
    );
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">Trades</h1>
          <p className="mt-1 text-sm text-muted">Every deal from accepted offer to released payment.</p>
        </div>
        {payments().testMode && <TestModeNote />}
      </div>
      {trades.length === 0 ? (
        <EmptyState
          title="No trades yet"
          body="A trade opens when an offer is accepted. The buyer pays into a protected hold, and the seller is paid once the buyer confirms the item."
          actions={
            <Button asChild variant="secondary" className="rounded-full">
              <Link href="/marketplace">Browse the marketplace</Link>
            </Button>
          }
        />
      ) : (
        <>
          <section aria-labelledby="active-trades" className="grid grid-cols-[minmax(0,1fr)] gap-3">
            <h2 id="active-trades" className="font-display text-sm tracking-[0.2em] text-champagne uppercase">
              In progress
            </h2>
            {active.length ? <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">{active.map(row)}</ul> : <p className="text-sm text-muted">Nothing in progress.</p>}
          </section>
          {past.length > 0 && (
            <section aria-labelledby="past-trades" className="grid grid-cols-[minmax(0,1fr)] gap-3">
              <h2 id="past-trades" className="font-display text-sm tracking-[0.2em] text-muted uppercase">
                Completed and closed
              </h2>
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">{past.map(row)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
