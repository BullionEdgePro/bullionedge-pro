"use client";

import Link from "next/link";
import { ArrowLeft, Check, MailCheck, ShoppingBag, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormAlert, Input, PasswordInput, StrengthMeter } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { passwordStrength } from "@/lib/password-strength";

/** What the person came to do. Not a permanent account type: everyone can buy, and anyone can become a seller later. */
export type JoinAs = "buyer" | "seller";

const PATHS: Record<JoinAs, { title: string; lead: string; icon: typeof Store; points: string[]; after: string }> = {
  buyer: {
    title: "I'm a buyer",
    lead: "Buy from verified sellers and from Luxx4less.",
    icon: ShoppingBag,
    points: ["Post what you're looking for", "Offers and chat with verified sellers", "Protected payment until you receive it", "Price alerts by email, Viber or Messenger"],
    after: "/account?welcome=1&as=buyer",
  },
  seller: {
    title: "I'm a seller",
    lead: "List your gold and gems for verified buyers.",
    icon: Store,
    points: ["Listings with watermarked photos", "Live gold value and fair-price guide", "Answer buyers' wanted posts", "Your own showroom page to share"],
    after: "/account?welcome=1&as=seller",
  },
};

const callbackFor = (as: JoinAs | null) => (as ? PATHS[as].after : "/account?welcome=1");

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

/** Step one: buyer or seller. Step two: the account form. */
export function SignUpForm({ as }: { as: JoinAs | null }) {
  const router = useRouter();
  if (!as) return <ChooseRole onChoose={(r) => router.replace(`/sign-up?as=${r}`, { scroll: false })} />;
  return <AccountForm as={as} onBack={() => router.replace("/sign-up", { scroll: false })} />;
}

function ChooseRole({ onChoose }: { onChoose: (as: JoinAs) => void }) {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl">Join Luxx4less</h1>
        <p className="mt-2 text-muted">How will you use it first? You can do both later: one account buys and sells.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(Object.keys(PATHS) as JoinAs[]).map((key) => {
          const p = PATHS[key];
          const Icon = p.icon;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChoose(key)}
              className={cn(
                "group relative grid gap-4 overflow-hidden rounded-2xl border border-line bg-surface p-5 text-left transition-[border-color,box-shadow,transform] duration-500 ease-(--ease-vault)",
                "hover:-translate-y-0.5 hover:border-champagne/70 hover:shadow-[0_18px_40px_-24px_rgb(214_178_110/0.55)] focus-visible:border-champagne",
              )}
            >
              <span aria-hidden className="grid size-12 place-items-center rounded-xl bg-gold-metal text-velvet shadow-[0_8px_24px_-12px_#A8823F]">
                <Icon className="size-6" />
              </span>
              <span>
                <span className="block font-display text-xl text-fg">{p.title}</span>
                <span className="mt-1 block text-sm text-muted">{p.lead}</span>
              </span>
              <ul className="grid gap-1.5 text-sm text-fg/85">
                {p.points.map((pt) => (
                  <li key={pt} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-champagne" aria-hidden />
                    {pt}
                  </li>
                ))}
              </ul>
              <span className="mt-1 inline-flex items-center text-sm font-semibold text-gold transition-colors group-hover:text-champagne">
                Continue as {key}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-sm text-muted">
        Selling needs extra checks (ID, proof of address and a payout account in your name) so buyers can trust every listing.
      </p>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold text-gold underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function AccountForm({ as, onBack }: { as: JoinAs; onBack: () => void }) {
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
      callbackURL: callbackFor(as),
    } as Parameters<typeof authClient.signUp.email>[0]);
    setPending(false);
    if (error) {
      setErrors({ form: error.status === 429 ? "Too many attempts. Please wait a few minutes and try again." : (error.message ?? "Something went wrong. Please try again.") });
      return;
    }
    setSentTo(parsed.data.email);
  }

  if (sentTo) return <CheckInbox email={sentTo} as={as} />;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <div>
        <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-champagne">
          <ArrowLeft className="size-4" aria-hidden /> Joining as a {as}
          <span className="sr-only">. Change</span>
        </button>
        <h1 className="text-3xl">{as === "seller" ? "Create your seller account" : "Create your account"}</h1>
        <p className="mt-2 text-muted">
          {as === "seller"
            ? "Start with your account. After you confirm your email we'll guide you through the seller checks, then your first listing."
            : "Browse, post what you want and save pieces. Verification unlocks offers and chat as you go."}
        </p>
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

function CheckInbox({ email, as }: { email: string; as: JoinAs }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "limited">("idle");
  async function resend() {
    setState("sending");
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: callbackFor(as) });
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
