import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, ChartLine, Crown, HandCoins, MapPin, ShieldCheck } from "lucide-react";
import { LiveLivingGram } from "@/components/hero/living-gram";
import { CountUp } from "@/components/home/count-up";
import { HomeFaq } from "@/components/home/faq";
import { MarketStrip } from "@/components/home/market-strip";
import { VerificationScene } from "@/components/home/verification-scene";
import { TradeTape } from "@/components/marketplace/trade-tape";
import { Magnetic } from "@/components/motion/magnetic";
import { GoldRule, Reveal, RisingWords } from "@/components/motion/reveal";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { JsonLd } from "@/components/tools/tool-page";
import { QuickValue } from "@/components/tools/quick-value";
import { ProductCard } from "@/components/shop/product-card";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { env } from "@/lib/server/env";
import { getMarket } from "@/lib/server/prices/engine";
import { featuredProducts } from "@/lib/server/shop/products";
import { getViewer } from "@/lib/server/viewer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: `${brand.publicName} — gold price per gram today, verified marketplace` },
  description:
    "Today's gold price per gram in the Philippines, live. Buy from ID-verified sellers, sell your gold to Luxx4less, and check any offer against melt value. Since 2019.",
  alternates: { canonical: "/" },
};

const DOORS = [
  {
    href: "/marketplace",
    icon: ShieldCheck,
    title: "Buy from verified sellers",
    body: "Gold, silver and gems from people who have shown a government ID and a live selfie.",
    cta: "Browse the marketplace",
  },
  {
    href: "/shop",
    icon: Crown,
    title: "Shop Luxx4less",
    body: "Our own pieces, priced from today's gold. Layaway, pickup in store, delivery or cash on delivery.",
    cta: "Visit the shop",
  },
  {
    href: "/sell",
    icon: HandCoins,
    title: "Sell to Luxx4less",
    body: "An instant estimate at today's price, then an appointment to weigh and test your piece in store.",
    cta: "Get an estimate",
  },
  {
    href: "/tools",
    icon: ChartLine,
    title: "Check prices and offers",
    body: "Per-gram prices for every karat, a value calculator, and a check that flags offers too cheap to be real.",
    cta: "Open the tools",
  },
] as const;

