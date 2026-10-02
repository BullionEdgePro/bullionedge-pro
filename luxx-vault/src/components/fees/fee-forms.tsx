"use client";

import { Check, Save, Upload, X } from "lucide-react";
import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/marketplace/action-form";
import { PhotoUploader } from "@/components/marketplace/photo-uploader";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { recordFeePayment, reviewFeePayment, saveMarketSettings, submitFeeReceipt, waiveFee } from "@/lib/server/fee-actions";

/** Seller: upload a GCash or bank receipt for the fees owed. */
export function FeeReceiptForm({ balance }: { balance: number }) {
  return (
    <ActionForm action={submitFeeReceipt} className="grid gap-4">
      {({ fieldErrors }) => (
        <>
          <PhotoUploader name="proof" purpose="payment_proof" max={1} label="Receipt" hint="A screenshot of the GCash or bank confirmation, showing the reference number." error={fieldErrors.proof} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Reference number" error={fieldErrors.reference}>
              {(p) => <Input {...p} name="reference" autoComplete="off" placeholder="e.g. 1012 345 678901" />}
            </Field>
            <Field label="Amount sent (₱)" error={fieldErrors.amountPhp}>
              {(p) => <Input {...p} name="amountPhp" inputMode="decimal" defaultValue={String(balance)} className="tabular" />}
            </Field>
          </div>
          <SubmitButton className="sm:w-fit" pendingLabel="Sending…">
            <Upload aria-hidden /> Send receipt
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

/** Staff: confirm a fee receipt (correcting the amount if needed) or reject it with a reason. */
export function ReviewFeeForm({ paymentId, amount }: { paymentId: string; amount: number }) {
  const [rejecting, setRejecting] = useState(false);
  return rejecting ? (
    <ActionForm action={reviewFeePayment} hidden={{ paymentId, decision: "rejected" }} className="grid gap-3">
      {({ fieldErrors }) => (
        <>
          <Field label="Why it can't be accepted (the seller sees this)" error={fieldErrors.note}>
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
    <ActionForm action={reviewFeePayment} hidden={{ paymentId, decision: "confirmed" }} className="grid gap-3">
      {({ fieldErrors }) => (
        <>
          <Field label="Amount that arrived (₱)" hint="Check the account first." error={fieldErrors.amountPhp}>
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

/** Staff: record a fee paid in person or seen directly in the account. */
export function RecordFeeForm({ sellerId, balance }: { sellerId: string; balance: number }) {
  return (
    <ActionForm action={recordFeePayment} hidden={{ sellerId }} className="grid gap-3">
      {({ fieldErrors }) => (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Amount (₱)" error={fieldErrors.amountPhp}>
              {(p) => <Input {...p} name="amountPhp" inputMode="decimal" defaultValue={String(balance)} className="tabular" />}
            </Field>
            <Field label="How">
              {(p) => (
                <Select {...p} name="method" defaultValue="in_store">
                  <option value="in_store">Cash at a branch</option>
                  <option value="transfer">Transfer (seen in our account)</option>
                </Select>
              )}
            </Field>
            <Field label="Reference (optional)">{(p) => <Input {...p} name="reference" maxLength={40} />}</Field>
          </div>
          <SubmitButton size="sm" className="sm:w-fit">
            Record payment
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

/** Admin: waive one trade's fee, with a reason for the audit log. */
export function WaiveFeeForm({ tradeId }: { tradeId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-block py-1.5 text-xs font-semibold text-muted hover:text-fg">
        Waive…
      </button>
    );
  }
  return (
    <ActionForm action={waiveFee} hidden={{ tradeId }} className="grid gap-2">
      {({ fieldErrors }) => (
        <>
          <Field label="Reason (audit log)" error={fieldErrors.reason}>
            {(p) => <Input {...p} name="reason" maxLength={200} />}
          </Field>
          <SubmitButton size="sm" variant="secondary" className="w-fit">
            Waive this fee
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function MarketSettingsForm({ defaults }: { defaults: { feePct: string; feeMinPhp: string; feeMaxPhp: string; feePayDays: string } }) {
  return (
    <ActionForm action={saveMarketSettings} className="grid gap-4">
      {({ fieldErrors }) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Commission (%)" hint="Of the sale price, paid by the seller." error={fieldErrors.feePct}>
              {(p) => <Input {...p} name="feePct" inputMode="decimal" defaultValue={defaults.feePct} className="tabular" />}
            </Field>
            <Field label="Minimum fee (₱)" hint="Empty: no minimum." error={fieldErrors.feeMinPhp}>
              {(p) => <Input {...p} name="feeMinPhp" inputMode="decimal" defaultValue={defaults.feeMinPhp} className="tabular" />}
            </Field>
            <Field label="Maximum fee (₱)" hint="Empty: no maximum." error={fieldErrors.feeMaxPhp}>
              {(p) => <Input {...p} name="feeMaxPhp" inputMode="decimal" defaultValue={defaults.feeMaxPhp} className="tabular" />}
            </Field>
            <Field label="Days to pay" hint="Then new selling pauses." error={fieldErrors.feePayDays}>
              {(p) => <Input {...p} name="feePayDays" inputMode="numeric" defaultValue={defaults.feePayDays} className="tabular" />}
            </Field>
          </div>
          <SubmitButton size="sm" className="sm:w-fit">
            <Save aria-hidden /> Save fee settings
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
