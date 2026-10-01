"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isValidLocation } from "@/lib/locations";
import { normalizePhMobile } from "@/lib/phone";
import { formatPeso } from "@/lib/pricing";
import {
  FULFILMENT_VALUES,
  PAYMENT_METHOD_VALUES,
  balanceOf,
  buyerCanCancel,
  checkoutProblem,
  checkoutTierNeeded,
  layawaySchedule,
  money,
  orderTotals,
} from "@/lib/shop";
import { audit } from "@/lib/server/audit";
import { db } from "@/lib/server/db";
import { uniqueCode } from "@/lib/server/marketplace/codes";
import { runAction, str, UserError, type ActionState } from "@/lib/server/marketplace/context";
import { notify } from "@/lib/server/notify";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { getViewer, type Viewer } from "@/lib/server/viewer";
import { getBag } from "./bag";
import { cancelShopOrder, notifyShopStaff, recomputeShopOrder } from "./orders";
import { getShopSettings, pickupBranches, rulesOf } from "./settings";

const Id = z.string().regex(/^[a-z0-9]{20,32}$/i);
const OrderCode = z.string().regex(/^OR-[A-Z0-9]{5}$/);
const DAY = 86_400_000;
/** Unpaid orders one person may have open at once, so nobody can tie up the shop's stock. */
const MAX_OPEN_UNPAID = 3;

async function signedIn(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new UserError("Please sign in first.");
  if (viewer.tier < 1) throw new UserError("Confirm your email address first.");
  return viewer;
}

// ------------------------------------------------------------------ bag

/** Add a piece to the bag (Tier 1). Quantity is capped at what is in stock. */
export async function addToBag(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const viewer = await signedIn();
    const productId = Id.parse(form.get("productId"));
    const quantity = z.coerce.number().int().min(1).max(100).catch(1).parse(form.get("quantity"));
    const product = await db.product.findUnique({ where: { id: productId }, select: { status: true, stock: true, title: true } });
    if (!product || product.status !== "active") throw new UserError("This piece is no longer available.");
    if (product.stock <= 0) throw new UserError("Sorry, this piece just sold out.");
    const existing = await db.cartItem.findUnique({ where: { userId_productId: { userId: viewer.userId, productId } }, select: { quantity: true } });
    const next = Math.min(product.stock, (existing?.quantity ?? 0) + quantity);
    await db.cartItem.upsert({
      where: { userId_productId: { userId: viewer.userId, productId } },
      create: { userId: viewer.userId, productId, quantity: next },
      update: { quantity: next },
    });
    refresh();
    return { ok: true, message: existing && next === existing.quantity ? "Already in your bag: that's all we have." : "Added to your bag." };
  });
}

/** Change a line's quantity; 0 takes it out. */
export async function setBagQuantity(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const viewer = await signedIn();
    const productId = Id.parse(form.get("productId"));
    const quantity = z.coerce.number().int().min(0).max(100).parse(form.get("quantity"));
    if (quantity === 0) {
      await db.cartItem.deleteMany({ where: { userId: viewer.userId, productId } });
    } else {
      const product = await db.product.findUnique({ where: { id: productId }, select: { stock: true } });
      await db.cartItem.updateMany({ where: { userId: viewer.userId, productId }, data: { quantity: Math.max(1, Math.min(quantity, product?.stock ?? 1)) } });
    }
    refresh();
    return { ok: true };
  });
}

// ------------------------------------------------------------------ checkout

const CheckoutSchema = z.object({
  plan: z.enum(["full", "layaway"]),
  paymentMethod: z.enum(PAYMENT_METHOD_VALUES, "Choose how you'll pay."),
  fulfilment: z.enum(FULFILMENT_VALUES, "Choose how you'll get it."),
  contactName: z.string().trim().min(2, "Enter the name for this order.").max(80),
  contactPhone: z.string().trim().min(1, "Enter a Philippine mobile number."),
  buyerNote: z.string().trim().max(500, "Keep the note under 500 characters.").optional(),
  expectedTotal: z.coerce.number().nonnegative(),
});

