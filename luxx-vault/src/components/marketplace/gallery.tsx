"use client";

import Image from "next/image";
import { useState } from "react";
import { Emblem } from "@/components/brand/logo";
import { cn } from "@/lib/cn";

/**
 * Listing photos: one large view and a strip of thumbnails. Arrow keys move
 * between photos. Every photo carries the Luxx4less watermark and listing
 * code, stamped at upload.
 */
export function Gallery({ photos, title }: { photos: { id: string; url: string }[]; title: string }) {
  const [index, setIndex] = useState(0);
  const current = photos[index];

  if (!current) {
    return (
      <div className="grid aspect-[4/5] place-items-center rounded-2xl border border-line bg-[radial-gradient(120%_90%_at_30%_20%,#2c2140_0%,#1b1326_60%,#140e1b_100%)] text-champagne/25">
        <Emblem detail="mono" title="" className="w-1/4" />
      </div>
    );
  }

  return (
    <div
      className="grid gap-3"
      role="group"
      aria-roledescription="gallery"
      aria-label={`${title}: ${photos.length} ${photos.length === 1 ? "photo" : "photos"}`}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") setIndex((i) => (i + 1) % photos.length);
        if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + photos.length) % photos.length);
      }}
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-line bg-surface-sunk">
        <Image
          key={current.id}
          src={current.url}
          alt={`${title}, photo ${index + 1} of ${photos.length}`}
          fill
          priority={index === 0}
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-champagne/20" />
        {photos.length > 1 && (
          <p className="absolute right-3 bottom-3 rounded-full bg-velvet/75 px-2.5 py-0.5 text-xs font-semibold text-pearl tabular backdrop-blur-sm">
            {index + 1} / {photos.length}
          </p>
        )}
      </div>
      {photos.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <li key={p.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "relative block size-16 overflow-hidden rounded-lg border transition-[border-color,opacity] sm:size-20",
                  i === index ? "border-champagne" : "border-line opacity-70 hover:opacity-100",
                )}
              >
                <Image src={p.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
