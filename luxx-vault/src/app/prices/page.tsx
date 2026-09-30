import type { Metadata } from "next";
import Link from "next/link";
import { Change } from "@/components/prices/change";
import { MarketStatusLine } from "@/components/prices/market-status";
import { PriceChart } from "@/components/prices/price-chart";
import { UnitConverter } from "@/components/prices/unit-converter";
import { GoldRule, Reveal } from "@/components/motion/reveal";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { brand } from "@/config/brand";
import { METALS, type Metal } from "@/config/catalog";
import { cn } from "@/lib/cn";
import { GRAMS_PER_TROY_OUNCE } from "@/lib/pricing";
import {
  DASH,
  findPublicSpread,
  finenessRows,
  formatManilaDate,
  formatManilaDateTime,
  formatPct,
  formatPerGram,
  formatPesoChange,
  formatUsd,
  karatRows,
  marketStatus,
} from "@/lib/prices-format";
import { env } from "@/lib/server/env";
import { getMarket } from "@/lib/server/prices/engine";
import { getPerformance, historyCoverage } from "@/lib/server/prices/history";
import { getSpreads } from "@/lib/server/prices/spreads";
import { getSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gold price per gram in the Philippines today",
  description:
    "Today's gold price per gram in pesos for 24K, 22K, 21K, 18K, 14K and 10K, plus silver, platinum and palladium: live spot in USD/oz, USD/PHP, 24-hour change, charts and a karat table.",
  alternates: { canonical: "/prices" },
  openGraph: {
    title: "Gold price per gram in the Philippines today",
    description: "Live ₱ per gram for every karat, with charts, performance and the formula behind each number.",
  },
};

const OTHER = ["silver", "platinum", "palladium"] as const;

