import { expect, test, type Page } from "@playwright/test";

const browserSdkStub = String.raw`
(() => {
  class FakeSource { constructor(definition) { this.data = definition?.data; } setData(next) { this.data = next; } }
  class FakeMapTilerMap {
    constructor(options) {
      this.options = options; this.host = options.container; this.sources = {}; this.layers = {}; this.projection = options.projection || 'mercator';
      if (this.host) this.host.dataset.projection = this.projection;
      const controls = document.createElement('div'); controls.className = 'maplibregl-control-container'; this.controls = controls; this.host?.appendChild(controls);
    }
    on(event, layerOrHandler, maybeHandler) { const handler = typeof layerOrHandler === 'function' ? layerOrHandler : maybeHandler; if (typeof handler === 'function' && (event === 'load' || event === 'ready' || event === 'idle')) setTimeout(() => handler({}), 1); return this; }
    addControl(control) { const node = control?.onAdd?.(this); if (node) this.controls.appendChild(node); }
    addSource(id, definition) { this.sources[id] = new FakeSource(definition); }
    getSource(id) { return this.sources[id] || null; }
    addLayer(layer) { this.layers[layer.id] = { ...layer }; }
    getLayer(id) { return this.layers[id] || null; }
    setFilter() {}
    setPaintProperty() {}
    setLayoutProperty() {}
    setProjection(value) { this.projection = typeof value === 'string' ? value : value?.type; if (this.host) this.host.dataset.projection = this.projection; }
    getStyle() { return { layers: [] }; }
    getCanvas() { return document.createElement('canvas'); }
    areTilesLoaded() { return true; }
    resize() {}
    easeTo() {}
    fitBounds() {}
    queryRenderedFeatures() { return []; }
    remove() { this.host?.replaceChildren(); }
  }
  class NavigationControl {}
  window.maptilersdk = {
    config: {},
    Map: FakeMapTilerMap,
    NavigationControl,
    MapStyle: { STREETS: { DARK: 'streets-dark' }, BRIGHT: { DARK: 'bright-dark' }, DATAVIZ: { DARK: 'dataviz-dark' } },
  };

  class FakeLayer { constructor(options) { this.options = options; this.visible = true; this.items = []; } add(item) { this.items.push(item); } addMany(items) { this.items.push(...items); } removeAll() { this.items = []; } }
  class FakeGraphic { constructor(options) { Object.assign(this, options); } }
  class FakeEsriMap { addMany() {} }
  class FakeMapView {
    constructor(options) { this.options = options; this.container = options.container; }
    async when() { return this; }
    on() { return { remove() {} }; }
    async hitTest() { return { results: [] }; }
    destroy() {}
  }
  window.esriConfig = {};
  window.$arcgis = {
    import: async (modules) => {
      if (typeof modules === 'string') return window.esriConfig;
      return modules.map((name) => {
        if (name.endsWith('/Map.js')) return FakeEsriMap;
        if (name.endsWith('/MapView.js')) return FakeMapView;
        if (name.endsWith('/GraphicsLayer.js')) return FakeLayer;
        if (name.endsWith('/Graphic.js')) return FakeGraphic;
        return {};
      });
    }
  };
})();
`;

async function installSdkStubs(page: Page) {
  await page.addInitScript(browserSdkStub);
}

async function mockDefenseApis(page: Page, resolverCounter: { count: number }) {
  await page.route("**/api/war-costs/dataset/**", async (route) => {
    const name = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop() || "");
    const data = name === "base-index.json"
      ? [{ name: "Devens Reserve Forces Training Area", city: "Devens", state: "Massachusetts", country: "United States", personnel: 1500 }]
      : [];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, source: "WarCosts.org", attribution: "test", dataset: name, category: "test", refreshClass: "periodic", itemCount: data.length, fetchedAt: new Date().toISOString(), cached: false, data }) });
  });
  await page.route("**/api/war-costs/defense-presence**", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, latestYear: 2024, current: [{ country: "Germany", personnel: 1000, year: 2024 }], construction: [{ location: "Ramstein", country: "Germany", latitude: 49.44, longitude: 7.60, spending: 1000000 }], warnings: [] }) }));
  await page.route("**/api/war-costs/arcgis-config", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: true, apiKey: "render-only-arcgis-key" }) }));
  await page.route("**/api/war-costs/map-config", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: true, apiKey: "render-only-maptiler-key" }) }));
  await page.route("**/api/geospatial/resolve-batch", async (route) => {
    resolverCounter.count += 1;
    const body = route.request().postDataJSON() as { requests?: Array<Record<string, unknown>> };
    const resolutions = (body.requests || []).map((request) => {
      const isUs = String(request.expectedCountry || "").includes("United States");
      return {
        status: "resolved", validated: true, provider: isUs ? "geocodio" : "locationiq", query: String(request.query || ""), normalizedQuery: String(request.query || "").toLowerCase(),
        coordinates: isUs ? { lat: 42.5465, lon: -71.6137 } : { lat: 51.1657, lon: 10.4515 },
        country: isUs ? "United States" : "Germany", iso2: isUs ? "US" : "DE",
        validation: { countryMatch: true, regionMatch: true, coordinateValid: true, corroborated: true, reasons: [] }, cacheHit: false, resolvedAt: new Date().toISOString(),
      };
    });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, resolutions }) });
  });
}

test("Defense resolves map coordinates once and reuses them in 2D and 3D", async ({ page }) => {
  await installSdkStubs(page);
  const resolver = { count: 0 };
  let directProviderGeocodes = 0;
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("api.maptiler.com/geocoding/") || url.includes("geocode-api.arcgis.com/")) directProviderGeocodes += 1;
  });
  await mockDefenseApis(page, resolver);

  await page.goto("/war-costs-map");
  await expect.poll(() => resolver.count).toBe(1);
  expect(directProviderGeocodes).toBe(0);

  await page.getByRole("button", { name: "3D Globe" }).click();
  await expect(page.getByTestId("defense-maptiler-globe")).toBeVisible();
  await page.getByRole("button", { name: "2D Map" }).click();
  await expect(page.getByRole("button", { name: "2D Map" })).toHaveAttribute("aria-pressed", "true");

  expect(resolver.count).toBe(1);
  expect(directProviderGeocodes).toBe(0);
});
