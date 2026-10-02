import type { NextRequest } from "next/server";
import { env } from "@/lib/server/env";
import { getMarket } from "@/lib/server/prices/engine";
import { backfillHistory, historyCoverage } from "@/lib/server/prices/history";
import { remindDueInstallments, sweepUnpaidOrders } from "@/lib/server/shop/orders";
import { remindOverdueFees } from "@/lib/server/fees";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily housekeeping, called by Vercel Cron (vercel.json). Refreshes prices so
 * the day's close is recorded even without visitors, and backfills history the
 * first time a GOLD_API_KEY is present. Price alerts run on every refresh.
 * Also the Official Shop's daily round: unpaid orders past their hold are
 * cancelled (pieces back on sale) and layaway payments due soon are reminded.
 */
export async function GET(req: NextRequest) {
  const secret = env().CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const market = await getMarket({ wait: true });
  let backfill: unknown = "skipped (no GOLD_API_KEY)";
  if (env().GOLD_API_KEY) {
    const coverage = await historyCoverage();
    const tenYearsAgo = new Date(Date.now() - 10 * 365 * 24 * 3600_000).toISOString().slice(0, 10);
    const needs = Object.values(coverage).some((first) => !first || first > tenYearsAgo);
    backfill = needs ? await backfillHistory().catch((e: unknown) => `failed: ${e instanceof Error ? e.message : e}`) : "not needed";
  }
  const shop = await Promise.all([sweepUnpaidOrders(), remindDueInstallments()])
    .then(([cancelled, reminded]) => ({ cancelled, reminded }))
    .catch((e: unknown) => `failed: ${e instanceof Error ? e.message : e}`);
  const fees = await remindOverdueFees().catch((e: unknown) => `failed: ${e instanceof Error ? e.message : e}`);
  return Response.json({ checkedAt: market.checkedAt, delayed: market.delayed, notes: market.notes, backfill, shop, feeReminders: fees });
}
