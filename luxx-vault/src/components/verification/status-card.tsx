import Link from "next/link";
import { CircleAlert, CircleCheck, Hourglass, RotateCcw } from "lucide-react";
import { Emblem } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { KYC_STATUSES, idTypeLabel, maskIdNumber, type KycStatus } from "@/config/kyc";

export type StatusSubmission = {
  level: string;
  status: string;
  decisionReason: string | null;
  idType: string | null;
  idNumberLast4: string | null;
  payoutMasked: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
};

const when = (d: Date) => d.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

/** Step 5 of the wizard: where an application stands, in plain words. */
export function StatusCard({ submission, restartHref, continueHref }: { submission: StatusSubmission; restartHref?: string; continueHref?: string | null }) {
  const status = (submission.status in KYC_STATUSES ? submission.status : "pending") as KycStatus;
  const meta = KYC_STATUSES[status];
  const what = submission.level === "identity" ? "identity check" : "seller application";
  const Icon = status === "approved" ? CircleCheck : status === "pending" ? Hourglass : status === "needs_resubmission" ? RotateCcw : CircleAlert;
  const tone = status === "approved" ? "text-success" : status === "rejected" ? "text-danger" : "text-warning";

  return (
    <Card className={status === "approved" ? "surface-velvet overflow-hidden" : undefined}>
      <CardBody className="grid gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {status === "approved" ? (
            <Emblem animate title="" className="size-20 shrink-0" />
          ) : (
            <span className={`grid size-14 shrink-0 place-items-center rounded-full border border-line bg-surface-sunk ${tone}`}>
              <Icon className="size-6" aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <Badge tone={meta.tone}>{meta.label}</Badge>
            <h2 className="mt-2 text-2xl">
              {status === "approved"
                ? submission.level === "identity"
                  ? "Your identity is verified"
                  : "You're a verified seller"
                : status === "pending"
                  ? `Your ${what} is with our team`
                  : status === "needs_resubmission"
                    ? `Your ${what} needs another look`
                    : `Your ${what} wasn't approved`}
            </h2>
          </div>
        </div>

        <dl className="grid gap-3 rounded-xl border border-line bg-surface-sunk/60 p-4 text-sm sm:grid-cols-3">
          {submission.idType && (
            <div>
              <dt className="text-muted">ID</dt>
              <dd className="tabular font-medium">
                {idTypeLabel(submission.idType)} · {maskIdNumber(submission.idNumberLast4)}
              </dd>
            </div>
          )}
          {submission.payoutMasked && (
            <div>
              <dt className="text-muted">Payout account</dt>
              <dd className="tabular font-medium">{submission.payoutMasked}</dd>
            </div>
          )}
          <div>
            <dt className="text-muted">Sent</dt>
            <dd className="font-medium">{when(submission.createdAt)}</dd>
          </div>
          {submission.reviewedAt && (
            <div>
              <dt className="text-muted">Reviewed</dt>
              <dd className="font-medium">{when(submission.reviewedAt)}</dd>
            </div>
          )}
        </dl>

        {status === "pending" && (
          <p className="measure text-sm text-muted">
            A member of our verification team reviews every application by hand. You&apos;ll see the decision here
            and in your notifications. You don&apos;t need to do anything in the meantime.
          </p>
        )}
        {submission.decisionReason && status !== "pending" && (
          <div className="rounded-xl border border-line p-4">
            <p className="text-sm font-semibold">{status === "approved" ? "Reviewer's note" : "Reason"}</p>
            <p className="mt-1 text-sm text-fg/90">{submission.decisionReason}</p>
          </div>
        )}
        {(status === "needs_resubmission" || status === "rejected") && restartHref && (
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild className="rounded-full px-6">
              <Link href={restartHref}>{status === "needs_resubmission" ? "Send it again" : "Apply again"}</Link>
            </Button>
            {status === "rejected" && <p className="text-sm text-muted">If you think this was a mistake, reply through our official contact channels.</p>}
          </div>
        )}
        {status === "approved" && continueHref && (
          <Button asChild className="w-fit rounded-full px-6">
            <Link href={continueHref}>Continue where you left off</Link>
          </Button>
        )}
      </CardBody>
    </Card>
  );
}
