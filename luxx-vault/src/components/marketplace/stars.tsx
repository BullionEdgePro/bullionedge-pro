import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

/** Read-only star rating, e.g. 4.6 → four stars and most of a fifth. */
export function Stars({ value, className, size = "sm" }: { value: number; className?: string; size?: "sm" | "md" }) {
  const px = size === "md" ? "size-[1.1rem]" : "size-3.5";
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className={cn("relative inline-block", px)} aria-hidden>
            <Star className={cn("absolute inset-0 text-line", px)} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={cn("fill-champagne text-champagne", px)} />
            </span>
          </span>
        );
      })}
    </span>
  );
}
