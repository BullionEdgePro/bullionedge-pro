/**
 * Trust score (brief §9): verification tier, released trades, dispute record,
 * account age, response time and ratings, as one 0–100 number with a plain
 * label. Pure, so the formula is tested and explainable; the inputs are
 * gathered on the server (marketplace/stats.ts) from real records only.
 */

export type TrustInput = {
  tier: 0 | 1 | 2 | 3 | 4;
  releasedTrades: number;
  /** Disputes on this person's trades that were decided against them. */
  disputesLost: number;
  /** All disputes opened on this person's trades (any outcome, any opener). */
  disputesTotal: number;
  accountAgeDays: number;
  /** Median time to first reply in conversations, or null with too few chats. */
  medianResponseMs: number | null;
  ratingAverage: number | null;
  ratingCount: number;
};

export type TrustLevel = "new" | "building" | "trusted" | "top";

export type Trust = {
  score: number;
  level: TrustLevel;
  label: string;
  /** Each component's contribution, for the "how is this calculated" note. */
  parts: { label: string; points: number; max: number }[];
};

export const TRUST_LABELS: Record<TrustLevel, string> = {
  new: "New",
  building: "Building trust",
  trusted: "Trusted",
  top: "Top seller",
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function responsePoints(ms: number | null): number {
  if (ms === null) return 0;
  const h = ms / 3_600_000;
  if (h <= 1) return 10;
  if (h <= 6) return 7;
  if (h <= 24) return 4;
  return 1;
}

export function trustScore(i: TrustInput): Trust {
  const released = Math.max(0, i.releasedTrades);
  const tierPts = i.tier >= 4 ? 30 : i.tier === 3 ? 22 : i.tier * 4;
  // Diminishing returns: the first trades matter most; ~25 trades reach most of the 30 points.
  const tradePts = 30 * (1 - Math.exp(-released / 12));
  const agePts = 10 * clamp(i.accountAgeDays / 365, 0, 1);
  const responsePts = responsePoints(i.medianResponseMs);
  // Ratings count once there are a few of them; 3.0 stars scores nothing, 5.0 scores all 20.
  const ratingPts = i.ratingAverage !== null && i.ratingCount > 0 ? 20 * clamp((i.ratingAverage - 3) / 2, 0, 1) * clamp(i.ratingCount / 5, 0, 1) : 0;
  const disputeRate = released + i.disputesTotal > 0 ? i.disputesTotal / (released + i.disputesTotal) : 0;
  const disputePenalty = Math.min(35, i.disputesLost * 12 + disputeRate * 20);

  const raw = tierPts + tradePts + agePts + responsePts + ratingPts - disputePenalty;
  const score = Math.round(clamp(raw, 0, 100));

  let level: TrustLevel;
  if (released === 0) level = "new";
  else if (score >= 80 && released >= 10 && i.disputesLost === 0) level = "top";
  else if (score >= 60) level = "trusted";
  else level = "building";

  return {
    score,
    level,
    label: TRUST_LABELS[level],
    parts: [
      { label: "Verification", points: Math.round(tierPts), max: 30 },
      { label: "Completed trades", points: Math.round(tradePts), max: 30 },
      { label: "Ratings", points: Math.round(ratingPts), max: 20 },
      { label: "Time on Luxx4less", points: Math.round(agePts), max: 10 },
      { label: "Response time", points: responsePts, max: 10 },
      { label: "Disputes", points: -Math.round(disputePenalty), max: 0 },
    ],
  };
}

export type ChatMessage = { senderId: string | null; kind: string; createdAt: Date };

/**
 * Median first-reply time for one person across conversations: each time the
 * other side starts talking, how long until this person answers. Needs at
 * least three answered openings, otherwise null (too little to judge).
 */
export function medianResponseMs(conversations: readonly (readonly ChatMessage[])[], userId: string, minSamples = 3): number | null {
  const samples: number[] = [];
  for (const messages of conversations) {
    let waitingSince: Date | null = null;
    for (const m of messages) {
      if (m.kind !== "user" || !m.senderId) continue;
      if (m.senderId !== userId) {
        waitingSince ??= m.createdAt;
      } else if (waitingSince) {
        samples.push(m.createdAt.getTime() - waitingSince.getTime());
        waitingSince = null;
      }
    }
  }
  if (samples.length < minSamples) return null;
  samples.sort((a, b) => a - b);
  const mid = Math.floor(samples.length / 2);
  return samples.length % 2 ? samples[mid]! : (samples[mid - 1]! + samples[mid]!) / 2;
}
