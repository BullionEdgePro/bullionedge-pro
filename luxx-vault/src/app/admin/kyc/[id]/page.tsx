import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, IdCard, ImageOff, ScanFace, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/field";
import { DecisionForm } from "@/components/verification/decision-form";
import { FlagList } from "@/components/verification/flag-list";
import { TestModeNotice } from "@/components/verification/test-mode-notice";
import { ADDRESS_PROOF_KINDS, BUSINESS_REG_KINDS, KYC_STATUSES, SCORE_THRESHOLDS, idTypeLabel, maskIdNumber, type KycStatus } from "@/config/kyc";
import { audit } from "@/lib/server/audit";
import { namesMatch } from "@/lib/server/kyc/rules";
import { REVIEWER_ROLES, submissionDetail } from "@/lib/server/kyc/review";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Review verification" };

const fmt = (d: Date | null | undefined) => (d ? d.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }) : "—");
const day = (d: Date | null | undefined) => (d ? d.toLocaleDateString("en-PH", { dateStyle: "medium", timeZone: "UTC" }) : "—");

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 font-medium break-words">{children}</dd>
    </div>
  );
}

function Score({ label, value, threshold, missing }: { label: string; value: number | null; threshold: number; missing: string }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted">{label}</span>
        <span className="tabular font-semibold">{value === null ? "—" : value.toFixed(2)}</span>
      </div>
      {value === null ? (
        <p className="text-xs text-muted">{missing}</p>
      ) : (
        <div className="relative h-1.5 rounded-full bg-surface-sunk" aria-hidden>
          <span className={`absolute inset-y-0 left-0 rounded-full ${value >= threshold ? "bg-success" : "bg-warning"}`} style={{ width: `${Math.round(value * 100)}%` }} />
          <span className="absolute -top-1 h-3.5 w-px bg-fg/60" style={{ left: `${threshold * 100}%` }} title={`Threshold ${threshold}`} />
        </div>
      )}
    </div>
  );
}

