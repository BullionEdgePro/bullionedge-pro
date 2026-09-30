import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { LuxxTestedForm } from "@/components/marketplace/admin-forms";
import { InlineAction } from "@/components/marketplace/inline-action";
import { MediaImage } from "@/components/marketplace/media-image";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { formatPeso } from "@/lib/pricing";
import { db } from "@/lib/server/db";
import { mediaUrl } from "@/lib/server/media";
import { moderateListing } from "@/lib/server/marketplace/actions/admin";
import { getSpot } from "@/lib/server/marketplace/context";
import { gramsLabel, timeAgo } from "@/lib/server/marketplace/describe";
import { REPORT_HIDE_THRESHOLD, valuationOf } from "@/lib/server/marketplace/listings";
import { premiumLabel } from "@/lib/server/marketplace/valuation";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Listing moderation" };

const VIEWS = [
  { key: "flagged", label: "Duplicate photos" },
  { key: "reported", label: "Reported" },
  { key: "below", label: "Below melt" },
  { key: "removed", label: "Removed" },
  { key: "recent", label: "All recent" },
] as const;

export default async function AdminListingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole(["support", "admin", "super_admin"], "/admin/listings");
  const raw = (await searchParams).view;
  const view = VIEWS.find((v) => v.key === raw)?.key ?? "flagged";
  const where: Prisma.ListingWhereInput =
    view === "flagged"
      ? { images: { some: { duplicateOfListingId: { not: null } } } }
      : view === "reported"
        ? { reportCount: { gt: 0 } }
        : view === "removed"
          ? { status: "removed" }
          : view === "below"
            ? { status: "active" }
            : {};
  const [rows, { spot }] = await Promise.all([
    db.listing.findMany({
      where,
      orderBy: view === "reported" ? { reportCount: "desc" } : { createdAt: "desc" },
      take: view === "below" ? 500 : 60,
      include: {
        images: { orderBy: { position: "asc" }, select: { mediaId: true, duplicateOfListingId: true } },
        seller: { select: { name: true, profile: { select: { handle: true } } } },
      },
    }),
    getSpot(),
  ]);
  const withValue = rows.map((l) => ({ l, v: valuationOf(l, spot) }));
  const list = view === "below" ? withValue.filter((x) => x.v.belowMelt).slice(0, 60) : withValue;
  const dupIds = [...new Set(rows.flatMap((l) => l.images.map((i) => i.duplicateOfListingId)).filter((x): x is string => Boolean(x)))];
  const dupCodes = new Map((await db.listing.findMany({ where: { id: { in: dupIds } }, select: { id: true, code: true, seller: { select: { name: true } } } })).map((d) => [d.id, d]));

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl">Listing moderation</h1>
        <p className="mt-1 text-sm text-muted">
          Photos that match another seller&rsquo;s (perceptual hash within 6 of 64 bits) are flagged, never blocked. Listings with {REPORT_HIDE_THRESHOLD} open reports are hidden from search until
          handled in Reports.
        </p>
      </div>
      <nav className="flex flex-wrap gap-1 rounded-2xl border border-line p-1 sm:w-fit sm:rounded-full" aria-label="Views">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/admin/listings?view=${v.key}`}
            aria-current={view === v.key ? "page" : undefined}
            className={cn("rounded-full px-4 py-1.5 text-sm font-semibold", view === v.key ? "bg-gold-tint text-champagne" : "text-muted hover:text-fg")}
          >
            {v.label}
          </Link>
        ))}
      </nav>
      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">Nothing here.</p>
      ) : (
        <ul className="grid gap-4">
          {list.map(({ l, v }) => {
            const dups = l.images.filter((i) => i.duplicateOfListingId);
            return (
              <li key={l.id} className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-[6rem_minmax(0,1fr)]">
                <MediaImage src={l.images[0] ? mediaUrl(l.images[0].mediaId) : null} alt={l.title} isPrivate={l.status === "removed"} sizes="96px" className="aspect-square rounded-xl" />
                <div className="grid min-w-0 gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/marketplace/${l.code}`} className="font-display text-xs tracking-[0.2em] text-champagne tabular hover:underline">
                      {l.code}
                    </Link>
                    <Badge tone={l.status === "active" ? "success" : l.status === "removed" ? "danger" : "neutral"}>{l.status}</Badge>
                    {l.reportCount > 0 && <Badge tone="warning">{l.reportCount} open reports</Badge>}
                    {v.belowMelt && <Badge tone="danger">Below melt</Badge>}
                    {l.luxxTestedAt && <Badge tone="ice">Luxx-Tested</Badge>}
                  </div>
                  <p className="truncate font-semibold">{l.title}</p>
                  <p className="text-sm text-muted tabular">
                    {gramsLabel(Number(l.weightGrams))} · {v.pricePhp !== null ? formatPeso(v.pricePhp) : "no live price"} {v.premiumPct !== null ? `· ${premiumLabel(v.premiumPct)}` : ""} · seller{" "}
                    {l.seller.profile?.handle ? (
                      <Link href={`/sellers/${l.seller.profile.handle}`} className="text-fg hover:text-champagne">
                        {l.seller.name}
                      </Link>
                    ) : (
                      l.seller.name
                    )}{" "}
                    · {timeAgo(l.createdAt)}
                  </p>
                  {dups.length > 0 && (
                    <div className="rounded-xl border border-warning/30 bg-warning-tint p-3 text-sm">
                      <p className="font-semibold text-warning">
                        {dups.length} {dups.length === 1 ? "photo matches" : "photos match"} another seller&rsquo;s listing
                      </p>
                      <ul className="mt-2 flex flex-wrap gap-3">
                        {dups.map((d) => {
                          const other = d.duplicateOfListingId ? dupCodes.get(d.duplicateOfListingId) : undefined;
                          return (
                            <li key={d.mediaId} className="flex items-center gap-2">
                              <MediaImage src={mediaUrl(d.mediaId)} alt="Flagged photo" isPrivate sizes="48px" className="size-12 rounded-lg" />
                              <span className="text-xs">
                                matches{" "}
                                {other ? (
                                  <Link href={`/marketplace/${other.code}`} className="font-semibold text-champagne hover:underline">
                                    {other.code}
                                  </Link>
                                ) : (
                                  "a removed listing"
                                )}
                                {other ? ` by ${other.seller.name}` : ""}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                  {l.luxxTestedAt && (
                    <p className="text-sm text-muted">
                      Luxx-Tested {l.luxxTestedAt.toLocaleDateString("en-PH")}: {l.luxxTestResult}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {l.status !== "removed" ? (
                      <InlineAction action={moderateListing} fields={{ listingId: l.id, op: "remove" }} variant="danger" confirm="Remove this listing from the marketplace?">
                        Remove
                      </InlineAction>
                    ) : (
                      <InlineAction action={moderateListing} fields={{ listingId: l.id, op: "restore" }} variant="secondary">
                        Restore
                      </InlineAction>
                    )}
                    {dups.length > 0 && (
                      <InlineAction action={moderateListing} fields={{ listingId: l.id, op: "clear_duplicates" }}>
                        Photos are fine: clear flag
                      </InlineAction>
                    )}
                    {l.luxxTestedAt && (
                      <InlineAction action={moderateListing} fields={{ listingId: l.id, op: "clear_tested" }} confirm="Remove the Luxx-Tested badge?">
                        Clear Luxx-Tested
                      </InlineAction>
                    )}
                  </div>
                  {l.status !== "removed" && (
                    <details className="rounded-xl border border-line p-3">
                      <summary className="cursor-pointer text-sm font-semibold">{l.luxxTestedAt ? "Update Luxx-Tested result" : "Record a Luxx-Tested result"}</summary>
                      <div className="mt-3">
                        <LuxxTestedForm listingId={l.id} />
                      </div>
                    </details>
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
