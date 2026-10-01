"use client";

import { Gem, Home, LineChart, Plus, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/**
 * Phone navigation, thumb-reachable (brief §5 Layout: sticky bottom nav on
 * mobile). Five places, with selling as the raised centre button. Hidden from
 * large screens, where the header carries the same links. Pages make room for
 * it through `body:has(#lx-tabbar)` in globals.css, so nothing hides beneath it.
 */
const TABS = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { href: "/marketplace", label: "Market", icon: Gem, match: (p: string) => p.startsWith("/marketplace") && !p.startsWith("/marketplace/sell") },
  { href: "/marketplace/sell", label: "Sell", icon: Plus, match: (p: string) => p.startsWith("/marketplace/sell") || p === "/sell", primary: true },
  { href: "/prices", label: "Prices", icon: LineChart, match: (p: string) => p.startsWith("/prices") || p.startsWith("/tools") },
  { href: "/account", label: "Account", icon: UserRound, match: (p: string) => p.startsWith("/account") || p.startsWith("/admin") },
] as const;

export function MobileTabBar({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  return (
    <nav
      id="lx-tabbar"
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line/80 bg-velvet/97 pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5 items-end px-2">
        {TABS.map((t) => {
          const active = t.match(pathname);
          const href = t.href === "/account" && !signedIn ? "/sign-in" : t.href;
          if ("primary" in t && t.primary) {
            return (
              <li key={t.href} className="flex justify-center">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className="group -mt-5 flex flex-col items-center gap-1 pb-2 text-[0.68rem] font-semibold text-champagne"
                >
                  <span className="grid size-13 place-items-center rounded-full bg-gold-metal text-velvet shadow-[0_10px_28px_-10px_#A8823F,inset_0_1px_0_rgb(255_255_255/0.5)] ring-4 ring-velvet transition-transform duration-300 group-active:scale-95">
                    <t.icon className="size-6" strokeWidth={2.4} aria-hidden />
                  </span>
                  {t.label}
                </Link>
              </li>
            );
          }
          return (
            <li key={t.href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-1 pt-2 pb-2.5 text-[0.68rem] font-semibold transition-colors",
                  active ? "text-champagne" : "text-pearl/60 active:text-pearl",
                )}
              >
                {/* A short gold hairline marks the current place. */}
                <span aria-hidden className={cn("absolute top-0 h-0.5 w-6 rounded-full bg-champagne transition-opacity", active ? "opacity-100" : "opacity-0")} />
                <t.icon className="size-5.5" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
