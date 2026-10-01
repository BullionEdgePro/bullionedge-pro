import { describe, expect, it } from "vitest";
import { FACE_POLICY, consecutiveFailures, purposeForAmount, satisfyingCheck, type FaceCheckRecord } from "./face-policy";

const now = new Date("2026-10-01T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const MIN = 60_000;
const check = (over: Partial<FaceCheckRecord>): FaceCheckRecord => ({ sessionId: "s1", passed: true, createdAt: ago(MIN), ...over });

describe("satisfyingCheck", () => {
  it("accepts a passed check from this session within 12 hours for the session purpose", () => {
    expect(satisfyingCheck([check({ createdAt: ago(11 * 60 * MIN) })], "session", "s1", now)).not.toBeNull();
    expect(satisfyingCheck([check({ createdAt: ago(13 * 60 * MIN) })], "session", "s1", now)).toBeNull();
  });
  it("needs a check from the last 15 minutes for high-value and account changes", () => {
    expect(satisfyingCheck([check({ createdAt: ago(10 * MIN) })], "high_value", "s1", now)).not.toBeNull();
    expect(satisfyingCheck([check({ createdAt: ago(20 * MIN) })], "high_value", "s1", now)).toBeNull();
    expect(satisfyingCheck([check({ createdAt: ago(20 * MIN) })], "account_change", "s1", now)).toBeNull();
  });
  it("never counts a check from another session (another device or an older sign-in)", () => {
    expect(satisfyingCheck([check({ sessionId: "s2" })], "session", "s1", now)).toBeNull();
    expect(satisfyingCheck([check({ sessionId: null })], "session", "s1", now)).toBeNull();
  });
  it("ignores failed checks and checks dated in the future", () => {
    expect(satisfyingCheck([check({ passed: false })], "session", "s1", now)).toBeNull();
    expect(satisfyingCheck([check({ createdAt: new Date(now.getTime() + MIN) })], "session", "s1", now)).toBeNull();
  });
});

describe("consecutiveFailures", () => {
  it("counts failures since the most recent pass", () => {
    expect(consecutiveFailures([check({ passed: false, createdAt: ago(1 * MIN) }), check({ passed: false, createdAt: ago(2 * MIN) }), check({ passed: true, createdAt: ago(3 * MIN) })])).toBe(2);
    expect(consecutiveFailures([check({ passed: true, createdAt: ago(1 * MIN) }), check({ passed: false, createdAt: ago(2 * MIN) })])).toBe(0);
    expect(consecutiveFailures([])).toBe(0);
  });
});

describe("purposeForAmount", () => {
  it("treats the threshold and above as high value", () => {
    expect(purposeForAmount(FACE_POLICY.highValuePhp - 1)).toBe("session");
    expect(purposeForAmount(FACE_POLICY.highValuePhp)).toBe("high_value");
  });
});
