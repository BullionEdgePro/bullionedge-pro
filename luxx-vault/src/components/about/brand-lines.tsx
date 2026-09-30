"use client";

import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useRef } from "react";

/**
 * The brand lines as a procession: each line catches the light in turn as
 * the band scrolls past, like pieces lit one by one in a display case.
 *
 * Scroll-linked (no timers), so it moves only as fast as the reader. Under
 * "reduce motion" every line is simply lit.
 */
export function BrandLines({ lines, className }: { lines: readonly string[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 30%"] });

  return (
    <div ref={ref} className={className}>
      <ul className="space-y-5 sm:space-y-7">
        {lines.map((line, i) =>
          reduce ? (
            <li key={line} className="font-display text-2xl text-gold-metal sm:text-4xl lg:text-5xl">
              {line}
            </li>
          ) : (
            <LitLine key={line} line={line} index={i} count={lines.length} progress={scrollYProgress} />
          ),
        )}
      </ul>
    </div>
  );
}

function LitLine({
  line,
  index,
  count,
  progress,
}: {
  line: string;
  index: number;
  count: number;
  progress: MotionValue<number>;
}) {
  // Each line owns an equal slice of the scroll; it peaks mid-slice and the last one stays lit.
  const start = index / count;
  const peak = (index + 0.5) / count;
  const end = (index + 1) / count;
  const last = index === count - 1;
  const opacity = useTransform(progress, [start, peak, end], [0.22, 1, last ? 1 : 0.34]);
  const x = useTransform(progress, [start, peak], [index % 2 ? 28 : -28, 0]);
  const blur = useTransform(progress, [start, peak], [3, 0], { clamp: true });
  const filter = useTransform(blur, (b) => `blur(${b}px)`);

  return (
    <motion.li
      style={{ opacity, x, filter }}
      className="font-display text-2xl text-gold-metal animate-molten sm:text-4xl lg:text-5xl"
    >
      {line}
    </motion.li>
  );
}
