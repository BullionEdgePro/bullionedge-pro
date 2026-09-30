import { cn } from "@/lib/cn";
import type { MarketStatus } from "@/lib/prices-format";

/** A small status line: a dot plus "Live · …", "Prices delayed · …" or "Markets closed · …". */
export function MarketStatusLine({ status, className }: { status: MarketStatus; className?: string }) {
  return (
    <p
      className={cn(
        "tabular inline-flex items-center gap-2 text-sm",
        status.tone === "delayed" || status.tone === "none" ? "text-warning" : "text-muted",
        className,
      )}
      role="status"
    >
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full",
          status.tone === "live" && "bg-success shadow-[0_0_8px_rgb(108_199_154/0.8)]",
          status.tone === "closed" && "bg-muted",
          (status.tone === "delayed" || status.tone === "none") && "bg-warning",
        )}
      />
      {status.text}
    </p>
  );
}
