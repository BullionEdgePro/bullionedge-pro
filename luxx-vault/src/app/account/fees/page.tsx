import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Lock, ShieldAlert } from "lucide-react";
import { FeeReceiptForm } from "@/components/fees/fee-forms";
import { Badge } from "@/components/ui/badge";
import { FormAlert } from "@/components/ui/field";
import { feeRateLabel } from "@/lib/fees";
import { formatPeso } from "@/lib/pricing";
import { feeRulesOf, getMarketSettings, sellerFees } from "@/lib/server/fees";
import { itemLabel } from "@/lib/server/marketplace/describe";
import { getShopSettings } from "@/lib/server/shop/settings";
import { requireViewer } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "Luxx4less fees" };

const day = (d: Date) => d.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Manila" });

export default async function FeesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const viewer = await requireViewer("/account/fees");
  const sp = await searchParams;
  const [f, rules, shop] = await Promise.all([sellerFees(viewer.userId), getMarketSettings().then(feeRulesOf), getShopSettings()]);
  const payText = shop.paymentInstructions?.trim();
  const now = new Date();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl">Luxx4less fees</h1>
        <p className="mt-1 text-sm text-muted">
          Listing on Luxx4less is free. When something you sell here completes, the fee is {feeRateLabel(rules)} of the price, paid within{" "}
          {(await getMarketSettings()).feePayDays} days.
        </p>
      </div>

      {sp.sent && <FormAlert tone="success">Receipt sent. We&rsquo;ll confirm it shortly, usually within the day.</FormAlert>}
      {f.overdue && !f.checking && (
        <p className="flex gap-3 rounded-2xl border border-danger/35 bg-danger-tint p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
          <span>
            <strong className="text-danger">{formatPeso(f.overduePhp, true)} is past due.</strong> New listings, renewals and offers are paused until it&rsquo;s paid. Trades
            already under way carry on as normal.
          </span>
        </p>
      )}

      <section className="grid gap-2 rounded-2xl border border-champagne/35 bg-[linear-gradient(150deg,rgb(214_178_110/0.10),transparent_60%)] p-5 sm:p-6">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">{f.balance < 0 ? "Credit" : "To pay"}</p>
        <p className="font-display text-5xl text-gold-metal tabular">{formatPeso(Math.abs(f.balance), true)}</p>
        <p className="text-sm text-muted">
          {f.balance <= 0
            ? f.balance < 0
              ? "You've paid ahead: this credit goes towards your next fee."
              : "You're all paid up. Thank you."
            : f.nextDueAt
              ? `${f.nextDueAt < now ? "Was due" : "Next due"} ${day(f.nextDueAt)}.`
              : ""}
          {f.checking && " We're checking a receipt you sent."}
        </p>
      </section>

      {f.balance > 0 &&
        (payText ? (
          <section aria-labelledby="pay-title" className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <h2 id="pay-title" className="text-xl">
              Pay by GCash or bank
            </h2>
            <div className="rounded-xl border border-line bg-velvet/60 p-4">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-champagne uppercase">
                <Lock className="size-3.5" aria-hidden /> Luxx4less payment details
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-line text-fg">{payText}</p>
              <p className="mt-3 text-xs text-muted">Put &ldquo;Fees&rdquo; and your email in the message of the transfer.</p>
            </div>
            <p className="flex gap-2 rounded-xl bg-danger-tint p-3 text-sm text-fg/90">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
              Only pay to the details on this page. Luxx4less never sends different account details by chat, text or Messenger.
            </p>
            <FeeReceiptForm balance={f.balance} />
          </section>
        ) : (
          <FormAlert tone="info">You can also pay at any Luxx4less branch. Online payment details will appear here soon.</FormAlert>
        ))}

      <section aria-labelledby="sales-title" className="grid gap-3 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 id="sales-title" className="font-display text-sm tracking-[0.2em] text-champagne uppercase">
          Fees on your sales
        </h2>
        {f.trades.length === 0 ? (
          <p className="text-sm text-muted">No fees yet. They appear here when something you sell on Luxx4less completes.</p>
        ) : (
          <ul className="grid gap-2 text-sm">
            {[...f.trades].reverse().map((t) => {
              const paid = Boolean(t.feePaidAt) || Boolean(t.feeWaivedAt);
              const late = !paid && t.feeDueAt !== null && t.feeDueAt < now;
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 last:border-0 last:pb-0">
                  <span className="min-w-0">
                    <Link href={`/account/trades/${t.code}`} className="inline-block py-1 font-display text-xs tracking-[0.2em] text-champagne tabular hover:underline">
                      {t.code}
                    </Link>{" "}
                    <span className="text-muted">
                      · {itemLabel(t)} · sold for {formatPeso(Number(t.amountPhp))} · {t.releasedAt ? day(t.releasedAt) : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold tabular">
                      {formatPeso(Number(t.feePhp), true)} <span className="text-xs font-normal text-muted">({Number(t.feePct)}%)</span>
                    </span>
                    {t.feeWaivedAt ? <Badge tone="neutral">Waived</Badge> : paid ? <Badge tone="success">Paid</Badge> : late ? <Badge tone="danger">Past due</Badge> : <Badge tone="gold">Due {t.feeDueAt ? day(t.feeDueAt) : ""}</Badge>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {f.payments.length > 0 && (
        <section aria-labelledby="payments-title" className="grid gap-3 rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 id="payments-title" className="font-display text-sm tracking-[0.2em] text-champagne uppercase">
            Your payments
          </h2>
          <ul className="grid gap-2 text-sm">
            {f.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 last:border-0 last:pb-0">
                <span>
                  <span className="font-semibold tabular">{formatPeso(Number(p.amountPhp), true)}</span>
                  <span className="text-muted">
                    {" "}
                    · {day(p.createdAt)}
                    {p.reference ? ` · ref ${p.reference}` : ""}
                  </span>
                  {p.status === "rejected" && p.reviewNote && <span className="block text-xs text-danger">{p.reviewNote}</span>}
                </span>
                <Badge tone={p.status === "confirmed" ? "success" : p.status === "rejected" ? "danger" : "ice"}>{p.status === "submitted" ? "Being checked" : p.status === "confirmed" ? "Confirmed" : "Not accepted"}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
