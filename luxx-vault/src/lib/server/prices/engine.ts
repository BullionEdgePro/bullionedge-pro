import "server-only";
import { after } from "next/server";
import { METALS, type Metal } from "@/config/catalog";
import { STALE_AFTER_MS, isMetalsMarketClosed, type Market, type MetalPrice } from "@/lib/market";
import { phpPerGram } from "@/lib/pricing";
import { db } from "../db";
import { env } from "../env";
import { frankfurterFx, goldApiSpot, metalsDevSpot, openErApiFx, type FxQuote, type MetalQuote } from "./sources";

/**
 * The live price engine (brief §10).
 *
 * Reads the latest snapshot per metal from the database and, when it is older
 * than a minute, asks the sources again. There is no always-on timer: traffic
 * (and the daily cron) drives refreshes, which suits serverless hosting. A
 * price that can't be refreshed is still shown, but the market is marked
 * `delayed` so the UI never presents an old number as live.
 */

const FRESH_MS = 60_000;
/** A move larger than this within two hours is treated as a bad feed and ignored. */
const MAX_JUMP = 0.08;
/** Two FX sources that disagree by more than this are reported in the notes. */
const FX_DIVERGENCE = 0.015;

const METAL_KEYS = METALS.map((m) => m.value);

type Snapshot = Awaited<ReturnType<typeof latestSnapshots>>[number];

async function latestSnapshots() {
  return Promise.all(
    METAL_KEYS.map((metal) => db.priceSnapshot.findFirst({ where: { metal }, orderBy: { createdAt: "desc" } })),
  );
}

let inflight: Promise<string[]> | null = null;

