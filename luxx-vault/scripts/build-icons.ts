/**
 * Favicon, app icons and downloadable logo files from the Luxx4less emblem.
 *
 *   npm run brand:icons
 *
 * Writes:
 *   src/app/icon.svg, src/app/apple-icon.png, public/icons/icon-{192,512}.png
 *   public/brand/luxx4less-*.svg (and a PNG of the stacked logo for social posts)
 */
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { emblemSvg, lockupSvg } from "../src/components/brand/logo-svg";

const VELVET = "#17101F";

async function main() {
  // Favicon: the small-size emblem on velvet with rounded corners.
  await writeFile("src/app/icon.svg", emblemSvg({ id: "fav", detail: "simple", background: VELVET, backgroundRadius: 40 }));

  // App icons: platform masks crop corners, so square corners and a safe margin.
  const app = Buffer.from(emblemSvg({ id: "app", detail: "full", background: VELVET, inset: 22 }));
  await sharp(app, { density: 600 }).resize(180, 180).png().toFile("src/app/apple-icon.png");
  await mkdir("public/icons", { recursive: true });
  for (const size of [192, 512]) {
    await sharp(app, { density: 600 }).resize(size, size).png().toFile(`public/icons/icon-${size}.png`);
  }

  // Logo files for the owner, printers and social media.
  await mkdir("public/brand", { recursive: true });
  const files: Record<string, string> = {
    "luxx4less-emblem.svg": emblemSvg({ id: "e", detail: "full" }),
    "luxx4less-emblem-foil.svg": emblemSvg({ id: "f", detail: "full", frame: "foil" }),
    "luxx4less-emblem-small.svg": emblemSvg({ id: "s", detail: "simple" }),
    "luxx4less-emblem-white.svg": emblemSvg({ id: "w", detail: "mono", color: "#FFFFFF" }),
    "luxx4less-emblem-black.svg": emblemSvg({ id: "k", detail: "mono", color: "#1C1A22" }),
    "luxx4less-logo-stacked.svg": lockupSvg({ id: "ls", detail: "full", layout: "stacked" }),
    "luxx4less-logo-horizontal.svg": lockupSvg({ id: "lh", detail: "full", layout: "horizontal" }),
    "luxx4less-logo-stacked-on-black.svg": lockupSvg({ id: "lb", detail: "full", layout: "stacked", background: "#000000" }),
  };
  for (const [name, svg] of Object.entries(files)) await writeFile(`public/brand/${name}`, svg);
  await sharp(Buffer.from(files["luxx4less-logo-stacked-on-black.svg"]!), { density: 600 })
    .resize(1080)
    .png()
    .toFile("public/brand/luxx4less-logo-stacked-1080.png");

  console.log(`Icons and ${Object.keys(files).length + 1} logo files written.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
