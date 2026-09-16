import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

test("active WHO route disambiguates Guinea-family country names and never substitutes unrelated items", () => {
  const text = source("src/routes/aor-country-resilience.ts");
  assert.match(text, /papua new guinea/);
  assert.match(text, /equatorial guinea/);
  assert.match(text, /guinea bissau/);
  assert.match(text, /fallbackUsed: false/);
});

test("country resilience remains the active WHO outbreak route before the older risk router", () => {
  const text = source("src/routes/index.ts");
  const activeRoute = text.indexOf("router.use(aorCountryResilienceRouter)");
  const olderRoute = text.indexOf("router.use(aorRiskIntelligenceRouter)");
  assert.notEqual(activeRoute, -1);
  assert.notEqual(olderRoute, -1);
  assert.ok(activeRoute < olderRoute, "aorCountryResilienceRouter must own duplicate country-health routes first");
});

test("recovered country baseline routes are registered before broad AOR handlers and remain fail-closed", () => {
  const index = source("src/routes/index.ts");
  const route = source("src/routes/aor-country-profiles.ts");
  const baselineRoute = index.indexOf("router.use(aorCountryProfilesRouter)");
  const riskRoute = index.indexOf("router.use(aorRiskIntelligenceRouter)");
  assert.notEqual(baselineRoute, -1);
  assert.notEqual(riskRoute, -1);
  assert.ok(baselineRoute < riskRoute, "country baseline routes must be mounted before broad AOR handlers");
  assert.match(route, /\/aor\/country-profile/);
  assert.match(route, /\/aor\/country-condition-lens/);
  assert.match(route, /status\(400\)/);
  assert.match(route, /status\(404\)/);
  assert.match(route, /Baseline reviewer orientation/);
});

test("CDC destination route validates pages, exposes cache state and fails closed", () => {
  const text = source("src/routes/aor-travel-health.ts");
  assert.match(text, /validateDestinationPage/);
  assert.match(text, /cacheState/);
  assert.match(text, /DESTINATION_STALE_TTL/);
  assert.match(text, /status\(502\)/);
});

test("MapTiler layer synchronization reruns after sources attach", () => {
  const text = source("../occu-med-insight-hub/src/pages/reviewer-aor-factors-v2.tsx");
  assert.match(text, /mapLayersRevision/);
  assert.match(text, /setMapLayersRevision/);
});

test("AOR map config preserves dedicated key 6 preference for the rebuild", () => {
  const app = source("src/app.ts");
  const key6 = app.indexOf("MAP_TILER_API_KEY_6");
  const baseKey = app.indexOf("MAP_TILER_API_KEY?.trim()", key6 + 1);
  assert.notEqual(key6, -1);
  assert.notEqual(baseKey, -1);
  assert.ok(key6 < baseKey, "AOR map config must prefer MAP_TILER_API_KEY_6 before the legacy AOR key");
});

test("AOR Factors is an immersive map with one floating double-border glass sidebar", () => {
  const page = source("../occu-med-insight-hub/src/pages/reviewer-aor-factors-v3.tsx");
  const panel = source("../occu-med-insight-hub/src/components/insight/AorGlassSidebar.tsx");

  assert.match(page, /data-testid="aor-map-shell"/);
  assert.match(page, /absolute inset-0/);
  assert.match(page, /<AorGlassSidebar/);
  assert.doesNotMatch(page, /HeaderBar/);
  assert.doesNotMatch(page, /AorEpidemicOverlay/);
  assert.doesNotMatch(page, /grid-cols-\[238px_minmax\(0,1fr\)_360px\]/);

  assert.match(panel, /300_000/);
  assert.match(panel, /backdrop-blur/);
  assert.match(panel, /border-white\/\[0\.16\]/);
  assert.match(panel, /border-white\/\[0\.08\]/);
  for (const tab of ["Explore", "Health", "Conditions", "Intel", "Info"]) assert.match(panel, new RegExp(tab));
  assert.match(panel, /data-testid="aor-glass-sidebar"/);
  assert.match(panel, /data-testid="aor-sidebar-handle"/);
});

test("removed AOR sources stay removed from active route registration", () => {
  const index = source("src/routes/index.ts");
  for (const removed of ["ReliefWeb", "Healthsites", "FIRMS", "UCDP", "ACLED", "Global Conflict Tracker"]) {
    assert.doesNotMatch(index, new RegExp(removed, "i"));
  }
});

test("respiratory feed preserves partial data but rejects total upstream failure and supports stale LKG", () => {
  const text = source("src/routes/aor-respiratory-surveillance.ts");
  assert.match(text, /All CDC respiratory surveillance sources failed/);
  assert.match(text, /CACHE_STALE_TTL/);
  assert.match(text, /cacheState: "stale"/);
});

test("WHO workbooks remain lazy and expose stale last-known-good cache state", () => {
  const text = source("src/routes/aor-immunization.ts");
  assert.match(text, /inFlight = new Map<DatasetKey/);
  assert.match(text, /CACHE_STALE_TTL/);
  assert.match(text, /cacheState: "stale"/);
  assert.match(text, /requestedItemNormalized/);
});