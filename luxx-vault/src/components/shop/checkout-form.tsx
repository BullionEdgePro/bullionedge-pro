"use client";

import { Check, HandCoins, Lock, Radio } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { ActionForm, SubmitButton } from "@/components/marketplace/action-form";
import { MediaImage } from "@/components/marketplace/media-image";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { LocationPicker } from "@/components/ui/location-picker";
import { cn } from "@/lib/cn";
import { formatPeso } from "@/lib/pricing";
import {
  FULFILMENTS,
  PAYMENT_METHODS,
  checkoutProblem,
  checkoutTierNeeded,
  layawaySchedule,
  orderTotals,
  type Fulfilment,
  type PaymentMethod,
  type Plan,
  type ShopRules,
} from "@/lib/shop";
import { placeOrder } from "@/lib/server/shop/actions";

type Line = { code: string; title: string; quantity: number; unitPricePhp: number; coverUrl: string | null; live: boolean; layawayAllowed: boolean };

const DAY = 86_400_000;
const dateFmt = new Intl.DateTimeFormat("en-PH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Manila" });

/**
 * Checkout: how you'll get it, how you'll pay, in full or on layaway, and who
 * to contact. Choices that don't go together are greyed out with the reason
 * (the same rules the server applies), and the summary follows every change.
 */