/** Refresh once per process at a time; concurrent callers share the same attempt. */
function refreshOnce(): Promise<string[]> {
  inflight ??= refresh().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function pickFx(previous: Snapshot | undefined): Promise<{ fx: FxQuote | null; notes: string[] }> {
  const [a, b] = await Promise.allSettled([openErApiFx(), frankfurterFx()]);
  const notes: string[] = [];
  const primary = a.status === "fulfilled" ? a.value : null;
  const secondary = b.status === "fulfilled" ? b.value : null;
  if (primary && secondary && Math.abs(primary.usdPhp - secondary.usdPhp) / secondary.usdPhp > FX_DIVERGENCE) {
    notes.push(`USD/PHP sources disagree (${primary.usdPhp.toFixed(3)} vs ${secondary.usdPhp.toFixed(3)}); showing ${primary.source}.`);
  }
  if (primary) return { fx: primary, notes };
  if (secondary) return { fx: { ...secondary }, notes: [...notes, `USD/PHP from ${secondary.source} (primary unavailable).`] };
  // Exchange rates move slowly and both sources publish daily; a rate from the last day is still honest.
  if (previous && Date.now() - previous.createdAt.getTime() < 24 * 3600_000) {
    return {
      fx: { usdPhp: Number(previous.usdPhp), observedAt: previous.createdAt, source: previous.fxSource },
      notes: ["USD/PHP sources unavailable; using the last rate from the past 24 hours."],
    };
  }
  return { fx: null, notes: ["USD/PHP sources unavailable."] };
}

async function refresh(): Promise<string[]> {
  const previous = await latestSnapshots();
  const byMetal = new Map(previous.flatMap((s) => (s ? [[s.metal, s] as const] : [])));
  const notes: string[] = [];

  const [spot, fxPick] = await Promise.all([
    Promise.allSettled(METAL_KEYS.map((m) => goldApiSpot(m))),
    pickFx(previous.find(Boolean) ?? undefined),
  ]);
  notes.push(...fxPick.notes);
  const fx = fxPick.fx;
  if (!fx) return notes;

  const quotes = new Map<Metal, MetalQuote>();
  spot.forEach((r, i) => {
    if (r.status === "fulfilled") quotes.set(METAL_KEYS[i]!, r.value);
  });

  const missing = METAL_KEYS.filter((m) => !quotes.has(m));
  const key = env().METALS_DEV_API_KEY;
  if (missing.length && key) {
    try {
      for (const q of await metalsDevSpot(key)) if (missing.includes(q.metal)) quotes.set(q.metal, q);
      notes.push(`Failover to metals.dev for ${missing.join(", ")}.`);
    } catch {
      notes.push("Backup price source unavailable.");
    }
  }

  const rows = [];
  for (const [metal, q] of quotes) {
    const last = byMetal.get(metal);
    if (last && Date.now() - last.createdAt.getTime() < 2 * 3600_000) {
      const jump = Math.abs(q.usdPerOz - Number(last.usdPerOz)) / Number(last.usdPerOz);
      if (jump > MAX_JUMP) {
        notes.push(`Ignored a ${(jump * 100).toFixed(1)}% jump in ${metal} from ${q.source}; waiting for confirmation.`);
        continue;
      }
    }
    rows.push({
      metal,
      usdPerOz: q.usdPerOz,
      usdPhp: fx.usdPhp,
      phpPerGram: phpPerGram(q.usdPerOz, fx.usdPhp),
      source: q.source,
      fxSource: fx.source,
      observedAt: q.observedAt,
    });
  }
  if (!rows.length) return notes;

  await db.priceSnapshot.createMany({ data: rows });
  // Keep today's close current, so charts and the performance table include today.
  const day = new Date(new Date().toISOString().slice(0, 10));
  await Promise.all(
    rows.map((r) =>
      db.priceDaily.upsert({
        where: { metal_day: { metal: r.metal, day } },
        create: { metal: r.metal, day, usdPerOz: r.usdPerOz, usdPhp: r.usdPhp, phpPerGram: r.phpPerGram, source: "snapshots" },
        update: { usdPerOz: r.usdPerOz, usdPhp: r.usdPhp, phpPerGram: r.phpPerGram },
      }),
    ),
  );
  afterRefreshHooks.forEach((hook) => void hook().catch(() => {}));
  return notes;
}

/**
 * Work that should run after new prices land (price alerts). Kept on globalThis:
 * the bundler can load this module more than once (route handlers, instrumentation),
 * and a hook registered on one copy must fire for refreshes made by any other.
 */
const hookStore = globalThis as unknown as { __luxxPriceHooks?: (() => Promise<void>)[] };
const afterRefreshHooks = (hookStore.__luxxPriceHooks ??= []);
export function onPricesRefreshed(hook: () => Promise<void>) {
  afterRefreshHooks.push(hook);
}

async function change24h(metal: Metal, current: number): Promise<number | null> {
  const dayAgo = await db.priceSnapshot.findFirst({
    where: { metal, createdAt: { lte: new Date(Date.now() - 24 * 3600_000) } },
    orderBy: { createdAt: "desc" },
    select: { phpPerGram: true, createdAt: true },
  });
  // A "24h" figure from a week-old reading would mislead; require one from the last 30 hours.
  if (dayAgo && Date.now() - dayAgo.createdAt.getTime() < 30 * 3600_000) {
    return ((current - Number(dayAgo.phpPerGram)) / Number(dayAgo.phpPerGram)) * 100;
  }
  const yesterday = await db.priceDaily.findFirst({
    where: { metal, day: { lt: new Date(new Date().toISOString().slice(0, 10)) }, phpPerGram: { not: null } },
    orderBy: { day: "desc" },
  });
  if (yesterday?.phpPerGram && Date.now() - yesterday.day.getTime() < 3 * 24 * 3600_000) {
    return ((current - Number(yesterday.phpPerGram)) / Number(yesterday.phpPerGram)) * 100;
  }
  return null;
}

/** The current market, refreshing from the sources when the stored prices are over a minute old. */
export async function getMarket(options: { refresh?: boolean; wait?: boolean } = {}): Promise<Market> {
  let latest = await latestSnapshots();
  const newest = Math.max(0, ...latest.map((s) => s?.createdAt.getTime() ?? 0));
  let notes: string[] = [];
  const due = Date.now() - newest > FRESH_MS || latest.some((s) => !s);
  // Stale-while-revalidate (performance pass, 1 Oct 2026): prices up to 10 minutes old are
  // served at once and refreshed after the response, so no page waits on the price APIs.
  // Older or missing prices (or `wait`, for the cron) still refresh before answering.
  const serveNow = !options.wait && latest.every(Boolean) && Date.now() - newest < STALE_AFTER_MS;
  if (options.refresh !== false && due && serveNow) {
    const work = () => refreshOnce().then(() => undefined, () => undefined);
    try {
      after(work);
    } catch {
      void work(); // outside a request (scripts): just start it
    }
  } else if (options.refresh !== false && due) {
    try {
      notes = await refreshOnce();
      latest = await latestSnapshots();
    } catch (err) {
      notes.push(`Price sources unavailable (${err instanceof Error ? err.message : "unknown error"}).`);
    }
  }

  const metals = {} as Record<Metal, MetalPrice | null>;
  await Promise.all(
    METAL_KEYS.map(async (metal, i) => {
      const s = latest[i];
      if (!s) {
        metals[metal] = null;
        return;
      }
      const php = Number(s.phpPerGram);
      metals[metal] = {
        metal,
        usdPerOz: Number(s.usdPerOz),
        phpPerGram: php,
        observedAt: s.observedAt.toISOString(),
        source: s.source,
        change24hPct: await change24h(metal, php),
      };
    }),
  );

  const any = latest.find(Boolean);
  // Delayed if we couldn't reach a source recently, or (on a trading day) a source stopped updating.
  const lastChecked = Math.max(0, ...latest.map((s) => s?.createdAt.getTime() ?? 0));
  const oldestObserved = Math.min(...latest.map((s) => s?.observedAt.getTime() ?? 0));
  const marketClosed = isMetalsMarketClosed();
  const delayed =
    !any || Date.now() - lastChecked > STALE_AFTER_MS || (!marketClosed && Date.now() - oldestObserved > STALE_AFTER_MS * 6);

  return {
    metals,
    usdPhp: any ? Number(any.usdPhp) : null,
    fxSource: any?.fxSource ?? null,
    checkedAt: new Date(lastChecked || Date.now()).toISOString(),
    delayed,
    marketClosed,
    notes,
  };
}
