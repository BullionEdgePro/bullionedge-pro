import type { Metadata } from "next";
import Link from "next/link";
import { Lockup } from "@/components/brand/logo";
import { LivingGram } from "@/components/hero/living-gram";
import { EditorialProductCard } from "@/components/product/cards";
import { ThemeToggle } from "@/components/theme-toggle";
import { phpPerGramAtKarat } from "@/lib/pricing";
import { SAMPLE_START } from "@/lib/sample-price-data";

export const metadata: Metadata = {
  title: "Hero prototype",
  robots: { index: false },
};

const perGram18 = phpPerGramAtKarat(SAMPLE_START.usdPerOz, SAMPLE_START.usdPhp, 18) * 1.12;
const perGram21 = phpPerGramAtKarat(SAMPLE_START.usdPerOz, SAMPLE_START.usdPhp, 21) * 1.12;

export default function HeroPrototypePage() {
  return (
    <main>
      <header className="surface-velvet fixed inset-x-0 top-0 z-30 border-b border-line/60 bg-velvet/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/design-system" className="flex items-center gap-2.5 rounded-md">
            <Lockup className="text-base" emblemClassName="size-9" />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <LivingGram>
        <section className="relative z-10 bg-bg px-4 pt-20 pb-24 sm:px-6" aria-labelledby="featured-title">
          <div className="mx-auto max-w-7xl">
            <h2 id="featured-title" className="text-3xl sm:text-4xl">
              Featured from Luxx4less
            </h2>
            <p className="measure mt-3 text-muted">Weighed, tested and priced by the gram. Every piece ships with its receipt and a scannable certificate.</p>
            <div className="mt-10 grid gap-6 lg:grid-cols-12">
              <EditorialProductCard
                className="lg:col-span-7"
                name="Saudi Rope Chain"
                goldType="Saudi gold"
                karat={21}
                grams={15.4}
                pricePerGram={perGram21}
                pawnable
              />
              <EditorialProductCard
                className="lg:col-span-5"
                name="Italian Tennis Bracelet"
                goldType="Italian gold"
                karat={18}
                grams={8.2}
                pricePerGram={perGram18}
              />
            </div>
          </div>
        </section>
      </LivingGram>
    </main>
  );
}
