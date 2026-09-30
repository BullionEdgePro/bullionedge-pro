import { describe, expect, it } from "vitest";
import {
  isMetalsMarketClosed,
  meltValuePhp,
  premiumOverMeltPct,
  purityFromKarat,
  purityFromPermille,
  purityFromSpecificGravity,
  toGrams,
} from "./market";

describe("purity", () => {
  it("uses the market fineness table for karats", () => {
    expect(purityFromKarat(24)).toBe(0.999);
    expect(purityFromKarat(22)).toBe(0.916);
    expect(purityFromKarat(21)).toBe(0.875);
    expect(purityFromKarat(18)).toBe(0.75);
    expect(purityFromKarat(6)).toBe(0.25);
  });
  it("falls back to karat/24 for unusual karats, capped at .999", () => {
    expect(purityFromKarat(12)).toBeCloseTo(0.5);
    expect(purityFromKarat(30)).toBe(0.999);
  });
  it("reads fineness in parts per thousand", () => {
    expect(purityFromPermille(925)).toBe(0.925);
  });
});

describe("melt value", () => {
  it("is price × grams × purity", () => {
    expect(meltValuePhp(8000, 10, 0.75)).toBe(60_000);
  });
  it("is zero for missing or invalid inputs", () => {
    expect(meltValuePhp(0, 10, 0.75)).toBe(0);
    expect(meltValuePhp(8000, -1, 0.75)).toBe(0);
    expect(meltValuePhp(Number.NaN, 10, 0.75)).toBe(0);
  });
  it("reports premium over melt in percent", () => {
    expect(premiumOverMeltPct(110, 100)).toBeCloseTo(10);
    expect(premiumOverMeltPct(80, 100)).toBeCloseTo(-20);
    expect(premiumOverMeltPct(100, 0)).toBeNull();
  });
});

describe("specific gravity", () => {
  it("reads pure gold as ~.999 and a base-metal density as nothing", () => {
    expect(purityFromSpecificGravity(19.32)).toBeCloseTo(0.999, 2);
    expect(purityFromSpecificGravity(10.5)).toBeNull();
    expect(purityFromSpecificGravity(8.9)).toBeNull();
  });
  it("puts typical 18K and 14K readings in the right neighbourhood", () => {
    // 18K yellow gold is usually 15.2–15.9; 14K 12.9–14.6.
    expect(purityFromSpecificGravity(15.5)!).toBeGreaterThan(0.68);
    expect(purityFromSpecificGravity(15.5)!).toBeLessThan(0.82);
    expect(purityFromSpecificGravity(13.4)!).toBeGreaterThan(0.45);
    expect(purityFromSpecificGravity(13.4)!).toBeLessThan(0.65);
  });
  it("rejects readings above pure gold", () => {
    expect(purityFromSpecificGravity(21)).toBeNull();
  });
});

describe("units", () => {
  it("converts to grams", () => {
    expect(toGrams(1, "ozt")).toBeCloseTo(31.1035);
    expect(toGrams(2, "kg")).toBe(2000);
    expect(toGrams(1, "tola")).toBeCloseTo(11.6638);
    expect(toGrams(1, "tael")).toBeCloseTo(37.429);
    expect(toGrams(5, "g")).toBe(5);
  });
});

describe("market hours", () => {
  const utc = (iso: string) => new Date(`${iso}Z`);
  it("is closed from Friday 22:00 to Sunday 23:00 UTC", () => {
    expect(isMetalsMarketClosed(utc("2026-10-02T21:59:00"))).toBe(false); // Fri
    expect(isMetalsMarketClosed(utc("2026-10-02T22:00:00"))).toBe(true); // Fri close
    expect(isMetalsMarketClosed(utc("2026-10-03T12:00:00"))).toBe(true); // Sat
    expect(isMetalsMarketClosed(utc("2026-10-04T22:59:00"))).toBe(true); // Sun before open
    expect(isMetalsMarketClosed(utc("2026-10-04T23:00:00"))).toBe(false); // Sun open
    expect(isMetalsMarketClosed(utc("2026-09-30T10:00:00"))).toBe(false); // Wed
  });
});
