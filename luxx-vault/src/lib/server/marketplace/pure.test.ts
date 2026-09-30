import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, generateCode, normaliseCode, uniqueCode } from "./codes";
import { gramsLabel, itemLabel, roundToTen, timeAgo } from "./describe";
import { dhashFromGray, hammingDistance, isLikelySamePhoto } from "./dhash";
import { DEFAULT_FILTERS, activeFilterCount, parseFilters, toQuery } from "./search-params";
import { medianResponseMs, trustScore, type TrustInput } from "./trust";
import { itemPurity, median, premiumLabel, suggestedPremiumRange, valueItem } from "./valuation";

describe("codes", () => {
  it("generates prefixed five-character codes from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode("LX");
      expect(code).toMatch(/^LX-[23456789ABCDEFGHJKMNPQRSTWXYZ]{5}$/);
    }
    expect(CODE_ALPHABET).not.toMatch(/[01ILOUV]/);
  });

  it("is deterministic with an injected random source", () => {
    expect(generateCode("TR", () => 0)).toBe("TR-22222");
  });

  it("normalises what people type", () => {
    expect(normaliseCode("lx 4f7k2")).toBe("LX-4F7K2");
    expect(normaliseCode("LX4F7K2")).toBe("LX-4F7K2");
    expect(normaliseCode("wp-abcde", "WP")).toBe("WP-ABCDE");
    expect(normaliseCode("LX-4F7K2", "WP")).toBeNull();
    expect(normaliseCode("LX-4F7K0")).toBeNull(); // 0 is not in the alphabet
    expect(normaliseCode("drop table")).toBeNull();
  });

  it("retries on collision and gives up eventually", async () => {
    let calls = 0;
    const code = await uniqueCode("LX", async () => ++calls < 3);
    expect(code).toMatch(/^LX-/);
    expect(calls).toBe(3);
    await expect(uniqueCode("LX", async () => true, 2)).rejects.toThrow();
  });
});

describe("describe", () => {
  it("labels items anonymously", () => {
    expect(itemLabel({ category: "gold_jewelry", metal: "gold", karat: 18, goldType: "saudi", form: "necklace" })).toBe("18K Saudi necklace");
    expect(itemLabel({ category: "silver", metal: "silver", finenessPermille: 925, form: "bar" })).toBe("925 silver bar");
    expect(itemLabel({ category: "diamonds", form: "loose_stone" })).toBe("Loose stone");
    expect(itemLabel({ category: "mixed_lot" })).toBe("Mixed lot");
    expect(itemLabel({ category: "gold_jewelry", metal: "gold", karat: 21, goldType: "other", form: "ring" })).toBe("21K ring");
  });

  it("formats grams, time and rounding", () => {
    expect(gramsLabel(12.44)).toBe("12.4 g");
    expect(gramsLabel(250.6)).toBe("251 g");
    expect(roundToTen(7714)).toBe(7710);
    expect(roundToTen(7715)).toBe(7720);
    const now = new Date("2026-09-30T12:00:00Z");
    expect(timeAgo(new Date("2026-09-30T11:59:40Z"), now)).toBe("just now");
    expect(timeAgo(new Date("2026-09-30T11:48:00Z"), now)).toBe("12 min ago");
    expect(timeAgo(new Date("2026-09-30T10:00:00Z"), now)).toBe("2 h ago");
    expect(timeAgo(new Date("2026-09-27T12:00:00Z"), now)).toBe("3 d ago");
  });
});

