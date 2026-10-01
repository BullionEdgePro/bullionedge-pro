import type { Metadata } from "next";
import Link from "next/link";
import { ProductForm } from "@/components/shop/product-form";
import { ADMIN_ROLES } from "@/config/roles";
import { getSpot } from "@/lib/server/marketplace/context";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Add a piece" };

export default async function NewProductPage() {
  await requireRole(ADMIN_ROLES, "/admin/shop/new");
  const { spot } = await getSpot();
  return (
    <div className="grid gap-6">
      <div>
        <Link href="/admin/shop" className="text-sm text-muted hover:text-champagne">
          ← Official shop
        </Link>
        <h1 className="mt-3 text-3xl">Add a piece</h1>
        <p className="mt-1 text-sm text-muted">Save it as a draft to check it first, or publish it straight to the shop.</p>
      </div>
      <ProductForm
        spot={spot}
        defaults={{
          photos: [],
          title: "",
          category: "gold_jewelry",
          metal: "gold",
          karat: "18",
          finenessPermille: "",
          goldType: "",
          form: "",
          weightGrams: "",
          pricingMode: "fixed",
          pricePhp: "",
          premiumPct: "",
          description: "",
          hasCertificate: false,
          pawnable: "unknown",
          stock: "1",
          layawayAllowed: true,
          featured: false,
          status: "draft",
        }}
      />
    </div>
  );
}
