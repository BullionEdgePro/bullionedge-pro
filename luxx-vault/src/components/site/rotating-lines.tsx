"use client";

import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useEffect, useState } from "react";

/** Brand lines that crossfade slowly. One still line under reduced motion. */
export function RotatingLines({ lines, className }: { lines: readonly string[]; className?: string }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % lines.length), 5200);
    return () => window.clearInterval(id);
  }, [reduce, lines.length]);
  return (
    <p className={className} aria-live="off">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={i}
          className="block"
          initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          {lines[i]}
        </motion.span>
      </AnimatePresence>
    </p>
  );
}
