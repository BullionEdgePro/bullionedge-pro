import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { AlertTriangle, ChevronRight, FlaskConical, Radio, ShieldCheck } from "lucide-react";
import { Gallery } from "@/components/marketplace/gallery";
import { JsonLd } from "@/components/marketplace/json-ld";
import { OfferPanel } from "@/components/marketplace/offer-panel";
import { ReportDialog } from "@/components/marketplace/report-dialog";
import { SaveButton } from "@/components/marketplace/save-button";
import { SellerCard } from "@/components/marketplace/seller-card";
import { ShareButtons } from "@/components/marketplace/share-buttons";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Badge, ProductBadge } from "@/components/ui/badge";
import { FormAlert } from "@/components/ui/field";
import { CATEGORIES, FORMS, GOLD_TYPES, METALS, labelOf } from "@/config/catalog";
import { STAFF_ROLES } from "@/config/roles";
import { db } from "@/lib/server/db";
import { mediaUrl } from "@/lib/server/media";
import { normaliseCode } from "@/lib/server/marketplace/codes";
import { getSpot } from "@/lib/server/marketplace/context";
import { gramsLabel, purityLabel, timeAgo } from "@/lib/server/marketplace/describe";
import { REPORT_HIDE_THRESHOLD, valuationOf } from "@/lib/server/marketplace/listings";
import { statsForOne } from "@/lib/server/marketplace/stats";
import { itemPurity, premiumLabel } from "@/lib/server/marketplace/valuation";
import { placeLabel } from "@/lib/locations";
import { formatPeso } from "@/lib/pricing";
import { getViewer } from "@/lib/server/viewer";
import { cn } from "@/lib/cn";

type Props = { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | undefined>> };

const load = cache(async (code: string) =>
  db.listing.findUnique({
    where: { code },
    include: {
      images: { orderBy: { position: "asc" }, select: { mediaId: true } },
      seller: { select: { name: true, profile: { select: { handle: true, displayName: true, cityCode: true, regionCode: true } } } },
    },
  }),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const code = normaliseCode((await params).code, "LX");
  const l = code ? await load(code) : null;
  if (!l || l.status === "removed") return { title: "Listing not found", robots: { index: false } };
  const facts = [purityLabel(l), gramsLabel(Number(l.weightGrams)), placeLabel(l.cityCode, l.regionCode)].filter(Boolean).join(" · ");
  const image = l.images[0] ? mediaUrl(l.images[0].mediaId) : undefined;
  return {
    title: `${l.title} (${l.code})`,
    description: `${facts}. Sold by an ID-verified seller on Luxx4less, with live melt value and payment held until you confirm.`,
    alternates: { canonical: `/marketplace/${l.code}` },
    openGraph: { title: l.title, description: facts, images: image ? [{ url: image, alt: l.title }] : undefined },
    robots: l.status === "active" && l.reportCount < REPORT_HIDE_THRESHOLD ? undefined : { index: false },
  };
}

