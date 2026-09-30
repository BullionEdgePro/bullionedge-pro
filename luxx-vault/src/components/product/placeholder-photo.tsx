import { Monogram } from "@/components/brand/monogram";
import { cn } from "@/lib/cn";

/**
 * Neutral stand-in until the owner's product photos are processed
 * (brand-assets/products → npm run images). Never stock jewellery photos.
 */
export function PlaceholderPhoto({
  label,
  className,
  tone = "pearl",
  compact = false,
}: {
  label: string;
  className?: string;
  tone?: "pearl" | "velvet";
  /** Thumbnails: mark only, no caption. */
  compact?: boolean;
}) {
  return (
    <div
      role="img"
      aria-label={`${label} — photo coming soon`}
      className={cn(
        "relative grid place-items-center overflow-hidden",
        tone === "pearl"
          ? "bg-[radial-gradient(120%_90%_at_30%_20%,#ffffff_0%,#eef0f3_55%,#e2e5ea_100%)] text-bullion/35"
          : "bg-[radial-gradient(120%_90%_at_30%_20%,#2c2140_0%,#1b1326_60%,#140e1b_100%)] text-champagne/30",
        className,
      )}
    >
      <Monogram option="c" variant="current" className="w-1/4 max-w-24" aria-hidden title="" />
      {!compact && (
        <span className="absolute bottom-3 left-3 rounded-full bg-black/5 px-2 py-0.5 text-2xs font-medium tracking-wide text-muted dark:bg-white/5">
          Photo coming soon
        </span>
      )}
    </div>
  );
}
