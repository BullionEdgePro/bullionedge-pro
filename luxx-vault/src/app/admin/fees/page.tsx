import type { Metadata } from "next";
import Link from "next/link";
import { MediaImage } from "@/components/marketplace/media-image";
import { MarketSettingsForm, RecordFeeForm, ReviewFeeForm, WaiveFeeForm } from "@/components/fees/fee-forms";
import { Badge } from "@/components/ui/badge";
import { FormAlert } from "@/components/ui/field";
import { ADMIN_ROLES, hasAnyRole } from "@/config/roles";
import { formatPeso } from "@/lib/pricing";
import { db } from "@/lib/server/db";
import { getMarketSettings, sellerFees } from "@/lib/server/fees";
import { mediaUrl } from "@/lib/server/media";
import { ORDER_STAFF } from "@/lib/server/shop/orders";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Marketplace fees" };

const DONE: Record<string, string> = {
  confirmed: "Payment confirmed. The seller was told.",
  rejected: "Receipt rejected. The seller was told why.",
  recorded: "Payment recorded.",
  waived: "Fee waived.",
  settings: "Fee settings saved. They apply to trades completed from now on.",
};

const day = (d: Date) => d.toLocaleDateString("en-PH", { day: "numeric", month: "short", timeZone: "Asia/Manila" });

