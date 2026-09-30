/**
 * Cinzel has no peso sign (₱, U+20B1). This builds a one-glyph companion font
 * per weight: Cinzel's own "P" with the two horizontal bars of the peso sign.
 * It's listed first in the display font stack, so the browser takes only ₱
 * from it and everything else from Cinzel.
 *
 *   npm run brand:peso
 *
 * Writes src/fonts/luxx-peso-{400,600,700}.otf (Cinzel is SIL OFL 1.1; the
 * derived glyph is shipped under the same licence, see src/fonts/OFL.txt).
 */
import opentype from "opentype.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const WEIGHTS = [400, 600, 700] as const;

type Cmd = opentype.PathCommand;

/** Signed area of the first contour: > 0 means counter-clockwise (y-up). */
function firstContourArea(cmds: Cmd[]): number {
  const pts: [number, number][] = [];
  for (const c of cmds) {
    if (c.type === "Z") break;
    if ("x" in c) pts.push([c.x, c.y]);
  }
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i]!;
    const [x2, y2] = pts[(i + 1) % pts.length]!;
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

async function build(weight: number) {
  const buf = await readFile(`scripts/fonts/Cinzel-${weight}.ttf`);
  const cinzel = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const p = cinzel.charToGlyph("P");
  const path = p.getPath(0, 0, cinzel.unitsPerEm); // y-down canvas space
  const box = p.getBoundingBox(); // y-up font units
  const cap = box.y2;

  // Bars: across the bowl, from just left of the stem to just past the bowl.
  // Thickness follows the weight so they match Cinzel's thin strokes.
  const thick = { 400: 30, 600: 38, 700: 44 }[weight as 400 | 600 | 700];
  const x1 = box.x1 - 70;
  const x2 = box.x2 + 30;
  const bars = [cap * 0.66, cap * 0.5];

  // Wind the bars the same way as the glyph's outer contour so, under the
  // nonzero rule, bar + stem overlap stays filled instead of cutting a hole.
  // getPath flips y, so orientation there is mirrored relative to font units.
  const outerCCW = firstContourArea(path.commands) > 0;
  const out = new opentype.Path();
  for (const c of path.commands) {
    // Back to y-up font units for the glyph outline.
    if (c.type === "M") out.moveTo(c.x, -c.y);
    else if (c.type === "L") out.lineTo(c.x, -c.y);
    else if (c.type === "Q") out.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
    else if (c.type === "C") out.curveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
    else out.close();
  }
  // Flipping y reverses orientation: a CCW contour in y-down is CW in y-up.
  const outerIsCWInFontUnits = outerCCW;
  for (const yc of bars) {
    const top = yc + thick / 2;
    const bot = yc - thick / 2;
    out.moveTo(x1, bot);
    if (outerIsCWInFontUnits) {
      out.lineTo(x1, top);
      out.lineTo(x2, top);
      out.lineTo(x2, bot);
    } else {
      out.lineTo(x2, bot);
      out.lineTo(x2, top);
      out.lineTo(x1, top);
    }
    out.close();
  }

  const notdef = new opentype.Glyph({ name: ".notdef", unicode: 0, advanceWidth: 600, path: new opentype.Path() });
  const peso = new opentype.Glyph({ name: "peso", unicode: 0x20b1, advanceWidth: p.advanceWidth ?? 630, path: out });
  const font = new opentype.Font({
    familyName: "Luxx Peso",
    styleName: String(weight),
    unitsPerEm: cinzel.unitsPerEm,
    ascender: cinzel.ascender,
    descender: cinzel.descender,
    glyphs: [notdef, peso],
  });
  await writeFile(`src/fonts/luxx-peso-${weight}.otf`, Buffer.from(font.toArrayBuffer()));
}

async function main() {
  await mkdir("src/fonts", { recursive: true });
  for (const w of WEIGHTS) await build(w);
  console.log(`Wrote src/fonts/luxx-peso-{${WEIGHTS.join(",")}}.otf`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