export default async function KycDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireRole(REVIEWER_ROLES, `/admin/kyc/${encodeURIComponent(id)}`);
  if (!/^[a-z0-9]{10,40}$/i.test(id)) notFound();
  const sub = await submissionDetail(id);
  if (!sub) notFound();

  // Brief §11: every view of verification data is logged.
  await audit({ actorId: session.user.id, action: "kyc.viewed", targetType: "kyc_submission", targetId: sub.id });

  const status = (sub.status in KYC_STATUSES ? sub.status : "pending") as KycStatus;
  const own = sub.userId === session.user.id;
  const isTest = sub.provider === "mock";
  const approxAge = sub.birthYear ? new Date().getUTCFullYear() - sub.birthYear : null;
  const nameOk = sub.nameOnId ? namesMatch(sub.user.name, sub.nameOnId) : null;
  const addressKind = ADDRESS_PROOF_KINDS.find((k) => k.value === sub.addressProofKind)?.label;
  const [regKind, hasCor] = (sub.businessRegKind ?? "").split("+");
  const regLabel = BUSINESS_REG_KINDS.find((k) => k.value === regKind)?.label;

  return (
    <div className="grid gap-6">
      <Link href="/admin/kyc" className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Queue
      </Link>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl">{sub.user.name}</h1>
        <Badge tone={sub.level === "seller" ? "gold" : "ice"}>{sub.level === "seller" ? "Seller application" : "Identity check"}</Badge>
        <Badge tone={KYC_STATUSES[status].tone}>{KYC_STATUSES[status].label}</Badge>
      </header>

      {isTest && (
        <TestModeNotice title="Test-mode submission">
          Made with the mock provider: no images exist, no face match ran, and the liveness figure is only the share of on-screen prompts where the
          applicant&apos;s own device saw movement. Treat it as a practice run.
        </TestModeNotice>
      )}

      <Card>
        <CardBody className="grid gap-3">
          <h2 className="font-sans text-base font-semibold">Flags</h2>
          <FlagList flags={sub.flags} empty="No flags raised by our rules or the provider." />
        </CardBody>
      </Card>

      {sub.level === "identity" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardBody className="grid gap-4">
              <h2 className="flex items-center gap-2 font-sans text-base font-semibold">
                <IdCard className="size-4 text-champagne" aria-hidden /> Government ID
              </h2>
              <div className="grid aspect-[85.6/54] place-items-center rounded-xl border border-dashed border-line bg-surface-sunk text-center">
                <div className="grid justify-items-center gap-2 p-4">
                  <ImageOff className="size-7 text-muted" aria-hidden />
                  <p className="text-xs text-muted">{isTest ? "No image: photos stay on the applicant's device in test mode." : "Open the image in the provider's console (links expire after 5 minutes)."}</p>
                </div>
              </div>
              <dl className="divide-y divide-line">
                <Row label="Type">{idTypeLabel(sub.idType)}</Row>
                <Row label="Number">
                  <span className="tabular">{maskIdNumber(sub.idNumberLast4)}</span>
                </Row>
                <Row label="Name on ID">
                  {sub.nameOnId ?? "—"}{" "}
                  {nameOk !== null && <Badge tone={nameOk ? "success" : "warning"}>{nameOk ? "Matches account" : "Differs from account"}</Badge>}
                </Row>
                <Row label="Account name">{sub.user.name}</Row>
                <Row label="Birth year">
                  {sub.birthYear ?? "—"} {approxAge !== null && <span className="text-muted">(about {approxAge})</span>}
                </Row>
                <Row label="Expiry">{sub.idExpiry ? day(sub.idExpiry) : "No expiry on this ID"}</Row>
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="grid gap-4">
              <h2 className="flex items-center gap-2 font-sans text-base font-semibold">
                <ScanFace className="size-4 text-champagne" aria-hidden /> Selfie check
              </h2>
              <div className="grid aspect-[85.6/54] place-items-center rounded-xl border border-dashed border-line bg-surface-sunk text-center">
                <div className="grid justify-items-center gap-2 p-4">
                  <ImageOff className="size-7 text-muted" aria-hidden />
                  <p className="text-xs text-muted">{isTest ? "No selfie frames are kept in test mode." : "Compare the selfie with the ID photo in the provider's console."}</p>
                </div>
              </div>
              <div className="grid gap-4">
                <Score label={isTest ? "Liveness (device-reported)" : "Liveness"} value={sub.livenessScore} threshold={SCORE_THRESHOLDS.liveness} missing="Not measured." />
                <Score label="Face match" value={sub.faceMatchScore} threshold={SCORE_THRESHOLDS.faceMatch} missing={isTest ? "Not performed: no identity vendor is connected." : "Not reported by the provider."} />
              </div>
              <dl className="divide-y divide-line">
                <Row label="Provider">{sub.provider}</Row>
                <Row label="Reference">
                  <span className="tabular text-xs">{sub.providerRef ?? "—"}</span>
                </Row>
                <Row label="Consent">
                  {sub.consent?.granted ? `Biometric consent given ${fmt(sub.consent.createdAt)} (policy ${sub.consent.version})` : "No biometric consent on record"}
                </Row>
              </dl>
            </CardBody>
          </Card>
        </div>
      ) : (
        <Card>
          <CardBody className="grid gap-2">
            <h2 className="font-sans text-base font-semibold">Seller checks</h2>
            {isTest && <p className="text-xs text-muted">In test mode no documents are collected: ask the applicant for them before approving a real seller.</p>}
            <dl className="divide-y divide-line">
              <Row label="Seller type">{sub.businessRegKind ? "Business" : "Individual"}</Row>
              <Row label="Proof of address">{addressKind ?? "—"} (dated within 3 months, per applicant)</Row>
              {sub.businessRegKind && (
                <Row label="Registration">
                  {regLabel ?? regKind} {hasCor === "bir_cor" && <span className="text-muted">· BIR COR declared</span>}
                </Row>
              )}
              <Row label="Payout account">
                <span className="tabular">{sub.payoutMasked ?? "—"}</span>
              </Row>
              <Row label="Verified ID name">{sub.nameOnId ?? sub.user.name}</Row>
            </dl>
          </CardBody>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody className="grid gap-2">
            <h2 className="flex items-center gap-2 font-sans text-base font-semibold">
              <UserRound className="size-4 text-champagne" aria-hidden /> Account
            </h2>
            <dl className="divide-y divide-line">
              <Row label="Email">{sub.user.email}</Row>
              <Row label="Handle">{sub.user.handle ? `@${sub.user.handle}` : "—"}</Row>
              <Row label="Mobile">
                <span className="tabular">{sub.user.phoneMasked}</span> {sub.user.phoneVerifiedAt && <span className="text-muted">verified {fmt(sub.user.phoneVerifiedAt)}</span>}
              </Row>
              <Row label="Member since">{fmt(sub.user.createdAt)}</Row>
              <Row label="Roles">{sub.user.roles.join(", ")}</Row>
              <Row label="Two-step sign-in">{sub.user.twoFactorEnabled ? "On" : "Off"}</Row>
              <Row label="Identity verified">{fmt(sub.user.identityVerifiedAt)}</Row>
              <Row label="Seller verified">{fmt(sub.user.sellerVerifiedAt)}</Row>
              {sub.user.banned && <Row label="Status">Banned</Row>}
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="grid gap-3">
            <h2 className="font-sans text-base font-semibold">Previous submissions</h2>
            {sub.previous.length === 0 ? (
              <p className="text-sm text-muted">None. This is their first.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {sub.previous.map((p) => {
                  const st = KYC_STATUSES[(p.status in KYC_STATUSES ? p.status : "pending") as KycStatus];
                  return (
                    <li key={p.id} className="grid gap-1 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/admin/kyc/${p.id}`} className="font-medium hover:underline">
                          {p.level === "identity" ? `${idTypeLabel(p.idType)} ${maskIdNumber(p.idNumberLast4)}` : "Seller application"}
                        </Link>
                        <Badge tone={st.tone}>{st.label}</Badge>
                        <span className="ml-auto text-xs text-muted">{fmt(p.createdAt)}</span>
                      </div>
                      {p.decisionReason && <p className="text-xs text-muted">{p.decisionReason}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="grid gap-4">
          <h2 className="font-sans text-base font-semibold">Decision</h2>
          {status !== "pending" ? (
            <dl className="divide-y divide-line">
              <Row label="Outcome">{KYC_STATUSES[status].label}</Row>
              <Row label="Reason">{sub.decisionReason ?? "—"}</Row>
              <Row label="Reviewer">{sub.reviewer?.name ?? "—"}</Row>
              <Row label="When">{fmt(sub.reviewedAt)}</Row>
            </dl>
          ) : own ? (
            <FormAlert tone="info">This is your own verification. Another reviewer has to decide it.</FormAlert>
          ) : (
            <DecisionForm submissionId={sub.id} level={sub.level === "seller" ? "seller" : "identity"} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
