/**
 * Marketplace filters live in the URL, so every view is shareable. This module
 * turns untrusted search params into a clean, typed filter set and back.
 * Pure: used by the server page and the client filter bar alike.
 */
import { CATEGORY_VALUES, FORMS, GOLD_KARATS, GOLD_TYPES, METAL_VALUES } from "@/config/catalog";

export const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price, low to high" },
  { value: "price_desc", label: "Price, high to low" },
  { value: "premium", label: "Lowest premium over melt" },
  { value: "trust", label: "Seller trust" },
] as const;
export type Sort = (typeof SORTS)[number]["value"];

export type Tab = "sale" | "wanted";

export type MarketFilters = {
  tab: Tab;
  q: string;
  category: string | null;
  metal: string | null;
  karat: number | null;
  goldType: string | null;
  form: string | null;
  minGrams: number | null;
  maxGrams: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  region: string | null;
  city: string | null;
  offers: boolean;
  tested: boolean;
  sort: Sort;
  page: number;
};

export const DEFAULT_FILTERS: MarketFilters = {
  tab: "sale",
  q: "",
  category: null,
  metal: null,
  karat: null,
  goldType: null,
  form: null,
  minGrams: null,
  maxGrams: null,
  minPrice: null,
  maxPrice: null,
  region: null,
  city: null,
  offers: false,
  tested: false,
  sort: "newest",
  page: 1,
};

export const PAGE_SIZE = 24;

type Raw = Record<string, string | string[] | undefined> | URLSearchParams;

function get(raw: Raw, key: string): string | undefined {
  if (raw instanceof URLSearchParams) return raw.get(key) ?? undefined;
  const v = raw[key];
  return Array.isArray(v) ? v[0] : v;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function positive(value: string | undefined, max: number): number | null {
  if (!value) return null;
  const n = Number(value.replace(/[,₱\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : null;
}

/** PSGC codes are 9–10 digits. Anything else is dropped rather than sent to the database. */
function psgc(value: string | undefined): string | null {
  return value && /^\d{9,10}$/.test(value) ? value : null;
}

export function parseFilters(raw: Raw): MarketFilters {
  const karatN = Number(get(raw, "karat"));
  const karat = GOLD_KARATS.some((k) => k.karat === karatN) ? karatN : null;
  let minGrams = positive(get(raw, "minG"), 100_000);
  let maxGrams = positive(get(raw, "maxG"), 100_000);
  if (minGrams !== null && maxGrams !== null && minGrams > maxGrams) [minGrams, maxGrams] = [maxGrams, minGrams];
  let minPrice = positive(get(raw, "minP"), 1_000_000_000);
  let maxPrice = positive(get(raw, "maxP"), 1_000_000_000);
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) [minPrice, maxPrice] = [maxPrice, minPrice];
  const page = Math.floor(Number(get(raw, "page")));
  const region = psgc(get(raw, "region"));
  return {
    tab: get(raw, "tab") === "wanted" ? "wanted" : "sale",
    q: (get(raw, "q") ?? "").trim().replace(/\s+/g, " ").slice(0, 80),
    category: oneOf(get(raw, "category"), CATEGORY_VALUES),
    metal: oneOf(get(raw, "metal"), METAL_VALUES),
    karat,
    goldType: oneOf(get(raw, "goldType"), GOLD_TYPES.map((g) => g.value)),
    form: oneOf(get(raw, "form"), FORMS.map((f) => f.value)),
    minGrams,
    maxGrams,
    minPrice,
    maxPrice,
    region,
    city: region ? psgc(get(raw, "city")) : null,
    offers: get(raw, "offers") === "1",
    tested: get(raw, "tested") === "1",
    sort: oneOf(get(raw, "sort"), SORTS.map((s) => s.value)) ?? "newest",
    page: Number.isFinite(page) && page > 1 ? Math.min(page, 500) : 1,
  };
}

/** Back to a query string, omitting defaults, so URLs stay short and canonical. */
export function toQuery(f: MarketFilters, overrides: Partial<MarketFilters> = {}): string {
  const v = { ...f, ...overrides };
  const p = new URLSearchParams();
  if (v.tab !== "sale") p.set("tab", v.tab);
  if (v.q) p.set("q", v.q);
  if (v.category) p.set("category", v.category);
  if (v.metal) p.set("metal", v.metal);
  if (v.karat) p.set("karat", String(v.karat));
  if (v.goldType) p.set("goldType", v.goldType);
  if (v.form) p.set("form", v.form);
  if (v.minGrams !== null) p.set("minG", String(v.minGrams));
  if (v.maxGrams !== null) p.set("maxG", String(v.maxGrams));
  if (v.minPrice !== null) p.set("minP", String(v.minPrice));
  if (v.maxPrice !== null) p.set("maxP", String(v.maxPrice));
  if (v.region) p.set("region", v.region);
  if (v.region && v.city) p.set("city", v.city);
  if (v.offers) p.set("offers", "1");
  if (v.tested) p.set("tested", "1");
  if (v.sort !== "newest") p.set("sort", v.sort);
  if (v.page > 1) p.set("page", String(v.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** How many filters beyond tab/sort/page are active (for the "Filters (3)" button). */
export function activeFilterCount(f: MarketFilters): number {
  return [
    f.q,
    f.category,
    f.metal,
    f.karat,
    f.goldType,
    f.form,
    f.minGrams ?? f.maxGrams,
    f.minPrice ?? f.maxPrice,
    f.region,
    f.offers || null,
    f.tested || null,
  ].filter((x) => x !== null && x !== "" && x !== undefined).length;
}
