import { describe, expect, it } from "vitest";
import { KARATS, formatPeso, phpPerGram, phpPerGramAtKarat } from "./pricing";

describe("phpPerGram", () => {
  it("converts USD/oz to ₱/g", () => {
    // $31.1035 per troy ounce at ₱1 per dollar is exactly ₱1 per gram.
    expect(phpPerGram(31.1035, 1)).toBeCloseTo(1, 10);
    expect(phpPerGram(4000, 58)).toBeCloseTo(7458.97, 2); // 4000 × 58 ÷ 31.1035
  });

  it("rejects zero, negative and NaN inputs", () => {
    expect(() => phpPerGram(0, 58)).toThrow(RangeError);
    expect(() => phpPerGram(4000, -1)).toThrow(RangeError);
    expect(() => phpPerGram(Number.NaN, 58)).toThrow(RangeError);
  });
});

describe("phpPerGramAtKarat", () => {
  it("applies the purity factor", () => {
    const pure = phpPerGram(4000, 58);
    expect(phpPerGramAtKarat(4000, 58, 24)).toBeCloseTo(pure * 0.999, 6);
    expect(phpPerGramAtKarat(4000, 58, 18)).toBeCloseTo(pure * 0.75, 6);
  });

  it("lists karats high to low", () => {
    expect(KARATS).toEqual([24, 22, 21, 18, 14, 10]);
  });
});

describe("formatPeso", () => {
  it("formats pesos", () => {
    expect(formatPeso(8288.4)).toBe("₱8,288");
    expect(formatPeso(8288.456, true)).toBe("₱8,288.46");
  });
});
