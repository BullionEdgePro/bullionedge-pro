"use client";

import Link from "next/link";
import { Building2, KeyRound, UserRound } from "lucide-react";
import { useState, useTransition } from "react";
import { submitSellerAction } from "@/app/account/verification/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Checkbox, Field, FormAlert, Input, Select } from "@/components/ui/field";
import { ADDRESS_PROOF_KINDS, ADDRESS_PROOF_MAX_AGE_DAYS, BIR_COR_LABEL, BUSINESS_REG_KINDS, PAYOUT_KINDS } from "@/config/kyc";
import { cn } from "@/lib/cn";
import { TestModeNotice } from "./test-mode-notice";

/** Tier 4: proof of address, business papers if any, payout account in the same name. */
export function SellerForm({ idName, twoFactorEnabled, testMode }: { idName: string; twoFactorEnabled: boolean; testMode: boolean }) {
  const [sellerType, setSellerType] = useState<"individual" | "business">("individual");
  const [payoutKind, setPayoutKind] = useState<string>("gcash");
  const [error, setError] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  // Date bounds for the picker, fixed when the form opens (the server re-checks).
  const [{ today, oldest }] = useState(() => {
    const now = Date.now();
    const iso = (t: number) => new Date(t).toLocaleDateString("en-CA"); // YYYY-MM-DD in the device's own time zone
    return { today: iso(now), oldest: iso(now - ADDRESS_PROOF_MAX_AGE_DAYS * 86_400_000) };
  });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => (f.get(k) as string | null) ?? "";
    setError(null);
    setFe({});
    start(async () => {
      const r = await submitSellerAction({
        sellerType,
        addressProofKind: s("addressProofKind"),
        addressProofDate: s("addressProofDate"),
        businessRegKind: sellerType === "business" ? s("businessRegKind") || null : null,
        hasBirCor: f.get("hasBirCor") === "on",
        payoutKind,
        bankName: payoutKind === "bank" ? s("bankName") : null,
        payoutAccountName: s("payoutAccountName"),
        payoutAccountNumber: s("payoutAccountNumber"),
        declaration: f.get("declaration") === "on",
      });
      if (!r.ok) {
        setError(r.error);
        setFe(r.fieldErrors ?? {});
      }
    });
  }

  return (
    <Card>
      <CardBody className="grid gap-6">
        <div>
          <h2 className="text-2xl">Become a verified seller</h2>
          <p className="measure mt-1 text-sm text-muted">
            Buyers pay for gold before they hold it, so they need to know exactly who they&apos;re dealing with. These checks tie your shop to a real address
            and to a payout account in your own name.
          </p>
        </div>

        {testMode && (
          <TestModeNotice title="Test mode — no documents are collected">
            Document upload isn&apos;t connected yet. Tell us which documents you hold; when live verification is switched on, our team will ask to see
            them before approving. Your payout number is cut to its last four digits before it is saved.
          </TestModeNotice>
        )}

        <div className={cn("flex items-start gap-3 rounded-xl border p-4 text-sm", twoFactorEnabled ? "border-success/30" : "border-warning/40 bg-warning-tint")}>
          <KeyRound className={cn("mt-0.5 size-4 shrink-0", twoFactorEnabled ? "text-success" : "text-warning")} aria-hidden />
          <p>
            Selling also needs <strong>two-step sign-in</strong>, so a stolen password can&apos;t empty your shop.{" "}
            {twoFactorEnabled ? (
              <Badge tone="success">On</Badge>
            ) : (
              <>
                It&apos;s off for you now.{" "}
                <Link href="/account/security" className="font-semibold text-gold underline-offset-4 hover:underline">
                  Turn it on in Security
                </Link>
                .
              </>
            )}
          </p>
        </div>

        {error && <FormAlert>{error}</FormAlert>}

        <form onSubmit={submit} className="grid gap-7">
          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-semibold">You are selling as</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  { v: "individual", label: "An individual", hint: "Selling your own pieces", icon: UserRound },
                  { v: "business", label: "A business", hint: "Registered with DTI or SEC", icon: Building2 },
                ] as const
              ).map((o) => (
                <label
                  key={o.v}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors duration-300",
                    sellerType === o.v ? "border-champagne bg-gold-tint" : "border-line hover:border-gold-large/50",
                  )}
                >
                  <input type="radio" name="sellerType" value={o.v} checked={sellerType === o.v} onChange={() => setSellerType(o.v)} className="peer sr-only" />
                  <o.icon className={cn("size-5 shrink-0", sellerType === o.v ? "text-champagne" : "text-muted")} aria-hidden />
                  <span className="rounded peer-focus-visible:outline-2 peer-focus-visible:outline-ring">
                    <span className="block text-sm font-semibold">{o.label}</span>
                    <span className="block text-xs text-muted">{o.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="grid gap-4">
            <legend className="mb-1 text-sm font-semibold">Proof of address</legend>
            <p className="-mt-2 text-xs text-muted">In your name, showing the address you sell from, dated within the last three months.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Document" error={fe.addressProofKind}>
                {(p) => (
                  <Select {...p} name="addressProofKind" required defaultValue="">
                    <option value="" disabled>
                      Choose one
                    </option>
                    {ADDRESS_PROOF_KINDS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Date on the document" error={fe.addressProofDate}>
                {(p) => <Input {...p} type="date" name="addressProofDate" min={oldest} max={today} required />}
              </Field>
            </div>
          </fieldset>

          {sellerType === "business" && (
            <fieldset className="grid gap-4">
              <legend className="mb-1 text-sm font-semibold">Business registration</legend>
              <Field label="Registered with" error={fe.businessRegKind}>
                {(p) => (
                  <Select {...p} name="businessRegKind" required defaultValue="">
                    <option value="" disabled>
                      Choose one
                    </option>
                    {BUSINESS_REG_KINDS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Checkbox name="hasBirCor" label={`I have the business's ${BIR_COR_LABEL}.`} />
              {fe.hasBirCor && <p className="text-sm font-medium text-danger">{fe.hasBirCor}</p>}
            </fieldset>
          )}

          <fieldset className="grid gap-4">
            <legend className="mb-1 text-sm font-semibold">Where you&apos;ll be paid</legend>
            <p className="-mt-2 text-xs text-muted">
              The account must be in the same name as your verified ID{idName ? <> (<span className="font-semibold text-fg">{idName}</span>)</> : null}. We
              save only a masked version, like &ldquo;GCash ••••7788&rdquo;, and never show it to buyers.
            </p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Payout method">
              {PAYOUT_KINDS.map((k) => (
                <label key={k.value} className="cursor-pointer">
                  <input type="radio" name="payoutKind" value={k.value} checked={payoutKind === k.value} onChange={() => setPayoutKind(k.value)} className="peer sr-only" />
                  <span className="inline-flex h-9 items-center rounded-full border border-line px-4 text-sm transition-colors peer-checked:border-champagne peer-checked:bg-gold-tint peer-checked:text-champagne peer-focus-visible:outline-2 peer-focus-visible:outline-ring">
                    {k.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {payoutKind === "bank" && (
                <Field label="Bank" error={fe.bankName}>
                  {(p) => <Input {...p} name="bankName" required maxLength={60} placeholder="e.g. BDO, BPI, Metrobank" />}
                </Field>
              )}
              <Field label="Name on the account" error={fe.payoutAccountName}>
                {(p) => <Input {...p} name="payoutAccountName" required maxLength={120} defaultValue={idName} autoComplete="off" />}
              </Field>
              <Field label={payoutKind === "bank" ? "Account number" : "Wallet mobile number"} error={fe.payoutAccountNumber} hint="Only the last four digits are kept.">
                {(p) => <Input {...p} name="payoutAccountNumber" required inputMode="numeric" autoComplete="off" maxLength={34} className="tabular" />}
              </Field>
            </div>
          </fieldset>

          <div className="grid gap-2">
            <Checkbox
              name="declaration"
              label="I confirm these details are true, the items I list will be mine to sell, and I'll only accept payment through Luxx4less."
            />
            {fe.declaration && <p className="text-sm font-medium text-danger">{fe.declaration}</p>}
          </div>

          <Button type="submit" className="w-fit rounded-full px-6" disabled={pending}>
            {pending ? "Sending…" : "Send for review"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