export default async function Home() {
  const [viewer, market, vault] = await Promise.all([getViewer(), getMarket(), featuredProducts(4)]);
  const branches = brand.branches.filter((b) => !("confirm" in b && b.confirm));
  const fb = brand.social.facebookFollowers;
  const base = env().BETTER_AUTH_URL.replace(/\/$/, "");

  const orgLd = {
    "@context": "https://schema.org",
    "@type": "JewelryStore",
    name: brand.publicName,
    legalName: brand.legalName,
    foundingDate: String(brand.established),
    url: base,
    sameAs: [brand.social.facebookUrl],
    address: {
      "@type": "PostalAddress",
      addressLocality: brand.location.city,
      addressRegion: brand.location.province,
      addressCountry: "PH",
    },
  };

  return (
    <>
      <SiteHeader signedIn={Boolean(viewer)} overlay />
      <JsonLd data={orgLd} />

      <main className="surface-velvet">
        <LiveLivingGram
          initial={market}
          actions={
            <>
              <Magnetic>
                <Button asChild size="lg">
                  <Link href="/marketplace">Browse the marketplace</Link>
                </Button>
              </Magnetic>
              <Button asChild size="lg" variant="secondary">
                <Link href="/sell">Sell your gold</Link>
              </Button>
              <Button asChild size="lg" variant="quiet" className="basis-full justify-center sm:basis-auto">
                <Link href="/prices">Check today&rsquo;s prices</Link>
              </Button>
            </>
          }
        >
          {/* The bar settles into this band as the hero releases. */}
          <section aria-label="Metal prices today" className="relative z-10 bg-bg px-4 pt-16 pb-20 sm:px-6">
            <div className="mx-auto max-w-6xl">
              <MarketStrip initial={market} />
            </div>
          </section>
        </LiveLivingGram>

        {/* ----------------------------------------------------------- what you can do */}
        <section aria-labelledby="doors-title" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <GoldRule className="mb-14 w-full" />
          <Reveal>
            <h2 id="doors-title" className="max-w-2xl text-3xl text-pearl sm:text-4xl">
              What you can do here
            </h2>
          </Reveal>
          <ul className="mt-12 grid gap-4 lg:grid-cols-12">
            {DOORS.map((d, i) => {
              const Icon = d.icon;
              const lead = i === 0;
              return (
                <li key={d.title} className={lead ? "lg:col-span-7 lg:row-span-3" : "lg:col-span-5"}>
                  <Link
                    href={d.href}
                    className={
                      lead
                        ? "group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-champagne/30 bg-surface p-7 transition-[border-color,box-shadow] duration-500 hover:border-champagne/60 hover:shadow-[0_30px_80px_-40px_rgb(214_178_110/0.6)] sm:p-10"
                        : "group flex h-full gap-5 rounded-2xl border border-line bg-surface p-6 transition-colors duration-300 hover:border-champagne/40 hover:bg-surface-sunk"
                    }
                  >
                    {lead ? (
                      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_85%_0%,rgb(214_178_110/0.16),transparent_70%)]" />
                    ) : null}
                    <Icon className={lead ? "relative size-8 text-champagne" : "mt-1 size-5 shrink-0 text-champagne"} aria-hidden />
                    <span className={lead ? "relative mt-16 block" : "block"}>
                      <span className={lead ? "block font-display text-3xl text-fg sm:text-4xl" : "block font-display text-xl text-fg"}>{d.title}</span>
                      <span className={lead ? "measure mt-4 block text-muted" : "mt-2 block text-sm text-muted"}>{d.body}</span>
                      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gold">
                        {d.cta}
                        <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ----------------------------------------------------------- official shop */}
        {vault.length > 0 && (
          <section aria-labelledby="vault-title" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:pb-28">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <Reveal>
                <p className="flex items-center gap-2 font-display text-xs tracking-[0.32em] text-champagne uppercase">
                  <Crown className="size-4" aria-hidden /> Official shop
                </p>
                <h2 id="vault-title" className="mt-3 text-3xl text-pearl sm:text-4xl">
                  From our vault
                </h2>
              </Reveal>
              <Link href="/shop" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold hover:underline">
                See every piece <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            </div>
            <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {vault.map((c) => (
                <li key={c.id}>
                  <ProductCard card={c} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ----------------------------------------------------------- verification */}
        <div className="border-y border-line bg-surface-sunk">
          <VerificationScene />
        </div>

        {/* ----------------------------------------------------------- trade tape */}
        <section aria-labelledby="tape-title" className="py-12 lg:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 id="tape-title" className="font-display text-xs tracking-[0.32em] text-champagne uppercase">
              Recently traded on the marketplace
            </h2>
          </div>
          <div className="mt-6">
            <TradeTape />
          </div>
        </section>

        {/* ----------------------------------------------------------- trust wall */}
        <section aria-labelledby="trust-title" className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <Reveal>
              <p className="font-display text-xs tracking-[0.32em] text-champagne uppercase">{brand.publicName}</p>
            </Reveal>
            <RisingWords text={brand.tagline.en} className="mt-4 text-3xl text-pearl sm:text-5xl" />
            <span id="trust-title" className="sr-only">
              About {brand.siteName}
            </span>

            <dl className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
              <div className="bg-surface p-6 sm:p-8">
                <dt className="text-sm text-muted">Selling gold since</dt>
                <dd className="mt-2 font-display text-5xl text-gold-metal">
                  <CountUp value={brand.established} format="plain" />
                </dd>
                <dd className="mt-2 text-sm text-muted">
                  {brand.location.city}, {brand.location.province}
                </dd>
              </div>
              {!fb.confirm && fb.value ? (
                <div className="bg-surface p-6 sm:p-8">
                  <dt className="text-sm text-muted">Facebook followers</dt>
                  <dd className="mt-2 font-display text-5xl text-fg">
                    <CountUp value={fb.value} format="thousands" />
                  </dd>
                  <dd className="mt-2 text-sm">
                    <a href={brand.social.facebookUrl} target="_blank" rel="noreferrer noopener" className="text-gold underline-offset-4 hover:underline">
                      Our official page
                    </a>
                  </dd>
                </div>
              ) : null}
              <div className="bg-surface p-6 sm:p-8 sm:col-span-2 lg:col-span-1">
                <dt className="text-sm text-muted">Branches you can walk into</dt>
                <dd className="mt-2 font-display text-5xl text-fg">
                  <span className="tabular">{branches.length}</span>
                </dd>
                {branches.map((b) => (
                  <dd key={b.name} className="mt-2 flex items-start gap-2 text-sm text-muted">
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-champagne" aria-hidden />
                    <span>
                      <span className="text-fg">{b.name}</span> · {b.address}
                    </span>
                  </dd>
                ))}
              </div>
            </dl>
            <p className="mt-6 text-sm">
              <Link href="/about" className="text-gold underline-offset-4 hover:underline">
                Meet the people behind the counter
              </Link>
            </p>
          </div>
        </section>

        {/* ----------------------------------------------------------- calculator */}
        <section aria-labelledby="value-title" className="border-t border-line bg-surface-sunk">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:py-24">
            <div className="lg:col-span-4">
              <h2 id="value-title" className="text-3xl text-pearl sm:text-4xl">
                What is your gold worth?
              </h2>
              <p className="measure mt-4 text-muted">Type the weight and pick the karat. The value moves with today&rsquo;s price.</p>
            </div>
            <div className="lg:col-span-8">
              <QuickValue initial={market} />
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------- faq */}
        <section aria-labelledby="faq-title" className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:py-28">
          <div className="lg:col-span-4">
            <h2 id="faq-title" className="text-3xl text-pearl sm:text-4xl">
              Buying gold safely
            </h2>
            <p className="measure mt-4 text-muted">Short answers to what people ask us most about real and fake gold.</p>
          </div>
          <div className="lg:col-span-8">
            <HomeFaq />
          </div>
        </section>

        {/* ----------------------------------------------------------- final cta */}
        <section className="relative overflow-hidden border-t border-line">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_100%,rgb(214_178_110/0.14),transparent_70%)]" />
          <div className="relative mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 lg:py-32">
            <RisingWords text={viewer ? "Welcome back" : "Open your account"} className="text-3xl text-pearl sm:text-5xl" />
            <p className="measure mx-auto mt-5 text-muted">
              {viewer
                ? "Your verification, alerts and trades are waiting in your account."
                : "Start with step one: confirm your email. Price alerts and your wishlist unlock straight away."}
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link href={viewer ? "/account" : "/sign-up"}>{viewer ? "Go to your account" : "Create your account"}</Link>
              </Button>
              {!viewer ? (
                <Button asChild size="lg" variant="secondary">
                  <Link href="/sign-in">Sign in</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
