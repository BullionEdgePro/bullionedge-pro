import type { Metadata } from "next";
import { AdminNav } from "@/components/site/admin-nav";
import { SiteHeader } from "@/components/site/site-header";
import { STAFF_ROLES, parseRoles } from "@/config/roles";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Staff", robots: { index: false, follow: false } };

const LINKS = [
  { href: "/admin", label: "Overview", roles: ["support", "kyc_reviewer", "admin", "super_admin"] },
  { href: "/admin/customers", label: "Customers", roles: ["support", "kyc_reviewer", "admin", "super_admin"] },
  { href: "/admin/kyc", label: "Verification queue", roles: ["kyc_reviewer", "admin", "super_admin"] },
  { href: "/admin/reports", label: "Reports", roles: ["support", "admin", "super_admin"] },
  { href: "/admin/disputes", label: "Disputes", roles: ["support", "admin", "super_admin"] },
  { href: "/admin/orders", label: "Shop orders", roles: ["support", "admin", "super_admin"] },
  { href: "/admin/shop", label: "Official shop", roles: ["admin", "super_admin"] },
  { href: "/admin/fees", label: "Marketplace fees", roles: ["support", "admin", "super_admin"] },
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
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-10 sm:px-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <AdminNav links={links.map((l) => ({ href: l.href, label: l.label }))} />
        <main className="grid min-w-0 content-start gap-6">{children}</main>
      </div>
    </div>
  );
}
