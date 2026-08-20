import { expect, test, type Page, type Route } from "@playwright/test";

const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

async function roster(page: Page) {
  await page.route("**/api/entities/roster", (route) => json(route, { entities: [{ id: "v2x", name: "V2X", source: "prospect" }], counts: { clients: 0, prospects: 1, competitors: 0 } }));
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 760, height: 900 }]) {
  test(`competitor database is useful before search at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route("**/api/competitors", (route) => json(route, { competitors: [{ id: "c1", name: "Concentra", tier: "national", headquarters: "Addison, TX", services: JSON.stringify(["Occupational medicine", "Drug testing"]), coverageStates: JSON.stringify(["TX", "VA"]), employeeCount: "10,000+", founded: "1979", description: "National occupational-health network", notes: "Broad clinic footprint", website: "https://www.concentra.com" }] }));
    await page.goto("/competitors");
    await expect(page.getByText("Concentra", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Service Capability")).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveValue("");
  });
}

test("known entity automatically loads federal awards", async ({ page }) => {
  await roster(page);
  await page.route("**/api/public-data/usaspending", (route) => json(route, { ok: true, companyName: "V2X", fromDate: "2020-01-01", toDate: "2026-01-01", awards: [], totalAwardAmount: 0, sourceUrl: "https://usaspending.gov" }));
  await page.goto("/federal-awards");
  await expect(page.getByText("V2X", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("No employer selected")).toHaveCount(0);
});

test("calculators open with clearly labeled non-zero sample", async ({ page }) => {
  await page.route("**/api/occupational-discovery/bls-overview", (route) => json(route, { ok: true, sectors: [] }));
  await page.goto("/occupational-calculators");
  await expect(page.getByText(/Sample scenario — replace with employer values/i)).toBeVisible();
  await expect(page.getByText("3.2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Reset shared context/i }).click();
  await expect(page.getByText("Waiting for inputs")).toBeVisible();
});
