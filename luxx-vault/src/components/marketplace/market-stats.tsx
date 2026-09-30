import type { MarketStats } from "@/lib/server/marketplace/listings";

/**
 * The market in three numbers: what's for sale, what's wanted, and the median
 * premium sellers are asking over melt for the karats people trade most.
 * Every figure comes from live listings; with too few, it says so.
 */
export function MarketStatsPanel({ stats }: { stats: MarketStats }) {
  return (
    <section aria-labelledby="market-stats-title" className="rounded-2xl border border-line bg-surface-sunk/60 p-5">
      <h2 id="market-stats-title" className="font-display text-xs tracking-[0.26em] text-champagne uppercase">
        Market today
      </h2>
      <dl className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs text-muted">For sale</dt>
          <dd className="font-display text-3xl text-fg tabular">{stats.activeListings.toLocaleString("en-PH")}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Wanted</dt>
          <dd className="font-display text-3xl text-fg tabular">{stats.openWanted.toLocaleString("en-PH")}</dd>
        </div>
      </dl>
      <div className="mt-5 border-t border-line pt-4">
        <p className="text-xs font-semibold text-fg">Median premium over melt</p>
        <ul className="mt-2 grid gap-1.5">
          {stats.medianPremium.map((m) => (
            <li key={m.karat} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted">{m.karat}K</span>
              {m.pct === null ? (
                <span className="text-xs text-muted">No listings yet</span>
              ) : (
                <span className="tabular font-semibold text-fg">
                  {m.pct >= 0 ? "+" : "−"}
                  {Math.abs(m.pct).toFixed(1)}%<span className="ml-1.5 text-xs font-normal text-muted">({m.sample})</span>
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          {stats.delayed ? "Live prices are delayed, so premiums use the last known spot." : "Calculated from active listings against live spot."}
        </p>
      </div>
    </section>
  );
}
