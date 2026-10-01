"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasAnyRole, requiresTwoFactor } from "@/config/roles";
import { formatPeso } from "@/lib/pricing";
import { balanceOf, money, staffSteps, type StaffStep } from "@/lib/shop";
import { audit } from "@/lib/server/audit";
import { assertAdmin } from "@/lib/server/b-admin";
import { db } from "@/lib/server/db";
import { COURIERS } from "@/lib/server/marketplace/trades";
import { uniqueCode } from "@/lib/server/marketplace/codes";
import { runAction, str, UserError, type ActionState } from "@/lib/server/marketplace/context";
import { attachProductPhotos } from "@/lib/server/media";
import { notify } from "@/lib/server/notify";
import { getSession } from "@/lib/server/session";
import { ORDER_STAFF, cancelShopOrder, notifyShopStaff, recomputeShopOrder } from "./orders";
import { parseProductForm } from "./product-input";

const Id = z.string().regex(/^[a-z0-9]{20,32}$/i);

/** Order desk: support, admin or super admin, with two-step sign-in, checked on every call. */
async function assertOrderStaff(): Promise<string> {
  const session = await getSession();
  if (!session || !hasAnyRole(session.user.role, ORDER_STAFF)) throw new UserError("Staff only.");
  if (requiresTwoFactor(session.user.role) && !session.user.twoFactorEnabled) throw new UserError("Turn on two-step sign-in first.");
  return session.user.id;
}

// ------------------------------------------------------------------ products

/** Create or update an Official Shop product (admins). */
export async function saveProduct(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const session = await assertAdmin();
    const parsed = parseProductForm(form);
    if ("errors" in parsed) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: parsed.errors };
    const d = parsed.data;
    const id = str(form, "id");
    const data = {
      title: d.title,
      category: d.category,
      metal: d.metal ?? null,
      karat: d.karat ?? null,
      finenessPermille: d.finenessPermille ?? null,
      goldType: d.goldType ?? null,
      form: d.form ?? null,
      weightGrams: d.weightGrams,
      pricingMode: d.pricingMode,
      pricePhp: d.pricePhp ?? null,
      premiumPct: d.premiumPct ?? null,
      description: d.description,
      hasCertificate: d.hasCertificate,
      pawnable: d.pawnable === "unknown" ? null : d.pawnable === "yes",
      stock: d.stock,
      layawayAllowed: d.layawayAllowed,
      featured: d.featured,
      status: d.status,
    };
    let product: { id: string; code: string };
    if (id) {
      Id.parse(id);
      const existing = await db.product.findUnique({ where: { id }, select: { id: true, code: true } });
      if (!existing) throw new UserError("That product no longer exists.");
      product = await db.product.update({ where: { id }, data, select: { id: true, code: true } });
    } else {
      const code = await uniqueCode("LP", async (c) => Boolean(await db.product.findUnique({ where: { code: c }, select: { id: true } })));
      product = await db.product.create({ data: { ...data, code, createdById: session.user.id }, select: { id: true, code: true } });
    }
    await attachProductPhotos(product, d.photos);
    await audit({ actorId: session.user.id, action: id ? "shop.product.updated" : "shop.product.created", targetType: "product", targetId: product.id, meta: { code: product.code, status: d.status, stock: d.stock } });
    refresh();
    return { ok: true, href: `/admin/shop?saved=${product.code}` };
  });
}

/** Quick publish / unpublish / archive from the product list. */
export async function setProductStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const session = await assertAdmin();
    const id = Id.parse(form.get("productId"));
    const status = z.enum(["draft", "active", "archived"]).parse(form.get("status"));
    const p = await db.product.findUnique({ where: { id }, select: { code: true, _count: { select: { images: true } } } });
    if (!p) throw new UserError("That product no longer exists.");
    if (status === "active" && p._count.images === 0) throw new UserError("Add a photo before publishing.");
    await db.product.update({ where: { id }, data: { status } });
    if (status !== "active") await db.cartItem.deleteMany({ where: { productId: id } });
    await audit({ actorId: session.user.id, action: `shop.product.${status}`, targetType: "product", targetId: id, meta: { code: p.code } });
    refresh();
    return { ok: true, message: status === "active" ? "Published." : status === "archived" ? "Archived." : "Moved to drafts." };
  });
}

