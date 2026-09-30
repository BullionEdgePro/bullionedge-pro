import type { Metadata } from "next";
import { WantedForm } from "@/components/marketplace/wanted-form";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { REQUEST_LIFETIME_DAYS } from "@/config/catalog";
import { requireTier } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "Post a wanted request", robots: { index: false } };

export default async function NewWantedPage() {
  const viewer = await requireTier(3, "/marketplace/wanted/new");
  const p = viewer.profile;
  return (
    <>
      <SiteHeader signedIn />
      <main className="surface-velvet">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8 lg:py-14">
          <p className="font-display text-xs tracking-[0.32em] text-champagne uppercase">Wanted</p>
          <h1 className="mt-3 text-4xl text-pearl">Tell sellers what you&rsquo;re looking for</h1>
          <p className="measure mt-3 text-muted">
            Verified sellers with matching pieces are notified straight away and can answer with an offer. Your post stays up for {REQUEST_LIFETIME_DAYS} days.
          </p>
          <div className="mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-8">
            <WantedForm defaults={{ regionCode: p?.regionCode ?? "", provinceCode: p?.provinceCode ?? "", cityCode: p?.cityCode ?? "" }} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
