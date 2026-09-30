import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MessagesSquare, ShieldCheck } from "lucide-react";
import { InlineAction } from "@/components/marketplace/inline-action";
import { MediaImage } from "@/components/marketplace/media-image";
import { Stars } from "@/components/marketplace/stars";
import { TestModeNote } from "@/components/marketplace/test-mode-note";
import { DisputeForm, ReceiveForm, ReviewForm, ShipForm } from "@/components/marketplace/trade-forms";
import { TradeTimeline } from "@/components/marketplace/trade-timeline";
import { Badge, TierBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { db } from "@/lib/server/db";
import { mediaUrl } from "@/lib/server/media";
import { payments } from "@/lib/server/payments";
import { cancelTrade, hideFromTape, payIntoHold } from "@/lib/server/marketplace/actions/trades";
import { normaliseCode } from "@/lib/server/marketplace/codes";
import { gramsLabel, itemLabel } from "@/lib/server/marketplace/describe";
import { statsFor } from "@/lib/server/marketplace/stats";
import { AUTO_RELEASE_DAYS, COURIERS, DISPUTE_REASONS, settleDueTrades, TRADE_STATUS_LABEL } from "@/lib/server/marketplace/trades";
import { placeLabel } from "@/lib/locations";
import { formatPeso } from "@/lib/pricing";
import { requireTier } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "Trade" };

const FULFILMENT: Record<string, string> = { shipping: "Courier with tracking", meetup: "Meet-up in a public place", luxx_meetup: "Meet-up at Luxx4less with testing" };