describe("valuation", () => {
  const spot = { gold: 8000, silver: 100 };

  it("knows purity by karat and fineness", () => {
    expect(itemPurity({ metal: "gold", karat: 18 })).toBe(0.75);
    expect(itemPurity({ metal: "gold", karat: 24 })).toBe(0.999);
    expect(itemPurity({ metal: "silver", finenessPermille: 925 })).toBe(0.925);
    expect(itemPurity({ metal: null })).toBeNull();
    expect(itemPurity({ metal: "gold" })).toBeNull();
  });

  it("values a fixed-price 18K piece against melt", () => {
    const v = valueItem({ metal: "gold", karat: 18, weightGrams: 10, pricingMode: "fixed", pricePhp: 66_000 }, spot);
    expect(v.meltPhp).toBe(60_000);
    expect(v.pricePhp).toBe(66_000);
    expect(v.premiumPct).toBeCloseTo(10);
    expect(v.belowMelt).toBe(false);
    expect(v.live).toBe(false);
  });

  it("prices a spot-pegged listing live", () => {
    const v = valueItem({ metal: "gold", karat: 18, weightGrams: 10, pricingMode: "spot_premium", premiumPct: 8 }, spot);
    expect(v.pricePhp).toBe(64_800);
    expect(v.premiumPct).toBeCloseTo(8);
    expect(v.live).toBe(true);
    expect(valueItem({ metal: "gold", karat: 18, weightGrams: 10, pricingMode: "spot_premium", premiumPct: 8 }, {}).pricePhp).toBeNull();
  });

  it("warns when priced far below melt", () => {
    expect(valueItem({ metal: "gold", karat: 18, weightGrams: 10, pricingMode: "fixed", pricePhp: 50_000 }, spot).belowMelt).toBe(true);
    expect(valueItem({ metal: "gold", karat: 18, weightGrams: 10, pricingMode: "fixed", pricePhp: 54_000 }, spot).belowMelt).toBe(false);
  });

  it("has no melt value for stones", () => {
    const v = valueItem({ metal: null, weightGrams: 1, pricingMode: "fixed", pricePhp: 90_000 }, spot);
    expect(v.meltPhp).toBeNull();
    expect(v.premiumPct).toBeNull();
    expect(v.pricePhp).toBe(90_000);
  });

  it("computes medians and labels", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(premiumLabel(8.24)).toBe("+8.2% over melt");
    expect(premiumLabel(-12)).toBe("−12.0% under melt");
    expect(premiumLabel(0.01)).toBe("At melt");
    expect(suggestedPremiumRange("gold_bullion").high).toBeLessThan(suggestedPremiumRange("gold_jewelry").high);
  });
});

describe("search params", () => {
  it("parses and drops junk", () => {
    const f = parseFilters({
      tab: "wanted",
      q: "  saudi   chain ",
      category: "gold_jewelry",
      metal: "unobtainium",
      karat: "18",
      minG: "20",
      maxG: "10",
      minP: "₱50,000",
      region: "040000000",
      city: "045802000",
      offers: "1",
      sort: "premium",
      page: "3",
    });
    expect(f.tab).toBe("wanted");
    expect(f.q).toBe("saudi chain");
    expect(f.metal).toBeNull();
    expect(f.karat).toBe(18);
    expect([f.minGrams, f.maxGrams]).toEqual([10, 20]);
    expect(f.minPrice).toBe(50_000);
    expect(f.city).toBe("045802000");
    expect(f.offers).toBe(true);
    expect(f.sort).toBe("premium");
    expect(f.page).toBe(3);
  });

  it("ignores a city without a region and bad codes", () => {
    expect(parseFilters({ city: "045802000" }).city).toBeNull();
    expect(parseFilters({ region: "'; drop" }).region).toBeNull();
    expect(parseFilters({ karat: "19" }).karat).toBeNull();
    expect(parseFilters({ page: "-2" }).page).toBe(1);
  });

  it("round-trips through the query string, omitting defaults", () => {
    expect(toQuery(DEFAULT_FILTERS)).toBe("");
    const f = parseFilters({ q: "bar", karat: "24", sort: "price_asc", tested: "1" });
    expect(parseFilters(new URLSearchParams(toQuery(f).slice(1)))).toEqual(f);
    expect(toQuery(f, { page: 2 })).toContain("page=2");
    expect(activeFilterCount(f)).toBe(3);
  });
});

