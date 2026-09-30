import Link from "next/link";
import { BadgeCheck, Check, Hourglass, Lock, Mail, RotateCcw, ShieldCheck, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export type RungKey = "email" | "phone" | "identity" | "seller";
export type RungState = "done" | "current" | "review" | "attention" | "locked";

/** What each tier is for and what it opens (brief §8). */
export const RUNGS: Record<RungKey, { tier: number; title: string; why: string; unlocks: string[]; icon: typeof Mail }> = {
  email: {
    tier: 1,
    title: "Email address",
    why: "So we can reach you about your account, and so no one signs up in your name.",
    unlocks: ["Wishlist", "Price alerts", "Official store cart"],
    icon: Mail,
  },
  phone: {
    tier: 2,
    title: "Mobile number",
    why: "A Philippine number confirmed by a one-time code. It is never shown to other members.",
    unlocks: ["Checkout from the official store", "Messaging"],
    icon: Smartphone,
  },
  identity: {
    tier: 3,
    title: "Identity",
    why: "A government ID and a short selfie check, reviewed by our team. Every buyer and seller on the marketplace is a real, adult person.",
    unlocks: ["Marketplace buying", "Offers", "Chat with sellers"],
    icon: ShieldCheck,
  },
  seller: {
    tier: 4,
    title: "Verified seller",
    why: "Proof of address and a payout account in your own name, so buyers know who they are paying.",
    unlocks: ["Create listings", "Receive payouts"],
    icon: BadgeCheck,
  },
};

const STATE_BADGE: Record<RungState, { label: string; tone: "success" | "gold" | "warning" | "danger" | "neutral" }> = {
  done: { label: "Verified", tone: "success" },
  current: { label: "Next step", tone: "gold" },
  review: { label: "In review", tone: "warning" },
  attention: { label: "Action needed", tone: "danger" },
  locked: { label: "Locked", tone: "neutral" },
};

export type Rung = { key: RungKey; state: RungState; detail?: string | null; href?: string; actionLabel?: string };

/**
 * The four tiers as a ladder, read top to bottom. A gold thread runs down
 * through the tiers already earned and stops at the one in progress.
 */
export function TierLadder({ rungs }: { rungs: Rung[] }) {
  return (
    <ol className="relative grid" aria-label="Verification tiers">
      {rungs.map((rung, i) => {
        const r = RUNGS[rung.key];
        const Icon = rung.state === "done" ? Check : rung.state === "review" ? Hourglass : rung.state === "attention" ? RotateCcw : rung.state === "locked" ? Lock : r.icon;
        const last = i === rungs.length - 1;
        const badge = STATE_BADGE[rung.state];
        return (
          <li key={rung.key} className="relative grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-4 sm:grid-cols-[3.25rem_minmax(0,1fr)] sm:gap-x-5">
            {!last && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-12 bottom-1 left-[1.375rem] w-px sm:top-14 sm:left-[1.625rem]",
                  rung.state === "done" ? "bg-linear-to-b from-champagne/80 to-champagne/40" : "bg-line",
                )}
              />
            )}
            <span
              aria-hidden
              className={cn(
                "relative z-10 grid size-11 place-items-center rounded-full border transition-shadow sm:size-13",
                rung.state === "done" && "border-transparent bg-gold-metal text-velvet shadow-[0_0_0_4px_rgb(214_178_110/0.12)]",
                rung.state === "current" && "border-champagne bg-surface text-champagne shadow-[0_0_0_6px_rgb(214_178_110/0.10),0_0_28px_-6px_rgb(214_178_110/0.55)]",
                rung.state === "review" && "border-warning/60 bg-warning-tint text-warning",
                rung.state === "attention" && "border-danger/60 bg-danger-tint text-danger",
                rung.state === "locked" && "border-line bg-surface-sunk text-muted",
              )}
            >
              <Icon className="size-5" />
            </span>
            <div className={cn("min-w-0 pb-9", last && "pb-0")}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1.5 sm:pt-2.5">
                <p className="text-xs font-semibold tracking-wide text-muted">Tier {r.tier}</p>
                <Badge tone={badge.tone}>{badge.label}</Badge>
              </div>
              <h3 className={cn("mt-1 text-xl sm:text-2xl", rung.state === "locked" && "text-fg/70")}>{r.title}</h3>
              {rung.detail && <p className="tabular mt-1 text-sm font-medium text-fg/90">{rung.detail}</p>}
              <p className="measure mt-2 text-sm text-muted">{r.why}</p>
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={`Tier ${r.tier} unlocks`}>
                {r.unlocks.map((u) => (
                  <li
                    key={u}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs",
                      rung.state === "done" ? "border-champagne/30 bg-gold-tint text-champagne" : "border-line text-muted",
                    )}
                  >
                    {u}
                  </li>
                ))}
              </ul>
              {rung.href && rung.actionLabel && (
                <Button asChild size="sm" variant={rung.state === "current" ? "primary" : "secondary"} className="mt-4 rounded-full px-5">
                  <Link href={rung.href}>{rung.actionLabel}</Link>
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
