import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/**
 * One-time codes for mobile verification (brief §8, Tier 2). Pure logic,
 * no database: the caller passes records in and persists the outcome, which
 * keeps every rule here unit-testable.
 *
 * Only an HMAC of the code is ever stored. The HMAC binds the code to the
 * user and the number, so a hash lifted from one row can't be replayed for
 * another account or another phone.
 */

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;

/** Resend throttle (brief §8 "rate limited"). */
export const OTP_THROTTLE = {
  /** At most one code per user per minute. */
  perUserMinute: 1,
  /** At most five codes per user per hour. */
  perUserHour: 5,
  /** At most ten codes to one number per day, across all accounts. */
  perPhoneDay: 10,
} as const;

/** Uniform 6-digit code from the OS CSPRNG (leading zeros allowed). */
export function generateOtpCode(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

export function hashOtp(code: string, ctx: { userId: string; phone: string }, key: string): string {
  return createHmac("sha256", key).update(`luxx-otp:v1:${ctx.userId}:${ctx.phone}:${code}`).digest("hex");
}

/** Strips spaces and dashes people paste in; null when it can't be a code. */
export function cleanOtpInput(input: string | null | undefined): string | null {
  const s = (input ?? "").replace(/[\s-]/g, "");
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(s) ? s : null;
}

export type OtpRecord = {
  userId: string;
  phone: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
};

export type OtpCheck =
  | { ok: true }
  | { ok: false; reason: "consumed" | "expired" | "locked" | "mismatch"; attemptsLeft: number; countsAsAttempt: boolean };

/**
 * Decide whether `code` unlocks `record`. Checks are ordered so a used,
 * expired or locked code never reveals whether the guess was right, and
 * only a genuine comparison consumes an attempt.
 */
export function checkOtp(record: OtpRecord, code: string, now: Date, key: string): OtpCheck {
  const left = Math.max(0, OTP_MAX_ATTEMPTS - record.attempts);
  if (record.consumedAt) return { ok: false, reason: "consumed", attemptsLeft: 0, countsAsAttempt: false };
  if (now.getTime() >= record.expiresAt.getTime()) return { ok: false, reason: "expired", attemptsLeft: left, countsAsAttempt: false };
  if (record.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: "locked", attemptsLeft: 0, countsAsAttempt: false };
  const expected = Buffer.from(record.codeHash, "hex");
  const actual = Buffer.from(hashOtp(code, record, key), "hex");
  const match = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (match) return { ok: true };
  return { ok: false, reason: "mismatch", attemptsLeft: Math.max(0, left - 1), countsAsAttempt: true };
}

export type ThrottleInput = {
  /** When this user last asked for a code (any number). */
  lastSentToUserAt: Date | null;
  /** Codes sent to this user in the last hour. */
  sentToUserLastHour: number;
  /** Codes sent to this number in the last 24 hours, across all accounts. */
  sentToPhoneLastDay: number;
};

/** null when a new code may be sent; otherwise how long to wait and why. */
export function otpThrottle(input: ThrottleInput, now: Date): { retryAfterSec: number; message: string } | null {
  if (input.lastSentToUserAt) {
    const wait = 60_000 - (now.getTime() - input.lastSentToUserAt.getTime());
    if (wait > 0) {
      const s = Math.ceil(wait / 1000);
      return { retryAfterSec: s, message: `Please wait ${s} second${s === 1 ? "" : "s"} before asking for another code.` };
    }
  }
  if (input.sentToUserLastHour >= OTP_THROTTLE.perUserHour) {
    return { retryAfterSec: 3600, message: "You've asked for several codes in the last hour. Please try again later." };
  }
  if (input.sentToPhoneLastDay >= OTP_THROTTLE.perPhoneDay) {
    return { retryAfterSec: 86_400, message: "This number has received the most codes allowed today. Please try again tomorrow." };
  }
  return null;
}
