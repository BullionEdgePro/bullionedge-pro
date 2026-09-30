import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasAnyRole, requiresTwoFactor, type Role } from "@/config/roles";
import { auth } from "./auth";

/** The signed-in session for this request, or null. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Server-side gate for pages: signed in, or off to sign-in and back again. */
export async function requireSession(returnTo: string) {
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return session;
}

/**
 * Server-side gate for role-restricted pages and actions. Never trust the
 * client: every protected action calls this. Sellers and staff must also have
 * two-factor authentication on (brief §11).
 */
export async function requireRole(allowed: readonly Role[], returnTo: string) {
  const session = await requireSession(returnTo);
  if (!hasAnyRole(session.user.role, allowed)) redirect("/account?denied=1");
  if (requiresTwoFactor(session.user.role) && !session.user.twoFactorEnabled) redirect("/account/security?require2fa=1");
  return session;
}
