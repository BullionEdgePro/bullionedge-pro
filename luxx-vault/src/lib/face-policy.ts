/**
 * When an ID-verified person must show their face again (owner, 1 Oct 2026;
 * brief §8 re-verification triggers: new device + high-value transaction,
 * payout account change). Pure rules, shared by the server gates and the UI.
 *
 *  - session:        once per signed-in session (a new sign-in on any device),
 *                    before the first trading action; lasts 12 hours.
 *  - high_value:     a check from the last 15 minutes before accepting or
 *                    paying for a trade of ₱100,000 or more.
 *  - account_change: a check from the last 15 minutes before changing payout details.
 *
 * Three failed checks in a row lock trading until staff review.
 */

export type FacePurpose = "session" | "high_value" | "account_change";

export const FACE_POLICY = {
  sessionTtlMs: 12 * 60 * 60_000,
  freshTtlMs: 15 * 60_000,
  highValuePhp: 100_000,
  maxConsecutiveFailures: 3,
} as const;

export type FaceCheckRecord = { sessionId: string | null; passed: boolean; createdAt: Date };

/** The most recent passed check that still satisfies `purpose` for this session, if any. */
export function satisfyingCheck(
  checks: readonly FaceCheckRecord[],
  purpose: FacePurpose,
  sessionId: string,
  now: Date = new Date(),
): FaceCheckRecord | null {
  const ttl = purpose === "session" ? FACE_POLICY.sessionTtlMs : FACE_POLICY.freshTtlMs;
  let best: FaceCheckRecord | null = null;
  for (const c of checks) {
    if (!c.passed || c.sessionId !== sessionId) continue;
    const age = now.getTime() - c.createdAt.getTime();
    if (age < 0 || age > ttl) continue;
    if (!best || c.createdAt > best.createdAt) best = c;
  }
  return best;
}

/** Failures since the last pass, newest first order not required. */
export function consecutiveFailures(checks: readonly FaceCheckRecord[]): number {
  const sorted = [...checks].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  let n = 0;
  for (const c of sorted) {
    if (c.passed) break;
    n++;
  }
  return n;
}

/** Which purpose a trade amount calls for. */
export function purposeForAmount(amountPhp: number): FacePurpose {
  return amountPhp >= FACE_POLICY.highValuePhp ? "high_value" : "session";
}

export const FACE_PURPOSE_COPY: Record<FacePurpose, string> = {
  session: "You signed in on this device. Confirm it's you before trading.",
  high_value: "This is a high-value trade. Confirm it's you before it goes ahead.",
  account_change: "You're changing payout details. Confirm it's you first.",
};
