import { ShieldAlert } from "lucide-react";
import { SCAM_FLAG_COPY, knownFlags } from "@/lib/scam-detect";
import { cn } from "@/lib/cn";

/**
 * The calm warning under a flagged chat message, seen by both people. It
 * explains the risk rather than accusing anyone: a buyer sharing their own
 * number by mistake sees the same note as a scammer.
 */
export function ScamWarning({ flags, className }: { flags: readonly string[]; className?: string }) {
  const known = knownFlags(flags);
  if (!known.length) return null;
  return (
    <div role="note" className={cn("mt-2 max-w-md rounded-xl border border-warning/30 bg-warning-tint/70 px-3.5 py-2.5 text-left text-xs text-fg", className)}>
      <p className="flex items-center gap-1.5 font-semibold text-warning">
        <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
        {known.length === 1 ? SCAM_FLAG_COPY[known[0]!].title : "Please read before replying"}
      </p>
      <ul className="mt-1 grid gap-1 text-muted">
        {known.map((f) => (
          <li key={f}>
            {known.length > 1 && <strong className="font-semibold text-fg">{SCAM_FLAG_COPY[f].title}. </strong>}
            {SCAM_FLAG_COPY[f].body}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The standing line at the top of every conversation. */
export function PlatformPaymentNote({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-start gap-2 text-xs text-muted", className)}>
      <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-champagne" aria-hidden />
      <span>
        <strong className="font-semibold text-fg">Luxx4less will never ask you to pay outside the platform.</strong> Pay only into the protected hold on the
        trade page, and keep every conversation here.
      </span>
    </p>
  );
}
