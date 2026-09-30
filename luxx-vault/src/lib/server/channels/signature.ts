/**
 * Webhook signature checks and the Messenger messaging window. Pure Node
 * crypto, no I/O, so they're tested directly (signature.test.ts).
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function hmacSha256Hex(key: string, body: string | Buffer): string {
  return createHmac("sha256", key).update(body).digest("hex");
}

/** Constant-time comparison of two hex digests. False for anything malformed. */
export function safeEqualHex(given: string, expected: string): boolean {
  if (!/^[0-9a-f]+$/i.test(given) || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given.toLowerCase(), "hex"), Buffer.from(expected.toLowerCase(), "hex"));
}

/** Viber: X-Viber-Content-Signature is hex HMAC-SHA256 of the raw body, keyed with the bot token. */
export function verifyViberSignature(rawBody: string | Buffer, header: string | null, botToken: string): boolean {
  if (!header || !botToken) return false;
  return safeEqualHex(header.trim(), hmacSha256Hex(botToken, rawBody));
}

/** Meta: X-Hub-Signature-256 is "sha256=" + hex HMAC-SHA256 of the raw body, keyed with the app secret. */
export function verifyMetaSignature(rawBody: string | Buffer, header: string | null, appSecret: string): boolean {
  if (!header || !appSecret) return false;
  const match = /^sha256=([0-9a-f]{64})$/i.exec(header.trim());
  if (!match) return false;
  return safeEqualHex(match[1]!, hmacSha256Hex(appSecret, rawBody));
}

/**
 * Meta's Messenger policy: a Page may send standard messages only within 24
 * hours of the person's last message to it (or their last interaction such as
 * a referral, postback or opt-in). Price alerts are promotional-adjacent and
 * fit no message tag, so outside the window we don't send on Messenger at all.
 */
export const MESSENGER_WINDOW_MS = 24 * 3600_000;

export function withinMessengerWindow(lastInboundAt: Date | null, now: Date = new Date()): boolean {
  if (!lastInboundAt) return false;
  const age = now.getTime() - lastInboundAt.getTime();
  return age >= 0 && age < MESSENGER_WINDOW_MS;
}

/** One-time code carried in a deep link: 18 random bytes, URL-safe, no padding (24 characters). */
export function newLinkCode(): string {
  return randomBytes(18).toString("base64url");
}

/** Codes we accept back from a webhook: exactly what newLinkCode makes. */
export function isLinkCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{24}$/.test(value);
}