/**
 * Place an order from the bag (Tier 2; Tier 3 above ₱100,000). Prices are
 * worked out again here from today's spot and locked into the order; the
 * pieces are taken out of stock in the same transaction, so two people can't
 * buy the last one.
 */
export async function placeOrder(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const viewer = await signedIn();
    if (viewer.tier < 2) throw new UserError("Verify your mobile number first.");
    await assertRateLimit(`shop:order:${viewer.userId}`, 10, 60 * 60_000, "Too many orders in the last hour. Please wait a little.");

    const parsed = CheckoutSchema.safeParse({
      plan: form.get("plan") || "full",
      paymentMethod: form.get("paymentMethod"),
      fulfilment: form.get("fulfilment"),
      contactName: form.get("contactName"),
      contactPhone: form.get("contactPhone"),
      buyerNote: str(form, "buyerNote") || undefined,
      expectedTotal: form.get("expectedTotal"),
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
      return { ok: false, error: "Please check the highlighted details.", fieldErrors };
    }
    const d = parsed.data;
    const fieldErrors: Record<string, string> = {};
    const phone = normalizePhMobile(d.contactPhone);
    if (!phone) fieldErrors.contactPhone = "Enter a Philippine mobile number, e.g. 0917 123 4567.";

    let branch: string | null = null;
    let address: { addressLine: string; regionCode: string; provinceCode: string | null; cityCode: string } | null = null;
    if (d.fulfilment === "pickup") {
      branch = pickupBranches().find((b) => b.name === str(form, "branch"))?.name ?? null;
      if (!branch) fieldErrors.branch = "Choose the branch you'll pick up from.";
    }
    if (d.fulfilment === "delivery") {
      const addressLine = str(form, "addressLine");
      const regionCode = str(form, "regionCode");
      const provinceCode = str(form, "provinceCode") || null;
      const cityCode = str(form, "cityCode");
      if (addressLine.length < 8) fieldErrors.addressLine = "Enter the house number, street and barangay.";
      if (!regionCode || !cityCode || !isValidLocation(regionCode, cityCode, provinceCode)) fieldErrors.cityCode = "Choose the region and city.";
      address = { addressLine, regionCode, provinceCode, cityCode };
    }
    if (d.fulfilment === "meetup" && (d.buyerNote?.length ?? 0) < 10) fieldErrors.buyerNote = "Tell us where and when suits you for the meet-up.";
    if (Object.keys(fieldErrors).length) return { ok: false, error: "Please check the highlighted details.", fieldErrors };

    const [bag, settings] = await Promise.all([getBag(viewer.userId), getShopSettings()]);
    if (!bag.lines.length) throw new UserError("Your bag is empty.");
    if (!bag.ready) throw new UserError("Something in your bag can't be ordered as it is. Open your bag to fix it.");
    const deliveryFee = d.fulfilment === "delivery" ? Number(settings.deliveryFeePhp ?? 0) : 0;
    const totals = orderTotals(
      bag.lines.map((l) => ({ unitPricePhp: l.unitPricePhp!, quantity: l.quantity })),
      deliveryFee,
    );
    if (Math.abs(totals.totalPhp - d.expectedTotal) >= 1) {
      refresh();
      return { ok: false, error: `Gold prices moved while you were here. The total is now ${formatPeso(totals.totalPhp)}. Check it and place the order again.` };
    }
    const needs = checkoutTierNeeded(totals.totalPhp);
    if (viewer.tier < needs) throw new UserError("Orders over ₱100,000 need an ID-verified account. Verify your ID in your account first.");
    const problem = checkoutProblem(
      { plan: d.plan, paymentMethod: d.paymentMethod, fulfilment: d.fulfilment },
      { totalPhp: totals.totalPhp, allLayawayAllowed: bag.allLayawayAllowed, rules: rulesOf(settings) },
    );
    if (problem) throw new UserError(problem);
    if (d.paymentMethod === "transfer" && !settings.paymentInstructions?.trim()) throw new UserError("Transfer payments aren't set up yet. Choose another way to pay.");
    const open = await db.shopOrder.count({ where: { buyerId: viewer.userId, status: { in: ["pending_payment", "awaiting_confirmation"] }, paidPhp: 0 } });
    if (open >= MAX_OPEN_UNPAID) throw new UserError(`You have ${open} unpaid orders. Pay or cancel one before placing another.`);

    const now = new Date();
    const cod = d.paymentMethod === "cod";
    const payBy = cod ? null : new Date(now.getTime() + settings.reserveDays * DAY);
    const schedule = d.plan === "layaway" ? layawaySchedule(totals.totalPhp, settings.layawayDownPct, settings.layawayMonths, now, payBy!) : [];
    const code = await uniqueCode("OR", async (c) => Boolean(await db.shopOrder.findUnique({ where: { code: c }, select: { id: true } })));

    const order = await db.$transaction(async (tx) => {
      for (const l of bag.lines) {
        const took = await tx.product.updateMany({ where: { id: l.productId, status: "active", stock: { gte: l.quantity } }, data: { stock: { decrement: l.quantity } } });
        if (took.count !== 1) throw new UserError(`“${l.title}” just sold out. It's been left in your bag; remove it to continue.`);
      }
      const created = await tx.shopOrder.create({
        data: {
          code,
          buyerId: viewer.userId,
          status: cod ? "awaiting_confirmation" : "pending_payment",
          plan: d.plan,
          paymentMethod: d.paymentMethod,
          fulfilment: d.fulfilment,
          branch,
          contactName: d.contactName,
          contactPhone: phone!,
          ...(address ?? {}),
          buyerNote: d.buyerNote ?? null,
          subtotalPhp: totals.subtotalPhp,
          deliveryFeePhp: totals.deliveryFeePhp,
          totalPhp: totals.totalPhp,
          downPaymentPhp: schedule[0]?.amountPhp ?? null,
          payBy,
          items: {
            create: bag.lines.map((l) => ({
              productId: l.productId,
              code: l.code,
              title: l.title,
              metal: l.metal,
              karat: l.karat,
              weightGrams: l.weightGrams,
              quantity: l.quantity,
              unitPricePhp: l.unitPricePhp!,
              coverMediaId: l.coverMediaId,
            })),
          },
          installments: { create: schedule.map((i) => ({ seq: i.seq, dueAt: i.dueAt, amountPhp: i.amountPhp })) },
        },
        select: { id: true, code: true },
      });
      await tx.cartItem.deleteMany({ where: { userId: viewer.userId } });
      return created;
    });

    await audit({ actorId: viewer.userId, action: "shop.order.placed", targetType: "shop_order", targetId: order.id, meta: { code, totalPhp: totals.totalPhp, plan: d.plan, paymentMethod: d.paymentMethod, fulfilment: d.fulfilment } });
    const href = `/account/orders/${code}`;
    await notify(viewer.userId, {
      kind: "order_update",
      title: `Order placed · ${code}`,
      body: cod
        ? `Thank you. We'll call ${d.contactName} to confirm before we send it. Total ${formatPeso(totals.totalPhp)}.`
        : `Thank you. Total ${formatPeso(totals.totalPhp)}${schedule.length ? `, down payment ${formatPeso(schedule[0]!.amountPhp)}` : ""}. Open the order to see how to pay.`,
      href,
      channels: ["email"],
    });
    await notifyShopStaff({
      kind: "order_update",
      title: `New shop order · ${code}`,
      body: `${formatPeso(totals.totalPhp)} · ${bag.lines.length} ${bag.lines.length === 1 ? "piece" : "pieces"} · ${d.paymentMethod.replace("_", " ")} · ${d.fulfilment}${d.plan === "layaway" ? " · layaway" : ""}`,
      href: `/admin/orders/${code}`,
      channels: ["email"],
    });
    return { ok: true, href: `${href}?placed=1` };
  });
}

