import { describe, expect, it } from "vitest";
import { COMMON_STAMPS, DOES_NOT_PROVE, decodeHallmarks, normaliseMarkText, tokenise } from "./hallmarks";

const one = (text: string, colour?: "yellow" | "white" | "unknown") => decodeHallmarks(text, colour);

describe("gold fineness numbers", () => {
  it.each([
    ["916", 22, 0.916],
    ["875", 21, 0.875],
    ["833", 20, 0.833],
    ["750", 18, 0.75],
    ["585", 14, 0.585],
    ["417", 10, 0.417],
    ["375", 9, 0.375],
    ["333", 8, 0.333],
  ])("%s is %iK gold", (mark, karat, purity) => {
    const d = one(mark);
    expect(d.reading).toEqual({ metal: "gold", purity, karat });
    expect(d.plated).toBe(false);
  });

  it("treats 999 / 995 / 990 as ambiguous until the colour is known", () => {
    expect(one("999").reading).toBeNull();
    expect(one("999").summary).toMatch(/colour/);
    expect(one("999", "yellow").reading).toEqual({ metal: "gold", purity: 0.999, karat: 24 });
    expect(one("999", "white").reading?.metal).toBe("silver");
    expect(one("995", "yellow").reading?.purity).toBe(0.995);
    expect(one("990", "yellow").reading?.purity).toBe(0.99);
  });

  it("reads 999.9 and 9999 as four nines", () => {
    expect(one("999.9", "yellow").reading).toEqual({ metal: "gold", purity: 0.9999, karat: 24 });
    expect(one("9999", "yellow").marks[0]!.title).toContain("999.9");
  });
});

describe("silver, platinum, palladium", () => {
  it.each([
    ["999", 0.999],
    ["958", 0.958],
    ["925", 0.925],
    ["900", 0.9],
    ["800", 0.8],
  ])("%s on a white piece reads as silver", (mark, purity) => {
    const d = one(mark, "white");
    expect(d.marks[0]!.readings.some((r) => r.metal === "silver" && r.purity === purity)).toBe(true);
  });

  it("reads sterling words and S925", () => {
    expect(one("Sterling").reading).toEqual({ metal: "silver", purity: 0.925 });
    expect(one("S925").reading).toEqual({ metal: "silver", purity: 0.925 });
    expect(one("925S").reading).toEqual({ metal: "silver", purity: 0.925 });
  });

  it.each([
    ["Pt999", "platinum", 0.999],
    ["Pt950", "platinum", 0.95],
    ["PT900", "platinum", 0.9],
    ["Pt 850", "platinum", 0.85],
    ["Pd950", "palladium", 0.95],
    ["Pd500", "palladium", 0.5],
  ])("%s", (mark, metal, purity) => {
    expect(one(mark).reading).toEqual({ metal, purity });
  });

  it("flags a bare 950 as ambiguous", () => {
    const d = one("950");
    expect(d.marks[0]!.readings.map((r) => r.metal)).toEqual(["platinum", "palladium", "silver"]);
    expect(d.reading).toBeNull();
  });
});

describe("karat marks", () => {
  it.each([
    ["24K", 24, 0.999],
    ["22K", 22, 0.916],
    ["21K", 21, 0.875],
    ["18K", 18, 0.75],
    ["14K", 14, 0.585],
    ["10K", 10, 0.417],
    ["9K", 9, 0.375],
    ["18KT", 18, 0.75],
    ["18 kt", 18, 0.75],
    ["18ct", 18, 0.75],
    ["K18", 18, 0.75],
    ["K24", 24, 0.999],
    ["K 18", 18, 0.75],
    ["14KP", 14, 0.585],
  ])("%s", (mark, karat, purity) => {
    expect(one(mark).reading).toEqual({ metal: "gold", purity, karat });
  });

  it("explains the Japanese K-first style", () => {
    const d = one("K18");
    expect(d.marks[0]!.notes.join(" ")).toMatch(/Japan/);
    expect(d.context.join(" ")).toMatch(/Japan gold/);
  });

  it("rejects impossible karats", () => {
    expect(one("30K").reading).toBeNull();
    expect(one("30K").marks[0]!.kind).toBe("unknown");
  });

  it("reads a bare Saudi-style karat, in Arabic numerals too", () => {
    expect(one("21").reading).toEqual({ metal: "gold", purity: 0.875, karat: 21 });
    const arabic = one("٢١ ٨٧٥");
    expect(arabic.reading).toEqual({ metal: "gold", purity: 0.875, karat: 21 });
    expect(arabic.context.join(" ")).toMatch(/Saudi/);
  });
});

