import { expect, test, type Page, type Route } from "@playwright/test";

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(body),
  });
}

async function installIndustryFixture(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/api/occupational-discovery/bls-overview")) {
      return fulfillJson(route, {
        ok: true,
        sectors: [
          {
            id: "manufacturing",
            naics: "31",
            label: "Manufacturing",
            description: "Deterministic benchmark fixture.",
            benchmark: { naics: "31", year: 2025, trcRate: 2.8, dartRate: 1.6, daysAwayRate: 1.1 },
          },
        ],
        ranked: [],
      });
    }
    if (url.pathname.endsWith("/api/bls/industry-benchmark")) {
      return fulfillJson(route, {
        ok: true,
        benchmark: { naics: "31", year: 2025, trcRate: 2.8, dartRate: 1.6, daysAwayRate: 1.1 },
      });
    }
    return fulfillJson(route, { ok: true, results: [], records: [] });
  });
}

test.beforeEach(async ({ page }) => {
  await installIndustryFixture(page);
});

for (const route of ["/industry-impact-calculator", "/industry-injury-benchmarks"]) {
  test(`Industry Impact rebuild hold preserves its identity at ${route}`, async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (request) => { if (/\/api\/(bls|occupational-discovery)\//.test(request.url())) requests.push(request.url()); });
    await page.goto(route);
    const workspace = page.locator('[data-rebuild-hold="true"][data-workspace="industry-impact"][data-page-identity="industry-impact"]');
    await expect(workspace).toBeVisible();
    await expect(workspace.locator("main")).toHaveAttribute("aria-hidden", "true");
    await expect(workspace.locator("main")).toBeEmpty();
    expect(requests).toEqual([]);
  });
}
