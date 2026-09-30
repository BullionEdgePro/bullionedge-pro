import "server-only";
import { formatPhMobile, maskPhMobile, normalizePhMobile } from "@/lib/phone";
import { audit } from "../audit";
import { db } from "../db";
import { env } from "../env";
import { ensureProfile } from "../profile";
import { assertRateLimit } from "../rate-limit";
import { OTP_MAX_ATTEMPTS, OTP_TTL_MS, checkOtp, cleanOtpInput, generateOtpCode, hashOtp, otpThrottle } from "./otp";
import { smsProvider } from "./provider";

/**
 * Tier 2: prove a Philippine mobile number belongs to this account.
 * One verified account per number. Callers pass a server-derived identity
 * (from getViewer), never a client-supplied user id.
 */

type Who = { userId: string; name: string; emailVerified: boolean; ipAddress?: string | null };

export type SendResult =
  | { ok: true; phoneDisplay: string; expiresAt: string; resendAfterSec: number; testMode: boolean; testCode?: string }
  | { ok: false; error: string; retryAfterSec?: number };

export type VerifyResult = { ok: true; phoneDisplay: string } | { ok: false; error: string; attemptsLeft?: number; expired?: boolean };

const TAKEN = "This number is already verified on another Luxx4less account. Each number can verify one account. If it's yours, sign in to that account, or contact us through our official channels.";

async function numberTakenByOther(phone: string, userId: string): Promise<boolean> {
  const other = await db.profile.findFirst({ where: { phone, phoneVerifiedAt: { not: null }, userId: { not: userId } }, select: { userId: true } });
  return Boolean(other);
}

export async function sendPhoneCode(who: Who, rawPhone: string): Promise<SendResult> {
  if (!who.emailVerified) return { ok: false, error: "Confirm your email address first." };
  const phone = normalizePhMobile(rawPhone);
  if (!phone) return { ok: false, error: "Enter a Philippine mobile number, like 0917 123 4567." };

  const profile = await db.profile.findUnique({ where: { userId: who.userId }, select: { phone: true, phoneVerifiedAt: true } });
  if (profile?.phoneVerifiedAt && profile.phone === phone) return { ok: false, error: "This number is already verified on your account." };
  if (await numberTakenByOther(phone, who.userId)) return { ok: false, error: TAKEN };

  const now = new Date();
  const [last, hourCount, dayCount] = await Promise.all([
    db.phoneOtp.findFirst({ where: { userId: who.userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    db.phoneOtp.count({ where: { userId: who.userId, createdAt: { gt: new Date(now.getTime() - 3_600_000) } } }),
    db.phoneOtp.count({ where: { phone, createdAt: { gt: new Date(now.getTime() - 86_400_000) } } }),
  ]);
  const throttled = otpThrottle({ lastSentToUserAt: last?.createdAt ?? null, sentToUserLastHour: hourCount, sentToPhoneLastDay: dayCount }, now);
  if (throttled) return { ok: false, error: throttled.message, retryAfterSec: throttled.retryAfterSec };

  const code = generateOtpCode();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
  const otp = await db.phoneOtp.create({
    data: { userId: who.userId, phone, codeHash: hashOtp(code, { userId: who.userId, phone }, env().BETTER_AUTH_SECRET), expiresAt },
  });

  const sms = smsProvider();
  try {
    await sms.send(phone, `Your Luxx4less code is ${code}. It expires in 5 minutes. Never share it: Luxx4less staff will never ask for this code.`);
  } catch (err) {
    // A code that never arrived must not count against the person or stay usable.
    await db.phoneOtp.delete({ where: { id: otp.id } });
    console.error("[sms] send failed", err instanceof Error ? err.message : err);
    return { ok: false, error: "We couldn't send the text message just now. Please try again in a minute." };
  }

  await audit({ actorId: who.userId, action: "phone.otp_sent", targetType: "phone_otp", targetId: otp.id, meta: { phone: maskPhMobile(phone), provider: sms.name }, ipAddress: who.ipAddress });
  return {
    ok: true,
    phoneDisplay: formatPhMobile(phone),
    expiresAt: expiresAt.toISOString(),
    resendAfterSec: 60,
    testMode: sms.isTest,
    // Only the mock returns the code, so the test-mode panel can show it.
    ...(sms.isTest ? { testCode: code } : {}),
  };
}

export async function verifyPhoneCode(who: Who, rawCode: string): Promise<VerifyResult> {
  await assertRateLimit(`otp:verify:${who.userId}`, 20, 15 * 60_000, "Too many tries. Please wait 15 minutes and ask for a new code.");
  const code = cleanOtpInput(rawCode);
  if (!code) return { ok: false, error: "Enter the 6-digit code from the text message." };

  const otp = await db.phoneOtp.findFirst({ where: { userId: who.userId, consumedAt: null }, orderBy: { createdAt: "desc" } });
  if (!otp) return { ok: false, error: "Ask for a code first.", expired: true };

  const now = new Date();
  const result = checkOtp(otp, code, now, env().BETTER_AUTH_SECRET);
  if (!result.ok) {
    if (result.countsAsAttempt) {
      // Conditional increment: parallel guesses can't exceed the limit.
      await db.phoneOtp.updateMany({ where: { id: otp.id, attempts: { lt: OTP_MAX_ATTEMPTS } }, data: { attempts: { increment: 1 } } });
      if (result.attemptsLeft === 0) {
        await audit({ actorId: who.userId, action: "phone.otp_locked", targetType: "phone_otp", targetId: otp.id, meta: { phone: maskPhMobile(otp.phone) }, ipAddress: who.ipAddress });
      }
    }
    const error =
      result.reason === "expired"
        ? "That code has expired. Ask for a new one."
        : result.reason === "locked" || result.attemptsLeft === 0
          ? "Too many wrong tries for this code. Ask for a new one."
          : `That code doesn't match. ${result.attemptsLeft} ${result.attemptsLeft === 1 ? "try" : "tries"} left.`;
    return { ok: false, error, attemptsLeft: result.attemptsLeft, expired: result.reason !== "mismatch" || result.attemptsLeft === 0 };
  }

  await ensureProfile(who.userId, who.name);
  const outcome = await db.$transaction(async (tx) => {
    // Serialise verifications of the same number so two accounts can't both win.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${`phone:${otp.phone}`}))`;
    const used = await tx.phoneOtp.updateMany({ where: { id: otp.id, consumedAt: null }, data: { consumedAt: now } });
    if (used.count !== 1) return "used" as const;
    const other = await tx.profile.findFirst({ where: { phone: otp.phone, phoneVerifiedAt: { not: null }, userId: { not: who.userId } }, select: { userId: true } });
    if (other) return "taken" as const;
    await tx.profile.update({ where: { userId: who.userId }, data: { phone: otp.phone, phoneVerifiedAt: now } });
    return "verified" as const;
  });

  if (outcome === "used") return { ok: false, error: "That code has already been used. Ask for a new one.", expired: true };
  if (outcome === "taken") return { ok: false, error: TAKEN };
  await audit({ actorId: who.userId, action: "phone.verified", targetType: "profile", targetId: who.userId, meta: { phone: maskPhMobile(otp.phone) }, ipAddress: who.ipAddress });
  return { ok: true, phoneDisplay: formatPhMobile(otp.phone) };
}
