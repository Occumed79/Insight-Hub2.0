import { expect, test, type Page } from "@playwright/test";

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
  disasters: [{ id: "gdacs-kz", title: "GREEN · Forest fires in Kazakhstan", eventType: "WF", country: "Kazakhstan", alertLevel: "GREEN", fromDate: new Date().toISOString(), toDate: "", latitude: 48, longitude: 68, url: "https://www.gdacs.org/" }],
  earthquakes: [{ id: "usgs-tj", title: "M4.2 · 24 km ESE of Norak, Tajikistan", place: "24 km ESE of Norak, Tajikistan", magnitude: 4.2, occurredAt: new Date().toISOString(), url: "https://earthquake.usgs.gov/", tsunami: false, latitude: 38.3, longitude: 69.4, depthKm: 10 }],
};

const cdcFixture = {
  ok: true,
  country: "Kuwait",
  source: "CDC Travelers' Health",
  sourceUrl: "https://wwwnc.cdc.gov/travel/destinations/traveler/none/Kuwait",
  vaccines: [
    { name: "Routine vaccines", recommendation: "Make sure you are up-to-date on all routine vaccines before every trip.", status: "recommended" },
    { name: "Hepatitis A", recommendation: "Recommended for unvaccinated travelers going to Kuwait.", status: "recommended" },
    { name: "Typhoid", recommendation: "Recommended for most travelers.", status: "recommended" },
  ],
  malaria: null,
  yellowFever: { name: "Yellow Fever", recommendation: "CDC recommendations: Vaccine is not recommended. Country entry requirements: Vaccine is not required.", status: "not-routinely-recommended" },
  diseases: [
    { name: "Dengue", transmission: "Mosquito bite", advice: "Avoid bug bites" },
    { name: "Leishmaniasis", transmission: "Sand fly bite", advice: "Avoid bug bites" },
    { name: "Middle East Respiratory Syndrome (MERS)", transmission: "Respiratory / camel exposure", advice: "Avoid sick people" },
    { name: "Tuberculosis (TB)", transmission: "Airborne", advice: "Avoid sick people" },
  ],
  notices: ["Level 1 Practice Usual Precautions"],
};

const mapTilerStub = String.raw`
(() => {
  class NavigationControl {}
  class FakeMap {
    constructor(options) {
      this.options = options;
      this.host = options.container;
      this.sources = {};
      this.layers = {};
      const shell = document.createElement('div');
      shell.className = 'maplibregl-map';
      shell.style.position = 'absolute';
      shell.style.inset = '0';
      const canvasContainer = document.createElement('div');
      canvasContainer.className = 'maplibregl-canvas-container';
      canvasContainer.style.position = 'absolute';
      canvasContainer.style.inset = '0';
      const canvas = document.createElement('canvas');
      canvas.className = 'maplibregl-canvas';
      canvas.width = 1200;
      canvas.height = 650;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvasContainer.appendChild(canvas);
      shell.appendChild(canvasContainer);
      const controls = document.createElement('div');
      controls.className = 'maplibregl-control-container';
      shell.appendChild(controls);
      this.host.appendChild(shell);
      this.canvas = canvas;
      this.controls = controls;
    }
    on(event, layerOrHandler, maybeHandler) {
      const handler = typeof layerOrHandler === 'function' ? layerOrHandler : maybeHandler;
      if (typeof handler !== 'function') return this;
      if (event === 'load' || event === 'ready') window.setTimeout(() => handler(), 5);
      if (event === 'idle') window.setTimeout(() => handler(), 35);
      return this;
    }
    addControl() {
      const corner = document.createElement('div');
      corner.className = 'maplibregl-ctrl-bottom-right';
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', 'Map navigation');
      corner.appendChild(button);
      this.controls.appendChild(corner);
    }
    addSource(id, definition) {
      const source = { ...definition, data: definition.data, setData(next) { this.data = next; } };
      this.sources[id] = source;
    }
    getSource(id) { return this.sources[id] || null; }
    addLayer(layer) { this.layers[layer.id] = layer; }
    getLayer(id) { return this.layers[id] || null; }
    setFilter(id, filter) { if (this.layers[id]) this.layers[id].filter = filter; }
    setPaintProperty(id, key, value) { if (this.layers[id]) { this.layers[id].paint = this.layers[id].paint || {}; this.layers[id].paint[key] = value; } }
    getStyle() { return { layers: [] }; }
    getCanvas() { return this.canvas; }
    areTilesLoaded() { return true; }
    resize() {
      const rect = this.host.getBoundingClientRect();
      this.canvas.width = Math.max(1200, Math.round(rect.width || 0));
      this.canvas.height = Math.max(650, Math.round(rect.height || 0));
    }
    easeTo() {}
    fitBounds() {}
    remove() { this.host.replaceChildren(); }
  }
  window.maptilersdk = {
    config: {},
    MapStyle: { BRIGHT: { DARK: 'bright-dark' }, STREETS: { DARK: 'streets-dark' }, DATAVIZ: { DARK: 'dataviz-dark' } },
    Map: FakeMap,
    NavigationControl,
  };
})();
`;

