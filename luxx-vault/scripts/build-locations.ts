/**
 * Builds src/content/ph-locations.json from the Philippine Standard Geographic
 * Code (PSGC) published at psgc.gitlab.io: 17 regions, their provinces, and
 * every city and municipality. Run with `npm run build:locations` when the
 * PSA publishes an update; the output is committed so the site never calls
 * the API at runtime.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

const API = "https://psgc.gitlab.io/api";

type Region = { code: string; name: string; regionName: string };
type Province = { code: string; name: string; regionCode: string };
type City = {
  code: string;
  name: string;
  isCity: boolean;
  provinceCode: string | false;
  districtCode: string | false;
  regionCode: string;
};

async function get<T>(file: string): Promise<T> {
  const res = await fetch(`${API}/${file}.json`);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "en");

async function main() {
  const [regions, provinces, cities] = await Promise.all([
    get<Region[]>("regions"),
    get<Province[]>("provinces"),
    get<City[]>("cities-municipalities"),
  ]);
  if (regions.length < 17 || provinces.length < 80 || cities.length < 1600) {
    throw new Error(`Unexpectedly small PSGC data: ${regions.length} regions, ${provinces.length} provinces, ${cities.length} cities`);
  }

  const out = {
    source: "Philippine Standard Geographic Code via psgc.gitlab.io",
    generatedAt: new Date().toISOString().slice(0, 10),
    // "Region IV-A (CALABARZON)" reads better than either field alone.
    regions: regions
      .map((r) => ({ code: r.code, name: r.regionName === r.name ? r.name : `${r.name} (${r.regionName})` }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    provinces: provinces.map((p) => ({ code: p.code, name: p.name, region: p.regionCode })).sort(byName),
    // NCR cities have no province; they are listed under the region directly.
    cities: cities
      .map((c) => ({
        code: c.code,
        name: c.isCity && !/city/i.test(c.name) ? `${c.name} City` : c.name,
        province: c.provinceCode || null,
        region: c.regionCode,
      }))
      .sort(byName),
  };

  const file = path.join(process.cwd(), "src/content/ph-locations.json");
  await writeFile(file, JSON.stringify(out));
  console.log(`✓ ${out.regions.length} regions, ${out.provinces.length} provinces, ${out.cities.length} cities → ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