// ------------------------------------------------------------------ settings

const SettingsSchema = z.object({
  paymentInstructions: z.string().trim().max(2000, "Keep it under 2,000 characters."),
  reserveDays: z.coerce.number().int().min(1, "At least 1 day.").max(30, "At most 30 days."),
  layawayEnabled: z.preprocess((v) => v === "on", z.boolean()),
  layawayDownPct: z.coerce.number().int().min(5, "Between 5% and 90%.").max(90, "Between 5% and 90%."),
  layawayMonths: z.coerce.number().int().min(1, "Between 1 and 12 months.").max(12, "Between 1 and 12 months."),
  layawayMinPhp: z.coerce.number().min(0).max(10_000_000),
  codEnabled: z.preprocess((v) => v === "on", z.boolean()),
  codMaxPhp: z.preprocess((v) => (v === "" || v === null ? null : Number(String(v).replace(/[,₱\s]/g, ""))), z.number().min(0).nullable()),
  deliveryFeePhp: z.preprocess((v) => (v === "" || v === null ? null : Number(String(v).replace(/[,₱\s]/g, ""))), z.number().min(0).max(100_000).nullable()),
});

/**
 * Shop settings (admins). A change to the payment details is the classic way
 * to divert a shop's money, so every admin is told when they change.
 */
export async function saveShopSettings(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const session = await assertAdmin();
    const parsed = SettingsSchema.safeParse(Object.fromEntries(form.entries()));
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
      return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
    }
    const d = parsed.data;
    const before = await db.shopSettings.upsert({ where: { id: "shop" }, create: { id: "shop" }, update: {} });
    const paymentChanged = (before.paymentInstructions ?? "") !== d.paymentInstructions;
    await db.shopSettings.update({ where: { id: "shop" }, data: { ...d, paymentInstructions: d.paymentInstructions || null, updatedById: session.user.id } });
    const changed = Object.keys(d).filter((k) => String((before as Record<string, unknown>)[k] ?? "") !== String((d as Record<string, unknown>)[k] ?? ""));
    // The payment text itself is not copied into the audit log: only that it changed.
    await audit({ actorId: session.user.id, action: "shop.settings.updated", targetType: "shop_settings", targetId: "shop", meta: { changed } });
    if (paymentChanged) {
      await notifyShopStaff({
        kind: "order_update",
        title: "Shop payment details were changed",
        body: `${session.user.name} changed the GCash / bank details buyers see. If this wasn't you or your team, check the shop settings now.`,
        href: "/admin/shop/settings",
        channels: ["email"],
      });
    }
    refresh();
    return { ok: true, message: "Settings saved." };
  });
}

// ------------------------------------------------------------------ orders

async function loadOrder(form: FormData) {
  const staffId = await assertOrderStaff();
  const id = Id.parse(form.get("orderId"));
  const order = await db.shopOrder.findUnique({ where: { id } });
  if (!order) throw new UserError("That order no longer exists.");
  return { staffId, order };
}

