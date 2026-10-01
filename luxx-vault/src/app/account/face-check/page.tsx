import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock, ScanFace } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TestModeNotice } from "@/components/verification/test-mode-notice";
import { FACE_PURPOSE_COPY, type FacePurpose } from "@/lib/face-policy";
import { safeNext } from "@/lib/safe-next";
import { faceStatus } from "@/lib/server/face/gate";
import { faceProvider } from "@/lib/server/face/provider";
import { requireViewer } from "@/lib/server/viewer";
import { FaceCheckFlow } from "./face-check-flow";

export const metadata: Metadata = { title: "Confirm it's you", robots: { index: false } };

const PURPOSES: readonly FacePurpose[] = ["session", "high_value", "account_change"];

export default async function FaceCheckPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const purpose: FacePurpose = PURPOSES.includes(params.purpose as FacePurpose) ? (params.purpose as FacePurpose) : "session";
  const next = safeNext(params.next, "/account");
  const viewer = await requireViewer(`/account/face-check?purpose=${purpose}&next=${encodeURIComponent(next)}`);
  if (viewer.tier < 3) redirect(`/account/verification?step=identity&next=${encodeURIComponent(next)}`);

  const status = await faceStatus(purpose, next);
  if (status.state === "ok" || status.state === "not_needed") redirect(next);
  const provider = faceProvider();

  return (
    <div className="grid max-w-2xl gap-6">
      <div>
        <p className="font-display text-xs tracking-[0.28em] text-gold uppercase">Security</p>
        <h1 className="mt-3 text-3xl">Confirm it&apos;s you</h1>
        <p className="measure mt-3 text-muted">{FACE_PURPOSE_COPY[purpose]}</p>
      </div>

      {status.state === "locked" ? (
        <Card>
          <CardBody className="flex gap-4">
            <Lock className="mt-1 size-5 shrink-0 text-warning" aria-hidden />
            <div className="grid gap-3">
              <p>{status.message}</p>
              <Button asChild variant="secondary" size="sm" className="justify-self-start">
                <Link href="/account/security">Review your security settings</Link>
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <>
          {provider.isTest && (
            <TestModeNotice title="Test mode — no face comparison runs">
              Your camera confirms a real person follows the prompts, and the frames are checked on this device and
              thrown away. It can&apos;t yet tell whose face it is: that needs the identity vendor, which compares this
              check with the face from your ID verification.
            </TestModeNotice>
          )}
          <Card>
            <CardBody className="grid gap-5">
              <div className="flex items-start gap-3 text-sm text-muted">
                <ScanFace className="mt-0.5 size-5 shrink-0 text-champagne" aria-hidden />
                <p>
                  Why we ask: anyone can steal a password, but not your face. We check before trading on a new sign-in,
                  before trades of ₱100,000 or more, and before payout changes. You agreed to biometric checks when you
                  verified your ID; nothing is shared with other traders.
                </p>
              </div>
              <FaceCheckFlow purpose={purpose} next={next} />
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
