"use client";

import { AlertTriangle, Check, ChevronLeft, ChevronRight, Radio, Tag } from "lucide-react";
import { motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useActionState, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormAlert, Input, Select, Textarea } from "@/components/ui/field";
import { LocationPicker } from "@/components/ui/location-picker";
import { BELOW_MELT_WARNING, CATEGORIES, FORMS, GOLD_KARATS, GOLD_TYPES, OTHER_FINENESS, type Metal } from "@/config/catalog";
import { cn } from "@/lib/cn";
import { formatPeso } from "@/lib/pricing";
import { saveListing } from "@/lib/server/marketplace/actions/listings";
import { itemLabel } from "@/lib/server/marketplace/describe";
import { DESCRIPTION_MAX, MAX_PHOTOS, TITLE_MAX } from "@/lib/server/marketplace/listing-input";
import { premiumLabel, suggestedPremiumRange, valueItem, type SpotTable } from "@/lib/server/marketplace/valuation";
import { SubmitButton } from "./action-form";
import { PhotoUploader, type UploadedPhoto } from "./photo-uploader";

export type WizardDefaults = {
  code?: string;
  photos: UploadedPhoto[];
  title: string;
  category: string;
  metal: string;
  karat: string;
  finenessPermille: string;
  goldType: string;
  form: string;
  weightGrams: string;
  pricingMode: "fixed" | "spot_premium";
  pricePhp: string;
  premiumPct: string;
  openToOffers: boolean;
  description: string;
  hasCertificate: boolean;
  hasReceipt: boolean;
  pawnable: "yes" | "no" | "unknown";
  regionCode: string;
  provinceCode: string;
  cityCode: string;
};

const STEPS = [
  { key: "photos", title: "Photos", fields: ["photos"] },
  { key: "item", title: "The piece", fields: ["title", "category", "metal", "karat", "finenessPermille", "goldType", "form", "weightGrams"] },
  { key: "price", title: "Price", fields: ["pricingMode", "pricePhp", "premiumPct", "acknowledgeBelowMelt"] },
  { key: "details", title: "Details", fields: ["description", "regionCode", "cityCode", "hasCertificate"] },
  { key: "publish", title: "Publish", fields: ["declaration"] },
] as const;

