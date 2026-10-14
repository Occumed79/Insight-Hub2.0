import { expect, test, type Page } from "@playwright/test";
import { routeAorBackend } from "./helpers/aor-backend";

// AOR Factors, end to end in the browser: the real registry (285 locations), the real boundary polygons and the real medical
// applicability engine behind the UI (see helpers/aor-backend.ts). The workspace uses the 2D map exclusively.

async function openWorkspace(page: Page, options: Parameters<typeof routeAorBackend>[1] = {}) {
  const calls = await routeAorBackend(page, options);
  await page.route("**/api/aor/global-watch", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, earthquakes: [], disasters: [] }) }));
  await page.route("**/api/aor/country-intel**", (route) => route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ ok: false, error: "No intelligence fixture in this test." }) }));
  await page.goto("/aor-factors");
  await expect(page.getByTestId("aor-flat-map")).toBeVisible();
  await expect(page.locator("[data-testid='aor-flat-map'] path[data-location-id]").first()).toBeAttached();
  await expect.poll(() => page.locator("[data-testid='aor-flat-map'] path[data-command]:not([data-command=''])").count()).toBeGreaterThan(150);
  return calls;
}

async function search(page: Page, text: string) {
  await page.getByLabel("Find a country or territory").fill(text);
}

test("country selection loads sourced guidance without an assignment form or filters", async ({ page }) => {
  const calls = await openWorkspace(page, { publicHealth: [{ id: "cdc-test", topic: "Public-health guidance", category: "immunization", authority: "CDC Travelers' Health", recommendation: "Recommended for this fixture's travelers.", url: "https://wwwnc.cdc.gov/travel/", kind: "recommendation", recommendationType: "recommended" }] });
  await search(page, "Western Sahara");
  await page.getByTestId("aor-search-result").first().click();
  await expect(page.getByTestId("aor-medical-result")).toBeVisible();
  await expect(page.getByTestId("aor-source-group-combatant_command")).toContainText(/provisional/i);
  await expect(page.getByTestId("aor-source-group-public_health")).toContainText("Public-health guidance");
  await expect(page.getByTestId("aor-source-group-public_health")).not.toContainText(/assignment is provisional/i);
  await expect(page.getByTestId("aor-shared-caveat")).toHaveCount(0);
  const panel = page.getByTestId("aor-intel-panel");
  await expect(panel.locator("input, select, textarea, [role='switch'], [data-testid^='aor-filter-']")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Add details" })).toHaveCount(0);
  await expect(page.getByTestId("aor-refine-toggle")).toHaveCount(0);
  await expect.poll(() => calls.medical.length).toBeGreaterThan(0);
  expect(calls.medical.every((params) => !/population=|stayDays=|contractorAuthorization=|onDeploymentOrders=/.test(params))).toBe(true);
});

test("2D map shades every polygon by the registry's command, and every command chip shows its registry count", async ({ page }) => {
  await openWorkspace(page);
  const commands = await page.locator("[data-testid='aor-flat-map'] path[data-command]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-command")));
  for (const command of ["NORTHCOM", "SOUTHCOM", "EUCOM", "AFRICOM", "CENTCOM", "INDOPACOM"]) expect(commands).toContain(command);
  // Spot-check authoritative assignments that the old hard-coded list got wrong or lacked.
  await expect(page.locator("path[data-iso2='IL']")).toHaveAttribute("data-command", "CENTCOM");
  await expect(page.locator("path[data-iso2='GL']")).toHaveAttribute("data-command", "NORTHCOM");
  await expect(page.locator("path[data-iso2='KE']")).toHaveAttribute("data-command", "AFRICOM");
  // The United States outline is a split ISO entity: never shaded as one command.
  await expect(page.locator("path[data-iso2='US']")).toHaveAttribute("data-command", "");
  await expect(page.getByTestId("aor-command-chips").getByRole("button")).toHaveCount(6);
});

