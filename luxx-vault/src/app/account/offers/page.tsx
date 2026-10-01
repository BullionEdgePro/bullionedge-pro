import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Clock } from "lucide-react";
import { EmptyState } from "@/components/marketplace/empty-state";
import { MediaImage } from "@/components/marketplace/media-image";
import { OfferActions } from "@/components/marketplace/offer-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatPeso } from "@/lib/pricing";
import { db } from "@/lib/server/db";
import { mediaUrl } from "@/lib/server/media";
import { timeAgo } from "@/lib/server/marketplace/describe";
import { sweepExpired } from "@/lib/server/marketplace/listings";
import { requireViewer } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "Offers" };

const STATUS: Record<string, { label: string; tone: "success" | "gold" | "neutral" | "warning" | "danger" | "ice" }> = {
  pending: { label: "Waiting", tone: "gold" },
  accepted: { label: "Accepted", tone: "success" },
  declined: { label: "Declined", tone: "neutral" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
  countered: { label: "Countered", tone: "ice" },
  expired: { label: "Expired", tone: "warning" },
};

function expiresIn(d: Date): string {
  const h = Math.max(0, Math.round((d.getTime() - Date.now()) / 3_600_000));
  return h < 1 ? "expires within the hour" : `expires in ${h} h`;
}

export default async function OffersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const viewer = await requireViewer("/account/offers");
  const tab = (await searchParams).tab === "sent" ? "sent" : "received";
  await sweepExpired();

  const [offers, receivedPending, sentPending] = await Promise.all([
    db.offer.findMany({
      where: tab === "sent" ? { fromUserId: viewer.userId } : { toUserId: viewer.userId },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      include: {
        listing: { select: { code: true, title: true, sellerId: true, status: true, images: { orderBy: { position: "asc" }, take: 1, select: { mediaId: true } } } },
        buyRequest: { select: { code: true, title: true, buyerId: true } },
        fromUser: { select: { name: true, profile: { select: { displayName: true, handle: true } } } },
        toUser: { select: { name: true, profile: { select: { displayName: true, handle: true } } } },
        trade: { select: { code: true } },
      },
    }),
    db.offer.count({ where: { toUserId: viewer.userId, status: "pending" } }),
    db.offer.count({ where: { fromUserId: viewer.userId, status: "pending" } }),
  ]);
  // Waiting offers first, then the rest by date.
  offers.sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending") || b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl">Offers</h1>
        <p className="mt-1 text-sm text-muted">Offers last 48 hours. Accepting one opens a trade and reserves the item.</p>
      </div>
      <nav aria-label="Offer lists" className="flex w-fit gap-1 rounded-full border border-line bg-surface-sunk/60 p-1">
        {(
          [
            { key: "received", label: "Received", n: receivedPending },
            { key: "sent", label: "Sent", n: sentPending },
          ] as const
        ).map((t) => (
          <Link
            key={t.key}
            href={t.key === "sent" ? "/account/offers?tab=sent" : "/account/offers"}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn("flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors", tab === t.key ? "bg-gold-tint text-champagne ring-1 ring-champagne/40" : "text-muted hover:text-fg")}
          >
            {t.label}
            {t.n > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-champagne px-1.5 text-[0.7rem] leading-5 text-velvet tabular">{t.n}</span>}
          </Link>
        ))}
      </nav>

      {offers.length === 0 ? (
        <EmptyState
          title={tab === "sent" ? "You haven't sent any offers" : "No offers received yet"}
          body={
            tab === "sent"
              ? "Find a piece you like, then buy at the asking price or make an offer. Sellers have 48 hours to reply."
              : "When a buyer makes an offer on your listing, or a seller answers your wanted post, it lands here."
          }
          actions={
            <Button asChild variant="secondary" className="rounded-full">
              <Link href="/marketplace">Browse the marketplace</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4">
          {offers.map((o) => {
            const other = tab === "sent" ? o.toUser : o.fromUser;
            const otherName = other.profile?.displayName ?? other.name;
            const subject = o.listing ? { href: `/marketplace/${o.listing.code}`, code: o.listing.code, title: o.listing.title } : { href: `/marketplace/wanted/${o.buyRequest?.code}`, code: o.buyRequest?.code ?? "", title: o.buyRequest?.title ?? "" };
            const iAmBuyer = o.listing ? o.listing.sellerId !== viewer.userId : o.buyRequest?.buyerId === viewer.userId;
            const s = STATUS[o.status] ?? STATUS.expired!;
            const amount = formatPeso(Number(o.amountPhp));
            return (
              <li key={o.id} className={cn("grid gap-4 rounded-2xl border bg-surface p-4 sm:grid-cols-[5rem_minmax(0,1fr)] sm:p-5", o.status === "pending" ? "border-champagne/40" : "border-line")}>
                <Link href={subject.href} className="block overflow-hidden rounded-xl">
                  <MediaImage src={o.listing?.images[0] && o.listing.status !== "removed" ? mediaUrl(o.listing.images[0].mediaId) : null} alt={subject.title} sizes="80px" className="aspect-square" />
                </Link>
                <div className="grid min-w-0 gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={s.tone}>{s.label}</Badge>
                    <span className="inline-flex items-center gap-1 text-xs text-muted">
                      {tab === "sent" ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownLeft className="size-3.5" aria-hidden />}
                      {tab === "sent" ? `To ${otherName}` : `From ${otherName}`} · you are the {iAmBuyer ? "buyer" : "seller"}
                    </span>
                    {o.counterOfId && <Badge tone="ice">Counter-offer</Badge>}
                  </div>
                  <Link href={subject.href} className="truncate font-semibold text-fg hover:text-champagne">
                    <span className="font-display text-xs tracking-[0.18em] text-muted tabular">{subject.code}</span> {subject.title}
                  </Link>
                  <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-display text-2xl text-gold tabular">{amount}</span>
                    {o.weightGrams && <span className="text-sm text-muted tabular">{Number(o.weightGrams)} g</span>}
                    <span className="inline-flex items-center gap-1 text-xs text-muted">
                      <Clock className="size-3.5" aria-hidden /> {o.status === "pending" ? expiresIn(o.expiresAt) : timeAgo(o.respondedAt ?? o.createdAt)}
                    </span>
                  </p>
                  {o.message && <p className="rounded-lg bg-surface-sunk px-3 py-2 text-sm text-fg/85">&ldquo;{o.message}&rdquo;</p>}
                  {o.status === "pending" && <OfferActions offerId={o.id} side={tab} amountLabel={amount} />}
                  {o.status === "accepted" && o.trade && (
                    <Button asChild size="sm" variant="secondary" className="w-fit">
                      <Link href={`/account/trades/${o.trade.code}`}>Go to trade {o.trade.code}</Link>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
