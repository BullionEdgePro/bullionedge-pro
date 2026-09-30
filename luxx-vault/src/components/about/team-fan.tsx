"use client";

import { motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useState } from "react";
import { BrandImage } from "@/components/media/brand-image";
import { cn } from "@/lib/cn";

interface Frame {
  id: string;
  alt: string;
  caption: string;
}

/** Resting tilt for each photo, so the set reads as prints laid on a desk. */
const FLAT = { rotate: 0, x: 0, y: 0 };
const REST = [
  { rotate: -5.5, x: -18, y: 14 },
  { rotate: 1.5, x: 0, y: 0 },
  { rotate: 5, x: 18, y: 18 },
] as const;

/**
 * The team photos, laid out like prints fanned across velvet. Pointing at one
 * — or tabbing to it — lifts it straight and brings its caption up.
 *
 * On small screens the fan becomes a swipeable strip, because a fan needs
 * width to be legible.
 */
export function TeamFan({ frames }: { frames: readonly Frame[] }) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);

  return (
    <div className="mt-12">
      {/* Phones: a plain swipeable strip. */}
      <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:hidden">
        {frames.map((f) => (
          <li key={f.id} className="w-[78%] shrink-0 snap-center">
            <figure>
              <div className="overflow-hidden rounded-xl ring-1 ring-champagne/25">
                <BrandImage id={f.id} alt={f.alt} sizes="78vw" className="aspect-[4/5]" />
              </div>
              <figcaption className="mt-3 text-sm text-muted">{f.caption}</figcaption>
            </figure>
          </li>
        ))}
      </ul>

      {/* Tablet and up: the fan. */}
      <ul className="hidden md:flex md:items-center md:justify-center md:gap-6 lg:gap-10">
        {frames.map((f, i) => {
          const rest = REST[i % REST.length] ?? FLAT;
          const isActive = active === i;
          const dimmed = active !== null && !isActive;
          return (
            <motion.li
              key={f.id}
              className="relative w-[30%] max-w-[22rem]"
              initial={reduce ? undefined : { opacity: 0, y: 40, rotate: rest.rotate * 2 }}
              whileInView={reduce ? undefined : { opacity: 1, y: rest.y, rotate: rest.rotate, x: rest.x }}
              viewport={{ once: true, margin: "-15% 0px" }}
              transition={{ duration: 1, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              animate={
                reduce
                  ? undefined
                  : isActive
                    ? { rotate: 0, x: 0, y: rest.y - 22, scale: 1.05, zIndex: 10 }
                    : { rotate: rest.rotate, x: rest.x, y: rest.y, scale: dimmed ? 0.97 : 1, zIndex: 1 }
              }
              style={{ opacity: dimmed ? 0.62 : 1, transition: "opacity .5s var(--ease-vault)" }}
              onHoverStart={() => setActive(i)}
              onHoverEnd={() => setActive(null)}
            >
              <figure>
                <button
                  type="button"
                  className="block w-full cursor-default overflow-hidden rounded-xl ring-1 ring-champagne/25"
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  aria-describedby={`team-cap-${i}`}
                >
                  <BrandImage
                    id={f.id}
                    alt={f.alt}
                    sizes="(min-width: 1024px) 22rem, 30vw"
                    className={cn("aspect-[4/5] transition-transform duration-700", isActive && "scale-[1.04]")}
                  />
                </button>
                <figcaption
                  id={`team-cap-${i}`}
                  className={cn(
                    "mt-4 text-center text-sm text-muted transition-all duration-500",
                    !reduce && (isActive ? "translate-y-0 opacity-100" : "translate-y-1 opacity-70"),
                  )}
                >
                  {f.caption}
                </figcaption>
              </figure>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
