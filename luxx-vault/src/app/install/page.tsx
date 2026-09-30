import type { Metadata } from "next";
import Image from "next/image";
import { BellRing, CloudOff, Gauge, ScanSearch } from "lucide-react";
import { InstallGuide } from "@/components/install/install-guide";
import { ServiceWorkerRegistrar } from "@/components/install/sw-register";
import { GoldRule, Reveal, RisingWords } from "@/components/motion/reveal";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getSession } from "@/lib/server/session";

export const metadata: Metadata = {
  title: "Install the app",
  description: "Put Luxx4less on your home screen: live gold prices at a glance, price alerts, and the last known prices even offline. No app store needed.",
};

const GIVES = [
  { icon: Gauge, title: "Prices at a glance", body: "Opens straight to today's per-gram prices, full screen, without the browser bars." },
  { icon: BellRing, title: "Your price alerts", body: "Set a target per gram and hear by email, Viber or Messenger when the market crosses it." },
  { icon: CloudOff, title: "Offline, still useful", body: "No signal at the counter? You'll see the last known prices, clearly dated." },
  { icon: ScanSearch, title: "The hallmark reader", body: "A loupe for the tiny stamp inside a ring, one tap from your home screen." },
];

export default async function InstallPage() {
  const session = await getSession();
  return (
    <>
      <SiteHeader signedIn={Boolean(session)} />
      <main className="mx-auto grid max-w-6xl gap-14 px-4 pt-8 pb-20 sm:px-6 sm:pt-12">
        <section className="grid items-center gap-10 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="grid gap-4">
            <Reveal>
              <p className="text-sm font-semibold text-champagne">The Luxx4less app</p>
            </Reveal>
            <RisingWords as="h1" text="Keep the vault on your home screen" className="text-4xl sm:text-5xl" />
            <Reveal delay={0.1}>
              <p className="measure text-lg text-muted">
                Install Luxx4less straight from your browser. No app store, nothing to pay, and it takes almost no space. It updates itself every
                time you open it.
              </p>
            </Reveal>
          </div>
          <Reveal delay={0.15} className="justify-self-center">
            <HomeScreen />
          </Reveal>
        </section>

        <GoldRule />

        <section aria-labelledby="how" className="grid gap-6">
          <h2 id="how" className="text-2xl sm:text-3xl">
            How to install
          </h2>
          <InstallGuide />
        </section>

        <section aria-labelledby="gives" className="grid gap-6">
          <h2 id="gives" className="text-2xl sm:text-3xl">
            What the app gives you
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {GIVES.map((g, i) => (
              <Reveal as="li" key={g.title} delay={i * 0.06} className="grid content-start gap-3 rounded-2xl border border-line bg-surface p-5">
                <span className="grid size-11 place-items-center rounded-full border border-gold-large/40 bg-gold-tint text-champagne">
                  <g.icon className="size-5" aria-hidden />
                </span>
                <p className="font-semibold">{g.title}</p>
                <p className="text-sm text-muted">{g.body}</p>
              </Reveal>
            ))}
          </ul>
          <p className="text-xs text-muted">
            Alerts arrive by email, Viber or Messenger and in the bell on the site; the app doesn&apos;t send phone notifications of its own yet.
          </p>
        </section>
      </main>
      <SiteFooter />
      <ServiceWorkerRegistrar />
    </>
  );
}

/** A phone's home screen with the Luxx4less icon among plain tiles: built from CSS, the icon is the real app icon. */
function HomeScreen() {
  return (
    <div
      aria-hidden
      className="relative h-[26rem] w-[13rem] rounded-[2.6rem] border border-white/15 bg-[#0d0912] p-2.5 shadow-[0_40px_80px_-40px_black,0_0_0_1px_rgb(214_178_110/0.15)]"
    >
      <div className="relative size-full overflow-hidden rounded-[2.1rem] bg-[radial-gradient(120%_80%_at_30%_0%,#3a2a4c,#17101f_60%)]">
        <div className="absolute top-2 left-1/2 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
        <div className="grid grid-cols-4 gap-x-3 gap-y-4 px-4 pt-14">
          {Array.from({ length: 12 }, (_, i) =>
            i === 5 ? (
              <div key={i} className="grid justify-items-center gap-1">
                <span className="relative block size-10 overflow-hidden rounded-[0.8rem] shadow-[0_0_0_1px_rgb(214_178_110/0.6),0_8px_24px_-6px_rgb(214_178_110/0.7)]">
                  <Image src="/icons/icon-192.png" alt="" width={80} height={80} className="size-full" />
                </span>
                <span className="text-[0.5rem] text-pearl/90">Luxx4less</span>
              </div>
            ) : (
              <div key={i} className="grid justify-items-center gap-1">
                <span className="block size-10 rounded-[0.8rem] bg-white/[0.07]" />
                <span className="h-1 w-6 rounded-full bg-white/10" />
              </div>
            ),
          )}
        </div>
        <div className="absolute inset-x-3 bottom-3 flex justify-around rounded-[1.4rem] bg-white/[0.06] px-2 py-2.5 backdrop-blur">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className="block size-9 rounded-[0.7rem] bg-white/[0.08]" />
          ))}
        </div>
      </div>
    </div>
  );
}
