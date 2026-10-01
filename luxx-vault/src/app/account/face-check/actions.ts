"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { submitFaceCheck, type FaceCheckResult } from "@/lib/server/face/gate";
import { livenessSchema } from "@/lib/server/face/provider";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { getViewer } from "@/lib/server/viewer";

const inputSchema = z.object({
  purpose: z.enum(["session", "high_value", "account_change"]),
  liveness: livenessSchema,
});

/** A fresh face check for this signed-in session. Results come from the provider on the server, never from the browser. */
export async function faceCheckAction(raw: unknown): Promise<FaceCheckResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "The camera check didn't complete. Please try again." };
  try {
    await assertRateLimit(`face:${viewer.userId}`, 10, 60 * 60_000, "Too many face checks this hour. Please wait a little and try again.");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Please wait a little and try again." };
  }
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  return submitFaceCheck(parsed.data.purpose, parsed.data.liveness, ip);
}
