/**
 * Rebuilds the Luxx4less logo (from the owner's Facebook profile picture) as
 * vector geometry: the frame, the bevelled L with its diamond channel, and the
 * wordmark as outlines.
 *
 *   npm run brand:logo
 *
 * Frame proportions were measured from the original (447px) logo:
 *   - an upright square and a 45° diamond of the same size form an eight-point star
 *   - two concentric regular octagons (flat top) sit between them
 *   - one line weight throughout, flat peach gold (#E8BA88)
 * The L is Bodoni Moda (opsz 11, Black; SIL OFL): a heavy high-contrast Didone
 * with a curved beak on the foot, like the original. Wordmark: Cinzel (SIL OFL),
 * read with fontkit — opentype.js returns NaN for a point in Cinzel's X.
 *
 * Writes src/components/brand/logo-data.ts.
 */
import * as fontkit from "fontkit";
import opentype from "opentype.js";
import { readFile, writeFile } from "node:fs/promises";

const r = (n: number) => Math.round(n * 100) / 100;

async function load(file: string) {
  const b = await readFile(file);
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

function octagon(c: number, apothem: number): string {
  const R = apothem / Math.cos(Math.PI / 8);
  const pts = Array.from({ length: 8 }, (_, i) => {
    const a = Math.PI / 8 + (i * Math.PI) / 4; // flat top and sides
    return `${r(c + R * Math.cos(a))} ${r(c + R * Math.sin(a))}`;
  });
  return `M${pts.join("L")}Z`;
}

/** A line of text as one SVG path (y-down, baseline at 0) plus its bounding box. */
function textPath(file: string, text: string, size: number) {
  const font = fontkit.openSync(file) as fontkit.Font;
  const k = size / font.unitsPerEm;
  const run = font.layout(text);
  let d = "";
  let x = 0;
  const box = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
  run.glyphs.forEach((g, i) => {
    const p = g.path.scale(k, -k).translate(x, 0);
    d += p.toSVG();
    const b = p.bbox;
    box.x1 = Math.min(box.x1, b.minX);
    box.y1 = Math.min(box.y1, b.minY);
    box.x2 = Math.max(box.x2, b.maxX);
    box.y2 = Math.max(box.y2, b.maxY);
    x += run.positions[i]!.xAdvance * k;
  });
  if (d.includes("NaN")) throw new Error(`Bad outline for "${text}"`);
  return { d, box: { x1: r(box.x1), y1: r(box.y1), x2: r(box.x2), y2: r(box.y2) } };
}

async function main() {
  const bodoni = await load("scripts/fonts/BodoniModa-11-Black.ttf");

  // ---- Frame (200 × 200 box, centre 100). Measured ratios × 0.24 from a 960px zoom.
  const C = 100;
  const frame = {
    stroke: 2.8,
    square: `M${C - 68.5} ${C - 68.5}H${C + 68.5}V${C + 68.5}H${C - 68.5}Z`,
    diamond: `M${C} ${C - 96}L${C + 96} ${C}L${C} ${C + 96}L${C - 96} ${C}Z`,
    octagonOuter: octagon(C, 86.5),
    octagonInner: octagon(C, 77),
  };

  // ---- The L. Font units are y-up; getPath() returns y-down SVG space.
  const glyph = bodoni.charToGlyph("L");
  const box = glyph.getBoundingBox(); // x 29..1280, y 0..1500 at opsz 11 Black
  const cap = box.y2 - box.y1;
  const capPx = 94; // cap height in the 200 box, from the original's proportions
  const s = capPx / cap;
  const cx = (box.x1 + box.x2) / 2;
  const x0 = C - cx * s + 1.5; // optical nudge right: the beak makes the L look left-heavy
  const baseline = C + (cap / 2) * s;
  const L = glyph.getPath(x0, baseline, s * bodoni.unitsPerEm).toPathData(2);
  const X = (ux: number) => r(x0 + ux * s);
  const Y = (uy: number) => r(baseline - uy * s);

  // Stem runs x 210..640 (units). The diamond channel sits inside it with gold
  // showing on both sides, as on the original.
  const stem = { x1: 210, x2: 640 };
  const mid = (stem.x1 + stem.x2) / 2;
  const inset = 62;
  const channel = { x: X(stem.x1 + inset), y: Y(1400), w: r((stem.x2 - stem.x1 - inset * 2) * s), h: r((1400 - 100) * s) };

  // Stones: large brilliants with pairs of small ones, like the original's pavé.
  const stones: { cx: number; cy: number; r: number; glint?: boolean }[] = [];
  const big = (uy: number, d: number, glint = false) => stones.push({ cx: X(mid), cy: Y(uy), r: r((d / 2) * s), glint });
  const pair = (uy: number, d: number) => {
    stones.push({ cx: X(mid - d / 2 - 4), cy: Y(uy), r: r((d / 2) * s) });
    stones.push({ cx: X(mid + d / 2 + 4), cy: Y(uy), r: r((d / 2) * s) });
  };
  big(1262, 244, true);
  pair(1080, 122);
  big(898, 244);
  big(688, 244);
  pair(500, 122);
  big(292, 262, true);
  // One stone set where the foot turns up into the beak.
  const footStone = { cx: X(1190), cy: Y(112), r: r(56 * s) };

  // ---- Wordmark outlines (for standalone SVG files; the site renders live text).
  const word = textPath("scripts/fonts/Cinzel-600.ttf", "LUXX4LESS", 100);
  const tag = textPath("scripts/fonts/Cinzel-400.ttf", "GOLDS AND DIAMONDS JEWELRIES", 100);

  const data = {
    viewBox: "0 0 200 200",
    frame,
    L,
    channel,
    stones,
    footStone,
    wordmark: word,
    tagline: tag,
  };

  await writeFile(
    "src/components/brand/logo-data.ts",
    `// Generated by scripts/build-logo.ts — do not edit by hand.\n` +
      `// Luxx4less logo geometry. L: Bodoni Moda; wordmark: Cinzel (both SIL OFL 1.1).\n\n` +
      `export const LOGO = ${JSON.stringify(data, null, 2)} as const;\n`,
  );
  console.log("Wrote src/components/brand/logo-data.ts");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