export function CheckoutForm({
  lines,
  rules,
  reserveDays,
  deliveryFeePhp,
  transferReady,
  branches,
  tier,
  defaults,
  now,
}: {
  lines: Line[];
  rules: ShopRules;
  reserveDays: number;
  deliveryFeePhp: number | null;
  transferReady: boolean;
  branches: { name: string; address: string }[];
  tier: number;
  /** Server time when the page was made, for the layaway dates preview. */
  now: number;
  defaults: { contactName: string; contactPhone: string; regionCode: string; provinceCode: string; cityCode: string };
}) {
  const [fulfilment, setFulfilment] = useState<Fulfilment>("pickup");
  const [method, setMethod] = useState<PaymentMethod>("in_store");
  const [plan, setPlan] = useState<Plan>("full");
  const allLayaway = lines.every((l) => l.layawayAllowed);

  const totals = useMemo(() => orderTotals(lines, fulfilment === "delivery" ? (deliveryFeePhp ?? 0) : 0), [lines, fulfilment, deliveryFeePhp]);
  const ctx = { totalPhp: totals.totalPhp, allLayawayAllowed: allLayaway, rules };
  const why = (m: PaymentMethod, f: Fulfilment = fulfilment, p: Plan = plan): string | null => {
    if (m === "transfer" && !transferReady) return "Not set up yet: choose another way to pay.";
    return checkoutProblem({ plan: p, paymentMethod: m, fulfilment: f }, ctx);
  };
  const layawayWhy = (() => {
    const anyOk = (Object.keys(PAYMENT_METHODS) as PaymentMethod[]).some((m) => why(m, fulfilment, "layaway") === null);
    if (!rules.layawayEnabled) return "Not available right now.";
    if (!allLayaway) return "A piece in your bag can't go on layaway.";
    if (totals.totalPhp < rules.layawayMinPhp) return `Starts at ${formatPeso(rules.layawayMinPhp)}.`;
    return anyOk ? null : "Pay in store or by transfer to use layaway.";
  })();

  // Keep the three choices compatible: change one, and the others follow to the first that works.
  const pickMethod = (f: Fulfilment, p: Plan) => {
    if (why(method, f, p) === null) return;
    const next = (Object.keys(PAYMENT_METHODS) as PaymentMethod[]).find((m) => why(m, f, p) === null);
    if (next) setMethod(next);
  };
  const onFulfilment = (f: Fulfilment) => {
    setFulfilment(f);
    pickMethod(f, plan);
  };
  const onPlan = (p: Plan) => {
    setPlan(p);
    pickMethod(fulfilment, p);
  };

  const schedule = plan === "layaway" && layawayWhy === null ? layawaySchedule(totals.totalPhp, rules.layawayDownPct, rules.layawayMonths, new Date(now), new Date(now + reserveDays * DAY)) : null;
  const methodProblem = why(method);
  const needsId = tier < checkoutTierNeeded(totals.totalPhp);

  return (
    <ActionForm action={placeOrder} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      {({ fieldErrors }) => (
        <>
          <input type="hidden" name="fulfilment" value={fulfilment} />
          <input type="hidden" name="paymentMethod" value={method} />
          <input type="hidden" name="plan" value={plan} />
          <input type="hidden" name="expectedTotal" value={totals.totalPhp} />

          <div className="grid content-start gap-8">
            <Step n={1} title="How you'll get it">
              <div className="grid gap-2 sm:grid-cols-3">
                {(Object.keys(FULFILMENTS) as Fulfilment[]).map((f) => (
                  <Choice key={f} name="fulfilment-choice" checked={fulfilment === f} onSelect={() => onFulfilment(f)} title={FULFILMENTS[f].label} body={FULFILMENTS[f].body} />
                ))}
              </div>
              {fulfilment === "pickup" && (
                <Field label="Branch" error={fieldErrors.branch}>
                  {(p) => (
                    <Select {...p} name="branch" defaultValue={branches[0]?.name}>
                      {branches.map((b) => (
                        <option key={b.name} value={b.name}>
                          {b.name}: {b.address}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              )}
              {fulfilment === "delivery" && (
                <div className="grid gap-4">
                  <Field label="House number, street and barangay" error={fieldErrors.addressLine}>
                    {(p) => <Input {...p} name="addressLine" autoComplete="street-address" placeholder="e.g. 12 Sampaguita St., Brgy. San Roque" />}
                  </Field>
                  <LocationPicker defaultRegion={defaults.regionCode} defaultProvince={defaults.provinceCode} defaultCity={defaults.cityCode} errors={{ city: fieldErrors.cityCode }} />
                  <p className="text-xs text-muted">
                    {deliveryFeePhp === null ? "We'll confirm the delivery fee with you before sending." : deliveryFeePhp > 0 ? `Delivery fee ${formatPeso(deliveryFeePhp)}, insured with tracking.` : "Free insured delivery with tracking."}
                  </p>
                </div>
              )}
            </Step>

            <Step n={2} title="In full or on layaway">
              <div className="grid gap-2 sm:grid-cols-2">
                <Choice name="plan-choice" checked={plan === "full"} onSelect={() => onPlan("full")} title="Pay in full" body="One payment, and it's yours." />
                <Choice
                  name="plan-choice"
                  checked={plan === "layaway"}
                  onSelect={() => onPlan("layaway")}
                  disabled={layawayWhy !== null}
                  title={`Layaway (hulugan)`}
                  body={layawayWhy ?? `${rules.layawayDownPct}% down reserves it, then ${rules.layawayMonths} monthly payments.`}
                  icon={<HandCoins className="size-4 text-champagne" aria-hidden />}
                />
              </div>
              {schedule && (
                <ol className="grid gap-1.5 rounded-xl border border-line bg-surface-sunk/50 p-4 text-sm tabular">
                  {schedule.map((i) => (
                    <li key={i.seq} className="flex justify-between gap-3">
                      <span className="text-muted">{i.seq === 0 ? `Down payment, by ${dateFmt.format(i.dueAt)}` : `Payment ${i.seq}, ${dateFmt.format(i.dueAt)}`}</span>
                      <span className={cn("font-semibold", i.seq === 0 && "text-gold")}>{formatPeso(i.amountPhp)}</span>
                    </li>
                  ))}
                  <li className="mt-1 border-t border-line pt-2 text-xs text-muted">The pieces stay reserved for you until the last payment, then they&rsquo;re yours to collect or have delivered.</li>
                </ol>
              )}
            </Step>

            <Step n={3} title="How you'll pay">
              <div className="grid gap-2 sm:grid-cols-3">
                {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((m) => {
                  const problem = why(m);
                  return <Choice key={m} name="method-choice" checked={method === m} onSelect={() => setMethod(m)} disabled={problem !== null} title={PAYMENT_METHODS[m].label} body={problem ?? PAYMENT_METHODS[m].body} />;
                })}
              </div>
              {method === "in_store" && <p className="text-sm text-muted">We hold your order for {reserveDays} days. Bring a valid ID when you pick it up.</p>}
              {method === "transfer" && (
                <p className="flex gap-2 text-sm text-muted">
                  <Lock className="mt-0.5 size-4 shrink-0 text-champagne" aria-hidden />
                  Our GCash and bank details appear on your order page, only for you, after you place the order. Pay within {reserveDays} days.
                </p>
              )}
              {method === "cod" && <p className="text-sm text-muted">We&rsquo;ll call you to confirm before sending. Have the exact amount ready.</p>}
            </Step>

            <Step n={4} title="Who we contact">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" error={fieldErrors.contactName}>
                  {(p) => <Input {...p} name="contactName" autoComplete="name" defaultValue={defaults.contactName} />}
                </Field>
                <Field label="Mobile number" error={fieldErrors.contactPhone}>
                  {(p) => <Input {...p} name="contactPhone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0917 123 4567" defaultValue={defaults.contactPhone} />}
                </Field>
              </div>
              <Field
                label={fulfilment === "meetup" ? "Where and when suits you" : "Note for us (optional)"}
                hint={fulfilment === "meetup" ? "e.g. SM Megamall, weekday evenings. We'll call to agree on a safe public place." : "Ring size, gift wrapping, a time to call…"}
                error={fieldErrors.buyerNote}
              >
                {(p) => <Textarea {...p} name="buyerNote" maxLength={500} className="min-h-20" />}
              </Field>
            </Step>
          </div>

          <aside className="grid content-start gap-4 rounded-2xl border border-champagne/30 bg-[linear-gradient(160deg,rgb(214_178_110/0.08),transparent_60%)] p-5 lg:sticky lg:top-28">
            <h2 className="font-display text-sm tracking-[0.2em] text-champagne uppercase">Your order</h2>
            <ul className="grid gap-3">
              {lines.map((l) => (
                <li key={l.code} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                  <MediaImage src={l.coverUrl} alt={l.title} sizes="48px" className="aspect-square rounded-lg" />
                  <span className="min-w-0">
                    <span className="line-clamp-1 font-semibold">{l.title}</span>
                    <span className="text-xs text-muted tabular">
                      {l.quantity > 1 ? `${l.quantity} × ` : ""}
                      {l.code}
                      {l.live && <Radio className="ml-1 inline size-3 text-champagne" aria-label="live price" />}
                    </span>
                  </span>
                  <span className="font-semibold tabular">{formatPeso(l.unitPricePhp * l.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="grid gap-1.5 border-t border-line pt-3 text-sm tabular">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd>{formatPeso(totals.subtotalPhp)}</dd>
              </div>
              {fulfilment === "delivery" && (
                <div className="flex justify-between">
                  <dt className="text-muted">Delivery</dt>
                  <dd>{deliveryFeePhp === null ? "To confirm" : deliveryFeePhp > 0 ? formatPeso(deliveryFeePhp) : "Free"}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-line pt-2">
                <dt className="font-semibold">Total</dt>
                <dd className="font-display text-3xl text-gold-metal">{formatPeso(totals.totalPhp, true)}</dd>
              </div>
              {schedule && (
                <div className="flex justify-between text-champagne">
                  <dt>Due now (down payment)</dt>
                  <dd className="font-semibold">{formatPeso(schedule[0]!.amountPhp)}</dd>
                </div>
              )}
            </dl>
            {lines.some((l) => l.live) && <p className="text-xs text-muted">Live-priced pieces lock at these prices when you place the order.</p>}
            {needsId && <p className="rounded-xl bg-warning-tint px-3 py-2 text-sm text-warning">Orders over ₱100,000 need an ID-verified account.</p>}
            <SubmitButton size="lg" className="w-full" disabled={methodProblem !== null || needsId} pendingLabel="Placing your order…">
              <Check aria-hidden /> Place order
            </SubmitButton>
            <p className="text-xs text-muted">Placing the order reserves the pieces for you. You can cancel it until you&rsquo;ve paid.</p>
          </aside>
        </>
      )}
    </ActionForm>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4">
      <h2 className="flex items-center gap-3 text-xl text-fg">
        <span className="grid size-8 place-items-center rounded-full border border-champagne/50 font-display text-sm text-champagne tabular">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Choice({ name, checked, onSelect, title, body, disabled = false, icon }: { name: string; checked: boolean; onSelect: () => void; title: string; body: string; disabled?: boolean; icon?: ReactNode }) {
  return (
    <label
      className={cn(
        "relative grid cursor-pointer gap-1 rounded-xl border p-4 transition-[border-color,background-color,box-shadow] duration-300",
        checked ? "border-champagne bg-gold-tint shadow-[0_0_0_1px_rgb(214_178_110/0.35),0_10px_26px_-16px_rgb(214_178_110/0.6)]" : "border-line bg-surface hover:border-gold-large/60",
        disabled && "cursor-not-allowed opacity-50 hover:border-line",
      )}
    >
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={onSelect} className="sr-only" />
      <span className="flex items-center gap-2 text-sm font-semibold text-fg">
        {icon}
        {title}
        {checked && <Check className="ml-auto size-4 text-champagne" aria-hidden />}
      </span>
      <span className="text-xs leading-snug text-muted">{body}</span>
    </label>
  );
}
