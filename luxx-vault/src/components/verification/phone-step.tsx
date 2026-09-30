"use client";

import Link from "next/link";
import { CircleCheck, MessageSquareText, Smartphone } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { sendPhoneCodeAction, verifyPhoneCodeAction } from "@/app/account/verification/actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, FormAlert, Input } from "@/components/ui/field";
import { formatPhMobile, normalizePhMobile } from "@/lib/phone";
import { TestModeNotice } from "./test-mode-notice";

type Sent = { phoneDisplay: string; expiresAt: number; resendAt: number; testCode?: string };

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Tier 2: number → 6-digit code → verified. */
export function PhoneStep({ verifiedPhone, testMode, continueHref }: { verifiedPhone: string | null; testMode: boolean; continueHref: string | null }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<Sent | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const now = useNow(Boolean(sent));

  const normalized = normalizePhMobile(phone);
  const expired = sent ? now >= sent.expiresAt : false;
  const canResend = sent ? now >= sent.resendAt : true;

  function send(target: string) {
    setError(null);
    start(async () => {
      const r = await sendPhoneCodeAction(target);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setCode("");
      setSent({ phoneDisplay: r.phoneDisplay, expiresAt: Date.parse(r.expiresAt), resendAt: Date.now() + r.resendAfterSec * 1000, testCode: r.testCode });
    });
  }

  function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await verifyPhoneCodeAction(code);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setDone(r.phoneDisplay);
      setSent(null);
    });
  }

  if ((verifiedPhone && !changing) || done) {
    return (
      <Card>
        <CardBody className="grid gap-4">
          <div className="flex items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-gold-metal text-velvet">
              <CircleCheck className="size-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-2xl">Mobile number verified</h2>
              <p className="tabular text-sm text-muted">{done ?? formatPhMobile(verifiedPhone!)}</p>
            </div>
          </div>
          <p className="measure text-sm text-muted">Only you and our staff can see this number. It is never shown on your profile or listings.</p>
          <div className="flex flex-wrap gap-3">
            {continueHref && (
              <Button asChild className="rounded-full px-6">
                <Link href={continueHref}>Continue where you left off</Link>
              </Button>
            )}
            {!continueHref && done && (
              <Button asChild className="rounded-full px-6">
                <Link href="/account/verification?step=identity">Next: verify your identity</Link>
              </Button>
            )}
            {!done && (
              <Button variant="ghost" className="rounded-full" onClick={() => setChanging(true)}>
                Change number
              </Button>
            )}
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="grid gap-5">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full border border-champagne/50 text-champagne">
            {sent ? <MessageSquareText className="size-5" aria-hidden /> : <Smartphone className="size-5" aria-hidden />}
          </span>
          <div className="min-w-0">
            <h2 className="text-2xl">{sent ? "Enter the code" : "Verify your mobile number"}</h2>
            <p className="measure mt-1 text-sm text-muted">
              {sent ? (
                <>
                  We sent a 6-digit code to <span className="tabular font-semibold text-fg">{sent.phoneDisplay}</span>. It expires in five minutes.
                </>
              ) : (
                "A Philippine mobile number, confirmed with a one-time code by SMS. One number can verify one account, and it's never shown to other members."
              )}
            </p>
          </div>
        </div>

        {testMode && (
          <TestModeNotice title="Test mode — no SMS was sent">
            {sent?.testCode ? (
              <>
                Text messages aren&apos;t connected yet, so here is the code that would have been sent:{" "}
                <strong className="tabular ml-1 rounded bg-surface px-2 py-0.5 text-base tracking-[0.25em] text-fg" data-testid="test-otp">
                  {sent.testCode}
                </strong>
                <span className="mt-1 block text-xs text-muted">It is also saved in the developer outbox. Real numbers receive nothing in this mode.</span>
              </>
            ) : (
              "Text messages aren't connected yet. When you ask for a code, it will be shown here instead of being sent."
            )}
          </TestModeNotice>
        )}

        {error && <FormAlert>{error}</FormAlert>}

        {!sent ? (
          <form
            className="grid max-w-sm gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              send(phone);
            }}
          >
            <Field
              label="Mobile number"
              hint={normalized ? `We'll text ${formatPhMobile(normalized)}` : "For example 0917 123 4567 or +63 917 123 4567"}
            >
              {(p) => (
                <Input {...p} type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0917 123 4567" className="tabular" />
              )}
            </Field>
            <Button type="submit" className="w-fit rounded-full px-6" disabled={pending || !normalized}>
              {pending ? "Sending…" : "Send code"}
            </Button>
          </form>
        ) : (
          <form className="grid max-w-sm gap-4" onSubmit={verify}>
            <Field label="6-digit code" hint={expired ? "This code has expired. Ask for a new one." : `Expires in ${mmss(sent.expiresAt - now)}`}>
              {(p) => (
                <Input
                  {...p}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={7}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, ""))}
                  className="tabular text-center text-2xl tracking-[0.4em]"
                  autoFocus
                />
              )}
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" className="rounded-full px-6" disabled={pending || expired || code.replace(/\s/g, "").length !== 6}>
                {pending ? "Checking…" : "Verify"}
              </Button>
              <Button type="button" variant="ghost" className="rounded-full" disabled={pending || !canResend} onClick={() => send(phone)}>
                {canResend ? "Send a new code" : `New code in ${mmss(sent.resendAt - now)}`}
              </Button>
            </div>
            <button
              type="button"
              className="w-fit text-sm text-gold underline-offset-4 hover:underline"
              onClick={() => {
                setSent(null);
                setError(null);
              }}
            >
              Use a different number
            </button>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