test("opens on Medical requirements and never implies medical clearance", async ({ page }) => {
  await openWorkspace(page);
  await search(page, "Kenya");
  await page.getByTestId("aor-search-result").first().click();
  const panel = page.getByTestId("aor-intel-panel");
  await expect(panel.getByTestId("aor-panel-title")).toHaveText("Kenya");
  await expect(panel.getByTestId("aor-tab-medical")).toHaveText(/Medical requirements/);
  await expect(panel.getByTestId("aor-tab-medical")).toHaveAttribute("aria-pressed", "true");
  await expect(panel.getByTestId("aor-tab-summary")).toHaveAttribute("aria-pressed", "false");
  await expect(panel.getByTestId("aor-medical-disclaimer")).toContainText("not a medical clearance");
  await expect(panel).toContainText("USAFRICOM");
  await expect(page.getByTestId("aor-medical-result")).toBeVisible();
  // Nothing was assumed: with no details entered, nothing is REQUIRED and everything that depends on a detail is UNKNOWN.
  await expect(panel).toContainText("Applicability depends on:");
  await expect(panel).not.toContainText("Add assignment details");
});

test("changing country automatically replaces the policy without collecting personnel details", async ({ page }) => {
  const calls = await openWorkspace(page);
  await search(page, "Kenya");
  await page.getByTestId("aor-search-result").first().click();
  await expect(page.getByTestId("aor-medical-result")).toContainText("USAFRICOM Command Surgeon");
  await search(page, "South Korea");
  await page.getByTestId("aor-search-result").first().click();
  await expect(page.getByTestId("aor-panel-title")).toHaveText("South Korea");
  await expect(page.getByTestId("aor-medical-result")).toContainText("USINDOPACOM");
  await expect(page.getByTestId("aor-medical-result")).not.toContainText("USAFRICOM Command Surgeon");
  expect(calls.medical.some((params) => params.includes("destination=KEN"))).toBe(true);
  expect(calls.medical.some((params) => params.includes("destination=KOR"))).toBe(true);
  await expect(page.getByTestId("aor-intel-panel").locator("input, select, textarea")).toHaveCount(0);
});

