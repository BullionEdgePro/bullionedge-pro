"use client";

import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormAlert, Input } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

export default function TwoFactorPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const [code, setCode] = useState("");
  const [trust, setTrust] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error } =
      mode === "totp"
        ? await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, ""), trustDevice: trust })
        : await authClient.twoFactor.verifyBackupCode({ code: code.trim(), trustDevice: trust });
    setPending(false);
    if (error) {
      setError(error.status === 429 ? "Too many attempts. Please wait a minute." : "That code didn't work. Check it and try again.");
      return;
    }
    router.push("/account");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <ShieldCheck className="size-12 text-ice-deep dark:text-ice" aria-hidden />
      <div>
        <h1 className="text-3xl">Two-step check</h1>
        <p className="mt-2 text-muted">
          {mode === "totp" ? "Enter the 6-digit code from your authenticator app." : "Enter one of the backup codes you saved when you turned on two-step sign-in."}
        </p>
      </div>
      {error && <FormAlert>{error}</FormAlert>}
      <Field label={mode === "totp" ? "6-digit code" : "Backup code"}>
        {(p) => (
          <Input
            {...p}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode={mode === "totp" ? "numeric" : "text"}
            autoComplete="one-time-code"
            maxLength={mode === "totp" ? 7 : 20}
            className={mode === "totp" ? "tabular text-center text-2xl tracking-[0.4em]" : undefined}
          />
        )}
      </Field>
      <Checkbox checked={trust} onChange={(e) => setTrust(e.target.checked)} label="Trust this device for 30 days" />
      <Button type="submit" size="lg" disabled={pending || code.length < 6}>
        {pending ? "Checking…" : "Continue"}
      </Button>
      <Button type="button" variant="quiet" onClick={() => { setMode(mode === "totp" ? "backup" : "totp"); setCode(""); setError(null); }}>
        {mode === "totp" ? "Use a backup code instead" : "Use my authenticator app"}
      </Button>
    </form>
  );
}
