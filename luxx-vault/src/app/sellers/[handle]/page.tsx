import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, Handshake, MapPin, PenLine, Star, Wrench } from "lucide-react";
import { Emblem } from "@/components/brand/logo";
import { EmptyState } from "@/components/marketplace/empty-state";
import { ListingCard } from "@/components/marketplace/listing-card";
import { MediaImage } from "@/components/marketplace/media-image";
import { ReportDialog } from "@/components/marketplace/report-dialog";
import { ShareButtons } from "@/components/marketplace/share-buttons";
import { Stars } from "@/components/marketplace/stars";
import { TrustMeter } from "@/components/marketplace/trust-meter";
import { GoldRule, Reveal } from "@/components/motion/reveal";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { TierBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/field";
import { EXPERIENCE } from "@/config/catalog";
import { db } from "@/lib/server/db";
import { mediaUrl } from "@/lib/server/media";
import { monthYear, responseLabel, timeAgo } from "@/lib/server/marketplace/describe";
import { listingCardSelect, PUBLIC_LISTING, toCards } from "@/lib/server/marketplace/listings";
import { loadShowroom } from "@/lib/server/marketplace/showroom";
import { statsForOne } from "@/lib/server/marketplace/stats";
import { placeLabel } from "@/lib/locations";
import { getViewer } from "@/lib/server/viewer";

type Props = { params: Promise<{ handle: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await loadShowroom((await params).handle);
  if (!data) return { title: "Showroom not found", robots: { index: false } };
  const p = data.profile;
  return {
    title: `${p.displayName}'s showroom`,
    description: p.showroomTagline ?? p.bio ?? `${p.displayName} on Luxx4less: verified gold and jewellery, ${data.listingCount} ${data.listingCount === 1 ? "piece" : "pieces"} for sale.`,
    alternates: { canonical: `/sellers/${p.handle}` },
  };
}

export default async function ShowroomPage({ params, searchParams }: Props) {
  const data = await loadShowroom((await params).handle);
  if (!data) notFound();
  const sp = await searchParams;
  const { profile: p } = data;
  const [viewer, stats, rows, reviews] = await Promise.all([
    getViewer(),
    statsForOne(p.userId),
    db.listing.findMany({ where: { sellerId: p.userId, ...PUBLIC_LISTING, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, take: 24, select: listingCardSelect }),
    db.review.findMany({
      where: { subjectId: p.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { author: { select: { name: true, profile: { select: { displayName: true } } } }, trade: { select: { sellerId: true } } },
    }),
  ]);
  if (!stats) notFound();
  const cards = await toCards(rows);
  const saved = viewer && cards.length ? new Set((await db.savedListing.findMany({ where: { userId: viewer.userId, listingId: { in: cards.map((c) => c.id) } }, select: { listingId: true } })).map((s) => s.listingId)) : new Set<string>();
  const isOwner = viewer?.userId === p.userId;
  const place = placeLabel(p.cityCode, p.regionCode);
  const experience = p.yearsExperience !== null ? EXPERIENCE.find((e) => e.value === p.yearsExperience)?.label : null;

  const facts = [
    { icon: Handshake, label: "Completed trades", value: stats.releasedTrades ? String(stats.releasedTrades) : "None yet" },
    { icon: Star, label: "Rating", value: stats.ratingAverage !== null && stats.ratingCount ? `${stats.ratingAverage.toFixed(1)} of 5 (${stats.ratingCount})` : "No reviews yet" },
    { icon: Clock, label: "Typical reply", value: responseLabel(stats.medianResponseMs) },
    { icon: CalendarDays, label: "Member since", value: monthYear(stats.memberSince) },
  ];

  return (
    <>
      <SiteHeader signedIn={Boolean(viewer)} />
      <main className="surface-velvet">
        {/* ------------------------------------------ cover */}
        <section className="relative isolate">
          <div className="relative h-56 overflow-hidden sm:h-72 lg:h-80">
            {p.coverMediaId ? (
              <MediaImage src={mediaUrl(p.coverMediaId)} alt={`${p.displayName}'s showroom cover`} priority sizes="100vw" className="absolute inset-0" />
            ) : (
              <div aria-hidden className="absolute inset-0 bg-[radial-gradient(80%_120%_at_20%_0%,#3a2a4c_0%,#1b1326_55%,#120c19_100%)]">
                {/* The velvet default: a faint repeat of the emblem, like a monogrammed lining. */}
                <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_center,#d6b26e_1px,transparent_1.5px)] [background-size:22px_22px]" />
                <Emblem detail="mono" title="" className="absolute top-1/2 right-[8%] size-56 -translate-y-1/2 text-champagne/10 sm:size-72" />
              </div>
            )}
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-velvet via-velvet/40 to-transparent" />
          </div>
          <div className="mx-auto -mt-20 max-w-6xl px-4 sm:px-8">
            <Reveal className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="flex min-w-0 items-end gap-5">
                <div className="relative grid size-24 shrink-0 place-items-center rounded-full border border-champagne/50 bg-velvet shadow-[0_0_0_6px_rgb(23_16_31/1),0_18px_40px_-18px_rgb(214_178_110/0.5)] sm:size-28">
                  <span className="font-display text-4xl text-gold-metal">{p.displayName.charAt(0).toUpperCase()}</span>
                </div>
                <div className="min-w-0 pb-1">
                  <p className="font-display text-xs tracking-[0.3em] text-champagne uppercase">Showroom</p>
                  <h1 className="truncate text-3xl text-pearl sm:text-4xl">{p.displayName}</h1>
                  <p className="text-sm text-muted">
                    @{p.handle}
                    {p.businessName ? ` · ${p.businessName}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <TrustMeter score={stats.trust.score} label={stats.trust.label} />
                {isOwner && (
                  <Button asChild variant="secondary" size="sm" className="rounded-full">
                    <Link href={`/sellers/${p.handle}/edit`}>
                      <PenLine aria-hidden /> Edit showroom
                    </Link>
                  </Button>
                )}
              </div>
            </Reveal>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 pt-8 pb-14 sm:px-8">
          {sp.saved && isOwner && (
            <div className="mb-6">
              <FormAlert tone="success">Showroom updated.</FormAlert>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <TierBadge tier={stats.tier} />
            {place && (
              <span className="inline-flex items-center gap-1 text-sm text-muted">
                <MapPin className="size-3.5" aria-hidden /> {place}
              </span>
            )}
          </div>
          {p.showroomTagline && <p className="measure mt-4 font-display text-xl text-champagne">{p.showroomTagline}</p>}
          {p.bio && <p className="measure mt-3 text-muted">{p.bio}</p>}
          <GoldRule className="mt-8" />

          <div className="mt-8 grid gap-10 lg:grid-cols-[17rem_minmax(0,1fr)]">
            <aside className="grid content-start gap-6">
              <dl className="grid gap-4 rounded-2xl border border-line bg-surface p-5">
                {facts.map((f) => (
                  <div key={f.label} className="flex gap-3">
                    <f.icon className="mt-0.5 size-4 shrink-0 text-champagne" aria-hidden />
                    <div>
                      <dt className="text-xs text-muted">{f.label}</dt>
                      <dd className="text-sm font-semibold text-fg tabular">{f.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
              {(p.specializations.length > 0 || p.tools.length > 0 || experience) && (
                <div className="grid gap-4 rounded-2xl border border-line p-5">
                  {experience && (
                    <div>
                      <p className="text-xs text-muted">Experience</p>
                      <p className="text-sm font-semibold text-fg">{experience}</p>
                    </div>
                  )}
                  {p.specializations.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs text-muted">Specialises in</p>
                      <ul className="flex flex-wrap gap-1.5">
                        {p.specializations.map((s) => (
                          <li key={s} className="rounded-full border border-champagne/30 px-2.5 py-0.5 text-xs text-champagne">
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {p.tools.length > 0 && (
                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-xs text-muted">
                        <Wrench className="size-3.5" aria-hidden /> Testing tools
                      </p>
                      <ul className="flex flex-wrap gap-1.5">
                        {p.tools.map((s) => (
                          <li key={s} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-fg/85">
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              <div className="grid gap-3">
                <ShareButtons path={`/sellers/${p.handle}`} />
                {!isOwner && <ReportDialog targetType="user" targetId={p.userId} subject={`${p.displayName} (@${p.handle})`} signedIn={Boolean(viewer)} label="Report this member" />}
              </div>
            </aside>

            <div className="grid min-w-0 content-start gap-12">
              <section aria-labelledby="pieces-title">
                <h2 id="pieces-title" className="text-2xl text-pearl">
                  In the showroom <span className="font-sans text-base text-muted tabular">({cards.length})</span>
                </h2>
                {cards.length === 0 ? (
                  <EmptyState
                    className="mt-5"
                    title={isOwner ? "Your showroom is ready for its first piece" : "Nothing on display right now"}
                    body={isOwner ? (stats.tier >= 4 ? "Listings you publish appear here automatically." : "Once you're a verified seller, your listings appear here.") : `${p.displayName} has no pieces for sale at the moment.`}
                    actions={
                      isOwner ? (
                        <Button asChild className="rounded-full">
                          <Link href={stats.tier >= 4 ? "/marketplace/sell" : "/account/verification?step=seller"}>{stats.tier >= 4 ? "List an item" : "Become a verified seller"}</Link>
                        </Button>
                      ) : undefined
                    }
                  />
                ) : (
                  <ul className="mt-5 grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 xl:grid-cols-3">
                    {cards.map((c) => (
                      <li key={c.id}>
                        <ListingCard card={c} saved={saved.has(c.id)} signedIn={Boolean(viewer)} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="reviews-title">
                <h2 id="reviews-title" className="text-2xl text-pearl">
                  Reviews
                </h2>
                <p className="mt-1 text-sm text-muted">Only from completed trades on Luxx4less.</p>
                {reviews.length === 0 ? (
                  <p className="mt-5 rounded-2xl border border-dashed border-line p-6 text-sm text-muted">No reviews yet. They appear here after completed trades.</p>
                ) : (
                  <ul className="mt-5 grid gap-4">
                    {reviews.map((r) => (
                      <li key={r.id} className="rounded-2xl border border-line bg-surface p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Stars value={r.rating} />
                          <span className="text-xs text-muted">{timeAgo(r.createdAt)}</span>
                        </div>
                        {r.body && <p className="mt-2 text-sm leading-relaxed text-fg/90">&ldquo;{r.body}&rdquo;</p>}
                        <p className="mt-2 text-xs text-muted">
                          {(r.author.profile?.displayName ?? r.author.name).split(" ")[0]} · {r.trade.sellerId === p.userId ? "bought from" : "sold to"} {p.displayName.split(" ")[0]}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