test("source conditions, authority and citations are visible without completing an assignment questionnaire", async ({ page }) => {
  await openWorkspace(page, { publicHealth: [{ id: "cdc-hepa", topic: "Hepatitis A vaccine", category: "immunization", authority: "CDC Travelers' Health", recommendation: "Hepatitis A vaccine is recommended for most travelers to South Korea.", url: "https://wwwnc.cdc.gov/travel/destinations/traveler/none/south-korea", publishedAt: "2026-05-01", kind: "recommendation", recommendationType: "recommended" }] });
  await search(page, "South Korea");
  await page.getByTestId("aor-search-result").first().click();
  const command = page.getByTestId("aor-source-group-combatant_command");
  await expect(command).toBeVisible();
  await expect(command).toContainText("Applies to");
  await expect(command).toContainText("Minimum stay");
  const guidance = page.getByTestId("aor-source-group-public_health");
  await expect(guidance).toContainText("Hepatitis A vaccine");
  await expect(guidance.getByRole("link").first()).toHaveAttribute("href", /cdc\.gov/);
  await expect(command.getByTestId("aor-requirement-card").first().getByRole("link").first()).toHaveAttribute("href", /^https:\/\//);
  await expect(page.getByTestId("aor-intel-panel").locator("input, select, textarea")).toHaveCount(0);
});

test("search covers the whole directory: territories, split ISO entities, constituents, aliases and codes", async ({ page }) => {
  await openWorkspace(page);
  const panel = page.getByTestId("aor-intel-panel");

  // Constituent of a split ISO entity.
  await search(page, "Hawaii");
  await page.getByTestId("aor-search-result").first().click();
  await expect(panel.getByTestId("aor-panel-title")).toHaveText("United States — Hawaii");
  await expect(panel).toContainText("USINDOPACOM");
  await expect(panel.getByTestId("aor-no-polygon-note")).toContainText("none is drawn");

  // The split parent itself: no AOR, constituents listed.
  await search(page, "United States");
  await page.getByTestId("aor-search-split").first().click();
  await expect(page.getByTestId("aor-medical-split")).toContainText("split across commands");
  await page.getByTestId("aor-medical-split").getByRole("button", { name: /Alaska/ }).click();
  await expect(panel.getByTestId("aor-panel-title")).toHaveText("United States — Alaska");
  await expect(panel).toContainText("USNORTHCOM");

  // A territory with no polygon and no ISO code.
  await search(page, "Ceuta");
  await page.getByTestId("aor-search-result").first().click();
  await expect(panel.getByTestId("aor-panel-title")).toHaveText("Ceuta");
  await expect(panel).toContainText("USEUCOM");

  // Alias / code / split entities that are not countries.
  for (const [text, id] of [["UK", "GBR"], ["Burma", "MMR"], ["XKS", "XKX"], ["Svalbard", "XSV"], ["Guam", "GUM"], ["Saint Helena", "SHN"]] as const) {
    await search(page, text);
    await expect(page.locator(`[data-testid='aor-search-result'][data-location-id='${id}']`)).toBeVisible();
  }
  await search(page, "TF");
  await expect(page.getByTestId("aor-search-split").filter({ hasText: "French Southern Territories" })).toBeVisible();
  await search(page, "zzzzzz");
  await expect(page.getByText("No directory location matches")).toBeVisible();
});

test("locations without a polygon stay selectable as points; no boundary is invented", async ({ page }) => {
  await openWorkspace(page);
  // World view shows the point-only locations as markers.
  const markers = page.getByTestId("aor-flat-marker");
  await expect.poll(() => markers.count()).toBeGreaterThan(30);
  // Choose a command, then a point-only member.
  await page.getByTestId("aor-chip-SOUTHCOM").click();
  await expect(page.getByTestId("aor-command-panel")).toContainText("USSOUTHCOM");
  await page.locator("[data-testid='aor-flat-marker'][data-location-id='GEO:BONAIRE']").dispatchEvent("click");
  const panel = page.getByTestId("aor-intel-panel");
  await expect(panel.getByTestId("aor-panel-title")).toHaveText("Bonaire");
  await expect(panel.getByTestId("aor-no-polygon-note")).toBeVisible();
  // Geographic drilldown: Bonaire belongs to Bonaire, Sint Eustatius and Saba.
  await expect(panel).toContainText("Part of");
  await panel.getByRole("button", { name: /Bonaire, Sint Eustatius and Saba/ }).click();
  await expect(panel.getByTestId("aor-panel-title")).toHaveText("Bonaire, Sint Eustatius and Saba");
  await expect(panel).toContainText("Contains");
  await panel.getByRole("button", { name: "Saba" }).click();
  await expect(panel.getByTestId("aor-panel-title")).toHaveText("Saba");
  // Medical applicability is still calculated for it.
  await expect(page.getByTestId("aor-medical-result")).toBeVisible();
});

test("World → command → country navigation, with the command's registry members listed", async ({ page }) => {
  await openWorkspace(page);
  const breadcrumb = page.getByRole("navigation", { name: "Scope" });
  await page.getByTestId("aor-chip-AFRICOM").click();
  await expect(breadcrumb).toContainText("USAFRICOM");
  const command = page.getByTestId("aor-command-panel");
  await expect(command).toContainText("AFRICOM".replace("AFRICOM", "USAFRICOM"));
  const total = await command.getByTestId("aor-command-location").count();
  expect(total).toBeGreaterThan(50);
  await command.getByLabel("Filter AFRICOM locations").fill("Kenya");
  await expect(command.getByTestId("aor-command-location")).toHaveCount(1);
  await command.getByTestId("aor-command-location").click();
  await expect(breadcrumb).toContainText("Kenya");
  await expect(page.getByTestId("aor-intel-panel").getByTestId("aor-panel-title")).toHaveText("Kenya");
  // Back up the hierarchy.
  await breadcrumb.getByRole("button", { name: "USAFRICOM" }).click();
  await expect(page.getByTestId("aor-command-panel")).toBeVisible();
  await breadcrumb.getByRole("button", { name: "World" }).click();
  await expect(page.getByTestId("aor-command-panel")).toHaveCount(0);
  // Clicking the map selects through the registry too.
  await page.locator("path[data-iso2='KR']").dispatchEvent("click");
  await expect(page.getByTestId("aor-intel-panel").getByTestId("aor-panel-title")).toHaveText("South Korea");
  await page.locator("path[data-iso2='US']").dispatchEvent("click");
  await expect(page.getByTestId("aor-medical-split")).toBeVisible();
});

test("registry shading and point markers load automatically without layer switches", async ({ page }) => {
  await openWorkspace(page);
  await expect(page.locator("path[data-iso2='KE']")).toHaveAttribute("data-command", "AFRICOM");
  await expect.poll(() => page.getByTestId("aor-flat-marker").count()).toBeGreaterThan(30);
  await expect(page.getByRole("list", { name: "Map layers" })).toHaveCount(0);
  await expect(page.getByTestId("aor-toggle-shading")).toHaveCount(0);
  await expect(page.getByTestId("aor-toggle-markers")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Layers/ })).toHaveCount(0);
});

