"use client";

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useState } from "react";
import { useLiveMarket } from "@/components/prices/use-live-market";
import { Field, Input, Select } from "@/components/ui/field";
import { METALS, type Metal } from "@/config/catalog";
import { cn } from "@/lib/cn";
import { UNITS, meltValuePhp, toGrams, type Market, type Unit } from "@/lib/market";
import { formatPeso } from "@/lib/pricing";
import { formatPerGram, marketStatus, offerVerdict, parseAmount, purityOptions, type OfferVerdict } from "@/lib/prices-format";

const COPY: Record<OfferVerdict, { tone: "danger" | "warning" | "success" | "info"; title: string; body: string }> = {
  suspicious: {
    tone: "danger",
    title: "Suspiciously cheap — verify before paying",
    body:
      "This is well below what the metal alone is worth. Nobody can sell real gold under its melt value for long, so a price like this is the classic sign of plated, filled or lower-karat gold sold as the real thing, or of a seller who plans to take the money and disappear. Have it tested (XRF or acid) before any money moves, and never pay in advance to a stranger.",
  },
  "below-melt": {
    tone: "warning",
    title: "Below melt value",
    body:
      "Slightly under what the metal is worth. That can happen with a motivated private seller, but it is unusual. Check the karat stamp, weigh it yourself and ask for a test before paying.",
  },
  "near-melt": {
    tone: "success",
    title: "Close to melt value",
    body: "About what the metal alone is worth. That is a fair price for scrap or plain pieces, and a good price for finished jewellery if the piece tests true.",
  },
  typical: {
    tone: "info",
    title: "Above melt, as jewellery usually is",
    body:
      "Finished jewellery normally sells above melt because of the workmanship, the design and the seller's margin. Compare with other shops for similar pieces.",
  },
  "well-above": {
    tone: "warning",
    title: "Well above melt value",
    body:
      "You would be paying far more than the metal is worth. That can be fair for designer, antique or stone-set pieces, but for plain gold ask what the extra is for, and compare with other shops.",
  },
};

const TONES = {
  danger: "border-danger/40 bg-danger-tint text-danger",
  warning: "border-warning/40 bg-warning-tint text-warning",
  success: "border-success/40 bg-success-tint text-success",
  info: "border-ice/30 bg-ice-tint text-fg",
};

/**
 * "Price-check any offer" (FEATURES trust tools): an asking price against
 * today's melt value, with the reasoning spelled out.
 */
export function OfferCheck({ initial }: { initial: Market }) {
  const { market, stale } = useLiveMarket(initial);
  const [metal, setMetal] = useState<Metal>("gold");
  const [purity, setPurity] = useState(18);
  const [priceRaw, setPriceRaw] = useState("");
  const [priceKind, setPriceKind] = useState<"total" | "perGram">("total");
  const [weightRaw, setWeightRaw] = useState("");
  const [unit, setUnit] = useState<Unit>("g");

  const options = purityOptions(metal);
  const fraction = options.find((o) => o.value === purity)?.fraction ?? null;
  const pure = market?.metals[metal]?.phpPerGram ?? null;
  const price = parseAmount(priceRaw);
  const weight = parseAmount(weightRaw);
  const grams = weight ? toGrams(weight, unit) : null;
  const melt = pure && grams && fraction ? meltValuePhp(pure, grams, fraction) : null;
  const total = price && grams ? (priceKind === "total" ? price : price * grams) : null;
  const result = total && melt ? offerVerdict(total, melt) : null;
  const copy = result ? COPY[result.verdict] : null;
  const status = marketStatus(market, stale);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-12">
      <form className="grid content-start gap-5" onSubmit={(e) => e.preventDefault()} aria-label="Check an offer">
        <div className="grid grid-cols-2 items-start gap-3">
          <Field label="Metal">
            {(p) => (
              <Select
                {...p}
                value={metal}
                onChange={(e) => {
                  const next = e.target.value as Metal;
                  setMetal(next);
                  setPurity(next === "gold" ? 18 : (purityOptions(next)[0]?.value ?? 999));
                }}
              >
                {METALS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={metal === "gold" ? "Karat" : "Fineness"}>
            {(p) => (
              <Select {...p} value={purity} onChange={(e) => setPurity(Number(e.target.value))}>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <div className="grid grid-cols-[1fr_9.5rem] items-start gap-3">
          <Field label="Weight" error={weightRaw && !weight ? "Enter a weight greater than zero." : null}>
            {(p) => (
              <Input {...p} inputMode="decimal" autoComplete="off" placeholder="e.g. 8.5" value={weightRaw} onChange={(e) => setWeightRaw(e.target.value)} className="tabular" />
            )}
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

        <div className="grid grid-cols-[1fr_9.5rem] items-start gap-3">
          <Field label="Asking price (₱)" error={priceRaw && !price ? "Enter a price greater than zero." : null}>
            {(p) => (
              <Input {...p} inputMode="decimal" autoComplete="off" placeholder="e.g. 45,000" value={priceRaw} onChange={(e) => setPriceRaw(e.target.value)} className="tabular" />
            )}
          </Field>
          <Field label="Price is">
            {(p) => (
              <Select {...p} value={priceKind} onChange={(e) => setPriceKind(e.target.value as "total" | "perGram")}>
                <option value="total">For the piece</option>
                <option value="perGram">Per gram</option>
              </Select>
            )}
          </Field>
        </div>
        <p className="text-xs text-muted">Live sellers often quote per gram (for example ₱7,700/g). Choose &ldquo;Per gram&rdquo; for those.</p>
      </form>

      <div aria-live="polite" className="grid content-start gap-4">
        <div className="rounded-2xl border border-line bg-surface p-6">
          <dl className="tabular grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Melt value today</dt>
              <dd className="font-semibold text-fg">{melt ? formatPeso(melt) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Asking price</dt>
              <dd className="font-semibold text-fg">{total ? formatPeso(total) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Asking per gram</dt>
              <dd className="text-fg">{total && grams ? formatPerGram(total / grams) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-line pt-2">
              <dt className="text-muted">Against melt</dt>
              <dd className={cn("font-semibold", result ? (result.premiumPct < 0 ? "text-danger" : "text-fg") : "text-muted")}>
                {result ? `${result.premiumPct >= 0 ? "+" : "−"}${Math.abs(result.premiumPct).toFixed(1)}% ${result.premiumPct >= 0 ? "above" : "below"}` : "—"}
              </dd>
            </div>
          </dl>
        </div>

        {copy ? (
          <div className={cn("rounded-2xl border p-5", TONES[copy.tone])} role={copy.tone === "danger" ? "alert" : "status"}>
            <p className="flex items-center gap-2 font-semibold">
              {copy.tone === "danger" || copy.tone === "warning" ? (
                <AlertTriangle className="size-4 shrink-0" aria-hidden />
              ) : copy.tone === "success" ? (
                <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              ) : (
                <Info className="size-4 shrink-0" aria-hidden />
              )}
              {copy.title}
            </p>
            <p className="mt-2 text-sm text-fg/85">{copy.body}</p>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-line p-5 text-sm text-muted">Enter the weight and the asking price to see how it compares.</p>
        )}

        <p className={cn("tabular text-xs", status.tone === "delayed" || status.tone === "none" ? "text-warning" : "text-muted")}>{status.text}</p>
        <p className="text-xs text-muted">For reference only. A fair price on paper means nothing if the gold isn&rsquo;t real: test before you pay.</p>
      </div>
    </div>
  );
}
