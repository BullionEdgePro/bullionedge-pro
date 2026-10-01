import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Flag, Gavel, Handshake, PackageSearch, ScanFace, ShieldCheck, Store, UserPlus, Users, Wallet } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { STAFF_ROLES } from "@/config/roles";
import { cn } from "@/lib/cn";
import { formatPeso } from "@/lib/pricing";
import { platformStats, recentSignups } from "@/lib/server/admin/customers";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Staff overview" };

export default async function AdminOverview() {
  const session = await requireRole(STAFF_ROLES, "/admin");
  const [s, signups] = await Promise.all([platformStats(), recentSignups()]);
  const first = session.user.name.split(" ")[0];

  const tiles = [
    { label: "Customers", value: s.customers.toLocaleString("en-PH"), note: `${s.newThisWeek} new this week`, icon: Users, href: "/admin/customers" },
    { label: "Verified buyers", value: s.verifiedBuyers.toLocaleString("en-PH"), note: "ID checked", icon: BadgeCheck, href: "/admin/customers?show=buyers" },
    { label: "Verified sellers", value: s.verifiedSellers.toLocaleString("en-PH"), note: "Can list items", icon: Store, href: "/admin/customers?show=sellers" },
    { label: "Active listings", value: s.activeListings.toLocaleString("en-PH"), note: `${s.openWanted} wanted posts`, icon: PackageSearch, href: "/admin/listings" },
    { label: "Trades in progress", value: s.tradesInProgress.toLocaleString("en-PH"), note: "Paid, shipping or disputed", icon: Handshake, href: "/admin/disputes" },
    {
      label: "Sales this month",
      value: formatPeso(s.salesThisMonth.amountPhp),
      note: `${s.salesThisMonth.count} completed ${s.salesThisMonth.count === 1 ? "trade" : "trades"}`,
      icon: Wallet,
      href: "/admin/customers",
    },
  ];

  const queues = [
    { label: "Verifications to review", count: s.queues.pendingKyc, icon: ShieldCheck, href: "/admin/kyc" },
    { label: "Open reports", count: s.queues.openReports, icon: Flag, href: "/admin/reports" },
    { label: "Open disputes", count: s.queues.openDisputes, icon: Gavel, href: "/admin/disputes" },
    { label: "Trading paused (face checks)", count: s.queues.pausedAccounts, icon: ScanFace, href: "/admin/kyc" },
    { label: "New sell requests", count: s.queues.newSellQuotes, icon: Wallet, href: "/admin/prices" },
  ];

  return (
    <div className="grid gap-8">
      <div>
        <p className="font-display text-xs tracking-[0.28em] text-gold uppercase">Staff</p>
        <h1 className="mt-2 text-3xl">Good to see you, {first}</h1>
        <p className="mt-2 text-muted">The platform at a glance. Everything here is live from the database.</p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((t) => (
          <li key={t.label}>
            <Link href={t.href} className="group block h-full rounded-2xl border border-line bg-surface p-5 transition-[border-color,transform] duration-500 hover:-translate-y-0.5 hover:border-champagne/60">
              <span className="flex items-center justify-between text-sm text-muted">
                <span className="flex items-center gap-2">
                  <t.icon className="size-4 text-champagne" aria-hidden /> {t.label}
                </span>
                <ArrowUpRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
              </span>
              <span className="mt-3 block font-display text-3xl text-fg tabular">{t.value}</span>
              <span className="mt-1 block text-xs text-muted">{t.note}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody className="grid gap-3">
            <h2 className="font-sans text-base font-semibold">Needs your attention</h2>
            <ul className="grid gap-1">
              {queues.map((q) => (
                <li key={q.label}>
                  <Link href={q.href} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-sunk">
                    <q.icon className="size-4 shrink-0 text-muted" aria-hidden />
                    <span className="min-w-0 flex-1 text-sm">{q.label}</span>
                    <span
                      className={cn(
                        "grid min-w-7 place-items-center rounded-full px-2 text-xs leading-6 font-semibold tabular",
                        q.count ? "bg-champagne text-velvet" : "bg-surface-sunk text-muted",
                      )}
                    >
                      {q.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="grid gap-3">
            <h2 className="flex items-center gap-2 font-sans text-base font-semibold">
              <UserPlus className="size-4 text-champagne" aria-hidden /> Newest sign-ups
            </h2>
            {signups.length === 0 ? (
              <p className="text-sm text-muted">No one has signed up yet.</p>
            ) : (
              <ul className="grid gap-1">
                {signups.map((u) => (
                  <li key={u.id}>
                    <Link href={`/admin/customers/${u.id}`} className="flex items-baseline gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-sunk">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{u.name}</span>
                        <span className="block truncate text-xs text-muted">{u.email}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted">
                        {u.createdAt.toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" })}
                        {u.emailVerified ? "" : " · unconfirmed"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/admin/customers" className="text-sm font-semibold text-gold hover:text-champagne">
              See all customers
            </Link>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
