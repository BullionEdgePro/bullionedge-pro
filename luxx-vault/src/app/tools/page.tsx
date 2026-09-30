import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, ArrowUpRight, Calculator, ChartLine, HandCoins, ShieldAlert, Stamp } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Button } from "@/components/ui/button";
import { purityFromKarat } from "@/lib/market";
import { formatPerGram, marketStatus } from "@/lib/prices-format";
import { getMarket } from "@/lib/server/prices/engine";
import { getSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gold tools — calculator, offer check and hallmarks",
  description:
    "Free tools for buying and selling gold in the Philippines: a gold value calculator, a fair-price check for any offer, a hallmark reader and a weight converter.",
  alternates: { canonical: "/tools" },
};

const MORE = [
  {
    href: "/tools/price-check",
    icon: ShieldAlert,
    title: "Check an offer",
    body: "Paste an asking price and weight. We compare it with melt value and flag prices that are too good to be true.",
  },
  {
    href: "/tools/hallmark",
    icon: Stamp,
    title: "Read a hallmark",
    body: "What 750, 916, 18K or 21K stamped inside a ring actually means, and which stamps to be wary of.",
  },
  {
    href: "/prices#converter",
    icon: ArrowLeftRight,
    title: "Weight converter",
    body: "Troy ounces, grams, kilograms, tola and tael, both ways.",
  },
  {
    href: "/prices",
    icon: ChartLine,
    title: "Today's prices",
    body: "Per-gram prices for every karat, charts and how each metal has moved.",
  },
  {
    href: "/sell",
    icon: HandCoins,
    title: "Sell to Luxx4less",
    body: "An instant estimate, then a quote and an appointment to test your piece in store.",
  },
] as const;

export default async function ToolsPage() {
  const [session, market] = await Promise.all([getSession(), getMarket()]);
  const gold = market.metals.gold;
  const status = marketStatus(market);

  return (
    <>
      <SiteHeader signedIn={Boolean(session)} />
      <main className="surface-velvet">
        <section className="mx-auto max-w-6xl px-4 pt-10 pb-24 sm:px-6 lg:pt-16">
          <Reveal>
            <p className="font-display text-xs tracking-[0.32em] text-champagne uppercase">Tools</p>
            <h1 className="mt-4 max-w-3xl text-3xl text-pearl sm:text-5xl">Know what it&rsquo;s worth before you buy or sell</h1>
            <p className="measure mt-5 text-muted">Free, on today&rsquo;s prices, no account needed.</p>
          </Reveal>

          {/* The main tool gets the editorial card */}
          <Link
            href="/tools/calculator"
            className="group relative mt-12 grid overflow-hidden rounded-2xl border border-champagne/30 bg-surface p-6 transition-[border-color,box-shadow] duration-500 hover:border-champagne/60 hover:shadow-[0_30px_80px_-40px_rgb(214_178_110/0.6)] sm:p-10 lg:grid-cols-12 lg:items-end"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_90%_10%,rgb(214_178_110/0.14),transparent_70%)]"
            />
            <div className="relative lg:col-span-7">
              <Calculator className="size-7 text-champagne" aria-hidden />
              <h2 className="mt-5 text-2xl text-fg sm:text-4xl">Gold value calculator</h2>
              <p className="measure mt-3 text-muted">
                Karat or fineness, weight in any unit, or a specific-gravity reading. See the melt value in pesos at today&rsquo;s price.
              </p>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-gold">
                Open the calculator <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
              </span>
            </div>
            <dl className="tabular relative mt-8 grid grid-cols-3 gap-4 border-t border-line pt-6 lg:col-span-5 lg:mt-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
              {[24, 21, 18].map((k) => (
                <div key={k}>
                  <dt className="font-display text-sm text-champagne">{k}K</dt>
                  <dd className="mt-1 text-lg font-semibold text-fg sm:text-xl">{formatPerGram(gold ? gold.phpPerGram * purityFromKarat(k) : null)}</dd>
                  <dd className="text-xs text-muted">per gram</dd>
                </div>
              ))}
              <p className="col-span-3 text-xs text-muted">{status.text}</p>
            </dl>
          </Link>

          <ul className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
            {MORE.map(({ href, icon: Icon, title, body }) => (
              <li key={href} className="bg-surface">
                <Link href={href} className="group flex h-full gap-4 p-6 transition-colors hover:bg-surface-sunk">
                  <Icon className="mt-1 size-5 shrink-0 text-champagne" aria-hidden />
                  <span>
                    <span className="flex items-center gap-1.5 font-display text-lg text-fg">
                      {title}
                      <ArrowUpRight className="size-4 text-muted transition-[color,translate] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-gold" aria-hidden />
                    </span>
                    <span className="mt-1.5 block text-sm text-muted">{body}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-16 flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-line p-6 sm:p-8">
            <p className="measure text-muted">
              Thinking of selling? Get an instant estimate, then bring the piece in so we can test it and make you a real offer.
            </p>
            <Button asChild>
              <Link href="/sell">Sell your gold</Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