/** Confirm or reject a receipt the buyer uploaded. Rejecting needs a reason, which the buyer sees. */
export async function reviewPayment(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const staffId = await assertOrderStaff();
    const id = Id.parse(form.get("paymentId"));
    const decision = z.enum(["confirmed", "rejected"]).parse(form.get("decision"));
    const note = str(form, "note");
    if (decision === "rejected" && note.length < 5) return { ok: false, fieldErrors: { note: "Say why, so the buyer can fix it (they see this)." } };
    const payment = await db.shopPayment.findUnique({ where: { id }, include: { order: { select: { id: true, code: true, buyerId: true, totalPhp: true, paidPhp: true } } } });
    if (!payment || payment.status !== "submitted") throw new UserError("This receipt was already checked.");
    let amount = Number(payment.amountPhp);
    if (decision === "confirmed" && str(form, "amountPhp")) {
      amount = Number(str(form, "amountPhp").replace(/[,₱\s]/g, ""));
      if (!(amount > 0)) return { ok: false, fieldErrors: { amountPhp: "Enter the amount that actually arrived." } };
    }
    const claimed = await db.shopPayment.updateMany({
      where: { id, status: "submitted" },
      data: { status: decision, amountPhp: money(amount), reviewedById: staffId, reviewedAt: new Date(), reviewNote: note || null },
    });
    if (claimed.count !== 1) throw new UserError("This receipt was already checked.");
    await recomputeShopOrder(payment.order.id);
    await audit({ actorId: staffId, action: `shop.payment.${decision}`, targetType: "shop_order", targetId: payment.order.id, meta: { code: payment.order.code, paymentId: id, amountPhp: money(amount), note } });
    if (decision === "rejected") {
      await notify(payment.order.buyerId, {
        kind: "order_update",
        title: `Receipt not accepted · ${payment.order.code}`,
        body: `We couldn't match your payment of ${formatPeso(Number(payment.amountPhp), true)}: ${note}`,
        href: `/account/orders/${payment.order.code}`,
        channels: ["email"],
      });
    }
    redirect(`/admin/orders/${payment.order.code}?done=${decision}`);
  });
}

/** Staff record money received in person: cash or card in store, cash on delivery, or a transfer seen directly. */
export async function recordPayment(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const { staffId, order } = await loadOrder(form);
    if (order.status === "cancelled" || order.status === "completed") throw new UserError("This order is closed.");
    const method = z.enum(["in_store", "cod", "transfer"]).parse(form.get("method"));
    const amount = Number(str(form, "amountPhp").replace(/[,₱\s]/g, ""));
    const balance = balanceOf({ totalPhp: Number(order.totalPhp), paidPhp: Number(order.paidPhp) });
    if (!(amount > 0)) return { ok: false, fieldErrors: { amountPhp: "Enter the amount received." } };
    if (amount > balance + 0.004) return { ok: false, fieldErrors: { amountPhp: `Only ${formatPeso(balance, true)} is owed.` } };
    const note = str(form, "note").slice(0, 300);
    await db.shopPayment.create({
      data: { orderId: order.id, method, amountPhp: money(amount), status: "confirmed", submittedById: staffId, reviewedById: staffId, reviewedAt: new Date(), reviewNote: note || null, reference: str(form, "reference").slice(0, 40) || null },
    });
    const { to } = await recomputeShopOrder(order.id);
    await audit({ actorId: staffId, action: "shop.payment.recorded", targetType: "shop_order", targetId: order.id, meta: { code: order.code, method, amountPhp: money(amount) } });
    // At the counter: paid in full and handed over in one step.
    if (str(form, "handOver") === "on" && order.fulfilment === "pickup" && (to === "preparing" || to === "ready")) {
      const done = await db.shopOrder.updateMany({ where: { id: order.id, status: to }, data: { status: "completed", completedAt: new Date() } });
      if (done.count === 1) {
        await audit({ actorId: staffId, action: "shop.order.complete", targetType: "shop_order", targetId: order.id, meta: { code: order.code, from: to, to: "completed", atCounter: true } });
        await notify(order.buyerId, { kind: "order_update", title: `Completed · ${order.code}`, body: "Paid and collected. Enjoy your piece, and thank you for buying from Luxx4less.", href: `/account/orders/${order.code}`, channels: ["email"] });
      }
      redirect(`/admin/orders/${order.code}?done=recorded_completed`);
    }
    redirect(`/admin/orders/${order.code}?done=recorded`);
  });
}

