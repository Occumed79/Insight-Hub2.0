import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["line"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : "line",
  timeout: 30_000,
  expect: { timeout: 7_500 },
  use: {
    baseURL,
    browserName: "chromium",
    // Environments whose Chromium build differs from Playwright's pinned one can point at theirs with PW_CHROMIUM_PATH.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-1440",
      use: { viewport: { width: 1440, height: 1000 } },
    },
  ],
  webServer: [
    {
      command: "pnpm exec vite preview --config vite.config.ts --host 127.0.0.1 --port 4173 --strictPort",
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        NODE_ENV: "production",
        BASE_PATH: "/",
      },
    },
    {
      // The real AOR registry and medical-applicability router, for the AOR Factors browser tests.
      command: "pnpm --filter @workspace/api-server exec tsx scripts/aor-test-server.ts",
      url: "http://127.0.0.1:4180/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
      env: { AOR_TEST_API_PORT: "4180" },
    },
  ],
});
