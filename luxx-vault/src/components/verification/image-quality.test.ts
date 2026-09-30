import { describe, expect, it } from "vitest";
import { assessImage, frameDifference, glareRatio, laplacianVariance, toGray, type Pixels } from "./image-quality";

function image(width: number, height: number, fill: (x: number, y: number) => [number, number, number]): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fill(x, y);
      const i = (y * width + x) * 4;
      data.set([r, g, b, 255], i);
    }
  return { data, width, height };
}

// Crisp black text-like stripes on a mid-grey card vs. a smooth gradient (what blur leaves behind).
const sharp = image(64, 40, (x, y) => ((x >> 2) + (y >> 2)) % 2 ? [30, 30, 30] : [180, 170, 160]);
const soft = image(64, 40, (x) => [100 + x, 100 + x, 100 + x]);

describe("sharpness", () => {
  it("scores crisp edges far above a smooth image", () => {
    const a = laplacianVariance(toGray(sharp), sharp.width, sharp.height);
    const b = laplacianVariance(toGray(soft), soft.width, soft.height);
    expect(a).toBeGreaterThan(1000);
    expect(b).toBeLessThan(1);
  });
  it("flags a soft photo as blurry", () => expect(assessImage(soft).problems).toContain("blurry"));
  it("passes a crisp, evenly lit photo", () => expect(assessImage(sharp)).toMatchObject({ ok: true, problems: [] }));
});

describe("glare", () => {
  it("measures the share of blown-out pixels", () => {
    const half = image(10, 10, (x) => (x < 5 ? [255, 255, 255] : [120, 120, 120]));
    expect(glareRatio(half)).toBeCloseTo(0.5);
  });
  it("flags a reflection covering the card", () => {
    const shiny = image(64, 40, (x, y) => (x > 40 && y < 20 ? [255, 255, 255] : ((x >> 2) + (y >> 2)) % 2 ? [30, 30, 30] : [180, 170, 160]));
    expect(assessImage(shiny).problems).toContain("glare");
  });
});

describe("darkness", () => {
  it("flags an underexposed photo", () => {
    const dark = image(64, 40, (x, y) => ((x >> 2) + (y >> 2)) % 2 ? [5, 5, 5] : [40, 40, 40]);
    expect(assessImage(dark).problems).toContain("dark");
  });
});

describe("frameDifference", () => {
  it("is zero for identical frames and grows with change", () => {
    const g = toGray(sharp);
    expect(frameDifference(g, g)).toBe(0);
    expect(frameDifference(g, toGray(soft))).toBeGreaterThan(10);
  });
  it("refuses frames of different sizes", () => expect(frameDifference(new Float32Array(4), new Float32Array(5))).toBe(0));
});
