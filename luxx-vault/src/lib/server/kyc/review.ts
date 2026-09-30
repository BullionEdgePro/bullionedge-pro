import "server-only";
import { z } from "zod";
import { hasAnyRole, parseRoles, requiresTwoFactor, type Role } from "@/config/roles";
import { KYC_STATUSES } from "@/config/kyc";
import { maskPhMobile } from "@/lib/phone";
import { audit } from "../audit";
import { db } from "../db";
import { notify } from "../notify";
import { ensureProfile } from "../profile";
import { getSession } from "../session";

/**
 * The staff verification queue (brief §8: anything uncertain goes to manual
 * review; every decision needs a reason and is audited). Reviewers see only
 * masked data. In test mode there are no images to look at, and the screens
 * say so.
 */

export const REVIEWER_ROLES: readonly Role[] = ["kyc_reviewer", "admin", "super_admin"];

/** For server actions: throws unless the caller is a reviewer with two-step sign-in on. */
export async function assertReviewer() {
  const session = await getSession();
  if (!session) throw new Error("Please sign in again.");
  if (!hasAnyRole(session.user.role, REVIEWER_ROLES)) throw new Error("Only verification reviewers can do this.");
  if (requiresTwoFactor(session.user.role) && !session.user.twoFactorEnabled) throw new Error("Turn on two-step sign-in to review verifications.");
  return session;
}

export async function reviewQueue() {
  return db.kycSubmission.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      id: true,
      level: true,
      idType: true,
      idNumberLast4: true,
      flags: true,
      createdAt: true,
      provider: true,
      user: { select: { name: true, email: true } },
    },
  });
}

export async function recentDecisions(limit = 10) {
  return db.kycSubmission.findMany({
    where: { status: { not: "pending" } },
    orderBy: { reviewedAt: "desc" },
    take: limit,
    select: { id: true, level: true, status: true, reviewedAt: true, user: { select: { name: true } }, reviewer: { select: { name: true } } },
  });
}

export async function submissionDetail(id: string) {
  const sub = await db.kycSubmission.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, emailVerified: true, createdAt: true, role: true, twoFactorEnabled: true, banned: true, profile: true } },
      reviewer: { select: { name: true } },
    },
  });
  if (!sub) return null;
  const [previous, consent] = await Promise.all([
    db.kycSubmission.findMany({
      where: { userId: sub.userId, id: { not: sub.id } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, level: true, status: true, idType: true, idNumberLast4: true, decisionReason: true, createdAt: true, reviewedAt: true },
    }),
    db.consentRecord.findFirst({ where: { userId: sub.userId, kind: "kyc_biometrics" }, orderBy: { createdAt: "desc" }, select: { granted: true, version: true, createdAt: true } }),
  ]);
  const p = sub.user.profile;
  // A DTO: only what the reviewer screen shows, phone masked, no raw profile row.
  return {
    ...sub,
    user: {
      id: sub.user.id,
      name: sub.user.name,
      email: sub.user.email,
      emailVerified: sub.user.emailVerified,
      createdAt: sub.user.createdAt,
      roles: parseRoles(sub.user.role),
      twoFactorEnabled: Boolean(sub.user.twoFactorEnabled),
      banned: Boolean(sub.user.banned),
      handle: p?.handle ?? null,
      phoneMasked: maskPhMobile(p?.phone),
      phoneVerifiedAt: p?.phoneVerifiedAt ?? null,
      identityVerifiedAt: p?.identityVerifiedAt ?? null,
      sellerVerifiedAt: p?.sellerVerifiedAt ?? null,
    },
    previous,
    consent,
  };
}

export const decisionSchema = z.object({
  submissionId: z.string().min(1).max(64),
  decision: z.enum(["approved", "needs_resubmission", "rejected"], { error: "Choose a decision." }),
  reason: z.string().trim().min(10, "Write a reason of at least 10 characters. It is kept in the audit log.").max(1000),
});

export type DecisionResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Adds `role` to a comma-separated role string, keeping the rest. */
export function withRole(current: string | null | undefined, role: Role): string {
  const roles = parseRoles(current);
  return roles.includes(role) ? roles.join(",") : [...roles, role].join(",");
}

export async function decide(raw: unknown, ipAddress: string | null): Promise<DecisionResult> {
  const session = await assertReviewer();
  const parsed = decisionSchema.safeParse(raw);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Please complete the decision.", fieldErrors: fe };
  }
  const { submissionId, decision, reason } = parsed.data;
  const sub = await db.kycSubmission.findUnique({ where: { id: submissionId }, include: { user: { select: { id: true, name: true, role: true } } } });
  if (!sub) return { ok: false, error: "That submission no longer exists." };
  if (sub.userId === session.user.id) return { ok: false, error: "You can't review your own verification. Ask another reviewer." };
  if (sub.status !== "pending") return { ok: false, error: "Someone has already decided this submission." };

  if (decision === "approved" && sub.level === "seller") {
    const profile = await db.profile.findUnique({ where: { userId: sub.userId }, select: { identityVerifiedAt: true } });
    if (!profile?.identityVerifiedAt) return { ok: false, error: "Approve this person's identity check before their seller application." };
  }

  const now = new Date();
  if (decision === "approved") await ensureProfile(sub.userId, sub.user.name);
  const done = await db.$transaction(async (tx) => {
    // Only a still-pending row can be decided: two reviewers can't both win.
    const updated = await tx.kycSubmission.updateMany({
      where: { id: sub.id, status: "pending" },
      data: { status: decision, decisionReason: reason, reviewerId: session.user.id, reviewedAt: now },
    });
    if (updated.count !== 1) return false;
    if (decision === "approved") {
      if (sub.level === "identity") {
        await tx.profile.update({ where: { userId: sub.userId }, data: { identityVerifiedAt: now } });
      } else {
        await tx.profile.update({ where: { userId: sub.userId }, data: { sellerVerifiedAt: now } });
        await tx.user.update({ where: { id: sub.userId }, data: { role: withRole(sub.user.role, "seller") } });
      }
    }
    return true;
  });
  if (!done) return { ok: false, error: "Someone has already decided this submission." };

  await audit({
    actorId: session.user.id,
    action: "kyc.decision",
    targetType: "kyc_submission",
    targetId: sub.id,
    meta: { level: sub.level, decision, reason, applicantId: sub.userId, flags: sub.flags, ...(decision === "approved" && sub.level === "seller" ? { roleAdded: "seller" } : {}) },
    ipAddress,
  });

  const what = sub.level === "identity" ? "identity check" : "seller application";
  const title =
    decision === "approved"
      ? sub.level === "identity"
        ? "Your identity is verified"
        : "You're a verified seller"
      : decision === "needs_resubmission"
        ? `Your ${what} needs another look`
        : `Your ${what} wasn't approved`;
  const body =
    decision === "approved"
      ? sub.level === "identity"
        ? "You can now buy on the marketplace, make offers and message sellers."
        : "You can now create listings. Selling also needs two-step sign-in on your account."
      : `${KYC_STATUSES[decision].label}: ${reason}`;
  await notify(sub.userId, { kind: "kyc_update", title, body, href: "/account/verification", channels: ["email"] });
  return { ok: true };
}