/** Move an order to its next step: confirm a cash-on-delivery order, ready, shipped, completed. */
export async function advanceOrder(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const { staffId, order } = await loadOrder(form);
    const step = z.enum(["confirm_cod", "mark_ready", "mark_shipped", "complete"]).parse(form.get("step")) as StaffStep;
    if (!staffSteps(order).includes(step)) throw new UserError("This order has moved on. Refresh the page.");
    const href = `/account/orders/${order.code}`;
    let title = "";
    let body = "";
    let data: Record<string, unknown> = {};
    let to = order.status;

    if (step === "confirm_cod") {
      to = "preparing";
      title = `Order confirmed · ${order.code}`;
      body = "Thanks for confirming. We're preparing your order.";
    }
    if (step === "mark_ready") {
      to = "ready";
      title = `${order.fulfilment === "meetup" ? "Ready for meet-up" : "Ready for pickup"} · ${order.code}`;
      body = order.fulfilment === "meetup" ? "Your order is ready. We'll call to confirm the place and time." : `Your order is ready at ${order.branch ?? "the branch"}. Bring a valid ID.`;
    }
    if (step === "mark_shipped") {
      const courier = z.enum(COURIERS, "Choose the courier.").safeParse(form.get("courier"));
      const tracking = str(form, "trackingNumber");
      const fieldErrors: Record<string, string> = {};
      if (!courier.success) fieldErrors.courier = "Choose the courier.";
      if (tracking.length < 5 || tracking.length > 40) fieldErrors.trackingNumber = "Enter the tracking number.";
      if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };
      to = "shipped";
      data = { courier: courier.data, trackingNumber: tracking };
      title = `On the way · ${order.code}`;
      body = `Sent with ${courier.data}, tracking ${tracking}.`;
    }
    if (step === "complete") {
      const balance = balanceOf({ totalPhp: Number(order.totalPhp), paidPhp: Number(order.paidPhp) });
      if (balance > 0) {
        if (order.paymentMethod !== "cod") throw new UserError(`${formatPeso(balance, true)} is still owed. Record the payment first.`);
        // Cash on delivery: handing it over is when the cash is collected.
        await db.shopPayment.create({
          data: { orderId: order.id, method: "cod", amountPhp: balance, status: "confirmed", submittedById: staffId, reviewedById: staffId, reviewedAt: new Date(), reviewNote: "Cash collected on delivery" },
        });
        await recomputeShopOrder(order.id);
      }
      to = "completed";
      data = { completedAt: new Date() };
      title = `Completed · ${order.code}`;
      body = "Enjoy your piece, and thank you for buying from Luxx4less.";
    }

    const claimed = await db.shopOrder.updateMany({ where: { id: order.id, status: order.status }, data: { status: to, ...data } });
    if (claimed.count !== 1) throw new UserError("This order was just updated. Refresh the page.");
    await audit({ actorId: staffId, action: `shop.order.${step}`, targetType: "shop_order", targetId: order.id, meta: { code: order.code, from: order.status, to } });
    await notify(order.buyerId, { kind: "order_update", title, body, href, channels: ["email"] });
    redirect(`/admin/orders/${order.code}?done=${step}`);
  });
}

/** Staff cancel an order (reason required, the buyer sees it). Stock goes back on sale. */
export async function staffCancelOrder(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const { staffId, order } = await loadOrder(form);
    const reason = str(form, "reason");
    if (reason.length < 5) return { ok: false, fieldErrors: { reason: "Give the buyer a reason." } };
    if (!(await cancelShopOrder(order.id, reason.slice(0, 300), staffId))) throw new UserError("This order is already closed.");
    redirect(`/admin/orders/${order.code}?done=${Number(order.paidPhp) > 0 ? "cancelled_refund" : "cancelled"}`);
  });
}
