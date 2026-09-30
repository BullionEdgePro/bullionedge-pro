/**
 * Builds a shareable, self-contained review preview of the Phase 1 pages.
 *
 *   PREVIEW_EXPORT=1 npx next build --webpack
 *   npx tsx scripts/build-preview.ts
 *
 * Takes the static export in out/ and writes preview/{design-system,hero}.html,
 * each a single file with every script, stylesheet, font and image inlined, so
 * it works from any host path (the claude.ai artifact preview included).
 * preview/index.html is the landing page that links to both.
 *
 * Webpack (not Turbopack) because its chunk registry is a plain array: chunks
 * pushed inline before the runtime starts count as installed, so the 3D scene's
 * dynamic import resolves without fetching anything.
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = "out";
const DEST = "preview";

const MIME: Record<string, string> = {
  ".woff2": "font/woff2",
  ".otf": "font/otf",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

async function dataUri(file: string): Promise<string> {
  const type = MIME[path.extname(file)] ?? "application/octet-stream";
  return `data:${type};base64,${(await readFile(file)).toString("base64")}`;
}

/**
 * The chunks one page needs, in load order: the ones its HTML lists, then the
 * on-demand chunks (three.js, GSAP, Lenis), then the webpack runtime last so it
 * adopts everything pushed before it. Each becomes its own <script>, so every
 * chunk keeps its own strictness (a leading "use strict" in one would otherwise
 * make the rest strict and break Next's `_N_E = …` assignments) and a failure
 * in one can't stop the others.
 */
async function chunkScripts(html: string): Promise<string[]> {
  const listed = [...html.matchAll(/<script src="(\/_next\/static\/chunks\/[^"]+\.js)"[^>]*>/g)]
    .map((m) => m[1]!)
    .filter((src) => !path.basename(src).startsWith("polyfills-")); // nomodule, legacy browsers only
  const onDemand = (await readdir(path.join(OUT, "_next/static/chunks")))
    .filter((f) => /^[0-9a-f]+\.[0-9a-f]+\.js$/.test(f))
    .map((f) => `/_next/static/chunks/${f}`);
  const isRuntime = (src: string) => path.basename(src).startsWith("webpack-");
  const order = [...listed.filter((s) => !isRuntime(s)), ...onDemand, ...listed.filter(isRuntime)];
  return Promise.all([...new Set(order)].map((src) => readFile(path.join(OUT, src), "utf8")));
}

/**
 * Next's app bootstrap derives its asset prefix from document.currentScript.src
 * and throws if the running script has no URL containing /_next/. Inline
 * scripts have none, so while one runs, report a detached stand-in whose src
 * sits at the site root (asset prefix ""). Detached scripts are never fetched.
 */
const CURRENT_SCRIPT_SHIM = `(function(){var d=Object.getOwnPropertyDescriptor(Document.prototype,"currentScript");if(!d||!d.get)return;var f=document.createElement("script");f.src=location.origin+"/_next/static/chunks/inline.js";Object.defineProperty(document,"currentScript",{configurable:true,get:function(){var s=d.get.call(document);return s&&!s.src?f:s}})})();`;

async function inlineCss(html: string): Promise<string> {
  const links = [...html.matchAll(/<link rel="stylesheet" href="(\/_next\/static\/css\/[^"]+)"[^>]*\/?>/g)];
  for (const m of links) {
    let css = await readFile(path.join(OUT, m[1]!), "utf8");
    for (const u of [...new Set([...css.matchAll(/url\((\/_next\/static\/media\/[^)]+)\)/g)].map((x) => x[1]!))]) {
      css = css.split(`url(${u})`).join(`url(${await dataUri(path.join(OUT, u))})`);
    }
    // Keep the <link> too: React's payload references it, and finding it already
    // in the document stops React from re-inserting it and waiting on the load.
    html = html.replace(m[0], () => `${m[0]}<style>${css}</style>`);
  }
  return html;
}

/** Internal routes → sibling preview files, in markup and in the escaped RSC payload alike. */
function relink(s: string): string {
  return s
    .replace(/\/design-system\/hero(?=["\\?#])/g, "hero.html")
    .replace(/\/design-system(?=["\\?#])/g, "design-system.html");
}

async function build(page: string, outName: string, assets: Record<string, string>) {
  let html = await readFile(path.join(OUT, page), "utf8");
  const chunks = await chunkScripts(html);
  html = await inlineCss(html);
  html = html
    .replace(/<link rel="preload"[^>]*\/?>/g, "")
    .replace(/<script src="[^"]*"[^>]*><\/script>/g, "")
    .replace(/<link rel="(icon|apple-touch-icon)" href="\/(icon\.svg|apple-icon\.png)[^"]*"/g, (_m, rel, file) => `<link rel="${rel}" href="${assets[`/${file}`]}"`);
  html = relink(html);
  // Drop font/stylesheet preload hints from the RSC payload (the files are
  // inlined; the hints would only fire requests for paths that don't exist here).
  html = html.replace(/:HL\[\\"\/_next\/static\/[^\n]*?\]\\n/g, "");
  html = html.replace(/\/(icon\.svg|apple-icon\.png)\?[0-9a-f]+/g, "/$1"); // cache-busting suffix would corrupt a data: URI
  for (const [from, to] of Object.entries(assets)) html = html.split(from).join(to);
  const scripts = chunks
    .map((js) => {
      for (const [from, to] of Object.entries(assets)) js = js.split(from).join(to);
      return `<script>${js.replace(/<\/script/gi, "<\\/script")}</script>`;
    })
    .join("");
  html = html.replace("</body>", () => `<script>${CURRENT_SCRIPT_SHIM}</script>${scripts}</body>`);
  await writeFile(path.join(DEST, outName), html);
  console.log(`✓ ${DEST}/${outName}  ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB`);
}

async function main() {
  await mkdir(DEST, { recursive: true });
  const assets = {
    "/brand/gold-bar-poster.webp": await dataUri(path.join(OUT, "brand/gold-bar-poster.webp")),
    "/icon.svg": await dataUri(path.join(OUT, "icon.svg")),
    "/apple-icon.png": await dataUri(path.join(OUT, "apple-icon.png")),
  };
  await build("design-system.html", "design-system.html", assets);
  await build("design-system/hero.html", "hero.html", assets);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
