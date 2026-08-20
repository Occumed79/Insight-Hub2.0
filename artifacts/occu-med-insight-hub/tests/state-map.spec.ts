import { expect, test, type Page, type Route } from "@playwright/test";

const stateGeometry = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", id: "06", properties: { name: "California" }, geometry: { type: "Polygon", coordinates: [[[-124.4, 42.0], [-120.0, 42.0], [-114.1, 32.5], [-117.1, 32.5], [-124.4, 42.0]]] } },
    { type: "Feature", id: "48", properties: { name: "Texas" }, geometry: { type: "Polygon", coordinates: [[[-106.6, 36.5], [-100.0, 36.5], [-93.5, 31.0], [-97.2, 25.8], [-106.6, 31.8], [-106.6, 36.5]]] } },
  ],
};

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json; charset=utf-8", body: JSON.stringify(body) });
}

function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function expectNoDocumentOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test("State Agencies map opens a preloaded occupational-health compliance workspace", async ({ page }) => {
  const pageErrors = collectPageErrors(page);

  await page.route("**/api/core-intelligence/state-map-geometry", (route) => fulfillJson(route, stateGeometry));
  await page.route("**/api/state-agencies/states", (route) => fulfillJson(route, {
    states: [{ stateCode: "CA", stateName: "California", region: "West", oshaStatePlan: "full", itemCount: 1, govUrl: "https://www.ca.gov", healthDeptUrl: "https://www.cdph.ca.gov", laborUrl: "https://www.dir.ca.gov", procurementUrl: "https://caleprocure.ca.gov", legislatureUrl: "https://leginfo.legislature.ca.gov", medicalBoardUrl: "https://www.mbc.ca.gov", dotUrl: "https://dot.ca.gov" }],
  }));
  await page.route("**/api/state-agencies/intel?**", (route) => fulfillJson(route, { items: [], channelCounts: {} }));
  await page.route("**/api/state-agencies/items?**", (route) => fulfillJson(route, {
    items: [{ id: "ca-1", stateCode: "CA", bucket: "health", title: "Pre-Employment Medical Examination Update", summary: "Updated employee medical examination and fitness-for-duty guidance.", url: "https://www.cdph.ca.gov", publishedDate: "2026-08-10T00:00:00.000Z", agency: "California Department of Public Health", itemType: "regulatory", relevanceScore: 90, fetchedAt: "2026-08-10T00:00:00.000Z" }],
    bucketCounts: { health: 1 },
  }));
  await page.route("**/api/core-intelligence/live-search?**", (route) => fulfillJson(route, { ok: true, configured: true, query: "occupational health", queryUsed: "California occupational health", results: [{ id: "live-1", title: "California occupational health update", url: "https://www.dir.ca.gov", displayUrl: "dir.ca.gov", siteName: "California DIR", snippet: "Current occupational health guidance", summary: "Current occupational health guidance", publishedAt: "2026-08-15T00:00:00.000Z", lastCrawledAt: "2026-08-15T00:00:00.000Z" }], returned: 1, cacheState: "fresh", source: "LangSearch Web Search API", searchedAt: "2026-08-20T00:00:00.000Z", limitation: "Verify against primary source." }));

  await page.goto("/state-agencies");
  await expect(page.getByRole("heading", { name: "State Agencies", exact: true })).toBeVisible();
  await expect(page.locator('svg[aria-label="Clickable map of United States state agencies"]')).toBeVisible();

  const california = page.getByRole("button", { name: "California", exact: true });
  await california.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "California", exact: true })).toBeVisible();
  await expect(page.getByText("State compliance pulse", { exact: true })).toBeVisible();
  await expect(page.getByText("Pre-Employment Medical Examination Update", { exact: true })).toBeVisible();
  await expect(page.getByText("Recent occupational-health compliance leads", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder(/what would you like to search/i)).toHaveCount(0);
  await expectNoDocumentOverflow(page);
  expect(pageErrors).toEqual([]);
});
