"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { AlertTriangle, Info } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLiveMarket } from "@/components/prices/use-live-market";
import { Magnetic } from "@/components/motion/magnetic";
import { Button } from "@/components/ui/button";
import { useMotionTier } from "@/hooks/use-motion-tier";
import { cn } from "@/lib/cn";
import { purityFromKarat, type Market } from "@/lib/market";
import { KARATS, phpPerGram, type Karat } from "@/lib/pricing";
import { formatManilaDateTime, formatManilaTime } from "@/lib/prices-format";
import { useSamplePrice } from "@/lib/sample-price";
import { CENTERED, type BarLayout } from "./bar-layout";
import { RollingNumber } from "./rolling-number";

// three.js only loads for devices that get the full experience.
const GoldBarCanvas = dynamic(() => import("./gold-bar"), { ssr: false });

const whole = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });

/** Cinzel SemiBold digit advance widths (em), measured from the font file. Cinzel has no tabular figures. */
const CINZEL_DIGITS = { "0": 0.634, "1": 0.376, "2": 0.596, "3": 0.543, "4": 0.607, "5": 0.536, "6": 0.607, "7": 0.53, "8": 0.586, "9": 0.607 } as const;

const HERO_KARATS = KARATS.filter((k) => k >= 14);

type CaptionFor = (karat: Karat) => { tone: "info" | "warning"; text: ReactNode };

/**
 * "The Living Gram": today's ₱ per gram in huge molten numerals over a 3D
 * gold bar that turns with scroll and sinks into the section below.
 *
 * The stage is shared by the prototype (sample price, /design-system/hero)
 * and the home page (live price from the engine).
 */
