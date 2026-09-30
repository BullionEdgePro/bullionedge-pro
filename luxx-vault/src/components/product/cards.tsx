import { Heart, MapPin } from "lucide-react";
import { ProductBadge, TierBadge } from "@/components/ui/badge";
import { formatPeso } from "@/lib/pricing";
import { cn } from "@/lib/cn";
import { PlaceholderPhoto } from "./placeholder-photo";
import { Spotlight } from "./spotlight";

/** Flagship Luxx4less item — large, editorial, serif name. */
export function EditorialProductCard({
  name,
  goldType,
  karat,
  grams,
  pricePerGram,
  pawnable,
  className,
}: {
  name: string;
  goldType: string;
  karat: number;
  grams: number;
  pricePerGram: number;
  pawnable?: boolean;
  className?: string;
}) {
  return (
    <Spotlight className={cn("overflow-hidden rounded-xl border border-line bg-surface", className)}>
      <article className="grid h-full sm:grid-cols-[1.1fr_1fr]">
        <PlaceholderPhoto label={name} className="aspect-4/5 sm:aspect-auto sm:min-h-80" />
        <div className="relative z-10 flex flex-col gap-4 p-6 sm:p-8">
          <div className="flex flex-wrap gap-2">
            <ProductBadge kind="official" />
            {pawnable && <ProductBadge kind="pawnable" />}
          </div>
          <div>
            <p className="text-sm text-muted">
              {goldType} · {karat}K
            </p>
            <h3 className="mt-1 text-2xl sm:text-3xl">{name}</h3>
          </div>
          <dl className="mt-auto grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <dt className="text-muted">Weight</dt>
            <dd className="tabular text-right">{grams.toFixed(2)} g</dd>
            <dt className="text-muted">Per gram today</dt>
            <dd className="tabular text-right">{formatPeso(pricePerGram)}</dd>
          </dl>
          <p className="tabular border-t border-line pt-4 font-display text-3xl text-gold">{formatPeso(grams * pricePerGram)}</p>
        </div>
      </article>
    </Spotlight>
  );
}

/** Marketplace listing — compact, information-dense, seller trust first. */
export function CompactListingCard({
  title,
  karat,
  grams,
  price,
  seller,
  tier,
  location,
  premiumPct,
  luxxTested,
}: {
  title: string;
  karat: number;
  grams: number;
  price: number;
  seller: string;
  tier: 3 | 4;
  location: string;
  premiumPct: number;
  luxxTested?: boolean;
}) {
  const below = premiumPct < -8;
  return (
    <Spotlight className="overflow-hidden rounded-lg border border-line bg-surface">
      <article className="relative z-10 flex gap-3 p-3">
        <PlaceholderPhoto label={title} compact className="size-24 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-sans text-sm font-semibold">{title}</h3>
            <button type="button" aria-label={`Save ${title}`} className="-m-1 rounded-full p-1 text-muted hover:text-danger">
              <Heart className="size-4" aria-hidden />
            </button>
          </div>
          <p className="text-xs text-muted">
            {karat}K · <span className="tabular">{grams.toFixed(1)} g</span>
          </p>
          <p className="tabular mt-1 font-semibold">
            {formatPeso(price)}{" "}
            <span className={cn("text-xs font-medium", below ? "text-danger" : "text-muted")}>
              {premiumPct >= 0 ? "+" : "−"}
              {Math.abs(premiumPct).toFixed(1)}% vs melt
            </span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <TierBadge tier={tier} />
            {luxxTested && <ProductBadge kind="luxxTested" />}
          </div>
          <p className="mt-1.5 flex items-center gap-1 truncate text-xs text-muted">
            <MapPin className="size-3" aria-hidden /> {seller} · {location}
          </p>
          {below && <p className="mt-1.5 text-xs font-medium text-danger">Far below melt value. Verify before buying.</p>}
        </div>
      </article>
    </Spotlight>
  );
}
