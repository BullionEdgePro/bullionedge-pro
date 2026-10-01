import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/shop/checkout-form";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { formatPhMobile } from "@/lib/phone";
import { checkoutTierNeeded } from "@/lib/shop";
import { getBag } from "@/lib/server/shop/bag";
import { getShopSettings, pickupBranches, rulesOf } from "@/lib/server/shop/settings";
import { requireTier } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const viewer = await requireTier(2, "/shop/checkout");
  const [bag, settings] = await Promise.all([getBag(viewer.userId), getShopSettings()]);
  if (!bag.lines.length || !bag.ready) redirect("/shop/bag");
  const deliveryFee = settings.deliveryFeePhp === null ? null : Number(settings.deliveryFeePhp);
  // The biggest total this bag can reach is with delivery; above ₱100,000 we need an ID-verified buyer.
  if (viewer.tier < checkoutTierNeeded(bag.subtotalPhp)) redirect(`/account/verification?step=identity&next=${encodeURIComponent("/shop/checkout")}`);

  return (
    <>
      <SiteHeader signedIn />
      <main className="surface-velvet">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8 lg:py-14">
          <nav aria-label="Breadcrumb" className="text-sm text-muted">
            <Link href="/shop/bag" className="hover:text-champagne">
              ← Back to your bag
            </Link>
          </nav>
          <p className="mt-4 font-display text-xs tracking-[0.32em] text-champagne uppercase">Official shop</p>
          <h1 className="mt-3 text-4xl text-pearl">Checkout</h1>
          <div className="mt-8">
            <CheckoutForm
              lines={bag.lines.map((l) => ({ code: l.code, title: l.title, quantity: l.quantity, unitPricePhp: l.unitPricePhp!, coverUrl: l.coverUrl, live: l.live, layawayAllowed: l.layawayAllowed }))}
              rules={rulesOf(settings)}
              reserveDays={settings.reserveDays}
              deliveryFeePhp={deliveryFee}
              transferReady={Boolean(settings.paymentInstructions?.trim())}
              branches={pickupBranches()}
              tier={viewer.tier}
              now={new Date().getTime()}
              defaults={{
                contactName: viewer.profile?.displayName ?? viewer.name,
                contactPhone: viewer.profile?.phone ? formatPhMobile(viewer.profile.phone) : "",
                regionCode: viewer.profile?.regionCode ?? "",
                provinceCode: viewer.profile?.provinceCode ?? "",
                cityCode: viewer.profile?.cityCode ?? "",
              }}
            />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
