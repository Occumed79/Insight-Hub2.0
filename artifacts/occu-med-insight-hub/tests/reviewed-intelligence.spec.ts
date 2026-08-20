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

function metric(page: Page, label: string) {
  return page.getByText(label, { exact: true }).locator("..").locator("..");
}

test.beforeEach(async ({ page }) => {
  await installIndustryFixture(page);
});

test("Industry Impact recalculates workforce-scaled cases, lost days, and cost outputs", async ({ page }) => {
  await page.goto("/industry-impact-calculator");
  await expect(page.getByRole("heading", { name: "Industry Impact Calculator", exact: true })).toBeVisible();

  await page.getByLabel("Workforce size (headcount or FTE)").fill("100");
  await page.getByLabel("Annual hours per worker").fill("2000");
  await page.getByLabel("Observed employer TRIR").fill("4");
  await page.getByLabel("Target TRIR").fill("2");
  await page.getByLabel("Lost workdays per recordable").fill("5");
  await page.getByLabel("Base cost per recordable").fill("10000");

  await expect(metric(page, "Affected workers / recordables").getByText("4", { exact: true })).toBeVisible();
  await expect(metric(page, "Current lost workdays").getByText("20", { exact: true })).toBeVisible();
  await expect(metric(page, "Base annual savings").getByText("$20,000", { exact: true })).toBeVisible();

  await page.getByLabel("Workforce size (headcount or FTE)").fill("200");

  await expect(metric(page, "Affected workers / recordables").getByText("8", { exact: true })).toBeVisible();
  await expect(metric(page, "Current lost workdays").getByText("40", { exact: true })).toBeVisible();
  await expect(metric(page, "Base annual savings").getByText("$40,000", { exact: true })).toBeVisible();
});

test("Industry Impact preserves workforce basis and provenance labels", async ({ page }) => {
  await page.goto("/industry-impact-calculator");

  await page.getByLabel("Workforce size (headcount or FTE)").fill("250");
  await page.getByLabel("Workforce basis").selectOption("fte");
  await page.getByLabel("Workforce source").selectOption("estimated");

  await expect(metric(page, "Baseline provenance").getByText("Estimated baseline", { exact: true })).toBeVisible();
  await expect(metric(page, "Baseline provenance")).toContainText("250 FTE");
  await expect(page.getByText("Annual hours per FTE", { exact: true })).toBeVisible();
});