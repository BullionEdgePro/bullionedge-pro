"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Staff menu: a column on desktop, a swipeable strip on phones. The current
 * page is lit, and on phones the strip scrolls it into view so you always see
 * where you are.
 */
export function AdminNav({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const current = useRef<HTMLAnchorElement>(null);
  const active = (href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));

  useEffect(() => {
    current.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <nav aria-label="Staff" className="-mx-4 flex min-w-0 gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:px-0">
      <p className="mb-2 hidden font-display text-xs tracking-[0.22em] text-champagne uppercase lg:block">Staff</p>
      {links.map((l) => {
        const on = active(l.href);
        return (
          <Link
            key={l.href}
            ref={on ? current : undefined}
            href={l.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "rounded-xl px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors",
              on ? "bg-gold-tint text-champagne ring-1 ring-champagne/35" : "text-muted hover:bg-surface hover:text-fg",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
