"use client";

import { CalendarCheck, CheckCircle2, MapPin, MessageCircle, Scale } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useLiveMarket } from "@/components/prices/use-live-market";
import { Button } from "@/components/ui/button";
import { Field, FormAlert, Input, Select, Textarea } from "@/components/ui/field";
import { METALS, type Metal } from "@/config/catalog";
import { cn } from "@/lib/cn";
import { meltValuePhp, type Market } from "@/lib/market";
import { formatPeso } from "@/lib/pricing";
import { findPublicSpread, formatPerGram, marketStatus, parseAmount, purityOptions, roundEstimate, type PublicSpread } from "@/lib/prices-format";
import { requestSellQuote } from "./actions";
import { SELL_BRANCHES, type SellQuoteState } from "./schema";

const NEXT_STEPS = [
  { icon: MessageCircle, text: "The Luxx4less team contacts you to confirm the details and a time." },
  { icon: Scale, text: "At the branch the piece is weighed in front of you and tested to confirm the karat." },
  { icon: CheckCircle2, text: "You get an offer on the tested weight and karat at that day's price, and you're free to say no." },
];

export function SellFlow({ initial, spreads, today, latest }: { initial: Market; spreads: PublicSpread[]; today: string; latest: string }) {
  const { market, stale } = useLiveMarket(initial);
  const [state, formAction, pending] = useActionState<SellQuoteState, FormData>(requestSellQuote, { status: "idle" });

  const [metal, setMetal] = useState<Metal>("gold");
  const [purity, setPurity] = useState(18);
  const [weightRaw, setWeightRaw] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [branch, setBranch] = useState(SELL_BRANCHES[0]?.value ?? "");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  const options = purityOptions(metal);
  const fraction = options.find((o) => o.value === purity)?.fraction ?? null;
  const pure = market?.metals[metal]?.phpPerGram ?? null;
  const grams = parseAmount(weightRaw);
  const melt = pure && fraction && grams ? meltValuePhp(pure, grams, fraction) : null;
  const spread = findPublicSpread(spreads, metal, purity, "jewelry");
  const status = marketStatus(market, stale);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  if (state.status === "sent") {
    const chosen = SELL_BRANCHES.find((b) => b.label === state.branch);
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-champagne/40 bg-surface p-6 text-center shadow-[0_30px_80px_-40px_rgb(214_178_110/0.6)] sm:p-10" role="status">
        <CheckCircle2 className="mx-auto size-10 text-champagne" aria-hidden />
        <h2 className="mt-5 text-2xl text-fg sm:text-3xl">{state.firstName ? `Thank you, ${state.firstName}` : "Request received"}</h2>
        <p className="mt-3 text-muted">
          Your request is with the Luxx4less team{state.branch ? ` at the ${state.branch}` : ""}. Here&rsquo;s what happens next:
        </p>
        <ol className="mt-8 grid gap-5 text-left">
          {NEXT_STEPS.map(({ icon: Icon, text }, i) => (
            <li key={i} className="flex gap-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-full border border-champagne/40 text-champagne">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="pt-1.5 text-sm text-fg/90">{text}</span>
            </li>
          ))}
        </ol>
        {chosen ? <p className="mt-8 text-sm text-muted">{chosen.address}</p> : null}
        <p className="mt-6 text-xs text-muted">
          We will only contact you from our official numbers and pages. Never send money or your gold to anyone before it has been tested in store.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild variant="secondary">
            <Link href="/prices">Today&rsquo;s prices</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14" noValidate>
      <div className="grid content-start gap-12">
        {/* ----------------------------------------------------------- estimate */}
        <fieldset className="grid gap-5">
          <legend className="font-display text-xl text-fg">
            <span className="mr-3 text-champagne">1</span>What are you selling?
          </legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Metal">
            {METALS.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={metal === m.value}
                onClick={() => {
                  setMetal(m.value);
                  setPurity(m.value === "gold" ? 18 : (purityOptions(m.value)[0]?.value ?? 999));
                }}
                className={cn(
                  "h-10 rounded-full border px-4 text-sm font-semibold transition-colors",
                  metal === m.value ? "border-champagne bg-champagne text-velvet" : "border-line bg-surface text-fg hover:border-champagne/60",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <input type="hidden" name="metal" value={metal} />
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Field label={metal === "gold" ? "Karat" : "Fineness"} error={errors.purity} hint="As stamped on the piece. We confirm it by testing.">
              {(p) => (
                <Select {...p} name="purity" value={purity} onChange={(e) => setPurity(Number(e.target.value))}>
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label} · {(o.fraction * 100).toFixed(1)}%
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Weight in grams" error={errors.weightGrams ?? (weightRaw && !grams ? "Enter the weight in grams." : null)} hint="A kitchen scale is fine for an estimate.">
              {(p) => (
                <Input
                  {...p}
                  name="weightGrams"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="e.g. 12.5"
                  value={weightRaw}
                  onChange={(e) => setWeightRaw(e.target.value)}
                  className="tabular"
                  required
                />
              )}
            </Field>
          </div>
          {/* Phones: the estimate sits right under what you typed, not below the whole form. */}
          <div aria-live="polite" className="rounded-xl border border-champagne/30 bg-surface p-4 lg:hidden">
            <p className="text-xs text-muted">Instant estimate · melt value</p>
            <p className="tabular mt-1 font-display text-3xl text-gold-metal">{melt ? formatPeso(melt) : "—"}</p>
            <p className="mt-2 text-xs text-muted">
              {spread && melt
                ? `Our offer if it tests as stamped: about ${formatPeso(roundEstimate(melt * spread.buyRatio))}. Final offer in store.`
                : "Our offer is confirmed in store after weighing and testing. For reference, not an offer."}
            </p>
          </div>
        </fieldset>

        {/* ----------------------------------------------------------- request */}
        <fieldset className="grid gap-5">
          <legend className="font-display text-xl text-fg">
            <span className="mr-3 text-champagne">2</span>Ask for a quote and an appointment
          </legend>

          {state.status === "error" ? <FormAlert>{state.message}</FormAlert> : null}

          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Field label="Your name" error={errors.name}>
              {(p) => <Input {...p} name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />}
            </Field>
            <Field label="Mobile number or email" error={errors.contact} hint="So we can confirm your appointment.">
              {(p) => (
                <Input {...p} name="contact" autoComplete="tel" placeholder="0917 123 4567" value={contact} onChange={(e) => setContact(e.target.value)} required maxLength={254} />
              )}
            </Field>
          </div>

          <div className="grid gap-2" role="radiogroup" aria-label="Branch" aria-describedby={errors.branch ? "branch-error" : undefined}>
            <p className="text-sm font-semibold">Where would you like to bring it?</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {SELL_BRANCHES.map((b) => (
                <label
                  key={b.value}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                    branch === b.value ? "border-champagne/70 bg-gold-tint" : "border-line bg-surface hover:border-champagne/40",
                  )}
                >
                  <input type="radio" name="branch" value={b.value} checked={branch === b.value} onChange={() => setBranch(b.value)} className="sr-only" />
                  <MapPin className={cn("mt-0.5 size-4 shrink-0", branch === b.value ? "text-champagne" : "text-muted")} aria-hidden />
                  <span>
                    <span className="block font-semibold text-fg">{b.label}</span>
                    <span className="mt-1 block text-xs text-muted">{b.address}</span>
                  </span>
                </label>
              ))}
            </div>
            {errors.branch ? (
              <p id="branch-error" role="alert" className="text-sm font-medium text-danger">
                {errors.branch}
              </p>
            ) : null}
          </div>

          <div className="grid items-start gap-4 sm:grid-cols-[14rem_1fr]">
            <Field label="Preferred date (optional)" error={errors.preferredDate}>
              {(p) => <Input {...p} type="date" name="preferredDate" min={today} max={latest} value={date} onChange={(e) => setDate(e.target.value)} className="tabular" />}
            </Field>
            <Field label="Anything we should know? (optional)" error={errors.notes}>
              {(p) => (
                <Textarea
                  {...p}
                  name="notes"
                  rows={3}
                  maxLength={1000}
                  placeholder="e.g. two 18K Saudi rings and a broken chain, with receipt"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-12"
                />
              )}
            </Field>
          </div>

          {/* Honeypot: hidden from people and assistive tech; bots fill it in. */}
          <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label>
              Website
              <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" size="lg" disabled={pending}>
              <CalendarCheck aria-hidden />
              {pending ? "Sending…" : "Request my quote"}
            </Button>
            <p className="max-w-sm text-xs text-muted">No obligation. We use your details only to arrange this appointment.</p>
          </div>
        </fieldset>
      </div>

      {/* ------------------------------------------------------------- summary */}
      <aside aria-live="polite" className="hidden lg:sticky lg:top-28 lg:block lg:self-start">
        <div className="rounded-2xl border border-champagne/30 bg-surface p-6 shadow-[0_24px_60px_-36px_rgb(214_178_110/0.55)]">
          <p className="text-sm text-muted">Instant estimate · melt value</p>
          <p className="tabular mt-1 font-display text-4xl text-gold-metal">{melt ? formatPeso(melt) : "—"}</p>
          <p className="tabular mt-2 text-xs text-muted">
            {pure && fraction ? `${formatPerGram(pure * fraction)} per gram at ${options.find((o) => o.value === purity)?.label}` : "Enter the weight to see an estimate."}
          </p>

          <div className="mt-6 border-t border-line pt-5 text-sm">
            {spread && melt ? (
              <>
                <p className="text-muted">Our offer, if it tests as stamped</p>
                <p className="tabular mt-1 text-2xl font-semibold text-fg">≈ {formatPeso(roundEstimate(melt * spread.buyRatio))}</p>
                <p className="mt-2 text-xs text-muted">
                  Today&rsquo;s Luxx4less buying rate for jewellery: {(spread.buyRatio * 100).toFixed(1)}% of melt value. The final offer is made in
                  store on the tested weight and karat.
                </p>
              </>
            ) : (
              <p className="text-muted">
                Our offer is confirmed in store, after we weigh and test the piece. It depends on the tested karat and weight and the price
                on the day.
              </p>
            )}
          </div>
          <p className={cn("tabular mt-5 text-xs", status.tone === "delayed" || status.tone === "none" ? "text-warning" : "text-muted")}>{status.text}</p>
          <p className="mt-2 text-xs text-muted">An estimate for reference, not an offer.</p>
        </div>
      </aside>
    </form>
  );
}