export default async function PricesPage({ searchParams }: { searchParams: Promise<{ metal?: string }> }) {
  const { metal: asked } = await searchParams;
  const metal: Metal = METALS.some((m) => m.value === asked) ? (asked as Metal) : "gold";
  const metalInfo = METALS.find((m) => m.value === metal)!;

  const [session, market, spreads, coverage] = await Promise.all([getSession(), getMarket(), getSpreads(), historyCoverage()]);
  const current = market.metals[metal];
  const performance = current ? await getPerformance(metal, current.phpPerGram) : null;
  const status = marketStatus(market);

  const gold = market.metals.gold;
  const goldSpreads = spreads.filter((s) => s.metal === "gold" && s.productType === "jewelry");
  const karats = karatRows(gold?.phpPerGram ?? null);

  const sources = [...new Set(Object.values(market.metals).flatMap((m) => (m ? [m.source] : [])))];
  const base = env().BETTER_AUTH_URL.replace(/\/$/, "");
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${base}/prices`,
        url: `${base}/prices`,
        name: "Gold price per gram in the Philippines today",
        description: "Live per-gram prices of gold, silver, platinum and palladium in Philippine pesos.",
        dateModified: market.checkedAt,
        inLanguage: "en-PH",
        publisher: { "@type": "Organization", name: brand.publicName, url: base },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${base}/` },
          { "@type": "ListItem", position: 2, name: "Prices", item: `${base}/prices` },
        ],
      },
    ],
  };

  return (
    <>
      <SiteHeader signedIn={Boolean(session)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <main className="surface-velvet">
        {/* ------------------------------------------------------------ intro */}
        <section className="mx-auto max-w-6xl px-4 pt-10 pb-12 sm:px-6 lg:pt-16">
          <Reveal>
            <p className="font-display text-xs tracking-[0.32em] text-champagne uppercase">Market data</p>
            <h1 className="mt-4 max-w-3xl text-3xl text-pearl sm:text-5xl">Gold price per gram in the Philippines today</h1>
            <p className="measure mt-5 text-muted">
              Live melt value in pesos for every karat, worked out from the world spot price and today&rsquo;s exchange rate. It is the
              value of the metal alone: what a dealer pays or charges will differ.
            </p>
            <MarketStatusLine status={status} className="mt-5" />
          </Reveal>

          {/* Metal switcher */}
          <nav aria-label="Choose a metal" className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {METALS.map((m) => {
              const p = market.metals[m.value];
              const selected = m.value === metal;
              return (
                <Link
                  key={m.value}
                  href={m.value === "gold" ? "/prices" : `/prices?metal=${m.value}`}
                  scroll={false}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "group rounded-xl border p-4 transition-[border-color,background-color,box-shadow] duration-300 sm:p-5",
                    selected
                      ? "border-champagne/70 bg-gold-tint shadow-[0_0_0_1px_rgb(214_178_110/0.25),0_18px_40px_-24px_rgb(214_178_110/0.6)]"
                      : "border-line bg-surface hover:border-champagne/40",
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("font-display text-sm tracking-[0.14em] uppercase", selected ? "text-champagne" : "text-fg")}>
                      {m.label}
                    </span>
                    <span className="text-xs text-muted">{m.symbol}</span>
                  </span>
                  <span className="tabular mt-3 block text-lg font-semibold whitespace-nowrap text-fg sm:text-2xl">
                    {formatPerGram(p?.phpPerGram)}
                    <span className="text-sm font-normal text-muted">/g</span>
                  </span>
                  <span className="tabular mt-1 flex flex-wrap items-center justify-between gap-x-3 text-xs text-muted">
                    <span>{formatUsd(p?.usdPerOz)}/oz</span>
                    <Change pct={p?.change24hPct} />
                  </span>
                </Link>
              );
            })}
          </nav>
          <p className="tabular mt-3 text-xs text-muted">
            Pure metal per gram · USD/PHP {market.usdPhp ? market.usdPhp.toFixed(4) : DASH}
            {market.fxSource ? ` (${market.fxSource})` : ""} · 24h change needs a day of our own readings, so it may show {DASH} at first.
          </p>
        </section>

        {/* ------------------------------------------------------- chart + performance */}
        <section aria-labelledby="chart-title" className="border-y border-line bg-surface-sunk">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:py-20">
            <div className="lg:col-span-8">
              <h2 id="chart-title" className="text-2xl text-fg sm:text-3xl">
                {metalInfo.label} price history
              </h2>
              <div className="mt-6">
                <PriceChart key={metal} metal={metal} metalLabel={metalInfo.label} coverageStart={coverage[metal]} />
              </div>
            </div>

            <div className="lg:col-span-4">
              <h2 className="text-2xl text-fg sm:text-3xl">Performance</h2>
              <p className="mt-2 text-sm text-muted">{metalInfo.label}, ₱ per gram of pure metal, against the close on each date.</p>
              <table className="tabular mt-6 w-full text-sm">
                <caption className="sr-only">{metalInfo.label} price change over time</caption>
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th scope="col" className="py-2 font-medium">
                      Period
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      ₱ / g
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(performance ?? []).map((row) => (
                    <tr key={row.label} className="border-b border-line/60">
                      <th scope="row" className="py-3 text-left font-medium text-fg">
                        {row.label}
                      </th>
                      <td className={cn("py-3 text-right", row.changePhp == null ? "text-muted" : row.changePhp >= 0 ? "text-success" : "text-danger")}>
                        {formatPesoChange(row.changePhp)}
                      </td>
                      <td className={cn("py-3 text-right", row.changePct == null ? "text-muted" : row.changePct >= 0 ? "text-success" : "text-danger")}>
                        {formatPct(row.changePct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!performance ? <p className="mt-4 text-sm text-warning">No current {metalInfo.label.toLowerCase()} price to compare against.</p> : null}
              <p className="mt-4 text-xs text-muted">
                {DASH} means our history doesn&rsquo;t reach back that far yet
                {coverage[metal] ? ` (it starts ${formatManilaDate(coverage[metal]!)})` : ""}.
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ karat table */}
        <section aria-labelledby="karat-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <GoldRule className="mb-12 w-full" />
          <h2 id="karat-title" className="text-2xl text-fg sm:text-3xl">
            Gold price per karat
          </h2>
          <p className="measure mt-3 text-muted">
            The karat tells you how many parts in 24 are pure gold. 18K is 18 parts gold and 6 parts other metals, or 75%.
          </p>

          <div className="mt-8 overflow-x-auto rounded-xl border border-line">
            <table className="tabular w-full min-w-[34rem] text-sm">
              <caption className="sr-only">Gold price per gram by karat, today</caption>
              <thead className="bg-surface text-left text-xs text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Karat
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Purity
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Parts per 24
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Melt value ₱/g
                  </th>
                  {goldSpreads.length ? (
                    <>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        We buy at
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        We sell at
                      </th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {karats.map((row) => {
                  const s = findPublicSpread(goldSpreads, "gold", row.karat);
                  return (
                    <tr key={row.karat} className="border-t border-line/70">
                      <th scope="row" className="px-4 py-3 text-left font-display text-base text-champagne">
                        {row.karat}K
                      </th>
                      <td className="px-4 py-3 text-right text-muted">{row.purityPct.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right text-muted">{row.partsPer24}</td>
                      <td className="px-4 py-3 text-right font-semibold text-fg">{formatPerGram(row.phpPerGram)}</td>
                      {goldSpreads.length ? (
                        <>
                          <td className="px-4 py-3 text-right text-fg">{s && row.phpPerGram ? formatPerGram(row.phpPerGram * s.buyRatio) : DASH}</td>
                          <td className="px-4 py-3 text-right text-fg">{s && row.phpPerGram ? formatPerGram(row.phpPerGram * s.sellRatio) : DASH}</td>
                        </>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-muted">
            {goldSpreads.length
              ? "“We buy” and “We sell” are Luxx4less’s prices for jewellery at today’s spot, set by the shop. Each piece is still weighed and tested in store before a final price."
              : "Luxx4less shop prices for buying and selling are confirmed in store, after each piece is weighed and tested."}
          </p>

          {/* Other metals */}
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {OTHER.map((m) => {
              const p = market.metals[m];
              const rows = finenessRows(m, p?.phpPerGram ?? null);
              const own = spreads.filter((s) => s.metal === m && s.productType === "jewelry");
              const label = METALS.find((x) => x.value === m)!.label;
              return (
                <div key={m}>
                  <h3 className="text-lg text-fg">{label} by fineness</h3>
                  <table className="tabular mt-4 w-full text-sm">
                    <caption className="sr-only">{label} price per gram by fineness</caption>
                    <thead>
                      <tr className="border-b border-line text-left text-xs text-muted">
                        <th scope="col" className="py-2 font-medium">
                          Fineness
                        </th>
                        <th scope="col" className="py-2 text-right font-medium">
                          ₱/g
                        </th>
                        {own.length ? (
                          <th scope="col" className="py-2 text-right font-medium">
                            We buy
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const s = findPublicSpread(own, m, r.permille);
                        return (
                          <tr key={r.permille} className="border-b border-line/60">
                            <th scope="row" className="py-2.5 text-left font-medium text-fg">
                              {r.permille} <span className="font-normal text-muted">({r.purityPct.toFixed(1)}%)</span>
                            </th>
                            <td className="py-2.5 text-right text-fg">{formatPerGram(r.phpPerGram)}</td>
                            {own.length ? <td className="py-2.5 text-right text-fg">{s && r.phpPerGram ? formatPerGram(r.phpPerGram * s.buyRatio) : DASH}</td> : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </section>

        {/* ------------------------------------------------------------ converter */}
        <section id="converter" aria-labelledby="converter-title" className="scroll-mt-28 border-t border-line bg-surface-sunk">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <h2 id="converter-title" className="text-2xl text-fg sm:text-3xl">
              Weight converter
            </h2>
            <p className="measure mt-3 text-muted">Troy ounces, grams, kilograms, tola and tael, both ways.</p>
            <div className="mt-8">
              <UnitConverter />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ method + sources */}
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-20">
          <details className="group self-start rounded-xl border border-line bg-surface p-5 open:border-champagne/40 sm:p-6">
            <summary className="cursor-pointer list-none font-display text-lg text-fg marker:hidden">
              <span className="flex items-center justify-between gap-4">
                How we work out each price
                <span aria-hidden className="text-champagne transition-transform duration-300 group-open:rotate-45">
                  +
                </span>
              </span>
            </summary>
            <div className="mt-4 grid gap-3 text-sm text-muted">
              <p className="tabular rounded-lg bg-surface-sunk px-4 py-3 text-fg">
                ₱ per gram = (USD per troy ounce × USD/PHP) ÷ {GRAMS_PER_TROY_OUNCE} × purity
              </p>
              <p>
                Spot prices are quoted in US dollars per troy ounce ({GRAMS_PER_TROY_OUNCE} g). We convert to pesos with the day&rsquo;s
                USD/PHP rate, divide by the grams in a troy ounce, then multiply by the purity: 0.999 for 24K, 0.916 for 22K, 0.875 for 21K,
                0.75 for 18K and so on.
              </p>
              {gold && market.usdPhp ? (
                <p className="tabular">
                  Today, 18K: ({formatUsd(gold.usdPerOz)} × {market.usdPhp.toFixed(4)}) ÷ {GRAMS_PER_TROY_OUNCE} × 0.75 ={" "}
                  <span className="text-fg">{formatPerGram(gold.phpPerGram * 0.75)}</span> per gram.
                </p>
              ) : null}
              <p>
                We check the sources at most once a minute. If we can&rsquo;t get a fresh price for 10 minutes, every price on the site says
                &ldquo;Prices delayed&rdquo; instead of showing an old number as live.
              </p>
            </div>
          </details>

          <div className="text-sm text-muted">
            <h2 className="font-display text-lg text-fg">Sources</h2>
            <ul className="mt-3 grid gap-1.5">
              <li>Metals: {sources.length ? sources.join(", ") : "unavailable right now"}</li>
              <li>USD/PHP: {market.fxSource ?? "unavailable right now"}</li>
              <li className="tabular">Last checked: {formatManilaDateTime(market.checkedAt)} (Manila)</li>
            </ul>
            {market.notes.length ? (
              <ul className="mt-3 grid gap-1 text-xs">
                {market.notes.map((n) => (
                  <li key={n}>· {n}</li>
                ))}
              </ul>
            ) : null}
            <p className="mt-5 rounded-lg border border-line px-4 py-3 text-xs">
              Indicative prices for reference; dealer prices vary. Jewellery sells above melt value because of workmanship, and every shop
              sets its own buying and selling margin.
            </p>
            <p className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
              <Link href="/tools/calculator" className="text-gold underline-offset-4 hover:underline">
                Gold value calculator
              </Link>
              <Link href="/tools/price-check" className="text-gold underline-offset-4 hover:underline">
                Check an offer
              </Link>
              <Link href="/sell" className="text-gold underline-offset-4 hover:underline">
                Sell to Luxx4less
              </Link>
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
