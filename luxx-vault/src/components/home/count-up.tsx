"use client";

import { animate, useInView } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useEffect, useRef } from "react";

/**
 * A number that counts up once when it scrolls into view. The server renders
 * the final value (crawlers, no-JS and reduced motion all see the real number);
 * the count only runs for a figure that starts below the fold.
 */
export function CountUp({ value, format }: { value: number; format: "plain" | "thousands" }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const reduce = useReducedMotion();
  const armed = useRef(false);
  const text = (n: number) => (format === "thousands" ? `${Math.round(n / 1000).toLocaleString("en-PH")}K` : String(Math.round(n)));

  // Arm only if the figure is off-screen at mount, so nothing visible ever jumps back to zero.
  useEffect(() => {
    const el = ref.current;
    if (!el || reduce) return;
    if (el.getBoundingClientRect().top > window.innerHeight) {
      armed.current = true;
      el.textContent = text(format === "plain" ? value * 0.94 : 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView || !armed.current) return;
    armed.current = false;
    const from = format === "plain" ? value * 0.94 : 0;
    const controls = animate(from, value, {
      duration: 1.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (n) => {
        el.textContent = text(n);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);

  return (
    <span ref={ref} className="tabular">
      {text(value)}
    </span>
  );
}
