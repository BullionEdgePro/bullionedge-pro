/**
 * Philippine regions, provinces and cities/municipalities (PSGC), from
 * src/content/ph-locations.json (`npm run build:locations`).
 *
 * The JSON is ~140 KB: server code imports this module directly; client
 * components should use <LocationPicker>, which loads it on demand.
 */
import data from "@/content/ph-locations.json";

export type Region = { code: string; name: string };
export type Province = { code: string; name: string; region: string };
export type City = { code: string; name: string; province: string | null; region: string };

export const REGIONS: Region[] = data.regions;
export const PROVINCES: Province[] = data.provinces;
export const CITIES: City[] = data.cities;

const regionByCode = new Map(REGIONS.map((r) => [r.code, r]));
const provinceByCode = new Map(PROVINCES.map((p) => [p.code, p]));
const cityByCode = new Map(CITIES.map((c) => [c.code, c]));

export const regionName = (code: string | null | undefined) => (code ? (regionByCode.get(code)?.name ?? "") : "");
export const provinceName = (code: string | null | undefined) => (code ? (provinceByCode.get(code)?.name ?? "") : "");
export const cityName = (code: string | null | undefined) => (code ? (cityByCode.get(code)?.name ?? "") : "");

/** Short region label, e.g. "CALABARZON" from "CALABARZON (Region IV-A)". */
export const regionShort = (code: string | null | undefined) => regionName(code).replace(/\s*\(.*\)$/, "");

/** "City of Antipolo, Rizal" — the public place label (never a street address). */
export function placeLabel(cityCode: string | null | undefined, regionCode?: string | null): string {
  const city = cityCode ? cityByCode.get(cityCode) : undefined;
  if (city) {
    const where = city.province ? provinceName(city.province) : regionShort(city.region);
    return where ? `${city.name}, ${where}` : city.name;
  }
  return regionShort(regionCode);
}

export function isValidLocation(regionCode: string, cityCode?: string | null, provinceCode?: string | null): boolean {
  if (!regionByCode.has(regionCode)) return false;
  if (provinceCode && provinceByCode.get(provinceCode)?.region !== regionCode) return false;
  if (cityCode) {
    const c = cityByCode.get(cityCode);
    if (!c || c.region !== regionCode) return false;
    if (provinceCode && c.province !== provinceCode) return false;
  }
  return true;
}
