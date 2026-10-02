"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hasAnyRole, requiresTwoFactor } from "@/config/roles";
import { formatPeso } from "@/lib/pricing";
import { audit } from "./audit";
import { assertAdmin } from "./b-admin";
import { db } from "./db";
import { recomputeSellerFees, sellerFees } from "./fees";
import { runAction, str, UserError, type ActionState } from "./marketplace/context";
import { notify } from "./notify";
import { assertRateLimit } from "./rate-limit";
import { getSession } from "./session";
import { ORDER_STAFF, notifyShopStaff } from "./shop/orders";
import { getViewer } from "./viewer";

const Id = z.string().regex(/^[a-z0-9]{20,32}$/i);
const pesos = (v: string) => Number(v.replace(/[,₱\s]/g, ""));

async function assertFeeStaff(): Promise<{ id: string; name: string }> {
  const session = await getSession();
  if (!session || !hasAnyRole(session.user.role, ORDER_STAFF)) throw new UserError("Staff only.");
  if (requiresTwoFactor(session.user.role) && !session.user.twoFactorEnabled) throw new UserError("Turn on two-step sign-in first.");
  return { id: session.user.id, name: session.user.name };
}

/** A seller uploads a GCash or bank receipt for their fees. */
export async function submitFeeReceipt(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const viewer = await getViewer();
    if (!viewer) throw new UserError("Please sign in first.");
    await assertRateLimit(`fees:receipt:${viewer.userId}`, 10, 60 * 60_000, "Too many receipts in the last hour. Please wait a little.");
    const f = await sellerFees(viewer.userId);
    if (f.balance <= 0) throw new UserError("You have no fees to pay right now.");
    const fieldErrors: Record<string, string> = {};
    let proof: string | undefined;
    try {
      proof = z.array(Id).length(1).parse(JSON.parse(str(form, "proof") || "[]"))[0];
    } catch {
      fieldErrors.proof = "Add a photo or screenshot of the receipt.";
    }
    const reference = str(form, "reference").replace(/\s+/g, " ");
    if (reference.length < 4 || reference.length > 40) fieldErrors.reference = "Enter the reference number shown on the receipt.";
    const amount = pesos(str(form, "amountPhp"));
    if (!(amount > 0)) fieldErrors.amountPhp = "Enter the amount you sent.";
    else if (amount > f.balance + 0.004) fieldErrors.amountPhp = `That's more than the ${formatPeso(f.balance, true)} you owe.`;
    if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

    const media = await db.mediaObject.findUnique({ where: { id: proof! }, select: { ownerId: true, purpose: true } });
    if (!media || media.ownerId !== viewer.userId || media.purpose !== "payment_proof") throw new UserError("Please upload the receipt again.");
    const p = await db.feePayment.create({ data: { sellerId: viewer.userId, amountPhp: amount, reference, proofMediaId: proof! }, select: { id: true } });
    await audit({ actorId: viewer.userId, action: "fee.payment.submitted", targetType: "fee_payment", targetId: p.id, meta: { amountPhp: amount } });
    await notifyShopStaff({
      kind: "trade_update",
      title: "Fee receipt to check",
      body: `${viewer.name} sent ${formatPeso(amount, true)} for marketplace fees · ref ${reference}. Check it against the account before confirming.`,
      href: "/admin/fees",
      channels: ["email"],
    });
    redirect("/account/fees?sent=1");
  });
}

/** Staff confirm (optionally correcting the amount that arrived) or reject a fee receipt. */
export async function reviewFeePayment(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const staff = await assertFeeStaff();
    const id = Id.parse(form.get("paymentId"));
    const decision = z.enum(["confirmed", "rejected"]).parse(form.get("decision"));
    const note = str(form, "note");
    if (decision === "rejected" && note.length < 5) return { ok: false, fieldErrors: { note: "Say why, so the seller can fix it (they see this)." } };
    const p = await db.feePayment.findUnique({ where: { id } });
    if (!p || p.status !== "submitted") throw new UserError("This receipt was already checked.");
    let amount = Number(p.amountPhp);
    if (decision === "confirmed" && str(form, "amountPhp")) {
      amount = pesos(str(form, "amountPhp"));
      if (!(amount > 0)) return { ok: false, fieldErrors: { amountPhp: "Enter the amount that actually arrived." } };
    }
    const claimed = await db.feePayment.updateMany({ where: { id, status: "submitted" }, data: { status: decision, amountPhp: amount, reviewedById: staff.id, reviewedAt: new Date(), reviewNote: note || null } });
    if (claimed.count !== 1) throw new UserError("This receipt was already checked.");
    await recomputeSellerFees(p.sellerId);
    await audit({ actorId: staff.id, action: `fee.payment.${decision}`, targetType: "fee_payment", targetId: id, meta: { sellerId: p.sellerId, amountPhp: amount, note } });
    await notify(p.sellerId, {
      kind: "trade_update",
      title: decision === "confirmed" ? "Fee payment confirmed" : "Fee receipt not accepted",
      body: decision === "confirmed" ? `Thank you: ${formatPeso(amount, true)} received.` : `We couldn't match your payment of ${formatPeso(Number(p.amountPhp), true)}: ${note}`,
      href: "/account/fees",
      channels: ["email"],
    });
    redirect(`/admin/fees?done=${decision}`);
  });
}

