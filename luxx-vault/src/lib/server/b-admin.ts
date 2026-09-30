import "server-only";
import { headers } from "next/headers";
import { ADMIN_ROLES, hasAnyRole, requiresTwoFactor } from "@/config/roles";
import { getSession } from "./session";

/**
 * For server actions on /admin/prices: the caller must be signed in as admin
 * or super_admin with two-step sign-in on. Throws (never redirects), because
 * an action is its own entry point and page gating doesn't cover it.
 */
export async function assertAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Please sign in again.");
  if (!hasAnyRole(session.user.role, ADMIN_ROLES)) throw new Error("Only admins can do that.");
  if (requiresTwoFactor(session.user.role) && !session.user.twoFactorEnabled) throw new Error("Turn on two-step sign-in first.");
  return session;
}

/** The caller's IP for rate limits and the audit log: first hop of x-forwarded-for. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip")?.trim() || "unknown";
}
