import "server-only";
import type { Metal } from "@/config/catalog";

/**
 * Price sources. Every function either returns a validated quote or throws;
 * the engine decides what to do about failures. Never called from the browser
 * (brief §10): the API keys and rate limits stay on the server.
 */

export type MetalQuote = { metal: Metal; usdPerOz: number; observedAt: Date; source: string };
export type FxQuote = { usdPhp: number; observedAt: Date; source: string };

const TIMEOUT_MS = 6_000;

const SYMBOL: Record<Metal, string> = { gold: "XAU", silver: "XAG", platinum: "XPT", palladium: "XPD" };

/** Plausible USD/oz ranges. A number outside is a broken feed, not a market move. */
const SANE_USD_PER_OZ: Record<Metal, [number, number]> = {
  gold: [500, 50_000],
  silver: [5, 2_000],
  platinum: [200, 20_000],
  palladium: [100, 20_000],
};
const SANE_USD_PHP: [number, number] = [30, 150];

async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${new URL(url).host} answered HTTP ${res.status}`);
  return res.json();
}

function sane(value: unknown, [min, max]: [number, number], what: string): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max) {
    throw new Error(`${what}: implausible value ${String(value)}`);
  }
  return n;
}

function date(value: unknown, fallback = new Date()): Date {
  const d = typeof value === "number" ? new Date(value * 1000) : typeof value === "string" ? new Date(value) : fallback;
  return Number.isNaN(d.getTime()) ? fallback : d;
}

// ------------------------------------------------------------------ spot metals

/** gold-api.com: free, no key, no rate limit for real-time prices. The reference site uses it too. */
export async function goldApiSpot(metal: Metal): Promise<MetalQuote> {
  const j = (await getJson(`https://api.gold-api.com/price/${SYMBOL[metal]}`)) as { price?: unknown; updatedAt?: unknown };
  return {
    metal,
    usdPerOz: sane(j.price, SANE_USD_PER_OZ[metal], `gold-api ${metal}`),
    observedAt: date(j.updatedAt),
    source: "gold-api.com",
  };
}

/** metals.dev: optional failover (needs METALS_DEV_API_KEY). One call returns all four metals. */
export async function metalsDevSpot(apiKey: string): Promise<MetalQuote[]> {
  const j = (await getJson(
    `https://api.metals.dev/v1/latest?api_key=${encodeURIComponent(apiKey)}&currency=USD&unit=toz`,
  )) as { metals?: Record<string, unknown>; timestamps?: { metal?: unknown } };
  const at = date(j.timestamps?.metal);
  return (Object.keys(SYMBOL) as Metal[]).flatMap((metal) => {
    try {
      return [{ metal, usdPerOz: sane(j.metals?.[metal], SANE_USD_PER_OZ[metal], `metals.dev ${metal}`), observedAt: at, source: "metals.dev" }];
    } catch {
      return [];
    }
  });
}

// ------------------------------------------------------------------ USD → PHP

/** open.er-api.com (ExchangeRate-API open access): updates once a day. The reference uses it too. */
export async function openErApiFx(): Promise<FxQuote> {
  const j = (await getJson("https://open.er-api.com/v6/latest/USD")) as {
    result?: string;
    rates?: Record<string, unknown>;
    time_last_update_unix?: unknown;
  };
  if (j.result !== "success") throw new Error("open.er-api: result was not success");
  return { usdPhp: sane(j.rates?.PHP, SANE_USD_PHP, "open.er-api USD/PHP"), observedAt: date(j.time_last_update_unix), source: "open.er-api.com" };
}

/** Frankfurter: European Central Bank reference rates, updated on working days. */
export async function frankfurterFx(): Promise<FxQuote> {
  const j = (await getJson("https://api.frankfurter.dev/v1/latest?base=USD&symbols=PHP")) as { rates?: { PHP?: unknown }; date?: unknown };
  return { usdPhp: sane(j.rates?.PHP, SANE_USD_PHP, "frankfurter USD/PHP"), observedAt: date(j.date), source: "frankfurter.dev" };
}

// ------------------------------------------------------------------ history (backfill)

/** gold-api.com daily history (needs a key). Returns [day, usdPerOz] oldest first. */
export async function goldApiHistory(metal: Metal, apiKey: string, from: Date, to: Date): Promise<[string, number][]> {
  const q = new URLSearchParams({
    symbol: SYMBOL[metal],
    startTimestamp: String(Math.floor(from.getTime() / 1000)),
    endTimestamp: String(Math.floor(to.getTime() / 1000)),
    groupBy: "day",
    aggregation: "avg",
    orderBy: "asc",
  });
  const rows = (await getJson(`https://api.gold-api.com/history?${q}`, { headers: { "x-api-key": apiKey } })) as unknown;
  if (!Array.isArray(rows)) throw new Error("gold-api history: expected an array");
  const out: [string, number][] = [];
  for (const r of rows as Record<string, unknown>[]) {
    const day = typeof r.day === "string" ? r.day.slice(0, 10) : null;
    const price = r.avg_price ?? r.max_price ?? r.price;
    if (!day) continue;
    try {
      out.push([day, sane(price, SANE_USD_PER_OZ[metal], `gold-api history ${metal}`)]);
    } catch {
      // skip a bad day rather than the whole series
    }
  }
  return out;
}

/** Frankfurter daily USD/PHP for a date range, as a day → rate map (working days only). */
export async function frankfurterFxHistory(from: Date, to: Date): Promise<Map<string, number>> {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const j = (await getJson(`https://api.frankfurter.dev/v1/${iso(from)}..${iso(to)}?base=USD&symbols=PHP`)) as {
    rates?: Record<string, { PHP?: unknown }>;
  };
  const map = new Map<string, number>();
  for (const [day, r] of Object.entries(j.rates ?? {})) {
    try {
      map.set(day, sane(r.PHP, SANE_USD_PHP, "frankfurter history"));
    } catch {
      // skip
    }
  }
  return map;
}
