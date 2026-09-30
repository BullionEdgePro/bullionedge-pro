import type { NextRequest } from "next/server";
import { env } from "@/lib/server/env";
import { getMarket } from "@/lib/server/prices/engine";
import { backfillHistory, historyCoverage } from "@/lib/server/prices/history";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily housekeeping, called by Vercel Cron (vercel.json). Refreshes prices so
 * the day's close is recorded even without visitors, and backfills history the
 * first time a GOLD_API_KEY is present. Price alerts run on every refresh.
 */
export async function GET(req: NextRequest) {
  const secret = env().CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const market = await getMarket();
  let backfill: unknown = "skipped (no GOLD_API_KEY)";
  if (env().GOLD_API_KEY) {
    const coverage = await historyCoverage();
    const tenYearsAgo = new Date(Date.now() - 10 * 365 * 24 * 3600_000).toISOString().slice(0, 10);
    const needs = Object.values(coverage).some((first) => !first || first > tenYearsAgo);
    backfill = needs ? await backfillHistory().catch((e: unknown) => `failed: ${e instanceof Error ? e.message : e}`) : "not needed";
  }
  return Response.json({ checkedAt: market.checkedAt, delayed: market.delayed, notes: market.notes, backfill });
}
