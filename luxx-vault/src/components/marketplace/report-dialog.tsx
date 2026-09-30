"use client";

import { Flag, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { Field, FormAlert, Input, Select, Textarea } from "@/components/ui/field";
import { submitReport } from "@/lib/server/marketplace/actions/reports";
import { REPORT_REASONS } from "@/lib/server/marketplace/reporting";
import { cn } from "@/lib/cn";
import { SubmitButton } from "./action-form";

type Target = "user" | "listing" | "buy_request" | "message" | "outside_number";

/**
 * Report something to Luxx4less staff. A native <dialog>, so focus is trapped
 * and Escape closes it without extra code. For outside numbers, the person
 * types the number they were contacted from.
 */
export function ReportDialog({
  targetType,
  targetId = "",
  label = "Report",
  subject,
  signedIn,
  className,
  variant = "link",
}: {
  targetType: Target;
  targetId?: string;
  label?: string;
  /** What is being reported, for the dialog heading. */
  subject: string;
  signedIn: boolean;
  className?: string;
  variant?: "link" | "icon";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [key, setKey] = useState(0);
  const router = useRouter();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!signedIn) {
            router.push(`/sign-in?next=${encodeURIComponent(window.location.pathname)}`);
            return;
          }
          setKey((k) => k + 1);
          ref.current?.showModal();
        }}
        className={cn(
          variant === "icon"
            ? "inline-flex size-8 items-center justify-center rounded-full text-muted hover:bg-surface-sunk hover:text-danger"
            : "inline-flex items-center gap-1.5 text-sm font-semibold text-muted underline-offset-4 hover:text-danger hover:underline",
          className,
        )}
        aria-label={variant === "icon" ? `${label}: ${subject}` : undefined}
      >
        <Flag className="size-3.5" aria-hidden />
        {variant === "link" && label}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={`report-title-${targetType}`}
        className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-fg shadow-2xl backdrop:bg-velvet/80 backdrop:backdrop-blur-sm"
      >
        <ReportForm key={key} targetType={targetType} targetId={targetId} subject={subject} close={() => ref.current?.close()} />
      </dialog>
    </>
  );
}

function ReportForm({ targetType, targetId, subject, close }: { targetType: Target; targetId: string; subject: string; close: () => void }) {
  const [state, action] = useActionState(submitReport, null);
  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(close, 2200);
      return () => clearTimeout(t);
    }
  }, [state, close]);
  return (
    <form action={action} className="grid gap-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id={`report-title-${targetType}`} className="text-xl">
            Report to Luxx4less
          </h2>
          <p className="mt-1 text-sm text-muted">{subject}</p>
        </div>
        <button type="button" onClick={() => close()} className="-m-1 rounded-full p-1.5 text-muted hover:text-fg" aria-label="Close">
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <input type="hidden" name="targetType" value={targetType} />
      {targetType === "outside_number" ? (
        <Field label="The number that contacted you" hint="Philippine mobile, e.g. 0917 123 4567" error={state?.fieldErrors?.targetId}>
          {(p) => <Input {...p} name="targetId" inputMode="tel" autoComplete="off" defaultValue={targetId} required />}
        </Field>
      ) : (
        <input type="hidden" name="targetId" value={targetId} />
      )}
      <Field label="What's wrong?" error={state?.fieldErrors?.reason}>
        {(p) => (
          <Select {...p} name="reason" required defaultValue="">
            <option value="" disabled>
              Choose a reason
            </option>
            {REPORT_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Details (optional)" hint="What happened, and when. Staff see this; the other person doesn't.">
        {(p) => <Textarea {...p} name="details" maxLength={1500} rows={4} />}
      </Field>
      {state?.error && <FormAlert>{state.error}</FormAlert>}
      {state?.ok && state.message && <FormAlert tone="success">{state.message}</FormAlert>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => close()} className="h-11 rounded-lg px-4 text-sm font-semibold text-muted hover:text-fg">
          Cancel
        </button>
        <SubmitButton variant="danger" pendingLabel="Sending…" disabled={Boolean(state?.ok)}>
          Send report
        </SubmitButton>
      </div>
    </form>
  );
}
