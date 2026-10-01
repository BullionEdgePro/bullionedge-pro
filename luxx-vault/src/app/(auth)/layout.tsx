import Link from "next/link";
import { Emblem, Lockup } from "@/components/brand/logo";
import { MockEmailBanner } from "@/components/site/mock-email-banner";
import { RotatingLines } from "@/components/site/rotating-lines";
import { brand } from "@/config/brand";
import { LUXURY_LINES } from "@/content/lines";

/** Split screen: velvet brand panel with the living emblem, form on the right. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <MockEmailBanner />
      <div className="grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <aside className="surface-velvet relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_45%_at_50%_45%,rgb(232_186_136/0.16),transparent_70%),radial-gradient(80%_60%_at_20%_0%,#2a1d3b_0%,transparent_60%)]"
          />
          <Link href="/" className="relative w-fit rounded-md">
            <Lockup className="text-lg" emblemClassName="size-10" />
          </Link>
          <div className="relative flex flex-col items-center text-center">
            <Emblem animate title="" className="size-64 drop-shadow-[0_20px_60px_rgb(232_186_136/0.25)]" />
            <RotatingLines lines={LUXURY_LINES} className="mt-10 min-h-[3.5em] max-w-sm font-display text-2xl leading-snug text-gold" />
          </div>
          <p className="relative text-xs text-muted">
            {brand.publicName} ·{" "}
            {brand.branches
              .filter((b) => !("confirm" in b && b.confirm))
              .map((b) => b.name.replace(" Branch", ""))
              .join(" · ")}{" "}
            · Since {brand.established}
          </p>
        </aside>

        <main className="flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 sm:px-8">
            <Link href="/" className="rounded-md lg:invisible">
              <Lockup className="text-base" emblemClassName="size-9" tagline={false} />
            </Link>
          </div>
          <div className="surface-velvet mx-5 mb-2 rounded-xl px-5 py-4 text-center lg:hidden">
            <RotatingLines lines={LUXURY_LINES} className="min-h-[1.6em] font-display text-base text-gold" />
          </div>
          <div className="flex flex-1 items-start justify-center px-5 pt-6 pb-16 sm:px-8 lg:items-center lg:pt-0">
            <div className="w-full max-w-md">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
