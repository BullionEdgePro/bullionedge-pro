import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { HallmarkDecoder } from "@/components/hallmark/decoder";
import { Loupe } from "@/components/hallmark/loupe";
import { GoldRule, Reveal, RisingWords } from "@/components/motion/reveal";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { ServiceWorkerRegistrar } from "@/components/install/sw-register";
import { getSession } from "@/lib/server/session";

export const metadata: Metadata = {
  title: "Hallmark reader",
  description:
    "Photograph the stamp inside a ring or on a clasp, look at it under a digital loupe, and see what 916, 750, 18K, K18, 足金, Pt950 or GP really mean. The photo never leaves your phone.",
};

export default async function HallmarkPage() {
  const session = await getSession();
  return (
    <>
      <SiteHeader signedIn={Boolean(session)} />
      <main className="mx-auto grid max-w-6xl gap-12 px-4 pt-8 pb-20 sm:px-6 sm:pt-12">
        <header className="grid max-w-3xl gap-4">
          <Reveal>
            <p className="text-sm font-semibold text-champagne">Trust tools</p>
          </Reveal>
          <RisingWords as="h1" text="Hallmark reader" className="text-4xl sm:text-5xl" />
          <Reveal delay={0.1}>
            <p className="measure text-lg text-muted">
              Read the tiny stamp inside a ring or on a clasp. Put it under the loupe, zoom in until the marks are clear, then tell us what you see.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-ice/25 bg-ice-tint px-4 py-1.5 text-sm text-fg">
              <Lock className="size-4 text-ice" aria-hidden />
              Your photo never leaves this device. Nothing is uploaded.
            </p>
          </Reveal>
        </header>

        <GoldRule />

        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-12">
          <section aria-labelledby="loupe-title" className="grid gap-4 lg:sticky lg:top-28">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-sm text-champagne tabular">I</span>
              <h2 id="loupe-title" className="text-2xl">
                Look closer
              </h2>
            </div>
            <Loupe />
          </section>

          <section aria-labelledby="decode-title" className="grid gap-4">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-sm text-champagne tabular">II</span>
              <h2 id="decode-title" className="text-2xl">
                Decode the marks
              </h2>
            </div>
            <HallmarkDecoder />
          </section>
        </div>
      </main>
      <SiteFooter />
      <ServiceWorkerRegistrar />
    </>
  );
}
