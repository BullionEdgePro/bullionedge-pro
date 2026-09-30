import type { Metadata } from "next";
import Link from "next/link";
import { Emblem } from "@/components/brand/logo";
import { ServiceWorkerRegistrar } from "@/components/install/sw-register";
import { OfflinePrices } from "./offline-prices";

export const metadata: Metadata = { title: "Offline", robots: { index: false, follow: false } };
// Static on purpose: the service worker keeps this exact page for when there is no network.
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="mx-auto grid min-h-svh max-w-3xl content-start gap-8 px-4 py-10 sm:px-6 sm:py-16">
      <Link href="/" className="flex w-fit items-center gap-3" aria-label="Luxx4less home">
        <Emblem title="" className="size-12" />
        <span className="font-display text-2xl tracking-[0.12em] text-gold-metal">Luxx4less</span>
      </Link>
      <header className="grid gap-2">
        <h1 className="text-3xl sm:text-4xl">Last known prices</h1>
        <p className="measure text-muted">
          When there&apos;s no connection, this page shows what gold was worth the last time this device checked, so you&apos;re never
          guessing at the counter.
        </p>
      </header>
      <OfflinePrices />
      <ServiceWorkerRegistrar />
    </main>
  );
}
