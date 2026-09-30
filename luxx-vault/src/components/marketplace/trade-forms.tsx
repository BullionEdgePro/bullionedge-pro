"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { confirmReceived, leaveReview, markShipped, openDispute } from "@/lib/server/marketplace/actions/trades";
import { ActionForm, SubmitButton } from "./action-form";
import { PhotoUploader } from "./photo-uploader";

/** Seller: ship with tracking, or set a meet-up (optionally at the Luxx4less branch for testing). */
export function ShipForm({ code, couriers, branch }: { code: string; couriers: readonly string[]; branch: { name: string; address: string } | null }) {
  const [mode, setMode] = useState<"shipping" | "meetup" | "luxx_meetup">("shipping");
  const opt = (active: boolean) =>
    cn("rounded-xl border p-4 text-left text-sm transition-colors", active ? "border-champagne bg-gold-tint text-fg" : "border-line hover:border-gold-large/60");
  return (
    <ActionForm action={markShipped} hidden={{ code, fulfilment: mode }} className="grid gap-4">
      {({ fieldErrors }) => (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <button type="button" aria-pressed={mode === "shipping"} onClick={() => setMode("shipping")} className={opt(mode === "shipping")}>
              <span className="font-semibold">Ship with tracking</span>
              <span className="mt-1 block text-xs text-muted">Insured courier, tracking number shared here.</span>
            </button>
            <button type="button" aria-pressed={mode === "meetup"} onClick={() => setMode("meetup")} className={opt(mode === "meetup")}>
              <span className="font-semibold">Meet in person</span>
              <span className="mt-1 block text-xs text-muted">A busy public place. Agree the time in the chat.</span>
            </button>
            {branch && (
              <button type="button" aria-pressed={mode === "luxx_meetup"} onClick={() => setMode("luxx_meetup")} className={opt(mode === "luxx_meetup")}>
                <span className="font-semibold">Meet at Luxx4less</span>
                <span className="mt-1 block text-xs text-muted">{branch.name}, with in-person testing.</span>
              </button>
            )}
          </div>
          {mode === "shipping" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Courier" error={fieldErrors.courier}>
                {(p) => (
                  <Select {...p} name="courier" defaultValue="">
                    <option value="" disabled>
                      Choose…
                    </option>
                    {couriers.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Tracking number" error={fieldErrors.trackingNumber}>
                {(p) => <Input {...p} name="trackingNumber" autoComplete="off" className="tabular" />}
              </Field>
            </div>
          )}
          {mode === "luxx_meetup" && branch && <p className="text-sm text-muted">{branch.address}. Staff can test the piece with the buyer present before it changes hands.</p>}
          <SubmitButton className="w-fit" pendingLabel="Saving…">
            {mode === "shipping" ? "Mark as shipped" : "Confirm the meet-up"}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

/** Buyer: confirm the item arrived and matches the listing, releasing the payment. */
export function ReceiveForm({ code }: { code: string }) {
  return (
    <ActionForm action={confirmReceived} hidden={{ code }} className="grid gap-3">
      {({ fieldErrors }) => (
        <>
          <Checkbox name="confirm" label="I have the item, I checked it, and it matches the listing (weight, karat, condition)." />
          {fieldErrors.confirm && <p className="text-sm text-danger" role="alert">{fieldErrors.confirm}</p>}
          <SubmitButton className="w-fit" pendingLabel="Releasing…">
            I received it and it matches
          </SubmitButton>
          <p className="text-xs text-muted">This releases the payment to the seller and can&rsquo;t be undone. If something is wrong, open a dispute instead.</p>
        </>
      )}
    </ActionForm>
  );
}

/** Either side: open a dispute with details and photo evidence. */
export function DisputeForm({ code, reasons }: { code: string; reasons: readonly { value: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" className="w-fit text-danger" onClick={() => setOpen(true)}>
        Something&rsquo;s wrong: open a dispute
      </Button>
    );
  }
  return (
    <ActionForm action={openDispute} hidden={{ code }} className="grid gap-4 rounded-2xl border border-danger/30 bg-danger-tint/40 p-5">
      {({ fieldErrors, state }) =>
        state?.ok ? null : (
          <>
            <div>
              <p className="font-semibold text-fg">Open a dispute</p>
              <p className="mt-1 text-sm text-muted">The payment stays in the hold while Luxx4less staff review both sides. Add photos, test results or a video still.</p>
            </div>
            <Field label="Reason" error={fieldErrors.reason}>
              {(p) => (
                <Select {...p} name="reason" defaultValue="">
                  <option value="" disabled>
                    Choose a reason
                  </option>
                  {reasons.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="What happened?" error={fieldErrors.details}>
              {(p) => <Textarea {...p} name="details" rows={5} maxLength={3000} />}
            </Field>
            <PhotoUploader name="evidence" purpose="dispute_evidence" max={6} label="Evidence photos (optional)" hint="Only you, the other side and Luxx4less staff can see these." error={fieldErrors.evidence} />
            <div className="flex gap-2">
              <SubmitButton variant="danger" pendingLabel="Opening…">
                Open dispute
              </SubmitButton>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </>
        )
      }
    </ActionForm>
  );
}

/** After release: rate the other side once. */
export function ReviewForm({ code, otherName }: { code: string; otherName: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  return (
    <ActionForm action={leaveReview} hidden={{ code, rating: String(rating) }} className="grid gap-4">
      {({ fieldErrors, state }) =>
        state?.ok ? null : (
          <>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">How was trading with {otherName}?</legend>
              <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHover(n)}
                    aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
                    aria-pressed={rating === n}
                    className="rounded p-1"
                  >
                    <Star className={cn("size-7 transition-colors", (hover || rating) >= n ? "fill-champagne text-champagne" : "text-line")} aria-hidden />
                  </button>
                ))}
              </div>
              {fieldErrors.rating && <p className="mt-1 text-sm text-danger" role="alert">{fieldErrors.rating}</p>}
            </fieldset>
            <Field label="A few words (optional)" hint="Shown on their showroom with your first name.">
              {(p) => <Textarea {...p} name="body" rows={3} maxLength={1000} />}
            </Field>
            <SubmitButton className="w-fit" disabled={rating === 0} pendingLabel="Posting…">
              Post review
            </SubmitButton>
          </>
        )
      }
    </ActionForm>
  );
}
