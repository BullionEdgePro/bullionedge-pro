"use client";

import { Save, ShieldAlert } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/marketplace/action-form";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { saveShopSettings } from "@/lib/server/shop/admin-actions";

export type SettingsDefaults = {
  paymentInstructions: string;
  reserveDays: string;
  layawayEnabled: boolean;
  layawayDownPct: string;
  layawayMonths: string;
  layawayMinPhp: string;
  codEnabled: boolean;
  codMaxPhp: string;
  deliveryFeePhp: string;
};

/** The owner's shop settings: payment details, how long orders are held, layaway terms, cash on delivery and delivery fee. */
export function SettingsForm({ defaults }: { defaults: SettingsDefaults }) {
  return (
    <ActionForm action={saveShopSettings} className="grid gap-8">
      {({ fieldErrors }) => (
        <>
          <section className="grid gap-4 rounded-2xl border border-champagne/35 bg-surface p-5 sm:p-6">
            <h2 className="font-display text-sm tracking-[0.2em] text-champagne uppercase">GCash and bank details</h2>
            <p className="flex gap-2 rounded-xl bg-warning-tint p-3 text-sm text-fg/90">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              Shown only to a buyer on their own order page, after they order. Never on public pages. Every admin is emailed whenever these change.
            </p>
            <Field
              label="How buyers pay you"
              hint="One account per line, with the account name. e.g. “GCash: 0917 … · Luxx4less Trading OPC”. Leave empty to switch transfer payments off."
              error={fieldErrors.paymentInstructions}
            >
              {(p) => <Textarea {...p} name="paymentInstructions" defaultValue={defaults.paymentInstructions} maxLength={2000} className="min-h-32 font-mono text-sm" />}
            </Field>
          </section>

          <section className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <h2 className="font-display text-sm tracking-[0.2em] text-champagne uppercase">Reservations</h2>
            <Field label="Days an unpaid order holds its pieces" hint="After this, unpaid orders cancel themselves and the pieces go back on sale." error={fieldErrors.reserveDays}>
              {(p) => <Input {...p} name="reserveDays" inputMode="numeric" defaultValue={defaults.reserveDays} className="tabular sm:w-40" />}
            </Field>
          </section>

          <section className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <h2 className="font-display text-sm tracking-[0.2em] text-champagne uppercase">Layaway (hulugan)</h2>
            <Checkbox name="layawayEnabled" label="Offer layaway" defaultChecked={defaults.layawayEnabled} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Down payment (%)" error={fieldErrors.layawayDownPct}>
                {(p) => <Input {...p} name="layawayDownPct" inputMode="numeric" defaultValue={defaults.layawayDownPct} className="tabular" />}
              </Field>
              <Field label="Monthly payments" error={fieldErrors.layawayMonths}>
                {(p) => <Input {...p} name="layawayMonths" inputMode="numeric" defaultValue={defaults.layawayMonths} className="tabular" />}
              </Field>
              <Field label="Smallest order (₱)" error={fieldErrors.layawayMinPhp}>
                {(p) => <Input {...p} name="layawayMinPhp" inputMode="decimal" defaultValue={defaults.layawayMinPhp} className="tabular" />}
              </Field>
            </div>
          </section>

          <section className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <h2 className="font-display text-sm tracking-[0.2em] text-champagne uppercase">Delivery and cash on delivery</h2>
            <Checkbox name="codEnabled" label="Offer cash on delivery and meet-up" defaultChecked={defaults.codEnabled} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cash on delivery up to (₱)" hint="Leave empty for no limit." error={fieldErrors.codMaxPhp}>
                {(p) => <Input {...p} name="codMaxPhp" inputMode="decimal" defaultValue={defaults.codMaxPhp} className="tabular" />}
              </Field>
              <Field label="Delivery fee (₱)" hint="Leave empty to quote it per order; 0 for free delivery." error={fieldErrors.deliveryFeePhp}>
                {(p) => <Input {...p} name="deliveryFeePhp" inputMode="decimal" defaultValue={defaults.deliveryFeePhp} className="tabular" />}
              </Field>
            </div>
          </section>

          <SubmitButton size="lg" className="sm:w-fit" pendingLabel="Saving…">
            <Save aria-hidden /> Save settings
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
