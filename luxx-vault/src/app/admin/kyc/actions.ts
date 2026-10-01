"use server";

import { headers } from "next/headers";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { unlockFaceChecks } from "@/lib/server/face/gate";
import { assertReviewer, decide, type DecisionResult } from "@/lib/server/kyc/review";

/** A reviewer's decision. Role, two-step sign-in and the pending state are all re-checked inside `decide`. */
export async function decideAction(input: unknown): Promise<DecisionResult> {
  const h = await headers();
  let result: DecisionResult;
  try {
    result = await decide(input, h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    // Only our own access messages are shown; anything else stays in the server log.
    if (/sign in|reviewers|two-step/i.test(message)) return { ok: false, error: message };
    console.error("[kyc] decision failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  if (result.ok) redirect("/admin/kyc?decided=1");
  return result;
}

const unlockSchema = z.object({
  userId: z.string().min(1).max(64),
  reason: z.string().trim().min(10, "Write at least 10 characters on why it's safe to reopen.").max(500),
});

/** Reopen trading after a face-check lock. Reviewer role and two-step sign-in are re-checked; the reason is audited. */
export async function unlockFaceAction(_prev: { ok: boolean; error?: string } | null, form: FormData): Promise<{ ok: boolean; error?: string }> {
  let session;
  try {
    session = await assertReviewer();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Not allowed." };
  }
  const parsed = unlockSchema.safeParse({ userId: form.get("userId"), reason: form.get("reason") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  if (parsed.data.userId === session.user.id) return { ok: false, error: "Ask another reviewer to reopen your own account." };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  await unlockFaceChecks(parsed.data.userId, session.user.id, parsed.data.reason, ip);
  refresh();
  return { ok: true };
}
