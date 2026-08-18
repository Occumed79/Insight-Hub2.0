import { expect, test } from "@playwright/test";

const aorFixture = {
  ok: true,
  command: "centcom",
  commandLabel: "USCENTCOM",
  retrievedAt: new Date().toISOString(),
  partial: false,
  sourceHealth: [
    { provider: "WHO Disease Outbreak News", ok: true, count: 1 },
    { provider: "GDACS", ok: true, count: 1 },
    { provider: "USGS Earthquake Catalog", ok: true, count: 1 },
  ],
  outbreaks: [{ id: "who-1", title: "Test outbreak — Jordan", publishedAt: new Date().toISOString(), summary: "Test outbreak", matchedArea: "Jordan", url: "https://www.who.int/" }],
  disasters: [{ id: "gdacs-1", title: "Test flood — Iraq", eventType: "FL", country: "Iraq", alertLevel: "orange", fromDate: new Date().toISOString(), toDate: "", latitude: 33, longitude: 44, url: "https://www.gdacs.org/" }],
  earthquakes: [{ id: "usgs-1", title: "Test earthquake", place: "Iran", magnitude: 5.1, occurredAt: new Date().toISOString(), url: "https://earthquake.usgs.gov/", tsunami: false, latitude: 32, longitude: 53, depthKm: 10 }],
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/reviewer-tools/aor?**", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(aorFixture) }));
  await page.route("**/api/aor/source-readiness", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, sources: [
    { id: "state", name: "U.S. Department of State", configured: true, live: true, requirement: null },
    { id: "who", name: "WHO Disease Outbreak News", configured: true, live: true, requirement: null },
    { id: "gdacs", name: "GDACS", configured: true, live: true, requirement: null },
    { id: "crisiswatch", name: "International Crisis Group CrisisWatch", configured: true, live: true, requirement: null },
  ] }) }));
});

test("AOR Risk Intelligence resources now live inside AOR Factors", async ({ page }) => {
  await page.goto("/aor-factors");
  await expect(page.getByRole("heading", { name: "AOR Factors" })).toBeVisible();
  await expect(page.getByRole("link", { name: "AOR Risk Intelligence" })).toHaveCount(0);

  await page.getByRole("tab", { name: "Country Intelligence" }).click();
  await expect(page.getByText("U.S. Department of State Travel Advisory")).toBeVisible();
  await expect(page.getByRole("heading", { name: "International Crisis Group CrisisWatch" })).toBeVisible();
  await expect(page.getByText("WHO country outbreak detail")).toBeVisible();
  await expect(page.getByText("GDACS country disaster detail")).toBeVisible();
});

test("legacy AOR Risk URL resolves to the unified AOR Factors page", async ({ page }) => {
  await page.goto("/aor-risk-intelligence");
  await expect(page.getByRole("heading", { name: "AOR Factors" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Country Intelligence" })).toBeVisible();
});
