"use client";

import { BadgeCheck, Mail, ScanFace, Smartphone } from "lucide-react";
import { motion, useInView, useMotionValueEvent, useScroll, useSpring } from "motion/react";
import { useRef, useState, useSyncExternalStore } from "react";
import { TierBadge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

const STEPS = [
  {
    icon: Mail,
    tier: 1,
    title: "Confirm your email",
    body: "A one-time link proves the address is yours. That unlocks your wishlist and price alerts.",
  },
  {
    icon: Smartphone,
    tier: 2,
    title: "Confirm your mobile number",
    body: "A six-digit code to your Philippine mobile number. Now you can message sellers and check out from the official store.",
  },
  {
    icon: ScanFace,
    tier: 3,
    title: "Show your ID and a live selfie",
    body: "A government ID plus a selfie matched to it. Everyone who buys or sells on the marketplace has done this step.",
  },
  {
    icon: BadgeCheck,
    tier: 4,
    title: "Seller checks",
    body: "Before anyone can list, they add proof of address and a payout account in their own name.",
  },
] as const;

function Step({
  step,
  index,
  lit,
  current,
  as: Tag = "li",
}: {
  step: (typeof STEPS)[number];
  index: number;
  lit: boolean;
  current: boolean;
  as?: "li" | "div";
}) {
  const Icon = step.icon;
  return (
    <Tag
      className={cn(
        "relative grid grid-cols-[3rem_minmax(0,1fr)] gap-4 transition-[opacity,filter] duration-700 ease-(--ease-vault) sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-6",
        lit ? "opacity-100" : "opacity-35 saturate-50",
      )}
      aria-current={current ? "step" : undefined}
    >
      <span
        className={cn(
          "relative z-10 grid size-12 place-items-center rounded-full border bg-surface transition-[border-color,box-shadow,color] duration-700 sm:size-16",
          lit ? "border-champagne text-champagne shadow-[0_0_28px_-6px_rgb(214_178_110/0.7)]" : "border-line text-muted",
        )}
      >
        <Icon className="size-5 sm:size-6" aria-hidden />
      </span>
      <div className="pb-1">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-display text-xs tracking-[0.28em] text-muted uppercase">
          Step {index + 1}
          <TierBadge tier={step.tier} className="font-sans tracking-normal normal-case" />
        </p>
        <h3 className={cn("mt-1.5 text-xl transition-colors duration-700 sm:text-2xl", lit ? "text-fg" : "text-fg/70")}>{step.title}</h3>
        <p className="measure mt-1.5 text-sm text-muted">{step.body}</p>
      </div>
    </Tag>
  );
}

/** On phones each step lights as it reaches the middle of the screen, and stays lit. */
function SeenStep({ step, index }: { step: (typeof STEPS)[number]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -40% 0px" });
  return (
    <div ref={ref}>
      <Step as="div" step={step} index={index} lit={seen} current={false} />
    </div>
  );
}

/** A media query read through useSyncExternalStore, so hydration uses the server's answer (false) first. */
function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * "How verification works" (brief §5, PARITY C3): a pinned scene where each
 * step lights up as you scroll through it. Under reduced motion it is a plain
 * list with every step lit.
 */
export function VerificationScene() {
  // Not motion's useReducedMotion: it answers differently on the server and the first client render.
  const reduce = useMedia("(prefers-reduced-motion: reduce)");
  const desktop = useMedia("(min-width: 1024px)");
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const rail = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.4 });

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const next = Math.min(STEPS.length - 1, Math.floor(p * STEPS.length));
    if (next !== active) setActive(next);
  });

  const intro = (
    <div className="lg:col-span-5">
      <p className="font-display text-xs tracking-[0.32em] text-champagne uppercase">How verification works</p>
      <h2 className="mt-4 text-3xl text-pearl sm:text-4xl">Real gold, and real people behind it</h2>
      <p className="measure mt-5 text-muted">
        Every account climbs the same four steps. Each one unlocks more, and nobody trades on the marketplace until their identity is
        checked.
      </p>
    </div>
  );

  if (reduce) {
    return (
      <section ref={ref} aria-labelledby="verify-title" className="mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-12 lg:py-32">
        <span id="verify-title" className="sr-only">
          How verification works
        </span>
        {intro}
        <ol className="grid gap-10 lg:col-span-7">
          {STEPS.map((s, i) => (
            <Step key={s.title} step={s} index={i} lit current={false} />
          ))}
        </ol>
      </section>
    );
  }

  if (!desktop) {
    // Phones: too little height to pin four steps, so they light up one by one as you scroll past.
    return (
      <section ref={ref} aria-labelledby="verify-title" className="mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:px-6">
        <span id="verify-title" className="sr-only">
          How verification works
        </span>
        {intro}
        <ol className="grid gap-10">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <SeenStep step={s} index={i} />
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <section ref={ref} aria-labelledby="verify-title" className="relative h-[260svh]">
      <span id="verify-title" className="sr-only">
        How verification works
      </span>
      <div className="sticky top-0 flex min-h-svh items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pt-32 pb-12 sm:px-6 lg:grid-cols-12 lg:gap-12">
          {intro}
          <ol className="relative grid gap-7 lg:col-span-7">
            {/* The rail: a hairline that fills with gold as you pass each step */}
            <span aria-hidden className="absolute top-6 bottom-6 left-6 w-px bg-line sm:top-8 sm:bottom-8 sm:left-8" />
            <motion.span
              aria-hidden
              className="absolute top-6 bottom-6 left-6 w-px origin-top bg-[linear-gradient(#f0dba6,#d6b26e_60%,#a8823f)] shadow-[0_0_10px_rgb(214_178_110/0.7)] sm:top-8 sm:bottom-8 sm:left-8"
              style={{ scaleY: rail }}
            />
            {STEPS.map((s, i) => (
              <Step key={s.title} step={s} index={i} lit={i <= active} current={i === active} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
