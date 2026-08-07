import { expect, test, type Page } from "@playwright/test";

const stateGeometry = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "06",
      properties: { name: "California" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-124.4, 42.0],
          [-120.0, 42.0],
          [-114.1, 32.5],
          [-117.1, 32.5],
          [-124.4, 42.0],
        ]],
      },
    },
    {
      type: "Feature",
      id: "48",
      properties: { name: "Texas" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-106.6, 36.5],
          [-100.0, 36.5],
          [-93.5, 31.0],
          [-97.2, 25.8],
          [-106.6, 31.8],
          [-106.6, 36.5],
        ]],
      },
    },
  ],
};

function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function expectNoDocumentOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test("State Agencies SVG map renders and supports keyboard state selection", async ({ page }) => {
  const pageErrors = collectPageErrors(page);

  await page.route("**/api/core-intelligence/state-map-geometry", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(stateGeometry),
    });
  });

  await page.goto("/state-agencies");

  await expect(page.getByRole("heading", { name: "State Agencies", exact: true })).toBeVisible();
  await expect(page.locator('svg[aria-label="Clickable map of United States state agencies"]')).toBeVisible();

  const california = page.getByRole("button", { name: "California", exact: true });
  await expect(california).toBeVisible();
  await california.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "California", exact: true })).toBeVisible();
  await expect(page.getByText("Search California Procurement", { exact: true })).toBeVisible();
  await expectNoDocumentOverflow(page);
  expect(pageErrors).toEqual([]);
});
