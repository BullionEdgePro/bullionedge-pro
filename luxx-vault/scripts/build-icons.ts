/**
 * Favicon and app icons from the chosen monogram.
 *
 *   npm run brand:icons            # uses option c until the owner picks
 *   npm run brand:icons -- a       # or a / b
 *
 * Writes src/app/icon.svg, src/app/apple-icon.png and public/icons/icon-{192,512}.png.
 */
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { MONOGRAMS } from "../src/components/brand/monogram-data";

const choice = (process.argv[2] ?? "c") as "a" | "b" | "c";
const o = MONOGRAMS.find((m) => m.id === choice);
if (!o) throw new Error(`Unknown monogram option: ${choice}`);

function svg(pad: number, radius: number): string {
  const knock = [...(o!.knockouts ?? []), ...(o!.letters.mode === "knockout" ? [o!.letters.l, o!.letters.v] : [])];
  const inner = 120 - pad * 2;
  const s = inner / 120;
  const mask = knock.length
    ? `<mask id="k"><rect width="120" height="120" fill="#fff"/>${knock.map((d) => `<path d="${d}" fill="#000"/>`).join("")}</mask>`
    : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F0DBA6"/><stop offset=".35" stop-color="#D6B26E"/><stop offset=".7" stop-color="#A8823F"/><stop offset="1" stop-color="#D6B26E"/></linearGradient>${mask}</defs>` +
    `<rect width="120" height="120" rx="${radius}" fill="#17101F"/>` +
    `<g transform="translate(${pad} ${pad}) scale(${s})">` +
    `<g fill="url(#g)"${knock.length ? ' mask="url(#k)"' : ""}>` +
    o!.fill.map((d) => `<path d="${d}" fill-rule="evenodd"/>`).join("") +
    (o!.letters.mode === "draw" ? `<path d="${o!.letters.l}"/><path d="${o!.letters.v}"/>` : "") +
    `</g>` +
    o!.strokes.map((st) => `<path d="${st.d}" fill="none" stroke="url(#g)" stroke-width="${st.width}"/>`).join("") +
    o!.accents.map((d) => `<path d="${d}" fill="#BFD8E4"/>`).join("") +
    `</g></svg>\n`
  );
}

async function main() {
  // Favicon: tight padding so the mark reads at 16px.
  await writeFile("src/app/icon.svg", svg(6, 26));
  // App icons: platform masks crop corners, so keep a safe margin and square corners.
  const app = Buffer.from(svg(16, 0));
  await sharp(app, { density: 600 }).resize(180, 180).png().toFile("src/app/apple-icon.png");
  await mkdir("public/icons", { recursive: true });
  for (const size of [192, 512]) {
    await sharp(app, { density: 600 }).resize(size, size).png().toFile(`public/icons/icon-${size}.png`);
  }
  console.log(`Icons written from option ${choice.toUpperCase()} (${o!.name}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
