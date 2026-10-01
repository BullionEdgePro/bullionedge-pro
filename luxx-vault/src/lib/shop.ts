/**
 * The Official Shop's rules (brief §9): how an order may be paid and fulfilled,
 * the layaway (hulugan) schedule, and which step an order moves to next.
 * Pure, so the checkout, the order pages, staff tools and the tests share one
 * reading of them. The server re-checks everything; the browser decides nothing.
 */

export const PAYMENT_METHODS = {
  in_store: {
    label: "Pay in store",
    body: "Reserve online, then pay when you pick it up at the branch. Cash or card at the counter.",
  },
  transfer: {
    label: "GCash or bank transfer",
    body: "Our payment details appear on your order page once you order. Upload the receipt and we confirm it.",
  },
  cod: {
    label: "Cash on delivery or meet-up",
    body: "Pay in cash when the piece reaches you. We call first to confirm the order.",
  },
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;
export const PAYMENT_METHOD_VALUES = Object.keys(PAYMENT_METHODS) as [PaymentMethod, ...PaymentMethod[]];

export const FULFILMENTS = {
  pickup: { label: "Pick up at a branch", body: "Collect it in person; we check the piece with you at the counter." },
  delivery: { label: "Deliver to my address", body: "Insured courier to your door, with a tracking number." },
  meetup: { label: "Meet-up", body: "Tell us where suits you; we confirm the place and time by phone." },
} as const;
export type Fulfilment = keyof typeof FULFILMENTS;
export const FULFILMENT_VALUES = Object.keys(FULFILMENTS) as [Fulfilment, ...Fulfilment[]];

export type Plan = "full" | "layaway";

export const ORDER_STATUSES = {
  pending_payment: { label: "Waiting for payment", tone: "warning" },
  payment_review: { label: "Checking your payment", tone: "ice" },
  awaiting_confirmation: { label: "We'll call to confirm", tone: "warning" },
  layaway: { label: "On layaway", tone: "gold" },
  preparing: { label: "Being prepared", tone: "gold" },
  ready: { label: "Ready", tone: "success" },
  shipped: { label: "On the way", tone: "ice" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
} as const;
export type OrderStatus = keyof typeof ORDER_STATUSES;

/** Before anything is handed over: payment can still move the order forward. */
const PRE_FULFILMENT: readonly OrderStatus[] = ["pending_payment", "payment_review", "awaiting_confirmation", "layaway"];
/** Still open: can be cancelled, can take payments. */
export const OPEN_STATUSES: readonly OrderStatus[] = [...PRE_FULFILMENT, "preparing", "ready", "shipped"];

export function statusLabel(status: string, fulfilment?: string): string {
  if (status === "ready") return fulfilment === "meetup" ? "Ready for meet-up" : "Ready for pickup";
  return ORDER_STATUSES[status as OrderStatus]?.label ?? status;
}

/** Above this total, checkout needs an ID-verified account (Tier 3); below it, a verified phone is enough (brief §8: Tier 2 "small amounts"). */
export const SHOP_TIER2_MAX_PHP = 100_000;

export function checkoutTierNeeded(totalPhp: number): 2 | 3 {
  return totalPhp > SHOP_TIER2_MAX_PHP ? 3 : 2;
}

export type ShopRules = {
  layawayEnabled: boolean;
  layawayDownPct: number;
  layawayMonths: number;
  layawayMinPhp: number;
  codEnabled: boolean;
  codMaxPhp: number | null;
};

/** Why this combination can't be ordered, in words for the buyer, or null when it can. */
export function checkoutProblem(
  choice: { plan: Plan; paymentMethod: PaymentMethod; fulfilment: Fulfilment },
  ctx: { totalPhp: number; allLayawayAllowed: boolean; rules: ShopRules },
): string | null {
  const { plan, paymentMethod, fulfilment } = choice;
  const { rules, totalPhp } = ctx;
  if (paymentMethod === "in_store" && fulfilment !== "pickup") return "Paying in store needs pickup at a branch.";
  if (paymentMethod === "cod") {
    if (!rules.codEnabled) return "Cash on delivery isn't available right now.";
    if (fulfilment === "pickup") return "For pickup, choose Pay in store instead.";
    if (plan === "layaway") return "Layaway is paid in store or by transfer, not on delivery.";
    if (rules.codMaxPhp !== null && totalPhp > rules.codMaxPhp) return `Cash on delivery is for orders up to ${pesoText(rules.codMaxPhp)}. Choose another way to pay.`;
  }
  if (plan === "layaway") {
    if (!rules.layawayEnabled) return "Layaway isn't available right now.";
    if (!ctx.allLayawayAllowed) return "One of the pieces in your bag can't be put on layaway.";
    if (totalPhp < rules.layawayMinPhp) return `Layaway starts at ${pesoText(rules.layawayMinPhp)}.`;
  }
  return null;
}

function pesoText(v: number): string {
  return `₱${Math.round(v).toLocaleString("en-PH")}`;
}

/** Centavo-exact money: every sum the shop stores goes through this. */
export function money(v: number): number {
  return Math.round(v * 100) / 100;
}

export function orderTotals(items: readonly { unitPricePhp: number; quantity: number }[], deliveryFeePhp: number) {
  const subtotalPhp = money(items.reduce((s, i) => s + i.unitPricePhp * i.quantity, 0));
  return { subtotalPhp, deliveryFeePhp: money(deliveryFeePhp), totalPhp: money(subtotalPhp + deliveryFeePhp) };
}

/** Same day of the month, n months on; a day the month doesn't have becomes its last day (31 Jan + 1 = 28/29 Feb). */
export function addMonths(date: Date, n: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

export type Installment = { seq: number; dueAt: Date; amountPhp: number };

/**
 * Layaway: a down payment now (due by `downDueAt`), then equal monthly
 * payments from a month after the order. Whole pesos, with any remainder on
 * the last payment, so the schedule always adds up to the total exactly.
 */
export function layawaySchedule(totalPhp: number, downPct: number, months: number, orderedAt: Date, downDueAt: Date): Installment[] {
  if (!(totalPhp > 0) || months < 1 || downPct <= 0 || downPct >= 100) throw new RangeError("Invalid layaway terms");
  const down = Math.ceil((totalPhp * downPct) / 100);
  const rest = money(totalPhp - down);
  const each = Math.floor(rest / months);
  const plan: Installment[] = [{ seq: 0, dueAt: downDueAt, amountPhp: down }];
  for (let i = 1; i <= months; i++) {
    plan.push({ seq: i, dueAt: addMonths(orderedAt, i), amountPhp: i === months ? money(rest - each * (months - 1)) : each });
  }
  return plan;
}

/** Which instalments the confirmed payments so far cover, oldest first. */
export function coveredInstallments(plan: readonly { seq: number; amountPhp: number }[], paidPhp: number): Set<number> {
  const covered = new Set<number>();
  let left = money(paidPhp);
  for (const i of [...plan].sort((a, b) => a.seq - b.seq)) {
    if (left + 0.004 < i.amountPhp) break;
    left = money(left - i.amountPhp);
    covered.add(i.seq);
  }
  return covered;
}

/**
 * Where an order stands after its confirmed payments change. Payment only
 * moves an order that hasn't been handed over yet; one that is ready, shipped
 * or done keeps its step (a cash-on-delivery payment lands at the very end).
 */
export function statusAfterPayment(
  order: { status: string; plan: string; paymentMethod: string; totalPhp: number; downPaymentPhp: number | null },
  paidPhp: number,
  hasSubmitted: boolean,
): OrderStatus {
  const current = order.status as OrderStatus;
  if (!PRE_FULFILMENT.includes(current)) return current;
  if (paidPhp + 0.004 >= order.totalPhp) return "preparing";
  if (current === "awaiting_confirmation") return current;
  if (hasSubmitted) return "payment_review";
  if (order.plan === "layaway" && order.downPaymentPhp !== null && paidPhp + 0.004 >= order.downPaymentPhp) return "layaway";
  return "pending_payment";
}

export type StaffStep = "confirm_cod" | "mark_ready" | "mark_shipped" | "complete";

/** The next steps staff may take on an order (cancel and record payment are offered separately). */
export function staffSteps(order: { status: string; fulfilment: string; paymentMethod: string }): StaffStep[] {
  switch (order.status) {
    case "awaiting_confirmation":
      return ["confirm_cod"];
    case "preparing":
      return order.fulfilment === "delivery" ? ["mark_shipped"] : ["mark_ready"];
    case "ready":
    case "shipped":
      return ["complete"];
    default:
      return [];
  }
}

/** A buyer may cancel only before anything is paid or handed over. */
export function buyerCanCancel(order: { status: string; paidPhp: number }, hasSubmittedPayment: boolean): boolean {
  return (order.status === "pending_payment" || order.status === "awaiting_confirmation") && order.paidPhp <= 0 && !hasSubmittedPayment;
}

/** What is still owed. */
export function balanceOf(order: { totalPhp: number; paidPhp: number }): number {
  return Math.max(0, money(order.totalPhp - order.paidPhp));
}

/** What the buyer should pay next: the down payment first on layaway, otherwise the balance. */
export function nextAmountDue(order: { plan: string; totalPhp: number; paidPhp: number; downPaymentPhp: number | null }, plan: readonly { seq: number; amountPhp: number }[]): number {
  const balance = balanceOf(order);
  if (order.plan !== "layaway" || !plan.length) return balance;
  const covered = coveredInstallments(plan, order.paidPhp);
  const paidTowardsCovered = plan.filter((i) => covered.has(i.seq)).reduce((s, i) => s + i.amountPhp, 0);
  const next = [...plan].sort((a, b) => a.seq - b.seq).find((i) => !covered.has(i.seq));
  if (!next) return balance;
  return Math.min(balance, money(next.amountPhp - (order.paidPhp - paidTowardsCovered)));
}
