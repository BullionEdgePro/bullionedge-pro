"use client";

import { AnimatePresence, motion } from "motion/react";
import { Gem, Home, LineChart, Plus, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Emblem } from "@/components/brand/logo";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/cn";
import { BUY_SELL } from "./buy-sell-switch";

type Side = "buy" | "sell";
const EASE = [0.22, 1, 0.36, 1] as const;

const isBuy = (p: string) => (p.startsWith("/marketplace") && !p.startsWith("/marketplace/sell")) || p.startsWith("/shop");
const isSell = (p: string) => p.startsWith("/marketplace/sell") || p === "/sell";

/**
 * Phone navigation, thumb-reachable (brief §5 Layout: sticky bottom nav on
 * mobile). Buy and the raised gold Sell button open the same choices as the
 * desktop Buy / Sell switch, in a sheet that rises from the bottom with its
 * own sliding Buy / Sell toggle. Hidden from large screens, where the header
 * carries them. Pages make room for the bar through `body:has(#lx-tabbar)`.
 */
export function MobileTabBar({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const [sheet, setSheet] = useState<Side | null>(null);
  const close = useCallback(() => setSheet(null), []);
  // Navigating closes the sheet (state adjusted during render, not in an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setSheet(null);
  }
  const account = signedIn ? "/account" : "/sign-in";

  const tab = (active: boolean) =>
    cn("relative flex w-full flex-col items-center gap-1 pt-2 pb-2.5 text-[0.68rem] font-semibold transition-colors", active ? "text-champagne" : "text-pearl/60 active:text-pearl");
  const hairline = (active: boolean) => <span aria-hidden className={cn("absolute top-0 h-0.5 w-6 rounded-full bg-champagne transition-opacity", active ? "opacity-100" : "opacity-0")} />;

  const homeActive = !sheet && pathname === "/";
  const buyActive = sheet === "buy" || (!sheet && isBuy(pathname));
  const sellActive = sheet === "sell" || (!sheet && isSell(pathname));
  const pricesActive = !sheet && (pathname.startsWith("/prices") || pathname.startsWith("/tools"));
  const accountActive = !sheet && (pathname.startsWith("/account") || pathname.startsWith("/admin"));

  return (
    <>
      <nav id="lx-tabbar" aria-label="Quick navigation" className={cn("fixed inset-x-0 bottom-0 border-t border-line/80 bg-velvet/97 pb-[env(safe-area-inset-bottom)] lg:hidden", sheet ? "z-[36]" : "z-30")}>
        <ul className="mx-auto grid h-16 max-w-md grid-cols-5 items-end px-2">
          <li>
            <Link href="/" aria-current={homeActive ? "page" : undefined} className={tab(homeActive)}>
              {hairline(homeActive)}
              <Home className="size-5.5" strokeWidth={homeActive ? 2.2 : 1.8} aria-hidden />
              Home
            </Link>
          </li>
          <li>
            <button type="button" aria-haspopup="dialog" aria-expanded={sheet === "buy"} onClick={() => setSheet((s) => (s === "buy" ? null : "buy"))} className={tab(buyActive)}>
              {hairline(buyActive)}
              <Gem className="size-5.5" strokeWidth={buyActive ? 2.2 : 1.8} aria-hidden />
              Buy
            </button>
          </li>
          <li className="flex justify-center">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={sheet === "sell"}
              onClick={() => setSheet((s) => (s === "sell" ? null : "sell"))}
              className="group -mt-5 flex flex-col items-center gap-1 pb-2 text-[0.68rem] font-semibold text-champagne"
            >
              <span
                className={cn(
                  "grid size-13 place-items-center rounded-full bg-gold-metal text-velvet shadow-[0_10px_28px_-10px_#A8823F,inset_0_1px_0_rgb(255_255_255/0.5)] ring-4 ring-velvet transition-transform duration-300 group-active:scale-95",
                  sellActive && "shadow-[0_0_0_2px_rgb(214_178_110/0.6),0_10px_28px_-10px_#A8823F,inset_0_1px_0_rgb(255_255_255/0.5)]",
                )}
              >
                <Plus className={cn("size-6 transition-transform duration-500 ease-(--ease-vault)", sheet === "sell" && "rotate-45")} strokeWidth={2.4} aria-hidden />
              </span>
              Sell
            </button>
          </li>
          <li>
            <Link href="/prices" aria-current={pricesActive ? "page" : undefined} className={tab(pricesActive)}>
              {hairline(pricesActive)}
              <LineChart className="size-5.5" strokeWidth={pricesActive ? 2.2 : 1.8} aria-hidden />
              Prices
            </Link>
          </li>
          <li>
            <Link href={account} aria-current={accountActive ? "page" : undefined} className={tab(accountActive)}>
              {hairline(accountActive)}
              <UserRound className="size-5.5" strokeWidth={accountActive ? 2.2 : 1.8} aria-hidden />
              Account
            </Link>
          </li>
        </ul>
      </nav>
      <BuySellSheet side={sheet} onSide={setSheet} onClose={close} />
    </>
  );
}

