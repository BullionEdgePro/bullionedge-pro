import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Gavel, Heart, Plus } from "lucide-react";
import { EmptyState } from "@/components/marketplace/empty-state";
import { InlineAction } from "@/components/marketplace/inline-action";
import { MediaImage } from "@/components/marketplace/media-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NEW_SELLER_LIMITS } from "@/config/catalog";
import { cn } from "@/lib/cn";
import { formatPeso } from "@/lib/pricing";
import { db } from "@/lib/server/db";
import { mediaUrl } from "@/lib/server/media";
import { markListingSold, removeListing, renewListing } from "@/lib/server/marketplace/actions/listings";
import { getSpot } from "@/lib/server/marketplace/context";
import { gramsLabel, timeAgo } from "@/lib/server/marketplace/describe";
import { REPORT_HIDE_THRESHOLD, sweepExpired, valuationOf } from "@/lib/server/marketplace/listings";
import { releasedSalesCount } from "@/lib/server/marketplace/stats";
import { premiumLabel } from "@/lib/server/marketplace/valuation";
import { requireViewer } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "My listings" };

const STATUS: Record<string, { label: string; tone: "success" | "gold" | "neutral" | "warning" | "danger" }> = {
  active: { label: "Live", tone: "success" },
  reserved: { label: "In a trade", tone: "gold" },
  sold: { label: "Sold", tone: "neutral" },
  expired: { label: "Expired", tone: "warning" },
  removed: { label: "Taken down", tone: "danger" },
  draft: { label: "Draft", tone: "neutral" },
};

export default async function MyListingsPage() {
  const viewer = await requireViewer("/account/listings");
  await sweepExpired();
  const [listings, sales, { spot }] = await Promise.all([
    db.listing.findMany({
      where: { sellerId: viewer.userId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        images: { orderBy: { position: "asc" }, select: { mediaId: true, duplicateOfListingId: true } },
        _count: { select: { saved: true, offers: true } },
      },
    }),
    releasedSalesCount(viewer.userId),
    getSpot(),
  ]);
  const canSell = viewer.tier >= 4;
  const newSeller = sales < NEW_SELLER_LIMITS.tradesToGraduate;
  const order = ["active", "reserved", "expired", "sold", "removed", "draft"];
  listings.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">My listings</h1>
          <p className="mt-1 text-sm text-muted">Views, saves and offers for everything you sell. Listings last 30 days; renew them here.</p>
        </div>
        {canSell && (
          <Button asChild className="rounded-full">
            <Link href="/marketplace/sell">
              <Plus aria-hidden /> New listing
            </Link>
          </Button>
        )}
      </div>

      {canSell && newSeller && (
        <p className="rounded-xl border border-line bg-surface-sunk/60 px-4 py-3 text-sm text-muted">
          New-seller limits apply until you complete {NEW_SELLER_LIMITS.tradesToGraduate} trades (you have {sales}): up to {NEW_SELLER_LIMITS.maxActiveListings} listings at once, each up to{" "}
          {formatPeso(NEW_SELLER_LIMITS.maxListingValuePhp)}.
        </p>
      )}

      {listings.length === 0 ? (
        <EmptyState
          title={canSell ? "Nothing listed yet" : "Selling opens at verified seller"}
          body={
            canSell
              ? "Your first listing takes about five minutes: photos, the piece, your price, and publish."
              : "To list items, finish identity verification, then the seller checks: proof of address and a payout account in your own name."
          }
          actions={
            <Button asChild className="rounded-full">
              <Link href={canSell ? "/marketplace/sell" : "/account/verification?step=seller"}>{canSell ? "List your first item" : "Become a verified seller"}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4">
          {listings.map((l) => {
            const v = valuationOf(l, spot);
            const s = STATUS[l.status] ?? STATUS.draft!;
            const dup = l.images.some((i) => i.duplicateOfListingId);
            return (
              <li key={l.id} className={cn("grid gap-4 rounded-2xl border bg-surface p-4 sm:grid-cols-[7rem_minmax(0,1fr)] sm:p-5", l.status === "active" ? "border-line" : "border-line/60")}>
                <Link href={`/marketplace/${l.code}`} className="block overflow-hidden rounded-xl">
                  <MediaImage src={l.images[0] ? mediaUrl(l.images[0].mediaId) : null} alt={l.title} sizes="112px" className="aspect-square" isPrivate={l.status === "removed"} />
                </Link>
                <div className="grid min-w-0 gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={s.tone}>{s.label}</Badge>
                    <span className="font-display text-xs tracking-[0.2em] text-muted tabular">{l.code}</span>
                    {l.reportCount >= REPORT_HIDE_THRESHOLD && <Badge tone="warning">Under review</Badge>}
                    {dup && <Badge tone="warning">Photo check by staff</Badge>}
                  </div>
                  <Link href={`/marketplace/${l.code}`} className="truncate font-semibold text-fg hover:text-champagne">
                    {l.title}
                  </Link>
                  <p className="text-sm text-muted tabular">
                    {gramsLabel(Number(l.weightGrams))} · {v.pricePhp !== null ? formatPeso(v.pricePhp) : "price pending live spot"}
                    {v.premiumPct !== null ? ` · ${premiumLabel(v.premiumPct)}` : ""}
                  </p>
                  <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted tabular">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="size-3.5" aria-hidden /> {l.views} views
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Heart className="size-3.5" aria-hidden /> {l._count.saved} saves
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Gavel className="size-3.5" aria-hidden /> {l._count.offers} offers
                    </span>
                    <span>{l.status === "active" ? `Up until ${l.expiresAt.toLocaleDateString("en-PH", { day: "numeric", month: "short", timeZone: "Asia/Manila" })}` : `Listed ${timeAgo(l.createdAt)}`}</span>
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {["active", "expired"].includes(l.status) && canSell && (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/account/listings/${l.code}/edit`}>Edit</Link>
                      </Button>
                    )}
                    {["active", "expired"].includes(l.status) && canSell && (
                      <InlineAction action={renewListing} fields={{ code: l.code }}>
                        Renew 30 days
                      </InlineAction>
                    )}
                    {["active", "expired"].includes(l.status) && (
                      <InlineAction action={markListingSold} fields={{ code: l.code }} confirm="Mark this as sold elsewhere? It will leave the marketplace.">
                        Mark sold
                      </InlineAction>
                    )}
                    {!["removed", "reserved", "sold"].includes(l.status) && (
                      <InlineAction action={removeListing} fields={{ code: l.code }} confirm="Take this listing down? Pending offers will be withdrawn.">
                        Take down
                      </InlineAction>
                    )}
                    {l.status === "reserved" && (
                      <Button asChild variant="ghost" size="sm">
                        <Link href="/account/trades">Go to the trade</Link>
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
