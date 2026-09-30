import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { ToolIntro } from "@/components/tools/tool-page";
import { ValueCalculator } from "@/components/tools/value-calculator";
import { getMarket } from "@/lib/server/prices/engine";
import { getSpreads } from "@/lib/server/prices/spreads";
import { getSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gold value calculator — what is my gold worth?",
  description:
    "Work out the melt value of gold, silver, platinum or palladium in pesos from its karat or fineness and weight, or from a specific-gravity reading. Live prices.",
  alternates: { canonical: "/tools/calculator" },
};

export default async function CalculatorPage() {
  const [session, market, spreads] = await Promise.all([getSession(), getMarket(), getSpreads()]);
  const publicSpreads = spreads.map(({ metal, purity, productType, buyRatio, sellRatio }) => ({ metal, purity, productType, buyRatio, sellRatio }));

  return (
    <>
      <SiteHeader signedIn={Boolean(session)} />
      <main className="surface-velvet">
        <section className="mx-auto max-w-6xl px-4 pt-10 pb-24 sm:px-6 lg:pt-16">
          <ToolIntro title="What is my gold worth?" crumb="Value calculator">
            <p>
              Enter the karat and the weight to see the melt value at today&rsquo;s price. No stamp? A specific-gravity reading gives a
              rough purity.
            </p>
          </ToolIntro>
          <div className="mt-12">
            <ValueCalculator initial={market} spreads={publicSpreads} />
          </div>
          <p className="mt-12 text-sm text-muted">
            Is someone offering you gold? <Link href="/tools/price-check" className="text-gold underline-offset-4 hover:underline">Check their price against melt value</Link>.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
