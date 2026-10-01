"use client";

import { Loader2 } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormAlert, Input, Select, Textarea } from "@/components/ui/field";
import { LocationPicker } from "@/components/ui/location-picker";
import { CATEGORIES, FORMS, GOLD_KARATS, GOLD_TYPES } from "@/config/catalog";
import { cn } from "@/lib/cn";
import { createWanted } from "@/lib/server/marketplace/actions/wanted";

/** Post what you're looking for. Sellers with matching active listings are told at once. */
export function WantedForm({ defaults }: { defaults: { regionCode: string; provinceCode: string; cityCode: string } }) {
  const [state, action, posting] = useActionState(createWanted, null);
  const [category, setCategory] = useState("gold_jewelry");
  const [karat, setKarat] = useState("");
  const e = state?.fieldErrors ?? {};
  const isGold = CATEGORIES.find((c) => c.value === category)?.metal === "gold";

  return (
    <form
      // Through a transition, not `action=`: React resets a form after its action, which would wipe
      // what the buyer typed whenever the server sends back a correction.
      onSubmit={(ev) => {
        ev.preventDefault();
        if (posting) return;
        const data = new FormData(ev.currentTarget);
        startTransition(() => action(data));
      }}
      noValidate
      className="grid gap-6"
    >
      <Field label="What are you looking for?" hint="e.g. 18K Saudi rope chain, 10 to 15 g" error={e.title}>
        {(p) => <Input {...p} name="title" maxLength={90} required />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" error={e.category}>
          {(p) => (
            <Select {...p} name="category" value={category} onChange={(ev) => setCategory(ev.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Form (optional)">
          {(p) => (
            <Select {...p} name="form" defaultValue="">
              <option value="">Any</option>
              {FORMS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      {isGold && (
        <>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Karat (optional)</legend>
            <input type="hidden" name="karat" value={karat} />
            <div className="flex flex-wrap gap-2">
              {[{ karat: "", label: "Any" }, ...GOLD_KARATS.slice(0, 6).map((k) => ({ karat: String(k.karat), label: `${k.karat}K` }))].map((k) => (
                <button
                  key={k.karat || "any"}
                  type="button"
                  aria-pressed={karat === k.karat}
                  onClick={() => setKarat(k.karat)}
                  className={cn(
                    "inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold transition-colors",
                    karat === k.karat ? "border-champagne bg-gold-tint text-champagne" : "border-line text-fg/85 hover:border-gold-large/60",
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </fieldset>
          <Field label="Gold type (optional)">
            {(p) => (
              <Select {...p} name="goldType" defaultValue="">
                <option value="">Any</option>
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
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Min. weight (g)" error={e.minGrams}>
          {(p) => <Input {...p} name="minGrams" inputMode="decimal" className="tabular" />}
        </Field>
        <Field label="Max. weight (g)" error={e.maxGrams}>
          {(p) => <Input {...p} name="maxGrams" inputMode="decimal" className="tabular" />}
        </Field>
        <Field label="Budget up to (₱)" error={e.budgetMaxPhp}>
          {(p) => <Input {...p} name="budgetMaxPhp" inputMode="numeric" className="tabular" />}
        </Field>
      </div>
      <Field label="Anything else sellers should know?" hint="Condition, certificate, meet-up or shipping. No phone numbers: sellers answer here." error={e.description}>
        {(p) => <Textarea {...p} name="description" rows={4} maxLength={1500} required />}
      </Field>
      <div>
        <p className="mb-3 text-sm font-semibold">Where you are</p>
        <LocationPicker defaultRegion={defaults.regionCode} defaultProvince={defaults.provinceCode} defaultCity={defaults.cityCode} requireCity={false} errors={{ region: e.regionCode, city: e.cityCode }} />
      </div>
      {state?.error && <FormAlert>{state.error}</FormAlert>}
      <Button type="submit" size="lg" className="w-full sm:w-fit" disabled={posting} aria-busy={posting || undefined}>
        {posting ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {posting ? "Posting…" : "Post wanted request"}
      </Button>
    </form>
  );
}
