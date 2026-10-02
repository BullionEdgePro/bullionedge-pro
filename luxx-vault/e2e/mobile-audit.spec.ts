import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { expect as baseExpect, test, type Browser, type Page } from "@playwright/test";
import { Client } from "pg";
import { totp } from "./totp";

/**
 * Phone audit (owner, 1 Oct 2026): every page on an iPhone-sized touch screen
 * (390 × 844), as a guest, a Tier 2 customer and an admin. Each page must load
 * without a page or console error, never scroll sideways, show no broken
 * images, and keep its tap targets at least 24 px (WCAG 2.2 target size).
 * Then the phone navigation itself: the menu, the Buy / Sell sheets and the
 * bottom bar must lead where they say.
 *
 *   ADMIN_TOTP_SECRET=… npx playwright test e2e/mobile-audit.spec.ts
 *
 * Findings are collected per page (soft checks) and written to
 * test-results/mobile-audit.json, with a phone screenshot of each page.
 */

const DEV_PASSWORD = "Luxx-Dev-Vault-2026!"; // scripts/dev-users.ts (local accounts only)
const ADMIN_TOTP = process.env.ADMIN_TOTP_SECRET?.trim() ?? "";
const DB_URL = process.env.DATABASE_URL ?? "";
const LOCAL_DB = /@(localhost|127\.0\.0\.1)[:/]/.test(DB_URL);
const OUT = "test-results/mobile-audit";

const expect = baseExpect.configure({ timeout: 20_000 });
test.skip(!LOCAL_DB, "uses local test accounts: local databases only");
test.skip(!ADMIN_TOTP, "set ADMIN_TOTP_SECRET");
test.describe.configure({ mode: "serial", timeout: 600_000 });

type Finding = { who: string; path: string; problem: string };
const findings: Finding[] = [];
const save = () => writeFileSync("test-results/mobile-audit.json", JSON.stringify(findings, null, 2));

async function phone(browser: Browser, who: string) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
    locale: "en-PH",
    timezoneId: "Asia/Manila",
    reducedMotion: "reduce",
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36",
  });
  // A tap on something covered must fail, not wait for ever.
  ctx.setDefaultTimeout(10_000);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text().slice(0, 300)}`));
  return { ctx, page, errors, who };
}
type Phone = Awaited<ReturnType<typeof phone>>;

async function signIn(page: Page, email: string, secret?: string) {
  await page.goto("/sign-in");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(DEV_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  if (secret) {
    await expect(page).toHaveURL(/\/sign-in\/two-factor/);
    const field = page.getByLabel("6-digit code");
    const cont = page.getByRole("button", { name: "Continue" });
    await expect(async () => {
      await field.fill(totp(secret));
      await expect(cont).toBeEnabled({ timeout: 1000 });
    }).toPass({ timeout: 30_000 });
    await cont.click();
  }
  await expect(page).toHaveURL(/\/account$/);
}

/** Load a page and check it the way a phone user would meet it. */
async function audit(p: Phone, path: string) {
  const res = await p.page.goto(path);
  await p.page.waitForLoadState("networkidle");
  await p.page.waitForTimeout(400);
  const add = (problem: string) => findings.push({ who: p.who, path, problem });
  if (!res || res.status() >= 400) add(`HTTP ${res?.status()}`);
  for (const e of p.errors.splice(0)) add(e);

  const r = await p.page.evaluate(() => {
    const iw = window.innerWidth;
    const clipped = (el: Element) => {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).overflowX !== "visible") return true;
      return false;
    };
    const visible = (el: Element) => {
      const s = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      return s.visibility !== "hidden" && s.display !== "none" && b.width > 0 && b.height > 0 && Number(s.opacity) > 0.05;
    };
    const wide = [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => el.getBoundingClientRect().right > iw + 1 && getComputedStyle(el).position !== "fixed" && !clipped(el))
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 40)}"`);
    const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && visible(i)).map((i) => i.currentSrc || i.src);
    // WCAG 2.2 target size (2.5.8): a target under 24 × 24 px passes only when a 24 px circle on its
    // centre touches no other target. Checkboxes and radios inside their label count as the label.
    const targets = [...document.querySelectorAll<HTMLElement>("a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab]")]
      .filter((el) => visible(el) && !el.classList.contains("sr-only") && !(el instanceof HTMLInputElement && el.closest("label")))
      .map((el) => ({ el, b: el.getBoundingClientRect() }));
    const small = targets
      .filter(({ b }) => b.width < 24 || b.height < 24)
      .filter(({ el, b }) => {
        const cx = b.left + b.width / 2;
        const cy = b.top + b.height / 2;
        return targets.some((o) => {
          if (o.el === el || o.el.contains(el) || el.contains(o.el)) return false;
          const dx = Math.max(o.b.left - cx, 0, cx - o.b.right);
          const dy = Math.max(o.b.top - cy, 0, cy - o.b.bottom);
          return Math.hypot(dx, dy) < 12;
        });
      })
      .slice(0, 5)
      .map(({ el, b }) => `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}" ${Math.round(b.width)}x${Math.round(b.height)}`);
    // The bottom bar must never hide the end of the page.
    const bar = document.getElementById("lx-tabbar");
    const pad = bar ? parseFloat(getComputedStyle(document.body).paddingBottom) : 0;
    const barH = bar ? bar.getBoundingClientRect().height : 0;
    return { sw: document.documentElement.scrollWidth, iw, wide, broken, small, barCovers: bar ? pad + 1 < barH : false };
  });
  if (r.sw > r.iw) add(`sideways scroll: page is ${r.sw}px on a ${r.iw}px screen (${r.wide.join(" | ")})`);
  for (const b of r.broken) add(`broken image ${b}`);
  for (const s of r.small) add(`small tap target ${s}`);
  if (r.barCovers) add("bottom bar covers the end of the page");
  save();
  const file = `${OUT}/${p.who}${path.replace(/[/?=&]+/g, "_") || "_home"}.png`;
  await p.page.screenshot({ path: file });
}

