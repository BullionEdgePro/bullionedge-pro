import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { totp } from "./totp";

// Checkpoint screenshots (SHOTS=1 npm run test:e2e). Skipped in normal runs.
test.skip(!process.env.SHOTS, "set SHOTS=1 to capture review screenshots");

const dir = "docs/screenshots/phase-2";
const email = `review+${Date.now()}@example.com`;
const password = "Tunay-na-Ginto-2026";

async function latestHtml(subject: string) {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const r = await db.query('SELECT html FROM dev_email WHERE "to" = $1 AND subject LIKE $2 ORDER BY "createdAt" DESC LIMIT 1', [email, `%${subject}%`]);
  await db.end();
  return r.rows[0]?.html as string;
}

test("capture account screens", async ({ browser }) => {
  for (const [name, viewport, scheme] of [
    ["1440-dark", { width: 1440, height: 900 }, "dark"],
    ["1440-light", { width: 1440, height: 900 }, "light"],
    ["390-dark", { width: 390, height: 844 }, "dark"],
  ] as const) {
    const ctx = await browser.newContext({ viewport, colorScheme: scheme, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/sign-up");
    await page.getByLabel("Full name").fill("Maria Santos");
    await page.getByLabel("Email").fill(name === "1440-dark" ? email : `x${name}${email}`);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.screenshot({ path: `${dir}/sign-up-${name}.png`, fullPage: true });
    await page.goto("/sign-in");
    await page.screenshot({ path: `${dir}/sign-in-${name}.png`, fullPage: true });
    await ctx.close();
  }

  // Full journey once, capturing each state.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark", reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("Maria Santos");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel(/I agree to the Terms/).check();
  await page.getByLabel(/Privacy Notice/).check();
  await page.getByLabel(/18 years old/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.screenshot({ path: `${dir}/check-inbox-1440-dark.png` });

  const verifyHtml = await latestHtml("Confirm your email");
  const mail = await ctx.newPage();
  await mail.setViewportSize({ width: 700, height: 900 });
  await mail.setContent(verifyHtml);
  await mail.screenshot({ path: `${dir}/email-confirm.png`, fullPage: true });

  const link = verifyHtml.match(/href="([^"]*verify-email[^"]*)"/)![1]!.replace(/&amp;/g, "&");
  await page.goto(link);
  await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
  await page.screenshot({ path: `${dir}/account-welcome-1440-dark.png`, fullPage: true });

  await page.goto("/account/security");
  await page.getByRole("button", { name: "Turn on two-step sign-in" }).click();
  await page.getByLabel("Confirm your password").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Save your backup codes")).toBeVisible();
  await page.screenshot({ path: `${dir}/security-2fa-setup-1440-dark.png`, fullPage: true });
  const secret = (await page.locator("code").first().textContent())!.trim();
  await page.getByLabel("6-digit code").fill(totp(secret));
  await page.getByRole("button", { name: "Turn on", exact: true }).click();
  await expect(page.getByText("Two-step sign-in is on.")).toBeVisible();
  await page.reload();
  await page.screenshot({ path: `${dir}/security-1440-dark.png`, fullPage: true });

  const alertHtml = await latestHtml("Two-step sign-in was turned on");
  await mail.setContent(alertHtml);
  await mail.screenshot({ path: `${dir}/email-security-alert.png`, fullPage: true });

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/two-factor/);
  await page.screenshot({ path: `${dir}/two-factor-1440-dark.png` });

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "light", reducedMotion: "reduce" });
  const p2 = await phone.newPage();
  await p2.goto(`/dev/mailbox?to=${encodeURIComponent(email)}`);
  await p2.screenshot({ path: `${dir}/mailbox-390-light.png`, fullPage: true });
  await phone.close();
  await ctx.close();
});
