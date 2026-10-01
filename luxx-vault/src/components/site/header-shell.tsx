"use client";

import { AnimatePresence, motion, useScroll, useSpring } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Lockup } from "@/components/brand/logo";
import { BuySellCards, BuySellSwitch } from "./buy-sell-switch";
import { cn } from "@/lib/cn";

/**
 * `desktopHidden` items appear only in the phone menu. `from` holds an item back
 * until the desktop bar is wide enough for it (the Buy / Sell switch comes first).
 */
export type NavItem = { href: string; label: string; desktopHidden?: boolean; from?: "xl" | "2xl" };

/**
 * The house header: open at the top of a page, then a band of smoked glass
 * fades in behind it once you start reading. Its height never changes, so
 * nothing on the page moves. A gold thread along its lower edge fills as you scroll.
 *
 * `overlay` floats it over a full-bleed opening photo instead of pushing the
 * page down.
 */
export function HeaderShell({
  nav,
  actions,
  banner,
  ticker,
  menuFooter,
  overlay = false,
}: {
  nav: readonly NavItem[];
  actions: ReactNode;
  banner?: ReactNode;
  /** The live price ticker: a slim band above the header row. */
  ticker?: ReactNode;
  /** Extra links at the foot of the phone menu (account, sign out). */
  menuFooter?: ReactNode;
  overlay?: boolean;
}) {
  const [settled, setSettled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const reduce = useReducedMotion();
  const topStrip = useRef<HTMLDivElement>(null);

  // Publish the height of the strip above the header row (test-mode banner + ticker) as
  // --header-top, so pages under an overlay header reserve exactly the room it takes.
  useEffect(() => {
    const el = topStrip.current;
    if (!el) return;
    const root = document.documentElement;
    const ro = new ResizeObserver(() => root.style.setProperty("--header-top", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { scrollYProgress } = useScroll();
  const thread = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.4 });

  useEffect(() => {
    const onScroll = () => setSettled(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Links close the phone menu themselves; Escape closes it too. The page behind is locked.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div className={cn("inset-x-0 top-0 z-40", overlay ? "fixed" : "sticky")}>
      <div ref={topStrip}>
        {banner}
        {ticker && <div className="relative z-10 border-b border-line/70 bg-velvet/75 backdrop-blur-md">{ticker}</div>}
      </div>
      <header
        className={cn(
          "relative transition-[background-color,backdrop-filter,box-shadow] duration-500 ease-(--ease-vault)",
          settled
            ? "bg-velvet/80 shadow-[0_18px_40px_-28px_rgb(0_0_0/0.9)] backdrop-blur-xl backdrop-saturate-150"
            : overlay
              ? "bg-gradient-to-b from-velvet/80 via-velvet/35 to-transparent"
              : "bg-transparent",
        )}
      >
        <div
          className={cn(
            // One fixed height (owner, 1 Oct 2026): a header that shrinks on scroll moves the whole
            // page, and near the top it flickers as the shrink itself pushes the scroll back.
            "mx-auto grid h-20 max-w-7xl grid-cols-[1fr_auto] items-center gap-4 px-4 sm:px-8 lg:h-24 lg:grid-cols-[1fr_auto_1fr]",
          )}
        >
          <nav aria-label="Main" className="hidden items-center gap-6 lg:flex xl:gap-7">
            <BuySellSwitch />
            {nav
              .filter((item) => !item.desktopHidden)
              .map((item) => (
                <span key={item.href} className={cn(item.from === "xl" && "hidden xl:inline", item.from === "2xl" && "hidden 2xl:inline")}>
                  <HouseLink href={item.href} label={item.label} />
                </span>
              ))}
          </nav>

          <Link
            href="/"
            aria-label="Luxx4less home"
            className="group min-w-0 justify-self-start rounded-md lg:justify-self-center"
          >
            <Lockup
              className={cn(
                "text-lg sm:text-xl lg:text-2xl",
              )}
              emblemClassName="size-12 sm:size-14 lg:size-16 transition-[filter] duration-500 group-hover:drop-shadow-[0_0_18px_rgb(232_186_136/0.45)]"
            />
          </Link>

          <div className="flex items-center justify-end gap-3 sm:gap-4">
            {actions}
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-controls="house-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((o) => !o)}
              className="relative z-50 grid size-11 place-items-center rounded-full border border-champagne/40 text-champagne transition-colors hover:border-champagne lg:hidden"
            >
              <span aria-hidden className="relative block h-3 w-5">
                <span className={cn("absolute inset-x-0 top-0 h-px bg-current transition-transform duration-300", menuOpen && "top-1.5 rotate-45")} />
                <span className={cn("absolute inset-x-0 bottom-0 h-px bg-current transition-transform duration-300", menuOpen && "bottom-1.5 -rotate-45")} />
              </span>
            </button>
          </div>
        </div>

        {/* The gold thread: hairline always there, filled to scroll position. */}
        <div
          aria-hidden
          className={cn(
            "absolute inset-x-0 bottom-0 h-px transition-opacity duration-500",
            settled ? "opacity-100" : "opacity-0",
            "bg-[linear-gradient(90deg,transparent,rgb(214_178_110/0.28)_20%,rgb(214_178_110/0.28)_80%,transparent)]",
          )}
        >
          {!reduce && (
            <motion.div
              className="h-full origin-left bg-[linear-gradient(90deg,#a8823f,#f7e7bb_50%,#d6b26e)] shadow-[0_0_10px_rgb(247_231_187/0.6)]"
              style={{ scaleX: thread }}
            />
          )}
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            id="house-menu"
            aria-label="Main"
            className="fixed inset-0 z-40 flex flex-col overflow-y-auto overscroll-contain bg-velvet/97 px-6 pt-28 pb-12 backdrop-blur-xl sm:px-8 lg:hidden"
            initial={reduce ? false : { clipPath: "circle(0% at 92% 6%)" }}
            animate={{ clipPath: "circle(150% at 92% 6%)" }}
            exit={reduce ? undefined : { clipPath: "circle(0% at 92% 6%)" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-8" onClick={() => setMenuOpen(false)}>
              <BuySellCards />
            </div>
            <ul className="space-y-4">
              {nav.map((item, i) => (
                <motion.li
                  key={item.href}
                  initial={reduce ? false : { opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18 + i * 0.07, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Link href={item.href} onClick={() => setMenuOpen(false)} className="font-display text-2xl text-gold-metal sm:text-3xl">
                    {item.label}
                  </Link>
                </motion.li>
              ))}
            </ul>
            <div aria-hidden className="mt-12 h-px w-24 bg-[linear-gradient(90deg,#d6b26e,transparent)]" />
            {menuFooter && (
              <div className="mt-8 flex flex-wrap items-center gap-4" onClick={() => setMenuOpen(false)}>
                {menuFooter}
              </div>
            )}
            <p className="mt-6 font-display text-sm tracking-[0.2em] text-pearl/60 uppercase">Golds and Diamonds · Since 2019</p>
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A nav link whose gold underline draws out from the centre. */
function HouseLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const current = pathname === href.split("#")[0] && !href.includes("#");
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "group relative py-2 font-display text-[0.75rem] tracking-[0.2em] whitespace-nowrap uppercase transition-colors duration-300 xl:text-[0.8rem] xl:tracking-[0.22em]",
        current ? "text-champagne" : "text-pearl/75 hover:text-champagne",
      )}
    >
      {label}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 -bottom-0.5 h-px origin-center bg-[linear-gradient(90deg,transparent,#d6b26e,transparent)] transition-transform duration-500 ease-(--ease-vault)",
          current ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
        )}
      />
    </Link>
  );
}
