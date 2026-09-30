/**
 * Philippine mobile numbers (brief §8, Tier 2). Pure functions, safe on the
 * client (as-you-type hints) and the server (the only place that decides).
 *
 * Accepted input, with any spaces, dashes, dots or brackets:
 *   09171234567 · 9171234567 · 639171234567 · +639171234567 · +63 (917) 123-4567
 * Canonical form is E.164: +639171234567 (always 13 characters).
 */

const E164_PH_MOBILE = /^\+639\d{9}$/;

/** E.164 (+639XXXXXXXXX), or null when the input is not a PH mobile number. */
export function normalizePhMobile(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  // Only separators people actually type; anything else (letters, extensions) is rejected.
  if (!/^\+?[\d\s\-.()]+$/.test(trimmed)) return null;
  const plus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  let national: string | null = null;
  if (plus) {
    if (digits.startsWith("63") && digits.length === 12) national = digits.slice(2);
  } else if (digits.startsWith("63") && digits.length === 12) {
    national = digits.slice(2);
  } else if (digits.startsWith("0") && digits.length === 11) {
    national = digits.slice(1);
  } else if (digits.length === 10) {
    national = digits;
  }
  if (!national || !national.startsWith("9")) return null;
  const e164 = `+63${national}`;
  return E164_PH_MOBILE.test(e164) ? e164 : null;
}

export function isPhMobile(input: string | null | undefined): boolean {
  return normalizePhMobile(input) !== null;
}

/** +63 917 123 4567 — for showing a number back to its owner. */
export function formatPhMobile(e164: string): string {
  if (!E164_PH_MOBILE.test(e164)) return e164;
  const n = e164.slice(3);
  return `+63 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
}

/** +63 9•• ••• 4567 — for staff screens and messages where the full number isn't needed. */
export function maskPhMobile(e164: string | null | undefined): string {
  if (!e164 || !E164_PH_MOBILE.test(e164)) return "—";
  return `+63 9•• ••• ${e164.slice(-4)}`;
}
