import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a running app (npm run dev, or build + start).
 * CHROMIUM_PATH lets CI or cloud machines use a preinstalled browser.
 */
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 90_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined },
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
});
