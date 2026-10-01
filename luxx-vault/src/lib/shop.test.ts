import { describe, expect, it } from "vitest";
import {
  addMonths,
  balanceOf,
  buyerCanCancel,
  checkoutProblem,
  checkoutTierNeeded,
  coveredInstallments,
  layawaySchedule,
  nextAmountDue,
  orderTotals,
  staffSteps,
  statusAfterPayment,
  type ShopRules,
} from "./shop";

const RULES: ShopRules = { layawayEnabled: true, layawayDownPct: 30, layawayMonths: 3, layawayMinPhp: 5000, codEnabled: true, codMaxPhp: 50_000 };
const ok = { totalPhp: 20_000, allLayawayAllowed: true, rules: RULES };

describe("checkoutProblem", () => {
  it("accepts the sensible combinations", () => {
    expect(checkoutProblem({ plan: "full", paymentMethod: "in_store", fulfilment: "pickup" }, ok)).toBeNull();
    expect(checkoutProblem({ plan: "full", paymentMethod: "transfer", fulfilment: "delivery" }, ok)).toBeNull();
    expect(checkoutProblem({ plan: "full", paymentMethod: "cod", fulfilment: "meetup" }, ok)).toBeNull();
    expect(checkoutProblem({ plan: "layaway", paymentMethod: "transfer", fulfilment: "pickup" }, ok)).toBeNull();
    expect(checkoutProblem({ plan: "layaway", paymentMethod: "in_store", fulfilment: "pickup" }, ok)).toBeNull();
  });

  it("keeps paying in store to pickup", () => {
    expect(checkoutProblem({ plan: "full", paymentMethod: "in_store", fulfilment: "delivery" }, ok)).toMatch(/pickup/);
  });

  it("limits cash on delivery", () => {
    expect(checkoutProblem({ plan: "full", paymentMethod: "cod", fulfilment: "pickup" }, ok)).toMatch(/Pay in store/);
    expect(checkoutProblem({ plan: "layaway", paymentMethod: "cod", fulfilment: "delivery" }, ok)).toMatch(/Layaway/);
    expect(checkoutProblem({ plan: "full", paymentMethod: "cod", fulfilment: "delivery" }, { ...ok, totalPhp: 60_000 })).toMatch(/up to ₱50,000/);
    expect(checkoutProblem({ plan: "full", paymentMethod: "cod", fulfilment: "delivery" }, { ...ok, totalPhp: 60_000, rules: { ...RULES, codMaxPhp: null } })).toBeNull();
    expect(checkoutProblem({ plan: "full", paymentMethod: "cod", fulfilment: "delivery" }, { ...ok, rules: { ...RULES, codEnabled: false } })).toMatch(/isn't available/);
  });

  it("checks layaway terms", () => {
    expect(checkoutProblem({ plan: "layaway", paymentMethod: "transfer", fulfilment: "pickup" }, { ...ok, allLayawayAllowed: false })).toMatch(/can't be put on layaway/);
    expect(checkoutProblem({ plan: "layaway", paymentMethod: "transfer", fulfilment: "pickup" }, { ...ok, totalPhp: 4000 })).toMatch(/starts at ₱5,000/);
    expect(checkoutProblem({ plan: "layaway", paymentMethod: "transfer", fulfilment: "pickup" }, { ...ok, rules: { ...RULES, layawayEnabled: false } })).toMatch(/isn't available/);
  });
});

describe("checkoutTierNeeded", () => {
  it("asks for an ID above ₱100,000", () => {
    expect(checkoutTierNeeded(100_000)).toBe(2);
    expect(checkoutTierNeeded(100_001)).toBe(3);
  });
});

describe("orderTotals", () => {
  it("adds items and delivery to the centavo", () => {
    expect(orderTotals([{ unitPricePhp: 12_345.5, quantity: 2 }, { unitPricePhp: 0.1, quantity: 3 }], 150.2)).toEqual({ subtotalPhp: 24_691.3, deliveryFeePhp: 150.2, totalPhp: 24_841.5 });
  });
});

describe("addMonths", () => {
  it("clamps to the end of shorter months", () => {
    expect(addMonths(new Date("2026-01-31T04:00:00Z"), 1).toISOString()).toBe("2026-02-28T04:00:00.000Z");
    expect(addMonths(new Date("2028-01-31T04:00:00Z"), 1).toISOString()).toBe("2028-02-29T04:00:00.000Z");
    expect(addMonths(new Date("2026-11-15T04:00:00Z"), 3).toISOString()).toBe("2027-02-15T04:00:00.000Z");
  });
});

describe("layawaySchedule", () => {
  const at = new Date("2026-10-01T02:00:00Z");
  const by = new Date("2026-10-04T02:00:00Z");

  it("adds up to the total exactly", () => {
    for (const total of [5000, 12_345, 99_999.5, 250_001]) {
      const plan = layawaySchedule(total, 30, 3, at, by);
      expect(plan.reduce((s, i) => s + i.amountPhp, 0)).toBeCloseTo(total, 6);
      expect(plan).toHaveLength(4);
    }
  });

  it("takes the down payment first, then monthly", () => {
    const plan = layawaySchedule(10_000, 30, 3, at, by);
    expect(plan.map((i) => i.amountPhp)).toEqual([3000, 2333, 2333, 2334]);
    expect(plan[0]!.dueAt).toBe(by);
    expect(plan[1]!.dueAt.toISOString()).toBe("2026-11-01T02:00:00.000Z");
    expect(plan[3]!.dueAt.toISOString()).toBe("2027-01-01T02:00:00.000Z");
  });

  it("refuses nonsense terms", () => {
    expect(() => layawaySchedule(0, 30, 3, at, by)).toThrow(RangeError);
    expect(() => layawaySchedule(1000, 100, 3, at, by)).toThrow(RangeError);
    expect(() => layawaySchedule(1000, 30, 0, at, by)).toThrow(RangeError);
  });
});

describe("coveredInstallments and nextAmountDue", () => {
  const plan = [
    { seq: 0, amountPhp: 3000 },
    { seq: 1, amountPhp: 2333 },
    { seq: 2, amountPhp: 2333 },
    { seq: 3, amountPhp: 2334 },
  ];
  const order = { plan: "layaway", totalPhp: 10_000, downPaymentPhp: 3000 };

  it("covers instalments oldest first", () => {
    expect([...coveredInstallments(plan, 0)]).toEqual([]);
    expect([...coveredInstallments(plan, 3000)]).toEqual([0]);
    expect([...coveredInstallments(plan, 6000)]).toEqual([0, 1]);
    expect([...coveredInstallments(plan, 10_000)]).toEqual([0, 1, 2, 3]);
  });

  it("asks for the rest of the current instalment", () => {
    expect(nextAmountDue({ ...order, paidPhp: 0 }, plan)).toBe(3000);
    expect(nextAmountDue({ ...order, paidPhp: 3000 }, plan)).toBe(2333);
    expect(nextAmountDue({ ...order, paidPhp: 4000 }, plan)).toBe(1333);
    expect(nextAmountDue({ ...order, paidPhp: 10_000 }, plan)).toBe(0);
    expect(nextAmountDue({ plan: "full", totalPhp: 8000, paidPhp: 0, downPaymentPhp: null }, [])).toBe(8000);
  });
});

describe("statusAfterPayment", () => {
  const full = { status: "pending_payment", plan: "full", paymentMethod: "transfer", totalPhp: 10_000, downPaymentPhp: null };
  const lay = { ...full, plan: "layaway", downPaymentPhp: 3000 };

  it("moves forward as money is confirmed", () => {
    expect(statusAfterPayment(full, 0, true)).toBe("payment_review");
    expect(statusAfterPayment({ ...full, status: "payment_review" }, 0, false)).toBe("pending_payment");
    expect(statusAfterPayment({ ...full, status: "payment_review" }, 10_000, false)).toBe("preparing");
    expect(statusAfterPayment(lay, 3000, false)).toBe("layaway");
    expect(statusAfterPayment(lay, 2000, false)).toBe("pending_payment");
    expect(statusAfterPayment({ ...lay, status: "layaway" }, 9000, true)).toBe("payment_review");
    expect(statusAfterPayment({ ...lay, status: "layaway" }, 10_000, false)).toBe("preparing");
  });

  it("never moves an order back once it is handed over", () => {
    expect(statusAfterPayment({ ...full, status: "shipped", paymentMethod: "cod" }, 10_000, false)).toBe("shipped");
    expect(statusAfterPayment({ ...full, status: "completed" }, 0, false)).toBe("completed");
    expect(statusAfterPayment({ ...full, status: "cancelled" }, 10_000, false)).toBe("cancelled");
  });

  it("keeps a cash-on-delivery order waiting for its call", () => {
    expect(statusAfterPayment({ ...full, status: "awaiting_confirmation", paymentMethod: "cod" }, 0, false)).toBe("awaiting_confirmation");
  });
});

describe("staffSteps and buyerCanCancel", () => {
  it("offers the next step for each fulfilment", () => {
    expect(staffSteps({ status: "awaiting_confirmation", fulfilment: "delivery", paymentMethod: "cod" })).toEqual(["confirm_cod"]);
    expect(staffSteps({ status: "preparing", fulfilment: "delivery", paymentMethod: "transfer" })).toEqual(["mark_shipped"]);
    expect(staffSteps({ status: "preparing", fulfilment: "pickup", paymentMethod: "in_store" })).toEqual(["mark_ready"]);
    expect(staffSteps({ status: "shipped", fulfilment: "delivery", paymentMethod: "cod" })).toEqual(["complete"]);
    expect(staffSteps({ status: "pending_payment", fulfilment: "pickup", paymentMethod: "in_store" })).toEqual([]);
  });

  it("lets buyers cancel only before money moves", () => {
    expect(buyerCanCancel({ status: "pending_payment", paidPhp: 0 }, false)).toBe(true);
    expect(buyerCanCancel({ status: "pending_payment", paidPhp: 0 }, true)).toBe(false);
    expect(buyerCanCancel({ status: "layaway", paidPhp: 3000 }, false)).toBe(false);
    expect(buyerCanCancel({ status: "awaiting_confirmation", paidPhp: 0 }, false)).toBe(true);
  });

  it("works out the balance", () => {
    expect(balanceOf({ totalPhp: 100.3, paidPhp: 50.1 })).toBe(50.2);
    expect(balanceOf({ totalPhp: 100, paidPhp: 120 })).toBe(0);
  });
});
