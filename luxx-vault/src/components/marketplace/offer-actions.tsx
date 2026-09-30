"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { acceptOffer, counterOffer, declineOffer, withdrawOffer } from "@/lib/server/marketplace/actions/offers";
import { ActionForm, SubmitButton } from "./action-form";
import { InlineAction } from "./inline-action";

/** Accept, counter or decline a received offer; withdraw a sent one. */
export function OfferActions({ offerId, side, amountLabel }: { offerId: string; side: "received" | "sent"; amountLabel: string }) {
  const [countering, setCountering] = useState(false);
  if (side === "sent") {
    return (
      <InlineAction action={withdrawOffer} fields={{ offerId }} confirm="Withdraw this offer?">
        Withdraw
      </InlineAction>
    );
  }
  return (
    <div className="grid gap-3">
      {!countering && (
        <div className="flex flex-wrap items-center gap-2">
          <InlineAction action={acceptOffer} fields={{ offerId }} variant="primary" confirm={`Accept ${amountLabel}? A trade opens and the item is reserved for this buyer.`}>
            Accept
          </InlineAction>
          <Button type="button" size="sm" variant="secondary" onClick={() => setCountering(true)}>
            Counter
          </Button>
          <InlineAction action={declineOffer} fields={{ offerId }} confirm="Decline this offer?">
            Decline
          </InlineAction>
        </div>
      )}
      {countering && (
        <ActionForm action={counterOffer} hidden={{ offerId }} className="grid max-w-md gap-3 rounded-xl border border-champagne/30 p-4">
          {({ fieldErrors, state }) =>
            state?.ok ? null : (
              <>
                <Field label="Your counter-offer (₱)" error={fieldErrors.amount}>
                  {(p) => <Input {...p} name="amount" inputMode="numeric" className="tabular" autoFocus required />}
                </Field>
                <Field label="Note (optional)">{(p) => <Input {...p} name="message" maxLength={500} />}</Field>
                <div className="flex gap-2">
                  <SubmitButton size="sm" pendingLabel="Sending…">
                    Send counter
                  </SubmitButton>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setCountering(false)}>
                    Cancel
                  </Button>
                </div>
              </>
            )
          }
        </ActionForm>
      )}
    </div>
  );
}
