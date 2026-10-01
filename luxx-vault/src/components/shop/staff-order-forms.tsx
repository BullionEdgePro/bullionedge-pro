"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/marketplace/action-form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { advanceOrder, recordPayment, reviewPayment, staffCancelOrder } from "@/lib/server/shop/admin-actions";

/** Confirm a receipt (optionally correcting the amount that actually arrived) or reject it with a reason the buyer sees. */
export function ReviewPaymentForm({ paymentId, amount }: { paymentId: string; amount: number }) {
  const [rejecting, setRejecting] = useState(false);
  return rejecting ? (
    <ActionForm action={reviewPayment} hidden={{ paymentId, decision: "rejected" }} className="grid gap-3">
      {({ fieldErrors }) => (
        <>
          <Field label="Why it can't be accepted (the buyer sees this)" error={fieldErrors.note}>
            {(p) => <Textarea {...p} name="note" className="min-h-20" placeholder="e.g. No transfer with this reference reached our GCash." />}
          </Field>
          <div className="flex flex-wrap gap-2">
            <SubmitButton variant="danger" size="sm">
              <X aria-hidden /> Reject receipt
            </SubmitButton>
            <button type="button" onClick={() => setRejecting(false)} className="text-sm text-muted hover:text-fg">
              Back
            </button>
          </div>
        </>
      )}
    </ActionForm>
  ) : (
    <ActionForm action={reviewPayment} hidden={{ paymentId, decision: "confirmed" }} className="grid gap-3">
      {({ fieldErrors }) => (
        <>
          <Field label="Amount that arrived (₱)" hint="Check the account first. Change this if a different amount arrived." error={fieldErrors.amountPhp}>
            {(p) => <Input {...p} name="amountPhp" inputMode="decimal" defaultValue={String(amount)} className="tabular sm:w-48" />}
          </Field>
          <div className="flex flex-wrap gap-2">
            <SubmitButton size="sm">
              <Check aria-hidden /> It arrived: confirm
            </SubmitButton>
            <button type="button" onClick={() => setRejecting(true)} className="inline-flex h-9 items-center rounded-md px-3 text-sm font-semibold text-danger hover:bg-danger-tint">
              Reject…
            </button>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/** Record money received in person. For pickup orders, it can complete the order in the same step. */
export function RecordPaymentForm({ orderId, balance, pickup, defaultMethod }: { orderId: string; balance: number; pickup: boolean; defaultMethod: string }) {
  return (
    <ActionForm action={recordPayment} hidden={{ orderId }} className="grid gap-3">
      {({ fieldErrors }) => (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Amount (₱)" error={fieldErrors.amountPhp}>
              {(p) => <Input {...p} name="amountPhp" inputMode="decimal" defaultValue={String(balance)} className="tabular" />}
            </Field>
            <Field label="How">
              {(p) => (
                <Select {...p} name="method" defaultValue={defaultMethod === "cod" ? "cod" : defaultMethod === "transfer" ? "transfer" : "in_store"}>
                  <option value="in_store">Cash or card in store</option>
                  <option value="cod">Cash on delivery / meet-up</option>
                  <option value="transfer">Transfer (seen in our account)</option>
                </Select>
              )}
            </Field>
            <Field label="Reference (optional)">
              {(p) => <Input {...p} name="reference" maxLength={40} />}
            </Field>
          </div>
          <Field label="Note (optional)">
            {(p) => <Input {...p} name="note" maxLength={300} placeholder="e.g. Paid at Antipolo counter, OR no. 1234" />}
          </Field>
          {pickup && <Checkbox name="handOver" label="Handed over now: complete the order" />}
          <SubmitButton size="sm" className="sm:w-fit">
            Record payment
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

const STEP_LABEL = {
  confirm_cod: "Confirmed with the buyer by phone",
  mark_ready: "Mark ready",
  complete: "Mark completed",
} as const;

/** The next step for the order. Shipping asks for the courier and tracking number. */
export function AdvanceForm({ orderId, step, couriers }: { orderId: string; step: "confirm_cod" | "mark_ready" | "mark_shipped" | "complete"; couriers: readonly string[] }) {
  if (step === "mark_shipped") {
    return (
      <ActionForm action={advanceOrder} hidden={{ orderId, step }} className="grid gap-3">
        {({ fieldErrors }) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Courier" error={fieldErrors.courier}>
                {(p) => (
                  <Select {...p} name="courier" defaultValue="">
                    <option value="">Choose…</option>
                    {couriers.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Tracking number" error={fieldErrors.trackingNumber}>
                {(p) => <Input {...p} name="trackingNumber" maxLength={40} />}
              </Field>
            </div>
            <SubmitButton size="sm" className="sm:w-fit">
              Mark shipped
            </SubmitButton>
          </>
        )}
      </ActionForm>
    );
  }
  return (
    <ActionForm action={advanceOrder} hidden={{ orderId, step }}>
      <SubmitButton size="sm">{STEP_LABEL[step]}</SubmitButton>
    </ActionForm>
  );
}

export function StaffCancelForm({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-fit text-sm font-semibold text-danger hover:underline">
        Cancel this order…
      </button>
    );
  }
  return (
    <ActionForm action={staffCancelOrder} hidden={{ orderId }} className="grid gap-3">
      {({ fieldErrors }) => (
        <>
          <Field label="Reason (the buyer sees this)" error={fieldErrors.reason}>
            {(p) => <Textarea {...p} name="reason" className="min-h-20" />}
          </Field>
          <div className="flex gap-2">
            <SubmitButton variant="danger" size="sm">
              Cancel order and release the pieces
            </SubmitButton>
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted hover:text-fg">
              Keep it
            </button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
