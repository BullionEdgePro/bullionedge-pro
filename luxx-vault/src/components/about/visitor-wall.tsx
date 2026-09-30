"use client";

import { motion, useReducedMotion } from "motion/react";
import { BrandImage } from "@/components/media/brand-image";
import type { BrandImage as BrandImageData } from "@/content/brand-images";

/**
 * A slow, endless drift of guest photos — two rows travelling in opposite
 * directions, like display cases passing on either side of an aisle.
 *
 * The row is duplicated so the loop has no seam; the copy is hidden from
 * screen readers. Under "reduce motion" it becomes a still, swipeable strip.
 */
export function VisitorWall({ photos }: { photos: readonly BrandImageData[] }) {
  const reduce = useReducedMotion();
  const half = Math.ceil(photos.length / 2);
  const rows = [photos.slice(0, half), photos.slice(half)];

  if (reduce) {
    return (
      <ul className="mt-10 flex gap-4 overflow-x-auto pb-4">
        {photos.map((p) => (
          <li key={p.id} className="w-64 shrink-0 overflow-hidden rounded-xl ring-1 ring-champagne/25">
            <BrandImage id={p.id} alt="" sizes="16rem" className="aspect-[3/4]" />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div
      className="mt-10 space-y-4 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]"
      aria-hidden="true"
    >
      {rows.map((row, r) => (
        <div key={r} className="flex overflow-hidden">
          <motion.ul
            className="flex shrink-0 gap-4 pr-4"
            initial={{ x: r === 0 ? "0%" : "-50%" }}
            animate={{ x: r === 0 ? "-50%" : "0%" }}
            transition={{ duration: 52 + r * 8, ease: "linear", repeat: Infinity }}
          >
            {[...row, ...row].map((p, i) => (
              <li
                key={`${p.id}-${i}`}
                className="w-56 shrink-0 overflow-hidden rounded-xl ring-1 ring-champagne/25 transition-transform duration-700 hover:scale-[1.03] sm:w-64"
              >
                <BrandImage id={p.id} alt="" sizes="16rem" className="aspect-[3/4]" />
              </li>
            ))}
          </motion.ul>
        </div>
      ))}
    </div>
  );
}