describe("Chinese and Hong Kong marks", () => {
  it("足金 is at least 99.0% gold (chuk kam)", () => {
    const d = one("足金");
    expect(d.reading).toEqual({ metal: "gold", purity: 0.99, karat: 24 });
    expect(d.marks[0]!.title).toMatch(/chuk kam/);
    expect(d.context.join(" ")).toMatch(/Hong Kong/);
  });

  it("千足金 is at least 99.9%", () => {
    expect(one("千足金").reading?.purity).toBe(0.999);
  });

  it("splits run-together marks and agrees 足金999.9 is 24K without a disagreement warning", () => {
    expect(tokenise("足金999.9")).toEqual(["足金", "999.9"]);
    const d = one("足金999.9");
    expect(d.reading).toMatchObject({ metal: "gold", karat: 24 });
    expect(d.warnings).toEqual([]);
  });

  it("reads Au750 and 18K金", () => {
    expect(one("Au750").reading).toEqual({ metal: "gold", purity: 0.75, karat: 18 });
    expect(one("18K金").reading).toEqual({ metal: "gold", purity: 0.75, karat: 18 });
  });
});

describe("plated, filled and gilded", () => {
  it.each(["GP", "GEP", "HGE", "HGP", "RGP", "GF", "G.F."])("%s is not solid gold", (mark) => {
    const d = one(mark);
    expect(d.plated).toBe(true);
    expect(d.reading).toBeNull();
    expect(d.warnings.length).toBeGreaterThan(0);
  });

  it("18K GP: the karat describes the plating", () => {
    expect(tokenise("18K GP")).toEqual(["18K_GP"]);
    const d = one("18K GP");
    expect(d.plated).toBe(true);
    expect(d.marks[0]!.title).toBe("18K GP · gold plated");
    expect(d.summary).toMatch(/not solid gold/);
  });

  it("18K with a separate HGE token is still plated", () => {
    const d = one("18K HGE");
    expect(d.plated).toBe(true);
    expect(d.reading).toBeNull();
  });

  it("1/20 12K GF works out the real gold share", () => {
    const d = one("1/20 12K GF");
    expect(d.marks).toHaveLength(1);
    expect(d.marks[0]!.kind).toBe("filled");
    expect(d.marks[0]!.meaning).toMatch(/2\.5% gold/);
    expect(d.plated).toBe(true);
  });

  it("vermeil is gilded silver", () => {
    const d = one("vermeil 925");
    expect(d.plated).toBe(true);
    expect(d.warnings.join(" ")).toMatch(/gilded silver/);
  });

  it("925 on a gold-coloured piece is gilded silver, not gold", () => {
    const d = one("925", "yellow");
    expect(d.plated).toBe(true);
    expect(d.warnings.join(" ")).toMatch(/gilded silver/);
    expect(d.reading).toBeNull();
  });
});

describe("Italian marks", () => {
  it("decodes star + maker number + province beside 750", () => {
    const d = one("750 ★ 1234 AR");
    expect(d.reading).toEqual({ metal: "gold", purity: 0.75, karat: 18 });
    const titles = d.marks.map((m) => m.title).join(" | ");
    expect(titles).toMatch(/star/);
    expect(titles).toMatch(/maker's number/);
    expect(titles).toMatch(/Arezzo/);
    expect(d.context.join(" ")).toMatch(/Italian gold/);
  });

  it("accepts the maker number and province written together, and * for the star", () => {
    const d = one("750 * 123VI");
    expect(d.marks.some((m) => /Vicenza/.test(m.title))).toBe(true);
  });
});

describe("the whole piece", () => {
  it("warns when marks claim different purities, and values at the lowest", () => {
    const d = one("18K 585");
    expect(d.warnings.join(" ")).toMatch(/different purities/);
    expect(d.reading?.purity).toBe(0.585);
  });

  it("treats letters as a maker's mark", () => {
    const d = one("750 LUXX");
    expect(d.marks[1]!.kind).toBe("maker");
    expect(d.reading?.karat).toBe(18);
  });

  it("says nothing states purity when only a maker's mark is given", () => {
    expect(one("ABC").summary).toMatch(/None of these marks states a purity/);
  });

  it("always carries what a stamp does not prove", () => {
    expect(one("750").doesNotProve).toBe(DOES_NOT_PROVE);
    expect(DOES_NOT_PROVE.join(" ")).toMatch(/genuine/);
  });

  it("handles empty input", () => {
    expect(one("").marks).toEqual([]);
    expect(one("   ").summary).toMatch(/Type or tap/);
  });

  it("decodes every one-tap stamp without an 'unknown'", () => {
    for (const s of COMMON_STAMPS) {
      const d = one(s);
      expect(d.marks.every((m) => m.kind !== "unknown"), s).toBe(true);
    }
  });
});

describe("normaliseMarkText", () => {
  it("maps Arabic-Indic, Persian and full-width digits, and star variants", () => {
    expect(normaliseMarkText("٨٧٥")).toBe("875");
    expect(normaliseMarkText("۷۵۰")).toBe("750");
    expect(normaliseMarkText("７５０")).toBe("750");
    expect(normaliseMarkText("☆")).toBe("★");
  });
});
