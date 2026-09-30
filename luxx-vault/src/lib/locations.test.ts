import { describe, expect, it } from "vitest";
import { CITIES, PROVINCES, REGIONS, isValidLocation, placeLabel, regionShort } from "./locations";

const ANTIPOLO = "045802000";
const RIZAL = "045800000";
const CALABARZON = "040000000";
const NCR = "130000000";

describe("PSGC data", () => {
  it("has every region, province and city", () => {
    expect(REGIONS).toHaveLength(17);
    expect(PROVINCES.length).toBeGreaterThanOrEqual(80);
    expect(CITIES.length).toBeGreaterThanOrEqual(1600);
  });
  it("gives NCR cities no province", () => {
    const makati = CITIES.find((c) => c.name === "City of Makati");
    expect(makati?.region).toBe(NCR);
    expect(makati?.province).toBeNull();
  });
});

describe("place labels", () => {
  it("names city and province", () => {
    expect(placeLabel(ANTIPOLO)).toBe("City of Antipolo, Rizal");
  });
  it("names NCR cities with the region", () => {
    const makati = CITIES.find((c) => c.name === "City of Makati")!;
    expect(placeLabel(makati.code)).toBe("City of Makati, NCR");
  });
  it("falls back to the region's short name", () => {
    expect(placeLabel(null, CALABARZON)).toBe("CALABARZON");
    expect(regionShort(CALABARZON)).toBe("CALABARZON");
  });
});

describe("location validation", () => {
  it("accepts a consistent region, province and city", () => {
    expect(isValidLocation(CALABARZON, ANTIPOLO, RIZAL)).toBe(true);
    expect(isValidLocation(CALABARZON, ANTIPOLO)).toBe(true);
  });
  it("rejects mismatches and unknown codes", () => {
    expect(isValidLocation(NCR, ANTIPOLO)).toBe(false);
    expect(isValidLocation("999999999")).toBe(false);
    expect(isValidLocation(CALABARZON, "000000000")).toBe(false);
  });
});
