import { IMAGE_QUALITY } from "@/config/kyc";

/**
 * On-device photo checks for the ID capture (brief §8: glare and blur
 * detection). Pure pixel maths on RGBA buffers from a canvas, so it runs in
 * the browser with no library and is unit-tested in Node. Nothing here leaves
 * the device; only the resulting numbers are sent with the application.
 */

export type Pixels = { data: Uint8ClampedArray; width: number; height: number };

/** Rec. 601 luma, 0–255. */
export function toGray({ data, width, height }: Pixels): Float32Array {
  const out = new Float32Array(width * height);
  for (let i = 0, p = 0; p < out.length; i += 4, p++) out[p] = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
  return out;
}

/**
 * Sharpness as the variance of the Laplacian (4-neighbour kernel). Edges in a
 * focused photo give strong second derivatives; a soft photo gives almost none.
 * Only meaningful at a fixed working size (the capture scales to 640px wide).
 */
export function laplacianVariance(gray: Float32Array, width: number, height: number): number {
  if (width < 3 || height < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const v = gray[i - width]! + gray[i + width]! + gray[i - 1]! + gray[i + 1]! - 4 * gray[i]!;
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/** Share of pixels blown out to near-white on every channel: reflections off laminated cards. */
export function glareRatio({ data }: Pixels): number {
  let blown = 0;
  const total = data.length / 4;
  for (let i = 0; i < data.length; i += 4) if (data[i]! >= 250 && data[i + 1]! >= 250 && data[i + 2]! >= 250) blown++;
  return total ? blown / total : 0;
}

export function meanBrightness(gray: Float32Array): number {
  let s = 0;
  for (const v of gray) s += v;
  return gray.length ? s / gray.length : 0;
}

export type QualityProblem = "blurry" | "glare" | "dark";
export type QualityReport = { sharpness: number; glare: number; brightness: number; problems: QualityProblem[]; ok: boolean };

export function assessImage(pixels: Pixels): QualityReport {
  const gray = toGray(pixels);
  const sharpness = laplacianVariance(gray, pixels.width, pixels.height);
  const glare = glareRatio(pixels);
  const brightness = meanBrightness(gray);
  const problems: QualityProblem[] = [];
  if (sharpness < IMAGE_QUALITY.minSharpness) problems.push("blurry");
  if (glare > IMAGE_QUALITY.maxGlare) problems.push("glare");
  if (brightness < 45) problems.push("dark");
  return { sharpness: Math.round(sharpness * 10) / 10, glare: Math.round(glare * 10_000) / 10_000, brightness: Math.round(brightness), problems, ok: problems.length === 0 };
}

export const PROBLEM_ADVICE: Record<QualityProblem, string> = {
  blurry: "The photo is a little soft. Hold the ID steady, let the camera focus, and try again.",
  glare: "A reflection is covering part of the ID. Tilt it slightly away from the light.",
  dark: "It's too dark to read. Move somewhere brighter.",
};

/**
 * Mean absolute difference between two same-sized greyscale frames (0–255).
 * The liveness prompts use it to confirm the face actually moved between a
 * neutral frame and a "turn" or "blink" frame. A heuristic, not a certified
 * liveness test: the real vendor does that in live mode.
 */
export function frameDifference(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || !a.length) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i]! - b[i]!);
  return s / a.length;
}

/** Minimum frame difference that counts as movement for a prompt. */
export const MOVEMENT_THRESHOLD = { turn: 6, blink: 1.2 } as const;
