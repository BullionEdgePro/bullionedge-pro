"use client";

import Link from "next/link";
import { useState } from "react";
import { useLiveMarket } from "@/components/prices/use-live-market";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { METALS, type Metal } from "@/config/catalog";
import { cn } from "@/lib/cn";
import { UNITS, meltValuePhp, purityFromSpecificGravity, toGrams, type Market, type Unit } from "@/lib/market";
import { formatPeso } from "@/lib/pricing";
import { findPublicSpread, formatPerGram, marketStatus, parseAmount, purityOptions, roundEstimate, type PublicSpread } from "@/lib/prices-format";

type Mode = "karat" | "sg";

/**
 * Gold and silver value calculator (PARITY P13–P15): metal, karat or
 * fineness, weight in any unit, or a specific-gravity reading. Shows melt
 * value, and what Luxx4less would pay only when the shop has set a spread.
 */
export function ValueCalculator({ initial, spreads }: { initial: Market; spreads: PublicSpread[] }) {
  const { market, stale } = useLiveMarket(initial);
  const [metal, setMetal] = useState<Metal>("gold");
  const [mode, setMode] = useState<Mode>("karat");
  const [purity, setPurity] = useState<number>(18);
  const [weightRaw, setWeightRaw] = useState("10");
  const [unit, setUnit] = useState<Unit>("g");
  const [sgRaw, setSgRaw] = useState("15.5");
  const [productType, setProductType] = useState<"jewelry" | "bullion">("jewelry");

  const options = purityOptions(metal);
  const pure = market?.metals[metal]?.phpPerGram ?? null;
  const weight = parseAmount(weightRaw);
  const grams = weight ? toGrams(weight, unit) : null;
  const sg = parseAmount(sgRaw);
  const sgPurity = sg ? purityFromSpecificGravity(sg) : null;
  const effectiveMode: Mode = metal === "gold" ? mode : "karat";
  const fraction = effectiveMode === "sg" ? sgPurity : (options.find((o) => o.value === purity)?.fraction ?? null);
  const melt = pure && grams && fraction ? meltValuePhp(pure, grams, fraction) : null;
  const spread = effectiveMode === "karat" ? findPublicSpread(spreads, metal, purity, productType) : undefined;
  const status = marketStatus(market, stale);

  function pickMetal(next: Metal) {
    setMetal(next);
    setPurity(next === "gold" ? 18 : (purityOptions(next)[0]?.value ?? 999));
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-12">
      <form className="grid content-start gap-5" onSubmit={(e) => e.preventDefault()} aria-label="Gold value calculator">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Metal</legend>
          <div className="flex flex-wrap gap-2">
            {METALS.map((m) => (
              <button
                key={m.value}
                type="button"
                aria-pressed={metal === m.value}
                onClick={() => pickMetal(m.value)}
                className={cn(
                  "h-10 rounded-full border px-4 text-sm font-semibold transition-colors",
                  metal === m.value ? "border-champagne bg-champagne text-velvet" : "border-line bg-surface text-fg hover:border-champagne/60",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </fieldset>

        {metal === "gold" ? (
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">How do you know the purity?</legend>
            <div className="inline-flex rounded-full border border-line bg-surface-sunk p-1">
              {(
                [
                  ["karat", "Karat stamp"],
                  ["sg", "Specific-gravity test"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                  className={cn(
                    "h-9 rounded-full px-3.5 text-xs font-semibold transition-colors sm:text-sm",
                    mode === value ? "bg-surface text-champagne shadow-sm" : "text-muted hover:text-fg",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        {effectiveMode === "karat" ? (
          <Field label={metal === "gold" ? "Karat" : "Fineness"} hint={metal === "gold" ? "Look for a stamp like 18K, 750 or 21K." : "Look for a stamp like 925 or 950."}>
            {(p) => (
              <Select {...p} value={purity} onChange={(e) => setPurity(Number(e.target.value))}>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label} · {(o.fraction * 100).toFixed(1)}%
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : (
          <div className="grid gap-3">
            <Field
              label="Specific gravity reading"
              hint="Between 10.5 and 19.3. Pure gold reads 19.32."
              error={sgRaw && (!sg || sgPurity == null) ? "That reading is outside what a gold alloy can show (about 10.5 to 19.3)." : null}
            >
              {(p) => <Input {...p} inputMode="decimal" autoComplete="off" value={sgRaw} onChange={(e) => setSgRaw(e.target.value)} className="tabular" />}
            </Field>
            <details className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-muted">
              <summary className="cursor-pointer font-semibold text-fg">What is a specific-gravity test, and when is it wrong?</summary>
              <div className="mt-2 grid gap-2">
                <p>
                  Weigh the piece in air, then hanging in water. Specific gravity = weight in air ÷ (weight in air − weight in water). Gold is
                  much denser than the silver and copper it is mixed with, so a higher reading means more gold.
                </p>
                <p>
                  It assumes a solid gold–silver–copper alloy. Stones, hollow or filled pieces, solder, trapped air and some deliberate fakes
                  (tungsten is almost as dense as gold) all throw it off. Treat the result as a first check; an XRF or acid test confirms it.
                </p>
              </div>
            </details>
          </div>
        )}

        <div className="grid grid-cols-[1fr_9.5rem] items-start gap-3">
          <Field label="Weight" error={weightRaw && !weight ? "Enter a weight greater than zero." : null}>
            {(p) => <Input {...p} inputMode="decimal" autoComplete="off" value={weightRaw} onChange={(e) => setWeightRaw(e.target.value)} className="tabular" />}
          </Field>
          <Field label="Unit">
            {(p) => (
              <Select {...p} value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        {effectiveMode === "karat" && spreads.some((s) => s.metal === metal && s.purity === purity) ? (
          <Field label="Type of piece">
            {(p) => (
              <Select {...p} value={productType} onChange={(e) => setProductType(e.target.value as "jewelry" | "bullion")}>
                <option value="jewelry">Jewellery</option>
                <option value="bullion">Bar or coin</option>
              </Select>
            )}
          </Field>
        ) : null}
      </form>

      {/* ---------------------------------------------------------------- result */}
      <div aria-live="polite" className="rounded-2xl border border-champagne/30 bg-surface p-6 shadow-[0_24px_60px_-36px_rgb(214_178_110/0.55)] sm:p-7">
        <p className="text-sm text-muted">Melt value</p>
        <p className="tabular mt-1 font-display text-4xl text-gold-metal sm:text-5xl">{melt ? formatPeso(melt) : "—"}</p>
        <dl className="tabular mt-5 grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Weight</dt>
            <dd className="text-fg">{grams ? `${grams.toLocaleString("en-PH", { maximumFractionDigits: 3 })} g` : "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Purity</dt>
            <dd className="text-fg">
              {fraction ? `${(fraction * 100).toFixed(1)}%` : "—"}
              {effectiveMode === "sg" && fraction ? <span className="text-muted"> (about {(fraction * 24).toFixed(1)}K)</span> : null}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">₱ per gram at this purity</dt>
            <dd className="text-fg">{pure && fraction ? formatPerGram(pure * fraction) : "—"}</dd>
          </div>
        </dl>

        {spread && melt ? (
          <div className="mt-6 rounded-xl border border-line bg-surface-sunk p-4">
            <p className="text-sm text-muted">Luxx4less would pay about</p>
            <p className="tabular mt-1 text-2xl font-semibold text-fg">{formatPeso(roundEstimate(melt * spread.buyRatio))}</p>
            <p className="mt-1 text-xs text-muted">At today&rsquo;s buying rate for {productType === "jewelry" ? "jewellery" : "bars and coins"}, after an in-store test.</p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/sell">Get a quote</Link>
            </Button>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted">
            Selling? <Link href="/sell" className="text-gold underline-offset-4 hover:underline">Luxx4less confirms an offer after testing the piece in store.</Link>
          </p>
        )}

        <p className={cn("tabular mt-6 text-xs", status.tone === "delayed" || status.tone === "none" ? "text-warning" : "text-muted")}>{status.text}</p>
        <p className="mt-2 text-xs text-muted">For reference only — not an offer. Melt value is the metal alone, before any dealer margin or workmanship.</p>
      </div>
    </div>
  );
}
