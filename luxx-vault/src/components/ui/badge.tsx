import { cva, type VariantProps } from "class-variance-authority";
import { BadgeCheck, Crown, FlaskConical, Gem, Landmark, Mail, ScrollText, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-5 whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "border-line bg-surface-sunk text-muted",
        gold: "border-gold-large/40 bg-gold-tint text-gold",
        ice: "border-ice-deep/30 bg-ice-tint text-fg dark:border-ice/30",
        success: "border-success/30 bg-success-tint text-success",
        warning: "border-warning/30 bg-warning-tint text-warning",
        danger: "border-danger/30 bg-danger-tint text-danger",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps extends ComponentProps<"span">, VariantProps<typeof badgeVariants> {
  icon?: ReactNode;
}

export function Badge({ className, tone, icon, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {icon}
      {children}
    </span>
  );
}

/** Verification tiers (brief §8). Shown next to every user name. */
export const TIERS = [
  { tier: 0, label: "Guest", long: "Not signed in", tone: "neutral", icon: <UserRound aria-hidden /> },
  { tier: 1, label: "Email verified", long: "Tier 1 · email confirmed", tone: "neutral", icon: <Mail aria-hidden /> },
  { tier: 2, label: "Phone verified", long: "Tier 2 · PH mobile confirmed by OTP", tone: "neutral", icon: <Smartphone aria-hidden /> },
  { tier: 3, label: "ID verified", long: "Tier 3 · government ID + liveness + face match", tone: "ice", icon: <ShieldCheck aria-hidden /> },
  { tier: 4, label: "Verified seller", long: "Tier 4 · ID + proof of address + payout in own name", tone: "ice", icon: <BadgeCheck aria-hidden /> },
] as const;

export function TierBadge({ tier, className }: { tier: 0 | 1 | 2 | 3 | 4; className?: string }) {
  const t = TIERS[tier];
  return (
    <Badge tone={t.tone} icon={t.icon} className={className} title={t.long}>
      {t.label}
    </Badge>
  );
}

/** Product and listing badges. */
export const PRODUCT_BADGES = {
  official: { label: "Official Luxx4less", tone: "gold", icon: <Crown aria-hidden /> },
  pawnable: { label: "Pawnable", tone: "success", icon: <Landmark aria-hidden /> },
  certificate: { label: "With certificate", tone: "neutral", icon: <ScrollText aria-hidden /> },
  luxxTested: { label: "Luxx-Tested", tone: "ice", icon: <FlaskConical aria-hidden /> },
  diamond: { label: "GIA graded", tone: "ice", icon: <Gem aria-hidden /> },
} as const;

export function ProductBadge({ kind, className }: { kind: keyof typeof PRODUCT_BADGES; className?: string }) {
  const b = PRODUCT_BADGES[kind];
  return (
    <Badge tone={b.tone} icon={b.icon} className={className}>
      {b.label}
    </Badge>
  );
}