/** Staff record a fee paid some other way (cash at the branch, a transfer seen directly). */
export async function recordFeePayment(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const staff = await assertFeeStaff();
    const sellerId = Id.parse(form.get("sellerId"));
    const f = await sellerFees(sellerId);
    const amount = pesos(str(form, "amountPhp"));
    if (!(amount > 0)) return { ok: false, fieldErrors: { amountPhp: "Enter the amount received." } };
    if (amount > f.balance + 0.004) return { ok: false, fieldErrors: { amountPhp: `Only ${formatPeso(Math.max(0, f.balance), true)} is owed.` } };
    const method = z.enum(["in_store", "transfer"]).parse(form.get("method") || "in_store");
    await db.feePayment.create({ data: { sellerId, amountPhp: amount, method, status: "confirmed", reviewedById: staff.id, reviewedAt: new Date(), reviewNote: str(form, "note").slice(0, 300) || null, reference: str(form, "reference").slice(0, 40) || null } });
    await recomputeSellerFees(sellerId);
    await audit({ actorId: staff.id, action: "fee.payment.recorded", targetType: "user", targetId: sellerId, meta: { amountPhp: amount, method } });
    await notify(sellerId, { kind: "trade_update", title: "Fee payment recorded", body: `Thank you: ${formatPeso(amount, true)} received.`, href: "/account/fees" });
    redirect("/admin/fees?done=recorded");
  });
}

/** Admins can waive one trade's fee (e.g. a goodwill gesture); the reason is kept in the audit log. */
export async function waiveFee(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const session = await assertAdmin();
    const tradeId = Id.parse(form.get("tradeId"));
    const reason = str(form, "reason");
    if (reason.length < 5) return { ok: false, fieldErrors: { reason: "Give a reason (kept in the audit log)." } };
    const t = await db.trade.findUnique({ where: { id: tradeId }, select: { code: true, sellerId: true, feePhp: true, feeWaivedAt: true } });
    if (!t || t.feePhp === null || t.feeWaivedAt) throw new UserError("Nothing to waive on this trade.");
    await db.trade.update({ where: { id: tradeId }, data: { feeWaivedAt: new Date() } });
    await recomputeSellerFees(t.sellerId);
    await audit({ actorId: session.user.id, action: "fee.waived", targetType: "trade", targetId: tradeId, meta: { code: t.code, feePhp: Number(t.feePhp), reason } });
    await notify(t.sellerId, { kind: "trade_update", title: `Fee waived · ${t.code}`, body: `Luxx4less waived the ${formatPeso(Number(t.feePhp), true)} fee on this sale.`, href: "/account/fees" });
    redirect("/admin/fees?done=waived");
  });
}

const SettingsSchema = z.object({
  feePct: z.coerce.number().min(0, "Between 0% and 30%.").max(30, "Between 0% and 30%."),
  feeMinPhp: z.preprocess((v) => (v === "" || v === null ? null : pesos(String(v))), z.number().min(0).nullable()),
  feeMaxPhp: z.preprocess((v) => (v === "" || v === null ? null : pesos(String(v))), z.number().min(0).nullable()),
  feePayDays: z.coerce.number().int().min(1, "At least 1 day.").max(60, "At most 60 days."),
});

/** The fee rate and terms (admins). Applies to trades completed from now on. */
export async function saveMarketSettings(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const session = await assertAdmin();
    const parsed = SettingsSchema.safeParse(Object.fromEntries(form.entries()));
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
      return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
    }
    const d = parsed.data;
    if (d.feeMinPhp !== null && d.feeMaxPhp !== null && d.feeMinPhp > d.feeMaxPhp) return { ok: false, fieldErrors: { feeMaxPhp: "The maximum must be at least the minimum." } };
    const before = await db.marketSettings.upsert({ where: { id: "market" }, create: { id: "market" }, update: {} });
    await db.marketSettings.update({ where: { id: "market" }, data: { ...d, updatedById: session.user.id } });
    await audit({ actorId: session.user.id, action: "fee.settings.updated", targetType: "market_settings", targetId: "market", meta: { before: { feePct: Number(before.feePct), feeMinPhp: before.feeMinPhp && Number(before.feeMinPhp), feeMaxPhp: before.feeMaxPhp && Number(before.feeMaxPhp), feePayDays: before.feePayDays }, after: d } });
    redirect("/admin/fees?done=settings");
  });
}
