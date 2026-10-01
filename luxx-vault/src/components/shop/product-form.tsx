"use client";

import { Save } from "lucide-react";
import { useMemo, useState } from "react";
import { ActionForm, SubmitButton } from "@/components/marketplace/action-form";
import { PhotoUploader, type UploadedPhoto } from "@/components/marketplace/photo-uploader";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { CATEGORIES, FORMS, GOLD_KARATS, GOLD_TYPES, OTHER_FINENESS } from "@/config/catalog";
import { cn } from "@/lib/cn";
import { formatPeso } from "@/lib/pricing";
import { premiumLabel, valueItem, type SpotTable } from "@/lib/server/marketplace/valuation";
import { saveProduct } from "@/lib/server/shop/admin-actions";

export type ProductDefaults = {
  id?: string;
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
  description: string;
  hasCertificate: boolean;
  pawnable: "yes" | "no" | "unknown";
  stock: string;
  layawayAllowed: boolean;
  featured: boolean;
  status: "draft" | "active" | "archived";
};

const num = (s: string) => Number(s.replace(/[,₱\s]/g, ""));

/**
 * Add or edit an Official Shop piece (admins). One page: photos, what it is,
 * price (fixed, or pegged to today's spot with a premium), stock and how it
 * sells. The live price preview uses the same maths as the shop.
 */
