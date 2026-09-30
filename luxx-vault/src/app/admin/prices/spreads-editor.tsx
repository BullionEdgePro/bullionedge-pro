"use client";

import { AlertTriangle } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/field";
import { METALS, type Metal } from "@/config/catalog";
import { cn } from "@/lib/cn";
import { formatPerGram, purityOptions } from "@/lib/prices-format";
import { saveSpreadsAction, type SpreadsState } from "./actions";
import { PRODUCT_TYPES, checkSpreadRow, spreadKey, type ProductType } from "./spread-rules";

const pctInput =
  "tabular h-10 w-full rounded-lg border border-line bg-surface-sunk px-3 text-right text-sm text-fg placeholder:text-muted/50 hover:border-gold-large/50 focus-visible:border-ring aria-invalid:border-danger";

/**
 * The owner's "we buy / we sell" rates as a percent of melt value, per metal
 * purity and per product type, with a live ₱/g preview at today's price.
 * Empty rows mean "no public price": the site then says offers are made in store.
 */
export function SpreadsEditor({ initial, pure }: { initial: Record<string, string>; pure: Record<Metal, number | null> }) {
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [tab, setTab] = useState<ProductType>("jewelry");
  const [state, action, pending] = useActionState<SpreadsState, FormData>(saveSpreadsAction, { status: "idle" });
  const serverErrors = state.status === "error" ? state.rowErrors : {};

  const set = (name: string, v: string) => setValues((cur) => ({ ...cur, [name]: v }));

  return (
    <form action={action} className="grid gap-6">
      <div role="tablist" aria-label="Product type" className="inline-flex w-fit rounded-full border border-line bg-surface-sunk p-1">
        {PRODUCT_TYPES.map((p) => (
          <button
            key={p.value}
            type="button"
            role="tab"
            aria-selected={tab === p.value}
            aria-controls={`panel-${p.value}`}
            onClick={() => setTab(p.value)}
            className={cn("h-9 rounded-full px-4 text-sm font-semibold transition-colors", tab === p.value ? "bg-champagne text-velvet" : "text-muted hover:text-fg")}
          >
            {p.label}
          </button>
        ))}
      </div>

      {PRODUCT_TYPES.map((p) => (
        // Both panels stay in the form so saving one tab never clears the other.
        <div key={p.value} id={`panel-${p.value}`} role="tabpanel" hidden={tab !== p.value} className="grid gap-8">
          {METALS.map((m) => (
            <fieldset key={m.value} className="rounded-xl border border-line bg-surface p-4 sm:p-5">
              <legend className="px-2 font-display text-sm tracking-[0.14em] text-champagne uppercase">{m.label}</legend>
              <div className="hidden grid-cols-[5rem_7rem_1fr_1fr_minmax(0,1.4fr)] gap-3 px-1 pb-2 text-xs text-muted md:grid">
                <span>Purity</span>
                <span className="text-right">Melt ₱/g</span>
                <span className="text-right">We buy, % of melt</span>
                <span className="text-right">We sell, % of melt</span>
                <span>Preview at today&rsquo;s price</span>
              </div>
              <div className="grid gap-3 md:gap-2">
                {purityOptions(m.value).map((o) => {
                  const key = spreadKey(m.value, o.value, p.value);
                  const buyName = `buy:${key}`;
                  const sellName = `sell:${key}`;
                  const check = checkSpreadRow(values[buyName] ?? "", values[sellName] ?? "");
                  const melt = pure[m.value] ? pure[m.value]! * o.fraction : null;
                  const error = check.kind === "error" ? check.message : serverErrors[key];
                  return (
                    <div key={key} className="grid grid-cols-2 items-center gap-x-3 gap-y-2 rounded-lg border border-line/60 p-3 md:grid-cols-[5rem_7rem_1fr_1fr_minmax(0,1.4fr)] md:border-0 md:p-1">
                      <span className="font-display text-base text-fg">{o.label}</span>
                      <span className="tabular text-right text-sm text-muted">{formatPerGram(melt)}</span>
                      <label className="grid gap-1 text-xs text-muted md:block">
                        <span className="md:sr-only">We buy (% of melt) for {o.label}</span>
                        <input
                          name={buyName}
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder="—"
                          value={values[buyName] ?? ""}
                          onChange={(e) => set(buyName, e.target.value)}
                          aria-invalid={error ? true : undefined}
                          className={pctInput}
                        />
                      </label>
                      <label className="grid gap-1 text-xs text-muted md:block">
                        <span className="md:sr-only">We sell (% of melt) for {o.label}</span>
                        <input
                          name={sellName}
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder="—"
                          value={values[sellName] ?? ""}
                          onChange={(e) => set(sellName, e.target.value)}
                          aria-invalid={error ? true : undefined}
                          className={pctInput}
                        />
                      </label>
                      <div className="col-span-2 text-xs md:col-span-1" aria-live="polite">
                        {error ? (
                          <p className="font-medium text-danger">{error}</p>
                        ) : check.kind === "ok" ? (
                          <>
                            <p className="tabular text-fg">
                              Buy {formatPerGram(melt ? melt * check.buyRatio : null)} · Sell {formatPerGram(melt ? melt * check.sellRatio : null)}
                            </p>
                            {check.warnings.map((w) => (
                              <p key={w} className="mt-0.5 flex items-center gap-1 text-warning">
                                <AlertTriangle className="size-3" aria-hidden /> {w}
                              </p>
                            ))}
                          </>
                        ) : (
                          <p className="text-muted">Not set · shown as &ldquo;confirmed in store&rdquo;</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      ))}

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface/95 p-4 backdrop-blur">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save spreads"}
        </Button>
        <div className="min-w-0 flex-1">
          {state.status === "saved" ? (
            <FormAlert tone="success">{state.changed ? `Saved ${state.changed} change${state.changed === 1 ? "" : "s"}. The public prices update at once.` : "No changes to save."}</FormAlert>
          ) : state.status === "error" ? (
            <FormAlert>{state.message}</FormAlert>
          ) : (
            <p className="text-xs text-muted">Both tabs are saved together. Leave a row blank to show no public price for it.</p>
          )}
        </div>
      </div>
    </form>
  );
}
