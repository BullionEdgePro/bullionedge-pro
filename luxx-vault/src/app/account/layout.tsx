import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";
import { requireSession } from "@/lib/server/session";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireSession("/account");
  return (
    <div className="min-h-svh">
      <SiteHeader signedIn />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Account" className="flex gap-2 overflow-x-auto lg:flex-col">
          {[
            { href: "/account", label: "Overview" },
            { href: "/account/security", label: "Security" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap text-muted hover:bg-surface hover:text-fg">
              {l.label}
            </Link>
          ))}
        </nav>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
