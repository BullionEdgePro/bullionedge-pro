import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { OfferCheck } from "@/components/tools/offer-check";
import { ToolIntro } from "@/components/tools/tool-page";
import { getMarket } from "@/lib/server/prices/engine";
import { getSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Is this gold price fair? Check any offer",
  description:
    "Type the asking price, weight and karat of any gold offer to see how it compares with today's melt value, and get a warning when it is suspiciously cheap.",
  alternates: { canonical: "/tools/price-check" },
};

export default async function PriceCheckPage() {
  const [session, market] = await Promise.all([getSession(), getMarket()]);

  return (
    <>
      <SiteHeader signedIn={Boolean(session)} />
      <main className="surface-velvet">
        <section className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6 lg:pt-16">
          <ToolIntro title="Is this gold price fair?" crumb="Check an offer">
            <p>
              Put in what you are being offered and we compare it with what the metal alone is worth today. Gold sold far below that is
              the most common trap in online selling.
            </p>
          </ToolIntro>
          <div className="mt-12">
            <OfferCheck initial={market} />
          </div>
        </section>

        <section aria-labelledby="why-title" className="border-t border-line bg-surface-sunk">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-3">
            <h2 id="why-title" className="text-2xl text-fg">
              Why a cheap price is a warning
            </h2>
            <div className="grid gap-4 text-sm text-muted lg:col-span-2">
              <p>
                A common pattern in Philippine online selling: &ldquo;Saudi gold&rdquo; or &ldquo;pawnable 18K&rdquo; offered well under the
                going rate, with pressure to pay quickly by e-wallet. What arrives is plated brass, gold-filled wire or a lower karat than
                stamped, if anything arrives at all.
              </p>
              <p>
                Stamps are easy to fake. Before paying, weigh the piece, ask for a test (XRF, acid or an electronic tester) and meet at a shop
                that can do it. Pay only once it passes.
              </p>
              <p className="flex flex-wrap gap-x-5 gap-y-2">
                <Link href="/tools/hallmark" className="text-gold underline-offset-4 hover:underline">
                  Read a hallmark
                </Link>
                <Link href="/tools/calculator" className="text-gold underline-offset-4 hover:underline">
                  Gold value calculator
                </Link>
                <Link href="/prices" className="text-gold underline-offset-4 hover:underline">
                  Today&rsquo;s prices
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
