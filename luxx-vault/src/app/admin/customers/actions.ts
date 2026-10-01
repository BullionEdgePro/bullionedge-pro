"use server";

import { headers } from "next/headers";
import { refresh } from "next/cache";
import { z } from "zod";
import { hasAnyRole, parseRoles, type Role } from "@/config/roles";
import { audit } from "@/lib/server/audit";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { notify } from "@/lib/server/notify";
import { getSession } from "@/lib/server/session";

export type StaffActionState = { ok: boolean; error?: string; message?: string } | null;

async function staffSession(allowed: readonly Role[]) {
  const session = await getSession();
  if (!session || !hasAnyRole(session.user.role, allowed)) throw new Error("You don't have access to this.");
  if (!session.user.twoFactorEnabled) throw new Error("Turn on two-step sign-in to manage customers.");
  return session;
}

const ip = async () => (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

const banSchema = z.object({
  userId: z.string().min(1).max(64),
  reason: z.string().trim().min(10, "Write at least 10 characters on why.").max(500),
  days: z.coerce.number().int().min(0).max(3650),
});

/** Ban (0 days = until lifted). Better Auth signs the person out everywhere. Admins only; never yourself or a super admin. */
export async function banCustomer(_prev: StaffActionState, form: FormData): Promise<StaffActionState> {
  try {
    const session = await staffSession(["admin", "super_admin"]);
    const parsed = banSchema.safeParse({ userId: form.get("userId"), reason: form.get("reason"), days: form.get("days") ?? 0 });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
    const { userId, reason, days } = parsed.data;
    if (userId === session.user.id) return { ok: false, error: "You can't ban your own account." };
    const target = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!target) return { ok: false, error: "That person no longer exists." };
    if (hasAnyRole(target.role, ["super_admin"])) return { ok: false, error: "A super admin can't be banned here." };
    await auth.api.banUser({ body: { userId, banReason: reason, banExpiresIn: days ? days * 86_400 : undefined }, headers: await headers() });
    await audit({ actorId: session.user.id, action: "customer.banned", targetType: "user", targetId: userId, meta: { reason, days }, ipAddress: await ip() });
    refresh();
    return { ok: true, message: days ? `Banned for ${days} days.` : "Banned until lifted." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

export async function unbanCustomer(_prev: StaffActionState, form: FormData): Promise<StaffActionState> {
  try {
    const session = await staffSession(["admin", "super_admin"]);
    const userId = z.string().min(1).max(64).parse(form.get("userId"));
    await auth.api.unbanUser({ body: { userId }, headers: await headers() });
    await audit({ actorId: session.user.id, action: "customer.unbanned", targetType: "user", targetId: userId, ipAddress: await ip() });
    await notify(userId, { kind: "kyc_update", title: "Your account is open again", body: "You can sign in and use Luxx4less again.", href: "/account", channels: ["email"] });
    refresh();
    return { ok: true, message: "Ban lifted." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

/** Staff roles that can be granted from the customer page, and who may grant each. */
const GRANTABLE: Record<"support" | "kyc_reviewer" | "admin", readonly Role[]> = {
  support: ["admin", "super_admin"],
  kyc_reviewer: ["admin", "super_admin"],
  admin: ["super_admin"],
};

const roleSchema = z.object({
  userId: z.string().min(1).max(64),
  role: z.enum(["support", "kyc_reviewer", "admin"]),
  grant: z.enum(["true", "false"]),
});

/**
 * Grant or remove one staff role. Nobody changes their own roles; only a
 * super admin can make admins. The seller role comes only from passing seller
 * verification, never from here. New staff must turn on two-step sign-in
 * before the staff pages open for them.
 */
export async function setStaffRole(_prev: StaffActionState, form: FormData): Promise<StaffActionState> {
  try {
    const session = await staffSession(["admin", "super_admin"]);
    const parsed = roleSchema.safeParse({ userId: form.get("userId"), role: form.get("role"), grant: form.get("grant") });
    if (!parsed.success) return { ok: false, error: "Check the form." };
    const { userId, role, grant } = parsed.data;
    if (userId === session.user.id) return { ok: false, error: "Ask another admin to change your own roles." };
    if (!hasAnyRole(session.user.role, GRANTABLE[role])) return { ok: false, error: "Only a super admin can change admin access." };
    const target = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!target) return { ok: false, error: "That person no longer exists." };
    const roles = new Set(parseRoles(target.role));
    if (grant === "true") roles.add(role);
    else roles.delete(role);
    if (!roles.size) roles.add("buyer");
    await db.user.update({ where: { id: userId }, data: { role: [...roles].join(",") } });
    await audit({ actorId: session.user.id, action: grant === "true" ? "customer.role_granted" : "customer.role_removed", targetType: "user", targetId: userId, meta: { role }, ipAddress: await ip() });
    refresh();
    return { ok: true, message: grant === "true" ? `Added ${role.replace("_", " ")}.` : `Removed ${role.replace("_", " ")}.` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}
