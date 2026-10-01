"use client";

import {
  Bell,
  Building2,
  BadgeCheck,
  Gavel,
  Handshake,
  Heart,
  LayoutDashboard,
  MessagesSquare,
  PackageSearch,
  ScrollText,
  Shield,
  ShoppingBag,
  Store,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export const ACCOUNT_LINKS = [
  { href: "/account", label: "Overview", icon: LayoutDashboard },
  { href: "/account/orders", label: "Shop orders", icon: ShoppingBag },
  { href: "/account/listings", label: "My listings", icon: Store },
  { href: "/account/wanted", label: "My wanted posts", icon: PackageSearch },
  { href: "/account/offers", label: "Offers", icon: Gavel },
  { href: "/account/messages", label: "Messages", icon: MessagesSquare },
  { href: "/account/trades", label: "Trades", icon: Handshake },
  { href: "/account/saved", label: "Saved", icon: Heart },
  { href: "/account/alerts", label: "Price alerts", icon: Bell },
  { href: "/account/profile", label: "Profile", icon: UserRound },
  { href: "/account/verification", label: "Verification", icon: BadgeCheck },
  { href: "/account/security", label: "Security", icon: Shield },
  { href: "/account/notifications", label: "Notifications", icon: ScrollText },
] as const;

/** Account sidebar on desktop, a swipeable strip on phones. Counts show as gold pips. */
export function AccountNav({ counts = {}, staff = false }: { counts?: Partial<Record<string, number>>; staff?: boolean }) {
  const pathname = usePathname();
  const links = staff ? [...ACCOUNT_LINKS, { href: "/admin", label: "Staff area", icon: Building2 } as const] : ACCOUNT_LINKS;
  return (
    <nav aria-label="Account" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
      {links.map(({ href, label, icon: Icon }) => {
        const active = href === "/account" ? pathname === href : pathname.startsWith(href);
        const count = counts[href];
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors duration-300",
              active ? "bg-gold-tint text-champagne" : "text-muted hover:bg-surface hover:text-fg",
            )}
          >
            {/* A gold spine marks the current page, like a ribbon in a ledger. */}
            <span
              aria-hidden
              className={cn(
                "absolute inset-y-2 left-0 hidden w-0.5 rounded-full bg-champagne transition-opacity lg:block",
                active ? "opacity-100" : "opacity-0",
              )}
            />
            <Icon className="size-[1.1rem] shrink-0" aria-hidden />
            {label}
            {count ? (
              <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-champagne px-1.5 text-[0.7rem] leading-5 text-velvet tabular">
                {count > 99 ? "99+" : count}
                <span className="sr-only"> new</span>
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