test("a failed requirements request shows an actionable error, and Retry recalculates without inventing results", async ({ page }) => {
  await openWorkspace(page);
  // Routes registered later take precedence: the first medical request fails like a cold or restarting server; later ones reach the real engine.
  let failures = 0;
  await page.route("**/api/aor/medical-applicability**", async (route) => {
    if (failures === 0) { failures += 1; await route.fulfill({ status: 503, contentType: "text/html", body: "Service Unavailable" }); return; }
    await route.fallback();
  });
  await search(page, "Kenya");
  await page.getByTestId("aor-search-result").first().click();
  const error = page.getByTestId("aor-medical-error");
  await expect(error).toBeVisible();
  await expect(page.getByTestId("aor-medical-result")).toHaveCount(0); // no requirements are shown or assumed
  await error.getByTestId("aor-medical-retry").click();
  await expect(page.getByTestId("aor-medical-result")).toBeVisible();
  await expect(page.getByTestId("aor-medical-error")).toHaveCount(0);
  await expect(page.getByTestId("aor-intel-panel").locator("input, select, textarea")).toHaveCount(0);
});

test("a location the intelligence engines cannot cover still gets medical requirements, and says what is not evaluated", async ({ page }) => {
  await openWorkspace(page);
  await search(page, "Ceuta");
  await page.getByTestId("aor-search-result").first().click();
  const panel = page.getByTestId("aor-intel-panel");
  await expect(page.getByTestId("aor-medical-result")).toBeVisible();
  await panel.getByTestId("aor-tab-health_vaccines").click();
  await expect(page.getByTestId("aor-intel-unavailable")).toContainText("none exists for Ceuta");
  await panel.getByTestId("aor-tab-medical").click();
  await expect(page.getByTestId("aor-medical-result")).toBeVisible();
});

test("if the directory cannot load, polygons still open but no AOR is shown or assumed", async ({ page }) => {
  await page.route("**/api/aor/boundaries", async (route) => { const r = await route.fetch({ url: `http://127.0.0.1:${process.env.AOR_TEST_API_PORT ?? 4180}/api/aor/boundaries` }); await route.fulfill({ response: r }); });
  await page.route("**/api/aor/directory**", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ ok: false, error: "directory offline" }) }));
  await page.route("**/api/aor/medical-applicability**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, status: "EVALUATED", location: { id: "KEN", name: "Kenya", command: null }, requirements: [], scopeRules: [], byStatus: { REQUIRED: 0, RECOMMENDED: 0, CONDITIONAL: 0, NOT_APPLICABLE: 0, UNKNOWN: 0 }, categories: {}, layers: {}, missingInformation: [], limitations: [] }) }));
  await page.route("**/api/aor/global-watch", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, earthquakes: [], disasters: [] }) }));
  await page.route("**/api/aor/country-intel**", (route) => route.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
  await page.goto("/aor-factors");
  await expect(page.getByTestId("aor-directory-error")).toContainText("directory offline");
  await expect(page.getByTestId("aor-command-chips").getByRole("button")).toHaveCount(0);
  await expect(page.locator("path[data-iso2='KE']")).toHaveAttribute("data-command", "");
  await page.locator("path[data-iso2='KE']").click();
  await expect(page.getByTestId("aor-intel-panel").getByTestId("aor-panel-title")).toHaveText("Kenya");
});

