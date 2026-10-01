import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { Pagination } from "@/components/marketplace/pagination";
import { Badge, TierBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { STAFF_ROLES } from "@/config/roles";
import { cn } from "@/lib/cn";
import { placeLabel } from "@/lib/locations";
import { CUSTOMER_FILTERS, listCustomers, type CustomerFilter, type CustomerRow } from "@/lib/server/admin/customers";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Customers" };

const fmtDate = (d: Date) => d.toLocaleDateString("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });

function lastSeen(d: Date | null): string {
  if (!d) return "Never signed in";
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 2) return "Active now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days} d ago` : fmtDate(d);
}

function Flags({ c }: { c: CustomerRow }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      <TierBadge tier={c.tier} />
      {c.roles
        .filter((r) => r !== "buyer")
        .map((r) => (
          <Badge key={r} tone={STAFF_ROLES.includes(r) ? "gold" : "neutral"}>
            {r.replace("_", " ")}
          </Badge>
        ))}
      {c.pendingReview && <Badge tone="warning">Waiting for review</Badge>}
      {c.faceLocked && <Badge tone="warning">Trading paused</Badge>}
      {c.banned && <Badge tone="danger">Banned</Badge>}
      {!c.emailVerified && <Badge tone="neutral">Email not confirmed</Badge>}
    </span>
  );
}

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole(STAFF_ROLES, "/admin/customers");
  const params = await searchParams;
  const filter: CustomerFilter = CUSTOMER_FILTERS.some((f) => f.value === params.show) ? (params.show as CustomerFilter) : "all";
  const q = (params.q ?? "").slice(0, 80);
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const { total, rows, pages } = await listCustomers({ filter, q, page });
  const href = (over: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { show: filter === "all" ? undefined : filter, q: q || undefined, page: undefined, ...over };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "" && !(k === "page" && String(v) === "1")) sp.set(k, String(v));
    const s = sp.toString();
    return `/admin/customers${s ? `?${s}` : ""}`;
  };

  return (
    <div className="grid gap-6">
      <div>
        <p className="font-display text-xs tracking-[0.28em] text-gold uppercase">Staff</p>
        <h1 className="mt-2 text-3xl">Customers</h1>
        <p className="mt-2 text-muted">
          Every buyer and seller on Luxx4less: {total.toLocaleString("en-PH")} {filter === "all" && !q ? "people" : "matching"}.
        </p>
      </div>

      <form className="relative" role="search">
        {filter !== "all" && <input type="hidden" name="show" value={filter} />}
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input name="q" defaultValue={q} placeholder="Search name, email, @handle or mobile number" aria-label="Search customers" className="pl-10" />
      </form>

      <nav aria-label="Filter customers" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {CUSTOMER_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={href({ show: f.value === "all" ? undefined : f.value })}
            aria-current={filter === f.value ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full border px-4 py-1.5 text-sm whitespace-nowrap transition-colors",
              filter === f.value ? "border-champagne bg-gold-tint text-champagne" : "border-line text-muted hover:border-champagne/60 hover:text-fg",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <Card className="p-8 text-center text-muted">No one matches. Try another search or filter.</Card>
      ) : (
        <>
          {/* Phones: stacked cards */}
          <ul className="grid gap-3 lg:hidden">
            {rows.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/customers/${c.id}`} className="block rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-champagne/60">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate font-semibold">{c.name}</span>
                    <span className="shrink-0 text-xs text-muted">{lastSeen(c.lastSeenAt)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-muted">{c.email}</span>
                  <span className="mt-3 block">
                    <Flags c={c} />
                  </span>
                  <span className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted tabular">
                    <span>{c.activeListings} listings</span>
                    <span>{c.purchases} bought</span>
                    <span>{c.sales} sold</span>
                    <span>Joined {fmtDate(c.joinedAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: a table */}
          <Card className="hidden overflow-hidden lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Person</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Where</th>
                  <th className="px-4 py-3 text-right font-semibold">Listings</th>
                  <th className="px-4 py-3 text-right font-semibold">Bought</th>
                  <th className="px-4 py-3 text-right font-semibold">Sold</th>
                  <th className="px-4 py-3 font-semibold">Last seen</th>
                  <th className="px-4 py-3 font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-surface-sunk/60">
                    <td className="max-w-64 px-4 py-3">
                      <Link href={`/admin/customers/${c.id}`} className="block font-semibold hover:text-champagne">
                        {c.name}
                      </Link>
                      <span className="block truncate text-xs text-muted">
                        {c.email}
                        {c.handle ? ` · @${c.handle}` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Flags c={c} />
                    </td>
                    <td className="px-4 py-3 text-muted">{placeLabel(c.place.cityCode, c.place.regionCode) || "—"}</td>
                    <td className="px-4 py-3 text-right tabular">{c.activeListings}</td>
                    <td className="px-4 py-3 text-right tabular">{c.purchases}</td>
                    <td className="px-4 py-3 text-right tabular">{c.sales}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{lastSeen(c.lastSeenAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{fmtDate(c.joinedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Pagination page={page} pages={pages} hrefFor={(n) => href({ page: n })} />
        </>
      )}
    </div>
  );
}
