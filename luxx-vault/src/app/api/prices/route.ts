import { getMarket } from "@/lib/server/prices/engine";

// Always ask the engine: it decides whether the stored prices are fresh enough.
export const dynamic = "force-dynamic";

/** Live market for the header ticker and client components. Short CDN cache; the engine refreshes at most once a minute. */
export async function GET() {
  const market = await getMarket();
  return Response.json(market, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
