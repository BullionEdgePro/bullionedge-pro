import { describe, expect, it } from "vitest";
import { contrastRatio, passesAA } from "@/lib/contrast";
import { onGold, pairings, palette, themes } from "./tokens";

describe("colour tokens meet WCAG AA", () => {
  for (const mode of ["light", "dark"] as const) {
    for (const p of pairings) {
      const fg = themes[mode][p.fg];
      const bg = themes[mode][p.bg];
      it(`${mode}: ${p.fg} on ${p.bg} (${p.use})`, () => {
        expect(passesAA(fg, bg, p.use), `${fg} on ${bg} = ${contrastRatio(fg, bg).toFixed(2)}`).toBe(true);
      });
    }
  }

  it("velvet text on both ends of the gold button gradient", () => {
    for (const bg of onGold.bgs) expect(passesAA(onGold.fg, bg, "text")).toBe(true);
  });

  it("documents why derived shades exist", () => {
    expect(passesAA(palette.bullion, palette.pearl, "text")).toBe(false);
    expect(passesAA(palette.champagne, palette.pearl, "large")).toBe(false);
    expect(passesAA(palette.ice, palette.pearl, "ui")).toBe(false);
  });
});

describe("contrastRatio", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
  });
});