function LivingGramStage({
  purePerGram,
  caption,
  actions,
  children,
  headingId = "living-gram-title",
}: {
  /** ₱ per gram of pure gold; null when there is no price to show. */
  purePerGram: number | null;
  caption: CaptionFor;
  actions: ReactNode;
  children?: ReactNode;
  headingId?: string;
}) {
  const tier = useMotionTier();
  const [karat, setKarat] = useState<Karat>(24);
  const section = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const controls = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const zone = useRef<HTMLDivElement>(null);
  const layout = useRef<BarLayout>(CENTERED);

  // Tell the 3D scene where the free zone is, as fractions of the stage.
  useEffect(() => {
    const measure = () => {
      const st = stage.current?.getBoundingClientRect();
      const z = zone.current?.getBoundingClientRect();
      const c = controls.current?.getBoundingClientRect();
      if (!st || !z || !c || st.height === 0) return;
      layout.current = {
        zoneCenterY: (z.top + z.height / 2 - st.top) / st.height,
        zoneHeight: z.height / st.height,
        zoneWidth: z.width / st.width,
        settleCenterY: (c.top + c.height * 0.4 - st.top) / st.height,
      };
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (stage.current) ro.observe(stage.current);
    return () => ro.disconnect();
  }, [tier]);
  const [inView, setInView] = useState(true);

  const perGram = purePerGram ? purePerGram * purityFromKarat(karat) : null;
  const note = caption(karat);

  // Scroll choreography: Lenis smooth scroll + one ScrollTrigger scrubbing progress.
  useEffect(() => {
    if (tier !== "full" || !section.current) return;
    let cleanup = () => {};
    let cancelled = false;
    (async () => {
      const [{ gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
        import("lenis"),
      ]);
      if (cancelled || !section.current) return;
      gsap.registerPlugin(ScrollTrigger);
      const lenis = new Lenis({ lerp: 0.1 });
      lenis.on("scroll", ScrollTrigger.update);
      const raf = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
      const st = ScrollTrigger.create({
        trigger: section.current,
        start: "top top",
        end: "bottom bottom", // progress hits 1 exactly when the pin releases
        scrub: true,
        onUpdate: (self) => {
          progress.current = self.progress;
          // Controls step aside as the bar settles into their place.
          const fade = Math.min(1, Math.max(0, (self.progress - 0.55) / 0.2));
          if (controls.current) {
            controls.current.style.opacity = String(1 - fade);
            controls.current.style.translate = `0 ${fade * 24}px`;
            controls.current.inert = fade > 0.9;
          }
        },
        onToggle: (self) => setInView(self.isActive),
      });
      cleanup = () => {
        st.kill();
        gsap.ticker.remove(raf);
        lenis.destroy();
      };
    })();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [tier]);

  return (
    <>
      <section ref={section} className="surface-velvet relative h-[190svh]" aria-labelledby={headingId}>
        <div ref={stage} className="sticky top-0 flex h-svh flex-col items-center overflow-hidden px-4 pt-[calc(var(--header-top,5.5rem)+6.5rem)] pb-8 sm:pb-10 lg:pt-[calc(var(--header-top,4.5rem)+8.5rem)]">
          {/* Warm vignette — the vault after hours */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_62%,rgb(214_178_110/0.16),transparent_70%),radial-gradient(90%_70%_at_50%_0%,#2a1d3b_0%,transparent_60%)]"
          />

          <div className="relative z-10 flex flex-col items-center text-center">
            <h1 id={headingId} className="font-sans text-sm font-medium tracking-wide text-muted sm:text-base">
              Today&rsquo;s gold, per gram <span className="sr-only">({karat}K)</span>
            </h1>
            <p className="mt-2 flex items-start font-display font-semibold tracking-tight" aria-live="polite">
              <span className="mt-[0.2em] mr-1 text-[clamp(1.5rem,5vw,4rem)] text-gold-metal">₱</span>
              <RollingNumber
                value={perGram ? whole.format(perGram) : "—"}
                digitWidths={CINZEL_DIGITS}
                className="text-gold-metal animate-molten text-[clamp(4.25rem,18vw,12rem)]"
              />
            </p>
          </div>

          {/* WebGL stage covers the whole pinned screen; the scene fits the bar into the zone below */}
          {tier === "full" && (
            <div aria-hidden className="absolute inset-0">
              <GoldBarCanvas progress={progress} active={inView} layout={layout} />
            </div>
          )}

          {/* The free zone under the numerals where the bar rests, tucked slightly behind them */}
          <div ref={zone} aria-hidden className="relative -mt-[3svh] min-h-0 w-full max-w-4xl flex-1">
            {tier === "full" ? null : tier ? (
              <Image
                src="/brand/gold-bar-poster.webp"
                alt=""
                fill
                priority
                sizes="(min-width: 1024px) 60vw, 90vw"
                className="object-contain p-2 sm:p-6"
              />
            ) : null}
          </div>

          <div ref={controls} className="relative z-10 flex flex-col items-center text-center">
            <div role="radiogroup" aria-label="Karat" className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
              {HERO_KARATS.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={karat === k}
                  onClick={() => setKarat(k)}
                  className={cn(
                    "tabular h-10 min-w-14 rounded-full border px-3 text-sm font-semibold transition-colors sm:min-w-16 sm:px-4",
                    karat === k ? "border-champagne bg-champagne text-velvet" : "border-line bg-surface text-fg hover:border-champagne/70",
                  )}
                >
                  {k}K
                </button>
              ))}
            </div>

            <p
              className={cn(
                "tabular mt-4 flex max-w-xl items-start gap-1.5 text-left text-xs sm:items-center",
                note.tone === "warning" ? "text-warning" : "text-muted",
              )}
            >
              {note.tone === "warning" ? (
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 sm:mt-0" aria-hidden />
              ) : (
                <Info className="mt-0.5 size-3.5 shrink-0 sm:mt-0" aria-hidden />
              )}
              <span>{note.text}</span>
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{actions}</div>
          </div>
        </div>
      </section>
      {children}
    </>
  );
}

/** Prototype hero for /design-system/hero: a gently moving sample price, clearly labelled. */
export function LivingGram({ children }: { children?: ReactNode }) {
  const price = useSamplePrice();
  return (
    <LivingGramStage
      purePerGram={phpPerGram(price.usdPerOz, price.usdPhp)}
      caption={() => ({
        tone: "info",
        text: `Sample price for design review · spot $${whole.format(price.usdPerOz)}/oz · ₱${price.usdPhp.toFixed(2)} per $`,
      })}
      actions={
        <>
          <Magnetic>
            <Button size="lg">Shop Luxx4less gold</Button>
          </Magnetic>
          <Button size="lg" variant="secondary">
            Sell your gold
          </Button>
        </>
      }
    >
      {children}
    </LivingGramStage>
  );
}

/**
 * The home page hero on the real price. `initial` is the server-rendered
 * market, so the first paint (and the LCP) already shows today's number; the
 * shared poll keeps it live and the reels roll when it ticks.
 */
export function LiveLivingGram({ initial, actions, children }: { initial: Market; actions: ReactNode; children?: ReactNode }) {
  const { market, stale } = useLiveMarket(initial);
  const gold = market?.metals.gold ?? null;

  const caption: CaptionFor = (karat) => {
    if (!gold || !market?.usdPhp) {
      return { tone: "warning", text: "Gold prices are unavailable right now. Please check again in a few minutes." };
    }
    const purity = `${karat}K at ${(purityFromKarat(karat) * 100).toFixed(1)}% gold`;
    const basis = `spot $${whole.format(gold.usdPerOz)}/oz · ₱${market.usdPhp.toFixed(2)} per $`;
    if (market.delayed || stale) {
      return { tone: "warning", text: `Prices delayed · last update ${formatManilaDateTime(market.checkedAt)} · ${purity}` };
    }
    if (market.marketClosed) {
      return { tone: "info", text: `Markets closed · last close · ${purity} · ${basis}` };
    }
    return { tone: "info", text: `Live melt value · ${purity} · ${basis} · ${formatManilaTime(market.checkedAt)}` };
  };

  return (
    <LivingGramStage purePerGram={gold?.phpPerGram ?? null} caption={caption} actions={actions}>
      {children}
    </LivingGramStage>
  );
}
