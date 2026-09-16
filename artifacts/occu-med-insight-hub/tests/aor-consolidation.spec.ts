import { expect, test } from "@playwright/test";

const globalWatchFixture = {
  ok: true,
  partial: false,
  sourceHealth: [],
  outbreaks: [],
  disasters: [],
  earthquakes: [],
};

test("AOR Factors is an immersive map with one floating Apple-glass sidebar", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.addInitScript(() => {
    class NavigationControl {}
    class FakeMap {
      host: HTMLElement;
      canvas: HTMLCanvasElement;
      sources: Record<string, any> = {};
      layers: Record<string, any> = {};
      projection: string;

      constructor(options: any) {
        this.host = options.container;
        this.projection = options.projection || "globe";
        this.host.dataset.projection = this.projection;

        const map = document.createElement("div");
        map.className = "maplibregl-map";
        map.style.position = "absolute";
        map.style.inset = "0";

        const canvas = document.createElement("canvas");
        canvas.className = "maplibregl-canvas";
        canvas.width = 1200;
        canvas.height = 720;
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        map.appendChild(canvas);
        this.host.appendChild(map);
        this.canvas = canvas;
      }

      on(event: string, layerOrHandler: any, maybeHandler?: any) {
        const handler = typeof layerOrHandler === "function" ? layerOrHandler : maybeHandler;
        if (typeof handler === "function" && (event === "load" || event === "ready" || event === "idle")) {
          window.setTimeout(() => handler(), event === "idle" ? 30 : 5);
        }
        return this;
      }

      addControl() { return this; }
      addSource(id: string, definition: any) {
        this.sources[id] = { ...definition, setData(next: any) { this.data = next; }, data: definition.data };
        return this;
      }
      getSource(id: string) { return this.sources[id] || null; }
      addLayer(layer: any) { this.layers[layer.id] = layer; return this; }
      getLayer(id: string) { return this.layers[id] || null; }
      setFilter(id: string, filter: any) { if (this.layers[id]) this.layers[id].filter = filter; return this; }
      setPaintProperty(id: string, key: string, value: any) {
        if (this.layers[id]) {
          this.layers[id].paint = this.layers[id].paint || {};
          this.layers[id].paint[key] = value;
        }
        return this;
      }
      getCanvas() { return this.canvas; }
      getStyle() { return { layers: [] }; }
      areTilesLoaded() { return true; }
      setProjection(value: any) {
        this.projection = typeof value === "string" ? value : value?.type || "globe";
        this.host.dataset.projection = this.projection;
        return this;
      }
      easeTo() { return this; }
      fitBounds() { return this; }
      resize() { return this; }
      remove() { this.host.replaceChildren(); }
    }

    (window as any).maptilersdk = {
      config: {},
      MapStyle: { BRIGHT: { DARK: "bright-dark" }, STREETS: { DARK: "streets-dark" } },
      Map: FakeMap,
      NavigationControl,
    };
  });

  await page.route("**/api/map-config", async (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ configured: true, apiKey: "test-maptiler-key", keySlot: 6 }),
  }));
  await page.route("**/api/aor/global-watch", async (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(globalWatchFixture),
  }));

  await page.goto("/aor-factors");

  const mapHost = page.locator(".aor-map-tiler-host");
  await expect(mapHost).toBeVisible();
  await expect(page.locator(".maplibregl-map")).toBeVisible();

  const mapBox = await mapHost.boundingBox();
  expect(mapBox).not.toBeNull();
  expect(mapBox!.width).toBeGreaterThan(900);
  expect(mapBox!.height).toBeGreaterThan(600);

  const sidebar = page.getByTestId("aor-glass-sidebar");
  await expect(sidebar).toBeVisible();
  await expect(sidebar).toHaveCount(1);

  const tablist = sidebar.getByRole("tablist", { name: "AOR tool groups" });
  for (const label of ["Explore", "Health", "Conditions", "Intel", "Info"]) {
    await expect(tablist.getByRole("tab", { name: label, exact: true })).toBeVisible();
  }

  const infoTab = tablist.getByRole("tab", { name: "Info", exact: true });
  await infoTab.click();
  await expect(infoTab).toHaveAttribute("aria-selected", "true");

  await expect(page.getByText("Map-linked intelligence inspector", { exact: false })).toHaveCount(0);
  await expect(page.getByText("Command operating picture", { exact: false })).toHaveCount(0);

  await sidebar.getByRole("button", { name: "Hide AOR sidebar" }).click();
  await expect(page.getByTestId("aor-glass-sidebar")).toHaveCount(0);
  const handle = page.getByTestId("aor-sidebar-handle");
  await expect(handle).toBeVisible();
  await handle.click();
  await expect(page.getByTestId("aor-glass-sidebar")).toBeVisible();

  expect(pageErrors).toEqual([]);
});