describe("trust score", () => {
  const base: TrustInput = {
    tier: 4,
    releasedTrades: 0,
    disputesLost: 0,
    disputesTotal: 0,
    accountAgeDays: 10,
    medianResponseMs: null,
    ratingAverage: null,
    ratingCount: 0,
  };

  it("calls a verified seller with no trades New", () => {
    const t = trustScore(base);
    expect(t.level).toBe("new");
    expect(t.label).toBe("New");
    expect(t.score).toBeGreaterThan(0);
    expect(t.score).toBeLessThan(40);
  });

  it("grows with trades, ratings, age and quick replies", () => {
    const t = trustScore({ ...base, releasedTrades: 30, accountAgeDays: 400, medianResponseMs: 20 * 60_000, ratingAverage: 4.9, ratingCount: 25 });
    expect(t.score).toBeGreaterThanOrEqual(80);
    expect(t.level).toBe("top");
    expect(t.parts.reduce((s, p) => s + p.max, 0)).toBe(100);
  });

  it("is dented by lost disputes and never leaves 0–100", () => {
    const good = trustScore({ ...base, releasedTrades: 5, ratingAverage: 5, ratingCount: 5 });
    const disputed = trustScore({ ...base, releasedTrades: 5, ratingAverage: 5, ratingCount: 5, disputesLost: 2, disputesTotal: 3 });
    expect(disputed.score).toBeLessThan(good.score);
    expect(trustScore({ ...base, tier: 0, disputesLost: 10, disputesTotal: 10 }).score).toBe(0);
    expect(trustScore({ ...base, releasedTrades: 1000, accountAgeDays: 9999, medianResponseMs: 1, ratingAverage: 5, ratingCount: 999 }).score).toBe(100);
  });

  it("labels the middle bands", () => {
    expect(trustScore({ ...base, releasedTrades: 2 }).level).toBe("building");
    expect(trustScore({ ...base, releasedTrades: 8, accountAgeDays: 200, ratingAverage: 4.6, ratingCount: 6 }).level).toBe("trusted");
  });

  it("measures median first-reply time", () => {
    const at = (min: number) => new Date(Date.UTC(2026, 8, 1, 0, min));
    const convo = (replyAfter: number) => [
      { senderId: "buyer", kind: "user", createdAt: at(0) },
      { senderId: "buyer", kind: "user", createdAt: at(1) },
      { senderId: null, kind: "system", createdAt: at(2) },
      { senderId: "me", kind: "user", createdAt: at(replyAfter) },
    ];
    expect(medianResponseMs([convo(10), convo(30)], "me")).toBeNull(); // too few
    expect(medianResponseMs([convo(10), convo(30), convo(60)], "me")).toBe(30 * 60_000);
  });
});

describe("dHash", () => {
  const gradient = Array.from({ length: 72 }, (_, i) => (i % 9) * 20); // brightens left to right
  it("hashes a 9×8 image to 16 hex characters", () => {
    expect(dhashFromGray(gradient)).toBe("0000000000000000");
    const reversed = gradient.map((v) => 255 - v);
    expect(dhashFromGray(reversed)).toBe("ffffffffffffffff");
    expect(() => dhashFromGray([1, 2, 3])).toThrow();
  });

  it("measures Hamming distance", () => {
    expect(hammingDistance("0000000000000000", "ffffffffffffffff")).toBe(64);
    expect(hammingDistance("00000000000000ff", "0000000000000000")).toBe(8);
    expect(hammingDistance("a1b2c3d4e5f60718", "a1b2c3d4e5f60718")).toBe(0);
    expect(isLikelySamePhoto("0000000000000000", "000000000000003f")).toBe(true); // 6 bits
    expect(isLikelySamePhoto("0000000000000000", "000000000000007f")).toBe(false); // 7 bits
    expect(() => hammingDistance("zz", "00")).toThrow();
  });
});
