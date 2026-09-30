import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, HandCoins, PackageSearch, ShieldCheck, Store } from "lucide-react";
import { EmptyState } from "@/components/marketplace/empty-state";
import { FilterBar } from "@/components/marketplace/filter-bar";
import { JsonLd } from "@/components/marketplace/json-ld";
import { ListingCard } from "@/components/marketplace/listing-card";
import { MarketStatsPanel } from "@/components/marketplace/market-stats";
import { Pagination } from "@/components/marketplace/pagination";
import { TradeTape } from "@/components/marketplace/trade-tape";
import { WantedCard } from "@/components/marketplace/wanted-card";
import { GoldRule, Reveal, RisingWords } from "@/components/motion/reveal";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { db } from "@/lib/server/db";
import { marketStats, searchListings, searchWanted, sweepExpired } from "@/lib/server/marketplace/listings";
import { parseFilters, toQuery } from "@/lib/server/marketplace/search-params";
import { getViewer } from "@/lib/server/viewer";

export const metadata: Metadata = {
  title: "Verified gold marketplace",
  description:
    "Buy and sell gold, silver and diamonds with ID-verified people in the Philippines. Live melt value on every listing, payment held until you confirm the item.",
  alternates: { canonical: "/marketplace" },
};

const TRUST_POINTS = [
  { icon: BadgeCheck, title: "Every trader is ID-verified", body: "Government ID, a live selfie and a face match before anyone can buy, sell or chat." },
  { icon: HandCoins, title: "Payment held until you confirm", body: "The seller is paid only after you say the item arrived as described." },
  { icon: ShieldCheck, title: "Scam signals flagged", body: "Outside payment requests, numbers and links in chat get a warning for both sides." },
];

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams);
  await sweepExpired();
  const viewer = await getViewer();
  const [stats, sale, wanted] = await Promise.all([
    marketStats(),
    filters.tab === "sale" ? searchListings(filters) : null,
    filters.tab === "wanted" ? searchWanted(filters) : null,
  ]);
  const savedIds = viewer && sale?.items.length
    ? new Set((await db.savedListing.findMany({ where: { userId: viewer.userId, listingId: { in: sale.items.map((i) => i.id) } }, select: { listingId: true } })).map((s) => s.listingId))
    : new Set<string>();
  const result = sale ?? wanted!;
  const canSell = Boolean(viewer && viewer.tier >= 4);

  const jsonLd = sale
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Luxx4less marketplace listings",
        numberOfItems: sale.total,
        itemListElement: sale.items.map((c, i) => ({
          "@type": "ListItem",
          position: (sale.page - 1) * 24 + i + 1,
          url: `/marketplace/${c.code}`,
          item: {
            "@type": "Product",
            name: c.title,
            sku: c.code,
            ...(c.valuation.pricePhp !== null
              ? { offers: { "@type": "Offer", price: c.valuation.pricePhp, priceCurrency: "PHP", availability: "https://schema.org/InStock", url: `/marketplace/${c.code}` } }
              : {}),
          },
        })),
      }
    : null;

  return (
    <>
      <SiteHeader signedIn={Boolean(viewer)} />
      <main className="surface-velvet">
        {/* ------------------------------------------------ opening */}
        <section className="relative isolate overflow-hidden">
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(70%_120%_at_85%_0%,rgb(214_178_110/0.12),transparent_60%),radial-gradient(50%_80%_at_0%_100%,rgb(191_216_228/0.05),transparent_70%)]" />
          <div className="mx-auto grid max-w-7xl gap-8 px-4 pt-14 pb-10 sm:px-8 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:pt-20">
            <div>
              <Reveal>
                <p className="font-display text-xs tracking-[0.32em] text-champagne uppercase">The verified marketplace</p>
              </Reveal>
              <RisingWords as="h1" text="Gold, traded between verified people." className="mt-4 max-w-3xl text-4xl text-pearl sm:text-5xl" delay={0.1} />
              <Reveal delay={0.3}>
                <p className="measure mt-5 text-base text-muted sm:text-lg">
                  Every listing shows its live melt value and how far the price sits above it. Every trader has shown a government ID. Every
                  payment waits in a protected hold until the buyer confirms.
                </p>
              </Reveal>
              <Reveal delay={0.45}>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Button asChild size="lg" className="rounded-full">
                    <Link href="/marketplace/sell">
                      <Store aria-hidden /> Sell an item
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="secondary" className="rounded-full">
                    <Link href="/marketplace/wanted/new">
                      <PackageSearch aria-hidden /> Post a wanted request
                    </Link>
                  </Button>
                </div>
              </Reveal>
            </div>
            <Reveal delay={0.3} className="hidden lg:block">
              <ul className="grid gap-4">
                {TRUST_POINTS.map((t) => (
                  <li key={t.title} className="flex gap-3">
                    <t.icon className="mt-0.5 size-5 shrink-0 text-champagne" aria-hidden />
                    <div>
                      <p className="text-sm font-semibold text-fg">{t.title}</p>
                      <p className="text-sm text-muted">{t.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
          <GoldRule className="mx-auto max-w-7xl" />
        </section>

        <TradeTape />

        {/* ------------------------------------------------ browse */}
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-8 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <aside className="order-last grid content-start gap-6 lg:order-first lg:sticky lg:top-28 lg:self-start">
            <MarketStatsPanel stats={stats} />
            <div className="rounded-2xl border border-line p-5 lg:hidden">
              <ul className="grid gap-4">
                {TRUST_POINTS.map((t) => (
                  <li key={t.title} className="flex gap-3">
                    <t.icon className="mt-0.5 size-5 shrink-0 text-champagne" aria-hidden />
                    <div>
                      <p className="text-sm font-semibold text-fg">{t.title}</p>
                      <p className="text-sm text-muted">{t.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <div className="grid min-w-0 content-start gap-6">
            <nav aria-label="Marketplace sections" className="flex gap-1 rounded-full border border-line bg-surface-sunk/60 p-1 sm:w-fit">
              {(
                [
                  { tab: "sale", label: "For sale", n: stats.activeListings },
                  { tab: "wanted", label: "Wanted", n: stats.openWanted },
                ] as const
              ).map((t) => (
                <Link
                  key={t.tab}
                  href={`/marketplace${toQuery({ ...parseFilters({}), tab: t.tab })}`}
                  aria-current={filters.tab === t.tab ? "page" : undefined}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors sm:flex-none",
                    filters.tab === t.tab ? "bg-gold-tint text-champagne ring-1 ring-champagne/40" : "text-muted hover:text-fg",
                  )}
                >
                  {t.label}
                  <span className="tabular text-xs opacity-80">{t.n}</span>
                </Link>
              ))}
            </nav>

            <FilterBar key={toQuery(filters)} filters={filters} total={result.total} />

            {sale && sale.items.length > 0 && (
              <ul className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 xl:grid-cols-3">
                {sale.items.map((card, i) => (
                  <li key={card.id}>
                    <ListingCard card={card} saved={savedIds.has(card.id)} signedIn={Boolean(viewer)} priority={i < 3} />
                  </li>
                ))}
              </ul>
            )}
            {wanted && wanted.items.length > 0 && (
              <ul className="grid gap-5 sm:grid-cols-2">
                {wanted.items.map((card) => (
                  <li key={card.id}>
                    <WantedCard card={card} />
                  </li>
                ))}
              </ul>
            )}

            {result.items.length === 0 &&
              (stats.activeListings === 0 && filters.tab === "sale" ? (
                <EmptyState
                  title="The floor is open, and the first pieces are on their way"
                  body={
                    <>
                      No one has listed an item yet. Verified sellers can post the first one, and buyers can post what they&rsquo;re looking for so
                      sellers come to them.
                    </>
                  }
                  actions={
                    <>
                      <Button asChild className="rounded-full">
                        <Link href="/marketplace/wanted/new">Post a wanted request</Link>
                      </Button>
                      <Button asChild variant="secondary" className="rounded-full">
                        <Link href={canSell ? "/marketplace/sell" : "/account/verification"}>{canSell ? "List the first item" : "Become a verified seller"}</Link>
                      </Button>
                    </>
                  }
                />
              ) : stats.openWanted === 0 && filters.tab === "wanted" ? (
                <EmptyState
                  title="No wanted posts yet"
                  body="Looking for a particular karat, weight or piece? Post it, and sellers with matching items are told straight away."
                  actions={
                    <Button asChild className="rounded-full">
                      <Link href="/marketplace/wanted/new">Post a wanted request</Link>
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  title="Nothing matches those filters"
                  body="Try a wider weight or price range, another region, or fewer filters. You can also post a wanted request and let sellers find you."
                  actions={
                    <>
                      <Button asChild variant="secondary" className="rounded-full">
                        <Link href={`/marketplace${toQuery({ ...parseFilters({}), tab: filters.tab })}`}>Clear filters</Link>
                      </Button>
                      <Button asChild className="rounded-full">
                        <Link href="/marketplace/wanted/new">Post a wanted request</Link>
                      </Button>
                    </>
                  }
                />
              ))}

            <Pagination page={result.page} pages={result.pages} hrefFor={(p) => `/marketplace${toQuery(filters, { page: p })}`} />
          </div>
        </div>
      </main>
      <SiteFooter />
      {jsonLd && sale && sale.items.length > 0 && <JsonLd data={jsonLd} />}
    </>
  );
}