let db: Client;
let guest: Phone, buyer: Phone, admin: Phone;
let listing = "";
let handle = "";
let product = "";

test.beforeAll(async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  db = new Client({ connectionString: DB_URL });
  await db.connect();
  await db.query('DELETE FROM "rateLimit"');
  listing = (await db.query(`SELECT code FROM listing WHERE status = 'active' ORDER BY "createdAt" DESC LIMIT 1`)).rows[0]?.code ?? "";
  handle = (await db.query(`SELECT handle FROM profile WHERE "sellerVerifiedAt" IS NOT NULL LIMIT 1`)).rows[0]?.handle ?? "";
  // A published piece for the shop pages: the latest test piece, put back afterwards.
  product = (await db.query(`UPDATE product SET status = 'active', stock = GREATEST(stock, 1) WHERE id = (SELECT id FROM product WHERE title LIKE 'E2E %' ORDER BY "createdAt" DESC LIMIT 1) RETURNING code`)).rows[0]?.code ?? "";
  guest = await phone(browser, "guest");
  buyer = await phone(browser, "buyer");
  admin = await phone(browser, "admin");
  await signIn(buyer.page, "tier2@luxx.test");
  await signIn(admin.page, "admin@luxx.test", ADMIN_TOTP);
});

test.afterAll(async () => {
  save();
  for (const p of [guest, buyer, admin]) await p?.ctx.close();
  if (db) {
    await db.query(`UPDATE product SET status = 'archived' WHERE title LIKE 'E2E %'`);
    await db.query(`DELETE FROM cart_item WHERE "userId" = (SELECT id FROM "user" WHERE email = 'tier2@luxx.test')`);
    await db.end();
  }
});

test("every public page holds up on a phone", async () => {
  const pages = [
    "/",
    "/shop",
    ...(product ? [`/shop/${product}`] : []),
    "/marketplace",
    "/marketplace?tab=wanted",
    ...(listing ? [`/marketplace/${listing}`] : []),
    ...(handle ? [`/sellers/${handle}`] : []),
    "/prices",
    "/tools",
    "/tools/calculator",
    "/tools/price-check",
    "/tools/hallmark",
    "/sell",
    "/about",
    "/install",
    "/sign-in",
    "/sign-up",
    "/forgot-password",
    "/privacy",
    "/terms",
  ];
  for (const path of pages) await audit(guest, path);
});

