"use client";

import { useRouter } from "next/navigation";
import { Copy, KeyRound, Laptop, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import QRCode from "qrcode";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, FormAlert, Input, PasswordInput, StrengthMeter } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { passwordStrength } from "@/lib/password-strength";

function SectionCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardBody className="grid gap-4">
        <div>
          <h2 className="font-sans text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        {children}
      </CardBody>
    </Card>
  );
}

const when = (d: Date | string) => new Date(d).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });

// ------------------------------------------------------------ two-step sign-in

export function TwoFactorSection({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "password" | "scan" | "done" | "disable">("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { data, error } = await authClient.twoFactor.enable({ password });
    setPending(false);
    if (error || !data) return setError("That password isn't right.");
    if (data.method !== "totp") return setError("Couldn't set up the authenticator app. Please try again.");
    setQr(await QRCode.toDataURL(data.totpURI, { margin: 1, width: 220, color: { dark: "#17101F", light: "#FFFFFF" } }));
    setSecret(new URL(data.totpURI).searchParams.get("secret"));
    setBackupCodes(data.backupCodes);
    setPassword("");
    setStep("scan");
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error } = await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, "") });
    setPending(false);
    if (error) return setError("That code didn't match. Wait for a fresh code and try again.");
    setStep("done");
    router.refresh();
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error } = await authClient.twoFactor.disable({ password });
    setPending(false);
    if (error) return setError("That password isn't right.");
    setPassword("");
    setStep("idle");
    router.refresh();
  }

  return (
    <SectionCard
      title="Two-step sign-in"
      description="After your password, enter a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…). Required for sellers and staff."
    >
      <div>{enabled || step === "done" ? <Badge tone="success" icon={<ShieldCheck aria-hidden />}>On</Badge> : <Badge tone="warning">Off</Badge>}</div>
      {error && <FormAlert>{error}</FormAlert>}

      {!enabled && step === "idle" && <Button className="w-fit" onClick={() => setStep("password")}>Turn on two-step sign-in</Button>}

      {step === "password" && (
        <form onSubmit={start} className="grid max-w-sm gap-3">
          <Field label="Confirm your password">{(p) => <PasswordInput {...p} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
          <Button type="submit" className="w-fit" disabled={pending || !password}>Continue</Button>
        </form>
      )}

      {step === "scan" && (
        <div className="grid gap-5 md:grid-cols-[auto_1fr]">
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element -- data: URL QR code
            <img src={qr} width={220} height={220} alt="QR code to add Luxx4less to your authenticator app" className="rounded-lg border border-line" />
          )}
          <div className="grid content-start gap-4">
            <ol className="grid list-decimal gap-1 pl-5 text-sm">
              <li>Open your authenticator app and scan this code.</li>
              <li>Can&apos;t scan? Enter this key: <code className="tabular rounded bg-surface-sunk px-1.5 py-0.5 text-xs break-all">{secret}</code></li>
              <li>Type the 6-digit code it shows.</li>
            </ol>
            <form onSubmit={confirm} className="grid max-w-xs gap-3">
              <Field label="6-digit code">
                {(p) => <Input {...p} inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} className="tabular text-center text-xl tracking-[0.3em]" />}
              </Field>
              <Button type="submit" disabled={pending || code.length < 6}>Turn on</Button>
            </form>
          </div>
          <BackupCodes codes={backupCodes} />
        </div>
      )}

      {step === "done" && <FormAlert tone="success">Two-step sign-in is on. Keep your backup codes somewhere safe.</FormAlert>}

      {enabled && step !== "disable" && step !== "done" && (
        <Button variant="secondary" className="w-fit" onClick={() => setStep("disable")}>Turn off</Button>
      )}
      {step === "disable" && (
        <form onSubmit={disable} className="grid max-w-sm gap-3">
          <Field label="Confirm your password to turn it off">{(p) => <PasswordInput {...p} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
          <div className="flex gap-2">
            <Button type="submit" variant="danger" disabled={pending || !password}>Turn off</Button>
            <Button type="button" variant="ghost" onClick={() => setStep("idle")}>Cancel</Button>
          </div>
        </form>
      )}
    </SectionCard>
  );
}

function BackupCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  if (!codes.length) return null;
  return (
    <div className="grid gap-2 rounded-lg border border-warning/30 bg-warning-tint p-4 md:col-span-2">
      <p className="text-sm font-semibold text-warning">Save your backup codes</p>
      <p className="text-sm text-fg">If you lose your phone, each code gets you in once. They won&apos;t be shown again.</p>
      <ul className="tabular grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm sm:grid-cols-5">
        {codes.map((c) => <li key={c}>{c}</li>)}
      </ul>
      <Button
        size="sm"
        variant="secondary"
        className="w-fit"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(codes.join("\n"));
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        <Copy aria-hidden /> {copied ? "Copied" : "Copy codes"}
      </Button>
    </div>
  );
}