/** The Buy / Sell sheet: a velvet panel with a gilt edge, a sliding toggle, and every choice as a large row. */
function BuySellSheet({ side, onSide, onClose }: { side: Side | null; onSide: (s: Side) => void; onClose: () => void }) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!side) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [side, onClose]);

  const data = side ? BUY_SELL[side] : null;

  return (
    <AnimatePresence>
      {side && data && (
        <div className="fixed inset-0 z-[35] lg:hidden" role="presentation">
          <motion.button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 bg-[#0b0710]/70"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`${data.label} on Luxx4less`}
            className="lx-gilt-ring absolute inset-x-2 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] mx-auto max-w-md rounded-[1.75rem] p-px"
            initial={reduce ? false : { y: "110%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? undefined : { y: "110%", opacity: 0, transition: { duration: 0.28, ease: EASE } }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
          >
            <div className="relative max-h-[calc(100svh-13rem-env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain rounded-[1.75rem] bg-velvet p-5">
              <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[1.75rem] bg-[radial-gradient(90%_60%_at_50%_0%,rgb(214_178_110/0.14),transparent_70%)]" />
              <Emblem title="" aria-hidden className="pointer-events-none absolute -right-8 -bottom-10 size-44 opacity-[0.05]" />

              <div className="relative flex items-center justify-between gap-3">
                <div role="tablist" aria-label="Buy or sell" className="relative flex rounded-full border border-champagne/30 bg-surface-sunk/60 p-1">
                  {(["buy", "sell"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="tab"
                      aria-selected={side === s}
                      onClick={() => onSide(s)}
                      className={cn("relative z-10 rounded-full px-6 py-2 font-display text-sm tracking-[0.22em] uppercase transition-colors duration-300", side === s ? "text-velvet" : "text-pearl/70")}
                    >
                      {side === s &&
                        (reduce ? (
                          <span aria-hidden className="absolute inset-0 -z-10 rounded-full bg-gold-metal" />
                        ) : (
                          <motion.span
                            layoutId="lx-mobile-buysell"
                            aria-hidden
                            className="absolute inset-0 -z-10 rounded-full bg-gold-metal shadow-[inset_0_1px_0_rgb(255_255_255/0.5),0_6px_18px_-8px_#A8823F]"
                            transition={{ type: "spring", stiffness: 420, damping: 34 }}
                          />
                        ))}
                      {BUY_SELL[s].label}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={onClose} aria-label="Close" className="grid size-10 place-items-center rounded-full border border-line text-muted active:text-fg">
                  <X className="size-4" aria-hidden />
                </button>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={side}
                  initial={reduce ? false : { opacity: 0, x: side === "sell" ? 24 : -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? undefined : { opacity: 0, x: side === "sell" ? -24 : 24, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.32, ease: EASE }}
                  className="relative"
                >
                  <p className="mt-5 font-display text-xs tracking-[0.3em] text-champagne uppercase">{data.kicker}</p>
                  <p className="mt-1.5 text-sm text-muted">{data.promise}</p>
                  <ul className="mt-4 grid gap-1.5">
                    {data.entries.map((e, i) => (
                      <motion.li key={e.href} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.05, duration: 0.4, ease: EASE }}>
                        <Link href={e.href} onClick={onClose} className="flex items-center gap-3.5 rounded-2xl border border-transparent p-3 transition-colors active:border-champagne/40 active:bg-gold-tint/60">
                          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-champagne/35 bg-surface text-champagne">
                            <e.icon className="size-5" aria-hidden />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold text-fg">{e.title}</span>
                            <span className="block text-xs leading-snug text-muted">{e.body}</span>
                          </span>
                        </Link>
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
