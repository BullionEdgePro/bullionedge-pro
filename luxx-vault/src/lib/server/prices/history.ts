import "server-only";
import { METALS, type Metal } from "@/config/catalog";
import { phpPerGram } from "@/lib/pricing";
import { db } from "../db";
import { env } from "../env";
import { frankfurterFxHistory, goldApiHistory } from "./sources";

export type SeriesRange = "1D" | "1W" | "1M" | "6M" | "1Y" | "5Y" | "20Y";
export const SERIES_RANGES: readonly SeriesRange[] = ["1D", "1W", "1M", "6M", "1Y", "5Y", "20Y"];

export type SeriesPoint = { t: string; phpPerGram: number; usdPerOz: number };

const DAY_MS = 24 * 3600_000;
const RANGE_DAYS: Record<SeriesRange, number> = { "1D": 1, "1W": 7, "1M": 30, "6M": 182, "1Y": 365, "5Y": 1826, "20Y": 7305 };
const MAX_POINTS = 240;

function downsample<T>(rows: T[], max = MAX_POINTS): T[] {
  if (rows.length <= max) return rows;
  const step = rows.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(rows[Math.floor(i * step)]!);
  out.push(rows[rows.length - 1]!);
  return out;
}

/**
 * Price history for a chart. Short ranges come from our own snapshots; longer
 * ones from daily closes. Returns what exists: a new site starts with a short
 * history and the chart says so, rather than drawing invented data.
 */
export async function getSeries(metal: Metal, range: SeriesRange): Promise<SeriesPoint[]> {
  const since = new Date(Date.now() - RANGE_DAYS[range] * DAY_MS);
  if (range === "1D" || range === "1W") {
    const rows = await db.priceSnapshot.findMany({
      where: { metal, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, phpPerGram: true, usdPerOz: true },
    });
    return downsample(rows).map((r) => ({ t: r.createdAt.toISOString(), phpPerGram: Number(r.phpPerGram), usdPerOz: Number(r.usdPerOz) }));
  }
  const rows = await db.priceDaily.findMany({
    where: { metal, day: { gte: since }, phpPerGram: { not: null } },
    orderBy: { day: "asc" },
    select: { day: true, phpPerGram: true, usdPerOz: true },
  });
  return downsample(rows).map((r) => ({ t: r.day.toISOString().slice(0, 10), phpPerGram: Number(r.phpPerGram), usdPerOz: Number(r.usdPerOz) }));
}

export type PerformanceRow = { label: string; days: number; changePhp: number | null; changePct: number | null };

const PERIODS: { label: string; days: number }[] = [
  { label: "Today", days: 1 },
  { label: "30 days", days: 30 },
  { label: "6 months", days: 182 },
  { label: "1 year", days: 365 },
  { label: "5 years", days: 1826 },
  { label: "20 years", days: 7305 },
];

/** Change in ₱ per gram (pure metal) over standard periods; null where history doesn't reach back that far. */
export async function getPerformance(metal: Metal, currentPhpPerGram: number): Promise<PerformanceRow[]> {
  return Promise.all(
    PERIODS.map(async (p) => {
      const target = new Date(Date.now() - p.days * DAY_MS);
      const past = await db.priceDaily.findFirst({
        where: { metal, day: { lte: target }, phpPerGram: { not: null } },
        orderBy: { day: "desc" },
        select: { day: true, phpPerGram: true },
      });
      // Only accept a reading close to the target date (a week of slack for holidays and weekends).
      if (!past?.phpPerGram || target.getTime() - past.day.getTime() > 7 * DAY_MS) {
        return { ...p, changePhp: null, changePct: null };
      }
      const then = Number(past.phpPerGram);
      return { ...p, changePhp: currentPhpPerGram - then, changePct: ((currentPhpPerGram - then) / then) * 100 };
    }),
  );
}

/** How far back our daily history reaches, per metal. */
export async function historyCoverage(): Promise<Record<Metal, string | null>> {
  const out = {} as Record<Metal, string | null>;
  await Promise.all(
    METALS.map(async ({ value }) => {
      const first = await db.priceDaily.findFirst({ where: { metal: value, phpPerGram: { not: null } }, orderBy: { day: "asc" }, select: { day: true } });
      out[value] = first ? first.day.toISOString().slice(0, 10) : null;
    }),
  );
  return out;
}

/**
 * Fill 20 years of daily closes from gold-api.com (needs GOLD_API_KEY; the free
 * tier allows 10 history calls an hour, this uses one per metal) and convert to
 * pesos with the ECB USD/PHP rate for each day. Days we already have from our
 * own snapshots are left alone. Safe to run repeatedly.
 */
export async function backfillHistory(years = 20): Promise<{ metal: Metal; added: number }[]> {
  const key = env().GOLD_API_KEY;
  if (!key) throw new Error("GOLD_API_KEY is not set");
  const to = new Date();
  const from = new Date(Date.now() - years * 365.25 * DAY_MS);

  // Frankfurter answers long ranges fine, but split by year to keep each response small.
  const fx = new Map<string, number>();
  for (let y = from.getUTCFullYear(); y <= to.getUTCFullYear(); y++) {
    const a = new Date(Math.max(from.getTime(), Date.UTC(y, 0, 1)));
    const b = new Date(Math.min(to.getTime(), Date.UTC(y, 11, 31)));
    for (const [d, r] of await frankfurterFxHistory(a, b)) fx.set(d, r);
  }
  const fxDays = [...fx.keys()].sort();
  const fxOn = (day: string): number | null => {
    // Last working-day rate on or before this day.
    let lo = 0;
    let hi = fxDays.length - 1;
    let found: string | null = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (fxDays[mid]! <= day) {
        found = fxDays[mid]!;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found ? fx.get(found)! : null;
  };

  const results: { metal: Metal; added: number }[] = [];
  for (const { value: metal } of METALS) {
    const rows = await goldApiHistory(metal, key, from, to);
    const data = rows.flatMap(([day, usdPerOz]) => {
      const rate = fxOn(day);
      return [
        {
          metal,
          day: new Date(day),
          usdPerOz,
          usdPhp: rate,
          phpPerGram: rate ? phpPerGram(usdPerOz, rate) : null,
          source: "gold-api.com history",
        },
      ];
    });
    const res = await db.priceDaily.createMany({ data, skipDuplicates: true });
    results.push({ metal, added: res.count });
  }
  return results;
}
