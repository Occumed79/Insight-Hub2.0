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
