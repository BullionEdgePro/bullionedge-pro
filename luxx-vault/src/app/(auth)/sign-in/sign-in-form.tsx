"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormAlert, Input, PasswordInput } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "@/lib/safe-next";

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(params.get("reset") === "1" ? "Password changed. Sign in with your new password." : null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setPending(true);
    const address = email.trim().toLowerCase();
    const { error } = await authClient.signIn.email({ email: address, password, rememberMe: remember });
    setPending(false);
    if (error) {
      if (error.code === "EMAIL_NOT_VERIFIED") {
        // Right password, unconfirmed email: send a fresh link that lands on the welcome screen.
        await authClient.sendVerificationEmail({ email: address, callbackURL: "/account?welcome=1" });
        setNotice("Please confirm your email first. We've sent you a new link.");
      }
      else if (error.status === 429) setError("Too many attempts. Please wait a minute and try again.");
      else setError("That email and password don't match. Check them and try again.");
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function withPasskey() {
    setError(null);
    const { error } = await authClient.signIn.passkey();
    if (error) {
      setError("That passkey didn't work. Try again, or sign in with your password.");
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <div>
        <h1 className="text-3xl">Welcome back</h1>
        <p className="mt-2 text-muted">Sign in to your Luxx4less account.</p>
      </div>
      {error && <FormAlert>{error}</FormAlert>}
      {notice && <FormAlert tone="info">{notice}</FormAlert>}
      <Field label="Email">
        {(p) => <Input {...p} type="email" inputMode="email" autoComplete="username webauthn" value={email} onChange={(e) => setEmail(e.target.value)} />}
      </Field>
      <Field
        label="Password"
        action={
          <Link href="/forgot-password" className="text-sm font-medium text-gold underline-offset-2 hover:underline">
            Forgot password?
          </Link>
        }
      >
        {(p) => <PasswordInput {...p} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} label="Keep me signed in on this device" />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      <Button type="button" size="lg" variant="secondary" onClick={withPasskey}>
        <KeyRound aria-hidden /> Sign in with a passkey
      </Button>
      <p className="text-center text-sm text-muted">
        New to Luxx4less?{" "}
        <Link href="/sign-up" className="font-semibold text-gold underline-offset-2 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
