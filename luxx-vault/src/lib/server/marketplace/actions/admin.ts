"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { hasAnyRole, requiresTwoFactor, type Role } from "@/config/roles";
import { audit } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { notify } from "@/lib/server/notify";
import { paymentsFor } from "@/lib/server/payments";
import { getSession } from "@/lib/server/session";
import { systemMessage } from "../conversations";
import { runAction, UserError, type ActionState } from "../context";
import { releaseTrade } from "../trades";

const MODERATORS: readonly Role[] = ["support", "admin", "super_admin"];
const Id = z.string().regex(/^[a-z0-9]{20,32}$/i);
const Note = z.string().trim().min(10, "Write a note of at least 10 characters: it is kept in the audit log and shown to both sides.").max(2000);

/** Staff gate for actions: moderator role and two-step sign-in, re-checked on every call. */
async function assertModerator() {
  const session = await getSession();
  if (!session || !hasAnyRole(session.user.role, MODERATORS)) throw new UserError("Staff only.");
  if (requiresTwoFactor(session.user.role) && !session.user.twoFactorEnabled) throw new UserError("Turn on two-step sign-in first.");
  return session.user.id;
}

/** Action (remove the reported listing/post) or dismiss a report. Open-report counts drop either way. */
export async function resolveReport(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const staffId = await assertModerator();
    const id = Id.parse(form.get("reportId"));
    const decision = z.enum(["actioned", "dismissed"]).parse(form.get("decision"));
    const report = await db.report.findUnique({ where: { id } });
    if (!report || report.status !== "open") throw new UserError("This report was already handled.");
    const claimed = await db.report.updateMany({ where: { id, status: "open" }, data: { status: decision, handledById: staffId, handledAt: new Date() } });
    if (claimed.count !== 1) throw new UserError("This report was already handled.");

    if (report.targetType === "listing") {
      const l = await db.listing.findUnique({ where: { id: report.targetId }, select: { id: true, reportCount: true, status: true, sellerId: true, code: true } });
      if (l) {
        await db.listing.update({
          where: { id: l.id },
          data: { reportCount: Math.max(0, l.reportCount - 1), ...(decision === "actioned" && l.status !== "reserved" && l.status !== "sold" ? { status: "removed" } : {}) },
        });
        if (decision === "actioned" && l.status !== "reserved" && l.status !== "sold") {
          await notify(l.sellerId, { kind: "trade_update", title: `Listing removed · ${l.code}`, body: "Luxx4less staff removed this listing after a report. Reply to support if you think this is a mistake.", href: "/account/listings" });
        }
      }
    }
    if (report.targetType === "buy_request") {
      const r = await db.buyRequest.findUnique({ where: { id: report.targetId }, select: { id: true, reportCount: true, status: true } });
      if (r) {
        await db.buyRequest.update({
          where: { id: r.id },
          data: { reportCount: Math.max(0, r.reportCount - 1), ...(decision === "actioned" && r.status === "open" ? { status: "removed" } : {}) },
        });
      }
    }
    await audit({ actorId: staffId, action: `report.${decision}`, targetType: "report", targetId: id, meta: { targetType: report.targetType, targetId: report.targetId } });
    await notify(report.reporterId, {
      kind: "trade_update",
      title: "Your report was reviewed",
      body: decision === "actioned" ? "Thank you. We took action on what you reported." : "Thank you. We reviewed it and found no breach of our rules this time.",
    });
    refresh();
    return { ok: true, message: decision === "actioned" ? "Report actioned." : "Report dismissed." };
  });
}

