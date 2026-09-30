import type { Metadata } from "next";
import { Reveal } from "@/components/motion/reveal";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { brand } from "@/config/brand";
import { getMarket } from "@/lib/server/prices/engine";
import { getSpreads } from "@/lib/server/prices/spreads";
import { getSession } from "@/lib/server/session";
import { manilaToday } from "./schema";
import { SellFlow } from "./sell-flow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sell your gold to Luxx4less",
  description:
    "Get an instant estimate for your gold, silver or platinum at today's price, then book an appraisal at a Luxx4less branch. No obligation.",
  alternates: { canonical: "/sell" },
};

export default async function SellPage() {
  const [session, market, spreads] = await Promise.all([getSession(), getMarket(), getSpreads()]);
  const publicSpreads = spreads.map(({ metal, purity, productType, buyRatio, sellRatio }) => ({ metal, purity, productType, buyRatio, sellRatio }));
  const now = new Date();

  return (
    <>
      <SiteHeader signedIn={Boolean(session)} />
      <main className="surface-velvet">
        <section className="mx-auto max-w-6xl px-4 pt-10 pb-24 sm:px-6 lg:pt-16">
          <Reveal>
            <p className="font-display text-xs tracking-[0.32em] text-champagne uppercase">Sell to Luxx4less</p>
            <h1 className="mt-4 max-w-3xl text-3xl text-pearl sm:text-5xl">Selling your gold? Start with a fair number</h1>
            <p className="measure mt-5 text-muted">
              See what your piece is worth at today&rsquo;s price, then book a time to bring it in. We weigh and test it in front of you before
              making an offer. Luxx4less has been in {brand.location.city} since {brand.established}.
            </p>
          </Reveal>
          <div className="mt-12">
            <SellFlow
              initial={market}
              spreads={publicSpreads}
              today={manilaToday(now)}
              latest={manilaToday(new Date(now.getTime() + 90 * 86_400_000))}
            />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
