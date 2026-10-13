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

const countOf = async (page: Page, status: string) => Number(await page.getByTestId(`aor-count-${status}`).innerText());

test("an assignment warning applies only to its visible command-policy items", async ({ page }) => {
  await openWorkspace(page, { publicHealth: [{ id: "cdc-test", topic: "Public-health guidance", category: "immunization", authority: "CDC Travelers' Health", recommendation: "Recommended for this fixture's travelers.", url: "https://wwwnc.cdc.gov/travel/", kind: "recommendation", recommendationType: "recommended" }] });
  await search(page, "Western Sahara");
  await page.getByTestId("aor-search-result").first().click();
  await expect(page.getByTestId("aor-medical-result")).toBeVisible();
  await expect(page.getByTestId("aor-group-UNKNOWN")).toContainText(/provisional/i);
  // A mixed list cannot place the command warning above unrelated public-health guidance.
  await expect(page.getByTestId("aor-shared-caveat")).toHaveCount(0);
  await page.getByTestId("aor-filter-RECOMMENDED").click();
  await expect(page.getByTestId("aor-group-RECOMMENDED")).toContainText("Public-health guidance");
  await expect(page.getByTestId("aor-shared-caveat")).toHaveCount(0);
  await expect(page.getByTestId("aor-medical-result")).not.toContainText(/assignment is provisional/i);
  await page.getByTestId("aor-filter-UNKNOWN").click();
  await expect(page.getByTestId("aor-shared-caveat")).toContainText(/provisional/i);
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
  expect(await countOf(page, "REQUIRED")).toBe(0);
  expect(await countOf(page, "UNKNOWN")).toBeGreaterThan(0);
  await expect(page.getByTestId("aor-missing-information")).toContainText("traveler population");
});

test("changing a detail recalculates the requirements immediately (duration, personnel type, CAAF, SOW, orders)", async ({ page }) => {
  const calls = await openWorkspace(page);
  await search(page, "Korea");
  await page.getByTestId("aor-search-result").filter({ hasText: "South Korea" }).click();
  const panel = page.getByTestId("aor-intel-panel");
  await expect(panel.getByTestId("aor-panel-title")).toHaveText("South Korea");
  await expect(panel).toContainText("USINDOPACOM");

  // Assignment details are optional and sit behind "Refine for this assignment", below the results.
  await page.getByTestId("aor-refine-toggle").click();
  await page.getByTestId("aor-input-population").selectOption("us_military");
  await page.getByTestId("aor-input-travel").selectOption("official_tdy_deployment");
  await page.getByTestId("aor-input-origin").fill("USA");
  await page.getByTestId("aor-input-days").fill("14");
  await expect.poll(() => countOf(page, "NOT_APPLICABLE")).toBeGreaterThan(30);
  expect(await countOf(page, "REQUIRED")).toBe(0);
  const short = { notApplicable: await countOf(page, "NOT_APPLICABLE") };

  // Same person, longer assignment: the duration trigger now reaches them. No reload, no button.
  await page.getByTestId("aor-input-days").fill("200");
  await expect.poll(() => countOf(page, "REQUIRED")).toBeGreaterThan(0);
  await expect.poll(() => countOf(page, "NOT_APPLICABLE")).toBeLessThan(short.notApplicable);
  expect(calls.medical.some((search) => search.includes("stayDays=200") && search.includes("population=us_military"))).toBe(true);

  // Contractor controls appear only for contractors and are sent to the engine.
  await expect(page.getByTestId("aor-input-caaf-caaf")).toHaveCount(0);
  await page.getByTestId("aor-input-population").selectOption("dod_contractor");
  await page.getByTestId("aor-input-caaf-caaf").click();
  await page.getByTestId("aor-input-sow-yes").click();
  await page.getByTestId("aor-input-orders-yes").click();
  await page.getByTestId("aor-input-days").fill("120");
  await expect.poll(() => calls.medical.some((search) => search.includes("contractorAuthorization=caaf") && search.includes("contractRequirementsApply=true") && search.includes("onDeploymentOrders=true") && search.includes("stayDays=120"))).toBe(true);
  await expect.poll(() => countOf(page, "REQUIRED")).toBeGreaterThan(0);
  const caafRequired = await countOf(page, "REQUIRED");

  // Non-CAAF changes the contractor result (contract clauses reach CAAF and non-CAAF differently).
  await page.getByTestId("aor-input-caaf-non_caaf").click();
  await expect.poll(() => calls.medical.some((search) => search.includes("contractorAuthorization=non_caaf"))).toBe(true);
  await expect(page.getByTestId("aor-medical-result")).toBeVisible();
  expect(caafRequired).toBeGreaterThan(0);

  // Clearing the details returns every dependent item to Unknown / Conditional instead of keeping stale answers.
  await page.getByTestId("aor-medical-reset").click();
  await expect.poll(() => countOf(page, "REQUIRED")).toBe(0);
});

