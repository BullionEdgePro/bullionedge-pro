import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge, TierBadge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { STAFF_ROLES, hasAnyRole, parseRoles, verificationTier } from "@/config/roles";
import { idTypeLabel, maskIdNumber } from "@/config/kyc";
import { placeLabel } from "@/lib/locations";
import { formatPeso } from "@/lib/pricing";
import { customerDetail, reportsAgainst } from "@/lib/server/admin/customers";
import { requireRole } from "@/lib/server/session";
import { BanForm, StaffRoles } from "../customer-forms";

export const metadata: Metadata = { title: "Customer" };

const when = (d: Date | null | undefined) =>
  d ? d.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }) : "—";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardBody className="grid gap-3">
        <h2 className="font-sans text-base font-semibold">{title}</h2>
        {children}
      </CardBody>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(STAFF_ROLES, "/admin/customers");
  const { id } = await params;
  const c = await customerDetail(id);
  if (!c) notFound();
  const reports = await reportsAgainst(c.id);
  const roles = parseRoles(c.role);
  const p = c.profile;
  const tier = verificationTier({
    signedIn: true,
    emailVerified: c.emailVerified,
    phoneVerified: Boolean(p?.phoneVerifiedAt),
    identityVerified: Boolean(p?.identityVerifiedAt),
    sellerVerified: Boolean(p?.sellerVerifiedAt),
  });
  const rating = c.reviewsReceived.length ? c.reviewsReceived.reduce((s, r) => s + r.rating, 0) / c.reviewsReceived.length : null;
  const canManage = hasAnyRole(session.user.role, ["admin", "super_admin"]) && c.id !== session.user.id;

  return (
    <div className="grid gap-6">
      <Link href="/admin/customers" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-champagne">
        <ArrowLeft className="size-4" aria-hidden /> All customers
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl">{c.name}</h1>
          <p className="mt-1 break-all text-muted">{c.email}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <TierBadge tier={tier} />
            {roles
              .filter((r) => r !== "buyer")
              .map((r) => (
                <Badge key={r} tone="gold">
                  {r.replace("_", " ")}
                </Badge>
              ))}
            {c.banned && <Badge tone="danger">Banned{c.banExpires ? ` until ${when(c.banExpires)}` : ""}</Badge>}
            {p?.faceLockedAt && <Badge tone="warning">Trading paused</Badge>}
            {c.twoFactorEnabled ? <Badge tone="success">Two-step on</Badge> : <Badge>Two-step off</Badge>}
          </div>
        </div>
        {p?.handle && (
          <Link href={`/sellers/${p.handle}`} target="_blank" className="inline-flex items-center gap-1.5 text-sm text-gold hover:text-champagne">
            Public showroom <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Profile">
          <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">Joined</dt>
            <dd>{when(c.createdAt)}</dd>
            <dt className="text-muted">Handle</dt>
            <dd>{p?.handle ? `@${p.handle}` : "—"}</dd>
            <dt className="text-muted">Mobile</dt>
            <dd>{p?.phone ? `${p.phone}${p.phoneVerifiedAt ? " · verified" : ""}` : "—"}</dd>
            <dt className="text-muted">Location</dt>
            <dd>{placeLabel(p?.cityCode, p?.regionCode) || "—"}</dd>
            <dt className="text-muted">Business</dt>
            <dd>{p?.businessName || "—"}</dd>
            <dt className="text-muted">Rating</dt>
            <dd>{rating ? `${rating.toFixed(1)} / 5 from ${c.reviewsReceived.length}` : "No reviews yet"}</dd>
            <dt className="text-muted">Reports</dt>
            <dd>
              {reports} against them · {c._count.reports} made
            </dd>
          </dl>
        </Section>

        <Section title="Verification">
          {c.kycSubmissions.length === 0 ? (
            <Empty>No ID or seller checks submitted yet.</Empty>
          ) : (
            <ul className="grid gap-2 text-sm">
              {c.kycSubmissions.map((k) => (
                <li key={k.id} className="rounded-lg border border-line px-3 py-2">
                  <Link href={`/admin/kyc/${k.id}`} className="flex flex-wrap items-center gap-2 hover:text-champagne">
                    <span className="font-medium">{k.level === "identity" ? "Identity" : "Seller"}</span>
                    <Badge tone={k.status === "approved" ? "success" : k.status === "pending" ? "warning" : "danger"}>{k.status.replace("_", " ")}</Badge>
                    <span className="text-muted">{when(k.createdAt)}</span>
                  </Link>
                  <p className="mt-1 text-xs text-muted">
                    {k.idType ? `${idTypeLabel(k.idType)} ${maskIdNumber(k.idNumberLast4)}` : ""}
                    {k.payoutMasked ? ` · payout ${k.payoutMasked}` : ""}
                    {k.decisionReason ? ` · “${k.decisionReason}”` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {c.faceChecks.length > 0 && (
            <p className="text-xs text-muted">
              Face checks: {c.faceChecks.map((f) => `${f.passed ? "passed" : "failed"} ${when(f.createdAt)}`).join(" · ")}
            </p>
          )}
        </Section>

        <Section title="Listings and wanted posts">
          {c.listings.length + c.buyRequests.length === 0 ? (
            <Empty>Nothing posted yet.</Empty>
          ) : (
            <ul className="grid gap-1.5 text-sm">
              {c.listings.map((l) => (
                <li key={l.code} className="flex flex-wrap items-center gap-2">
                  <Link href={`/marketplace/${l.code}`} className="font-medium hover:text-champagne">
                    {l.code}
                  </Link>
                  <span className="min-w-0 flex-1 truncate text-muted">{l.title}</span>
                  <Badge>{l.status}</Badge>
                </li>
              ))}
              {c.buyRequests.map((r) => (
                <li key={r.code} className="flex flex-wrap items-center gap-2">
                  <Link href={`/marketplace/wanted/${r.code}`} className="font-medium hover:text-champagne">
                    {r.code}
                  </Link>
                  <span className="min-w-0 flex-1 truncate text-muted">Wanted: {r.title}</span>
                  <Badge>{r.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Trades">
          {c.purchases.length + c.sales.length === 0 ? (
            <Empty>No trades yet.</Empty>
          ) : (
            <ul className="grid gap-1.5 text-sm tabular">
              {[...c.purchases.map((t) => ({ ...t, side: "Bought" })), ...c.sales.map((t) => ({ ...t, side: "Sold" }))]
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                .map((t) => (
                  <li key={`${t.side}-${t.code}`} className="flex flex-wrap items-center gap-2">
                    <span className="w-14 text-muted">{t.side}</span>
                    <span className="font-medium">{t.code}</span>
                    <span>{formatPeso(Number(t.amountPhp))}</span>
                    <Badge>{t.status.replace("_", " ")}</Badge>
                  </li>
                ))}
            </ul>
          )}
        </Section>

        <Section title="Recent sign-ins">
          {c.sessions.length === 0 ? (
            <Empty>No sign-ins yet.</Empty>
          ) : (
            <ul className="grid gap-1.5 text-sm">
              {c.sessions.map((s) => (
                <li key={s.id} className="text-muted">
                  {when(s.updatedAt)} · <span className="wrap-anywhere">{s.ipAddress ?? "unknown IP"}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {canManage && (
          <Section title="Manage">
            <div className="grid gap-5">
              <div className="grid gap-2">
                <p className="text-sm font-medium">{c.banned ? "Banned" : "Ban this account"}</p>
                <BanForm userId={c.id} banned={Boolean(c.banned)} />
              </div>
              <div className="grid gap-2">
                <p className="text-sm font-medium">Staff access</p>
                <StaffRoles userId={c.id} roles={roles} />
              </div>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
