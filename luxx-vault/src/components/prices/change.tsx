import { cn } from "@/lib/cn";
import { DASH, direction, formatPct } from "@/lib/prices-format";

/**
 * A 24h (or any) change: ▲ in the success tone, ▼ in the danger tone, "—"
 * when we don't have a reading yet. Works in server and client components.
 */
export function Change({ pct, className, label = "24h change" }: { pct: number | null | undefined; className?: string; label?: string }) {
  const dir = direction(pct);
  if (dir === null) {
    return (
      <span className={cn("tabular text-muted", className)} title={`${label} not available yet`}>
        <span aria-hidden>{DASH}</span>
        <span className="sr-only">{label} not available yet</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-1 whitespace-nowrap",
        dir === "up" ? "text-success" : dir === "down" ? "text-danger" : "text-muted",
        className,
      )}
    >
      <span aria-hidden className="text-[0.7em]">
        {dir === "up" ? "▲" : dir === "down" ? "▼" : "■"}
      </span>
      <span className="sr-only">{label}: </span>
      {formatPct(pct)}
    </span>
  );
}
