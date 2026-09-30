import { connection } from "next/server";
import { db } from "@/lib/server/db";
import { gramsLabel, itemLabel, roundToTen, timeAgo } from "@/lib/server/marketplace/describe";
import { placeLabel } from "@/lib/locations";
import { formatPeso } from "@/lib/pricing";
import styles from "./trade-tape.module.css";

type TapeEntry = { id: string; item: string; weight: string; place: string; when: string; perGram: string | null };

/** Most recent released trades, anonymised. Never names, handles, codes or exact totals. */
async function loadTape(): Promise<TapeEntry[]> {
  const trades = await db.trade.findMany({
    where: { status: "released", hideFromTape: false, releasedAt: { not: null } },
    orderBy: { releasedAt: "desc" },
    take: 24,
    select: {
      id: true,
      category: true,
      metal: true,
      karat: true,
      goldType: true,
      form: true,
      weightGrams: true,
      amountPhp: true,
      regionCode: true,
      cityCode: true,
      releasedAt: true,
    },
  });
  const now = new Date();
  return trades.map((t) => {
    const grams = Number(t.weightGrams);
    const amount = Number(t.amountPhp);
    // Only gold is quoted per gram in the Philippine market; other items would make the figure meaningless.
    const perGram = t.metal === "gold" && grams > 0 && amount > 0 ? `${formatPeso(roundToTen(amount / grams))}/g` : null;
    return {
      id: t.id,
      item: itemLabel(t),
      weight: gramsLabel(grams),
      place: placeLabel(t.cityCode, t.regionCode),
      when: timeAgo(t.releasedAt!, now),
      perGram,
    };
  });
}

function Entry({ e }: { e: TapeEntry }) {
  return (
    <span className="inline-flex items-center gap-3 whitespace-nowrap px-6 text-sm">
      <span aria-hidden className="size-1.5 rotate-45 bg-champagne/70" />
      <span className="font-semibold text-fg">{e.item}</span>
      <span className="tabular text-muted">{e.weight}</span>
      {e.perGram && <span className="tabular font-semibold text-champagne">{e.perGram}</span>}
      <span className="text-muted">{e.place}</span>
      <span className="text-muted/80">{e.when}</span>
    </span>
  );
}

/**
 * The trade tape: a slow band of recently completed marketplace trades.
 * An async server component with no props (the home page drops it in as is).
 *
 * Only trades whose payment was released appear, and either party can take a
 * trade off the tape. With no trades yet, it says so; it never invents one.
 */
export async function TradeTape() {
  await connection(); // trades change per request; never bake them into a static page
  const entries = await loadTape();
  const duration = `${Math.max(40, entries.length * 9)}s`;

  return (
    <section aria-labelledby="trade-tape-title" className="relative border-y border-champagne/25 bg-surface-sunk/70">
      {/* Gold hairlines inside the border, like the double rule on a ledger. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1 h-px bg-[linear-gradient(90deg,transparent,rgb(214_178_110/0.35),transparent)]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-1 h-px bg-[linear-gradient(90deg,transparent,rgb(214_178_110/0.35),transparent)]" />

      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:gap-6 sm:px-8">
        <h2 id="trade-tape-title" className="flex shrink-0 items-center gap-2 font-display text-xs tracking-[0.28em] text-champagne uppercase">
          <span aria-hidden className="relative flex size-2">
            {entries.length > 0 && <span className="absolute inline-flex size-full animate-ping rounded-full bg-champagne/50 motion-reduce:hidden" />}
            <span className="relative inline-flex size-2 rounded-full bg-champagne" />
          </span>
          Trade tape
        </h2>

        {entries.length === 0 ? (
          <p className="text-sm text-muted">
            The trade tape starts with the first completed trade. Every entry will be a real, verified deal, shown without names.
          </p>
        ) : (
          <div className="min-w-0 flex-1">
            {/* Moving tape: decorative copy for sighted users; the list below is what assistive tech reads. */}
            <div className={`${styles.motion} ${styles.viewport} overflow-hidden`} aria-hidden>
              <div className={styles.track} style={{ ["--tape-duration" as string]: duration }}>
                {[0, 1].map((copy) => (
                  <span key={copy} className="flex">
                    {entries.map((e) => (
                      <Entry key={`${copy}-${e.id}`} e={e} />
                    ))}
                  </span>
                ))}
              </div>
            </div>
            <ul aria-hidden className={`${styles.static} -mx-6 gap-y-2`}>
              {entries.slice(0, 8).map((e) => (
                <li key={e.id}>
                  <Entry e={e} />
                </li>
              ))}
            </ul>
            <ul className="sr-only">
              {entries.map((e) => (
                <li key={e.id}>
                  {e.item}, {e.weight}
                  {e.perGram ? `, about ${e.perGram}` : ""}, {e.place}, {e.when}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
