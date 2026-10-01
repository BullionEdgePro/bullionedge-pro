import Link from "next/link";
import { PriceTicker } from "@/components/prices/price-ticker";
import { Button } from "@/components/ui/button";
import { HeaderShell, type NavItem } from "./header-shell";
import { MobileTabBar } from "./mobile-tab-bar";
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

const quietLink =
  "rounded-md px-2 py-2 font-display text-[0.8rem] tracking-[0.22em] uppercase text-pearl/80 transition-colors hover:text-champagne";

/**
 * The site header. Dark only: there is no theme switch (owner, 30 Sep 2026).
 * `overlay` lets a page with a full-bleed opening photo sit under it.
 * The live price ticker rides above it on every page (brief §5 micro-interactions).
 */
export function SiteHeader({
  signedIn,
  overlay = false,
}: {
  signedIn: boolean;
  overlay?: boolean;
}) {
  return (
    <>
      <HeaderShell
        overlay={overlay}
        banner={<MockEmailBanner />}
        ticker={<PriceTicker />}
        nav={NAV}
        actions={
          signedIn ? (
            // On phones these live in the menu instead, so the crest and menu button keep their room.
            <div className="hidden items-center gap-3 sm:flex">
              <Link href="/account" className={quietLink}>
                My account
              </Link>
              <SignOutButton />
            </div>
          ) : (
            <>
              <Link href="/sign-in" className={quietLink}>
                Sign in
              </Link>
              <Button
                asChild
                size="sm"
                className="hidden rounded-full px-5 sm:inline-flex"
              >
                <Link href="/sign-up">Join</Link>
              </Button>
            </>
          )
        }
        menuFooter={
          signedIn ? (
            <>
              <Button asChild size="sm" className="rounded-full px-5">
                <Link href="/account">My account</Link>
              </Button>
              <SignOutButton />
            </>
          ) : (
            <Button asChild size="sm" className="rounded-full px-5">
              <Link href="/sign-up">Create an account</Link>
            </Button>
          )
        }
      />
      <MobileTabBar signedIn={signedIn} />
    </>
  );
}
