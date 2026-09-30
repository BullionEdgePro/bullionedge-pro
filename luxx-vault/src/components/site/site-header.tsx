import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeaderShell, type NavItem } from "./header-shell";
import { MockEmailBanner } from "./mock-email-banner";
import { SignOutButton } from "./sign-out-button";

const NAV: readonly NavItem[] = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/prices", label: "Prices" },
  { href: "/tools", label: "Tools" },
  { href: "/about", label: "Our story" },
  { href: "/sell", label: "Sell to Luxx4less", desktopHidden: true },
  { href: "/install", label: "Install the app", desktopHidden: true },
];

/**
 * The site header. Dark only: there is no theme switch (owner, 30 Sep 2026).
 * `overlay` lets a page with a full-bleed opening photo sit under it.
 */
export function SiteHeader({ signedIn, overlay = false }: { signedIn: boolean; overlay?: boolean }) {
  return (
    <HeaderShell
      overlay={overlay}
      banner={<MockEmailBanner />}
      nav={NAV}
      actions={
        signedIn ? (
          <>
            <Link
              href="/account"
              className="hidden rounded-md px-2 py-2 font-display text-[0.8rem] tracking-[0.22em] uppercase text-pearl/80 transition-colors hover:text-champagne sm:inline"
            >
              My account
            </Link>
            <SignOutButton />
          </>
        ) : (
          <>
            <Link
              href="/sign-in"
              className="rounded-md px-2 py-2 font-display text-[0.8rem] tracking-[0.22em] uppercase text-pearl/80 transition-colors hover:text-champagne"
            >
              Sign in
            </Link>
            <Button asChild size="sm" className="hidden rounded-full px-5 sm:inline-flex">
              <Link href="/sign-up">Join</Link>
            </Button>
          </>
        )
      }
    />
  );
}
