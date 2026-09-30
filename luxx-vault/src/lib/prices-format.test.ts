import { describe, expect, it } from "vitest";
import {
  chartGeometry,
  convertAll,
  direction,
  finenessRows,
  formatPct,
  formatPerGram,
  formatPesoChange,
  fractionFor,
  karatRows,
  nearestIndex,
  niceTicks,
  offerVerdict,
  parseAmount,
  roundEstimate,
} from "./prices-format";

describe("formatting", () => {
  it("signs percentages and shows a dash when unknown", () => {
    expect(formatPct(1.2345)).toBe("+1.23%");
    expect(formatPct(-0.5)).toBe("−0.50%");
    expect(formatPct(0.001)).toBe("0.00%");
    expect(formatPct(null)).toBe("—");
    expect(formatPct(Number.NaN)).toBe("—");
  });

  it("uses centavos only for small per-gram prices", () => {
    expect(formatPerGram(121.344)).toMatch(/121\.34$/);
    expect(formatPerGram(8360.78)).toMatch(/8,361$/);
    expect(formatPerGram(null)).toBe("—");
    expect(formatPerGram(0)).toBe("—");
  });

  it("signs peso changes", () => {
    expect(formatPesoChange(12.4)).toMatch(/^\+₱12\.40$/);
    expect(formatPesoChange(-1500)).toMatch(/^−₱1,500$/);
    expect(formatPesoChange(null)).toBe("—");
  });

  it("classifies direction", () => {
    expect(direction(0.2)).toBe("up");
    expect(direction(-0.2)).toBe("down");
    expect(direction(0)).toBe("flat");
    expect(direction(null)).toBeNull();
  });
});

describe("tables", () => {
  it("prices every karat from the fineness table", () => {
    const rows = karatRows(8000);
    expect(rows.map((r) => r.karat)).toEqual([24, 22, 21, 20, 18, 14, 10, 9, 6]);
    const k18 = rows.find((r) => r.karat === 18)!;
    expect(k18.phpPerGram).toBeCloseTo(6000);
    expect(k18.purityPct).toBe(75);
    expect(k18.partsPer24).toBe(18);
    expect(rows[0]!.partsPer24).toBe(23.98);
  });

  it("has no prices without a market", () => {
    expect(karatRows(null).every((r) => r.phpPerGram === null)).toBe(true);
    expect(finenessRows("silver", null).every((r) => r.phpPerGram === null)).toBe(true);
  });

  it("maps stored purities to fractions", () => {
    expect(fractionFor("gold", 21)).toBe(0.875);
    expect(fractionFor("silver", 925)).toBe(0.925);
    expect(fractionFor("gold", 23)).toBeNull();
  });
});

describe("units", () => {
  it("converts a troy ounce to grams and back", () => {
    const all = convertAll(1, "ozt");
    expect(all.g).toBeCloseTo(31.1035);
    expect(all.ozt).toBeCloseTo(1);
    expect(all.kg).toBeCloseTo(0.0311035);
    expect(convertAll(11.6638, "g").tola).toBeCloseTo(1);
    expect(convertAll(1, "tael").g).toBeCloseTo(37.429);
  });

  it("parses typed amounts strictly", () => {
    expect(parseAmount("1,234.5")).toBe(1234.5);
    expect(parseAmount(" 2 ")).toBe(2);
    expect(parseAmount("₱7,700")).toBe(7700);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("-3")).toBeNull();
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("12abc")).toBeNull();
  });

  it("rounds estimates down to ₱10", () => {
    expect(roundEstimate(12345.67)).toBe(12340);
  });
});

describe("offer verdicts", () => {
  it("flags prices under 90% of melt as suspicious", () => {
    expect(offerVerdict(8900, 10000)?.verdict).toBe("suspicious");
    expect(offerVerdict(9500, 10000)?.verdict).toBe("below-melt");
    expect(offerVerdict(10200, 10000)?.verdict).toBe("near-melt");
    expect(offerVerdict(12500, 10000)?.verdict).toBe("typical");
    expect(offerVerdict(17000, 10000)?.verdict).toBe("well-above");
    expect(offerVerdict(12500, 10000)?.premiumPct).toBeCloseTo(25);
  });

  it("refuses to judge without both numbers", () => {
    expect(offerVerdict(0, 10000)).toBeNull();
    expect(offerVerdict(100, 0)).toBeNull();
  });
});

describe("chart geometry", () => {
  const pts = [
    { t: "2026-09-01", v: 100 },
    { t: "2026-09-02", v: 110 },
    { t: "2026-09-04", v: 105 },
  ];

  it("needs two points", () => {
    expect(chartGeometry(pts.slice(0, 1), 800, 300)).toBeNull();
  });

  it("places x by time and keeps y inside the box", () => {
    const g = chartGeometry(pts, 300, 100)!;
    expect(g.xs[0]).toBe(0);
    expect(g.xs[2]).toBe(300);
    expect(g.xs[1]).toBeCloseTo(100); // one day of three
    for (const y of g.ys) {
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(100);
    }
    expect(g.ys[1]).toBeLessThan(g.ys[0]!); // higher price, higher on screen
    expect(g.line.startsWith("M0,")).toBe(true);
    expect(g.area.endsWith("Z")).toBe(true);
  });

  it("centres a flat line", () => {
    const g = chartGeometry(
      [
        { t: "2026-09-01", v: 50 },
        { t: "2026-09-02", v: 50 },
      ],
      100,
      100,
      { top: 0, bottom: 0 },
    )!;
    expect(g.ys[0]).toBeCloseTo(50);
  });

  it("finds the nearest point", () => {
    expect(nearestIndex([0, 100, 300], 180)).toBe(1);
    expect(nearestIndex([0, 100, 300], 260)).toBe(2);
  });

  it("makes round ticks", () => {
    expect(niceTicks(0, 100, 5)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(niceTicks(8210, 8390, 4)).toEqual([8250, 8300, 8350]);
  });
});

describe("market status", () => {
  const base = {
    metals: { gold: { metal: "gold", usdPerOz: 4000, phpPerGram: 8000, observedAt: "2026-09-30T10:00:00Z", source: "x", change24hPct: null }, silver: null, platinum: null, palladium: null },
    usdPhp: 62,
    fxSource: "y",
    checkedAt: "2026-09-30T10:00:00Z",
    delayed: false,
    marketClosed: false,
    notes: [],
  } as const;

  it("says live, delayed, closed or unavailable", async () => {
    const { marketStatus } = await import("./prices-format");
    expect(marketStatus(base as never).tone).toBe("live");
    expect(marketStatus({ ...base, delayed: true } as never).tone).toBe("delayed");
    expect(marketStatus(base as never, true).tone).toBe("delayed");
    expect(marketStatus({ ...base, marketClosed: true } as never).tone).toBe("closed");
    expect(marketStatus(null).tone).toBe("none");
    expect(marketStatus({ ...base, metals: { gold: null, silver: null, platinum: null, palladium: null } } as never).tone).toBe("none");
  });
});
