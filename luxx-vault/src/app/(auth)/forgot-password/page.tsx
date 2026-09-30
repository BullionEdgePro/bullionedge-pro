"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormAlert, Input } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "pending" | "done" | "limited">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setState("pending");
    const { error } = await authClient.requestPasswordReset({ email: email.trim().toLowerCase(), redirectTo: "/reset-password" });
    // Same answer whether or not the account exists (no account enumeration).
    setState(error?.status === 429 ? "limited" : "done");
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <div>
        <h1 className="text-3xl">Reset your password</h1>
        <p className="mt-2 text-muted">Enter your account email and we&apos;ll send a link to choose a new password.</p>
      </div>
      {state === "done" && <FormAlert tone="success">If an account uses that email, a reset link is on its way. It expires in 1 hour.</FormAlert>}
      {state === "limited" && <FormAlert>Please wait a few minutes before asking again.</FormAlert>}
      <Field label="Email">
        {(p) => <Input {...p} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
      </Field>
      <Button type="submit" size="lg" disabled={state === "pending"}>
        {state === "pending" ? "Sending…" : "Send reset link"}
      </Button>
      <Link href="/sign-in" className="text-center text-sm font-semibold text-gold underline-offset-2 hover:underline">
        Back to sign in
      </Link>
    </form>
  );
}
