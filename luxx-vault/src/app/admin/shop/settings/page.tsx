import type { Metadata } from "next";
import Link from "next/link";
import { SettingsForm } from "@/components/shop/settings-form";
import { ADMIN_ROLES } from "@/config/roles";
import { getShopSettings } from "@/lib/server/shop/settings";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Shop settings" };

export default async function ShopSettingsPage() {
  await requireRole(ADMIN_ROLES, "/admin/shop/settings");
  const s = await getShopSettings();
  const n = (v: unknown) => (v === null || v === undefined ? "" : String(Number(v)));
  return (
    <div className="grid gap-6">
      <div>
        <Link href="/admin/shop" className="text-sm text-muted hover:text-champagne">
          ← Official shop
        </Link>
        <h1 className="mt-3 text-3xl">Shop settings</h1>
        <p className="mt-1 text-sm text-muted">Changes apply to new orders. Orders already placed keep their terms.</p>
      </div>
      <SettingsForm
        defaults={{
          paymentInstructions: s.paymentInstructions ?? "",
          reserveDays: String(s.reserveDays),
          layawayEnabled: s.layawayEnabled,
          layawayDownPct: String(s.layawayDownPct),
          layawayMonths: String(s.layawayMonths),
          layawayMinPhp: n(s.layawayMinPhp),
          codEnabled: s.codEnabled,
          codMaxPhp: n(s.codMaxPhp),
          deliveryFeePhp: n(s.deliveryFeePhp),
        }}
      />
    </div>
  );
}
