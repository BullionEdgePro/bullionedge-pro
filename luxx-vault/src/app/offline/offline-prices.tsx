"use client";

import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type MetalPrice = { phpPerGram: number } | null;
type MarketJson = { metals: Record<"gold" | "silver" | "platinum" | "palladium", MetalPrice>; checkedAt: string; delayed?: boolean };

const GOLD_ROWS = [
  { label: "24K", purity: 0.999 },
  { label: "22K", purity: 0.916 },
  { label: "21K", purity: 0.875 },
  { label: "18K", purity: 0.75 },
  { label: "14K", purity: 0.585 },
] as const;
const OTHERS = [
  { key: "silver", label: "Silver" },
  { key: "platinum", label: "Platinum" },
  { key: "palladium", label: "Palladium" },
] as const;

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

type View = { market: MarketJson | null; offline: boolean; loaded: boolean };

async function readPrices(): Promise<View> {
  try {
    const res = await fetch("/api/prices", { cache: "no-store" });
    const offline = res.headers.get("X-Luxx-Offline") === "1" || !navigator.onLine;
    const market = res.ok ? ((await res.json()) as MarketJson) : null;
    return { market: market?.metals ? market : null, offline, loaded: true };
  } catch {
    return { market: null, offline: true, loaded: true };
  }
}

/**
 * Prices as the service worker last saw them. Offline, the worker answers
 * /api/prices from its cache and marks the answer with X-Luxx-Offline, so
 * these are never passed off as live.
 */
export function OfflinePrices() {
  const [state, setState] = useState<View>({ market: null, offline: false, loaded: false });

  const load = useCallback(() => {
    void readPrices().then(setState);
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("online", load);
    window.addEventListener("offline", load);
    return () => {
      window.removeEventListener("online", load);
      window.removeEventListener("offline", load);
    };
  }, [load]);

  const { market, offline, loaded } = state;
  const gold = market?.metals.gold?.phpPerGram ?? null;

  return (
    <div className="grid gap-6">
      <div
        role="status"
        className={
          offline
            ? "flex items-start gap-3 rounded-2xl border border-warning/35 bg-warning-tint px-4 py-3 text-sm"
            : "flex items-start gap-3 rounded-2xl border border-success/30 bg-success-tint px-4 py-3 text-sm"
        }
      >
        {offline ? <CloudOff className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /> : <Wifi className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />}
        <p>
          {!loaded
            ? "Checking for saved prices…"
            : offline
              ? market
                ? <>Last known prices from <strong className="tabular">{when(market.checkedAt)}</strong> — you&apos;re offline. They will not update until you reconnect.</>
                : "You're offline, and this device hasn't saved any prices yet. Open Luxx4less once while connected and they'll be kept here."
              : <>You&apos;re back online. <Link href="/prices" className="font-semibold underline underline-offset-4">See live prices</Link>.</>}
        </p>
      </div>

      {market && (
        <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
          <section aria-labelledby="gold-title" className="rounded-2xl border border-line bg-surface p-5">
            <h2 id="gold-title" className="text-lg">
              Gold, per gram
            </h2>
            <dl className="mt-3 divide-y divide-line">
              {GOLD_ROWS.map((r) => (
                <div key={r.label} className="flex items-baseline justify-between py-2.5">
                  <dt className="font-display tracking-wide text-champagne">{r.label}</dt>
                  <dd className="font-semibold tabular">{gold ? peso.format(gold * r.purity) : "—"}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section aria-labelledby="other-title" className="rounded-2xl border border-line bg-surface p-5">
            <h2 id="other-title" className="text-lg">
              Other metals, pure
            </h2>
            <dl className="mt-3 divide-y divide-line">
              {OTHERS.map((o) => {
                const p = market.metals[o.key]?.phpPerGram;
                return (
                  <div key={o.key} className="flex items-baseline justify-between py-2.5">
                    <dt className="text-muted">{o.label}</dt>
                    <dd className="font-semibold tabular">{p ? peso.format(p) : "—"}</dd>
                  </div>
                );
              })}
            </dl>
          </section>
        </div>
      )}
      {market && <p className="text-xs text-muted">Spot melt prices per gram before any dealer spread. Shop buying and selling prices differ.</p>}

      <div>
        <Button type="button" variant="secondary" onClick={load}>
          <RefreshCw aria-hidden /> Try again
        </Button>
      </div>
    </div>
  );
}
