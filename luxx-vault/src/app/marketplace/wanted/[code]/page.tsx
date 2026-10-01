import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { ChevronRight, MessagesSquare, PackageSearch } from "lucide-react";
import { SubmitButton } from "@/components/marketplace/action-form";
import { ReportDialog } from "@/components/marketplace/report-dialog";
import { SellerCard } from "@/components/marketplace/seller-card";
import { ShareButtons } from "@/components/marketplace/share-buttons";
import { WantedOfferForm } from "@/components/marketplace/wanted-offer-form";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/field";
import { CATEGORIES, FORMS, GOLD_TYPES, labelOf } from "@/config/catalog";
import { STAFF_ROLES } from "@/config/roles";
import { db } from "@/lib/server/db";
import { startConversation } from "@/lib/server/marketplace/actions/messages";
import { normaliseCode } from "@/lib/server/marketplace/codes";
import { timeAgo } from "@/lib/server/marketplace/describe";
import { REPORT_HIDE_THRESHOLD } from "@/lib/server/marketplace/listings";
import { statsForOne } from "@/lib/server/marketplace/stats";
import { placeLabel } from "@/lib/locations";
import { formatPeso } from "@/lib/pricing";
import { getViewer } from "@/lib/server/viewer";

type Props = { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | undefined>> };

const load = cache(async (code: string) =>
  db.buyRequest.findUnique({
    where: { code },
    include: { buyer: { select: { name: true, profile: { select: { handle: true, displayName: true, cityCode: true, regionCode: true } } } }, _count: { select: { offers: true } } },
  }),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const code = normaliseCode((await params).code, "WP");
  const r = code ? await load(code) : null;
  if (!r || r.status === "removed") return { title: "Wanted post not found", robots: { index: false } };
  return {
    title: `Wanted: ${r.title} (${r.code})`,
    description: `A verified buyer on Luxx4less is looking for this. Verified sellers can answer with an offer.`,
    alternates: { canonical: `/marketplace/wanted/${r.code}` },
    robots: r.status === "open" ? undefined : { index: false },
  };
}

