import { expect, test, type Page } from "@playwright/test";
import { totp } from "./totp";

// Checkpoint 2 demo: sign up → confirm email → sign in → 2FA on → sign in with a code.
const email = `e2e+${Date.now()}@example.com`;
const password = "Tunay-na-Ginto-2026";

async function openLatestMail(page: Page, subject: RegExp) {
  await page.goto(`/dev/mailbox?to=${encodeURIComponent(email)}`);
  const item = page.locator("li", { has: page.getByTestId("mail-subject").filter({ hasText: subject }) }).first();
  await expect(item).toBeVisible();
  return item;
}

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test.describe.serial("account flow", () => {
  test("sign-up requires consent and sends a confirmation email", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByLabel("Full name").fill("Maria Santos");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /agree to the Terms/ })).toBeVisible();

    await page.getByLabel(/I agree to the Terms/).check();
    await page.getByLabel(/Privacy Notice/).check();
    await page.getByLabel(/18 years old/).check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  });

  test("signing in before confirming is refused", async ({ page }) => {
    await signIn(page);
    await expect(page.getByText(/confirm your email first/i)).toBeVisible();
  });

  test("the confirmation link signs you in with a welcome", async ({ page }) => {
    const mail = await openLatestMail(page, /Confirm your email/);
    await mail.getByTestId("mail-action").click();
    await expect(page).toHaveURL(/\/account\?welcome=1/);
    await expect(page.getByRole("heading", { name: /Welcome to Luxx4less, Maria/ })).toBeVisible();
    await expect(page.getByText("Email verified")).toBeVisible(); // tier 1 badge
  });

  test("two-step sign-in can be turned on and is then required", async ({ page }) => {
    await signIn(page);
    await expect(page).toHaveURL(/\/account$/);
    await page.goto("/account/security");
    await page.getByRole("button", { name: "Turn on two-step sign-in" }).click();
    await page.getByLabel("Confirm your password").fill(password);
    await page.getByRole("button", { name: "Continue" }).click();
    const secret = (await page.locator("code").first().textContent())!.trim();
    expect(secret).toMatch(/^[A-Z2-7]+=*$/);
    await expect(page.getByText("Save your backup codes")).toBeVisible();
    await page.getByLabel("6-digit code").fill(totp(secret));
    await page.getByRole("button", { name: "Turn on", exact: true }).click();
    await expect(page.getByText("Two-step sign-in is on.")).toBeVisible();

    // Security email went out.
    const alert = await openLatestMail(page, /Two-step sign-in was turned on/);
    await expect(alert).toBeVisible();

    // Sign out, then signing in needs the code.
    await page.goto("/account");
    await page.getByRole("button", { name: "Sign out" }).click();
    await signIn(page);
    await expect(page).toHaveURL(/\/sign-in\/two-factor/);
    await page.getByLabel("6-digit code").fill("000000");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/didn't work/)).toBeVisible();
    await page.getByLabel("6-digit code").fill(totp(secret));
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByText("Two-step sign-in on")).toBeVisible();
  });

  test("protected pages send signed-out visitors to sign in", async ({ page }) => {
    await page.goto("/account/security");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount/);
  });
});
