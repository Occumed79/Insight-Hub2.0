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
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-320",
      use: { viewport: { width: 320, height: 700 }, reducedMotion: "reduce" },
    },
    {
      name: "mobile-390",
      use: { viewport: { width: 390, height: 844 }, reducedMotion: "reduce" },
    },
    {
      name: "tablet-768",
      use: { viewport: { width: 768, height: 1024 }, reducedMotion: "reduce" },
    },
    {
      name: "desktop-1440",
      use: { viewport: { width: 1440, height: 1000 } },
    },
  ],
  webServer: {
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
});
