"use client";

import Link from "next/link";
import { Change } from "@/components/prices/change";
import { useLiveMarket } from "@/components/prices/use-live-market";
import { METALS } from "@/config/catalog";
import { cn } from "@/lib/cn";
import type { Market } from "@/lib/market";
import { formatPerGram, formatUsd, marketStatus } from "@/lib/prices-format";

/** Four metals, live: ₱/g, USD/oz and 24h change, each opening its chart on /prices. */
export function MarketStrip({ initial }: { initial: Market }) {
  const { market, stale } = useLiveMarket(initial);
  const status = marketStatus(market, stale);

  return (
    <div>
      <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
        {METALS.map((m) => {
          const p = market?.metals[m.value];
          return (
            <li key={m.value} className="bg-surface">
              <Link href={m.value === "gold" ? "/prices" : `/prices?metal=${m.value}`} className="group block h-full p-5 transition-colors hover:bg-surface-sunk sm:p-6">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-sm tracking-[0.14em] text-champagne uppercase">{m.label}</span>
                  <Change pct={p?.change24hPct} className="text-xs" />
                </span>
                <span className="tabular mt-3 block text-xl font-semibold whitespace-nowrap text-fg sm:text-3xl">
                  {formatPerGram(p?.phpPerGram)}
                  <span className="text-sm font-normal text-muted"> /g</span>
                </span>
                <span className="tabular mt-1 block text-xs text-muted">{formatUsd(p?.usdPerOz)} per troy oz</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className={cn("tabular mt-3 text-xs", status.tone === "delayed" || status.tone === "none" ? "text-warning" : "text-muted")}>
        Pure metal, melt value per gram · {status.text}
      </p>
    </div>
  );
}
