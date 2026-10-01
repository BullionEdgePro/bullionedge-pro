import { Radio } from "lucide-react";
import Link from "next/link";
import { MediaImage } from "@/components/marketplace/media-image";
import { Spotlight } from "@/components/product/spotlight";
import { ProductBadge } from "@/components/ui/badge";
import { GOLD_TYPES, labelOf } from "@/config/catalog";
import { cn } from "@/lib/cn";
import { formatPeso } from "@/lib/pricing";
import { gramsLabel, purityLabel } from "@/lib/server/marketplace/describe";
import type { ProductCard as Card } from "@/lib/server/shop/products";

/**
 * An Official Shop piece in the grid. Same anatomy as a marketplace card
 * (photo, purity and grams, live price) with the gold crown of the house
 * instead of a seller line, and its stock instead of a place.
 */
export function ProductCard({ card, priority = false, className }: { card: Card; priority?: boolean; className?: string }) {
  const v = card.valuation;
  const soldOut = card.stock <= 0;
  const facts = [purityLabel(card), card.metal === "gold" && card.goldType && card.goldType !== "other" ? labelOf(GOLD_TYPES, card.goldType) : "", gramsLabel(card.weightGrams)].filter(Boolean);
  return (
    <Spotlight
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-champagne/25 bg-surface transition-[border-color,transform,box-shadow] duration-500 ease-(--ease-vault) hover:-translate-y-0.5 hover:border-champagne/60 hover:shadow-[0_24px_48px_-28px_rgb(0_0_0/0.8),0_0_0_1px_rgb(214_178_110/0.12)] motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      <Link href={`/shop/${card.code}`} className="relative z-10 flex h-full flex-col focus-visible:outline-offset-[-2px]">
        <div className="relative">
          <MediaImage
            src={card.coverUrl}
            alt={card.title}
            priority={priority}
            className={cn("aspect-[4/5]", soldOut && "opacity-60 grayscale-[35%]")}
            imgClassName="transition-transform duration-[1400ms] ease-(--ease-vault) group-hover:scale-[1.04]"
          />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-velvet/85 to-transparent" />
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            <ProductBadge kind="official" className="bg-velvet/80 backdrop-blur-sm" />
            {card.pawnable && <ProductBadge kind="pawnable" className="bg-velvet/80 backdrop-blur-sm" />}
          </div>
          <p className="absolute bottom-3 left-3 font-display text-[0.7rem] tracking-[0.2em] text-pearl/80 tabular">{card.code}</p>
          {soldOut ? (
            <p className="absolute right-3 bottom-3 rounded-full bg-velvet/85 px-2.5 py-0.5 text-[0.7rem] font-semibold tracking-wide text-pearl/80 uppercase">Sold out</p>
          ) : (
            v.live && (
              <p className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-velvet/75 px-2 py-0.5 text-[0.7rem] font-semibold text-champagne backdrop-blur-sm">
                <Radio className="size-3" aria-hidden /> Live price
              </p>
            )
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <p className="text-xs text-muted tabular">{facts.join(" · ")}</p>
          <h3 className="line-clamp-2 font-display text-lg leading-snug text-fg">{card.title}</h3>
          <div className="mt-auto flex items-end justify-between gap-3 pt-2">
            {v.pricePhp !== null ? (
              <p className="font-display text-2xl leading-none text-gold tabular">{formatPeso(v.pricePhp)}</p>
            ) : (
              <p className="text-sm text-muted">Price returns with live prices</p>
            )}
            {!soldOut && card.layawayAllowed && <span className="shrink-0 text-xs font-semibold text-champagne/85">Layaway</span>}
          </div>
          {!soldOut && card.stock > 1 && <p className="text-xs text-muted tabular">{card.stock} in stock</p>}
        </div>
      </Link>
    </Spotlight>
  );
}
