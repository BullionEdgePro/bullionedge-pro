"use client";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { moderateListing, resolveDispute } from "@/lib/server/marketplace/actions/admin";
import { ActionForm, SubmitButton } from "./action-form";

/** Decide a dispute: a required note, then refund the buyer or release to the seller. */
export function ResolveDisputeForm({ disputeId, amount }: { disputeId: string; amount: string }) {
  return (
    <ActionForm action={resolveDispute} hidden={{ disputeId }} className="grid gap-3">
      {({ fieldErrors, state }) =>
        state?.ok ? null : (
          <>
            <Field label="Decision note (required)" hint="Kept in the audit log and sent to both sides." error={fieldErrors.note}>
              {(p) => <Textarea {...p} name="note" rows={3} maxLength={2000} />}
            </Field>
            <div className="flex flex-wrap gap-2">
              <SubmitButton name="outcome" value="resolved_buyer" variant="secondary" size="sm" pendingLabel="Saving…">
                For the buyer: refund {amount}
              </SubmitButton>
              <SubmitButton name="outcome" value="resolved_seller" variant="secondary" size="sm" pendingLabel="Saving…">
                For the seller: release {amount}
              </SubmitButton>
            </div>
          </>
        )
      }
    </ActionForm>
  );
}

/** Record a Luxx-Tested result (XRF or acid test at the branch). */
export function LuxxTestedForm({ listingId }: { listingId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <ActionForm action={moderateListing} hidden={{ listingId, op: "set_tested" }} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
      {({ fieldErrors }) => (
        <>
          <Field label="Test result" error={fieldErrors.result}>
            {(p) => <Input {...p} name="result" placeholder="XRF: 750 (18K), 12.41 g" className="h-10 text-sm" />}
          </Field>
          <Field label="Tested on" error={fieldErrors.testedAt}>
            {(p) => <Input {...p} name="testedAt" type="date" defaultValue={today} max={today} className="h-10 text-sm" />}
          </Field>
          <Button type="submit" size="sm" variant="secondary" className="h-10">
            Save result
          </Button>
        </>
      )}
    </ActionForm>
  );
}
