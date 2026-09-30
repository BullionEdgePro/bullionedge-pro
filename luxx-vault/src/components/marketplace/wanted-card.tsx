import { MapPin, PackageSearch } from "lucide-react";
import Link from "next/link";
import { TierBadge } from "@/components/ui/badge";
import { GOLD_TYPES, labelOf } from "@/config/catalog";
import { formatPeso } from "@/lib/pricing";
import { itemLabel, timeAgo } from "@/lib/server/marketplace/describe";
import type { WantedCard as Card } from "@/lib/server/marketplace/listings";

/** A buyer's wanted post: set as a request slip rather than a product tile. */
export function WantedCard({ card }: { card: Card }) {
  const range =
    card.minGrams && card.maxGrams
      ? `${card.minGrams}–${card.maxGrams} g`
      : card.minGrams
        ? `from ${card.minGrams} g`
        : card.maxGrams
          ? `up to ${card.maxGrams} g`
          : "Any weight";
  return (
    <Link
      href={`/marketplace/wanted/${card.code}`}
      className="group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border border-line bg-surface p-5 transition-colors duration-500 hover:border-champagne/45"
    >
      {/* A perforated left edge, like a slip torn from a request book. */}
      <span aria-hidden className="absolute inset-y-4 left-0 w-px bg-[repeating-linear-gradient(to_bottom,rgb(214_178_110/0.5)_0_4px,transparent_4px_9px)]" />
      <div className="flex items-start justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 font-display text-[0.7rem] tracking-[0.22em] text-champagne uppercase">
          <PackageSearch className="size-3.5" aria-hidden /> Wanted
        </p>
        <p className="font-display text-[0.7rem] tracking-[0.18em] text-muted tabular">{card.code}</p>
      </div>
      <h3 className="font-sans text-base leading-snug font-semibold text-fg group-hover:text-champagne">{card.title}</h3>
      <p className="text-sm text-muted">
        {itemLabel(card)}
        {card.goldType && card.metal === "gold" && card.goldType !== "other" ? ` · ${labelOf(GOLD_TYPES, card.goldType)}` : ""} · <span className="tabular">{range}</span>
      </p>
      <div className="mt-auto flex items-end justify-between gap-3 border-t border-line pt-3">
        <div>
          <p className="text-xs text-muted">Budget up to</p>
          <p className="font-display text-xl text-gold tabular">{card.budgetMaxPhp ? formatPeso(card.budgetMaxPhp) : "Open"}</p>
        </div>
        <div className="text-right text-xs text-muted">
          <p className="tabular">
            {card.offerCount} {card.offerCount === 1 ? "offer" : "offers"}
          </p>
          <p>{timeAgo(card.createdAt)}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-semibold text-fg">{card.buyer.displayName}</span>
          {card.buyer.tier >= 3 && <TierBadge tier={card.buyer.tier} className="px-1.5 text-[0.65rem]" />}
        </span>
        <span className="flex items-center gap-1 truncate">
          <MapPin className="size-3 shrink-0" aria-hidden /> {card.place}
        </span>
      </div>
    </Link>
  );
}
