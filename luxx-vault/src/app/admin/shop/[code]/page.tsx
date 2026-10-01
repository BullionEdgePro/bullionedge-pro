import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/shop/product-form";
import { ADMIN_ROLES } from "@/config/roles";
import { db } from "@/lib/server/db";
import { mediaUrl } from "@/lib/server/media";
import { normaliseCode } from "@/lib/server/marketplace/codes";
import { getSpot } from "@/lib/server/marketplace/context";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Edit piece" };

export default async function EditProductPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normaliseCode(decodeURIComponent((await params).code), "LP");
  if (!code) notFound();
  await requireRole(ADMIN_ROLES, `/admin/shop/${code}`);
  const [p, { spot }] = await Promise.all([db.product.findUnique({ where: { code }, include: { images: { orderBy: { position: "asc" }, select: { mediaId: true } } } }), getSpot()]);
  if (!p) notFound();
  const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

  return (
    <div className="grid gap-6">
      <div>
        <Link href="/admin/shop" className="text-sm text-muted hover:text-champagne">
          ← Official shop
        </Link>
        <h1 className="mt-3 text-3xl">
          Edit <span className="font-display tracking-wide text-champagne tabular">{p.code}</span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          Orders already placed keep the price and details they were placed with.{" "}
          <Link href={`/shop/${p.code}`} className="text-champagne hover:underline">
            View in the shop
          </Link>
        </p>
      </div>
      <ProductForm
        spot={spot}
        defaults={{
          id: p.id,
          photos: p.images.map((i) => ({ id: i.mediaId, url: mediaUrl(i.mediaId) })),
          title: p.title,
          category: p.category,
          metal: str(p.metal),
          karat: str(p.karat),
          finenessPermille: str(p.finenessPermille),
          goldType: str(p.goldType),
          form: str(p.form),
          weightGrams: String(Number(p.weightGrams)),
          pricingMode: p.pricingMode === "spot_premium" ? "spot_premium" : "fixed",
          pricePhp: p.pricePhp === null ? "" : String(Number(p.pricePhp)),
          premiumPct: p.premiumPct === null ? "" : String(Number(p.premiumPct)),
          description: p.description,
          hasCertificate: p.hasCertificate,
          pawnable: p.pawnable === null ? "unknown" : p.pawnable ? "yes" : "no",
          stock: String(p.stock),
          layawayAllowed: p.layawayAllowed,
          featured: p.featured,
          status: p.status === "active" || p.status === "archived" ? p.status : "draft",
        }}
      />
    </div>
  );
}
