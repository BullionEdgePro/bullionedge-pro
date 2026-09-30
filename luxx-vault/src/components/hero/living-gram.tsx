"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Magnetic } from "@/components/motion/magnetic";
import { Button } from "@/components/ui/button";
import { useMotionTier } from "@/hooks/use-motion-tier";
import { cn } from "@/lib/cn";
import { KARATS, phpPerGramAtKarat, type Karat } from "@/lib/pricing";
import { useSamplePrice } from "@/lib/sample-price";
import { CENTERED, type BarLayout } from "./bar-layout";
import { RollingNumber } from "./rolling-number";

// three.js only loads for devices that get the full experience.
const GoldBarCanvas = dynamic(() => import("./gold-bar"), { ssr: false });

const whole = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });

/** Cinzel SemiBold digit advance widths (em), measured from the font file. Cinzel has no tabular figures. */
const CINZEL_DIGITS = { "0": 0.634, "1": 0.376, "2": 0.596, "3": 0.543, "4": 0.607, "5": 0.536, "6": 0.607, "7": 0.53, "8": 0.586, "9": 0.607 } as const;

/**
 * "The Living Gram": today's ₱ per gram in huge molten numerals over a 3D
 * gold bar that turns with scroll and sinks into the product grid below.
 */
export function LivingGram({ children }: { children?: React.ReactNode }) {
  const tier = useMotionTier();
  const price = useSamplePrice();
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

  const perGram = phpPerGramAtKarat(price.usdPerOz, price.usdPhp, karat);

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
      <section ref={section} className="surface-velvet relative h-[190svh]" aria-labelledby="living-gram-title">
        <div ref={stage} className="sticky top-0 flex h-svh flex-col items-center overflow-hidden px-4 pt-20 pb-8 sm:pt-24 sm:pb-10">
          {/* Warm vignette — the vault after hours */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_62%,rgb(214_178_110/0.16),transparent_70%),radial-gradient(90%_70%_at_50%_0%,#2a1d3b_0%,transparent_60%)]"
          />

          <div className="relative z-10 flex flex-col items-center text-center">
            <h1 id="living-gram-title" className="font-sans text-sm font-medium tracking-wide text-muted sm:text-base">
              Today&rsquo;s gold, per gram
            </h1>
            <p className="mt-2 flex items-start font-display font-semibold tracking-tight" aria-live="polite">
              <span className="mt-[0.2em] mr-1 text-[clamp(1.5rem,5vw,4rem)] text-gold-metal">₱</span>
              <RollingNumber
                value={whole.format(perGram)}
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
            <div role="radiogroup" aria-label="Karat" className="flex flex-wrap justify-center gap-2">
              {KARATS.filter((k) => k >= 14).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={karat === k}
                  onClick={() => setKarat(k)}
                  className={cn(
                    "tabular h-10 min-w-16 rounded-full border px-4 text-sm font-semibold transition-colors",
                    karat === k ? "border-champagne bg-champagne text-velvet" : "border-line bg-surface text-fg hover:border-champagne/70",
                  )}
                >
                  {k}K
                </button>
              ))}
            </div>

            <p className="tabular mt-4 flex max-w-xl items-start gap-1.5 text-left text-xs text-muted sm:items-center">
              <Info className="mt-0.5 size-3.5 shrink-0 sm:mt-0" aria-hidden />
              <span>
                Sample price for design review · spot ${whole.format(price.usdPerOz)}/oz · ₱{price.usdPhp.toFixed(2)} per $ · live prices arrive in Phase 3
              </span>
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Magnetic>
                <Button size="lg">Shop Luxx4less gold</Button>
              </Magnetic>
              <Button size="lg" variant="secondary">
                Sell your gold
              </Button>
            </div>
          </div>
        </div>
      </section>
      {children}
    </>
  );
}
