import type { NextRequest } from "next/server";
import { METAL_VALUES } from "@/config/catalog";
import { SERIES_RANGES, getSeries, type SeriesRange } from "@/lib/server/prices/history";

export const dynamic = "force-dynamic";

/** Chart data: /api/prices/history?metal=gold&range=1M */
export async function GET(req: NextRequest) {
  const metal = req.nextUrl.searchParams.get("metal") ?? "gold";
  const range = (req.nextUrl.searchParams.get("range") ?? "1M") as SeriesRange;
  if (!(METAL_VALUES as readonly string[]).includes(metal) || !SERIES_RANGES.includes(range)) {
    return Response.json({ error: "Unknown metal or range" }, { status: 400 });
  }
  const points = await getSeries(metal as (typeof METAL_VALUES)[number], range);
  return Response.json(
    { metal, range, points },
    { headers: { "Cache-Control": `public, s-maxage=${range === "1D" ? 60 : 900}, stale-while-revalidate=600` } },
  );
}
