"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import type { Market } from "@/lib/market";
import { purityFromKarat } from "@/lib/market";
import { DASH, formatManilaTime, formatPerGram } from "@/lib/prices-format";
import { Change } from "./change";
import { useLiveMarket } from "./use-live-market";

type Item = { label: string; value: string; change: number | null | undefined };

function items(market: Market | null): Item[] {
  const g = market?.metals.gold ?? null;
  const per = (metal: "silver" | "platinum" | "palladium") => market?.metals[metal] ?? null;
  return [
    { label: "Gold 24K", value: formatPerGram(g ? g.phpPerGram * purityFromKarat(24) : null), change: g?.change24hPct },
    { label: "Gold 18K", value: formatPerGram(g ? g.phpPerGram * purityFromKarat(18) : null), change: g?.change24hPct },
    { label: "Silver", value: formatPerGram(per("silver")?.phpPerGram), change: per("silver")?.change24hPct },
    { label: "Platinum", value: formatPerGram(per("platinum")?.phpPerGram), change: per("platinum")?.change24hPct },
    { label: "Palladium", value: formatPerGram(per("palladium")?.phpPerGram), change: per("palladium")?.change24hPct },
    { label: "USD/PHP", value: market?.usdPhp ? `₱${market.usdPhp.toFixed(2)}` : DASH, change: null },
  ];
}

function Row({ list, hidden }: { list: Item[]; hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {list.map((it) => (
        <li key={it.label} className="flex items-center gap-2 px-5 text-xs whitespace-nowrap sm:px-6">
          <span className="font-display tracking-[0.16em] text-pearl/60 uppercase">{it.label}</span>
          <span className="tabular font-semibold text-pearl">
            {it.value}
            {it.label !== "USD/PHP" && it.value !== DASH ? <span className="font-normal text-pearl/50">/g</span> : null}
          </span>
          <Change pct={it.change} className="text-[0.7rem]" />
          <span aria-hidden className="ml-4 text-champagne/40 sm:ml-5">
            ◆
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The header price ticker (brief §5, PARITY G1/M13): a slim marquee of live
 * per-gram prices. Pauses on hover and keyboard focus; under reduced motion it
 * is a still row you can scroll sideways. Self-contained: pass `initial` from a
 * server render to paint real numbers first, or nothing and it fetches.
 */
export function PriceTicker({ initial, className }: { initial?: Market; className?: string }) {
  const { market, stale } = useLiveMarket(initial);
  const list = items(market);

  const status = !market
    ? { tone: "muted", text: "Loading prices" }
    : market.delayed || stale
      ? { tone: "warning", text: "Prices delayed" }
      : market.marketClosed
        ? { tone: "muted", text: `Markets closed · last close` }
        : { tone: "live", text: `Live · ${formatManilaTime(market.checkedAt)}` };

  return (
    <div
      className={cn(
        "group/ticker relative flex h-9 items-stretch overflow-hidden border-b border-champagne/15 bg-surface-sunk/85 text-pearl",
        className,
      )}
      role="region"
      aria-label="Live metal prices"
    >
      <Link
        href="/prices"
        className="relative z-10 flex shrink-0 items-center gap-2 border-r border-champagne/15 bg-surface-sunk px-3 text-[0.7rem] font-semibold tracking-wide sm:px-4"
        title="All prices, charts and karat tables"
      >
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            status.tone === "live" ? "bg-success motion-safe:animate-pulse" : status.tone === "warning" ? "bg-warning" : "bg-muted",
          )}
        />
        <span className={cn("tabular", status.tone === "warning" ? "text-warning" : "text-pearl/75")}>{status.text}</span>
      </Link>

      {/* Moving strip. The copy is doubled for a seamless loop; the second copy is hidden from screen readers. */}
      <div className="relative min-w-0 flex-1 overflow-hidden motion-reduce:overflow-x-auto">
        <div
          tabIndex={0}
          aria-label="Prices, per gram of metal"
          className="flex h-full w-max items-center group-hover/ticker:[animation-play-state:paused] focus-within:[animation-play-state:paused] focus:[animation-play-state:paused] motion-safe:animate-[lx-ticker_48s_linear_infinite] motion-reduce:w-auto"
        >
          <Row list={list} />
          <span className="contents motion-reduce:hidden">
            <Row list={list} hidden />
          </span>
        </div>
        {/* Soft edges so the figures fade in and out rather than being cut. */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-surface-sunk to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface-sunk to-transparent" />
      </div>
    </div>
  );
}
