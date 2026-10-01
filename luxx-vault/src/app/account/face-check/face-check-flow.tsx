"use client";

import { ScanFace, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Emblem } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/field";
import { LivenessCapture, type LivenessResult } from "@/components/verification/liveness-capture";
import type { FacePurpose } from "@/lib/face-policy";
import { faceCheckAction } from "./actions";

/** Guided capture, then the server decides. On success the person goes back to what they were doing. */
export function FaceCheckFlow({ purpose, next }: { purpose: FacePurpose; next: string }) {
  const router = useRouter();
  const [liveness, setLiveness] = useState<LivenessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function submit() {
    if (!liveness) return;
    setError(null);
    start(async () => {
      const r = await faceCheckAction({ purpose, liveness });
      if (r.ok) {
        setDone(true);
        router.replace(next);
        router.refresh();
        return;
      }
      setError(r.attemptsLeft ? `${r.error} ${r.attemptsLeft === 1 ? "1 try" : `${r.attemptsLeft} tries`} left before trading pauses.` : r.error);
      if (r.locked) setLocked(true);
      setLiveness(null);
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center" role="status">
        <Emblem animate title="" className="size-20" />
        <p className="flex items-center gap-2 font-semibold text-success">
          <ShieldCheck className="size-5" aria-hidden /> Confirmed. Taking you back…
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {error && <FormAlert>{error}</FormAlert>}
      {!locked && (
        <>
          <LivenessCapture value={liveness} onChange={setLiveness} />
          <Button onClick={submit} disabled={!liveness || pending} size="lg" className="justify-self-start rounded-full">
            <ScanFace aria-hidden /> {pending ? "Checking…" : "Confirm it's me"}
          </Button>
        </>
      )}
    </div>
  );
}
