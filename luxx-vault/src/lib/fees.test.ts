import { describe, expect, it } from "vitest";
import { feeFor, feeRateLabel, sellerNet, settleFees, type FeeLine } from "./fees";

const rules = { feePct: 3, feeMinPhp: null, feeMaxPhp: null };

describe("feeFor", () => {
  it("takes the rate of the sale, to the centavo", () => {
    expect(feeFor(50_000, rules)).toBe(1500);
    expect(feeFor(12_345, rules)).toBe(370.35);
    expect(feeFor(0, rules)).toBe(0);
    expect(feeFor(10_000, { ...rules, feePct: 0 })).toBe(0);
  });

  it("holds the fee between the minimum and maximum", () => {
    expect(feeFor(1000, { ...rules, feeMinPhp: 100 })).toBe(100);
    expect(feeFor(500_000, { ...rules, feeMaxPhp: 5000 })).toBe(5000);
    expect(feeFor(60, { ...rules, feeMinPhp: 100 })).toBe(60); // never more than the sale
  });

  it("works out what the seller keeps", () => {
    expect(sellerNet(50_000, rules)).toBe(48_500);
    expect(feeRateLabel({ feePct: 2.5 })).toBe("2.5%");
    expect(feeRateLabel({ feePct: 3 })).toBe("3%");
  });
});

describe("settleFees", () => {
  const now = new Date("2026-10-20T00:00:00Z");
  const line = (id: string, fee: number, released: string, due: string, waived = false): FeeLine => ({ id, feePhp: fee, releasedAt: new Date(released), dueAt: new Date(due), waived });
  const lines = [line("b", 600, "2026-10-05", "2026-10-12"), line("a", 1500, "2026-10-01", "2026-10-08"), line("c", 900, "2026-10-15", "2026-10-22")];

  it("pays the oldest fee first", () => {
    const s = settleFees(lines, 1500, now);
    expect([...s.paid]).toEqual(["a"]);
    expect(s.balance).toBe(1500);
    expect(s.overdue).toBe(true);
    expect(s.overduePhp).toBe(600);
  });

  it("is clear when everything is paid, and keeps a credit when overpaid", () => {
    expect(settleFees(lines, 3000, now)).toMatchObject({ balance: 0, overdue: false, overduePhp: 0, nextDueAt: null });
    expect(settleFees(lines, 3100, now).balance).toBe(-100);
  });

  it("is not overdue while the only unpaid fee is still within its days", () => {
    const s = settleFees(lines, 2100, now);
    expect(s.overdue).toBe(false);
    expect(s.balance).toBe(900);
    expect(s.nextDueAt?.toISOString()).toBe("2026-10-22T00:00:00.000Z");
  });

  it("skips waived fees", () => {
    const s = settleFees([line("a", 1500, "2026-10-01", "2026-10-08", true)], 0, now);
    expect(s).toMatchObject({ balance: 0, overdue: false });
  });
});
