import { describe, expect, it } from "vitest";
import { OTP_MAX_ATTEMPTS, OTP_TTL_MS, checkOtp, cleanOtpInput, generateOtpCode, hashOtp, otpThrottle, type OtpRecord } from "./otp";

const KEY = "test-secret-at-least-thirty-two-characters!!";
const ctx = { userId: "u1", phone: "+639171234567" };
const now = new Date("2026-09-30T08:00:00Z");

function record(code: string, over: Partial<OtpRecord> = {}): OtpRecord {
  return { ...ctx, codeHash: hashOtp(code, ctx, KEY), attempts: 0, expiresAt: new Date(now.getTime() + OTP_TTL_MS), consumedAt: null, ...over };
}

describe("generateOtpCode", () => {
  it("is always six digits, leading zeros kept", () => {
    for (let i = 0; i < 500; i++) expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });
});

describe("hashOtp", () => {
  it("never contains the code and is stable", () => {
    const h = hashOtp("123456", ctx, KEY);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("123456");
    expect(hashOtp("123456", ctx, KEY)).toBe(h);
  });
  it("is bound to the user, the number and the key", () => {
    const h = hashOtp("123456", ctx, KEY);
    expect(hashOtp("123456", { ...ctx, userId: "u2" }, KEY)).not.toBe(h);
    expect(hashOtp("123456", { ...ctx, phone: "+639181234567" }, KEY)).not.toBe(h);
    expect(hashOtp("123456", ctx, `${KEY}x`)).not.toBe(h);
  });
});

describe("checkOtp", () => {
  it("accepts the right code before expiry", () => expect(checkOtp(record("042317"), "042317", now, KEY)).toEqual({ ok: true }));

  it("rejects a wrong code and counts the attempt", () => {
    const r = checkOtp(record("042317"), "999999", now, KEY);
    expect(r).toEqual({ ok: false, reason: "mismatch", attemptsLeft: OTP_MAX_ATTEMPTS - 1, countsAsAttempt: true });
  });

  it("expires after five minutes, even with the right code", () => {
    const later = new Date(now.getTime() + OTP_TTL_MS);
    const r = checkOtp(record("042317"), "042317", later, KEY);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("expired");
      expect(r.countsAsAttempt).toBe(false);
    }
    expect(checkOtp(record("042317"), "042317", new Date(later.getTime() - 1), KEY).ok).toBe(true);
  });

  it("locks after five attempts, even with the right code", () => {
    const r = checkOtp(record("042317", { attempts: OTP_MAX_ATTEMPTS }), "042317", now, KEY);
    expect(r).toMatchObject({ ok: false, reason: "locked", attemptsLeft: 0 });
  });

  it("the fifth wrong guess leaves no attempts", () => {
    const r = checkOtp(record("042317", { attempts: OTP_MAX_ATTEMPTS - 1 }), "000000", now, KEY);
    expect(r).toMatchObject({ ok: false, reason: "mismatch", attemptsLeft: 0 });
  });

  it("a used code can't be used again", () => {
    expect(checkOtp(record("042317", { consumedAt: now }), "042317", now, KEY)).toMatchObject({ ok: false, reason: "consumed" });
  });

  it("a code for one account doesn't work for another", () => {
    const other = { ...record("042317"), userId: "u2" };
    expect(checkOtp(other, "042317", now, KEY).ok).toBe(false);
  });
});

describe("cleanOtpInput", () => {
  it("accepts pasted codes with spaces or dashes", () => {
    expect(cleanOtpInput(" 042 317 ")).toBe("042317");
    expect(cleanOtpInput("042-317")).toBe("042317");
  });
  it("rejects anything else", () => {
    for (const v of ["", "12345", "1234567", "12a456", null]) expect(cleanOtpInput(v)).toBeNull();
  });
});

describe("otpThrottle", () => {
  const base = { lastSentToUserAt: null, sentToUserLastHour: 0, sentToPhoneLastDay: 0 };
  it("allows the first code", () => expect(otpThrottle(base, now)).toBeNull());
  it("one per minute", () => {
    const t = otpThrottle({ ...base, lastSentToUserAt: new Date(now.getTime() - 20_000) }, now);
    expect(t?.retryAfterSec).toBe(40);
    expect(otpThrottle({ ...base, lastSentToUserAt: new Date(now.getTime() - 60_000) }, now)).toBeNull();
  });
  it("five per hour per user", () => {
    expect(otpThrottle({ ...base, sentToUserLastHour: 4 }, now)).toBeNull();
    expect(otpThrottle({ ...base, sentToUserLastHour: 5 }, now)?.retryAfterSec).toBe(3600);
  });
  it("ten per day per number", () => {
    expect(otpThrottle({ ...base, sentToPhoneLastDay: 9 }, now)).toBeNull();
    expect(otpThrottle({ ...base, sentToPhoneLastDay: 10 }, now)?.message).toMatch(/tomorrow/);
  });
});