const num = (s: string) => {
  const n = Number(s.replace(/[,₱\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

/**
 * The listing wizard: photos → the piece → price → details → publish. One
 * form across five steps (every value submits together), with the live melt
 * value and a suggested range beside the price. The server re-checks and
 * re-prices everything on publish.
 */
export function SellWizard({
  defaults,
  spot,
  pricesDelayed,
  limits,
}: {
  defaults: WizardDefaults;
  spot: SpotTable;
  pricesDelayed: boolean;
  limits: { newSeller: boolean; maxListingValuePhp: number; activeCount: number; maxActive: number; tradesToGraduate: number; sales: number };
}) {
  const editing = Boolean(defaults.code);
  const [state, formAction] = useActionState(saveListing, null);
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<UploadedPhoto[]>(defaults.photos);
  const [category, setCategory] = useState(defaults.category);
  const [metalChoice, setMetalChoice] = useState(defaults.metal);
  const [karat, setKarat] = useState(defaults.karat);
  const [fineness, setFineness] = useState(defaults.finenessPermille);
  const [goldType, setGoldType] = useState(defaults.goldType);
  const [form, setForm] = useState(defaults.form);
  const [weight, setWeight] = useState(defaults.weightGrams);
  const [title, setTitle] = useState(defaults.title);
  const [titleTouched, setTitleTouched] = useState(Boolean(defaults.title));
  const [mode, setMode] = useState<"fixed" | "spot_premium">(defaults.pricingMode);
  const [price, setPrice] = useState(defaults.pricePhp);
  const [premium, setPremium] = useState(defaults.premiumPct);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const topRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const cat = CATEGORIES.find((c) => c.value === category);
  const metal = (cat?.metal ?? (metalChoice || "")) as Metal | "";
  const permille = metal === "gold" ? GOLD_KARATS.find((k) => String(k.karat) === karat)?.permille : Number(fineness) || undefined;
  const grams = num(weight);

  const suggestedTitle = useMemo(() => {
    if (!category) return "";
    const base = itemLabel({ category, metal: metal || null, karat: metal === "gold" ? Number(karat) || null : null, finenessPermille: metal && metal !== "gold" ? Number(fineness) || null : null, goldType, form });
    return grams > 0 ? `${base}, ${grams} g` : base;
  }, [category, metal, karat, fineness, goldType, form, grams]);
  const shownTitle = titleTouched ? title : suggestedTitle;

  const valuation = useMemo(
    () =>
      valueItem(
        {
          metal: metal || null,
          karat: metal === "gold" ? Number(karat) || null : null,
          finenessPermille: permille ?? null,
          weightGrams: grams > 0 ? grams : 0,
          pricingMode: mode,
          pricePhp: mode === "fixed" ? num(price) || null : null,
          premiumPct: mode === "spot_premium" && premium !== "" ? num(premium) : null,
        },
        spot,
      ),
    [metal, karat, permille, grams, mode, price, premium, spot],
  );
  const range = suggestedPremiumRange(category, form);
  const overLimit = limits.newSeller && valuation.pricePhp !== null && valuation.pricePhp > limits.maxListingValuePhp;

  // Server errors: jump to the first step that holds one.
  const serverErrors = useMemo(() => state?.fieldErrors ?? {}, [state]);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    const keys = Object.keys(state?.fieldErrors ?? {});
    const idx = STEPS.findIndex((s) => (s.fields as readonly string[]).some((f) => keys.includes(f)));
    if (idx >= 0) setStep(idx);
  }
  const errors = { ...serverErrors, ...localErrors };

  const validate = (i: number): Record<string, string> => {
    const e: Record<string, string> = {};
    if (i === 0 && photos.length === 0) e.photos = "Add at least one clear photo. The first one is the cover.";
    if (i === 1) {
      if (!category) e.category = "Choose a category.";
      if (metal === "gold" && !karat) e.karat = "Choose the karat.";
      if (metal && metal !== "gold" && !fineness) e.finenessPermille = "Choose the fineness.";
      if (!(grams > 0)) e.weightGrams = "Enter the exact weight in grams.";
      if (shownTitle.trim().length < 6) e.title = "Give it a title of at least 6 characters.";
    }
    if (i === 2) {
      if (mode === "fixed" && !(num(price) >= 100)) e.pricePhp = "Enter your price in pesos.";
      if (mode === "spot_premium" && (premium === "" || Number.isNaN(num(premium)))) e.premiumPct = "Enter the premium over melt, e.g. 8.";
    }
    return e;
  };

  const go = (to: number) => {
    if (to > step) {
      for (let i = step; i < to; i++) {
        const e = validate(i);
        if (Object.keys(e).length) {
          setLocalErrors(e);
          setStep(i);
          return;
        }
      }
    }
    setLocalErrors({});
    setStep(to);
    topRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  const choice = (active: boolean) =>
    cn(
      "rounded-xl border px-4 py-3 text-left text-sm transition-[border-color,background-color,box-shadow] duration-300",
      active ? "border-champagne bg-gold-tint text-champagne shadow-[0_0_0_1px_rgb(214_178_110/0.35)]" : "border-line bg-surface text-fg hover:border-gold-large/60",
    );
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold transition-colors tabular",
      active ? "border-champagne bg-gold-tint text-champagne" : "border-line text-fg/85 hover:border-gold-large/60",
    );

  return (
    <div ref={topRef} className="scroll-mt-32">
      {/* Progress: a gold thread through five settings. */}
      <ol className="mb-8 grid grid-cols-5 gap-2" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s.key}>
            <button type="button" onClick={() => (i < step ? go(i) : undefined)} disabled={i > step} className="group grid w-full gap-2 text-left disabled:cursor-default" aria-current={i === step ? "step" : undefined}>
              <span className={cn("h-0.5 rounded-full transition-colors duration-500", i <= step ? "bg-champagne" : "bg-line")} />
              <span className={cn("flex items-center gap-1.5 text-xs font-semibold", i === step ? "text-champagne" : i < step ? "text-fg" : "text-muted")}>
                {i < step ? <Check className="size-3.5" aria-hidden /> : <span className="tabular">{i + 1}</span>}
                <span className="hidden sm:inline">{s.title}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      <form
        action={formAction}
        noValidate
        className="grid gap-8"
        onKeyDown={(e) => {
          // Enter moves to the next step instead of publishing early.
          if (e.key === "Enter" && step < STEPS.length - 1 && e.target instanceof HTMLInputElement) {
            e.preventDefault();
            go(step + 1);
          }
        }}
      >
        {defaults.code && <input type="hidden" name="code" value={defaults.code} />}

        {/* -------------------------------------------------- 1 photos */}
        <Step active={step === 0} reduce={Boolean(reduce)} title="Show it clearly" lead="Daylight, a plain background, the hallmark and the piece on a scale. Up to 8 photos; drag to reorder. Each photo is stamped with the Luxx4less watermark and your listing code.">
          <PhotoUploader name="photos" purpose="listing" max={MAX_PHOTOS} initial={defaults.photos} onChange={setPhotos} error={errors.photos} hint="Photos are re-encoded and every bit of location data is removed." />
        </Step>

        {/* -------------------------------------------------- 2 the piece */}
        <Step active={step === 1} reduce={Boolean(reduce)} title="What are you selling?" lead="Exact details build trust and let buyers filter to your piece.">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Category</legend>
            <input type="hidden" name="category" value={category} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CATEGORIES.map((c) => (
                <button key={c.value} type="button" aria-pressed={category === c.value} onClick={() => setCategory(c.value)} className={choice(category === c.value)}>
                  {c.label}
                </button>
              ))}
            </div>
            {errors.category && <p className="mt-2 text-sm text-danger" role="alert">{errors.category}</p>}
          </fieldset>

          {category && !cat?.metal && (
            <Field label="Precious metal in it (optional)" hint="For settings and antiques: lets buyers see a melt value.">
              {(p) => (
                <Select {...p} name="metal" value={metalChoice} onChange={(e) => setMetalChoice(e.target.value)}>
                  <option value="">None, or not sure</option>
                  <option value="gold">Gold</option>
                  <option value="silver">Silver</option>
                  <option value="platinum">Platinum</option>
                  <option value="palladium">Palladium</option>
                </Select>
              )}
            </Field>
          )}
          {cat?.metal && <input type="hidden" name="metal" value={cat.metal} />}

          {metal === "gold" && (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Karat</legend>
              <input type="hidden" name="karat" value={karat} />
              <div className="flex flex-wrap gap-2">
                {GOLD_KARATS.map((k) => (
                  <button key={k.karat} type="button" aria-pressed={karat === String(k.karat)} onClick={() => setKarat(String(k.karat))} className={chip(karat === String(k.karat))}>
                    {k.karat}K <span className="ml-1.5 text-xs font-normal opacity-70">{k.permille}</span>
                  </button>
                ))}
              </div>
              {errors.karat && <p className="mt-2 text-sm text-danger" role="alert">{errors.karat}</p>}
            </fieldset>
          )}
          {metal && metal !== "gold" && (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Fineness</legend>
              <input type="hidden" name="finenessPermille" value={fineness} />
              <div className="flex flex-wrap gap-2">
                {OTHER_FINENESS[metal].map((f) => (
                  <button key={f} type="button" aria-pressed={fineness === String(f)} onClick={() => setFineness(String(f))} className={chip(fineness === String(f))}>
                    {f}
                  </button>
                ))}
              </div>
              {errors.finenessPermille && <p className="mt-2 text-sm text-danger" role="alert">{errors.finenessPermille}</p>}
            </fieldset>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {metal === "gold" && (
              <Field label="Gold type" hint="Where it was made, as buyers ask.">
                {(p) => (
                  <Select {...p} name="goldType" value={goldType} onChange={(e) => setGoldType(e.target.value)}>
                    <option value="">Not sure</option>
                    {GOLD_TYPES.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            <Field label="Form" error={errors.form}>
              {(p) => (
                <Select {...p} name="form" value={form} onChange={(e) => setForm(e.target.value)}>
                  <option value="">Choose…</option>
                  {FORMS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Exact weight (grams)" hint="Weighed on a calibrated scale, to 0.01 g if you can." error={errors.weightGrams}>
              {(p) => <Input {...p} name="weightGrams" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="12.40" className="tabular" required />}
            </Field>
          </div>

          <Field label="Title" hint={titleTouched ? `${shownTitle.length}/${TITLE_MAX}` : "Suggested from your details. Edit it freely."} error={errors.title}>
            {(p) => (
              <Input
                {...p}
                name="title"
                value={shownTitle}
                maxLength={TITLE_MAX}
                onChange={(e) => {
                  setTitleTouched(true);
                  setTitle(e.target.value);
                }}
                required
              />
            )}
          </Field>
        </Step>

        {/* -------------------------------------------------- 3 price */}
        <Step active={step === 2} reduce={Boolean(reduce)} title="Set your price" lead="Buyers see your price next to today's melt value, so a fair premium sells faster.">
          <input type="hidden" name="pricingMode" value={mode} />
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" aria-pressed={mode === "fixed"} onClick={() => setMode("fixed")} className={choice(mode === "fixed")}>
              <span className="flex items-center gap-2 font-semibold">
                <Tag className="size-4" aria-hidden /> Fixed price
              </span>
              <span className="mt-1 block text-xs text-muted">One price in pesos. Best for designer pieces and stones.</span>
            </button>
            <button type="button" aria-pressed={mode === "spot_premium"} onClick={() => setMode("spot_premium")} disabled={!metal || !permille} className={cn(choice(mode === "spot_premium"), "disabled:opacity-50")}>
              <span className="flex items-center gap-2 font-semibold">
                <Radio className="size-4" aria-hidden /> Melt + a premium
              </span>
              <span className="mt-1 block text-xs text-muted">{metal && permille ? "Re-prices itself as spot moves, like a live-selling per-gram price." : "Needs a metal and its purity."}</span>
            </button>
          </div>
          {errors.pricingMode && <p className="text-sm text-danger" role="alert">{errors.pricingMode}</p>}

          <div className="grid gap-5 rounded-2xl border border-line bg-surface-sunk/60 p-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">Melt value today</p>
              <p className="mt-1 font-display text-3xl text-fg tabular">{valuation.meltPhp !== null ? formatPeso(valuation.meltPhp) : "—"}</p>
              <p className="mt-1 text-xs text-muted">
                {valuation.meltPhp !== null
                  ? `${grams} g × ${((permille ?? 0) / 1000).toFixed(3)} × ${formatPeso(spot[metal as Metal] ?? 0, true)}/g pure${pricesDelayed ? " · prices delayed" : ""}`
                  : !metal
                    ? "No metal content to value."
                    : "Add the weight and purity to see it."}
              </p>
              {valuation.meltPhp !== null && (
                <p className="mt-3 text-xs text-muted">
                  A common range for {itemLabel({ category, form }).toLowerCase()}:{" "}
                  <span className="font-semibold text-fg tabular">
                    {formatPeso(valuation.meltPhp * (1 + range.low / 100))} – {formatPeso(valuation.meltPhp * (1 + range.high / 100))}
                  </span>{" "}
                  ({range.low >= 0 ? "+" : ""}
                  {range.low}% to +{range.high}%). A starting point, not a valuation.
                </p>
              )}
            </div>
            <div className="grid content-start gap-3">
              {mode === "fixed" ? (
                <Field label="Your price (₱)" error={errors.pricePhp}>
                  {(p) => <Input {...p} name="pricePhp" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="75000" className="tabular" required />}
                </Field>
              ) : (
                <Field label="Premium over melt (%)" hint="e.g. 8 for melt + 8%. Negative is allowed for scrap." error={errors.premiumPct}>
                  {(p) => <Input {...p} name="premiumPct" inputMode="decimal" value={premium} onChange={(e) => setPremium(e.target.value)} placeholder="8" className="tabular" required />}
                </Field>
              )}
              {valuation.pricePhp !== null && (
                <p className="text-sm">
                  Buyers see <strong className="font-display text-xl text-gold tabular">{formatPeso(valuation.pricePhp)}</strong>
                  {valuation.premiumPct !== null && <span className="ml-2 text-muted tabular">{premiumLabel(valuation.premiumPct)}</span>}
                </p>
              )}
            </div>
          </div>

          {valuation.belowMelt && (
            <div className="flex gap-3 rounded-xl border border-danger/35 bg-danger-tint p-4 text-sm">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
              <div className="grid gap-3">
                <p>
                  <strong className="text-danger">This is more than {Math.round((1 - BELOW_MELT_WARNING) * 100)}% under melt value.</strong> Far-below-melt prices are the most common sign of a
                  fake or a scam, so buyers will see a &ldquo;Verify before buying&rdquo; warning. Check the weight and karat.
                </p>
                <Checkbox name="acknowledgeBelowMelt" label="The price is right: publish it with the warning." />
                {errors.acknowledgeBelowMelt && <p className="text-danger" role="alert">{errors.acknowledgeBelowMelt}</p>}
              </div>
            </div>
          )}
          {overLimit && (
            <FormAlert tone="info">
              New sellers can list items up to {formatPeso(limits.maxListingValuePhp)} until {limits.tradesToGraduate} trades are complete (you have {limits.sales}). Lower the price, or list this after your first trades.
            </FormAlert>
          )}
          <Checkbox name="openToOffers" defaultChecked={defaults.openToOffers} label="Open to offers: buyers can propose a price and you can accept, counter or decline." />
        </Step>

        {/* -------------------------------------------------- 4 details */}
        <Step active={step === 3} reduce={Boolean(reduce)} title="The details buyers ask for" lead="Condition, marks, what's included. Leave out phone numbers and payment details: buyers reach you through Luxx4less chat.">
          <Field label="Description" hint={`Up to ${DESCRIPTION_MAX} characters.`} error={errors.description}>
            {(p) => <Textarea {...p} name="description" defaultValue={defaults.description} maxLength={DESCRIPTION_MAX} rows={6} required />}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Checkbox name="hasCertificate" defaultChecked={defaults.hasCertificate} label="Comes with a certificate" />
            <Checkbox name="hasReceipt" defaultChecked={defaults.hasReceipt} label="Comes with the original receipt" />
          </div>
          <Field label="Pawnable?" hint="Only say yes if a pawnshop has accepted it or it carries a recognised hallmark.">
            {(p) => (
              <Select {...p} name="pawnable" defaultValue={defaults.pawnable}>
                <option value="unknown">Not sure</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </Select>
            )}
          </Field>
          <div>
            <p className="mb-2 text-sm font-semibold">Where the item is</p>
            <p className="mb-3 text-xs text-muted">Only the city and province are shown. Never your street address.</p>
            <LocationPicker defaultRegion={defaults.regionCode} defaultProvince={defaults.provinceCode} defaultCity={defaults.cityCode} errors={{ region: errors.regionCode, city: errors.cityCode }} />
          </div>
        </Step>

        {/* -------------------------------------------------- 5 publish */}
        <Step active={step === 4} reduce={Boolean(reduce)} title={editing ? "Save your changes" : "Review and publish"} lead={`Your listing stays up for 30 days, and you can renew it from your account.`}>
          <div className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <div className="relative aspect-square overflow-hidden rounded-xl bg-surface-sunk">
              {/* eslint-disable-next-line @next/next/no-img-element -- a private draft photo, served to its owner only */}
              {photos[0] && <img src={photos[0].url} alt="" className="size-full object-cover" />}
            </div>
            <div className="grid content-start gap-1">
              <p className="font-semibold text-fg">{shownTitle || "Untitled"}</p>
              <p className="text-sm text-muted tabular">
                {[category && CATEGORIES.find((c) => c.value === category)?.label, grams > 0 ? `${grams} g` : ""].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-2 font-display text-2xl text-gold tabular">{valuation.pricePhp !== null ? formatPeso(valuation.pricePhp) : "—"}</p>
              {valuation.premiumPct !== null && <p className="text-xs text-muted tabular">{premiumLabel(valuation.premiumPct)}</p>}
              <p className="mt-1 text-xs text-muted">{photos.length} {photos.length === 1 ? "photo" : "photos"}</p>
            </div>
          </div>
          {limits.newSeller && !editing && (
            <p className="text-xs text-muted">
              As a new seller you can have {limits.maxActive} listings up at once ({limits.activeCount} now), each up to {formatPeso(limits.maxListingValuePhp)}, until you complete {limits.tradesToGraduate} trades.
            </p>
          )}
          {!editing && (
            <div className="rounded-xl border border-champagne/30 bg-gold-tint/40 p-4">
              <Checkbox
                name="declaration"
                label="I own this item, it is genuine to the best of my knowledge, and I have the right to sell it. I understand false listings are removed and reported."
              />
              {errors.declaration && <p className="mt-2 text-sm text-danger" role="alert">{errors.declaration}</p>}
            </div>
          )}
          {state?.error && <FormAlert>{state.error}</FormAlert>}
          <SubmitButton size="lg" className="w-full sm:w-auto" pendingLabel={editing ? "Saving…" : "Publishing…"}>
            {editing ? "Save changes" : "Publish listing"}
          </SubmitButton>
        </Step>

        <div className="flex items-center justify-between gap-3 border-t border-line pt-5">
          <Button type="button" variant="ghost" onClick={() => go(step - 1)} disabled={step === 0}>
            <ChevronLeft aria-hidden /> Back
          </Button>
          {step < STEPS.length - 1 && (
            <Button type="button" onClick={() => go(step + 1)}>
              Continue <ChevronRight aria-hidden />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

/** One wizard step. Inactive steps stay in the DOM (hidden) so their values submit with the form. */
function Step({ active, reduce, title, lead, children }: { active: boolean; reduce: boolean; title: string; lead: string; children: React.ReactNode }) {
  return (
    <section hidden={!active} aria-hidden={!active} className="grid gap-6">
      {active && (
        <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
          <h2 className="text-2xl text-pearl">{title}</h2>
          <p className="measure mt-1.5 text-sm text-muted">{lead}</p>
        </motion.div>
      )}
      {children}
    </section>
  );
}