export function ProductForm({ defaults, spot }: { defaults: ProductDefaults; spot: SpotTable }) {
  const [category, setCategory] = useState(defaults.category);
  const fixedMetal = CATEGORIES.find((c) => c.value === category)?.metal ?? null;
  const [metalChoice, setMetalChoice] = useState(defaults.metal);
  const metal = fixedMetal ?? metalChoice;
  const [karat, setKarat] = useState(defaults.karat);
  const [fineness, setFineness] = useState(defaults.finenessPermille);
  const [grams, setGrams] = useState(defaults.weightGrams);
  const [mode, setMode] = useState(defaults.pricingMode);
  const [price, setPrice] = useState(defaults.pricePhp);
  const [premium, setPremium] = useState(defaults.premiumPct);

  const permille = metal === "gold" ? GOLD_KARATS.find((k) => String(k.karat) === karat)?.permille : Number(fineness) || undefined;
  const v = useMemo(
    () =>
      valueItem(
        {
          metal: metal || null,
          karat: metal === "gold" ? Number(karat) || null : null,
          finenessPermille: permille ?? null,
          weightGrams: num(grams) || 0,
          pricingMode: mode,
          pricePhp: mode === "fixed" ? num(price) || null : null,
          premiumPct: mode === "spot_premium" && premium !== "" ? num(premium) : null,
        },
        spot,
      ),
    [metal, karat, permille, grams, mode, price, premium, spot],
  );

  return (
    <ActionForm action={saveProduct} hidden={defaults.id ? { id: defaults.id } : undefined} className="grid gap-8">
      {({ fieldErrors }) => (
        <>
          <Section title="Photos">
            <PhotoUploader name="photos" purpose="product" initial={defaults.photos} error={fieldErrors.photos} hint="Up to 8. The first is the cover. Each is stamped with the product code and the Luxx4less mark." />
          </Section>

          <Section title="The piece">
            <Field label="Title" error={fieldErrors.title}>
              {(p) => <Input {...p} name="title" defaultValue={defaults.title} maxLength={90} placeholder="e.g. 18K Italian Figaro chain, 50 cm" />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" error={fieldErrors.category}>
                {(p) => (
                  <Select {...p} name="category" value={category} onChange={(e) => setCategory(e.target.value)}>
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="What it is" error={fieldErrors.form}>
                {(p) => (
                  <Select {...p} name="form" defaultValue={defaults.form}>
                    <option value="">Choose…</option>
                    {FORMS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              {!fixedMetal && (
                <Field label="Metal (optional)" error={fieldErrors.metal}>
                  {(p) => (
                    <Select {...p} name="metal" value={metalChoice} onChange={(e) => setMetalChoice(e.target.value)}>
                      <option value="">None</option>
                      <option value="gold">Gold</option>
                      <option value="silver">Silver</option>
                      <option value="platinum">Platinum</option>
                      <option value="palladium">Palladium</option>
                    </Select>
                  )}
                </Field>
              )}
              {metal === "gold" && (
                <>
                  <Field label="Karat" error={fieldErrors.karat}>
                    {(p) => (
                      <Select {...p} name="karat" value={karat} onChange={(e) => setKarat(e.target.value)}>
                        <option value="">Choose…</option>
                        {GOLD_KARATS.map((k) => (
                          <option key={k.karat} value={k.karat}>
                            {k.karat}K ({k.permille})
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label="Gold type" error={fieldErrors.goldType}>
                    {(p) => (
                      <Select {...p} name="goldType" defaultValue={defaults.goldType}>
                        <option value="">Not stated</option>
                        {GOLD_TYPES.map((g) => (
                          <option key={g.value} value={g.value}>
                            {g.label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </>
              )}
              {metal && metal !== "gold" && (
                <Field label="Fineness" error={fieldErrors.finenessPermille}>
                  {(p) => (
                    <Select {...p} name="finenessPermille" value={fineness} onChange={(e) => setFineness(e.target.value)}>
                      <option value="">Choose…</option>
                      {OTHER_FINENESS[metal as keyof typeof OTHER_FINENESS].map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              )}
              <Field label="Exact weight (g)" error={fieldErrors.weightGrams}>
                {(p) => <Input {...p} name="weightGrams" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} className="tabular" placeholder="12.35" />}
              </Field>
            </div>
            <Field label="Description" hint="Condition, size or length, clasp, hallmarks, what's included." error={fieldErrors.description}>
              {(p) => <Textarea {...p} name="description" defaultValue={defaults.description} maxLength={2000} />}
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Checkbox name="hasCertificate" label="Comes with a certificate" defaultChecked={defaults.hasCertificate} />
              <Field label="Pawnable">
                {(p) => (
                  <Select {...p} name="pawnable" defaultValue={defaults.pawnable}>
                    <option value="unknown">Not stated</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </Select>
                )}
              </Field>
            </div>
          </Section>

          <Section title="Price">
            <input type="hidden" name="pricingMode" value={mode} />
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pricing">
              {(
                [
                  ["fixed", "Fixed price"],
                  ["spot_premium", "Follows today's gold price"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={mode === value}
                  onClick={() => setMode(value)}
                  className={cn("rounded-full border px-4 py-2 text-sm font-semibold", mode === value ? "border-champagne bg-gold-tint text-champagne" : "border-line text-muted hover:text-fg")}
                >
                  {label}
                </button>
              ))}
            </div>
            {fieldErrors.pricingMode && <p className="text-sm text-danger" role="alert">{fieldErrors.pricingMode}</p>}
            {mode === "fixed" ? (
              <Field label="Price (₱)" error={fieldErrors.pricePhp}>
                {(p) => <Input {...p} name="pricePhp" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="tabular" placeholder="45000" />}
              </Field>
            ) : (
              <Field label="Premium over melt (%)" hint="e.g. 18 for melt value + 18% workmanship. Re-priced live; locked when someone orders." error={fieldErrors.premiumPct}>
                {(p) => <Input {...p} name="premiumPct" inputMode="decimal" value={premium} onChange={(e) => setPremium(e.target.value)} className="tabular" placeholder="18" />}
              </Field>
            )}
            <p className="text-sm text-muted tabular">
              {v.pricePhp !== null ? (
                <>
                  Shoppers see <strong className="text-gold">{formatPeso(v.pricePhp)}</strong> today
                  {v.meltPhp !== null && ` · melt ${formatPeso(v.meltPhp)}`}
                  {v.premiumPct !== null && ` · ${premiumLabel(v.premiumPct)}`}
                </>
              ) : (
                "The price preview appears once the weight, purity and price are filled in."
              )}
            </p>
            {v.belowMelt && <p className="text-sm font-semibold text-warning">This is well under the metal value. Check the weight, karat and price.</p>}
          </Section>

          <Section title="Selling">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Pieces in stock" hint="Orders take pieces out; a cancelled order puts them back." error={fieldErrors.stock}>
                {(p) => <Input {...p} name="stock" inputMode="numeric" defaultValue={defaults.stock} className="tabular" />}
              </Field>
              <Field label="Status" error={fieldErrors.status}>
                {(p) => (
                  <Select {...p} name="status" defaultValue={defaults.status}>
                    <option value="draft">Draft (only admins see it)</option>
                    <option value="active">Published</option>
                    <option value="archived">Archived (no longer sold)</option>
                  </Select>
                )}
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Checkbox name="layawayAllowed" label="Can be bought on layaway" defaultChecked={defaults.layawayAllowed} />
              <Checkbox name="featured" label="Feature it first (shop and home page)" defaultChecked={defaults.featured} />
            </div>
          </Section>

          <SubmitButton size="lg" className="sm:w-fit" pendingLabel="Saving…">
            <Save aria-hidden /> Save product
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="font-display text-sm tracking-[0.2em] text-champagne uppercase">{title}</h2>
      {children}
    </section>
  );
}
