import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { FACE_POLICY, FACE_PURPOSE_COPY, consecutiveFailures, satisfyingCheck, type FacePurpose } from "@/lib/face-policy";
import { audit } from "../audit";
import { db } from "../db";
import { UserError } from "../marketplace/context";
import { notify } from "../notify";
import { getSession } from "../session";
import { faceProvider, type LivenessInput } from "./provider";

/** Thrown by gated actions; the message tells the person what to do and `href` takes them there. */
export class FaceCheckRequired extends UserError {
  constructor(
    readonly purpose: FacePurpose,
    readonly href: string,
    message: string,
  ) {
    super(message);
  }
}

export type FaceStatus =
  | { state: "not_needed" }
  | { state: "ok"; checkedAt: Date }
  | { state: "required"; purpose: FacePurpose; message: string; href: string }
  | { state: "locked"; message: string };

const LOCKED_MESSAGE =
  "Trading is paused on your account after three unsuccessful face checks. Our team will review it and contact you; you can still browse.";

export function faceCheckHref(purpose: FacePurpose, next: string): string {
  return `/account/face-check?purpose=${purpose}&next=${encodeURIComponent(next)}`;
}

/**
 * Does this person need to show their face before `purpose`? Applies only to
 * ID-verified people (the face is compared with the one enrolled at the ID
 * check); anyone below Tier 3 is stopped by the tier gates first.
 */
export async function faceStatus(purpose: FacePurpose, next: string): Promise<FaceStatus> {
  const session = await getSession();
  if (!session) return { state: "not_needed" };
  const profile = await db.profile.findUnique({ where: { userId: session.user.id }, select: { identityVerifiedAt: true, faceLockedAt: true } });
  if (!profile?.identityVerifiedAt) return { state: "not_needed" };
  if (profile.faceLockedAt) return { state: "locked", message: LOCKED_MESSAGE };

  const since = new Date(Date.now() - FACE_POLICY.sessionTtlMs);
  const checks = await db.faceCheck.findMany({
    where: { userId: session.user.id, createdAt: { gte: since } },
    select: { sessionId: true, passed: true, createdAt: true },
  });
  const ok = satisfyingCheck(checks, purpose, session.session.id);
  if (ok) return { state: "ok", checkedAt: ok.createdAt };
  return { state: "required", purpose, message: FACE_PURPOSE_COPY[purpose], href: faceCheckHref(purpose, next) };
}

/** For server actions: throws FaceCheckRequired (or a locked message) unless a fresh enough check exists. */
export async function assertFaceCheck(purpose: FacePurpose, next: string): Promise<void> {
  const s = await faceStatus(purpose, next);
  if (s.state === "locked") throw new UserError(s.message);
  if (s.state === "required") throw new FaceCheckRequired(purpose, s.href, `${s.message} It takes about ten seconds.`);
}

export type FaceCheckResult = { ok: true } | { ok: false; error: string; locked?: boolean; attemptsLeft?: number };

/** Run the provider on a fresh liveness capture and record the outcome against this session. */
export async function submitFaceCheck(purpose: FacePurpose, liveness: LivenessInput, ipAddress: string | null): Promise<FaceCheckResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in again." };
  const userId = session.user.id;
  const profile = await db.profile.findUnique({ where: { userId }, select: { identityVerifiedAt: true, faceLockedAt: true } });
  if (!profile?.identityVerifiedAt) return { ok: false, error: "Face checks start once your ID is verified." };
  if (profile.faceLockedAt) return { ok: false, error: LOCKED_MESSAGE, locked: true };

  const result = await faceProvider().verify({ userId, liveness });
  await db.faceCheck.create({
    data: {
      userId,
      sessionId: session.session.id,
      purpose,
      provider: result.provider,
      providerRef: result.providerRef,
      passed: result.passed,
      livenessScore: result.livenessScore,
      faceMatchScore: result.faceMatchScore,
      flags: result.flags,
      ipAddress,
    },
  });
  await audit({
    actorId: userId,
    action: result.passed ? "face.check_passed" : "face.check_failed",
    targetType: "face_check",
    meta: { purpose, provider: result.provider, flags: result.flags },
    ipAddress,
  });
  if (result.passed) return { ok: true };

  const recent = await db.faceCheck.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: FACE_POLICY.maxConsecutiveFailures + 1,
    select: { sessionId: true, passed: true, createdAt: true },
  });
  const fails = consecutiveFailures(recent);
  if (fails >= FACE_POLICY.maxConsecutiveFailures) {
    await db.profile.update({ where: { userId }, data: { faceLockedAt: new Date() } });
    await audit({ actorId: userId, action: "face.locked", targetType: "user", targetId: userId, meta: { failures: fails }, ipAddress });
    const staff = await db.user.findMany({ where: { OR: [{ role: { contains: "kyc_reviewer" } }, { role: { contains: "admin" } }] }, select: { id: true } });
    await Promise.all(
      staff.map((s) =>
        notify(s.id, { kind: "kyc_update", title: "Face checks failed three times", body: `${session.user.name}'s trading is paused pending review.`, href: "/admin/kyc" }),
      ),
    );
    await notify(userId, {
      kind: "kyc_update",
      title: "Trading paused on your account",
      body: "Three face checks didn't succeed, so trading is paused while our team reviews. If this wasn't you, change your password now.",
      href: "/account/security",
      channels: ["email"],
    });
    return { ok: false, error: LOCKED_MESSAGE, locked: true };
  }
  return {
    ok: false,
    error: "We couldn't confirm it's you. Face the camera in good light, follow each prompt, and try again.",
    attemptsLeft: FACE_POLICY.maxConsecutiveFailures - fails,
  };
}

/** Staff: lift a face-check lock after review. */
export async function unlockFaceChecks(userId: string, staffId: string, reason: string, ipAddress: string | null) {
  await db.profile.update({ where: { userId }, data: { faceLockedAt: null } });
  await audit({ actorId: staffId, action: "face.unlocked", targetType: "user", targetId: userId, meta: { reason }, ipAddress });
  await notify(userId, { kind: "kyc_update", title: "Trading is open again", body: "Our team reviewed your account. Please confirm it's you once more before trading.", href: "/account" });
}

/**
 * For marketplace actions: when a face check is due, send the person to it and
 * bring them back to the page they acted from (taken from the Referer, and
 * only ever a path on this site). Throws a readable error when trading is paused.
 */
export async function requireFaceForAction(purpose: FacePurpose): Promise<void> {
  const referer = (await headers()).get("referer");
  let next = "/account";
  if (referer) {
    try {
      const u = new URL(referer);
      next = safeNext(`${u.pathname}${u.search}`, "/account");
    } catch {
      // keep the default
    }
  }
  const s = await faceStatus(purpose, next);
  if (s.state === "locked") throw new UserError(s.message);
  if (s.state === "required") redirect(s.href);
}

/** For pages that start a long form: go to the face check first (and come back), so nothing typed is lost. Returns the locked status, if any. */
export async function requireFaceForPage(purpose: FacePurpose, path: string): Promise<Extract<FaceStatus, { state: "locked" }> | null> {
  const s = await faceStatus(purpose, path);
  if (s.state === "required") redirect(s.href);
  return s.state === "locked" ? s : null;
}
