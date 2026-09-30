/**
 * Builds the three "LV" monogram options from Cinzel glyph outlines
 * (SIL Open Font License — outlines may be used in a logo).
 *
 *   npm run brand:monograms
 *
 * Writes:
 *   src/components/brand/monogram-data.ts   path data used by <Monogram />
 *   public/brand/monogram-{a,b,c}.svg         standalone files (currentColor → gold)
 */
import opentype from "opentype.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const FONT = path.resolve("scripts/fonts/Cinzel-700.ttf");
const round = (n: number) => Math.round(n * 100) / 100;

interface Glyphs {
  l: string;
  v: string;
  box: { x1: number; y1: number; x2: number; y2: number };
}

/**
 * L and V set side by side, never interlocked: an interlocking LV reads as
 * Louis Vuitton's registered monogram. Returned centred on (cx, cy) at the
 * given cap height; `gap` is the space between letters in cap-heights.
 */
function pair(font: opentype.Font, cx: number, cy: number, capHeight: number, gap: number): Glyphs & { mid: number } {
  const unitsCap = font.tables.os2?.sCapHeight || 700;
  const size = (capHeight / unitsCap) * font.unitsPerEm;
  const lBox = font.getPath("L", 0, 0, size).getBoundingBox();
  const vBox0 = font.getPath("V", 0, 0, size).getBoundingBox();
  const vx = lBox.x2 + gap * capHeight - vBox0.x1;
  const x1 = lBox.x1;
  const x2 = vBox0.x2 + vx;
  const y1 = Math.min(lBox.y1, vBox0.y1);
  const y2 = Math.max(lBox.y2, vBox0.y2);
  const dx = cx - (x1 + x2) / 2;
  const dy = cy - (y1 + y2) / 2;
  return {
    l: font.getPath("L", dx, dy, size).toPathData(2),
    v: font.getPath("V", vx + dx, dy, size).toPathData(2),
    box: { x1: round(x1 + dx), y1: round(y1 + dy), x2: round(x2 + dx), y2: round(y2 + dy) },
    mid: round((lBox.x2 + vBox0.x1 + vx) / 2 + dx),
  };
}

interface Option {
  id: "a" | "b" | "c";
  name: string;
  story: string;
  /** Shapes drawn in the mark colour. */
  fill: string[];
  /** Hairline strokes in the mark colour. */
  strokes: { d: string; width: number }[];
  /** Glyph paths; "knockout" letters are cut out of the fill instead of drawn. */
  letters: { l: string; v: string; mode: "draw" | "knockout" };
  /** Accent shapes drawn in the diamond "ice" colour. */
  accents: string[];
}

function octagon(cx: number, cy: number, w: number, h: number, cut: number): string {
  const x = cx - w / 2;
  const y = cy - h / 2;
  const pts = [
    [x + cut, y], [x + w - cut, y], [x + w, y + cut], [x + w, y + h - cut],
    [x + w - cut, y + h], [x + cut, y + h], [x, y + h - cut], [x, y + cut],
  ];
  return "M" + pts.map((p) => p.map(round).join(" ")).join("L") + "Z";
}

function ring(cx: number, cy: number, r: number, width: number): string {
  // Even-odd ring as a single fillable path.
  const o = r;
  const i = r - width;
  return (
    `M${cx - o} ${cy}a${o} ${o} 0 1 0 ${o * 2} 0a${o} ${o} 0 1 0 ${-o * 2} 0Z` +
    `M${cx - i} ${cy}a${i} ${i} 0 1 1 ${i * 2} 0a${i} ${i} 0 1 1 ${-i * 2} 0Z`
  );
}

function ticks(cx: number, cy: number, rOuter: number, count: number): string[] {
  const out: string[] = [];
  for (let k = 0; k < count; k++) {
    if (k === 0) continue; // the top mark is the ice diamond
    const a = (k / count) * Math.PI * 2 - Math.PI / 2;
    const major = k % 6 === 0;
    const len = major ? 7 : 4;
    const w = major ? 1.6 : 0.9;
    const r1 = rOuter;
    const r2 = rOuter - len;
    // A thin quad so ticks render as fills (crisper than strokes at 16px).
    const nx = Math.cos(a + Math.PI / 2) * (w / 2);
    const ny = Math.sin(a + Math.PI / 2) * (w / 2);
    const p1 = [cx + Math.cos(a) * r1 + nx, cy + Math.sin(a) * r1 + ny];
    const p2 = [cx + Math.cos(a) * r1 - nx, cy + Math.sin(a) * r1 - ny];
    const p3 = [cx + Math.cos(a) * r2 - nx, cy + Math.sin(a) * r2 - ny];
    const p4 = [cx + Math.cos(a) * r2 + nx, cy + Math.sin(a) * r2 + ny];
    out.push("M" + [p1, p2, p3, p4].map((p) => p.map(round).join(" ")).join("L") + "Z");
  }
  return out;
}

