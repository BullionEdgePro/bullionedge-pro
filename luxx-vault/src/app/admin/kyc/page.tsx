import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/field";
import { FlagList } from "@/components/verification/flag-list";
import { TestModeNotice } from "@/components/verification/test-mode-notice";
import { KYC_STATUSES, idTypeLabel, maskIdNumber, type KycStatus } from "@/config/kyc";
import { kycProvider } from "@/lib/server/kyc/provider";
import { REVIEWER_ROLES, recentDecisions, reviewQueue } from "@/lib/server/kyc/review";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Verification queue" };

function waited(since: Date, now: number) {
  const mins = Math.max(0, Math.round((now - since.getTime()) / 60_000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours} h` : `${Math.round(hours / 24)} days`;
}

export default async function KycQueuePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole(REVIEWER_ROLES, "/admin/kyc");
  const params = await searchParams;
  const [queue, recent] = await Promise.all([reviewQueue(), recentDecisions(8)]);
  const provider = kycProvider();
  const now = new Date().getTime();

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-3xl">Verification queue</h1>
        <p className="text-muted">Oldest first. Every decision needs a written reason and is kept in the audit log.</p>
      </header>

      {params.decided && <FormAlert tone="success">Decision saved and the applicant has been notified.</FormAlert>}
      {provider.isTest && (
        <TestModeNotice title="Test mode — no identity vendor is connected">
          Applicants&apos; photos never leave their device, so there are no images to compare and no face match. Scores come from on-device checks and
          prove nothing on their own. Don&apos;t approve real people on this basis.
        </TestModeNotice>
      )}

      <Card>
        <CardBody className="p-0 sm:p-0">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-sans text-base font-semibold">Pending</h2>
            <Badge tone={queue.length ? "warning" : "neutral"}>{queue.length}</Badge>
          </div>
          {queue.length === 0 ? (
            <div className="grid justify-items-center gap-2 px-5 py-14 text-center">
              <Inbox className="size-8 text-muted" aria-hidden />
              <p className="font-semibold">Nothing waiting</p>
              <p className="text-sm text-muted">New applications appear here as they arrive.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {queue.map((s) => (
                <li key={s.id}>
                  <Link href={`/admin/kyc/${s.id}`} className="grid gap-2 px-5 py-4 transition-colors hover:bg-surface-sunk/60 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="grid min-w-0 gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold">{s.user.name}</span>
                        <Badge tone={s.level === "seller" ? "gold" : "ice"}>{s.level === "seller" ? "Seller" : "Identity"}</Badge>
                        <span className="text-xs text-muted">waiting {waited(s.createdAt, now)}</span>
                      </div>
                      <p className="tabular truncate text-sm text-muted">
                        {s.level === "identity" ? `${idTypeLabel(s.idType)} · ${maskIdNumber(s.idNumberLast4)}` : "Proof of address and payout account"}
                      </p>
                      <FlagList flags={s.flags} />
                    </div>
                    <ChevronRight className="hidden size-5 text-muted sm:block" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {recent.length > 0 && (
        <section className="grid gap-3" aria-labelledby="recent-title">
          <h2 id="recent-title" className="font-sans text-base font-semibold">
            Recent decisions
          </h2>
          <Card>
            <CardBody className="p-0 sm:p-0">
              <ul className="divide-y divide-line text-sm">
                {recent.map((r) => {
                  const st = KYC_STATUSES[(r.status in KYC_STATUSES ? r.status : "pending") as KycStatus];
                  return (
                    <li key={r.id}>
                      <Link href={`/admin/kyc/${r.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 hover:bg-surface-sunk/60">
                        <span className="font-medium">{r.user.name}</span>
                        <span className="text-muted">{r.level}</span>
                        <Badge tone={st.tone}>{st.label}</Badge>
                        <span className="ml-auto text-xs text-muted">
                          {r.reviewer?.name ?? "—"} · {r.reviewedAt?.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" })}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>
        </section>
      )}
    </div>
  );
}
