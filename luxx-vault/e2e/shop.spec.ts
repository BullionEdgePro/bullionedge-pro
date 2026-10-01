import "dotenv/config";
import { expect as baseExpect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { Client } from "pg";
import { totp } from "./totp";

/**
 * The Official Shop end to end (brief §9, Phase 4 gate: a full test purchase):
 *
 *   admin sets the payment details → adds a piece with a photo → a guest sees
 *   it → a Tier 2 buyer adds it to the bag, checks out by GCash transfer with
 *   pickup, uploads a receipt → admin confirms it, marks it ready, completes →
 *   the buyer orders the second piece on layaway, paying in store, then
 *   cancels, and the piece goes back on sale.
 *
 *   ADMIN_TOTP_SECRET=… npx playwright test e2e/shop.spec.ts
 *
 * Every page is checked at 390 px for horizontal overflow, and any page or
 * console error fails the test. Local databases only: it writes test data,
 * all titled "E2E …", and takes earlier runs' pieces off sale first.
 */

const DEV_PASSWORD = "Luxx-Dev-Vault-2026!"; // scripts/dev-users.ts (local accounts only)
const ADMIN_TOTP = process.env.ADMIN_TOTP_SECRET?.trim() ?? "";
const DB_URL = process.env.DATABASE_URL ?? "";
const LOCAL_DB = /@(localhost|127\.0\.0\.1)[:/]/.test(DB_URL);
const RUN = Date.now().toString(36).toUpperCase();
const TITLE = `E2E ${RUN} 18K Italian Figaro chain`;
const PHOTO = "public/images/team/team-formal-960.webp";
const PAY_TEXT = `E2E ${RUN} GCash: test account only (local database)`;

const expect = baseExpect.configure({ timeout: 20_000 });

test.skip(!LOCAL_DB, "shop e2e writes test data: local databases only");
test.skip(!ADMIN_TOTP, "set ADMIN_TOTP_SECRET");
test.describe.configure({ mode: "serial", timeout: 240_000 });

type Person = { name: string; ctx: BrowserContext; page: Page; errors: string[] };
const people: Person[] = [];

async function person(browser: Browser, name: string): Promise<Person> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "dark", locale: "en-PH", timezoneId: "Asia/Manila", reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const p: Person = { name, ctx, page, errors: [] };
  page.on("pageerror", (err) => p.errors.push(`[${name}] pageerror on ${page.url()}: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") p.errors.push(`[${name}] console.error on ${page.url()}: ${msg.text()}`);
  });
  page.on("dialog", (d) => void d.accept());
  people.push(p);
  return p;
}

async function go(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

/** No horizontal scrolling at 390 px, then back to desktop. */
async function at390(page: Page) {
  const before = page.viewportSize();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect(sw, `horizontal overflow at 390px on ${page.url()}`).toBeLessThanOrEqual(iw);
  if (before) await page.setViewportSize(before);
}

async function visit(page: Page, url: string) {
  await go(page, url);
  await at390(page);
}

async function signIn(page: Page, email: string, secret?: string) {
  await go(page, "/sign-in");
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

let db: Client;
let admin: Person, guest: Person, buyer: Person;
let productCode = "";
let orderA = "";
let orderB = "";
let originalPayText: string | null = null;

const stockOf = async (code: string) => (await db.query(`SELECT stock FROM product WHERE code = $1`, [code])).rows[0]?.stock as number;

test.beforeAll(async ({ browser }) => {
  db = new Client({ connectionString: DB_URL });
  await db.connect();
  await db.query('DELETE FROM "rateLimit"');
  originalPayText = (await db.query(`SELECT "paymentInstructions" FROM shop_settings WHERE id = 'shop'`)).rows[0]?.paymentInstructions ?? null;
  // Earlier runs: their pieces off sale, their open orders cancelled, the buyer's bag empty.
  await db.query(`UPDATE product SET status = 'archived' WHERE title LIKE 'E2E %'`);
  await db.query(`UPDATE shop_order SET status = 'cancelled', "cancelReason" = 'E2E cleanup' WHERE status NOT IN ('completed','cancelled') AND id IN (SELECT "orderId" FROM shop_order_item WHERE title LIKE 'E2E %')`);
  await db.query(`DELETE FROM cart_item WHERE "userId" = (SELECT id FROM "user" WHERE email = 'tier2@luxx.test')`);

  admin = await person(browser, "admin");
  guest = await person(browser, "guest");
  buyer = await person(browser, "buyer");
  await signIn(admin.page, "admin@luxx.test", ADMIN_TOTP);
  await signIn(buyer.page, "tier2@luxx.test");
});

test.afterEach(() => {
  const errors = people.flatMap((p) => p.errors.splice(0));
  expect(errors, "page errors or console errors (hydration included)").toEqual([]);
});

test.afterAll(async () => {
  for (const p of people) await p.ctx.close();
  if (db) {
    await db.query(`UPDATE product SET status = 'archived' WHERE title LIKE 'E2E %'`);
    await db.query(`UPDATE shop_settings SET "paymentInstructions" = $1 WHERE id = 'shop'`, [originalPayText]);
    await db.end();
  }
});

test("the admin sets the payment details buyers will see", async () => {
  const { page } = admin;
  await visit(page, "/admin/shop/settings");
  await page.getByLabel("How buyers pay you").fill(PAY_TEXT);
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();
  const audit = await db.query(`SELECT meta FROM audit_log WHERE action = 'shop.settings.updated' ORDER BY "createdAt" DESC LIMIT 1`);
  // The audit trail records that the details changed, never the details themselves.
  expect(JSON.stringify(audit.rows[0]?.meta)).not.toContain("GCash");
});

test("the admin adds a piece with a photo and publishes it", async () => {
  const { page } = admin;
  await visit(page, "/admin/shop/new");
  await page.locator('input[type="file"]').setInputFiles(PHOTO);
  await expect(page.getByRole("img", { name: /photo 1|Photo 1/i }).or(page.locator('input[name="photos"][value*="\\""]'))).toBeAttached();
  await expect(page.locator('input[name="photos"]')).not.toHaveValue("[]");
  await page.getByLabel("Title").fill(TITLE);
  await page.getByLabel("What it is").selectOption("necklace");
  await page.getByLabel("Exact weight (g)").fill("10");
  await page.getByLabel("Price (₱)").fill("60000");
  await page.getByLabel("Description").fill("Solid 18K Italian Figaro chain, 50 cm, lobster clasp, hallmarked 750. E2E test piece.");
  await page.getByLabel("Pieces in stock").fill("2");
  await page.getByLabel("Status").selectOption("active");
  await page.getByRole("button", { name: "Save product" }).click();
  await expect(page).toHaveURL(/\/admin\/shop\?saved=LP-/);
  productCode = new URL(page.url()).searchParams.get("saved")!;
  await expect(page.getByText(TITLE)).toBeVisible();
});

test("a guest finds it in the shop and is asked to sign in to buy", async () => {
  const { page } = guest;
  await visit(page, "/shop");
  await expect(page.getByRole("link", { name: new RegExp(TITLE) })).toBeVisible();
  await visit(page, `/shop/${productCode}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(TITLE);
  await expect(page.getByText("₱60,000").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in to buy" })).toBeVisible();
  // Payment details never appear on public pages.
  await expect(page.getByText(PAY_TEXT)).toHaveCount(0);
  // The photo is public once the piece is published.
  const src = await page.locator("main img").first().getAttribute("src");
  expect(src).toBeTruthy();
});

test("a Tier 2 buyer orders it by GCash with pickup and uploads the receipt", async () => {
  const { page } = buyer;
  await visit(page, `/shop/${productCode}`);
  await page.getByRole("button", { name: "Add to bag" }).click();
  await expect(page.getByText("Added to your bag.")).toBeVisible();
  await visit(page, "/shop/bag");
  await expect(page.getByText(TITLE)).toBeVisible();
  await page.getByRole("link", { name: "Check out" }).click();
  await expect(page).toHaveURL(/\/shop\/checkout$/);
  await page.waitForLoadState("networkidle");
  await at390(page);
  await page.getByText("GCash or bank transfer", { exact: true }).click();
  await page.getByLabel("Mobile number").fill("0917 555 0101");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page).toHaveURL(/\/account\/orders\/OR-[A-Z0-9]{5}\?placed=1/);
  orderA = page.url().match(/OR-[A-Z0-9]{5}/)![0];
  await expect(page.getByText(PAY_TEXT)).toBeVisible();
  await at390(page);
  expect(await stockOf(productCode)).toBe(1);

  await page.locator('input[type="file"]').setInputFiles(PHOTO);
  await expect(page.locator('input[name="proof"]')).not.toHaveValue("[]");
  await page.getByLabel("Reference number").fill("1012 345 678901");
  await page.getByRole("button", { name: "Send receipt" }).click();
  await expect(page.getByText("Receipt sent.")).toBeVisible();
  await go(page, `/account/orders/${orderA}`);
  await expect(page.getByText("Checking your payment").first()).toBeVisible();
});

test("the admin checks the receipt, then readies and completes the order", async () => {
  const { page } = admin;
  await visit(page, "/admin/orders");
  await expect(page.getByRole("link", { name: new RegExp(orderA) })).toBeVisible();
  await visit(page, `/admin/orders/${orderA}`);
  await expect(page.getByRole("heading", { name: "Receipt to check" })).toBeVisible();
  await page.getByRole("button", { name: "It arrived: confirm" }).click();
  await expect(page.getByText("Payment confirmed. The buyer was told.")).toBeVisible();
  await expect(page.getByText("Being prepared").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Receipt to check" })).toHaveCount(0);
  await page.getByRole("button", { name: "Mark ready" }).click();
  await expect(page.getByText("Marked ready. The buyer was told.")).toBeVisible();
  await page.getByRole("button", { name: "Mark completed" }).click();
  await expect(page.getByText("Order completed. The buyer was told.")).toBeVisible();
  await at390(page);

  const o = (await db.query(`SELECT status, "paidPhp" FROM shop_order WHERE code = $1`, [orderA])).rows[0];
  expect(o.status).toBe("completed");
  expect(Number(o.paidPhp)).toBe(60000);
});

test("the buyer sees it completed", async () => {
  const { page } = buyer;
  await visit(page, `/account/orders/${orderA}`);
  await expect(page.getByText("Completed").first()).toBeVisible();
  await visit(page, "/account/orders");
  await expect(page.getByRole("link", { name: new RegExp(orderA) })).toBeVisible();
});

test("the buyer puts the last piece on layaway, then cancels and it goes back on sale", async () => {
  const { page } = buyer;
  await go(page, `/shop/${productCode}`);
  await page.getByRole("button", { name: "Add to bag" }).click();
  await expect(page.getByText("Added to your bag.")).toBeVisible();
  await go(page, "/shop/checkout");
  await page.getByText("Layaway (hulugan)", { exact: true }).click();
  await expect(page.getByText(/Down payment, by/)).toBeVisible();
  await page.getByLabel("Mobile number").fill("0917 555 0101");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page).toHaveURL(/\/account\/orders\/OR-[A-Z0-9]{5}\?placed=1/);
  orderB = page.url().match(/OR-[A-Z0-9]{5}/)![0];
  await expect(page.getByRole("heading", { name: "Layaway schedule" })).toBeVisible();
  // 30% of ₱60,000 by default; the owner can change the terms in settings.
  await expect(page.getByText("₱18,000").first()).toBeVisible();
  expect(await stockOf(productCode)).toBe(0);

  await go(page, `/shop/${productCode}`);
  await expect(page.getByText(/^Sold out/).first()).toBeVisible();

  await go(page, `/account/orders/${orderB}`);
  await page.getByRole("button", { name: "Cancel order" }).click();
  await expect(page.getByText("Order cancelled. The pieces went back on sale.")).toBeVisible();
  expect(await stockOf(productCode)).toBe(1);
});
