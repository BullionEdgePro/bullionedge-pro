"use server";

import { headers } from "next/headers";
import { refresh } from "next/cache";
import { submitIdentity, submitSeller, type SubmitResult } from "@/lib/server/kyc/submissions";
import { sendPhoneCode, verifyPhoneCode, type SendResult, type VerifyResult } from "@/lib/server/sms/phone-verification";
import { getViewer } from "@/lib/server/viewer";

/**
 * Verification mutations. Every action re-reads the signed-in viewer on the
 * server; nothing about who is asking, or their tier, comes from the client.
 */

async function requestMeta() {
  const h = await headers();
  return { ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null, userAgent: h.get("user-agent")?.slice(0, 400) ?? null };
}

/** Rate-limit and other thrown errors become a message the form can show. */
async function guard<T extends { ok: boolean }>(run: () => Promise<T>): Promise<T | { ok: false; error: string }> {
  try {
    return await run();
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/too many|try again|sign in/i.test(message)) return { ok: false, error: message };
    console.error("[verification] action failed", err);
    return { ok: false, error: "Something went wrong on our side. Please try again." };
  }
}

export async function sendPhoneCodeAction(phone: string): Promise<SendResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  const meta = await requestMeta();
  return guard(() =>
    sendPhoneCode({ userId: viewer.userId, name: viewer.name, emailVerified: viewer.tier >= 1, ipAddress: meta.ipAddress }, String(phone ?? "").slice(0, 40)),
  );
}

export async function verifyPhoneCodeAction(code: string): Promise<VerifyResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  const meta = await requestMeta();
  const result = await guard(() =>
    verifyPhoneCode({ userId: viewer.userId, name: viewer.name, emailVerified: viewer.tier >= 1, ipAddress: meta.ipAddress }, String(code ?? "").slice(0, 20)),
  );
  if (result.ok) refresh();
  return result;
}

export async function submitIdentityAction(input: unknown): Promise<SubmitResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  const result = await guard(async () => submitIdentity(viewer, input, await requestMeta()));
  if (result.ok) refresh();
  return result;
}

export async function submitSellerAction(input: unknown): Promise<SubmitResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in again." };
  const result = await guard(async () => submitSeller(viewer, input, await requestMeta()));
  if (result.ok) refresh();
  return result;
}