test("2D map is the only engine and never requests Cesium configuration or assets", async ({ page }) => {
  const cesiumRequests: string[] = [];
  page.on("request", (request) => { if (/cesium-config|cesium\.com|\/cesium\//.test(request.url())) cesiumRequests.push(request.url()); });
  await openWorkspace(page);
  await expect(page.locator('[data-workspace="aor-factors-map"]')).toHaveAttribute("data-map-mode", "2d");
  await expect(page.getByTestId("aor-map-mode")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.getByTestId("aor-chip-EUCOM").click();
  await expect(page.getByTestId("aor-command-panel")).toContainText("66 locations");
  await search(page, "Germany");
  await page.getByTestId("aor-search-result").first().click();
  await expect(page.getByTestId("aor-panel-title")).toHaveText("Germany");
  await expect(page.getByTestId("aor-medical-result")).toBeVisible();
  await page.getByRole("button", { name: "World", exact: true }).click();
  await expect(page.getByTestId("aor-intel-panel")).toHaveCount(0);
  await expect(page.getByTestId("aor-flat-map")).toBeVisible();
  expect(cesiumRequests).toEqual([]);
});

test("the 2D workspace works when WebGL is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(kind: string, ...args: unknown[]) {
      if (kind === "webgl" || kind === "webgl2" || kind === "experimental-webgl") return null;
      return getContext.apply(this, [kind, ...args] as Parameters<typeof getContext>);
    } as typeof getContext;
  });
  await openWorkspace(page);
  await search(page, "Kenya");
  await page.getByTestId("aor-search-result").first().click();
  await expect(page.getByTestId("aor-panel-title")).toHaveText("Kenya");
  await expect(page.getByTestId("aor-medical-result")).toBeVisible();
  await expect(page.getByTestId("aor-cesium-token-missing")).toHaveCount(0);
});

test("search is unobstructed without a layer-configuration menu", async ({ page }) => {
  await openWorkspace(page);
  await search(page, "Kenya");
  await expect(page.getByTestId("aor-search-result").first()).toBeVisible();
  await page.getByTestId("aor-search-result").first().click({ timeout: 5000 }); // search remains directly clickable
  await expect(page.getByTestId("aor-intel-panel").getByTestId("aor-panel-title")).toHaveText("Kenya");
  await expect(page.getByRole("button", { name: /Layers/ })).toHaveCount(0);
});


test("2D zoom and reset controls remain interactive with the country panel open", async ({ page }) => {
  test.setTimeout(60_000);
  await openWorkspace(page);
  await search(page, "Germany");
  await page.getByTestId("aor-search-result").first().click();
  await expect(page.getByTestId("aor-panel-title")).toHaveText("Germany");
  const map = page.getByTestId("aor-flat-map").getByRole("application");
  // Wait for the navigation transition to settle before measuring the zoom change.
  await expect.poll(async () => Number((await map.getAttribute("viewBox"))!.split(" ")[2])).toBeLessThan(50);
  await page.waitForTimeout(800);
  const before = Number((await map.getAttribute("viewBox"))!.split(" ")[2]);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect.poll(async () => Number((await map.getAttribute("viewBox"))!.split(" ")[2])).toBeLessThan(before);
  await page.getByRole("button", { name: "Reset to world view", exact: true }).click();
  await expect.poll(async () => Number((await map.getAttribute("viewBox"))!.split(" ")[2])).toBeGreaterThan(300);
  await expect(page.getByTestId("aor-panel-title")).toHaveText("Germany");
});
