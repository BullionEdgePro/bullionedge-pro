"use client";

import { useState, useTransition } from "react";
import { decideAction } from "@/app/admin/kyc/actions";
import { Button } from "@/components/ui/button";
import { Field, FormAlert, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";

const DECISIONS = [
  { value: "approved", label: "Approve", hint: "Everything checks out.", tone: "border-success/60 bg-success-tint text-success" },
  { value: "needs_resubmission", label: "Needs resubmission", hint: "Fixable: blurry photo, typo, expired ID.", tone: "border-warning/60 bg-warning-tint text-warning" },
  { value: "rejected", label: "Reject", hint: "Fraud, underage, or not a valid ID.", tone: "border-danger/60 bg-danger-tint text-danger" },
] as const;

/** Approve / needs resubmission / reject, with a mandatory reason the applicant will see. */
export function DecisionForm({ submissionId, level }: { submissionId: string; level: "identity" | "seller" }) {
  const [decision, setDecision] = useState<string>("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFe({});
    start(async () => {
      const r = await decideAction({ submissionId, decision, reason });
      if (r && !r.ok) {
        setError(r.error);
        setFe(r.fieldErrors ?? {});
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">Decision</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {DECISIONS.map((d) => (
            <label
              key={d.value}
              className={cn(
                "cursor-pointer rounded-xl border p-3 transition-colors duration-200",
                decision === d.value ? d.tone : "border-line hover:border-gold-large/50",
              )}
            >
              <input type="radio" name="decision" value={d.value} checked={decision === d.value} onChange={() => setDecision(d.value)} className="peer sr-only" />
              <span className="block rounded text-sm font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-ring">{d.label}</span>
              <span className="block text-xs text-muted">{d.hint}</span>
            </label>
          ))}
        </div>
        {fe.decision && <p className="text-sm font-medium text-danger">{fe.decision}</p>}
      </fieldset>
      <Field
        label="Reason"
        error={fe.reason}
        hint={
          decision === "approved"
            ? `What you checked. Kept in the audit log${level === "seller" ? "; approving adds the seller role" : ""}.`
            : "The applicant sees this. Say plainly what to fix or why."
        }
      >
        {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={10} maxLength={1000} rows={4} />}
      </Field>
      {error && <FormAlert>{error}</FormAlert>}
      <Button type="submit" className="w-fit rounded-full px-6" disabled={pending || !decision || reason.trim().length < 10}>
        {pending ? "Saving…" : "Record decision"}
      </Button>
    </form>
  );
}