export default async function AdminFeesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requireRole(ORDER_STAFF, "/admin/fees");
  const isAdmin = hasAnyRole(session.user.role, ADMIN_ROLES);
  const done = DONE[(await searchParams).done ?? ""];
  const monthStart = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [settings, receipts, sellersWithFees, earnedMonth, earnedAll, chargedMonth] = await Promise.all([
    getMarketSettings(),
    db.feePayment.findMany({ where: { status: "submitted" }, orderBy: { createdAt: "asc" }, include: { seller: { select: { id: true, name: true, email: true } } } }),
    db.trade.groupBy({ by: ["sellerId"], where: { status: "released", feePhp: { gt: 0 }, feePaidAt: null, feeWaivedAt: null } }),
    db.feePayment.aggregate({ where: { status: "confirmed", reviewedAt: { gte: monthStart } }, _sum: { amountPhp: true } }),
    db.feePayment.aggregate({ where: { status: "confirmed" }, _sum: { amountPhp: true } }),
    db.trade.aggregate({ where: { status: "released", releasedAt: { gte: monthStart }, feeWaivedAt: null }, _sum: { feePhp: true }, _count: { feePhp: true } }),
  ]);

  // Everyone who owes something, most overdue first.
  const owing = (
    await Promise.all(
      sellersWithFees.map(async (s) => {
        const [f, user] = await Promise.all([sellerFees(s.sellerId), db.user.findUnique({ where: { id: s.sellerId }, select: { name: true, email: true } })]);
        return { sellerId: s.sellerId, user, f };
      }),
    )
  )
    .filter((x) => x.f.balance > 0)
    .sort((a, b) => Number(b.f.overdue) - Number(a.f.overdue) || b.f.balance - a.f.balance);
  const outstanding = owing.reduce((s, x) => s + x.f.balance, 0);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl">Marketplace fees</h1>
        <p className="mt-1 text-sm text-muted">
          Listing is free. Sellers pay {Number(settings.feePct)}% of each sale that completes on Luxx4less, within {settings.feePayDays} days. Past that, their new listings and offers
          pause until they pay.
        </p>
      </div>
      {done && <FormAlert tone="success">{done}</FormAlert>}

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Collected this month", value: formatPeso(Number(earnedMonth._sum.amountPhp ?? 0)) },
          { label: "Charged this month", value: `${formatPeso(Number(chargedMonth._sum.feePhp ?? 0))} · ${chargedMonth._count.feePhp} sales` },
          { label: "Still owed", value: formatPeso(outstanding) },
          { label: "Collected in total", value: formatPeso(Number(earnedAll._sum.amountPhp ?? 0)) },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-surface p-4">
            <dt className="text-xs text-muted">{s.label}</dt>
            <dd className="mt-1 font-display text-xl text-gold tabular">{s.value}</dd>
          </div>
        ))}
      </dl>

      {receipts.map((p) => (
        <section key={p.id} className="grid gap-4 rounded-2xl border border-ice/40 bg-ice-tint/40 p-5 sm:grid-cols-[10rem_minmax(0,1fr)]">
          {p.proofMediaId ? (
            <a href={mediaUrl(p.proofMediaId)} target="_blank" rel="noreferrer" title="Open the receipt full size">
              <MediaImage src={mediaUrl(p.proofMediaId)} alt="Fee receipt" isPrivate sizes="160px" className="aspect-[3/4] rounded-xl border border-line" imgClassName="object-contain" />
            </a>
          ) : (
            <div />
          )}
          <div className="grid content-start gap-3">
            <h2 className="text-xl">Fee receipt to check</h2>
            <p className="text-sm text-muted tabular">
              <Link href={`/admin/customers/${p.seller.id}`} className="font-semibold text-fg hover:text-champagne">
                {p.seller.name}
              </Link>{" "}
              · {formatPeso(Number(p.amountPhp), true)} · ref <strong className="text-fg">{p.reference}</strong> · {day(p.createdAt)}
            </p>
            <p className="text-sm text-muted">Find this amount and reference in the account before confirming. A screenshot alone proves nothing.</p>
            <ReviewFeeForm paymentId={p.id} amount={Number(p.amountPhp)} />
          </div>
        </section>
      ))}

      <section aria-labelledby="owing-title" className="grid gap-3">
        <h2 id="owing-title" className="font-display text-sm tracking-[0.2em] text-champagne uppercase">
          Sellers who owe fees
        </h2>
        {owing.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">Nobody owes anything right now.</p>
        ) : (
          <ul className="grid gap-3">
            {owing.map(({ sellerId, user, f }) => (
              <li key={sellerId} className="grid gap-3 rounded-2xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/customers/${sellerId}`} className="font-semibold hover:text-champagne">
                      {user?.name}
                    </Link>
                    <span className="text-sm text-muted">{user?.email}</span>
                    {f.overdue ? <Badge tone="danger">Past due · selling paused</Badge> : f.nextDueAt && <Badge tone="gold">Due {day(f.nextDueAt)}</Badge>}
                    {f.checking && <Badge tone="ice">Receipt being checked</Badge>}
                  </span>
                  <span className="font-display text-xl text-gold tabular">{formatPeso(f.balance, true)}</span>
                </div>
                <ul className="grid gap-1 text-sm">
                  {f.trades
                    .filter((t) => !t.feePaidAt && !t.feeWaivedAt)
                    .map((t) => (
                      <li key={t.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-muted tabular">
                          {t.code} · sold for {formatPeso(Number(t.amountPhp))} · fee {formatPeso(Number(t.feePhp), true)} · due {t.feeDueAt ? day(t.feeDueAt) : ""}
                        </span>
                        {isAdmin && <WaiveFeeForm tradeId={t.id} />}
                      </li>
                    ))}
                </ul>
                <details className="rounded-xl border border-line p-3">
                  <summary className="cursor-pointer text-sm font-semibold">Record a payment received</summary>
                  <div className="mt-3">
                    <RecordFeeForm sellerId={sellerId} balance={f.balance} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isAdmin && (
        <section aria-labelledby="settings-title" className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 id="settings-title" className="font-display text-sm tracking-[0.2em] text-champagne uppercase">
            Fee settings
          </h2>
          <p className="text-sm text-muted">
            Changes apply to sales completed from now on; each sale keeps the rate it was charged at. Sellers pay to the GCash and bank details in{" "}
            <Link href="/admin/shop/settings" className="text-champagne hover:underline">
              Shop settings
            </Link>
            .
          </p>
          <MarketSettingsForm
            defaults={{
              feePct: String(Number(settings.feePct)),
              feeMinPhp: settings.feeMinPhp === null ? "" : String(Number(settings.feeMinPhp)),
              feeMaxPhp: settings.feeMaxPhp === null ? "" : String(Number(settings.feeMaxPhp)),
              feePayDays: String(settings.feePayDays),
            }}
          />
        </section>
      )}
    </div>
  );
}
