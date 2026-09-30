"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormAlert, PasswordInput, StrengthMeter } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { passwordStrength } from "@/lib/password-strength";

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const linkError = params.get("error");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const strength = passwordStrength(password);

  if (!token || linkError) {
    return (
      <div className="grid gap-5">
        <h1 className="text-3xl">This link has expired</h1>
        <p className="text-muted">Reset links work once and expire after 1 hour. Ask for a new one below.</p>
        <Button asChild size="lg">
          <Link href="/forgot-password">Send a new link</Link>
        </Button>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 10) return setError("Use at least 10 characters.");
    if (strength.score <= 1) return setError(strength.hint);
    if (password !== confirm) return setError("The two passwords don't match.");
    setPending(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token: token! });
    setPending(false);
    if (error) {
      setError(error.message ?? "This link has expired. Ask for a new one.");
      return;
    }
    router.push("/sign-in?reset=1");
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <div>
        <h1 className="text-3xl">Choose a new password</h1>
        <p className="mt-2 text-muted">You&apos;ll be signed out on every other device.</p>
      </div>
      {error && <FormAlert>{error}</FormAlert>}
      <Field label="New password">
        {(p) => <PasswordInput {...p} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <StrengthMeter {...strength} />
      <Field label="Type it again">
        {(p) => <PasswordInput {...p} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
