"use client";

import { Upload } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/marketplace/action-form";
import { PhotoUploader } from "@/components/marketplace/photo-uploader";
import { Field, Input } from "@/components/ui/field";
import { submitPaymentReceipt } from "@/lib/server/shop/actions";

/** The buyer uploads a GCash or bank receipt for the amount they sent. */
export function ReceiptForm({ code, amountDue }: { code: string; amountDue: number }) {
  return (
    <ActionForm action={submitPaymentReceipt} hidden={{ code }} className="grid gap-4">
      {({ fieldErrors }) => (
        <>
          <PhotoUploader name="proof" purpose="payment_proof" max={1} label="Receipt" hint="A screenshot of the GCash or bank confirmation, showing the reference number." error={fieldErrors.proof} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Reference number" error={fieldErrors.reference}>
              {(p) => <Input {...p} name="reference" autoComplete="off" placeholder="e.g. 1012 345 678901" />}
            </Field>
            <Field label="Amount sent (₱)" error={fieldErrors.amountPhp}>
              {(p) => <Input {...p} name="amountPhp" inputMode="decimal" defaultValue={amountDue > 0 ? String(amountDue) : ""} className="tabular" />}
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
