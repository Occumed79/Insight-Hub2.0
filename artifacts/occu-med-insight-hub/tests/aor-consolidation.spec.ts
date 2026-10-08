import { expect, test } from "@playwright/test";

// AOR Factors is a CesiumJS + Cesium ion workspace. These tests cover the page shell and the
// intelligence panel with mocked API responses; the sandbox/CI has no Cesium ion access, so
// terrain tiles are not asserted here.

const kenyaBoundaries = {
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    properties: { iso2: "KE", iso3: "KEN", name: "Kenya" },
    geometry: { type: "Polygon", coordinates: [[[34, -4.6], [41.9, -4.6], [41.9, 4.6], [34, 4.6], [34, -4.6]]] },
  }],
};

const record = (over: Record<string, unknown>) => ({
  summary: "", evidence: "", severity: null, severityLevel: null, recommendationType: null, requirementType: null,
  sourceUrl: "https://example.org/source", publishedAt: null, updatedAt: null, retrievedAt: "2026-10-08T00:00:00.000Z",
  country: "Kenya", iso2: "KE", iso3: "KEN", region: null, geometry: { type: "None" }, geographyLevel: "text_only", geographyNote: null,
  ...over,
});

const kenyaIntel = {
  ok: true,
  country: { iso2: "KE", iso3: "KEN", name: "Kenya", center: [37.9, 0.02], capital: "Nairobi", aorRegion: "AFRICOM" },
  generatedAt: "2026-10-08T00:00:00.000Z",
  whatMattersNow: {
    method: "deterministic-rules",
    llmSynthesis: "not_enabled",
    summary: "Yellow fever vaccination is recommended; no entry requirement was found in the retrieved source.",
    observations: [{ id: "o1", dimension: "health_vaccines", headline: "Yellow fever vaccine recommended", detail: "CDC lists it as a recommendation.", kind: "finding", evidenceIds: ["e-yf-rec"], freshness: "CURRENT_GUIDANCE" }],
  },
  sources: [{ sourceId: "cdc-travel-guidance", sourceName: "CDC Travelers' Health", sourceUrl: "https://wwwnc.cdc.gov/travel", dimension: "health_vaccines", status: "ok", freshness: "CURRENT_GUIDANCE", retrievedAt: "2026-10-08T00:00:00.000Z", note: null, recordCount: 2 }],
  evidence: [
    record({ id: "e-yf-rec", dimension: "health_vaccines", category: "travel_vaccine", subtype: "yellow_fever", title: "Yellow Fever vaccine", sourceName: "CDC Travelers' Health", recommendationType: "recommended", freshness: "CURRENT_GUIDANCE" }),
    record({ id: "e-yf-req", dimension: "health_vaccines", category: "entry_requirement", subtype: "yellow_fever", title: "Yellow Fever certificate on arrival from risk countries", sourceName: "CDC Travelers' Health", requirementType: "conditional_entry_requirement", freshness: "CURRENT_GUIDANCE" }),
  ],
  limitations: ["Fixture response for UI test."],
};

test("AOR Factors page is the Cesium workspace and names the missing ion token variable", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/api/aor/cesium-config", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ configured: false, token: "", requiredEnv: "CESIUM_ION_ACCESS_TOKEN" }) }));
  await page.route("**/api/aor/boundaries", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(kenyaBoundaries) }));
  await page.route("**/api/aor/global-watch", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, earthquakes: [], disasters: [] }) }));

  await page.goto("/aor-factors");

  await expect(page.locator("[data-workspace='aor-factors-cesium']")).toBeVisible();
  await expect(page.getByTestId("aor-cesium-token-missing")).toContainText("CESIUM_ION_ACCESS_TOKEN");
  // The map engine is not silently replaced.
  await expect(page.locator(".aor-map-tiler-host")).toHaveCount(0);
  await expect(page.getByTestId("aor-glass-sidebar")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("Selecting a country shows evidence-linked What Matters Now with recommendations and entry requirements kept apart", async ({ page }) => {
  await page.route("**/api/aor/cesium-config", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: true, token: "test-token", requiredEnv: "CESIUM_ION_ACCESS_TOKEN" }) }));
  await page.route("**/api/aor/boundaries", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(kenyaBoundaries) }));
  await page.route("**/api/aor/global-watch", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, earthquakes: [], disasters: [] }) }));
  await page.route("**/api/aor/country-intel?iso2=KE", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(kenyaIntel) }));
  // Cesium ion is unreachable in test environments; abort so the page degrades without hanging.
  await page.route(/cesium\.com/, (route) => route.abort());

  await page.goto("/aor-factors");
  await expect(page.getByTestId("aor-cesium-globe")).toBeAttached();

  await page.getByLabel("Find a country").fill("Ken");
  await page.getByRole("button", { name: /Kenya/ }).click();

  const panel = page.getByTestId("aor-intel-panel");
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("aor-what-matters-now")).toContainText("Yellow fever");

  await panel.getByRole("button", { name: /Health/ }).first().click();
  const cards = page.getByTestId("aor-evidence-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.filter({ hasText: "Yellow Fever vaccine" })).toContainText(/recommend/i);
  await expect(cards.filter({ hasText: "certificate on arrival" })).toContainText(/entry requirement/i);
  // A recommendation card must not carry the requirement label and vice versa.
  await expect(cards.filter({ hasText: "Yellow Fever vaccine" })).not.toContainText(/entry requirement/i);
});