async function mockAor(page: Page) {
  await page.route("**/api/aor/unified-command?**", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(aorFixture) }));
  await page.route("**/api/map-config", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: true, apiKey: "test-maptiler-key" }) }));
  await page.route("**/maptiler-sdk.umd.min.js", async (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: mapTilerStub }));
  await page.route("**/maptiler-sdk.css", async (route) => route.fulfill({ status: 200, contentType: "text/css", body: ".maplibregl-map,.maplibregl-canvas-container,.maplibregl-canvas{width:100%;height:100%}" }));
  await page.route("https://api.maptiler.com/geocoding/**", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ features: [{ id: "country.KW", text: "Kuwait", center: [47.5, 29.3], bbox: [46.5, 28.5, 48.6, 30.1], properties: { country_code: "KW", iso_a2: "KW" } }] }) }));
  await page.route("**/api/public-data/aor-risk?**", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, advisory: { level: 1, levelLabel: "Exercise Normal Precautions", summary: "Test Kuwait travel advisory", sourceUrl: "https://travel.state.gov/" } }) }));
  await page.route("**/api/aor/health-outbreaks?**", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, country: "Kuwait", outbreaks: [], directMatches: 0, fallbackUsed: false }) }));
  await page.route("**/api/aor/disaster-alerts?**", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, country: "Kuwait", events: [] }) }));
  await page.route("**/api/aor/crisiswatch?**", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, country: "Kuwait", updates: [] }) }));
  await page.route("**/api/aor/travel-health?**", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(cdcFixture) }));
}

test.beforeEach(async ({ page }) => {
  await mockAor(page);
});

test("AOR Factors defaults to clean country mode on MapTiler vector tiles", async ({ page }) => {
  await page.goto("/aor-factors");
  await expect(page.getByRole("heading", { name: "AOR Factors" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Country mode/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /AOR mode/ })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("No AOR is selected by default.")).toBeVisible();

  const map = page.getByLabel("Interactive MapTiler AOR intelligence map");
  await expect(map).toBeVisible();
  await expect(page.getByText("Bright Dark vector tiles rendered")).toBeVisible();
  await expect(page.getByText("Map rendering failed")).toHaveCount(0);

  const canvas = map.locator("canvas.maplibregl-canvas");
  await expect(canvas).toHaveCount(1);
  const dimensions = await canvas.evaluate((element: HTMLCanvasElement) => ({ width: element.width, height: element.height, rect: element.getBoundingClientRect().toJSON() }));
  expect(dimensions.width).toBeGreaterThan(50);
  expect(dimensions.height).toBeGreaterThan(50);
  expect(Number(dimensions.rect.width)).toBeGreaterThan(50);
  expect(Number(dimensions.rect.height)).toBeGreaterThan(50);
  await expect(page.getByText("Select a country to load its CDC travel-health profile.")).toBeVisible();
});

test("country mode loads vaccines and travel-relevant infectious disease context without AOR fallback", async ({ page }) => {
  await page.goto("/aor-factors");
  await expect(page.getByText("Bright Dark vector tiles rendered")).toBeVisible();

  const input = page.getByPlaceholder("Search or click a country");
  await input.fill("Kuwait");
  await page.getByRole("button", { name: "Load country" }).click();

  await expect(page.getByText("Country-only intelligence for Kuwait.")).toBeVisible();
  await expect(page.getByText("Hepatitis A")).toBeVisible();
  await expect(page.getByText("Typhoid")).toBeVisible();
  await expect(page.getByText("Dengue")).toBeVisible();
  await expect(page.getByText("Middle East Respiratory Syndrome (MERS)")).toBeVisible();
  await expect(page.getByText("Level 1 · Exercise Normal Precautions")).toBeVisible();
  await expect(page.getByText("GREEN · Forest fires in Kazakhstan")).toHaveCount(0);
  await expect(page.getByText("M4.2 · 24 km ESE of Norak, Tajikistan")).toHaveCount(0);
  await expect(page.getByText("No GDACS event whose returned country metadata matches Kuwait.")).toBeVisible();
  await expect(page.getByText(/unrelated command earthquakes are not substituted/)).toBeVisible();
  await expect(page.getByText("WHO returned no text-matched outbreak item for Kuwait; unrelated outbreaks are not substituted.")).toBeVisible();
});

test("AOR mode is explicit and restores command-wide operational intelligence", async ({ page }) => {
  await page.goto("/aor-factors");
  await page.getByRole("button", { name: /AOR mode/ }).click();
  await expect(page.getByRole("button", { name: /AOR mode/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("USCENTCOM", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Test outbreak — Jordan")).toBeVisible();
  await expect(page.getByText("GREEN · Forest fires in Kazakhstan")).toBeVisible();
  await expect(page.getByText("M4.2 · 24 km ESE of Norak, Tajikistan")).toBeVisible();
  await expect(page.getByText(/Work conditions for USCENTCOM/)).toBeVisible();
});

test("legacy AOR Risk URL resolves to the country-first unified workspace", async ({ page }) => {
  await page.goto("/aor-risk-intelligence");
  await expect(page.getByRole("heading", { name: "AOR Factors" })).toBeVisible();
  await expect(page.getByText("Map-linked intelligence inspector")).toBeVisible();
  await expect(page.getByText("Bright Dark vector tiles rendered")).toBeVisible();
  await expect(page.getByRole("button", { name: /Country mode/ })).toHaveAttribute("aria-pressed", "true");
});
