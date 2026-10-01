import Link from "next/link";
import QRCode from "qrcode";
import { ANDROID_APP } from "@/config/app-release";
import { env } from "@/lib/server/env";
import { GetAppButton } from "./get-app-button";
import { PriceTicker } from "@/components/prices/price-ticker";
import { Button } from "@/components/ui/button";
import { HeaderShell, type NavItem } from "./header-shell";
import { MobileTabBar } from "./mobile-tab-bar";
import { SignOutButton } from "./sign-out-button";

// The Buy / Sell switch leads the desktop bar; these follow as the screen allows.
const NAV: readonly NavItem[] = [
  { href: "/shop", label: "Shop" },
  { href: "/marketplace", label: "Marketplace", desktopHidden: true },
  { href: "/prices", label: "Prices" },
  { href: "/tools", label: "Tools", from: "xl" },
  { href: "/about", label: "Our story", desktopHidden: true },
  { href: "/sell", label: "Sell to Luxx4less", desktopHidden: true },
  { href: "/install", label: "Get the app", desktopHidden: true },
];

const quietLink =
  "shrink-0 whitespace-nowrap rounded-md px-2 py-2 font-display text-[0.8rem] tracking-[0.22em] uppercase text-pearl/80 transition-colors hover:text-champagne";

/**
 * The site header. Dark only: there is no theme switch (owner, 30 Sep 2026).
 * `overlay` lets a page with a full-bleed opening photo sit under it.
 * The live price ticker rides above it on every page (brief §5 micro-interactions).
 */
/** The QR on the "Get the app" panel: this site's own download section, made once per server process. */
let qrCache: { base: string; svg: string } | null = null;
async function appQr(): Promise<string> {
  const base = env().BETTER_AUTH_URL.replace(/\/$/, "");
  if (qrCache?.base === base) return qrCache.svg;
  const svg = await QRCode.toString(`${base}/install#download`, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#17101F", light: "#EEF0F3" } });
  qrCache = { base, svg };
  return svg;
}

export async function SiteHeader({
  signedIn,
  overlay = false,
}: {
  signedIn: boolean;
  overlay?: boolean;
}) {
  const getApp = <GetAppButton qrSvg={await appQr()} androidHref={ANDROID_APP.href} androidVersion={ANDROID_APP.version} />;
  return (
    <>
      <HeaderShell
        overlay={overlay}
        ticker={<PriceTicker />}
        nav={NAV}
        actions={
          signedIn ? (
            // On phones these live in the menu instead, so the crest and menu button keep their room.
            <div className="hidden items-center gap-3 sm:flex xl:gap-4">
              {getApp}
              <Link href="/account" className={quietLink}>
                My account
              </Link>
              <SignOutButton />
            </div>
          ) : (
            <>
              {getApp}
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
