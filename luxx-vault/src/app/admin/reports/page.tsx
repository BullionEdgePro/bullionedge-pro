import type { Metadata } from "next";
import Link from "next/link";
import { InlineAction } from "@/components/marketplace/inline-action";
import { ScamWarning } from "@/components/marketplace/scam-warning";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { db } from "@/lib/server/db";
import { resolveReport } from "@/lib/server/marketplace/actions/admin";
import { timeAgo } from "@/lib/server/marketplace/describe";
import { REPORT_REASONS, REPORT_TARGET_LABEL } from "@/lib/server/marketplace/reporting";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole(["support", "admin", "super_admin"], "/admin/reports");
  const view = (await searchParams).view === "handled" ? "handled" : "open";
  const reports = await db.report.findMany({
    where: view === "open" ? { status: "open" } : { status: { not: "open" } },
    orderBy: { createdAt: view === "open" ? "asc" : "desc" },
    take: 100,
    include: { reporter: { select: { name: true, email: true, profile: { select: { handle: true } } } } },
  });

  // Resolve each target to something a moderator can judge.
  const ids = (t: string) => reports.filter((r) => r.targetType === t).map((r) => r.targetId);
  const [listings, requests, users, messages, numberCounts] = await Promise.all([
    db.listing.findMany({ where: { id: { in: ids("listing") } }, select: { id: true, code: true, title: true, status: true, reportCount: true, seller: { select: { name: true } } } }),
    db.buyRequest.findMany({ where: { id: { in: ids("buy_request") } }, select: { id: true, code: true, title: true, status: true } }),
    db.user.findMany({ where: { id: { in: ids("user") } }, select: { id: true, name: true, profile: { select: { handle: true } } } }),
    db.message.findMany({ where: { id: { in: ids("message") } }, select: { id: true, body: true, flags: true, createdAt: true, sender: { select: { name: true } }, conversationId: true } }),
    db.report.groupBy({ by: ["targetId"], where: { targetType: "outside_number", targetId: { in: ids("outside_number") } }, _count: { _all: true } }),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl">Reports</h1>
        <p className="mt-1 text-sm text-muted">Action removes a reported listing or wanted post. Dismiss clears the report. Both are audited and the reporter is told the outcome.</p>
      </div>
      <nav className="flex w-fit gap-1 rounded-full border border-line p-1" aria-label="Report lists">
        {(["open", "handled"] as const).map((v) => (
          <Link
            key={v}
            href={v === "open" ? "/admin/reports" : "/admin/reports?view=handled"}
            aria-current={view === v ? "page" : undefined}
            className={cn("rounded-full px-4 py-1.5 text-sm font-semibold", view === v ? "bg-gold-tint text-champagne" : "text-muted hover:text-fg")}
          >
            {v === "open" ? "Open" : "Handled"}
          </Link>
        ))}
      </nav>
      {reports.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">{view === "open" ? "No open reports." : "Nothing handled yet."}</p>
      ) : (
        <ul className="grid gap-4">
          {reports.map((r) => {
            const listing = listings.find((l) => l.id === r.targetId);
            const request = requests.find((x) => x.id === r.targetId);
            const user = users.find((u) => u.id === r.targetId);
            const message = messages.find((m) => m.id === r.targetId);
            const numberCount = numberCounts.find((n) => n.targetId === r.targetId)?._count._all;
            return (
              <li key={r.id} className="grid gap-3 rounded-2xl border border-line bg-surface p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={r.status === "open" ? "warning" : r.status === "actioned" ? "success" : "neutral"}>{r.status}</Badge>
                  <Badge>{REPORT_TARGET_LABEL[r.targetType] ?? r.targetType}</Badge>
                  <span className="text-sm font-semibold text-fg">{REPORT_REASONS.find((x) => x.value === r.reason)?.label ?? r.reason}</span>
                  <span className="text-xs text-muted">
                    {timeAgo(r.createdAt)} · by {r.reporter.profile?.handle ? `@${r.reporter.profile.handle}` : r.reporter.name}
                  </span>
                </div>
                <div className="rounded-xl bg-surface-sunk p-3 text-sm">
                  {listing && (
                    <p>
                      <Link href={`/marketplace/${listing.code}`} className="font-semibold text-champagne hover:underline">
                        {listing.code}
                      </Link>{" "}
                      {listing.title} · seller {listing.seller.name} · {listing.status} · {listing.reportCount} open {listing.reportCount === 1 ? "report" : "reports"}
                    </p>
                  )}
                  {request && (
                    <p>
                      <Link href={`/marketplace/wanted/${request.code}`} className="font-semibold text-champagne hover:underline">
                        {request.code}
                      </Link>{" "}
                      {request.title} · {request.status}
                    </p>
                  )}
                  {user && (
                    <p>
                      {user.profile?.handle ? (
                        <Link href={`/sellers/${user.profile.handle}`} className="font-semibold text-champagne hover:underline">
                          {user.name} (@{user.profile.handle})
                        </Link>
                      ) : (
                        user.name
                      )}
                    </p>
                  )}
                  {message && (
                    <div>
                      <p className="text-xs text-muted">
                        {message.sender?.name ?? "System"} · {message.createdAt.toLocaleString("en-PH")}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                      <ScamWarning flags={message.flags} />
                    </div>
                  )}
                  {r.targetType === "outside_number" && (
                    <p>
                      <span className="font-semibold tabular">{r.targetId}</span> · reported {numberCount ?? 1} {numberCount === 1 ? "time" : "times"} in total
                    </p>
                  )}
                  {!listing && !request && !user && !message && r.targetType !== "outside_number" && <p className="text-muted">The reported item no longer exists.</p>}
                </div>
                {r.details && <p className="text-sm text-fg/85">&ldquo;{r.details}&rdquo;</p>}
                {r.status === "open" && (
                  <div className="flex flex-wrap gap-2">
                    <InlineAction action={resolveReport} fields={{ reportId: r.id, decision: "actioned" }} variant="danger" confirm={listing || request ? "Action this report and take the item down?" : "Mark this report as actioned?"}>
                      Action
                    </InlineAction>
                    <InlineAction action={resolveReport} fields={{ reportId: r.id, decision: "dismissed" }} variant="secondary">
                      Dismiss
                    </InlineAction>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
