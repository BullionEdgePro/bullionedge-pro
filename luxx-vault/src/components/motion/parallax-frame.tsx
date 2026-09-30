"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A framed photo that drifts slowly against the scroll, with a single sheen
 * of gold light passing over it the first time it comes into view.
 *
 * The drift is small on purpose: enough to feel like depth, never enough to
 * make the page feel unsteady. Both effects are off under "reduce motion".
 */
export function ParallaxFrame({
  children,
  className,
  /** How far the photo drifts, in pixels, across the whole scroll. */
  depth = 48,
  /** Sheen sweep on first view. Turn off for photos in a dense grid. */
  sheen = true,
  sheenDelay = 0.2,
}: {
  children: ReactNode;
  className?: string;
  depth?: number;
  sheen?: boolean;
  sheenDelay?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [depth, -depth]);

  return (
    <div ref={ref} className={cn("relative isolate overflow-hidden", className)}>
      <motion.div className="h-full w-full" style={reduce ? undefined : { y, scale: 1.12 }}>
        {children}
      </motion.div>

      {sheen && !reduce ? (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-12"
          style={{
            backgroundImage:
              "linear-gradient(90deg, transparent, color-mix(in srgb, #f7e7bb 55%, transparent), transparent)",
            mixBlendMode: "soft-light",
          }}
          initial={{ x: "0%", opacity: 0 }}
          whileInView={{ x: ["0%", "420%"], opacity: [0, 1, 0] }}
          viewport={{ once: true, margin: "-15% 0px" }}
          transition={{ duration: 1.5, delay: sheenDelay, ease: "easeInOut" }}
        />
      ) : null}

      {/* A thin inner gold edge, so every photo reads as framed rather than cropped. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-champagne/25"
      />
    </div>
  );
}
