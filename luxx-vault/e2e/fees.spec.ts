import "dotenv/config";
import { randomInt } from "node:crypto";
import { expect as baseExpect, test, type Browser, type Page } from "@playwright/test";
import { Client } from "pg";
import { totp } from "./totp";

/**
 * Marketplace fees end to end (owner, 2 Oct 2026: listing is free, Luxx4less
 * earns on each completed sale):
 *
 *   a completed sale with its fee past due → the seller sees it and new
 *   listings are paused → the seller uploads a receipt → the admin confirms
 *   it → the seller is paid up and can list again.
 *
 *   SELLER_TOTP_SECRET=… ADMIN_TOTP_SECRET=… npx playwright test e2e/fees.spec.ts
 *
 * The completed sale is written straight to the local database (the full
 * trade journey, and the fee being charged as it completes, is covered in
 * marketplace.spec.ts). Local databases only; everything is removed after.
 */

const DEV_PASSWORD = "Luxx-Dev-Vault-2026!"; // scripts/dev-users.ts (local accounts only)
const SELLER_TOTP = process.env.SELLER_TOTP_SECRET?.trim() ?? "";
const ADMIN_TOTP = process.env.ADMIN_TOTP_SECRET?.trim() ?? "";
const DB_URL = process.env.DATABASE_URL ?? "";
const LOCAL_DB = /@(localhost|127\.0\.0\.1)[:/]/.test(DB_URL);
const RUN = Date.now().toString(36).toUpperCase();
const PHOTO = "public/images/team/team-formal-960.webp";
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTWXYZ";
const CODE = `TR-${Array.from({ length: 5 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")}`;

const expect = baseExpect.configure({ timeout: 20_000 });
test.skip(!LOCAL_DB, "fees e2e writes test data: local databases only");
test.skip(!SELLER_TOTP || !ADMIN_TOTP, "set SELLER_TOTP_SECRET and ADMIN_TOTP_SECRET");
test.describe.configure({ mode: "serial", timeout: 180_000 });

let db: Client;
const errors: string[] = [];
let seller: Page, admin: Page;
let originalPayText: string | null = null;

