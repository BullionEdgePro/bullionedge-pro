import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Lockup } from "@/components/brand/logo";
import { brand } from "@/config/brand";

const COLUMNS = [
  {
    title: "Marketplace",
    links: [
      { href: "/marketplace", label: "Browse items for sale" },
      { href: "/marketplace?tab=wanted", label: "Wanted requests" },
      { href: "/marketplace/sell", label: "List an item" },
      { href: "/marketplace/wanted/new", label: "Post what you want" },
      { href: "/account/verification", label: "Get verified" },
    ],
  },
  {
    title: "Prices and tools",
    links: [
      { href: "/prices", label: "Today's gold prices" },
      { href: "/tools", label: "Gold value calculator" },
      { href: "/tools/hallmark", label: "Hallmark reader" },
      { href: "/sell", label: "Sell to Luxx4less" },
      { href: "/install", label: "Get the app (Android, iPhone)" },
    ],
  },
  {
    title: "The house",
    links: [
      { href: "/about", label: "Our story" },
      { href: "/about#visit", label: "Visit a branch" },
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
] as const;

/** Closes every public page. */
export function SiteFooter() {
  const year = new Date().getFullYear();
  const branches = brand.branches.filter((b) => !("confirm" in b && b.confirm));
  return (
    <footer className="border-t border-line bg-surface-sunk">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-8 lg:grid-cols-[1.2fr_repeat(3,1fr)]">
        <div>
          <Lockup layout="stacked" emblemClassName="size-14" />
          <p className="mt-4 max-w-xs text-sm text-muted">{brand.packagingTagline}</p>
          <p className="mt-6 text-sm text-muted">
            {branches.map((b) => b.name).join(" · ")}
            <br />
            <a href={brand.social.facebookUrl} target="_blank" rel="noreferrer noopener" className="text-gold hover:text-champagne">
              Facebook
            </a>
          </p>
        </div>

        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="font-display text-xs uppercase tracking-[0.28em] text-gold">{col.title}</h2>
            <ul className="mt-5 space-y-2.5 text-sm">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted transition-colors hover:text-champagne">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/* Brief §7 trust centre, in brief: the most common scam is someone pretending to be the shop. */}
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-5 text-sm text-muted sm:px-8">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-champagne" aria-hidden />
          <p>
            Luxx4less will never ask you to pay outside this site, and never messages you from an unlisted number. If
            someone does, report it before you send anything.
          </p>
        </div>
      </div>

      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-4 py-6 text-xs text-muted sm:px-8">
          © {year} {brand.legalName}. Established {brand.established}.
        </p>
      </div>
    </footer>
  );
}
