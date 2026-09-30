import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";
import { STAFF_ROLES, parseRoles } from "@/config/roles";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Staff", robots: { index: false, follow: false } };

const LINKS = [
  { href: "/admin/kyc", label: "Verification queue", roles: ["kyc_reviewer", "admin", "super_admin"] },
  { href: "/admin/reports", label: "Reports", roles: ["support", "admin", "super_admin"] },
  { href: "/admin/disputes", label: "Disputes", roles: ["support", "admin", "super_admin"] },
  { href: "/admin/listings", label: "Listings", roles: ["support", "admin", "super_admin"] },
  { href: "/admin/prices", label: "Prices and quotes", roles: ["admin", "super_admin"] },
] as const;

/** Staff area. Every staff role needs two-step sign-in (requireRole enforces it); each page re-checks its own roles. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole(STAFF_ROLES, "/admin");
  const roles = parseRoles(session.user.role);
  const links = LINKS.filter((l) => l.roles.some((r) => roles.includes(r)));

  return (
    <div className="min-h-svh">
      <SiteHeader signedIn />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Staff" className="flex gap-1 overflow-x-auto lg:flex-col">
          <p className="mb-2 hidden font-display text-xs tracking-[0.22em] text-champagne uppercase lg:block">Staff</p>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-xl px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap text-muted transition-colors hover:bg-surface hover:text-fg"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <main className="grid min-w-0 content-start gap-6">{children}</main>
      </div>
    </div>
  );
}
