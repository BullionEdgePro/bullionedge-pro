/**
 * Short public codes for listings (LX-4F7K2), wanted posts (WP-…), trades
 * (TR-…), Official Shop products (LP-…) and shop orders (OR-…). Readable
 * aloud and on a watermark: no 0/O, 1/I/L, or U/V look-alikes.
 */
import { randomInt } from "node:crypto";

export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTWXYZ";
export const CODE_LENGTH = 5;
export type CodePrefix = "LX" | "WP" | "TR" | "LP" | "OR";

export function generateCode(prefix: CodePrefix, rand: (max: number) => number = randomInt): string {
  let body = "";
  for (let i = 0; i < CODE_LENGTH; i++) body += CODE_ALPHABET[rand(CODE_ALPHABET.length)];
  return `${prefix}-${body}`;
}

const CODE_RE = new RegExp(`^(LX|WP|TR|LP|OR)-[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

/** Accepts what people type ("lx 4f7k2", "LX4F7K2") and returns the canonical code, or null. */
export function normaliseCode(input: string, prefix?: CodePrefix): string | null {
  const compact = input.trim().toUpperCase().replace(/[\s_-]+/g, "");
  const m = /^(LX|WP|TR|LP|OR)([A-Z0-9]{5})$/.exec(compact);
  if (!m) return null;
  const code = `${m[1]}-${m[2]}`;
  if (!CODE_RE.test(code)) return null;
  if (prefix && m[1] !== prefix) return null;
  return code;
}

/** Tries until `exists` says a code is free (collisions are ~1 in 20 million per pair). */
export async function uniqueCode(prefix: CodePrefix, exists: (code: string) => Promise<boolean>, attempts = 8): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const code = generateCode(prefix);
    if (!(await exists(code))) return code;
  }
  throw new Error("Could not allocate a code. Please try again.");
}
