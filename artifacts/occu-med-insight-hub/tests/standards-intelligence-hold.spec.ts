import { expect, test } from "@playwright/test";

// Standards Intelligence is reserved for regulatory/guideline updates monitoring.
// The retired medical case-evaluation backend must never be called by this route.
test("Standards Intelligence is held for regulatory updates and does not invoke retired evaluators", async ({ page }) => {
  const legacyRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/standards\/(catalog|evaluate)(?:\?|$)/.test(request.url())) legacyRequests.push(request.url());
  });
  await page.goto("/standards-intelligence");
  await expect(page.locator('[data-rebuild-hold="true"][data-workspace="standards-intelligence"]')).toBeVisible();
  expect(legacyRequests).toEqual([]);
});
