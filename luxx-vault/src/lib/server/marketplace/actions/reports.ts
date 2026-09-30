"use server";

import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { getViewer } from "@/lib/server/viewer";
import { runAction, UserError, type ActionState } from "../context";
import { REPORT_HIDE_THRESHOLD } from "../listings";
import { REPORT_REASONS } from "../reporting";
import { notifyStaff } from "../trades";

const Target = z.enum(["user", "listing", "buy_request", "message", "outside_number"]);

/**
 * Report a listing, wanted post, person, message or an outside phone number.
 * Three open reports hide a listing or wanted post from search until staff
 * review it (brief §9). One open report per person per target.
 */
export async function submitReport(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const viewer = await getViewer();
    if (!viewer) throw new UserError("Please sign in to report.");
    const targetType = Target.parse(form.get("targetType"));
    const reason = z.enum(REPORT_REASONS.map((r) => r.value) as [string, ...string[]], "Choose a reason.").safeParse(form.get("reason"));
    if (!reason.success) return { ok: false, fieldErrors: { reason: "Choose a reason." } };
    const details = z.string().trim().max(1500).optional().parse(typeof form.get("details") === "string" ? String(form.get("details")) : undefined) || null;

    let targetId = String(form.get("targetId") ?? "").trim();
    if (targetType === "outside_number") {
      const digits = targetId.replace(/\D/g, "");
      const m = /^(?:0|63)?(9\d{9})$/.exec(digits);
      if (!m) return { ok: false, fieldErrors: { targetId: "Enter a Philippine mobile number, e.g. 0917 123 4567." } };
      targetId = `+63${m[1]}`;
    } else if (!/^[a-z0-9]{20,32}$/i.test(targetId)) {
      throw new UserError("Unknown item to report.");
    }

    // The target must exist, and a message can only be reported by someone in that conversation.
    if (targetType === "listing" && !(await db.listing.findUnique({ where: { id: targetId }, select: { id: true } }))) throw new UserError("Unknown listing.");
    if (targetType === "buy_request" && !(await db.buyRequest.findUnique({ where: { id: targetId }, select: { id: true } }))) throw new UserError("Unknown wanted post.");
    if (targetType === "user" && !(await db.user.findUnique({ where: { id: targetId }, select: { id: true } }))) throw new UserError("Unknown person.");
    if (targetType === "message") {
      const m = await db.message.findUnique({ where: { id: targetId }, select: { conversation: { select: { participants: { select: { userId: true } } } } } });
      if (!m || !m.conversation.participants.some((p) => p.userId === viewer.userId)) throw new UserError("Unknown message.");
    }
    if (targetType === "user" && targetId === viewer.userId) throw new UserError("You can't report yourself.");

    const dup = await db.report.findFirst({ where: { reporterId: viewer.userId, targetType, targetId, status: "open" }, select: { id: true } });
    if (dup) return { ok: true, message: "You've already reported this. Our team is looking at it." };
    await assertRateLimit(`report:${viewer.userId}`, 10, 3_600_000, "You've sent several reports this hour. Please wait a little.");

    const report = await db.report.create({ data: { reporterId: viewer.userId, targetType, targetId, reason: reason.data, details } });
    if (targetType === "listing") {
      const l = await db.listing.update({ where: { id: targetId }, data: { reportCount: { increment: 1 } }, select: { reportCount: true, code: true } });
      if (l.reportCount === REPORT_HIDE_THRESHOLD) {
        await audit({ actorId: null, action: "listing.auto_hidden", targetType: "listing", targetId, meta: { code: l.code, reports: l.reportCount } });
        await notifyStaff(`Listing hidden after ${REPORT_HIDE_THRESHOLD} reports · ${l.code}`, "It is out of search until someone reviews it.", "/admin/reports");
      }
    }
    if (targetType === "buy_request") {
      await db.buyRequest.update({ where: { id: targetId }, data: { reportCount: { increment: 1 } } });
    }
    await audit({ actorId: viewer.userId, action: "report.created", targetType: "report", targetId: report.id, meta: { targetType, reason: reason.data } });
    return { ok: true, message: "Thank you. Our team reviews every report, and we'll act on this one." };
  });
}
