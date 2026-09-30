"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Check, IdCard, Lock } from "lucide-react";
import { useState, useTransition } from "react";
import { submitIdentityAction } from "@/app/account/verification/actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Checkbox, Field, FormAlert, Input } from "@/components/ui/field";
import { ID_TYPES, MIN_AGE, idTypeOf, type IdTypeValue } from "@/config/kyc";
import { cn } from "@/lib/cn";
import { IdCapture, type CapturedSide } from "./id-capture";
import { LivenessCapture, type LivenessResult } from "./liveness-capture";
import { TestModeNotice } from "./test-mode-notice";

const STEPS = ["Choose ID", "Photograph it", "Selfie check", "Details and consent"] as const;
const EASE = [0.22, 1, 0.36, 1] as const;

function yearsSince(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const now = new Date();
  let age = now.getFullYear() - Number(m[1]);
  if (now.getMonth() + 1 < Number(m[2]) || (now.getMonth() + 1 === Number(m[2]) && now.getDate() < Number(m[3]))) age--;
  return age;
}

/**
 * Tier 3 wizard (brief §8): choose ID → front and back → selfie prompts →
 * details, review and a separate biometric consent. The status page (step 5)
 * is the server-rendered StatusCard that replaces this once it's sent.
 */
export function IdentityWizard({ accountName, testMode, storesImages }: { accountName: string; testMode: boolean; storesImages: boolean }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [idType, setIdType] = useState<IdTypeValue | null>(null);
  const [front, setFront] = useState<CapturedSide | null>(null);
  const [back, setBack] = useState<CapturedSide | null>(null);
  const [liveness, setLiveness] = useState<LivenessResult | null>(null);
  const [nameOnId, setNameOnId] = useState(accountName);
  const [idNumber, setIdNumber] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [expiry, setExpiry] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const type = idTypeOf(idType);
  const age = birthDate ? yearsSince(birthDate) : null;
  const underage = age !== null && age < MIN_AGE;
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, device time zone

  const canNext = [Boolean(idType), Boolean(front && (!type?.hasBack || back)), Boolean(liveness)][step] ?? false;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!type || !front || !liveness) return;
    setError(null);
    setFieldErrors({});
    start(async () => {
      const r = await submitIdentityAction({
        idType,
        nameOnId,
        idNumber,
        birthDate,
        expiry: type.hasExpiry ? expiry : null,
        biometricConsent: consent,
        device: {
          front: { sharpness: front.report.sharpness, glare: front.report.glare, ok: front.report.ok, source: front.source },
          back: back ? { sharpness: back.report.sharpness, glare: back.report.glare, ok: back.report.ok, source: back.source } : null,
          liveness,
        },
      });
      if (!r.ok) {
        setError(r.error);
        setFieldErrors(r.fieldErrors ?? {});
        return;
      }
      // Sent: drop the local photos. The page re-renders with the status.
      setFront(null);
      setBack(null);
      setLiveness(null);
    });
  }

  return (
    <Card>
      <CardBody className="grid gap-6">
        <div>
          <h2 className="text-2xl">Verify your identity</h2>
          <p className="measure mt-1 text-sm text-muted">
            A valid Philippine government ID and a short selfie check. It takes about three minutes, and a person on our team reviews it.
          </p>
        </div>

        {testMode && (
          <TestModeNotice title="Test mode — your photos stay on this device">
            No identity service is connected yet. Your ID photos and selfie frames are checked for clarity on this device and then discarded: nothing is
            uploaded or stored, and no face match is performed. Only the details you type (with the ID number cut to its last four characters) reach our
            reviewers.
          </TestModeNotice>
        )}

        {/* Progress: four steps, then the status page. */}
        <ol className="grid grid-cols-4 gap-2" aria-label="Progress">
          {STEPS.map((label, i) => (
            <li key={label} aria-current={i === step ? "step" : undefined} className="grid gap-1.5">
              <span className={cn("h-1 rounded-full transition-colors duration-500", i < step ? "bg-champagne" : i === step ? "bg-champagne/60" : "bg-line")} />
              <span className={cn("hidden text-xs sm:block", i === step ? "font-semibold text-fg" : "text-muted")}>
                {i + 1}. {label}
              </span>
            </li>
          ))}
        </ol>
        <p className="-mt-3 text-xs text-muted sm:hidden">
          Step {step + 1} of 4 · {STEPS[step]}
        </p>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={reduce ? false : { opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: -18 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="grid gap-5"
          >
            {step === 0 && (
              <fieldset className="grid gap-3">
                <legend className="mb-2 text-sm font-semibold">Which ID will you use?</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ID_TYPES.map((t) => (
                    <label
                      key={t.value}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-[border-color,background-color,box-shadow] duration-300",
                        idType === t.value ? "border-champagne bg-gold-tint shadow-[0_0_0_1px_rgb(214_178_110/0.35)]" : "border-line hover:border-gold-large/50",
                      )}
                    >
                      <input type="radio" name="idType" value={t.value} checked={idType === t.value} onChange={() => setIdType(t.value)} className="peer sr-only" />
                      <IdCard className={cn("mt-0.5 size-5 shrink-0", idType === t.value ? "text-champagne" : "text-muted")} aria-hidden />
                      <span className="min-w-0 rounded peer-focus-visible:outline-2 peer-focus-visible:outline-ring">
                        <span className="block text-sm font-semibold">{t.label}</span>
                        <span className="block text-xs text-muted">{t.issuer}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted">The ID must be valid, original (not a photocopy) and show your photo, full name and date of birth. You must be {MIN_AGE} or older.</p>
              </fieldset>
            )}

            {step === 1 && type && (
              <div className="grid gap-6 md:grid-cols-2">
                <IdCapture side="front" value={front} onChange={setFront} />
                {type.hasBack ? (
                  <IdCapture side="back" value={back} onChange={setBack} />
                ) : (
                  <p className="self-center text-sm text-muted">Only the photo page is needed for a {type.label.toLowerCase()}.</p>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-4">
                <p className="measure text-sm text-muted">
                  This shows a real person is present, not a photo of one. Follow the prompts in good light; keep your face inside the oval.
                </p>
                <LivenessCapture value={liveness} onChange={setLiveness} />
              </div>
            )}

            {step === 3 && type && (
              <form id="identity-form" onSubmit={submit} className="grid gap-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name, exactly as on the ID" error={fieldErrors.nameOnId} hint="Include middle names if the ID shows them.">
                    {(p) => <Input {...p} autoComplete="name" value={nameOnId} onChange={(e) => setNameOnId(e.target.value)} required maxLength={120} />}
                  </Field>
                  <Field label="ID number" error={fieldErrors.idNumber} hint={`${type.numberHint}. We keep only the last four characters.`}>
                    {(p) => <Input {...p} autoComplete="off" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} required maxLength={40} className="tabular" />}
                  </Field>
                  <Field
                    label="Date of birth"
                    error={fieldErrors.birthDate ?? (underage ? `Luxx4less accounts are for people ${MIN_AGE} and over.` : null)}
                    hint="We keep only the year."
                  >
                    {(p) => <Input {...p} type="date" max={today} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required />}
                  </Field>
                  {type.hasExpiry && (
                    <Field label="Expiry date" error={fieldErrors.expiry}>
                      {(p) => <Input {...p} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} required />}
                    </Field>
                  )}
                </div>

                <div className="grid gap-2 rounded-xl border border-line bg-surface-sunk/60 p-4 text-sm">
                  <p className="font-semibold">You&apos;re sending</p>
                  <ul className="grid gap-1 text-muted">
                    <li>
                      {type.label}, number ending <span className="tabular font-semibold text-fg">{idNumber.replace(/[^A-Za-z0-9]/g, "").slice(-4).toUpperCase() || "····"}</span>
                    </li>
                    <li>
                      {storesImages ? "Photos of both sides and your selfie check, held by our verification provider" : "Clarity scores for your ID photos and the result of the selfie prompts (the images themselves stay here)"}
                    </li>
                    <li>The name and dates above, with only the birth year kept</li>
                  </ul>
                </div>

                <div className="grid gap-3 rounded-xl border border-champagne/30 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Lock className="size-4 text-champagne" aria-hidden /> Consent to process biometric data
                  </p>
                  <p className="text-sm text-muted">
                    Your ID and face are sensitive personal information under the Data Privacy Act of 2012. We use them only to confirm you are who you say
                    you are, keep them no longer than the law and our{" "}
                    <Link href="/privacy" className="text-gold underline-offset-4 hover:underline">
                      Privacy Notice
                    </Link>{" "}
                    allow, and never share them with other members. You can ask to see, correct or delete your data at any time.
                  </p>
                  <Checkbox
                    label="I consent to Luxx4less processing my government ID and selfie check to verify my identity."
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  {fieldErrors.biometricConsent && <p className="text-sm font-medium text-danger">{fieldErrors.biometricConsent}</p>}
                </div>
              </form>
            )}
          </motion.div>
        </AnimatePresence>

        {error && <FormAlert>{error}</FormAlert>}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <Button type="button" variant="ghost" className="rounded-full" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || pending}>
            <ArrowLeft aria-hidden /> Back
          </Button>
          {step < 3 ? (
            <Button type="button" className="rounded-full px-6" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              Continue
            </Button>
          ) : (
            <Button type="submit" form="identity-form" className="rounded-full px-6" disabled={pending || !consent || underage || !idNumber || !birthDate}>
              {pending ? (
                "Sending…"
              ) : (
                <>
                  <Check aria-hidden /> Send for review
                </>
              )}
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