export default async function TradePage({ params }: { params: Promise<{ code: string }> }) {
  const code = normaliseCode((await params).code, "TR");
  if (!code) notFound();
  const viewer = await requireTier(3, `/account/trades/${code}`);
  await settleDueTrades(viewer.userId);
  const t = await db.trade.findUnique({
    where: { code },
    include: {
      listing: { select: { code: true, title: true, images: { orderBy: { position: "asc" }, take: 1, select: { mediaId: true } } } },
      buyRequest: { select: { code: true, title: true } },
      buyer: { select: { id: true, name: true, profile: { select: { displayName: true, handle: true } } } },
      seller: { select: { id: true, name: true, profile: { select: { displayName: true, handle: true } } } },
      conversation: { select: { id: true } },
      reviews: { include: { author: { select: { name: true, profile: { select: { displayName: true } } } } } },
      disputes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!t || (t.buyerId !== viewer.userId && t.sellerId !== viewer.userId)) notFound();

  const role = t.buyerId === viewer.userId ? "buyer" : "seller";
  const other = role === "buyer" ? t.seller : t.buyer;
  const otherName = other.profile?.displayName ?? other.name;
  const stats = await statsFor([other.id]);
  const amount = formatPeso(Number(t.amountPhp));
  const myReview = t.reviews.find((r) => r.authorId === viewer.userId);
  const openDispute = t.disputes.find((d) => d.status === "open");
  const lastDispute = t.disputes[0];
  const branch = brand.branches.find((b) => b.main) ?? null;
  const title = t.listing?.title ?? t.buyRequest?.title ?? itemLabel(t);
  const canDispute = ["payment_held", "shipped", "received"].includes(t.status);

  const steps = [
    { key: "awaiting_payment", label: "Offer accepted, awaiting payment", at: t.createdAt },
    { key: "payment_held", label: `${amount} held by the payment provider`, detail: t.paymentRef ? "The seller can't touch it until you confirm." : null },
    {
      key: "shipped",
      label: t.fulfilment === "shipping" ? "Shipped" : "Meet-up arranged",
      detail: t.courier ? `${t.courier} · tracking ${t.trackingNumber}` : t.status !== "awaiting_payment" && t.status !== "payment_held" ? FULFILMENT[t.fulfilment] : null,
    },
    { key: "received", label: "Buyer confirms the item" },
    { key: "released", label: "Payment released to the seller", at: t.releasedAt },
  ];
  // Settled steps, read from the record itself so a disputed or refunded trade still shows how far it got.
  const doneCount =
    t.status === "released" ? 5 : t.status === "received" ? 4 : t.status === "shipped" ? 3 : t.status === "payment_held" ? 2 : t.status === "awaiting_payment" ? 1 : 1 + (t.paymentRef ? 1 : 0) + (t.courier || t.fulfilment !== "shipping" ? 1 : 0);
  const endNote =
    t.status === "disputed"
      ? { label: "In dispute: payment paused", detail: "Luxx4less staff are reviewing both sides." }
      : t.status === "refunded"
        ? { label: "Refunded to the buyer", detail: lastDispute?.resolution ? `Staff note: ${lastDispute.resolution}` : null }
        : t.status === "cancelled"
          ? { label: "Cancelled before payment", detail: "Nothing was charged." }
          : undefined;

  return (
    <div className="grid min-w-0 gap-6">
      <Link href="/account/trades" className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-champagne">
        <ChevronLeft className="size-4" aria-hidden /> All trades
      </Link>

      <header className="grid gap-4 rounded-2xl border border-champagne/25 bg-[linear-gradient(135deg,rgb(214_178_110/0.08),transparent_55%)] p-5 sm:grid-cols-[6rem_minmax(0,1fr)] sm:p-6">
        <MediaImage src={t.listing?.images[0] ? mediaUrl(t.listing.images[0].mediaId) : null} alt={title} sizes="96px" className="aspect-square rounded-xl" />
        <div className="grid min-w-0 gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-xs tracking-[0.24em] text-champagne tabular">{t.code}</span>
            <Badge tone={t.status === "released" ? "success" : t.status === "disputed" ? "warning" : "gold"}>{TRADE_STATUS_LABEL[t.status] ?? t.status}</Badge>
            {payments().testMode && <TestModeNote />}
          </div>
          <h1 className="truncate text-2xl sm:text-3xl">{title}</h1>
          <p className="text-sm text-muted tabular">
            {itemLabel(t)} · {gramsLabel(Number(t.weightGrams))} · {placeLabel(t.cityCode, t.regionCode)}
          </p>
          <p className="font-display text-3xl text-gold tabular">{amount}</p>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
            You {role === "buyer" ? "buy from" : "sell to"}
            {other.profile?.handle ? (
              <Link href={`/sellers/${other.profile.handle}`} className="font-semibold text-fg hover:text-champagne">
                {otherName}
              </Link>
            ) : (
              <span className="font-semibold text-fg">{otherName}</span>
            )}
            {stats.get(other.id) && <TierBadge tier={stats.get(other.id)!.tier} />}
          </p>
          <div className="flex flex-wrap gap-2">
            {t.conversation && (
              <Button asChild size="sm" variant="secondary">
                <Link href={`/account/messages/${t.conversation.id}`}>
                  <MessagesSquare aria-hidden /> Chat about this trade
                </Link>
              </Button>
            )}
            {t.listing && (
              <Button asChild size="sm" variant="ghost">
                <Link href={`/marketplace/${t.listing.code}`}>View listing</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section aria-labelledby="timeline-title" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 id="timeline-title" className="mb-5 font-display text-sm tracking-[0.2em] text-champagne uppercase">
            Timeline
          </h2>
          <TradeTimeline status={t.status} steps={steps} doneCount={doneCount} endNote={endNote} />
        </section>

        <section aria-labelledby="next-title" className="grid content-start gap-5 rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 id="next-title" className="font-display text-sm tracking-[0.2em] text-champagne uppercase">
            {t.status === "released" ? "Complete" : "What happens next"}
          </h2>

          {t.status === "awaiting_payment" && role === "buyer" && (
            <div className="grid gap-3">
              <p className="text-sm text-muted">
                Pay {amount} into the protected hold. The payment provider keeps it; the seller is paid only after you confirm the item. Luxx4less never holds your money and will
                never ask you to pay anyone directly.
              </p>
              <InlineAction action={payIntoHold} fields={{ code: t.code }} variant="primary" size="lg">
                Pay {amount} into protected hold
              </InlineAction>
              {payments().testMode && <p className="text-xs text-warning">Test mode: this simulates the hold. No money moves.</p>}
            </div>
          )}
          {t.status === "awaiting_payment" && role === "seller" && <p className="text-sm text-muted">Waiting for the buyer to pay into the protected hold. Don&rsquo;t ship anything yet.</p>}
          {t.status === "awaiting_payment" && (
            <InlineAction action={cancelTrade} fields={{ code: t.code }} confirm="Cancel this trade? The item goes back on sale.">
              Cancel trade
            </InlineAction>
          )}

          {t.status === "payment_held" && role === "seller" && (
            <div className="grid gap-3">
              <p className="text-sm text-muted">The buyer&rsquo;s payment is held. Ship with tracking, or agree a meet-up. The payment is released when the buyer confirms, or automatically {AUTO_RELEASE_DAYS} days after you mark it sent if no dispute is opened.</p>
              <ShipForm code={t.code} couriers={COURIERS} branch={branch ? { name: branch.name, address: branch.address } : null} />
            </div>
          )}
          {t.status === "payment_held" && role === "buyer" && <p className="text-sm text-muted">Your payment is safe in the hold. The seller will ship or arrange the meet-up next.</p>}

          {t.status === "shipped" && (
            <div className="grid gap-3">
              <p className="text-sm text-muted">
                {FULFILMENT[t.fulfilment]}
                {t.courier ? `: ${t.courier}, tracking ${t.trackingNumber}` : ""}.
                {t.fulfilment === "luxx_meetup" && branch ? ` ${branch.address}.` : ""}
                {t.autoReleaseAt ? ` If nothing is reported, the payment is released on ${t.autoReleaseAt.toLocaleDateString("en-PH", { day: "numeric", month: "long" })}.` : ""}
              </p>
              {role === "buyer" && <ReceiveForm code={t.code} />}
            </div>
          )}

          {t.status === "disputed" && openDispute && (
            <div className="grid gap-2 rounded-xl border border-warning/30 bg-warning-tint p-4 text-sm">
              <p className="font-semibold text-warning">Dispute under review</p>
              <p className="text-fg/85">{DISPUTE_REASONS.find((r) => r.value === openDispute.reason)?.label}</p>
              <p className="text-muted whitespace-pre-line">{openDispute.details}</p>
              {openDispute.evidenceMediaIds.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {openDispute.evidenceMediaIds.map((id) => (
                    <li key={id}>
                      <a href={mediaUrl(id)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg">
                        <MediaImage src={mediaUrl(id)} alt="Evidence photo" isPrivate sizes="80px" className="size-20" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted">Staff will decide and tell you both here. Keep all discussion in the trade chat.</p>
            </div>
          )}

          {canDispute && !openDispute && <DisputeForm code={t.code} reasons={DISPUTE_REASONS} />}

          {t.status === "released" && (
            <div className="grid gap-5">
              <p className="flex items-center gap-2 text-sm text-success">
                <ShieldCheck className="size-4" aria-hidden /> Completed {t.releasedAt?.toLocaleDateString("en-PH", { day: "numeric", month: "long", year: "numeric" })}.
              </p>
              {myReview ? (
                <div className="text-sm">
                  <p className="text-muted">Your review</p>
                  <Stars value={myReview.rating} />
                  {myReview.body && <p className="mt-1 text-fg/85">{myReview.body}</p>}
                </div>
              ) : (
                <ReviewForm code={t.code} otherName={otherName} />
              )}
              {t.reviews
                .filter((r) => r.authorId !== viewer.userId)
                .map((r) => (
                  <div key={r.id} className="text-sm">
                    <p className="text-muted">{otherName}&rsquo;s review of you</p>
                    <Stars value={r.rating} />
                    {r.body && <p className="mt-1 text-fg/85">{r.body}</p>}
                  </div>
                ))}
              <div className="border-t border-line pt-4 text-sm">
                {t.hideFromTape ? (
                  <p className="text-muted">This trade is kept off the public trade tape.</p>
                ) : (
                  <div className="grid gap-2">
                    <p className="text-muted">Completed trades appear on the public trade tape without names, codes or exact totals: item, weight, city and a rounded price per gram.</p>
                    <InlineAction action={hideFromTape} fields={{ code: t.code }} confirm="Keep this trade off the trade tape? This can't be undone.">
                      Keep it off the trade tape
                    </InlineAction>
                  </div>
                )}
              </div>
            </div>
          )}
          {(t.status === "refunded" || t.status === "cancelled") && <p className="text-sm text-muted">This trade is closed.</p>}
        </section>
      </div>
    </div>
  );
}
