"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormAlert, Input } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

/** Landing for confirmation links that are expired, used up or damaged. */
export function VerifyEmailState() {
  const error = useSearchParams().get("error");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "limited">("idle");

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setState("sending");
    const { error } = await authClient.sendVerificationEmail({ email: email.trim().toLowerCase(), callbackURL: "/account?welcome=1" });
    setState(error?.status === 429 ? "limited" : "sent");
  }

  return (
    <form onSubmit={resend} className="grid gap-5">
      <h1 className="text-3xl">{error ? "This link has expired" : "Confirm your email"}</h1>
      <p className="text-muted">
        {error
          ? "Confirmation links work once and expire after 24 hours. Enter your email and we'll send a fresh one."
          : "Enter the email you signed up with and we'll send a new confirmation link."}
      </p>
      {state === "sent" && <FormAlert tone="success">If that email has an unconfirmed account, a new link is on its way.</FormAlert>}
      {state === "limited" && <FormAlert>Please wait a few minutes before asking again.</FormAlert>}
      <Field label="Email">
        {(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
      </Field>
      <Button type="submit" size="lg" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Send a new link"}
      </Button>
      <Link href="/sign-in" className="text-center text-sm font-semibold text-gold underline-offset-2 hover:underline">
        Back to sign in
      </Link>
    </form>
  );
}