async function person(browser: Browser, name: string) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "dark", locale: "en-PH", timezoneId: "Asia/Manila", reducedMotion: "reduce" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`[${name}] ${page.url()}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`[${name}] ${page.url()}: ${m.text()}`));
  page.on("dialog", (d) => void d.accept());
  return page;
}

async function signIn(page: Page, email: string, secret: string) {
  await page.goto("/sign-in");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(DEV_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in\/two-factor/);
  const field = page.getByLabel("6-digit code");
  const cont = page.getByRole("button", { name: "Continue" });
  await expect(async () => {
    await field.fill(totp(secret));
    await expect(cont).toBeEnabled({ timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  await cont.click();
  await expect(page).toHaveURL(/\/account$/);
  // ID-verified people confirm their face before selling on each sign-in (face-check.spec.ts covers that flow).
  await db.query(
    `INSERT INTO face_check (id, "userId", "sessionId", purpose, provider, passed, flags, "createdAt")
     SELECT 'e2e_' || md5(random()::text), u.id, s.id, 'session', 'e2e', true, '{}', now()
     FROM "user" u JOIN session s ON s."userId" = u.id WHERE u.email = $1 ORDER BY s."createdAt" DESC LIMIT 1`,
    [email],
  );
}

async function go(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

test.beforeAll(async ({ browser }) => {
  db = new Client({ connectionString: DB_URL });
  await db.connect();
  await db.query('DELETE FROM "rateLimit"');
  // Sellers pay to the shop's GCash / bank details; give the local shop test ones.
  await db.query(`INSERT INTO shop_settings (id, "updatedAt") VALUES ('shop', now()) ON CONFLICT (id) DO NOTHING`);
  originalPayText = (await db.query(`SELECT "paymentInstructions" FROM shop_settings WHERE id = 'shop'`)).rows[0]?.paymentInstructions ?? null;
  await db.query(`UPDATE shop_settings SET "paymentInstructions" = $1 WHERE id = 'shop'`, [`E2E ${RUN} GCash: test account only (local database)`]);
  // Settle anything earlier test runs left, so this seller starts clear.
  await db.query(`UPDATE trade SET "feeWaivedAt" = now(), "feePaidAt" = now() WHERE "feePhp" IS NOT NULL AND "feePaidAt" IS NULL AND "sellerId" = (SELECT id FROM "user" WHERE email = 'seller@luxx.test')`);
  await db.query(`UPDATE fee_payment SET status = 'rejected', "reviewNote" = 'E2E cleanup' WHERE status = 'submitted' AND "sellerId" = (SELECT id FROM "user" WHERE email = 'seller@luxx.test')`);
  // A sale that completed ten days ago, its ₱1,500 fee three days past due.
  await db.query(
    `INSERT INTO trade (id, code, "buyerId", "sellerId", "amountPhp", category, metal, karat, "weightGrams", "regionCode", status, "paymentProvider", "releasedAt",
                        "feePct", "feePhp", "feeDueAt", "createdAt", "updatedAt")
     VALUES ($1, $2, (SELECT id FROM "user" WHERE email = 'tier3@luxx.test'), (SELECT id FROM "user" WHERE email = 'seller@luxx.test'), 50000, 'gold_jewelry', 'gold', 18,
             8, '040000000', 'released', 'mock', now() - interval '10 days', 3, 1500, now() - interval '3 days', now() - interval '12 days', now())`,
    [`e2e_fee_${RUN.toLowerCase()}`, CODE],
  );
  seller = await person(browser, "seller");
  admin = await person(browser, "admin");
  await signIn(seller, "seller@luxx.test", SELLER_TOTP);
  await signIn(admin, "admin@luxx.test", ADMIN_TOTP);
});

test.afterEach(() => {
  expect(errors.splice(0), "page errors or console errors").toEqual([]);
});

test.afterAll(async () => {
  await seller?.context().close();
  await admin?.context().close();
  if (db) {
    await db.query(`DELETE FROM fee_payment WHERE reference LIKE $1`, [`E2E ${RUN}%`]);
    await db.query(`DELETE FROM trade WHERE code = $1`, [CODE]);
    await db.query(`UPDATE shop_settings SET "paymentInstructions" = $1 WHERE id = 'shop'`, [originalPayText]);
    await db.end();
  }
});

test("a past-due fee shows on the seller's Fees page and pauses new listings", async () => {
  await go(seller, "/account/fees");
  await expect(seller.getByText("₱1,500.00 is past due.")).toBeVisible();
  await expect(seller.getByRole("link", { name: CODE })).toBeVisible();
  await expect(seller.getByText("Past due", { exact: true })).toBeVisible();
  await go(seller, "/marketplace/sell");
  await expect(seller.getByText(/in Luxx4less fees past their due date, so new listings are paused/)).toBeVisible();
  await expect(seller.getByText("Listing is free.")).toBeVisible();
});

test("the seller pays by uploading a receipt", async () => {
  await go(seller, "/account/fees");
  await seller.locator('input[type="file"]').setInputFiles(PHOTO);
  await expect(seller.locator('input[name="proof"]')).not.toHaveValue("[]");
  await seller.getByLabel("Reference number").fill(`E2E ${RUN} 0001`);
  await seller.getByRole("button", { name: "Send receipt" }).click();
  await expect(seller.getByText("Receipt sent.")).toBeVisible();
  await expect(seller.getByText("Being checked")).toBeVisible();
  // While staff check the receipt, the seller isn't held up.
  await go(seller, "/marketplace/sell");
  await expect(seller.getByText(/new listings are paused/)).toHaveCount(0);
});

test("the admin confirms it and the seller can list again", async () => {
  await go(admin, "/admin/fees");
  await expect(admin.getByRole("heading", { name: "Fee receipt to check" })).toBeVisible();
  await admin.getByRole("button", { name: "It arrived: confirm" }).click();
  await expect(admin.getByText("Payment confirmed. The seller was told.")).toBeVisible();
  const t = (await db.query(`SELECT "feePaidAt" FROM trade WHERE code = $1`, [CODE])).rows[0];
  expect(t.feePaidAt).not.toBeNull();

  await go(seller, "/account/fees");
  await expect(seller.getByText("You're all paid up. Thank you.")).toBeVisible();
  await go(seller, "/marketplace/sell");
  await expect(seller.getByText(/new listings are paused/)).toHaveCount(0);
});

test("the admin sees the fee settings and saves them", async () => {
  await go(admin, "/admin/fees");
  await expect(admin.getByLabel("Commission (%)")).toHaveValue(/^\d/);
  await admin.getByRole("button", { name: "Save fee settings" }).click();
  await expect(admin.getByText("Fee settings saved.")).toBeVisible();
});
