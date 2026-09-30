"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useLiveMarket } from "@/components/prices/use-live-market";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { purityFromKarat, type Market } from "@/lib/market";
import { formatPeso } from "@/lib/pricing";
import { parseAmount } from "@/lib/prices-format";

const KARATS = [24, 22, 21, 18, 14] as const;

/** The calculator in miniature, for the home page: grams and a karat, melt value at once. */
export function QuickValue({ initial }: { initial: Market }) {
  const { market } = useLiveMarket(initial);
  const [karat, setKarat] = useState<(typeof KARATS)[number]>(18);
  const [raw, setRaw] = useState("10");
  const id = useId();
  const grams = parseAmount(raw);
  const pure = market?.metals.gold?.phpPerGram ?? null;
  const value = pure && grams ? pure * purityFromKarat(karat) * grams : null;

  return (
    <div className="grid gap-6 rounded-2xl border border-line bg-surface p-6 sm:p-8 lg:grid-cols-2 lg:items-center lg:gap-10">
      <div className="grid gap-4">
        <label htmlFor={id} className="text-sm font-semibold">
          Weight in grams
        </label>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          aria-invalid={raw && !grams ? true : undefined}
          className="tabular h-14 w-full rounded-xl border border-line bg-surface-sunk px-4 font-display text-2xl text-fg hover:border-gold-large/50 focus-visible:border-ring aria-invalid:border-danger"
        />
        <div role="radiogroup" aria-label="Karat" className="grid grid-cols-5 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
          {KARATS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={karat === k}
              onClick={() => setKarat(k)}
              className={cn(
                "tabular h-10 min-w-0 rounded-full border px-2 text-sm font-semibold transition-colors sm:min-w-14 sm:px-3.5",
                karat === k ? "border-champagne bg-champagne text-velvet" : "border-line bg-surface-sunk text-fg hover:border-champagne/60",
              )}
            >
              {k}K
            </button>
          ))}
        </div>
      </div>
      <div aria-live="polite">
        <p className="text-sm text-muted">Melt value today</p>
        <p className="tabular mt-1 font-display text-4xl text-gold-metal sm:text-5xl">{value ? formatPeso(value) : "—"}</p>
        <p className="mt-2 text-xs text-muted">For reference only — not an offer. The metal alone, before workmanship or a dealer&rsquo;s margin.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild size="sm" variant="secondary">
            <Link href="/tools/calculator">Full calculator</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/tools/price-check">Check an offer</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