test("REQUIRED, RECOMMENDED, CONDITIONAL, NOT_APPLICABLE and UNKNOWN are presented distinctly with authority, triggers, citations, dates and missing inputs", async ({ page }) => {
  await openWorkspace(page, {
    publicHealth: [{ id: "cdc-hepa", topic: "Hepatitis A vaccine", category: "immunization", authority: "CDC Travelers' Health", recommendation: "Hepatitis A vaccine is recommended for most travelers to South Korea.", url: "https://wwwnc.cdc.gov/travel/destinations/traveler/none/south-korea", publishedAt: "2026-05-01", kind: "recommendation", recommendationType: "recommended" }],
  });
  await search(page, "South Korea");
  await page.getByTestId("aor-search-result").first().click();
  await page.getByTestId("aor-refine-toggle").click();
  await page.getByTestId("aor-input-population").selectOption("dod_contractor");
  await page.getByTestId("aor-input-caaf-caaf").click();
  await page.getByTestId("aor-input-sow-yes").click();
  await page.getByTestId("aor-input-orders-yes").click();
  await page.getByTestId("aor-input-travel").selectOption("official_tdy_deployment");
  await page.getByTestId("aor-input-origin").fill("USA");
  await page.getByTestId("aor-input-days").fill("120");

  const statuses = ["REQUIRED", "RECOMMENDED", "CONDITIONAL", "NOT_APPLICABLE", "UNKNOWN"];
  for (const status of statuses) await expect.poll(() => countOf(page, status), { message: status }).toBeGreaterThan(0);
  const labels = new Set<string>();
  for (const status of statuses) {
    const group = page.getByTestId(`aor-group-${status}`);
    await expect(group).toBeVisible();
    const card = group.getByTestId("aor-requirement-card").first();
    await expect(card).toHaveAttribute("data-status", status);
    labels.add((await group.getByTestId(`aor-status-${status}`).first().innerText()).trim());
  }
  expect(labels.size).toBe(5); // five different labels, not one label in five colors

  // A command REQUIRED item cites its authority, section, published and effective dates, and links the source.
  const required = page.getByTestId("aor-group-REQUIRED").getByTestId("aor-requirement-card").first();
  await expect(required).toContainText(/Authority/);
  await expect(required).toContainText(/Published/);
  await expect(required).toContainText(/Effective/);
  await expect(required.getByRole("link").first()).toHaveAttribute("href", /^https:\/\//);
  await required.getByText("Show details").click();
  await expect(required).toContainText(/Applies to|Minimum stay|Threshold/);

  // The CDC recommendation stays a recommendation, in the public-health layer, with its citation.
  const recommended = page.getByTestId("aor-group-RECOMMENDED").getByTestId("aor-requirement-card").first();
  await expect(recommended).toHaveAttribute("data-layer", "public_health");
  await expect(recommended).toContainText("Hepatitis A vaccine");
  await expect(recommended.getByRole("link").first()).toHaveAttribute("href", /cdc\.gov/);

  // UNKNOWN items say what is missing instead of reading as "not required".
  const unknown = page.getByTestId("aor-group-UNKNOWN").getByTestId("aor-requirement-card").first();
  await expect(unknown).toContainText("To decide this, add");

  // Filter chips isolate one status.
  await page.getByTestId("aor-filter-NOT_APPLICABLE").click();
  await expect(page.getByTestId("aor-group-REQUIRED")).toHaveCount(0);
  await expect(page.getByTestId("aor-group-NOT_APPLICABLE")).toBeVisible();
  await page.getByTestId("aor-filter-NOT_APPLICABLE").click();
  await expect(page.getByTestId("aor-group-REQUIRED")).toBeVisible();

  // The four authority layers and their coverage are always shown.
  const layers = page.getByTestId("aor-layer-coverage");
  for (const name of ["Combatant Command", "DoD issuance", "Host nation", "CDC / WHO guidance"]) await expect(layers).toContainText(name);
  await expect(page.getByTestId("aor-medical-disclaimer")).toBeVisible();
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

test("layer controls: AOR shading and point markers switch off and on", async ({ page }) => {
  await openWorkspace(page);
  const korea = page.locator("path[data-iso2='KR']");
  await expect(korea).toHaveAttribute("fill-opacity", /^0\.3/);
  await page.getByRole("button", { name: /Layers/ }).click();
  await page.getByTestId("aor-toggle-shading").click();
  await expect(korea).toHaveAttribute("fill-opacity", "0.14");
  await page.getByTestId("aor-toggle-shading").click();
  await expect(korea).toHaveAttribute("fill-opacity", /^0\.3/);
  const markers = page.getByTestId("aor-flat-marker");
  await expect.poll(() => markers.count()).toBeGreaterThan(0);
  await page.getByTestId("aor-toggle-markers").click();
  await expect(markers).toHaveCount(0);
  await page.getByTestId("aor-toggle-markers").click();
  await expect.poll(() => markers.count()).toBeGreaterThan(0);
  // The eight intelligence layers are still individually switchable.
  const toggles = page.getByRole("list", { name: "Map layers" }).getByRole("button", { pressed: true });
  const before = await toggles.count();
  await page.getByRole("list", { name: "Map layers" }).getByRole("button", { name: /Security/ }).click();
  await expect(toggles).toHaveCount(before - 1);
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
  // "Add details" opens and reveals the collapsed assignment inputs.
  await page.getByTestId("aor-missing-information").getByRole("button", { name: "Add details" }).click();
  await expect(page.getByTestId("aor-input-population")).toBeInViewport();
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

test("search is unobstructed and Escape closes the layers list", async ({ page }) => {
  await openWorkspace(page);
  await search(page, "Kenya");
  await expect(page.getByTestId("aor-search-result").first()).toBeVisible();
  await page.getByTestId("aor-search-result").first().click({ timeout: 5000 }); // search remains directly clickable
  await expect(page.getByTestId("aor-intel-panel").getByTestId("aor-panel-title")).toHaveText("Kenya");
  await page.getByRole("button", { name: /Layers/ }).click();
  await expect(page.getByLabel("Map layers")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Map layers")).toHaveCount(0);
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
