import type { Metadata } from "next";
import Link from "next/link";
import { SellWizard } from "@/components/marketplace/sell-wizard";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { FormAlert } from "@/components/ui/field";
import { FaceCheckPrompt } from "@/components/verification/face-check-prompt";
import { requireFaceForPage } from "@/lib/server/face/gate";
import { formatPeso } from "@/lib/pricing";
import { requireSeller } from "@/lib/server/marketplace/context";
import { wizardProps } from "@/lib/server/marketplace/wizard";

export const metadata: Metadata = { title: "List an item", robots: { index: false } };

export default async function SellPage() {
  const viewer = await requireSeller("/marketplace/sell");
  const faceLock = await requireFaceForPage("session", "/marketplace/sell");
  const props = await wizardProps(viewer);
  const atLimit = props.limits.newSeller && props.limits.activeCount >= props.limits.maxActive;

  return (
    <>
      <SiteHeader signedIn />
      <main className="surface-velvet">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8 lg:py-14">
          <p className="font-display text-xs tracking-[0.32em] text-champagne uppercase">Seller desk</p>
          <h1 className="mt-3 text-4xl text-pearl">List an item</h1>
          <p className="measure mt-3 text-muted">
            Five short steps. Buyers see your price beside today&rsquo;s melt value, your verified-seller badge and your trust score.
          </p>
          <div className="mt-8">
            {faceLock ? (
              <FaceCheckPrompt status={faceLock} />
            ) : atLimit ? (
              <FormAlert tone="info">
                New sellers can have {props.limits.maxActive} listings up at a time until they complete {props.limits.tradesToGraduate} trades (up to{" "}
                {formatPeso(props.limits.maxListingValuePhp)} each). Mark one sold or take one down in{" "}
                <Link href="/account/listings" className="underline underline-offset-4">
                  My listings
                </Link>{" "}
                to add another.
              </FormAlert>
            ) : (
              <SellWizard defaults={props.defaults} spot={props.spot} pricesDelayed={props.pricesDelayed} limits={props.limits} />
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
