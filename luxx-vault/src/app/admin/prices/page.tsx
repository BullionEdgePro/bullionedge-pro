import type { Metadata } from "next";
import Link from "next/link";
import { QUOTE_STATUSES, type QuoteStatus } from "@/app/sell/schema";
import { MarketStatusLine } from "@/components/prices/market-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Metal } from "@/config/catalog";
import { cn } from "@/lib/cn";
import { formatPeso } from "@/lib/pricing";
import { formatManilaDate, formatManilaDateTime, marketStatus } from "@/lib/prices-format";
import { getMarket } from "@/lib/server/prices/engine";
import { getSpreads } from "@/lib/server/prices/spreads";
import { listSellQuotes } from "@/lib/server/sell-quotes";
import { requireRole } from "@/lib/server/session";
import { setQuoteStatusAction } from "./actions";
import { spreadKey, toPctInput, type ProductType } from "./spread-rules";
import { SpreadsEditor } from "./spreads-editor";

export const metadata: Metadata = { title: "Prices and quotes", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<QuoteStatus, string> = {
  new: "New",
  contacted: "Contacted",
  booked: "Booked",
  bought: "Bought",
  closed: "Closed",
};
const STATUS_TONE: Record<QuoteStatus, "gold" | "ice" | "neutral" | "success"> = {
  new: "gold",
  contacted: "ice",
  booked: "ice",
  bought: "success",
  closed: "neutral",
};

export default async function AdminPricesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireRole(["admin", "super_admin"], "/admin/prices");
  const { status: asked } = await searchParams;
  const filter = QUOTE_STATUSES.includes(asked as QuoteStatus) ? (asked as QuoteStatus) : undefined;

  const [market, spreads, quotes] = await Promise.all([getMarket(), getSpreads(), listSellQuotes(filter)]);
  const pure = Object.fromEntries(Object.entries(market.metals).map(([k, v]) => [k, v?.phpPerGram ?? null])) as Record<Metal, number | null>;
  const initial: Record<string, string> = {};
  for (const s of spreads) {
    const key = spreadKey(s.metal as Metal, s.purity, s.productType as ProductType);
    initial[`buy:${key}`] = toPctInput(s.buyRatio);
    initial[`sell:${key}`] = toPctInput(s.sellRatio);
  }
  const lastEdit = spreads.reduce<string | null>((a, s) => (!a || s.updatedAt > a ? s.updatedAt : a), null);
  const total = Object.values(quotes.counts).reduce((a, b) => a + b, 0);

  return (
    <>
      <header>
        <h1 className="text-3xl text-fg">Prices and quotes</h1>
        <MarketStatusLine status={marketStatus(market)} className="mt-3" />
      </header>

      {/* ---------------------------------------------------------------- spreads */}
      <section aria-labelledby="spreads-title" className="grid gap-4">
        <div>
          <h2 id="spreads-title" className="text-xl text-fg">
            Buy and sell spreads
          </h2>
          <p className="measure mt-2 text-sm text-muted">
            Set what Luxx4less pays and charges as a percentage of melt value. These appear on the prices page, the calculator and the
            &ldquo;Sell to us&rdquo; estimate as &ldquo;We buy at&rdquo; and &ldquo;We sell at&rdquo;. Every change is recorded in the audit log.
            {lastEdit ? ` Last changed ${formatManilaDateTime(lastEdit)}.` : " Nothing is set yet, so the site says prices are confirmed in store."}
          </p>
        </div>
        <SpreadsEditor initial={initial} pure={pure} />
      </section>

      {/* ---------------------------------------------------------------- quotes */}
      <section id="quotes" aria-labelledby="quotes-title" className="grid scroll-mt-28 gap-4">
        <div>
          <h2 id="quotes-title" className="text-xl text-fg">
            Sell requests
          </h2>
          <p className="mt-2 text-sm text-muted">Requests from the &ldquo;Sell to Luxx4less&rdquo; page. The estimate is melt value when they asked, not an offer.</p>
        </div>

        <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
          <Link
            href="/admin/prices#quotes"
            scroll={false}
            aria-current={!filter ? "page" : undefined}
            className={cn("rounded-full border px-3.5 py-1.5 text-sm", !filter ? "border-champagne bg-gold-tint text-champagne" : "border-line text-muted hover:text-fg")}
          >
            All <span className="tabular">({total})</span>
          </Link>
          {QUOTE_STATUSES.map((s) => (
            <Link
              key={s}
              href={`/admin/prices?status=${s}#quotes`}
              scroll={false}
              aria-current={filter === s ? "page" : undefined}
              className={cn("rounded-full border px-3.5 py-1.5 text-sm", filter === s ? "border-champagne bg-gold-tint text-champagne" : "border-line text-muted hover:text-fg")}
            >
              {STATUS_LABEL[s]} <span className="tabular">({quotes.counts[s] ?? 0})</span>
            </Link>
          ))}
        </nav>

        {quotes.rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
            {filter ? `No ${STATUS_LABEL[filter].toLowerCase()} requests.` : "No sell requests yet. They appear here as soon as someone asks for a quote."}
          </p>
        ) : (
          <ul className="grid gap-3">
            {quotes.rows.map((q) => {
              const pureNow = pure[q.metal as Metal];
              const meltNow = pureNow && q.purityFraction ? pureNow * q.purityFraction * q.weightGrams : null;
              return (
                <li key={q.id} className="grid gap-4 rounded-xl border border-line bg-surface p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-fg">{q.name}</p>
                      <Badge tone={STATUS_TONE[q.status]}>{STATUS_LABEL[q.status]}</Badge>
                      {q.signedIn ? <Badge>Has an account</Badge> : null}
                    </div>
                    <p className="tabular mt-1 text-sm break-all text-fg/90">{q.contact}</p>
                    <dl className="tabular mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                      <div>
                        <dt className="text-xs text-muted">Item</dt>
                        <dd>
                          {q.weightGrams} g · {q.purityLabel} {q.metal}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Melt when asked</dt>
                        <dd>{q.estimatePhp > 0 ? formatPeso(q.estimatePhp) : "No price then"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Melt now</dt>
                        <dd>{meltNow ? formatPeso(meltNow) : "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Branch · date</dt>
                        <dd>
                          {q.branch}
                          {q.preferredDate ? ` · ${formatManilaDate(q.preferredDate)}` : ""}
                        </dd>
                      </div>
                    </dl>
                    {q.notes ? <p className="mt-3 rounded-lg bg-surface-sunk px-3 py-2 text-sm whitespace-pre-line text-fg/85">{q.notes}</p> : null}
                    <p className="mt-2 text-xs text-muted">Received {formatManilaDateTime(q.createdAt)}</p>
                  </div>
                  <form key={q.status} action={setQuoteStatusAction} className="flex items-end gap-2 self-start">
                    <input type="hidden" name="id" value={q.id} />
                    <label className="grid gap-1 text-xs text-muted">
                      Status
                      <select
                        name="status"
                        defaultValue={q.status}
                        className="h-9 rounded-md border border-line bg-surface-sunk px-2.5 text-sm text-fg"
                      >
                        {QUOTE_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button type="submit" size="sm" variant="secondary">
                      Update
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
