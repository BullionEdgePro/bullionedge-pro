/**
 * Renders review screenshots and the hero's still fallback from a running app.
 *
 *   npm run build && npm start      # in one terminal
 *   npm run screenshots             # in another (BASE_URL defaults to http://localhost:3000)
 *
 * Writes:
 *   public/brand/gold-bar-poster.webp        still bar for reduced-motion / low-end devices
 *   docs/screenshots/phase-1/*.png           checkpoint screenshots
 */
import { chromium, type Browser } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve("docs/screenshots/phase-1");
const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900, mobile: false },
  { name: "390", width: 390, height: 844, mobile: true },
] as const;

async function launch(): Promise<Browser> {
  return chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    // Software WebGL so the 3D bar renders on machines without a GPU (CI, cloud).
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
}

async function renderPoster(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/design-system/bar-render`, { waitUntil: "networkidle" });
  await page.waitForSelector("#bar-stage[data-ready]", { timeout: 30_000 });
  await page.waitForTimeout(2500); // let the bar ease into its resting pose
  const png = await page.screenshot({ omitBackground: true });
  await sharp(png).trim().webp({ quality: 82, alphaQuality: 90 }).toFile("public/brand/gold-bar-poster.webp");
  await ctx.close();
  console.log("✓ public/brand/gold-bar-poster.webp");
}

async function shoot(browser: Browser) {
  await mkdir(OUT, { recursive: true });
  for (const scheme of ["light", "dark"] as const) {
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.mobile,
        hasTouch: vp.mobile,
        colorScheme: scheme,
        deviceScaleFactor: 1,
      });
      const page = await ctx.newPage();
      page.on("console", (m) => m.type() === "error" && console.warn(`  console error on ${page.url()}: ${m.text()}`));

      await page.goto(`${BASE}/design-system`, { waitUntil: "networkidle" });
      await page.screenshot({ path: `${OUT}/design-system-${scheme}-${vp.name}.png`, fullPage: true });
      console.log(`✓ design-system ${scheme} ${vp.name}`);

      // Hero: the scroll scene is sticky, so capture the viewport at three scroll depths.
      if (scheme === "dark") {
        // ?motion=full: this machine may count as low-end and would otherwise get the still image.
        await page.goto(`${BASE}/design-system/hero?motion=full`, { waitUntil: "networkidle" });
        await page.waitForTimeout(3000);
        const travel = await page.evaluate(() => {
          const s = document.querySelector('[aria-labelledby="living-gram-title"]') as HTMLElement;
          return s.offsetHeight - window.innerHeight;
        });
        let done = 0;
        for (const [label, frac] of [["top", 0], ["mid", 0.5], ["end", 1.05]] as const) {
          // Wheel like a visitor would; smooth scroll ignores programmatic scrollTo.
          const target = travel * frac;
          await page.mouse.move(vp.width / 2, vp.height / 2);
          while (done < target) {
            const step = Math.min(120, target - done);
            await page.mouse.wheel(0, step);
            done += step;
            await page.waitForTimeout(16);
          }
          await page.waitForTimeout(2200);
          await page.screenshot({ path: `${OUT}/hero-${label}-${vp.name}.png` });
        }
        console.log(`✓ hero ${vp.name}`);
      }
      await ctx.close();
    }
  }

  // Reduced motion: still poster instead of WebGL, no scroll scene.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", colorScheme: "dark" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/design-system/hero`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/hero-reduced-motion-1440.png` });
  await page.goto(`${BASE}/design-system/hero?motion=lite`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/hero-lite-1440.png` });
  console.log("✓ hero reduced motion + lite");
  await ctx.close();
}

async function main() {
  const browser = await launch();
  try {
    if (!process.argv.includes("--skip-poster")) await renderPoster(browser);
    if (!process.argv.includes("--poster-only")) await shoot(browser);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
