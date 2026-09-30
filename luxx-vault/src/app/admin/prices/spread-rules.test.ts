import { describe, expect, it } from "vitest";
import { allSpreadSlots, checkSpreadRow, toPctInput } from "./spread-rules";

describe("spread rows", () => {
  it("accepts a normal spread and converts to ratios", () => {
    const r = checkSpreadRow("92.5", "118");
    expect(r).toEqual({ kind: "ok", buyRatio: 0.925, sellRatio: 1.18, warnings: [] });
  });

  it("treats two blanks as 'no spread'", () => {
    expect(checkSpreadRow("", " ").kind).toBe("empty");
  });

  it("requires both sides", () => {
    expect(checkSpreadRow("92", "").kind).toBe("error");
    expect(checkSpreadRow("", "110").kind).toBe("error");
  });

  it("blocks buy at or above sell, zeros and nonsense", () => {
    expect(checkSpreadRow("110", "105").kind).toBe("error");
    expect(checkSpreadRow("100", "100").kind).toBe("error");
    expect(checkSpreadRow("0", "110").kind).toBe("error");
    expect(checkSpreadRow("abc", "110").kind).toBe("error");
    expect(checkSpreadRow("92.555", "110").kind).toBe("error");
    expect(checkSpreadRow("200", "400").kind).toBe("error");
  });

  it("warns (but allows) buying above melt or selling below it", () => {
    const above = checkSpreadRow("101", "120");
    expect(above.kind === "ok" && above.warnings.length).toBe(1);
    const below = checkSpreadRow("80", "99");
    expect(below.kind === "ok" && below.warnings[0]).toMatch(/at or below melt/);
  });

  it("accepts a trailing percent sign", () => {
    expect(checkSpreadRow("90%", "115%").kind).toBe("ok");
  });

  it("round-trips ratios into inputs", () => {
    expect(toPctInput(0.925)).toBe("92.5");
    expect(toPctInput(1.18)).toBe("118");
    expect(toPctInput(undefined)).toBe("");
  });

  it("offers a slot per metal purity and product type", () => {
    const slots = allSpreadSlots();
    expect(slots.filter((s) => s.metal === "gold" && s.productType === "jewelry")).toHaveLength(9);
    expect(new Set(slots.map((s) => s.key)).size).toBe(slots.length);
  });
});