/** Decide a dispute for the buyer (refund) or the seller (release). The note is required and audited. */
export async function resolveDispute(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const staffId = await assertModerator();
    const id = Id.parse(form.get("disputeId"));
    const outcome = z.enum(["resolved_buyer", "resolved_seller"]).parse(form.get("outcome"));
    const note = Note.safeParse(form.get("note"));
    if (!note.success) return { ok: false, fieldErrors: { note: note.error.issues[0]?.message ?? "Write a note." } };
    const dispute = await db.dispute.findUnique({ where: { id }, include: { trade: { include: { conversation: { select: { id: true } } } } } });
    if (!dispute || dispute.status !== "open") throw new UserError("This dispute was already resolved.");
    const claimed = await db.dispute.updateMany({ where: { id, status: "open" }, data: { status: outcome, resolution: note.data, resolvedById: staffId, resolvedAt: new Date() } });
    if (claimed.count !== 1) throw new UserError("This dispute was already resolved.");
    const t = dispute.trade;

    try {
      if (outcome === "resolved_seller") {
        await releaseTrade(t.id, staffId, "dispute_seller");
      } else {
        if (t.paymentRef) await paymentsFor(t.paymentProvider).refund(t.paymentRef, Number(t.amountPhp));
        await db.trade.update({ where: { id: t.id }, data: { status: "refunded", autoReleaseAt: null } });
        // The item goes back to its seller, not back on sale: they can renew it after checking it.
        if (t.listingId) await db.listing.updateMany({ where: { id: t.listingId, status: "reserved" }, data: { status: "expired" } });
        if (t.conversation) await systemMessage(t.conversation.id, "Luxx4less decided the dispute for the buyer. The held payment was refunded.");
      }
    } catch (err) {
      await db.dispute.update({ where: { id }, data: { status: "open", resolution: null, resolvedById: null, resolvedAt: null } });
      throw err;
    }
    await audit({ actorId: staffId, action: `dispute.${outcome}`, targetType: "dispute", targetId: id, meta: { trade: t.code, note: note.data, amountPhp: Number(t.amountPhp) } });
    const href = `/account/trades/${t.code}`;
    const body = `${outcome === "resolved_buyer" ? "Decided for the buyer: payment refunded." : "Decided for the seller: payment released."} Note from Luxx4less: ${note.data}`;
    await notify(t.buyerId, { kind: "trade_update", title: `Dispute resolved · ${t.code}`, body, href, channels: ["email"] });
    await notify(t.sellerId, { kind: "trade_update", title: `Dispute resolved · ${t.code}`, body, href, channels: ["email"] });
    refresh();
    return { ok: true, message: "Dispute resolved. Both sides were notified." };
  });
}

/** Listing moderation: remove or restore, clear duplicate-photo flags, record a Luxx-Tested result. */
export async function moderateListing(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const staffId = await assertModerator();
    const id = Id.parse(form.get("listingId"));
    const op = z.enum(["remove", "restore", "clear_duplicates", "set_tested", "clear_tested"]).parse(form.get("op"));
    const listing = await db.listing.findUnique({ where: { id }, select: { id: true, code: true, status: true, sellerId: true, expiresAt: true } });
    if (!listing) throw new UserError("Unknown listing.");
    let meta: Record<string, string> = {};
    switch (op) {
      case "remove":
        if (listing.status === "reserved") throw new UserError("This listing is in a trade. Resolve the trade first.");
        await db.listing.update({ where: { id }, data: { status: "removed" } });
        await db.offer.updateMany({ where: { listingId: id, status: "pending" }, data: { status: "declined", respondedAt: new Date() } });
        await notify(listing.sellerId, { kind: "trade_update", title: `Listing removed · ${listing.code}`, body: "Luxx4less staff removed this listing. Contact support if you think this is a mistake.", href: "/account/listings" });
        break;
      case "restore":
        if (listing.status !== "removed") throw new UserError("Only removed listings can be restored.");
        await db.listing.update({ where: { id }, data: { status: listing.expiresAt > new Date() ? "active" : "expired", reportCount: 0 } });
        break;
      case "clear_duplicates":
        await db.listingImage.updateMany({ where: { listingId: id }, data: { duplicateOfListingId: null } });
        break;
      case "set_tested": {
        const result = z.string().trim().min(3, "Describe the result, e.g. “XRF: 750 (18K), 12.41 g”.").max(200).safeParse(form.get("result"));
        const date = z.coerce.date().safeParse(form.get("testedAt"));
        if (!result.success) return { ok: false, fieldErrors: { result: result.error.issues[0]?.message ?? "Describe the result." } };
        if (!date.success || date.data > new Date()) return { ok: false, fieldErrors: { testedAt: "Choose the test date (not in the future)." } };
        await db.listing.update({ where: { id }, data: { luxxTestResult: result.data, luxxTestedAt: date.data } });
        meta = { result: result.data, testedAt: date.data.toISOString() };
        await notify(listing.sellerId, { kind: "trade_update", title: `Luxx-Tested · ${listing.code}`, body: `Result recorded: ${result.data}`, href: `/marketplace/${listing.code}` });
        break;
      }
      case "clear_tested":
        await db.listing.update({ where: { id }, data: { luxxTestResult: null, luxxTestedAt: null } });
        break;
    }
    await audit({ actorId: staffId, action: `listing.moderation.${op}`, targetType: "listing", targetId: id, meta: { code: listing.code, ...meta } });
    refresh();
    return { ok: true, message: "Saved." };
  });
}
