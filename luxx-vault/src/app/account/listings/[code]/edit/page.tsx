import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { SellWizard } from "@/components/marketplace/sell-wizard";
import { FormAlert } from "@/components/ui/field";
import { normaliseCode } from "@/lib/server/marketplace/codes";
import { requireSeller } from "@/lib/server/marketplace/context";
import { wizardProps } from "@/lib/server/marketplace/wizard";

export const metadata: Metadata = { title: "Edit listing" };

export default async function EditListingPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normaliseCode((await params).code, "LX");
  if (!code) notFound();
  const viewer = await requireSeller(`/account/listings/${code}/edit`);
  const props = await wizardProps(viewer, code);
  if (!props.listing || props.listing.sellerId !== viewer.userId) notFound();
  const editable = ["active", "expired", "draft"].includes(props.listing.status);

  return (
    <div className="grid gap-6">
      <Link href="/account/listings" className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-champagne">
        <ChevronLeft className="size-4" aria-hidden /> My listings
      </Link>
      <div>
        <p className="font-display text-xs tracking-[0.28em] text-champagne tabular">{props.listing.code}</p>
        <h1 className="mt-2 text-3xl">Edit listing</h1>
      </div>
      {editable ? (
        <SellWizard defaults={props.defaults} spot={props.spot} pricesDelayed={props.pricesDelayed} limits={props.limits} />
      ) : (
        <FormAlert tone="info">Listings that are in a trade, sold or taken down can&rsquo;t be edited.</FormAlert>
      )}
    </div>
  );
}
