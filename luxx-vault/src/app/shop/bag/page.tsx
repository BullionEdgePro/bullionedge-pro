import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Radio, ShoppingBag } from "lucide-react";
import { EmptyState } from "@/components/marketplace/empty-state";
import { MediaImage } from "@/components/marketplace/media-image";
import { BagLineControls } from "@/components/shop/bag-forms";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Button } from "@/components/ui/button";
import { formatPeso } from "@/lib/pricing";
import { gramsLabel, purityLabel } from "@/lib/server/marketplace/describe";
import { getBag } from "@/lib/server/shop/bag";
import { sweepUnpaidOrders } from "@/lib/server/shop/orders";
import { requireTier } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "Your bag", robots: { index: false } };

export default async function BagPage() {
  const viewer = await requireTier(1, "/shop/bag");
  await sweepUnpaidOrders();
  const bag = await getBag(viewer.userId);

  return (
    <>
      <SiteHeader signedIn />
      <main className="surface-velvet">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8 lg:py-14">
          <p className="font-display text-xs tracking-[0.32em] text-champagne uppercase">Official shop</p>
          <h1 className="mt-3 flex items-center gap-3 text-4xl text-pearl">
            <ShoppingBag className="size-8 text-champagne" aria-hidden /> Your bag
          </h1>

          {bag.lines.length === 0 ? (
            <EmptyState
              className="mt-8"
              title="Your bag is empty"
              body="Pieces you add from the official shop wait here until you check out."
              actions={
                <Button asChild>
                  <Link href="/shop">Browse the shop</Link>
                </Button>
              }
            />
          ) : (
            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <ul className="grid content-start gap-3">
                {bag.lines.map((l) => (
                  <li key={l.productId} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 rounded-2xl border border-line bg-surface p-4">
                    <Link href={`/shop/${l.code}`}>
                      <MediaImage src={l.coverUrl} alt={l.title} sizes="88px" className="aspect-square rounded-xl" />
                    </Link>
                    <div className="grid min-w-0 gap-1.5">
                      <div className="flex items-start justify-between gap-3">
                        <Link href={`/shop/${l.code}`} className="min-w-0 font-semibold text-fg hover:text-champagne">
                          <span className="line-clamp-2">{l.title}</span>
                        </Link>
                        {l.unitPricePhp !== null && <p className="shrink-0 font-display text-xl text-gold tabular">{formatPeso(l.unitPricePhp * l.quantity)}</p>}
                      </div>
                      <p className="text-xs text-muted tabular">
                        {[l.code, purityLabel(l), gramsLabel(l.weightGrams), l.quantity > 1 && l.unitPricePhp !== null ? `${formatPeso(l.unitPricePhp)} each` : ""].filter(Boolean).join(" · ")}
                        {l.live && (
                          <span className="ml-2 inline-flex items-center gap-1 text-champagne">
                            <Radio className="size-3" aria-hidden /> live price
                          </span>
                        )}
                      </p>
                      {l.problem && (
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-warning">
                          <AlertTriangle className="size-4 shrink-0" aria-hidden /> {l.problem}
                        </p>
                      )}
                      <BagLineControls productId={l.productId} quantity={l.quantity} stock={l.stock} />
                    </div>
                  </li>
                ))}
              </ul>

              <aside className="grid content-start gap-4 rounded-2xl border border-champagne/30 bg-[linear-gradient(160deg,rgb(214_178_110/0.08),transparent_60%)] p-5 lg:sticky lg:top-28">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm text-muted">Subtotal</p>
                  <p className="font-display text-3xl text-gold-metal tabular">{formatPeso(bag.subtotalPhp)}</p>
                </div>
                {bag.hasLivePrices && <p className="text-xs text-muted">Live-priced pieces follow today&rsquo;s gold price until you place the order. Then the price is locked.</p>}
                {bag.pricesDelayed && <p className="text-xs text-warning">Gold prices are delayed right now.</p>}
                {bag.ready ? (
                  <Button asChild size="lg" className="w-full">
                    <Link href="/shop/checkout">
                      Check out <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                ) : (
                  <p className="rounded-xl bg-warning-tint px-3 py-2 text-sm text-warning">Fix the items marked above to check out.</p>
                )}
                <Link href="/shop" className="text-center text-sm font-semibold text-champagne underline-offset-4 hover:underline">
                  Keep shopping
                </Link>
              </aside>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
