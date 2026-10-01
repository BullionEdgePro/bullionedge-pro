"use client";

import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, Coins, Crown, Gem, MessageSquarePlus, PackageSearch, Scale, Store, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Emblem } from "@/components/brand/logo";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/cn";

type Side = "buy" | "sell";
type Entry = { href: string; title: string; body: string; icon: LucideIcon };

/** One menu for each kind of visitor (owner, 1 Oct 2026): what you can do as a buyer, and as a seller. */
export const BUY_SELL: Record<Side, { label: string; kicker: string; promise: string; entries: Entry[] }> = {
  buy: {
    label: "Buy",
    kicker: "For buyers",
    promise: "Every seller ID-verified. Your payment is held until the piece is in your hands.",
    entries: [
      { href: "/shop", title: "Official Luxx4less shop", body: "Our own pieces, with layaway and pickup in store", icon: Crown },
      { href: "/marketplace", title: "Browse gold for sale", body: "Jewellery, bars and coins from verified sellers", icon: Gem },
      { href: "/marketplace/wanted/new", title: "Post what you want", body: "Matching sellers are told straight away", icon: MessageSquarePlus },
      { href: "/tools/price-check", title: "Check an offer is fair", body: "Spot a price that's too good to be true", icon: Scale },
    ],
  },
  sell: {
    label: "Sell",
    kicker: "For sellers",
    promise: "Reach buyers who are verified like you, with a fair-price guide on every listing.",
    entries: [
      { href: "/marketplace/sell", title: "List an item", body: "Watermarked photos and a live melt value", icon: Store },
      { href: "/sell", title: "Sell to Luxx4less", body: "An instant estimate, then an appraisal in store", icon: Coins },
      { href: "/marketplace?tab=wanted", title: "Answer wanted posts", body: "Buyers already looking for what you have", icon: PackageSearch },
      { href: "/account/verification?step=seller", title: "Become a verified seller", body: "ID, address and payout checks, about five minutes", icon: BadgeCheck },
    ],
  },
};

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The Buy / Sell switch in the header. An engraved pill whose gold slide
 * follows the pointer; each half opens a glass panel of what you can do,
 * with a soft light that tracks the cursor. Keyboard: Tab to a half, Enter
 * or Space opens it, Escape closes. Reduced motion: no slide, no stagger.
 */
