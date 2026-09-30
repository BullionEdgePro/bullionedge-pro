import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Eye, FileLock2, RefreshCcw, ShieldCheck } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/field";
import { IdentityWizard } from "@/components/verification/identity-wizard";
import { PhoneStep } from "@/components/verification/phone-step";
import { SellerForm } from "@/components/verification/seller-form";
import { StatusCard } from "@/components/verification/status-card";
import { TierLadder, type Rung } from "@/components/verification/tier-ladder";
import { idTypeLabel, maskIdNumber } from "@/config/kyc";
import { maskPhMobile } from "@/lib/phone";
import { safeNext } from "@/lib/safe-next";
import { db } from "@/lib/server/db";
import { kycProvider } from "@/lib/server/kyc/provider";
import { latestSubmissions } from "@/lib/server/kyc/submissions";
import { smsProvider } from "@/lib/server/sms/provider";
import { requireViewer } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "Verification" };

type Step = "phone" | "identity" | "seller";
const STEPS: readonly Step[] = ["phone", "identity", "seller"];

export default async function VerificationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const one = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : undefined);
  const viewer = await requireViewer("/account/verification");
  const { identity, seller } = await latestSubmissions(viewer.userId);
  const profile = viewer.profile;

  const step = STEPS.find((s) => s === one("step")) ?? null;
  const restart = one("restart") === "1";
  const nextRaw = one("next");
  const next = nextRaw ? safeNext(nextRaw, "") || null : null;
  const qs = (s: Step, extra = "") => `/account/verification?step=${s}${next ? `&next=${encodeURIComponent(next)}` : ""}${extra}`;

  const sms = smsProvider();
  const kyc = kycProvider();

  // ---------------------------------------------------------------- the ladder
  const phoneDone = Boolean(profile?.phoneVerifiedAt);
  const idDone = Boolean(profile?.identityVerifiedAt);
  const sellerDone = Boolean(profile?.sellerVerifiedAt);
  const stateOf = (done: boolean, unlocked: boolean, sub: { status: string } | null) =>
    done ? "done" : !unlocked ? "locked" : sub?.status === "pending" ? "review" : sub && sub.status !== "approved" ? "attention" : "current";

  const rungs: Rung[] = [
    { key: "email", state: viewer.tier >= 1 ? "done" : "current", detail: viewer.email },
    {
      key: "phone",
      state: phoneDone ? "done" : viewer.tier >= 1 ? "current" : "locked",
      detail: phoneDone ? maskPhMobile(profile?.phone) : null,
      href: qs("phone"),
      actionLabel: phoneDone ? "Change number" : "Verify mobile number",
    },
    {
      key: "identity",
      state: stateOf(idDone, phoneDone, identity),
      detail: identity ? `${idTypeLabel(identity.idType)} · ${maskIdNumber(identity.idNumberLast4)}` : null,
      ...(phoneDone && !idDone ? { href: qs("identity"), actionLabel: identity?.status === "pending" ? "See status" : identity && identity.status !== "approved" ? "See what's needed" : "Verify identity" } : {}),
    },
    {
      key: "seller",
      state: stateOf(sellerDone, idDone, seller),
      detail: seller?.payoutMasked ? `Payouts to ${seller.payoutMasked}` : null,
      ...(idDone && !sellerDone ? { href: qs("seller"), actionLabel: seller?.status === "pending" ? "See status" : seller && seller.status !== "approved" ? "See what's needed" : "Apply to sell" } : {}),
    },
  ];

  // ---------------------------------------------------------------- the active step
  let panel: React.ReactNode = null;
  if (step === "phone") {
    panel = <PhoneStep verifiedPhone={phoneDone ? (profile?.phone ?? null) : null} testMode={sms.isTest} continueHref={phoneDone ? next : null} />;
  } else if (step === "identity") {
    if (!phoneDone) {
      panel = <Locked title="Verify your mobile number first" body="Identity checks build on a confirmed mobile number." href={qs("phone")} action="Verify mobile number" />;
    } else if (idDone && !identity) {
      panel = <Verified title="Your identity is verified" body="Marketplace buying, offers and chat with sellers are open to you." continueHref={next} />;
    } else if (identity && (idDone || identity.status === "pending" || !restart)) {
      panel = <StatusCard submission={identity} restartHref={qs("identity", "&restart=1")} continueHref={idDone ? next : null} />;
    } else {
      panel = <IdentityWizard accountName={viewer.name} testMode={kyc.isTest} storesImages={kyc.storesImages} />;
    }
  } else if (step === "seller") {
    if (!idDone) {
      panel = <Locked title="Verify your identity first" body="Seller checks build on an approved identity check." href={qs(phoneDone ? "identity" : "phone")} action={phoneDone ? "Verify identity" : "Verify mobile number"} />;
    } else if (sellerDone && !seller) {
      panel = <Verified title="You're a verified seller" body="You can create listings and receive payouts." continueHref={next} />;
    } else if (seller && (sellerDone || seller.status === "pending" || !restart)) {
      panel = <StatusCard submission={seller} restartHref={qs("seller", "&restart=1")} continueHref={sellerDone ? next : null} />;
    } else {
      const approvedId = await db.kycSubmission.findFirst({
        where: { userId: viewer.userId, level: "identity", status: "approved" },
        orderBy: { reviewedAt: "desc" },
        select: { nameOnId: true },
      });
      panel = <SellerForm idName={approvedId?.nameOnId ?? viewer.name} twoFactorEnabled={viewer.twoFactorEnabled} testMode={kyc.isTest} />;
    }
  }

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        {step && (
          <Link href={next ? `/account/verification?next=${encodeURIComponent(next)}` : "/account/verification"} className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-fg">
            <ArrowLeft className="size-4" aria-hidden /> All verification steps
          </Link>
        )}
        <h1 className="text-3xl sm:text-4xl">Verification</h1>
        <p className="measure text-muted">
          Four steps, each opening more of Luxx4less. Every buyer and seller on the marketplace has climbed the same ladder, so you always know who
          you&apos;re dealing with.
        </p>
      </header>

      {next && !step && <FormAlert tone="info">Finish the next step and we&apos;ll take you back to where you were.</FormAlert>}

      {panel ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
          <div className="min-w-0">{panel}</div>
          <PrivacyNote compact />
        </div>
      ) : (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
          <Card>
            <CardBody className="py-7 sm:px-8">
              <TierLadder rungs={rungs} />
            </CardBody>
          </Card>
          <div className="grid gap-4">
            <PrivacyNote />
            <Card>
              <CardBody className="grid gap-2">
                <p className="flex items-center gap-2 font-semibold">
                  <RefreshCcw className="size-4 text-champagne" aria-hidden /> Checking again later
                </p>
                <p className="text-sm text-muted">
                  To keep accounts safe we may ask you to verify again: after 12 months, when you change your name or payout account, or before a large
                  trade from a new device.
                </p>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Verified({ title, body, continueHref }: { title: string; body: string; continueHref: string | null }) {
  return (
    <Card>
      <CardBody className="grid gap-3">
        <h2 className="text-2xl">{title}</h2>
        <p className="text-sm text-muted">{body}</p>
        {continueHref && (
          <Link href={continueHref} className="w-fit font-semibold text-gold underline-offset-4 hover:underline">
            Continue where you left off
          </Link>
        )}
      </CardBody>
    </Card>
  );
}

function Locked({ title, body, href, action }: { title: string; body: string; href: string; action: string }) {
  return (
    <Card>
      <CardBody className="grid gap-3">
        <h2 className="text-2xl">{title}</h2>
        <p className="text-sm text-muted">{body}</p>
        <Link href={href} className="w-fit font-semibold text-gold underline-offset-4 hover:underline">
          {action}
        </Link>
      </CardBody>
    </Card>
  );
}

function PrivacyNote({ compact = false }: { compact?: boolean }) {
  const items = [
    { icon: FileLock2, title: "Kept to the minimum", body: "We store masked details only: the last four characters of your ID number, your birth year, a masked payout account." },
    { icon: Eye, title: "Seen by few", body: "Only trained verification staff, who sign in with two-step codes. Every look and every decision is logged." },
    { icon: ShieldCheck, title: "Your rights", body: "Under the Data Privacy Act of 2012 you can ask to see, correct or delete your data." },
  ];
  return (
    <Card className="surface-velvet">
      <CardBody className="grid gap-4">
        <p className="font-display text-lg text-champagne">How we protect your data</p>
        <ul className="grid gap-3.5">
          {items.map((i) => (
            <li key={i.title} className="flex gap-3">
              <i.icon className="mt-0.5 size-4 shrink-0 text-champagne" aria-hidden />
              <div>
                <p className="text-sm font-semibold">{i.title}</p>
                {!compact && <p className="text-sm text-muted">{i.body}</p>}
              </div>
            </li>
          ))}
        </ul>
        <Link href="/privacy" className="w-fit text-sm text-gold underline-offset-4 hover:underline">
          Read the Privacy Notice
        </Link>
      </CardBody>
    </Card>
  );
}
