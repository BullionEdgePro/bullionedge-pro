import { AlertTriangle, MapPin, Radio } from "lucide-react";
import Link from "next/link";
import { Spotlight } from "@/components/product/spotlight";
import { Badge, ProductBadge, TierBadge } from "@/components/ui/badge";
import { GOLD_TYPES, labelOf } from "@/config/catalog";
import { cn } from "@/lib/cn";
import { formatPeso } from "@/lib/pricing";
import { gramsLabel, purityLabel } from "@/lib/server/marketplace/describe";
import type { ListingCard as Card } from "@/lib/server/marketplace/listings";
import { premiumLabel } from "@/lib/server/marketplace/valuation";
import { MediaImage } from "./media-image";
import { SaveButton } from "./save-button";

/**
 * A marketplace listing in the browse grid: photo first, then the numbers a
 * gold buyer checks (purity, grams, price, premium over melt), then who sells
 * it. Priced live from today's spot on the server.
 */
export function ListingCard({ card, saved, signedIn, priority = false }: { card: Card; saved: boolean; signedIn: boolean; priority?: boolean }) {
  const v = card.valuation;
  const purity = purityLabel(card);
  const facts = [purity, card.metal === "gold" && card.goldType && card.goldType !== "other" ? labelOf(GOLD_TYPES, card.goldType) : "", gramsLabel(card.weightGrams)].filter(Boolean);
  return (
    <Spotlight className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-[border-color,transform,box-shadow] duration-500 ease-(--ease-vault) hover:-translate-y-0.5 hover:border-champagne/45 hover:shadow-[0_24px_48px_-28px_rgb(0_0_0/0.8)] motion-reduce:hover:translate-y-0">
      <Link href={`/marketplace/${card.code}`} className="relative z-10 flex h-full flex-col focus-visible:outline-offset-[-2px]">
        <div className="relative">
          <MediaImage src={card.coverUrl} alt={card.title} priority={priority} className="aspect-[4/5]" imgClassName="transition-transform duration-[1400ms] ease-(--ease-vault) group-hover:scale-[1.04]" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-velvet/85 to-transparent" />
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            {card.luxxTested && <ProductBadge kind="luxxTested" className="bg-velvet/80 backdrop-blur-sm" />}
            {card.openToOffers && (
              <Badge tone="gold" className="bg-velvet/80 backdrop-blur-sm">
                Open to offers
              </Badge>
            )}
          </div>
          <p className="absolute bottom-3 left-3 font-display text-[0.7rem] tracking-[0.2em] text-pearl/80 tabular">{card.code}</p>
          {v.live && (
            <p className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-velvet/75 px-2 py-0.5 text-[0.7rem] font-semibold text-champagne backdrop-blur-sm">
              <Radio className="size-3" aria-hidden /> Spot-pegged
            </p>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <p className="text-xs text-muted tabular">{facts.join(" · ")}</p>
          <h3 className="line-clamp-2 font-sans text-[0.95rem] leading-snug font-semibold text-fg">{card.title}</h3>

          <div className="mt-auto pt-2">
            {v.pricePhp !== null ? (
              <p className="font-display text-2xl leading-none text-gold tabular">{formatPeso(v.pricePhp)}</p>
            ) : (
              <p className="text-sm text-muted">Price updates when live prices return</p>
            )}
            {v.premiumPct !== null && (
              <p className={cn("mt-1.5 text-xs font-semibold tabular", v.belowMelt ? "text-danger" : v.premiumPct < 0 ? "text-warning" : "text-muted")}>
                {premiumLabel(v.premiumPct)}
                {v.meltPhp !== null && <span className="font-normal text-muted"> · melt {formatPeso(v.meltPhp)}</span>}
              </p>
            )}
            {v.belowMelt && (
              <p className="mt-2 flex items-center gap-1.5 rounded-md bg-danger-tint px-2 py-1 text-xs font-semibold text-danger">
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden /> Verify before buying
              </p>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-xs font-semibold text-fg">{card.seller.displayName}</span>
              {card.seller.tier >= 3 && <TierBadge tier={card.seller.tier} className="px-1.5 text-[0.65rem]" />}
            </span>
            <span className="shrink-0 text-xs text-muted" title={`Trust score ${card.seller.trustScore} of 100`}>
              <span className="font-semibold text-champagne tabular">{card.seller.trustScore}</span> · {card.seller.trustLabel}
            </span>
          </div>
          <p className="flex items-center gap-1 truncate text-xs text-muted">
            <MapPin className="size-3 shrink-0" aria-hidden /> {card.place}
          </p>
        </div>
      </Link>
      <SaveButton listingId={card.id} initialSaved={saved} signedIn={signedIn} label={card.title} className="absolute top-3 right-3 z-20" />
    </Spotlight>
  );
}
