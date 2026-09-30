"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { CATEGORIES, FORMS, GOLD_KARATS, GOLD_TYPES, METALS } from "@/config/catalog";
import { cn } from "@/lib/cn";
import type { City, Province, Region } from "@/lib/locations";
import { SORTS, activeFilterCount, parseFilters, toQuery, type MarketFilters } from "@/lib/server/marketplace/search-params";

type Places = { regions: Region[]; provinces: Province[]; cities: City[] };
let placesCache: Promise<Places> | null = null;
const loadPlaces = () => (placesCache ??= import("@/content/ph-locations.json").then((m) => m.default as Places));

const label = "mb-1.5 block text-xs font-semibold tracking-wide text-muted";
const small = "h-10 text-sm";

/**
 * Search, filters and sort for /marketplace, all mirrored in the URL so any
 * view can be shared. Works as a plain GET form without JavaScript; with it,
 * changes apply as you make them.
 */
export function FilterBar({ filters, total }: { filters: MarketFilters; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [places, setPlaces] = useState<Places | null>(null);
  const [region, setRegion] = useState(filters.region ?? "");
  const [city, setCity] = useState(filters.city ?? "");
  const count = activeFilterCount(filters);

  useEffect(() => {
    let live = true;
    void loadPlaces().then((d) => live && setPlaces(d));
    return () => {
      live = false;
    };
  }, []);

  const cities = useMemo(() => {
    if (!places || !region) return [];
    const provinceName = new Map(places.provinces.map((p) => [p.code, p.name]));
    return places.cities
      .filter((c) => c.region === region)
      .map((c) => ({ code: c.code, name: c.province ? `${c.name}, ${provinceName.get(c.province) ?? ""}` : c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [places, region]);

  const apply = (e?: FormEvent) => {
    e?.preventDefault();
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const raw: Record<string, string> = {};
    data.forEach((v, k) => {
      if (typeof v === "string" && v !== "") raw[k] = v;
    });
    const next = parseFilters(raw);
    start(() => router.push(`${pathname}${toQuery(next, { page: 1 })}`, { scroll: false }));
  };
  const autoApply = () => queueMicrotask(() => apply());

  const isSale = filters.tab === "sale";

  return (
    <form ref={formRef} action={pathname} method="get" onSubmit={apply} className="grid gap-4" aria-busy={pending || undefined}>
      <input type="hidden" name="tab" value={filters.tab} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="mk-q" className="sr-only">
            Search {isSale ? "listings" : "wanted posts"}
          </label>
          <Input
            id="mk-q"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder={isSale ? "Search: 18K Saudi chain, bar, LX-4F7K2, seller…" : "Search wanted posts"}
            className="pl-10"
            enterKeyHint="search"
          />
        </div>
        <div className="flex gap-3">
          <label htmlFor="mk-sort" className="sr-only">
            Sort
          </label>
          <Select id="mk-sort" name="sort" defaultValue={filters.sort} onChange={autoApply} className="sm:w-60">
            {SORTS.filter((s) => isSale || s.value === "newest" || s.value === "price_asc" || s.value === "price_desc").map((s) => (
              <option key={s.value} value={s.value}>
                {isSale ? s.label : s.value === "newest" ? "Newest" : s.value === "price_asc" ? "Budget, low to high" : "Budget, high to low"}
              </option>
            ))}
          </Select>
          <Button type="button" variant="secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mk-filters" className="shrink-0 lg:hidden">
            <SlidersHorizontal aria-hidden /> Filters{count ? ` (${count})` : ""}
          </Button>
        </div>
      </div>

      <div id="mk-filters" className={cn("grid gap-4 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid lg:grid-cols-4", open ? "grid" : "hidden")}>
        <div>
          <label htmlFor="mk-category" className={label}>
            Category
          </label>
          <Select id="mk-category" name="category" defaultValue={filters.category ?? ""} onChange={autoApply} className={small}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="mk-metal" className={label}>
            Metal
          </label>
          <Select id="mk-metal" name="metal" defaultValue={filters.metal ?? ""} onChange={autoApply} className={small}>
            <option value="">Any metal</option>
            {METALS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="mk-karat" className={label}>
            Karat
          </label>
          <Select id="mk-karat" name="karat" defaultValue={filters.karat ? String(filters.karat) : ""} onChange={autoApply} className={small}>
            <option value="">Any karat</option>
            {GOLD_KARATS.map((k) => (
              <option key={k.karat} value={k.karat}>
                {k.karat}K ({k.permille})
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="mk-goldType" className={label}>
            Gold type
          </label>
          <Select id="mk-goldType" name="goldType" defaultValue={filters.goldType ?? ""} onChange={autoApply} className={small}>
            <option value="">Any origin</option>
            {GOLD_TYPES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="mk-form" className={label}>
            Form
          </label>
          <Select id="mk-form" name="form" defaultValue={filters.form ?? ""} onChange={autoApply} className={small}>
            <option value="">Any form</option>
            {FORMS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
        <fieldset>
          <legend className={label}>Weight (grams)</legend>
          <div className="flex items-center gap-2">
            <Input name="minG" inputMode="decimal" aria-label="Minimum grams" placeholder="Min" defaultValue={filters.minGrams ?? ""} onBlur={autoApply} className={small} />
            <span className="text-muted">–</span>
            <Input name="maxG" inputMode="decimal" aria-label="Maximum grams" placeholder="Max" defaultValue={filters.maxGrams ?? ""} onBlur={autoApply} className={small} />
          </div>
        </fieldset>
        <fieldset>
          <legend className={label}>{isSale ? "Price (₱)" : "Budget (₱)"}</legend>
          <div className="flex items-center gap-2">
            <Input name="minP" inputMode="numeric" aria-label="Minimum price in pesos" placeholder="Min" defaultValue={filters.minPrice ?? ""} onBlur={autoApply} className={small} />
            <span className="text-muted">–</span>
            <Input name="maxP" inputMode="numeric" aria-label="Maximum price in pesos" placeholder="Max" defaultValue={filters.maxPrice ?? ""} onBlur={autoApply} className={small} />
          </div>
        </fieldset>
        <div className="grid gap-2">
          <div>
            <label htmlFor="mk-region" className={label}>
              Region
            </label>
            <Select
              id="mk-region"
              name="region"
              value={region}
              disabled={!places}
              onChange={(e) => {
                setRegion(e.target.value);
                setCity("");
                autoApply();
              }}
              className={small}
            >
              <option value="">{places ? "All regions" : "Loading…"}</option>
              {places?.regions.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </Select>
          </div>
          {region && (
            <div>
              <label htmlFor="mk-city" className={label}>
                City or municipality
              </label>
              <Select
                id="mk-city"
                name="city"
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  autoApply();
                }}
                className={small}
              >
                <option value="">Anywhere in the region</option>
                {cities.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
        {isSale && (
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
            {[
              { name: "offers", label: "Open to offers", on: filters.offers },
              { name: "tested", label: "Luxx-Tested only", on: filters.tested },
            ].map((t) => (
              <label key={t.name} className="cursor-pointer">
                <input type="checkbox" name={t.name} value="1" defaultChecked={t.on} onChange={autoApply} className="peer sr-only" />
                <span className="inline-flex h-9 items-center rounded-full border border-line px-4 text-sm text-fg/85 transition-colors peer-checked:border-champagne peer-checked:bg-gold-tint peer-checked:text-champagne peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring hover:border-gold-large/60">
                  {t.label}
                </span>
              </label>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 sm:col-span-2 lg:col-span-4">
          <p className="text-sm text-muted" aria-live="polite">
            {pending ? "Updating…" : `${total.toLocaleString("en-PH")} ${isSale ? (total === 1 ? "listing" : "listings") : total === 1 ? "wanted post" : "wanted posts"}`}
          </p>
          <div className="flex gap-2">
            {count > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => start(() => router.push(`${pathname}${toQuery({ ...parseFilters({}), tab: filters.tab })}`, { scroll: false }))}>
                <X aria-hidden /> Clear all
              </Button>
            )}
            <Button type="submit" size="sm" variant="secondary">
              Apply
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
