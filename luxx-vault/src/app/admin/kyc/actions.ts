"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { decide, type DecisionResult } from "@/lib/server/kyc/review";

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