export default async function ListingPage({ params, searchParams }: Props) {
  const raw = (await params).code;
  const sp = await searchParams;
  const code = normaliseCode(decodeURIComponent(raw), "LX");
  if (!code) notFound();
  if (code !== raw) permanentRedirect(`/marketplace/${code}`);

  const [listing, viewer] = await Promise.all([load(code), getViewer()]);
  if (!listing) notFound();
  const isOwner = viewer?.userId === listing.sellerId;
  const isStaff = Boolean(viewer?.roles.some((r) => STAFF_ROLES.includes(r)));
  if (listing.status === "removed" && !isOwner && !isStaff) notFound();

  let status = listing.status;
  if (status === "active" && listing.expiresAt < new Date()) {
    status = "expired";
    await db.listing.updateMany({ where: { id: listing.id, status: "active" }, data: { status: "expired" } });
  }
  // Count a view for everyone but the seller (guests included).
  if (!isOwner) await db.listing.update({ where: { id: listing.id }, data: { views: { increment: 1 } }, select: { id: true } });

  const [{ spot, delayed }, stats, saved, myOffer] = await Promise.all([
    getSpot(),
    statsForOne(listing.sellerId),
    viewer ? db.savedListing.findUnique({ where: { userId_listingId: { userId: viewer.userId, listingId: listing.id } } }) : null,
    viewer && !isOwner
      ? db.offer.findFirst({ where: { listingId: listing.id, fromUserId: viewer.userId, status: "pending", expiresAt: { gt: new Date() } }, select: { amountPhp: true } })
      : null,
  ]);
  const v = valuationOf(listing, spot);
  const purity = itemPurity(listing);
  const pureSpot = listing.metal ? spot[listing.metal as keyof typeof spot] : undefined;
  const underReview = listing.reportCount >= REPORT_HIDE_THRESHOLD;
  const available = status === "active" && !underReview;
  const sellerName = listing.seller.profile?.displayName ?? listing.seller.name;
  const handle = listing.seller.profile?.handle ?? "";
  const place = placeLabel(listing.cityCode, listing.regionCode);
  const photos = listing.images.map((i) => ({ id: i.mediaId, url: mediaUrl(i.mediaId) }));

  const specs: { label: string; value: string }[] = [
    { label: "Category", value: labelOf(CATEGORIES, listing.category) },
    ...(listing.metal ? [{ label: "Metal", value: labelOf(METALS, listing.metal) }] : []),
    ...(purityLabel(listing) ? [{ label: listing.karat ? "Karat" : "Fineness", value: listing.karat ? `${listing.karat}K (${listing.finenessPermille ?? ""})` : String(listing.finenessPermille) }] : []),
    ...(listing.goldType ? [{ label: "Gold type", value: labelOf(GOLD_TYPES, listing.goldType) }] : []),
    ...(listing.form ? [{ label: "Form", value: labelOf(FORMS, listing.form) }] : []),
    { label: "Exact weight", value: `${Number(listing.weightGrams).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")} g` },
    { label: "Certificate", value: listing.hasCertificate ? "Included" : "None" },
    { label: "Receipt", value: listing.hasReceipt ? "Included" : "None" },
    { label: "Pawnable", value: listing.pawnable === null ? "Not stated" : listing.pawnable ? "Yes, per the seller" : "No" },
    { label: "Location", value: place },
    { label: "Listed", value: timeAgo(listing.createdAt) },
  ];

  const statusNote =
    status === "reserved" ? "Reserved: this item is in a trade." : status === "sold" ? "Sold." : status === "expired" ? "This listing has expired." : status === "removed" ? "Removed by staff." : null;

  return (
    <>
      <SiteHeader signedIn={Boolean(viewer)} />
      <main className="surface-velvet">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8 lg:py-12">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted">
            <Link href="/marketplace" className="hover:text-champagne">
              Marketplace
            </Link>
            <ChevronRight className="size-3.5" aria-hidden />
            <span className="truncate text-fg">{listing.code}</span>
          </nav>

          {sp.published && <div className="mt-4"><FormAlert tone="success">Your listing is live. Share it, and watch for offers in your account.</FormAlert></div>}
          {sp.updated && <div className="mt-4"><FormAlert tone="success">Changes saved.</FormAlert></div>}

          <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <Gallery photos={photos} title={listing.title} />
            </div>

            <div className="grid content-start gap-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-xs tracking-[0.24em] text-champagne tabular">{listing.code}</span>
                  {listing.luxxTestedAt && <ProductBadge kind="luxxTested" />}
                  {listing.hasCertificate && <ProductBadge kind="certificate" />}
                  {listing.pawnable && <ProductBadge kind="pawnable" />}
                  {listing.openToOffers && <Badge tone="gold">Open to offers</Badge>}
                </div>
                <h1 className="mt-3 text-3xl text-pearl sm:text-4xl">{listing.title}</h1>
                <p className="mt-2 text-muted tabular">
                  {[purityLabel(listing), listing.goldType && listing.goldType !== "other" ? labelOf(GOLD_TYPES, listing.goldType) : "", gramsLabel(Number(listing.weightGrams)), place].filter(Boolean).join(" · ")}
                </p>
              </div>

              {(statusNote || underReview) && (
                <p className="rounded-xl border border-warning/30 bg-warning-tint px-4 py-3 text-sm font-semibold text-warning">
                  {underReview ? "This listing is under review after reports from other members. Offers are paused." : statusNote}
                </p>
              )}

              <div className="rounded-2xl border border-champagne/25 bg-[linear-gradient(135deg,rgb(214_178_110/0.08),transparent_55%)] p-5 sm:p-6">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">{v.live ? "Price today" : "Asking price"}</p>
                {v.pricePhp !== null ? (
                  <p className="mt-1 font-display text-5xl leading-none text-gold-metal tabular animate-molten">{formatPeso(v.pricePhp)}</p>
                ) : (
                  <p className="mt-2 text-muted">Live prices are unavailable, so this spot-pegged price can&rsquo;t be shown right now.</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  {v.premiumPct !== null && <span className={cn("font-semibold tabular", v.belowMelt ? "text-danger" : "text-fg")}>{premiumLabel(v.premiumPct)}</span>}
                  {v.live && (
                    <span className="inline-flex items-center gap-1.5 text-champagne">
                      <Radio className="size-3.5" aria-hidden /> Moves with spot: melt {listing.premiumPct !== null && Number(listing.premiumPct) >= 0 ? "+" : ""}
                      {Number(listing.premiumPct ?? 0)}%
                    </span>
                  )}
                  {delayed && <span className="text-warning">Prices delayed</span>}
                </div>
                {v.belowMelt && (
                  <div className="mt-4 flex gap-3 rounded-xl border border-danger/35 bg-danger-tint p-3.5 text-sm">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                    <div>
                      <p className="font-semibold text-danger">Verify before buying</p>
                      <p className="mt-0.5 text-fg/85">
                        This price is well below the value of the metal alone. Genuine sellers rarely sell under melt. Ask for a live video with the scale and hallmark, prefer a
                        meet-up for testing, and never pay outside Luxx4less.
                      </p>
                    </div>
                  </div>
                )}
                {myOffer && (
                  <p className="mt-4 text-sm text-muted">
                    You have an offer of <strong className="text-fg tabular">{formatPeso(Number(myOffer.amountPhp))}</strong> waiting.{" "}
                    <Link href="/account/offers?tab=sent" className="font-semibold text-champagne underline-offset-4 hover:underline">
                      See it
                    </Link>
                  </p>
                )}
              </div>

              <OfferPanel
                listingId={listing.id}
                code={listing.code}
                askingPrice={v.pricePhp}
                openToOffers={listing.openToOffers}
                live={v.live}
                available={available}
                viewer={{ signedIn: Boolean(viewer), tier: viewer?.tier ?? 0, isOwner }}
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <SaveButton listingId={listing.id} initialSaved={Boolean(saved)} signedIn={Boolean(viewer)} label={listing.title} variant="button" />
                  <ShareButtons path={`/marketplace/${listing.code}`} />
                </div>
                {!isOwner && <ReportDialog targetType="listing" targetId={listing.id} subject={`${listing.code} · ${listing.title}`} signedIn={Boolean(viewer)} label="Report listing" />}
              </div>

              {/* ------------------------------------ price breakdown */}
              <section aria-labelledby="breakdown-title" className="rounded-2xl border border-line bg-surface p-5">
                <h2 id="breakdown-title" className="font-display text-sm tracking-[0.2em] text-champagne uppercase">
                  Live price breakdown
                </h2>
                {purity !== null && pureSpot && v.meltPhp !== null ? (
                  <dl className="mt-4 grid gap-2 text-sm tabular">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">Weight</dt>
                      <dd>{Number(listing.weightGrams)} g</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">× Purity ({purityLabel(listing)})</dt>
                      <dd>{purity.toFixed(3)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">× Pure {listing.metal} spot, per gram</dt>
                      <dd>{formatPeso(pureSpot, true)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-line pt-2 font-semibold">
                      <dt>= Melt value today</dt>
                      <dd>{formatPeso(v.meltPhp)}</dd>
                    </div>
                    {v.pricePhp !== null && v.premiumPct !== null && (
                      <>
                        <div className="flex justify-between gap-4">
                          <dt className="text-muted">{v.premiumPct >= 0 ? "+ Seller's premium (workmanship, brand, margin)" : "− Below melt"}</dt>
                          <dd>
                            {formatPeso(Math.abs(v.pricePhp - v.meltPhp))} ({v.premiumPct >= 0 ? "+" : "−"}
                            {Math.abs(v.premiumPct).toFixed(1)}%)
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4 border-t border-line pt-2 text-base font-semibold text-gold">
                          <dt>= Price</dt>
                          <dd>{formatPeso(v.pricePhp)}</dd>
                        </div>
                      </>
                    )}
                  </dl>
                ) : (
                  <p className="mt-3 text-sm text-muted">
                    {purity === null
                      ? "Stones and mixed pieces have no melt value to compare against; judge them on their certificate and a physical inspection."
                      : "Live metal prices are unavailable right now, so the melt value can't be computed."}
                  </p>
                )}
                <p className="mt-3 text-xs text-muted">Spot from the Luxx4less price engine. Melt value is the metal alone, before any dealer spread; for reference only.</p>
              </section>

              {listing.luxxTestedAt && (
                <section className="flex gap-3 rounded-2xl border border-ice/25 bg-ice-tint p-5">
                  <FlaskConical className="mt-0.5 size-5 shrink-0 text-ice" aria-hidden />
                  <div>
                    <p className="font-semibold text-fg">Luxx-Tested</p>
                    <p className="text-sm text-muted">
                      {listing.luxxTestResult} · tested at Luxx4less on {listing.luxxTestedAt.toLocaleDateString("en-PH", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                </section>
              )}

              <section aria-labelledby="specs-title">
                <h2 id="specs-title" className="font-display text-sm tracking-[0.2em] text-champagne uppercase">
                  Details
                </h2>
                <dl className="mt-3 grid gap-x-6 sm:grid-cols-2">
                  {specs.map((s) => (
                    <div key={s.label} className="flex justify-between gap-4 border-b border-line py-2.5 text-sm">
                      <dt className="text-muted">{s.label}</dt>
                      <dd className="text-right font-semibold text-fg tabular">{s.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-5 text-sm leading-relaxed whitespace-pre-line text-fg/90">{listing.description}</div>
              </section>

              {stats && <SellerCard handle={handle} displayName={sellerName} place={placeLabel(listing.seller.profile?.cityCode, listing.seller.profile?.regionCode)} stats={stats} />}

              <aside className="flex gap-3 rounded-2xl border border-line p-5 text-sm">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-champagne" aria-hidden />
                <div className="text-muted">
                  <p className="font-semibold text-fg">How you&rsquo;re protected</p>
                  <p className="mt-1">
                    Your payment waits in a protected hold and reaches the seller only after you confirm the item. You can open a dispute until then. Luxx4less will never
                    ask you to pay outside the platform.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: listing.title,
          sku: listing.code,
          description: listing.description.slice(0, 500),
          ...(photos[0] ? { image: photos.map((p) => p.url) } : {}),
          ...(listing.metal ? { material: labelOf(METALS, listing.metal) } : {}),
          weight: { "@type": "QuantitativeValue", value: Number(listing.weightGrams), unitCode: "GRM" },
          ...(v.pricePhp !== null
            ? {
                offers: {
                  "@type": "Offer",
                  price: v.pricePhp,
                  priceCurrency: "PHP",
                  availability: available ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
                  itemCondition: "https://schema.org/UsedCondition",
                  url: `/marketplace/${listing.code}`,
                  seller: { "@type": "Person", name: sellerName },
                },
              }
            : {}),
        }}
      />
    </>
  );
}
