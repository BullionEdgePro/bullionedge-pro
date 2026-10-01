import type { Metadata } from "next";
import Link from "next/link";
import { Crown, HandCoins, ShieldCheck, ShoppingBag, Store } from "lucide-react";
import { EmptyState } from "@/components/marketplace/empty-state";
import { JsonLd } from "@/components/marketplace/json-ld";
import { GoldRule, Reveal, RisingWords } from "@/components/motion/reveal";
import { ProductCard } from "@/components/shop/product-card";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { CATEGORIES } from "@/config/catalog";
import { cn } from "@/lib/cn";
import { SHOP_SORTS, listShopProducts, type ShopSort } from "@/lib/server/shop/products";
import { sweepUnpaidOrders } from "@/lib/server/shop/orders";
import { getShopSettings } from "@/lib/server/shop/settings";
import { getViewer } from "@/lib/server/viewer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Official shop",
  description: `Gold jewellery and bullion sold by ${brand.publicName} itself, priced live from today's gold price. Layaway, pickup in store, delivery or cash on delivery.`,
  alternates: { canonical: "/shop" },
};

type Props = { searchParams: Promise<Record<string, string | undefined>> };

const PROMISES = [
  { icon: Crown, title: "Sold by Luxx4less", body: `Our own pieces, tested in house. Legit gold since ${brand.established}.` },
  { icon: HandCoins, title: "Layaway (hulugan)", body: "A down payment reserves the piece; pay the rest monthly." },
  { icon: Store, title: "Pick up, delivery or meet-up", body: "Pay in store, by GCash or bank, or cash on delivery." },
  { icon: ShieldCheck, title: "Priced from today's gold", body: "Every price sits beside its live melt value." },
] as const;

export default async function ShopPage({ searchParams }: Props) {
  const sp = await searchParams;
  const category = CATEGORIES.find((c) => c.value === sp.category)?.value;
  const sort = (SHOP_SORTS.find((s) => s.key === sp.sort)?.key ?? "featured") as ShopSort;
  await sweepUnpaidOrders();
  const [viewer, cards, settings] = await Promise.all([getViewer(), listShopProducts({ category, sort }), getShopSettings()]);
  const allCards = category ? await listShopProducts({}) : cards;
  const used = new Set(allCards.map((c) => c.category));
  const cats = CATEGORIES.filter((c) => used.has(c.value));
  const href = (q: { category?: string; sort?: string }) => {
    const p = new URLSearchParams();
    if (q.category) p.set("category", q.category);
    if (q.sort && q.sort !== "featured") p.set("sort", q.sort);
    const s = p.toString();
    return `/shop${s ? `?${s}` : ""}`;
  };

  const ld = cards.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: cards.slice(0, 24).map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "Product",
            name: c.title,
            sku: c.code,
            brand: { "@type": "Brand", name: brand.siteName },
            ...(c.valuation.pricePhp !== null
              ? { offers: { "@type": "Offer", price: c.valuation.pricePhp, priceCurrency: "PHP", availability: c.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/SoldOut", url: `/shop/${c.code}` } }
              : {}),
          },
        })),
      }
    : null;

  return (
    <>
      <SiteHeader signedIn={Boolean(viewer)} />
      <main className="surface-velvet">
        <section className="relative isolate overflow-hidden">
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(70%_120%_at_85%_0%,rgb(214_178_110/0.16),transparent_60%),radial-gradient(50%_80%_at_0%_100%,rgb(214_178_110/0.06),transparent_70%)]" />
          <div className="mx-auto grid max-w-7xl gap-8 px-4 pt-14 pb-10 sm:px-8 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:pt-20">
            <div>
              <Reveal>
                <p className="flex items-center gap-2 font-display text-xs tracking-[0.32em] text-champagne uppercase">
                  <Crown className="size-4" aria-hidden /> The official Luxx4less shop
                </p>
              </Reveal>
              <RisingWords as="h1" text="From our vault to your hands." className="mt-4 max-w-3xl text-4xl text-pearl sm:text-5xl" delay={0.1} />
              <Reveal delay={0.3}>
                <p className="measure mt-5 text-base text-muted sm:text-lg">
                  Pieces sold by {brand.publicName} itself. Reserve online, then pay in store, by GCash or bank transfer, or in cash on delivery.
                  {settings.layawayEnabled ? ` Layaway from ${settings.layawayDownPct}% down.` : ""}
                </p>
              </Reveal>
              {viewer && (
                <Reveal delay={0.45}>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <Button asChild size="lg" variant="secondary" className="rounded-full">
                      <Link href="/shop/bag">
                        <ShoppingBag aria-hidden /> Your bag
                      </Link>
                    </Button>
                    <Button asChild size="lg" variant="ghost" className="rounded-full">
                      <Link href="/account/orders">Your orders</Link>
                    </Button>
                  </div>
                </Reveal>
              )}
            </div>
            <Reveal delay={0.3}>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {PROMISES.map((t) => (
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

        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-8">
          {allCards.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <nav aria-label="Categories" className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface-sunk/60 p-1">
                {[{ value: "", label: "All" }, ...cats].map((c) => {
                  const active = (category ?? "") === c.value;
                  return (
                    <Link
                      key={c.value || "all"}
                      href={href({ category: c.value || undefined, sort })}
                      aria-current={active ? "page" : undefined}
                      className={cn("rounded-full px-4 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors", active ? "bg-gold-tint text-champagne ring-1 ring-champagne/40" : "text-muted hover:text-fg")}
                    >
                      {c.label}
                    </Link>
                  );
                })}
              </nav>
              <nav aria-label="Sort" className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                {SHOP_SORTS.map((s) => (
                  <Link key={s.key} href={href({ category, sort: s.key })} aria-current={sort === s.key ? "true" : undefined} className={cn("inline-block py-1.5 font-semibold", sort === s.key ? "text-champagne" : "text-muted hover:text-fg")}>
                    {s.label}
                  </Link>
                ))}
              </nav>
            </div>
          )}

          {cards.length === 0 ? (
            <EmptyState
              title={allCards.length ? "Nothing in this category right now" : "New pieces are on their way"}
              body={allCards.length ? "Try another category, or see everything." : "Our first pieces are being photographed. Meanwhile, browse the verified marketplace."}
              actions={
                <Button asChild variant="secondary">
                  <Link href={allCards.length ? "/shop" : "/marketplace"}>{allCards.length ? "See everything" : "Browse the marketplace"}</Link>
                </Button>
              }
            />
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {cards.map((c, i) => (
                <li key={c.id}>
                  <ProductCard card={c} priority={i < 4} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <SiteFooter />
      {ld && <JsonLd data={ld} />}
    </>
  );
}
