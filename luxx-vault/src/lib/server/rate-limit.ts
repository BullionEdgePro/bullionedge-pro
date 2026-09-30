import "server-only";
import { db } from "./db";

/**
 * Fixed-window rate limit backed by the same `rateLimit` table Better Auth
 * uses (no Redis needed). Keys are namespaced ("otp:send:<userId>").
 * Returns true when the action is allowed and counts it.
 */
export async function rateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const id = `app:${key}`;
  const row = await db.rateLimit.findUnique({ where: { key: id } });
  if (!row || now - Number(row.lastRequest) > windowMs) {
    await db.rateLimit.upsert({
      where: { key: id },
      create: { id, key: id, count: 1, lastRequest: BigInt(now) },
      update: { count: 1, lastRequest: BigInt(now) },
    });
    return true;
  }
  if (row.count >= max) return false;
  await db.rateLimit.update({ where: { key: id }, data: { count: { increment: 1 } } });
  return true;
}

/** Throws a readable error when the limit is hit (for server actions). */
export async function assertRateLimit(key: string, max: number, windowMs: number, message = "Too many attempts. Please wait a few minutes and try again.") {
  if (!(await rateLimit(key, max, windowMs))) throw new Error(message);
}
