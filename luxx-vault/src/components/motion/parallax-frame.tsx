"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
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
    <div ref={ref} className={cn("group/frame relative isolate overflow-hidden", className)}>
      <motion.div className="h-full w-full" style={reduce ? undefined : { y, scale: 1.12 }}>
        {/* On hover the photo leans in, slowly, like a piece lifted toward the lamp. */}
        <div className="h-full w-full transition-transform duration-[1400ms] ease-(--ease-vault) group-hover/frame:scale-[1.05]">
          {children}
        </div>
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
        className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-champagne/25 transition-[box-shadow] duration-700 group-hover/frame:ring-champagne/55"
      />
      {/* A mat line that appears on hover: the photo becomes a framed print. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-3 rounded-[calc(var(--radius-lg)-0.5rem)] border border-champagne/0 opacity-0 transition-[opacity,inset,border-color] duration-700 ease-(--ease-vault) group-hover/frame:inset-4 group-hover/frame:border-champagne/45 group-hover/frame:opacity-100"
      />
    </div>
  );
}
