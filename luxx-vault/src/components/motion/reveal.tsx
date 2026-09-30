"use client";

import { motion, type Variants } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { ReactNode } from "react";

const EASE_VAULT = [0.22, 1, 0.36, 1] as const;

/**
 * Content that settles into place as it scrolls in — a slow rise out of a
 * soft blur, like a piece being set down on velvet.
 *
 * Under "reduce motion" everything is simply there, at full opacity.
 */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "li" | "figure" | "p";
}) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  if (reduce) return <Tag className={className}>{children}</Tag>;
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-12% 0px -8% 0px" }}
      transition={{ duration: 0.95, delay, ease: EASE_VAULT }}
    >
      {children}
    </Tag>
  );
}

const wordVariants: Variants = {
  hidden: { opacity: 0, y: "0.45em", rotateX: -55 },
  shown: { opacity: 1, y: 0, rotateX: 0 },
};

/**
 * A heading whose words lift into place one after another, as though each
 * were being set by hand.
 *
 * Words are wrapped in spans, so the sentence stays one continuous string for
 * screen readers and for copy-paste.
 */
export function RisingWords({
  text,
  className,
  delay = 0,
  as: Tag = "h2",
}: {
  text: string;
  className?: string;
  delay?: number;
  as?: "h1" | "h2" | "h3" | "p";
}) {
  const reduce = useReducedMotion();
  if (reduce) return <Tag className={className}>{text}</Tag>;
  return (
    <Tag className={className} style={{ perspective: "800px" }}>
      <motion.span
        className="inline"
        initial="hidden"
        whileInView="shown"
        viewport={{ once: true, margin: "-10% 0px" }}
        transition={{ staggerChildren: 0.055, delayChildren: delay }}
        aria-hidden="true"
      >
        {text.split(" ").map((word, i) => (
          <motion.span
            key={`${word}-${i}`}
            className="inline-block whitespace-pre"
            variants={wordVariants}
            transition={{ duration: 0.72, ease: EASE_VAULT }}
          >
            {word}
            {i < text.split(" ").length - 1 ? " " : ""}
          </motion.span>
        ))}
      </motion.span>
      <span className="sr-only">{text}</span>
    </Tag>
  );
}

/**
 * A hairline of gold that draws itself across as the section arrives —
 * the seam of a vault door closing.
 */
export function GoldRule({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden="true"
      className={className}
      style={{
        height: 1,
        transformOrigin: "left",
        backgroundImage: "linear-gradient(90deg, transparent, #a8823f 12%, #f0dba6 50%, #a8823f 88%, transparent)",
      }}
      initial={reduce ? undefined : { scaleX: 0, opacity: 0 }}
      whileInView={reduce ? undefined : { scaleX: 1, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 1.4, ease: EASE_VAULT }}
    />
  );
}
