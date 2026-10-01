import { Check, CircleSlash, Gavel, Undo2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Step = { key: string; label: string; detail?: string | null; at?: Date | null };

/**
 * The life of a trade as a gold thread: each settled step is lit, the
 * current one glows, the rest wait in outline. A dispute, refund or
 * cancellation ends the thread with its own mark.
 */
export function TradeTimeline({
  status,
  steps,
  doneCount,
  endNote,
}: {
  status: string;
  steps: Step[];
  /** How many steps are settled; the next one is current unless the trade left the path. */
  doneCount: number;
  endNote?: { label: string; detail?: string | null };
}) {
  const offPath = ["disputed", "refunded", "cancelled"].includes(status);
  return (
    <ol className="relative grid gap-0">
      {steps.map((s, i) => {
        const done = i < doneCount;
        const current = !offPath && i === doneCount;
        const last = i === steps.length - 1 && !endNote;
        return (
          <li key={s.key} className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-4 pb-6 last:pb-0">
            {!last && <span aria-hidden className={cn("absolute top-8 bottom-0 left-4 w-px -translate-x-1/2", done ? "bg-[linear-gradient(to_bottom,#d6b26e,#a8823f)]" : "bg-line")} />}
            <span
              aria-hidden
              className={cn(
                "relative z-10 grid size-8 place-items-center rounded-full border text-xs font-semibold tabular",
                done ? "border-champagne bg-gold-metal text-velvet" : current ? "border-champagne bg-velvet text-champagne shadow-[0_0_0_4px_rgb(214_178_110/0.15)]" : "border-line bg-velvet text-muted",
              )}
            >
              {done ? <Check className="size-4" /> : i + 1}
              {current && <span className="absolute inset-0 animate-ping rounded-full border border-champagne/60 motion-reduce:hidden" />}
            </span>
            <div className="pt-1">
              <p className={cn("text-sm font-semibold", done || current ? "text-fg" : "text-muted")}>
                {s.label}
                <span className="sr-only">{done ? " (done)" : current ? " (current step)" : " (to come)"}</span>
              </p>
              {s.at && <p className="text-xs text-muted">{s.at.toLocaleString("en-PH", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" })}</p>}
              {s.detail && <p className="mt-0.5 text-xs text-muted">{s.detail}</p>}
            </div>
          </li>
        );
      })}
      {endNote && (
        <li className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-4">
          <span
            aria-hidden
            className={cn(
              "relative z-10 grid size-8 place-items-center rounded-full border",
              status === "disputed" ? "border-warning bg-warning-tint text-warning" : status === "refunded" ? "border-ice bg-ice-tint text-ice" : "border-line bg-surface-sunk text-muted",
            )}
          >
            {status === "disputed" ? <Gavel className="size-4" /> : status === "refunded" ? <Undo2 className="size-4" /> : <CircleSlash className="size-4" />}
          </span>
          <div className="pt-1">
            <p className="text-sm font-semibold text-fg">{endNote.label}</p>
            {endNote.detail && <p className="mt-0.5 text-xs text-muted">{endNote.detail}</p>}
          </div>
        </li>
      )}
    </ol>
  );
}
