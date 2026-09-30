import "server-only";
import { allSpreadSlots, checkSpreadRow, type SpreadKey } from "@/app/admin/prices/spread-rules";
import { audit } from "./audit";
import { db } from "./db";

export type SaveSpreadsResult =
  | { status: "saved"; changed: number }
  | { status: "error"; message: string; rowErrors: Partial<Record<SpreadKey, string>> };

/**
 * Apply the editor's rows. Only known slots are read (metal/purity/type come
 * from our own list, never from the form's field names), every row is checked
 * again here, and nothing is written unless every row passes. One audit entry
 * records each change with its before and after.
 */
export async function saveSpreads(actorId: string, read: (field: string) => string, ip: string): Promise<SaveSpreadsResult> {
  const slots = allSpreadSlots();
  const rowErrors: Partial<Record<SpreadKey, string>> = {};
  const wanted = new Map<SpreadKey, { buyRatio: number; sellRatio: number } | null>();

  for (const s of slots) {
    const check = checkSpreadRow(read(`buy:${s.key}`), read(`sell:${s.key}`));
    if (check.kind === "error") rowErrors[s.key] = check.message;
    else wanted.set(s.key, check.kind === "ok" ? { buyRatio: check.buyRatio, sellRatio: check.sellRatio } : null);
  }
  if (Object.keys(rowErrors).length) {
    return { status: "error", message: "Some rows need attention; nothing was saved.", rowErrors };
  }

  const existing = await db.spread.findMany();
  const byKey = new Map(existing.map((r) => [`${r.metal}:${r.purity}:${r.productType}` as SpreadKey, r]));
  const changes: { key: SpreadKey; from: { buy: number; sell: number } | null; to: { buy: number; sell: number } | null }[] = [];

  await db.$transaction(async (tx) => {
    for (const s of slots) {
      const next = wanted.get(s.key) ?? null;
      const prev = byKey.get(s.key);
      const from = prev ? { buy: Number(prev.buyRatio), sell: Number(prev.sellRatio) } : null;
      if (!next && prev) {
        await tx.spread.delete({ where: { id: prev.id } });
        changes.push({ key: s.key, from, to: null });
      } else if (next && (!from || from.buy !== next.buyRatio || from.sell !== next.sellRatio)) {
        await tx.spread.upsert({
          where: { metal_purity_productType: { metal: s.metal, purity: s.purity, productType: s.productType } },
          create: { metal: s.metal, purity: s.purity, productType: s.productType, buyRatio: next.buyRatio, sellRatio: next.sellRatio, updatedById: actorId },
          update: { buyRatio: next.buyRatio, sellRatio: next.sellRatio, updatedById: actorId },
        });
        changes.push({ key: s.key, from, to: { buy: next.buyRatio, sell: next.sellRatio } });
      }
    }
  });

  if (changes.length) {
    await audit({ actorId, action: "prices.spreads.update", targetType: "spread", meta: { changes }, ipAddress: ip });
  }
  return { status: "saved", changed: changes.length };
}