export function BuySellSwitch() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<Side | null>(null);
  const [hover, setHover] = useState<Side | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const panelId = useId();

  // Which half is "home" for the current page, so the slide rests there.
  const current: Side | null = pathname.startsWith("/marketplace/sell") || pathname === "/sell" ? "sell" : pathname.startsWith("/marketplace") || pathname.startsWith("/shop") ? "buy" : null;
  const lit = hover ?? open ?? current;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(null);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const cancelClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const closeSoon = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      setOpen(null);
      setHover(null);
    }, 200);
  };

  // A soft gold light that follows the cursor across the panel.
  const onPanelMove = (e: React.PointerEvent) => {
    const el = panel.current;
    if (!el || reduce) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--lx-x", `${e.clientX - r.left}px`);
    el.style.setProperty("--lx-y", `${e.clientY - r.top}px`);
  };

  const data = open ? BUY_SELL[open] : null;

  return (
    <div
      ref={root}
      className="relative"
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") closeSoon();
      }}
      onPointerEnter={cancelClose}
    >
      {/* The pill: a gold sweep travels round its border. */}
      <div className="lx-gilt-ring relative rounded-full p-px">
        <div role="group" aria-label="Buy or sell" className="relative flex rounded-full bg-velvet/90 p-1">
          {(["buy", "sell"] as const).map((side) => (
            <button
              key={side}
              type="button"
              aria-expanded={open === side}
              aria-controls={panelId}
              onPointerEnter={(e) => {
                if (e.pointerType !== "mouse") return;
                cancelClose();
                setHover(side);
                setOpen(side);
              }}
              onClick={() => setOpen((o) => (o === side ? null : side))}
              className={cn(
                "relative z-10 rounded-full px-4 py-1.5 font-display text-[0.78rem] tracking-[0.22em] uppercase transition-colors duration-300 xl:px-5",
                lit === side ? "text-velvet" : "text-pearl/75 hover:text-champagne",
              )}
            >
              {lit === side &&
                (reduce ? (
                  <span aria-hidden className="absolute inset-0 -z-10 rounded-full bg-gold-metal" />
                ) : (
                  <motion.span
                    layoutId="lx-buysell-slide"
                    aria-hidden
                    className="absolute inset-0 -z-10 rounded-full bg-gold-metal shadow-[inset_0_1px_0_rgb(255_255_255/0.5),0_6px_18px_-8px_#A8823F]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                ))}
              {BUY_SELL[side].label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {data && (
          <motion.div
            ref={panel}
            id={panelId}
            role="dialog"
            aria-label={`${data.label} on Luxx4less`}
            key={open}
            onPointerMove={onPanelMove}
            initial={reduce ? false : { opacity: 0, y: -8, scale: 0.98, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={reduce ? undefined : { opacity: 0, y: -6, scale: 0.985, filter: "blur(3px)", transition: { duration: 0.16 } }}
            transition={{ duration: 0.38, ease: EASE }}
            className="lx-spotlight absolute top-[calc(100%+0.9rem)] left-0 z-50 w-[34rem] origin-top-left overflow-hidden rounded-3xl border border-champagne/25 bg-velvet/95 p-6 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.95),0_0_0_1px_rgb(214_178_110/0.06)] backdrop-blur-xl"
          >
            {/* The emblem, faint, like a watermark on a certificate. */}
            <Emblem title="" aria-hidden className="pointer-events-none absolute -right-10 -bottom-12 size-56 opacity-[0.06]" />

            <p className="font-display text-xs tracking-[0.3em] text-champagne uppercase">{data.kicker}</p>
            <p className="mt-2 max-w-sm text-sm text-muted">{data.promise}</p>

            <ul className="relative mt-5 grid grid-cols-2 gap-2">
              {data.entries.map((e, i) => (
                <motion.li
                  key={e.href}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 + i * 0.05, duration: 0.42, ease: EASE }}
                >
                  <Link
                    href={e.href}
                    onClick={() => setOpen(null)}
                    className="group flex h-full gap-3 rounded-2xl border border-transparent p-3 transition-[border-color,background-color] duration-300 hover:border-champagne/30 hover:bg-gold-tint/60"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-champagne/35 bg-velvet text-champagne transition-[box-shadow,transform] duration-500 group-hover:-translate-y-0.5 group-hover:shadow-[0_8px_22px_-10px_#D6B26E]">
                      <e.icon className="size-[1.1rem]" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-fg transition-colors group-hover:text-champagne">{e.title}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted">{e.body}</span>
                    </span>
                  </Link>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Phone menu: Buy and Sell as two large cards at the top. */
export function BuySellCards({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="grid gap-3 min-[420px]:grid-cols-2">
      {(["buy", "sell"] as const).map((side) => {
        const d = BUY_SELL[side];
        return (
          <div key={side} className="lx-gilt-ring rounded-2xl p-px">
            <div className="grid h-full min-w-0 gap-3 rounded-2xl bg-velvet p-4">
              <p className="font-display text-2xl text-gold-metal">{d.label}</p>
              <ul className="grid gap-2">
                {d.entries.slice(0, 3).map((e) => (
                  <li key={e.href}>
                    <Link href={e.href} onClick={onNavigate} className="flex min-w-0 items-center gap-2 text-sm text-fg/85 hover:text-champagne">
                      <e.icon className="size-4 shrink-0 text-champagne" aria-hidden />
                      <span className="truncate">{e.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );
}
