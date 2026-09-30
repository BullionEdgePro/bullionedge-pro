import Link from "next/link";
import { Lockup } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { MockEmailBanner } from "./mock-email-banner";
import { SignOutButton } from "./sign-out-button";

/** Header for signed-in areas. The storefront header arrives with Phase 3/4. */
export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <MockEmailBanner />
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="rounded-md">
            <Lockup className="text-base" emblemClassName="size-9" />
          </Link>
          <div className="flex items-center gap-2">
            {signedIn ? (
              <SignOutButton />
            ) : (
              <Link href="/sign-in" className="rounded-md px-3 py-2 text-sm font-semibold hover:text-gold">
                Sign in
              </Link>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>
    </>
  );
}