// ------------------------------------------------------------ passkeys

type PasskeyRow = { id: string; name: string | null; createdAt: Date | string | null };

export function PasskeysSection({ items }: { items: PasskeyRow[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setError(null);
    const res = await authClient.passkey.addPasskey({ name: navigator.platform || "This device" });
    if (res?.error) return setError("The passkey wasn't saved. Your device may not support passkeys, or the prompt was closed.");
    router.refresh();
  }

  async function remove(id: string) {
    await authClient.passkey.deletePasskey({ id });
    router.refresh();
  }

  return (
    <SectionCard title="Passkeys" description="Sign in with your fingerprint, face or phone screen lock instead of a password. Passkeys can't be phished.">
      {error && <FormAlert>{error}</FormAlert>}
      {items.length > 0 && (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {items.map((pk) => (
            <li key={pk.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex min-w-0 items-center gap-3">
                <KeyRound className="size-5 shrink-0 text-gold-large" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{pk.name || "Passkey"}</span>
                  {pk.createdAt && <span className="text-xs text-muted">Added {when(pk.createdAt)}</span>}
                </span>
              </span>
              <Button size="icon" variant="ghost" aria-label={`Remove passkey ${pk.name ?? ""}`} onClick={() => remove(pk.id)}>
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {items.length === 0 && <p className="text-sm text-muted">No passkeys yet.</p>}
      <Button variant="secondary" className="w-fit" onClick={add}>
        <KeyRound aria-hidden /> Add a passkey
      </Button>
    </SectionCard>
  );
}

// ------------------------------------------------------------ devices

type SessionRow = { id: string; token: string; userAgent: string | null; ipAddress: string | null; updatedAt: Date | string };

function deviceLabel(ua?: string | null) {
  if (!ua) return { name: "Unknown device", mobile: false };
  const mobile = /Android|iPhone|iPad|Mobile/.test(ua);
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return { name: `${browser} on ${os}`, mobile };
}

export function SessionsSection({ currentToken, items }: { currentToken: string; items: SessionRow[] }) {
  const router = useRouter();
  return (
    <SectionCard title="Signed-in devices" description="Where your account is signed in right now. Sign out anything you don't recognise.">
      {items.length > 0 && (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {items.map((s) => {
            const d = deviceLabel(s.userAgent);
            const current = s.token === currentToken;
            return (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex min-w-0 items-center gap-3">
                  {d.mobile ? <Smartphone className="size-5 shrink-0 text-muted" aria-hidden /> : <Laptop className="size-5 shrink-0 text-muted" aria-hidden />}
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {d.name} {current && <Badge tone="success" className="ml-1">This device</Badge>}
                    </span>
                    <span className="text-xs text-muted">
                      Last active {when(s.updatedAt)}
                      {s.ipAddress ? ` · ${s.ipAddress}` : ""}
                    </span>
                  </span>
                </span>
                {!current && (
                  <Button size="sm" variant="ghost" onClick={async () => { await authClient.revokeSession({ token: s.token }); router.refresh(); }}>
                    Sign out
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {items.length > 1 && (
        <Button variant="secondary" className="w-fit" onClick={async () => { await authClient.revokeOtherSessions(); router.refresh(); }}>
          Sign out all other devices
        </Button>
      )}
    </SectionCard>
  );
}

// ------------------------------------------------------------ password

export function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ tone: "danger" | "success"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const strength = passwordStrength(next);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next.length < 10 || strength.score <= 1) return setMsg({ tone: "danger", text: strength.hint || "Use at least 10 characters." });
    setPending(true);
    const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    setPending(false);
    if (error) return setMsg({ tone: "danger", text: error.message ?? "Your current password isn't right." });
    setCurrent("");
    setNext("");
    setMsg({ tone: "success", text: "Password changed. Other devices have been signed out." });
  }

  return (
    <SectionCard title="Password" description="Changing it signs you out everywhere else.">
      {msg && <FormAlert tone={msg.tone}>{msg.text}</FormAlert>}
      <form onSubmit={onSubmit} className="grid max-w-sm gap-3">
        <Field label="Current password">{(p) => <PasswordInput {...p} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />}</Field>
        <Field label="New password">{(p) => <PasswordInput {...p} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />}</Field>
        <StrengthMeter {...strength} />
        <Button type="submit" className="w-fit" disabled={pending || !current || !next}>Change password</Button>
      </form>
    </SectionCard>
  );
}
