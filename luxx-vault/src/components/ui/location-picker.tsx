"use client";

import { useEffect, useMemo, useState } from "react";
import type { City, Province, Region } from "@/lib/locations";
import { Field, Select } from "./field";

type Data = { regions: Region[]; provinces: Province[]; cities: City[] };
let cache: Promise<Data> | null = null;
// ~140 KB of PSGC data: loaded only when a picker is on screen.
const load = () => (cache ??= import("@/content/ph-locations.json").then((m) => m.default as Data));

/**
 * Region → province → city/municipality, from the official PSGC list.
 * Submits `regionCode`, `provinceCode` and `cityCode` (names configurable).
 * NCR has no provinces, so its cities follow the region directly.
 */
export function LocationPicker({
  defaultRegion = "",
  defaultProvince = "",
  defaultCity = "",
  requireCity = true,
  names = { region: "regionCode", province: "provinceCode", city: "cityCode" },
  errors,
}: {
  defaultRegion?: string;
  defaultProvince?: string;
  defaultCity?: string;
  requireCity?: boolean;
  names?: { region: string; province: string; city: string };
  errors?: { region?: string; city?: string };
}) {
  const [data, setData] = useState<Data | null>(null);
  const [region, setRegion] = useState(defaultRegion);
  const [province, setProvince] = useState(defaultProvince);
  const [city, setCity] = useState(defaultCity);

  useEffect(() => {
    let live = true;
    void load().then((d) => live && setData(d));
    return () => {
      live = false;
    };
  }, []);

  const provinces = useMemo(() => data?.provinces.filter((p) => p.region === region) ?? [], [data, region]);
  const hasProvinces = provinces.length > 0;
  const cities = useMemo(
    () => data?.cities.filter((c) => c.region === region && (!hasProvinces || c.province === province)) ?? [],
    [data, region, province, hasProvinces],
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Region" error={errors?.region}>
        {(p) => (
          <Select
            {...p}
            name={names.region}
            required
            value={region}
            disabled={!data}
            onChange={(e) => {
              setRegion(e.target.value);
              setProvince("");
              setCity("");
            }}
          >
            <option value="">{data ? "Select region" : "Loading…"}</option>
            {data?.regions.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {hasProvinces ? (
        <Field label="Province">
          {(p) => (
            <Select
              {...p}
              name={names.province}
              required
              value={province}
              onChange={(e) => {
                setProvince(e.target.value);
                setCity("");
              }}
            >
              <option value="">Select province</option>
              {provinces.map((pr) => (
                <option key={pr.code} value={pr.code}>
                  {pr.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : (
        <input type="hidden" name={names.province} value="" />
      )}

      <Field label={requireCity ? "City or municipality" : "City or municipality (optional)"} error={errors?.city}>
        {(p) => (
          <Select
            {...p}
            name={names.city}
            required={requireCity}
            value={city}
            disabled={!region || (hasProvinces && !province)}
            onChange={(e) => setCity(e.target.value)}
          >
            <option value="">{!region ? "Choose a region first" : hasProvinces && !province ? "Choose a province first" : "Select city"}</option>
            {cities.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </div>
  );
}
