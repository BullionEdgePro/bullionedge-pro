"use client";

import Link from "next/link";
import { MailCheck } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormAlert, Input, PasswordInput, StrengthMeter } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { passwordStrength } from "@/lib/password-strength";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your full name.").max(80),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
  password: z.string().min(10, "Use at least 10 characters.").max(128),
  acceptTerms: z.literal(true, { error: "Please agree to the Terms." }),
  acceptPrivacy: z.literal(true, { error: "Please agree to the Privacy Notice." }),
  ageConfirmed: z.literal(true, { error: "You must be 18 or older." }),
  marketing: z.boolean(),
});

type Errors = Partial<Record<keyof z.infer<typeof schema> | "form", string>>;

export function SignUpForm() {
  const [values, setValues] = useState({ name: "", email: "", password: "", acceptTerms: false, acceptPrivacy: false, ageConfirmed: false, marketing: false });
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const strength = passwordStrength(values.password, [values.name, values.email.split("@")[0] ?? ""]);

  const set = <K extends keyof typeof values>(k: K, v: (typeof values)[K]) => setValues((s) => ({ ...s, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof Errors] ??= issue.message;
      setErrors(next);
      return;
    }
    if (strength.score <= 1) {
      setErrors({ password: strength.hint });
      return;
    }
    setErrors({});
    setPending(true);
    // Consents travel with the request; the server refuses sign-up without them and records them.
    const { error } = await authClient.signUp.email({
      ...parsed.data,
      callbackURL: "/account?welcome=1",
    } as Parameters<typeof authClient.signUp.email>[0]);
    setPending(false);
    if (error) {
      setErrors({ form: error.status === 429 ? "Too many attempts. Please wait a few minutes and try again." : (error.message ?? "Something went wrong. Please try again.") });
      return;
    }
    setSentTo(parsed.data.email);
  }

  if (sentTo) return <CheckInbox email={sentTo} />;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <div>
        <h1 className="text-3xl">Create your account</h1>
        <p className="mt-2 text-muted">Shop official Luxx4less gold and save pieces to your wishlist. Verification unlocks more as you go.</p>
      </div>
      {errors.form && <FormAlert>{errors.form}</FormAlert>}
      <Field label="Full name" error={errors.name}>
        {(p) => <Input {...p} autoComplete="name" value={values.name} onChange={(e) => set("name", e.target.value)} />}
      </Field>
      <Field label="Email" error={errors.email}>
        {(p) => <Input {...p} type="email" inputMode="email" autoComplete="email" value={values.email} onChange={(e) => set("email", e.target.value)} />}
      </Field>
      <Field label="Password" error={errors.password}>
        {(p) => <PasswordInput {...p} autoComplete="new-password" value={values.password} onChange={(e) => set("password", e.target.value)} />}
      </Field>
      <StrengthMeter {...strength} />
      <fieldset className="grid gap-3 rounded-xl border border-line bg-surface p-4">
        <legend className="px-1 text-sm font-semibold">Before you continue</legend>
        <Checkbox
          checked={values.acceptTerms}
          onChange={(e) => set("acceptTerms", e.target.checked)}
          label={
            <>
              I agree to the <Link href="/terms" className="font-semibold text-gold underline-offset-2 hover:underline">Terms</Link>.
            </>
          }
        />
        <Checkbox
          checked={values.acceptPrivacy}
          onChange={(e) => set("acceptPrivacy", e.target.checked)}
          label={
            <>
              I&apos;ve read the <Link href="/privacy" className="font-semibold text-gold underline-offset-2 hover:underline">Privacy Notice</Link> and agree to Luxx4less processing my details to run my account.
            </>
          }
        />
        <Checkbox checked={values.ageConfirmed} onChange={(e) => set("ageConfirmed", e.target.checked)} label="I am 18 years old or older." />
        <Checkbox checked={values.marketing} onChange={(e) => set("marketing", e.target.checked)} label="Send me new arrivals and gold price alerts (optional)." />
        {(errors.acceptTerms || errors.acceptPrivacy || errors.ageConfirmed) && (
          <p role="alert" className="text-sm font-medium text-danger">
            {errors.acceptTerms ?? errors.acceptPrivacy ?? errors.ageConfirmed}
          </p>
        )}
      </fieldset>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creating your account…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold text-gold underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

function CheckInbox({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "limited">("idle");
  async function resend() {
    setState("sending");
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/account?welcome=1" });
    setState(error?.status === 429 ? "limited" : "sent");
  }
  return (
    <div className="grid gap-5">
      <MailCheck className="size-12 text-gold-large" aria-hidden />
      <h1 className="text-3xl">Check your email</h1>
      <p className="text-muted">
        We sent a confirmation link to <strong className="text-fg">{email}</strong>. It works once and expires in 24 hours. Open it on this device to
        finish creating your account.
      </p>
      {state === "sent" && <FormAlert tone="success">A new link is on its way.</FormAlert>}
      {state === "limited" && <FormAlert>Please wait a few minutes before asking for another link.</FormAlert>}
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={resend} disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Send a new link"}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/sign-in">Go to sign in</Link>
        </Button>
      </div>
      <p className="text-xs text-muted">Can&apos;t find it? Check Spam or Promotions, and make sure the address above is right.</p>
    </div>
  );
}