export default async function WantedPage({ params, searchParams }: Props) {
  const raw = (await params).code;
  const sp = await searchParams;
  const code = normaliseCode(decodeURIComponent(raw), "WP");
  if (!code) notFound();
  if (code !== raw) permanentRedirect(`/marketplace/wanted/${code}`);
  const [r, viewer] = await Promise.all([load(code), getViewer()]);
  if (!r) notFound();
  const isOwner = viewer?.userId === r.buyerId;
  const isStaff = Boolean(viewer?.roles.some((x) => STAFF_ROLES.includes(x)));
  if (r.status === "removed" && !isOwner && !isStaff) notFound();

  const open = r.status === "open" && r.expiresAt > new Date() && r.reportCount < REPORT_HIDE_THRESHOLD;
  const stats = await statsForOne(r.buyerId);
  const myOffer = viewer && !isOwner ? await db.offer.findFirst({ where: { buyRequestId: r.id, fromUserId: viewer.userId, status: "pending" }, select: { amountPhp: true } }) : null;
  const buyerName = r.buyer.profile?.displayName ?? r.buyer.name;
  const weight =
    r.minGrams && r.maxGrams ? `${Number(r.minGrams)}–${Number(r.maxGrams)} g` : r.minGrams ? `from ${Number(r.minGrams)} g` : r.maxGrams ? `up to ${Number(r.maxGrams)} g` : "Any weight";
  const rows = [
    { label: "Category", value: labelOf(CATEGORIES, r.category) },
    ...(r.karat ? [{ label: "Karat", value: `${r.karat}K` }] : []),
    ...(r.goldType ? [{ label: "Gold type", value: labelOf(GOLD_TYPES, r.goldType) }] : []),
    ...(r.form ? [{ label: "Form", value: labelOf(FORMS, r.form) }] : []),
    { label: "Weight", value: weight },
    { label: "Budget", value: r.budgetMaxPhp ? `up to ${formatPeso(Number(r.budgetMaxPhp))}` : "Open to offers" },
    { label: "Location", value: placeLabel(r.cityCode, r.regionCode) },
    { label: "Posted", value: timeAgo(r.createdAt) },
  ];

  return (
    <>
      <SiteHeader signedIn={Boolean(viewer)} />
      <main className="surface-velvet">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 lg:py-12">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted">
            <Link href="/marketplace?tab=wanted" className="inline-block py-1.5 hover:text-champagne">
              Wanted
            </Link>
            <ChevronRight className="size-3.5" aria-hidden />
            <span className="text-fg">{r.code}</span>
          </nav>
          {sp.posted && (
            <div className="mt-4">
              <FormAlert tone="success">
                Your wanted post is up.{" "}
                {Number(sp.matched) > 0
                  ? `${sp.matched} verified ${Number(sp.matched) === 1 ? "seller with a matching listing was" : "sellers with matching listings were"} notified.`
                  : "No seller has a matching listing yet; new sellers will see it as they browse."}
              </FormAlert>
            </div>
          )}

          <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="grid content-start gap-6">
              <div>
                <p className="inline-flex items-center gap-2 font-display text-xs tracking-[0.28em] text-champagne uppercase">
                  <PackageSearch className="size-4" aria-hidden /> Wanted · <span className="tabular">{r.code}</span>
                </p>
                <h1 className="mt-3 text-3xl text-pearl sm:text-4xl">{r.title}</h1>
                {!open && <p className="mt-3 text-sm font-semibold text-warning">{r.status === "fulfilled" ? "This buyer has found what they were looking for." : "This wanted post is closed."}</p>}
              </div>
              <dl className="grid gap-x-6 sm:grid-cols-2">
                {rows.map((x) => (
                  <div key={x.label} className="flex justify-between gap-4 border-b border-line py-2.5 text-sm">
                    <dt className="text-muted">{x.label}</dt>
                    <dd className="text-right font-semibold text-fg tabular">{x.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm leading-relaxed whitespace-pre-line text-fg/90">{r.description}</p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <ShareButtons path={`/marketplace/wanted/${r.code}`} />
                {!isOwner && <ReportDialog targetType="buy_request" targetId={r.id} subject={`${r.code} · ${r.title}`} signedIn={Boolean(viewer)} label="Report post" />}
              </div>
            </div>

            <div className="grid content-start gap-6">
              <section className="rounded-2xl border border-champagne/30 bg-surface p-5">
                <h2 className="font-display text-sm tracking-[0.2em] text-champagne uppercase">Have one to sell?</h2>
                <p className="mt-1 text-sm text-muted tabular">
                  {r._count.offers} {r._count.offers === 1 ? "offer" : "offers"} so far.
                </p>
                <div className="mt-4">
                  {isOwner ? (
                    <div className="grid gap-3 text-sm text-muted">
                      <p>This is your post. Offers from sellers appear in your account.</p>
                      <Button asChild variant="secondary" size="sm" className="w-fit">
                        <Link href="/account/offers">See offers</Link>
                      </Button>
                    </div>
                  ) : !open ? (
                    <p className="text-sm text-muted">Offers are closed.</p>
                  ) : !viewer ? (
                    <Button asChild>
                      <Link href={`/sign-in?next=/marketplace/wanted/${r.code}`}>Sign in to answer</Link>
                    </Button>
                  ) : viewer.tier < 4 ? (
                    <div className="grid gap-3 text-sm text-muted">
                      <p>Only verified sellers can answer wanted posts: ID, proof of address and a payout account in their own name.</p>
                      <Button asChild variant="secondary" size="sm" className="w-fit">
                        <Link href={`/account/verification?next=/marketplace/wanted/${r.code}`}>Become a verified seller</Link>
                      </Button>
                    </div>
                  ) : !viewer.twoFactorEnabled ? (
                    <div className="grid gap-3 text-sm text-muted">
                      <p>Turn on two-step sign-in to sell.</p>
                      <Button asChild variant="secondary" size="sm" className="w-fit">
                        <Link href={`/account/security?require2fa=1&next=/marketplace/wanted/${r.code}`}>Turn it on</Link>
                      </Button>
                    </div>
                  ) : myOffer ? (
                    <p className="text-sm text-muted">
                      Your offer of <strong className="text-fg tabular">{formatPeso(Number(myOffer.amountPhp))}</strong> is waiting for the buyer.
                    </p>
                  ) : (
                    <WantedOfferForm buyRequestId={r.id} />
                  )}
                </div>
                {!isOwner && viewer && viewer.tier >= 3 && open && (
                  <form action={startConversation} className="mt-4 border-t border-line pt-4">
                    <input type="hidden" name="buyRequestId" value={r.id} />
                    <input type="hidden" name="returnTo" value={`/marketplace/wanted/${r.code}`} />
                    <SubmitButton variant="ghost" pendingLabel="Opening chat…">
                      <MessagesSquare aria-hidden /> Ask the buyer a question
                    </SubmitButton>
                  </form>
                )}
              </section>
              {stats && <SellerCard role="Buyer" handle={r.buyer.profile?.handle ?? ""} displayName={buyerName} place={placeLabel(r.buyer.profile?.cityCode, r.buyer.profile?.regionCode)} stats={stats} />}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
