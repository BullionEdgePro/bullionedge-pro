import { ADDRESS_PROOF_MAX_AGE_DAYS, MIN_AGE, SCORE_THRESHOLDS } from "@/config/kyc";

/**
 * Our own checks on what an applicant typed, independent of the KYC vendor
 * (brief §8: name on ID = account name, age ≥ 18, ID not expired, no
 * duplicate IDs). Pure functions: each returns flags for the reviewer and
 * never approves anything by itself.
 *
 * Dates are calendar dates in Philippine time (UTC+8, no daylight saving).
 */

const PH_OFFSET_MS = 8 * 60 * 60_000;

/** Today's calendar date in the Philippines, as a UTC-midnight Date. */
export function phToday(now: Date): Date {
  const ph = new Date(now.getTime() + PH_OFFSET_MS);
  return new Date(Date.UTC(ph.getUTCFullYear(), ph.getUTCMonth(), ph.getUTCDate()));
}

/** Parses "YYYY-MM-DD" strictly (no 31 February) into a UTC-midnight Date. */
export function parseIsoDate(value: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? date : null;
}

/** Whole years between a birth date and today (a birthday counts on the day itself). */
export function ageOn(birthDate: Date, now: Date): number {
  const today = phToday(now);
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < birthDate.getUTCMonth() ||
    (today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() < birthDate.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** An ID is valid through its expiry date. */
export function isExpired(expiry: Date, now: Date): boolean {
  return expiry.getTime() < phToday(now).getTime();
}

/** Proof of address must be dated within the last three months, and not in the future. */
export function isAddressProofFresh(issued: Date, now: Date): boolean {
  const today = phToday(now).getTime();
  const age = (today - issued.getTime()) / 86_400_000;
  return age >= 0 && age <= ADDRESS_PROOF_MAX_AGE_DAYS;
}

// ------------------------------------------------------------ names

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);
/** Surname particles that people write joined or apart ("dela Cruz" = "Delacruz"). */
const PARTICLES = new Set(["de", "del", "dela", "la", "las", "los", "delos", "san", "santa", "sta", "santo", "sto", "van", "von", "di", "da"]);
/** Abbreviations common on PH IDs. */
const ALIASES: Record<string, string> = { ma: "maria", sta: "santa", sto: "santo" };

/** Name → comparable tokens: no accents, case, punctuation, suffixes or middle initials; particles joined. */
export function nameTokens(name: string): string[] {
  const words = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ñ/g, "n")
    .replace(/[^a-z\s,.-]/g, "")
    .split(/[\s,.-]+/)
    .filter(Boolean)
    .map((w) => ALIASES[w] ?? w)
    .filter((w) => !SUFFIXES.has(w));
  const out: string[] = [];
  let carry = "";
  for (const w of words) {
    if (PARTICLES.has(w)) {
      carry += w;
      continue;
    }
    const token = carry + w;
    carry = "";
    if (token.length > 1) out.push(token); // a lone initial says too little to compare
  }
  if (carry) out.push(carry);
  return out;
}

/**
 * Does the name on the ID plausibly belong to the account holder? Word order
 * and extra given or middle names are ignored ("DELA CRUZ, JUAN PONCE" matches
 * "Juan dela Cruz"), but at least a first and a last name must agree.
 */
export function namesMatch(accountName: string, nameOnId: string): boolean {
  const a = new Set(nameTokens(accountName));
  const b = new Set(nameTokens(nameOnId));
  if (!a.size || !b.size) return false;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  const shared = [...small].filter((t) => large.has(t)).length;
  if (small.size === 1) return shared === 1 && large.size === 1;
  return shared === small.size;
}

// ------------------------------------------------------------ ID numbers and payouts

/** Last four letters/digits of an ID number, or null when it's too short to be real. */
export function idNumberLast4(idNumber: string): string | null {
  const clean = idNumber.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length < 5 || clean.length > 30) return null;
  return clean.slice(-4);
}

/** "GCash ••••7788", "BDO ••••0142". Only the last four digits ever survive. */
export function maskPayout(kindLabel: string, accountNumber: string): string | null {
  const digits = accountNumber.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 20) return null;
  return `${kindLabel} ••••${digits.slice(-4)}`;
}

// ------------------------------------------------------------ flags

export type IdentityRuleInput = {
  accountName: string;
  nameOnId: string;
  birthDate: Date;
  expiry: Date | null;
  /** Another account already submitted the same ID type, last four and birth year. */
  duplicateId: boolean;
  livenessScore: number | null;
  faceMatchScore: number | null;
  now: Date;
};

export function identityRuleFlags(input: IdentityRuleInput): string[] {
  const flags: string[] = [];
  if (ageOn(input.birthDate, input.now) < MIN_AGE) flags.push("underage");
  if (input.expiry && isExpired(input.expiry, input.now)) flags.push("expired_id");
  if (!namesMatch(input.accountName, input.nameOnId)) flags.push("name_mismatch");
  if (input.duplicateId) flags.push("duplicate_id");
  if (input.livenessScore !== null && input.livenessScore < SCORE_THRESHOLDS.liveness) flags.push("low_liveness");
  if (input.faceMatchScore !== null && input.faceMatchScore < SCORE_THRESHOLDS.faceMatch) flags.push("low_face_match");
  return flags;
}
