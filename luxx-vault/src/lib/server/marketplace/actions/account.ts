"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { ensureProfile } from "@/lib/server/profile";
import { getViewer } from "@/lib/server/viewer";
import { detectScam } from "@/lib/scam-detect";
import { runAction, UserError, type ActionState } from "../context";

export async function markAllNotificationsRead(): Promise<void> {
  const viewer = await getViewer();
  if (!viewer) return;
  await db.notification.updateMany({ where: { userId: viewer.userId, readAt: null }, data: { readAt: new Date() } });
  refresh();
}

/** Open one notification: mark it read, then follow its link (site-relative only). */
export async function openNotification(form: FormData): Promise<void> {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  const id = z.string().regex(/^[a-z0-9]{20,32}$/i).parse(form.get("id"));
  const n = await db.notification.findFirst({ where: { id, userId: viewer.userId }, select: { id: true, href: true } });
  if (!n) redirect("/account/notifications");
  await db.notification.update({ where: { id: n.id }, data: { readAt: new Date() } });
  redirect(n.href && n.href.startsWith("/") && !n.href.startsWith("//") ? n.href : "/account/notifications");
}

const TAGLINE_MAX = 120;

/** Showroom tagline and cover photo (owner only). */
export async function updateShowroom(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const viewer = await getViewer();
    if (!viewer) throw new UserError("Please sign in first.");
    if (viewer.tier < 1) throw new UserError("Confirm your email first.");
    const tagline = z.string().trim().max(TAGLINE_MAX, `Keep the tagline under ${TAGLINE_MAX} characters.`).safeParse(String(form.get("tagline") ?? ""));
    if (!tagline.success) return { ok: false, fieldErrors: { tagline: tagline.error.issues[0]?.message ?? "Too long." } };
    if (detectScam(tagline.data).flags.some((f) => f !== "pressure")) {
      return { ok: false, fieldErrors: { tagline: "Please leave phone numbers, account details and links out of your showroom." } };
    }
    const coverRaw = String(form.get("coverMediaId") ?? "");
    let coverMediaId: string | null | undefined = undefined;
    if (form.get("removeCover") === "1") coverMediaId = null;
    else if (coverRaw) {
      const m = await db.mediaObject.findFirst({ where: { id: coverRaw, ownerId: viewer.userId, purpose: "showroom_cover" }, select: { id: true } });
      if (!m) throw new UserError("That cover photo couldn't be found. Please upload it again.");
      coverMediaId = m.id;
    }
    const profile = await ensureProfile(viewer.userId, viewer.name);
    await db.profile.update({
      where: { userId: viewer.userId },
      data: { showroomTagline: tagline.data || null, ...(coverMediaId !== undefined ? { coverMediaId } : {}) },
    });
    await audit({ actorId: viewer.userId, action: "showroom.updated", targetType: "profile", targetId: viewer.userId });
    revalidatePath(`/sellers/${profile.handle}`);
    redirect(`/sellers/${profile.handle}?saved=1`);
  });
}