test("every customer page holds up on a phone", async () => {
  if (product) {
    await buyer.page.goto(`/shop/${product}`);
    await buyer.page.waitForLoadState("networkidle");
    await buyer.page.getByRole("button", { name: "Add to bag" }).click();
    await expect(buyer.page.getByText(/Added to your bag|Already in your bag/)).toBeVisible();
  }
  const pages = [
    "/account",
    "/account/orders",
    "/shop/bag",
    ...(product ? ["/shop/checkout"] : []),
    "/account/listings",
    "/account/wanted",
    "/account/offers",
    "/account/messages",
    "/account/trades",
    "/account/fees",
    "/account/saved",
    "/account/alerts",
    "/account/profile",
    "/account/verification",
    "/account/security",
    "/account/notifications",
  ];
  for (const path of pages) await audit(buyer, path);
});

test("every staff page holds up on a phone", async () => {
  const pages = ["/admin", "/admin/customers", "/admin/kyc", "/admin/orders", "/admin/fees", "/admin/shop", "/admin/shop/new", "/admin/shop/settings", "/admin/listings", "/admin/reports", "/admin/disputes", "/admin/prices"];
  for (const path of pages) await audit(admin, path);
});

test("the phone navigation leads where it says", async () => {
  const { page } = guest;
  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      findings.push({ who: "guest", path: page.url(), problem: `navigation: ${name}: ${(e as Error).message.split("\n")[0]}` });
    }
  };
  const bar = page.locator("#lx-tabbar");

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await step("Buy sheet opens and leads to the official shop", async () => {
    await bar.getByRole("button", { name: "Buy" }).tap();
    const sheet = page.getByRole("dialog", { name: "Buy on Luxx4less" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("link", { name: /Official Luxx4less shop/ }).tap();
    await expect(page).toHaveURL(/\/shop$/);
    await expect(sheet).toBeHidden();
  });
  await step("Sell sheet opens, its toggle switches to Buy and back, and leads to Sell to Luxx4less", async () => {
    await bar.getByRole("button", { name: "Sell" }).tap();
    const sheet = page.getByRole("dialog", { name: "Sell on Luxx4less" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("tab", { name: "Buy" }).tap();
    await expect(page.getByRole("dialog", { name: "Buy on Luxx4less" })).toBeVisible();
    await page.getByRole("dialog").getByRole("tab", { name: "Sell" }).tap();
    await page.getByRole("dialog", { name: "Sell on Luxx4less" }).getByRole("link", { name: /Sell to Luxx4less/ }).tap();
    await expect(page).toHaveURL(/\/sell$/);
  });
  await step("the sheet closes by tapping outside it, and the page scrolls again", async () => {
    await bar.getByRole("button", { name: "Buy" }).tap();
    await expect(page.getByRole("dialog", { name: "Buy on Luxx4less" })).toBeVisible();
    await page.mouse.click(195, 140);
    await expect(page.getByRole("dialog", { name: "Buy on Luxx4less" })).toBeHidden();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  });
  await step("Prices and Account in the bar", async () => {
    await bar.getByRole("link", { name: "Prices" }).tap();
    await expect(page).toHaveURL(/\/prices$/);
    await bar.getByRole("link", { name: "Account" }).tap();
    await expect(page).toHaveURL(/\/sign-in/);
    // Sign-in is a focused screen without the bar; its crest leads home.
    await page.getByRole("link", { name: /Luxx4less/ }).first().tap();
    await expect(page).toHaveURL(/\/$/);
  });
  await step("the menu opens, shows Buy and Sell, and its links work", async () => {
    await page.getByRole("button", { name: "Open menu" }).tap();
    const menu = page.locator("#house-menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByText("Buy", { exact: true })).toBeVisible();
    await menu.getByRole("link", { name: "Shop", exact: true }).tap();
    await expect(page).toHaveURL(/\/shop$/);
    await expect(menu).toBeHidden();
  });
  for (const e of guest.errors.splice(0)) findings.push({ who: "guest", path: "navigation", problem: e });
});

test("no findings", () => {
  console.log(JSON.stringify(findings, null, 2));
  expect(findings, "phone audit findings (see test-results/mobile-audit.json)").toEqual([]);
});
