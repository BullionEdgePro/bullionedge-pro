"use client";

import { Field, Input, Textarea } from "@/components/ui/field";
import { makeWantedOffer } from "@/lib/server/marketplace/actions/offers";
import { ActionForm, SubmitButton } from "./action-form";

/** A verified seller answers a wanted post with a price and the exact weight. */
export function WantedOfferForm({ buyRequestId }: { buyRequestId: string }) {
  return (
    <ActionForm action={makeWantedOffer} hidden={{ buyRequestId }} className="grid gap-4">
      {({ fieldErrors, state }) =>
        state?.ok ? null : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your price (₱)" error={fieldErrors.amount}>
                {(p) => <Input {...p} name="amount" inputMode="numeric" className="tabular" required />}
              </Field>
              <Field label="Exact weight (g)" error={fieldErrors.weightGrams}>
                {(p) => <Input {...p} name="weightGrams" inputMode="decimal" className="tabular" required />}
              </Field>
            </div>
            <Field label="Note (optional)" hint="Describe the piece. Photos can follow in the chat.">
              {(p) => <Textarea {...p} name="message" rows={3} maxLength={500} />}
            </Field>
            <SubmitButton className="w-full sm:w-fit" pendingLabel="Sending…">
              Send offer
            </SubmitButton>
          </>
        )
      }
    </ActionForm>
  );
}
