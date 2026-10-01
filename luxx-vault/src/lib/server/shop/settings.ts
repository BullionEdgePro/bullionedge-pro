import "server-only";
import { cache } from "react";
import { brand } from "@/config/brand";
import type { ShopRules } from "@/lib/shop";
import { db } from "@/lib/server/db";

/**
 * The Official Shop's settings row, created with its defaults the first time
 * anyone needs it. Defaults are a starting point for the owner, editable in
 * /admin/shop/settings; payment details start empty (the owner types them).
 */
export const getShopSettings = cache(async () => {
  return db.shopSettings.upsert({ where: { id: "shop" }, create: { id: "shop" }, update: {} });
});

export type ShopSettingsRow = Awaited<ReturnType<typeof getShopSettings>>;

export function rulesOf(s: ShopSettingsRow): ShopRules {
  return {
    layawayEnabled: s.layawayEnabled,
    layawayDownPct: s.layawayDownPct,
    layawayMonths: s.layawayMonths,
    layawayMinPhp: Number(s.layawayMinPhp),
    codEnabled: s.codEnabled,
    codMaxPhp: s.codMaxPhp === null ? null : Number(s.codMaxPhp),
  };
}

/** Branches a buyer can pick up from: the confirmed ones in brand.ts. */
export function pickupBranches(): { name: string; address: string }[] {
  return brand.branches.filter((b) => !("confirm" in b && b.confirm)).map((b) => ({ name: b.name, address: b.address }));
}
