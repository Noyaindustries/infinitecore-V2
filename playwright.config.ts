import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "cross-env NEXT_PUBLIC_USE_LEGACY_BEARER=1 npm run dev",
    url: baseURL,
    /** En local : réutilise `npm run dev` si le port 3000 est déjà pris. En CI : démarre toujours un serveur propre. */
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
  },
});