function diamond(cx: number, cy: number, w: number, h: number): string {
  return `M${cx} ${cy - h / 2}L${cx + w / 2} ${cy}L${cx} ${cy + h / 2}L${cx - w / 2} ${cy}Z`;
}

async function main() {
  const buf = await readFile(FONT);
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

  // A — Hallmark: clipped-corner cartouche like an assay punch, double rule.
  const a = pair(font, 60, 60, 40, 0.3);
  const optionA: Option = {
    id: "a",
    name: "Hallmark",
    story: "Shaped like the assay stamp struck into genuine gold, with a diamond set between the letters. The mark of something tested and true.",
    fill: [],
    strokes: [
      { d: octagon(60, 60, 108, 108, 22), width: 3.2 },
      { d: octagon(60, 60, 98, 98, 18), width: 0.9 },
    ],
    letters: { l: a.l, v: a.v, mode: "draw" },
    accents: [diamond(a.mid, 60, 5, 7)],
  };

  // B — Karat dial: vault combination dial with 24 ticks (24 karat).
  const b = pair(font, 60, 60, 30, 0.06);
  const optionB: Option = {
    id: "b",
    name: "Karat dial",
    story: "A vault dial with 24 marks, one for each karat. The diamond at the top marks pure 24K.",
    fill: [ring(60, 60, 57, 2.6)],
    strokes: [{ d: `M${60 - 38} 60a38 38 0 1 0 76 0a38 38 0 1 0 -76 0Z`, width: 0.9 }],
    letters: { l: b.l, v: b.v, mode: "draw" },
    accents: [diamond(60, 13, 6, 8), ...[]],
  };
  optionB.fill.push(...ticks(60, 60, 51, 24));

  // C — Ingot: cast-bar silhouette with the letters cut out of the metal.
  const c = pair(font, 60, 71, 32, 0.05);
  const bar = "M24 32L96 32L112 96L8 96Z";
  const topFace = "M29.5 37L90.5 37L92 42.5L28 42.5Z";
  const optionC: Option = {
    id: "c",
    name: "Ingot",
    story: "A cast gold bar with the monogram struck through it. It matches the 3D hero bar and stays legible as a 16px favicon.",
    fill: [bar],
    strokes: [],
    letters: { l: c.l, v: c.v, mode: "knockout" },
    accents: [],
  };
  // The bevelled top face is knocked out as a hairline for depth.
  (optionC as Option & { knockouts?: string[] }).knockouts = [topFace];

  const options = [optionA, optionB, optionC];

  await mkdir("src/components/brand", { recursive: true });
  await writeFile(
    "src/components/brand/monogram-data.ts",
    `// Generated by scripts/build-monograms.ts — do not edit by hand.\n` +
      `// Glyph outlines: Cinzel (SIL Open Font License 1.1).\n\n` +
      `export interface MonogramOption {\n  id: "a" | "b" | "c";\n  name: string;\n  story: string;\n  fill: string[];\n  strokes: { d: string; width: number }[];\n  letters: { l: string; v: string; mode: "draw" | "knockout" };\n  accents: string[];\n  knockouts?: string[];\n}\n\n` +
      `export const MONOGRAMS: readonly MonogramOption[] = ${JSON.stringify(options, null, 2)} as const;\n`,
  );

  await mkdir("public/brand", { recursive: true });
  for (const o of options) {
    await writeFile(`public/brand/monogram-${o.id}.svg`, toSvg(o, { color: "#D6B26E", accent: "#BFD8E4" }));
  }
  console.log("Wrote src/components/brand/monogram-data.ts and public/brand/monogram-{a,b,c}.svg");
}

function toSvg(o: Option & { knockouts?: string[] }, colors: { color: string; accent: string; background?: string }): string {
  const bg = colors.background ? `<rect width="120" height="120" rx="24" fill="${colors.background}"/>` : "";
  const letters = o.letters.mode === "draw" ? `<path d="${o.letters.l}"/><path d="${o.letters.v}"/>` : "";
  const knock = [...(o.knockouts ?? []), ...(o.letters.mode === "knockout" ? [o.letters.l, o.letters.v] : [])];
  const mask = knock.length
    ? `<defs><mask id="k-${o.id}"><rect width="120" height="120" fill="#fff"/>${knock.map((d) => `<path d="${d}" fill="#000"/>`).join("")}</mask></defs>`
    : "";
  const fills = o.fill.map((d) => `<path d="${d}" fill-rule="evenodd"/>`).join("");
  const strokes = o.strokes.map((s) => `<path d="${s.d}" fill="none" stroke="${colors.color}" stroke-width="${s.width}"/>`).join("");
  const accents = o.accents.map((d) => `<path d="${d}" fill="${colors.accent}"/>`).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="Luxx Vault monogram — ${o.name}">` +
    mask +
    bg +
    `<g fill="${colors.color}"${knock.length ? ` mask="url(#k-${o.id})"` : ""}>${fills}${letters}</g>` +
    strokes +
    accents +
    `</svg>\n`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
