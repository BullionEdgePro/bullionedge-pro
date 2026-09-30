import "server-only";
import { redirect } from "next/navigation";
import { parseRoles, verificationTier, type Role, type Tier } from "@/config/roles";
import { db } from "./db";
import { getSession, requireSession } from "./session";

/**
 * Who is looking, and what they're allowed to do: session, profile and
 * verification tier in one place. Every marketplace gate goes through here, so
 * a tier is always computed from the database, never trusted from the client.
 */
export type Viewer = {
  userId: string;
  name: string;
  email: string;
  roles: Role[];
  tier: Tier;
  twoFactorEnabled: boolean;
  profile: Awaited<ReturnType<typeof loadProfile>>;
};

async function loadProfile(userId: string) {
  return db.profile.findUnique({ where: { userId } });
}

export async function tierFor(userId: string, emailVerified: boolean): Promise<Tier> {
  const p = await loadProfile(userId);
  return verificationTier({
    signedIn: true,
    emailVerified,
    phoneVerified: Boolean(p?.phoneVerifiedAt),
    identityVerified: Boolean(p?.identityVerifiedAt),
    sellerVerified: Boolean(p?.sellerVerifiedAt),
  });
}

async function build(session: NonNullable<Awaited<ReturnType<typeof getSession>>>): Promise<Viewer> {
  const profile = await loadProfile(session.user.id);
  return {
    userId: session.user.id,
    name: session.user.name,
    email: session.user.email,
    roles: parseRoles(session.user.role),
    twoFactorEnabled: Boolean(session.user.twoFactorEnabled),
    profile,
    tier: verificationTier({
      signedIn: true,
      emailVerified: session.user.emailVerified,
      phoneVerified: Boolean(profile?.phoneVerifiedAt),
      identityVerified: Boolean(profile?.identityVerifiedAt),
      sellerVerified: Boolean(profile?.sellerVerifiedAt),
    }),
  };
}

/** The viewer, or null for guests. */
export async function getViewer(): Promise<Viewer | null> {
  const session = await getSession();
  return session ? build(session) : null;
}

/** Signed in, or off to sign-in and back. */
export async function requireViewer(returnTo: string): Promise<Viewer> {
  return build(await requireSession(returnTo));
}

/**
 * Page gate by tier. Below the tier, the person is sent to the step that
 * unlocks it (profile/phone at Tier 2, ID at Tier 3, seller checks at Tier 4)
 * and brought back afterwards.
 */
export async function requireTier(min: Tier, returnTo: string): Promise<Viewer> {
  const viewer = await requireViewer(returnTo);
  if (viewer.tier >= min) return viewer;
  const next = encodeURIComponent(returnTo);
  if (viewer.tier < 2) redirect(`/account/verification?step=phone&next=${next}`);
  if (viewer.tier < 3) redirect(`/account/verification?step=identity&next=${next}`);
  redirect(`/account/verification?step=seller&next=${next}`);
}

/** For server actions: throws instead of redirecting. */
export async function assertTier(min: Tier): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Please sign in first.");
  if (viewer.tier < min) {
    throw new Error(min >= 4 ? "Verified sellers only." : min >= 3 ? "Verify your identity first." : "Verify your mobile number first.");
  }
  return viewer;
}
