/**
 * Roles and verification tiers (brief §8, §11). Pure functions so they can be
 * unit-tested and used on both server and client for display; access is always
 * enforced on the server.
 */

export const ROLES = ["buyer", "seller", "reseller", "support", "kyc_reviewer", "admin", "super_admin"] as const;
export type Role = (typeof ROLES)[number];

/** Staff roles see customer data, so they must use two-factor authentication. */
export const STAFF_ROLES: readonly Role[] = ["support", "kyc_reviewer", "admin", "super_admin"];
/** Admin-panel roles (Better Auth admin plugin `adminRoles`). */
export const ADMIN_ROLES: readonly Role[] = ["admin", "super_admin"];

/** Better Auth stores roles as a comma-separated string. Unknown values are dropped. */
export function parseRoles(value: string | null | undefined): Role[] {
  if (!value) return ["buyer"];
  const roles = value
    .split(",")
    .map((r) => r.trim())
    .filter((r): r is Role => (ROLES as readonly string[]).includes(r));
  return roles.length ? roles : ["buyer"];
}

export function hasAnyRole(value: string | null | undefined, allowed: readonly Role[]): boolean {
  return parseRoles(value).some((r) => allowed.includes(r));
}

/** Sellers and every staff role must have 2FA on before using those powers (brief §11). */
export function requiresTwoFactor(value: string | null | undefined): boolean {
  return hasAnyRole(value, ["seller", ...STAFF_ROLES]);
}

export type Tier = 0 | 1 | 2 | 3 | 4;

export interface TierInput {
  signedIn: boolean;
  emailVerified: boolean;
  phoneVerified?: boolean; // Phase 5
  identityVerified?: boolean; // Phase 5: ID + liveness + face match
  sellerVerified?: boolean; // Phase 5: proof of address + payout in own name
}

/** Tiers build on each other: a later check never counts without the earlier ones. */
export function verificationTier(u: TierInput): Tier {
  if (!u.signedIn) return 0;
  if (!u.emailVerified) return 0;
  if (!u.phoneVerified) return 1;
  if (!u.identityVerified) return 2;
  if (!u.sellerVerified) return 3;
  return 4;
}