// ------------------------------------------------------------------ after ordering

async function loadMyOrder(form: FormData) {
  const viewer = await signedIn();
  const code = OrderCode.parse(form.get("code"));
  const order = await db.shopOrder.findUnique({ where: { code }, include: { payments: { select: { status: true } } } });
  if (!order || order.buyerId !== viewer.userId) throw new UserError("That order isn't yours.");
  return { viewer, order };
}

export async function cancelMyOrder(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const { viewer, order } = await loadMyOrder(form);
    if (!buyerCanCancel({ status: order.status, paidPhp: Number(order.paidPhp) }, order.payments.some((p) => p.status === "submitted"))) {
      throw new UserError("This order can't be cancelled here any more. Message us and we'll help.");
    }
    await cancelShopOrder(order.id, "You cancelled this order.", viewer.userId);
    redirect(`/account/orders/${order.code}?cancelled=1`);
  });
}

/** The buyer uploads a GCash or bank receipt; staff check it against the account. */
export async function submitPaymentReceipt(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const { viewer, order } = await loadMyOrder(form);
    if (viewer.tier < 2) throw new UserError("Verify your mobile number first.");
    if (!["pending_payment", "payment_review", "layaway"].includes(order.status)) throw new UserError("This order isn't waiting for a payment.");
    await assertRateLimit(`shop:receipt:${viewer.userId}`, 10, 60 * 60_000, "Too many receipts in the last hour. Please wait a little.");
    const fieldErrors: Record<string, string> = {};
    let proof: string | undefined;
    try {
      proof = z.array(Id).length(1).parse(JSON.parse(str(form, "proof") || "[]"))[0];
    } catch {
      fieldErrors.proof = "Add a photo or screenshot of the receipt.";
    }
    const reference = str(form, "reference").replace(/\s+/g, " ");
    if (reference.length < 4 || reference.length > 40) fieldErrors.reference = "Enter the reference number shown on the receipt.";
    const amount = Number(str(form, "amountPhp").replace(/[,₱\s]/g, ""));
    const balance = balanceOf({ totalPhp: Number(order.totalPhp), paidPhp: Number(order.paidPhp) });
    if (!(amount > 0)) fieldErrors.amountPhp = "Enter the amount you sent.";
    else if (amount > balance + 0.004) fieldErrors.amountPhp = `That's more than the ${formatPeso(balance, true)} still owed.`;
    if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

    const media = await db.mediaObject.findUnique({ where: { id: proof! }, select: { ownerId: true, purpose: true } });
    if (!media || media.ownerId !== viewer.userId || media.purpose !== "payment_proof") throw new UserError("Please upload the receipt again.");
    const payment = await db.shopPayment.create({
      data: { orderId: order.id, method: "transfer", amountPhp: money(amount), reference, proofMediaId: proof!, submittedById: viewer.userId },
      select: { id: true },
    });
    await recomputeShopOrder(order.id);
    await audit({ actorId: viewer.userId, action: "shop.payment.submitted", targetType: "shop_order", targetId: order.id, meta: { code: order.code, paymentId: payment.id, amountPhp: money(amount) } });
    await notifyShopStaff({
      kind: "order_update",
      title: `Receipt to check · ${order.code}`,
      body: `${formatPeso(amount, true)} · ref ${reference}. Check it against the account before confirming.`,
      href: `/admin/orders/${order.code}`,
      channels: ["email"],
    });
    refresh();
    return { ok: true, message: "Receipt sent. We'll confirm it shortly, usually within the day." };
  });
}
