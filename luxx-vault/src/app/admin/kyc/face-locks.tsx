import { ScanFace } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { db } from "@/lib/server/db";
import { UnlockFaceForm } from "./unlock-face-form";

/** Accounts whose trading paused after three failed face checks, with a way to reopen them after review. */
export async function FaceLocks() {
  const locked = await db.profile.findMany({
    where: { faceLockedAt: { not: null } },
    orderBy: { faceLockedAt: "asc" },
    take: 50,
    select: {
      userId: true,
      faceLockedAt: true,
      displayName: true,
      user: { select: { email: true, faceChecks: { orderBy: { createdAt: "desc" }, take: 3, select: { flags: true, createdAt: true, ipAddress: true } } } },
    },
  });
  if (!locked.length) return null;

  return (
    <section aria-labelledby="face-locks" className="grid gap-3">
      <h2 id="face-locks" className="flex items-center gap-2 font-sans text-lg font-semibold">
        <ScanFace className="size-5 text-warning" aria-hidden /> Trading paused after failed face checks
      </h2>
      <p className="text-sm text-muted">
        Three failed checks in a row may be a stolen account, or just bad light. Contact the person through their
        verified email before reopening, and record why.
      </p>
      <Card>
        <CardBody className="grid gap-5">
          {locked.map((p) => (
            <div key={p.userId} className="grid gap-2 border-b border-line pb-5 last:border-0 last:pb-0">
              <p className="font-medium">
                {p.displayName} <span className="text-sm text-muted">· {p.user.email}</span>
              </p>
              <p className="text-xs text-muted">
                Paused {p.faceLockedAt?.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" })} · last attempts
                from {[...new Set(p.user.faceChecks.map((c) => c.ipAddress ?? "unknown IP"))].join(", ")}
              </p>
              <UnlockFaceForm userId={p.userId} />
            </div>
          ))}
        </CardBody>
      </Card>
    </section>
  );
}
