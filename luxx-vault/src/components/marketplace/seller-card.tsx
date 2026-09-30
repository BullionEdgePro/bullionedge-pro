import { CalendarDays, Clock, Handshake, MapPin } from "lucide-react";
import Link from "next/link";
import { TierBadge } from "@/components/ui/badge";
import { responseLabel, monthYear } from "@/lib/server/marketplace/describe";
import type { PersonStats } from "@/lib/server/marketplace/stats";
import { Stars } from "./stars";
import { TrustMeter } from "./trust-meter";

/** Who you are dealing with: verification, trust, track record. Only real numbers; "none yet" when there are none. */
export function SellerCard({
  handle,
  displayName,
  place,
  stats,
  role = "Seller",
}: {
  handle: string;
  displayName: string;
  place: string;
  stats: PersonStats;
  role?: string;
}) {
  const rows = [
    { icon: Handshake, label: "Completed trades", value: stats.releasedTrades ? String(stats.releasedTrades) : "None yet" },
    { icon: Clock, label: "Typical reply", value: responseLabel(stats.medianResponseMs) },
    { icon: CalendarDays, label: "Member since", value: monthYear(stats.memberSince) },
    { icon: MapPin, label: "Based in", value: place || "Not shared" },
  ];
  return (
    <section aria-label={`${role}: ${displayName}`} className="rounded-2xl border border-line bg-surface p-5">
      <p className="font-display text-[0.7rem] tracking-[0.26em] text-champagne uppercase">{role}</p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {handle ? (
            <Link href={`/sellers/${handle}`} className="text-lg font-semibold text-fg underline-offset-4 hover:text-champagne hover:underline">
              {displayName}
            </Link>
          ) : (
            <p className="text-lg font-semibold text-fg">{displayName}</p>
          )}
          {handle && <p className="text-sm text-muted">@{handle}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <TierBadge tier={stats.tier} />
            {stats.ratingCount > 0 && stats.ratingAverage !== null ? (
              <span className="inline-flex items-center gap-1.5 text-sm">
                <Stars value={stats.ratingAverage} />
                <span className="tabular font-semibold">{stats.ratingAverage.toFixed(1)}</span>
                <span className="text-muted">({stats.ratingCount})</span>
              </span>
            ) : (
              <span className="text-xs text-muted">No reviews yet</span>
            )}
          </div>
        </div>
        <TrustMeter score={stats.trust.score} label={stats.trust.label} size={64} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
        {rows.map((r) => (
          <div key={r.label} className="flex gap-2">
            <r.icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
            <div className="min-w-0">
              <dt className="text-xs text-muted">{r.label}</dt>
              <dd className="truncate text-sm font-semibold text-fg">{r.value}</dd>
            </div>
          </div>
        ))}
      </dl>
      {handle && (
        <Link href={`/sellers/${handle}`} className="mt-4 inline-block text-sm font-semibold text-champagne underline-offset-4 hover:underline">
          Visit the showroom
        </Link>
      )}
    </section>
  );
}
