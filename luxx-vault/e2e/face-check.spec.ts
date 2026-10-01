import "dotenv/config";
import { expect as baseExpect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { totp } from "./totp";

/**
 * Face re-verification after ID verification (owner, 1 Oct 2026):
 *  - an ID-verified person starting to trade on a new sign-in is sent to
 *    "Confirm it's you" and brought back once it passes;
 *  - three failed checks pause trading, and a reviewer can reopen it.
 *
 * Chromium's fake camera supplies a moving test pattern, so the guided
 * prompts register movement the way a real face does.
 *
 *   ADMIN_TOTP_SECRET=… npx playwright test e2e/face-check.spec.ts
 *
 * Local databases only: it signs in the local dev accounts and edits their rows.
 */

const DEV_PASSWORD = "Luxx-Dev-Vault-2026!"; // scripts/dev-users.ts (local accounts only)
const ADMIN_TOTP = process.env.ADMIN_TOTP_SECRET?.trim() ?? "";
const DB_URL = process.env.DATABASE_URL ?? "";
const LOCAL_DB = /@(localhost|127\.0\.0\.1)[:/]/.test(DB_URL);
const BUYER = "tier3@luxx.test";

const expect = baseExpect.configure({ timeout: 20_000 });

test.skip(!LOCAL_DB, "face-check e2e edits local accounts: local databases only");
test.describe.configure({ mode: "serial", timeout: 180_000 });
test.use({
  permissions: ["camera"],
  timezoneId: "Asia/Manila",
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"], executablePath: process.env.CHROMIUM_PATH || undefined },
});

let db: Client;

test.beforeAll(async () => {
  db = new Client({ connectionString: DB_URL });
  await db.connect();
  await db.query('DELETE FROM "rateLimit"');
  await db.query(`UPDATE profile SET "faceLockedAt" = NULL WHERE "userId" = (SELECT id FROM "user" WHERE email = $1)`, [BUYER]);
});

test.afterAll(async () => {
  await db.query(`UPDATE profile SET "faceLockedAt" = NULL WHERE "userId" = (SELECT id FROM "user" WHERE email = $1)`, [BUYER]);
  await db.end();
});

async function signIn(page: Page, email: string, secret?: string) {
  await page.goto("/sign-in");
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

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror on ${page.url()}: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error on ${page.url()}: ${m.text()}`);
  });
  return errors;
}

test("a new sign-in must confirm the face before trading, then returns to the page", async ({ page }) => {
  const errors = trackErrors(page);
  await signIn(page, BUYER);

  // Posting a wanted request is a trading action: the face check comes first.
  await page.goto("/marketplace/wanted/new");
  await expect(page).toHaveURL(/\/account\/face-check\?purpose=session&next=%2Fmarketplace%2Fwanted%2Fnew/);
  await expect(page.getByRole("heading", { name: "Confirm it's you" })).toBeVisible();
  await expect(page.getByText("Test mode — no face comparison runs")).toBeVisible();

  await page.getByRole("button", { name: "Open front camera" }).click();
  await page.getByRole("button", { name: "Start the selfie check" }).click();
  const confirm = page.getByRole("button", { name: "Confirm it's me" });
  await expect(confirm).toBeEnabled({ timeout: 30_000 });
  await confirm.click();

  // Back where they started, form ready.
  await expect(page).toHaveURL(/\/marketplace\/wanted\/new$/);
  await expect(page.getByRole("heading", { name: /Tell sellers what you/ })).toBeVisible();

  const { rows } = await db.query(
    `SELECT passed, purpose, "sessionId" FROM face_check WHERE "userId" = (SELECT id FROM "user" WHERE email = $1) ORDER BY "createdAt" DESC LIMIT 1`,
    [BUYER],
  );
  expect(rows[0]).toMatchObject({ passed: true, purpose: "session" });
  expect(rows[0].sessionId).toBeTruthy();

  // The check holds for this sign-in: no second prompt.
  await page.goto("/marketplace/wanted/new");
  await expect(page).toHaveURL(/\/marketplace\/wanted\/new$/);
  expect(errors).toEqual([]);
});

test("a paused account can't trade until a reviewer reopens it", async ({ browser }) => {
  test.skip(!ADMIN_TOTP, "set ADMIN_TOTP_SECRET to run the reviewer half");
  await db.query(`UPDATE profile SET "faceLockedAt" = now() WHERE "userId" = (SELECT id FROM "user" WHERE email = $1)`, [BUYER]);

  const buyerCtx = await browser.newContext({ timezoneId: "Asia/Manila" });
  const buyer = await buyerCtx.newPage();
  const buyerErrors = trackErrors(buyer);
  await signIn(buyer, BUYER);
  await buyer.goto("/marketplace/wanted/new");
  await expect(buyer.getByText("Trading is paused", { exact: true })).toBeVisible();
  await expect(buyer.getByRole("button", { name: "Post" })).toHaveCount(0);

  const adminCtx = await browser.newContext({ timezoneId: "Asia/Manila" });
  const admin = await adminCtx.newPage();
  const adminErrors = trackErrors(admin);
  await signIn(admin, "admin@luxx.test", ADMIN_TOTP);
  await admin.goto("/admin/kyc");
  await expect(admin.getByRole("heading", { name: "Trading paused after failed face checks" })).toBeVisible();
  await admin.getByLabel("Reason for reopening trading").first().fill("Confirmed by email with the owner; poor lighting on the attempts.");
  await admin.getByRole("button", { name: "Reopen trading" }).first().click();
  await expect(admin.getByRole("heading", { name: "Trading paused after failed face checks" })).toHaveCount(0);

  const { rows } = await db.query(`SELECT "faceLockedAt" FROM profile WHERE "userId" = (SELECT id FROM "user" WHERE email = $1)`, [BUYER]);
  expect(rows[0].faceLockedAt).toBeNull();
  const audit = await db.query(`SELECT 1 FROM audit_log WHERE action = 'face.unlocked' AND "createdAt" > now() - interval '5 minutes'`);
  expect(audit.rowCount).toBeGreaterThan(0);

  expect([...buyerErrors, ...adminErrors]).toEqual([]);
  await buyerCtx.close();
  await adminCtx.close();
});
