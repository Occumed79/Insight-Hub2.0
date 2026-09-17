import test from "node:test";
import assert from "node:assert/strict";
import { regionEquivalent } from "../geospatial-country";
import {
  __resetGeospatialResolverStateForTests,
  resolveGeospatialBatch,
  resolveGeospatialLocation,
  type GeospatialResolveRequest,
} from "../geospatial-resolver";
import type { GeospatialCache } from "../geospatial-types";

const managedEnv = [
  "GEOCODIO_API_KEY", "GEOCODIO_API_KEY_2",
  "LOCATIONIQ_API_KEY", "LOCATIONIQ_API_KEY_2",
  "MAP_TILER_API_KEY", "MAP_TILER_API_KEY_2", "ARCGIS_API_KEY",
] as const;
const originalEnv = Object.fromEntries(managedEnv.map((key) => [key, process.env[key]]));

function clearEnv() {
  for (const key of managedEnv) delete process.env[key];
}

function restoreEnv() {
  clearEnv();
  for (const key of managedEnv) {
    const value = originalEnv[key];
    if (value !== undefined) process.env[key] = value;
  }
}

test.beforeEach(() => {
  clearEnv();
  __resetGeospatialResolverStateForTests();
});

test.afterEach(() => {
  restoreEnv();
  __resetGeospatialResolverStateForTests();
});

test("Canadian province names and abbreviations are equivalent", () => {
  assert.equal(regionEquivalent("Ontario", "ON"), true);
  assert.equal(regionEquivalent("British Columbia", "BC"), true);
});

test("cache hits preserve the current request query while keeping cached normalization", async () => {
  const cache: GeospatialCache = {
    async get() {
      return {
        status: "resolved",
        query: "kuwait",
        normalizedQuery: "kuwait",
        coordinates: { lat: 29.3117, lon: 47.4818 },
        provider: "cache",
        country: "Kuwait",
        iso2: "KW",
        validated: true,
        validation: { countryMatch: true, regionMatch: null, coordinateValid: true, corroborated: true, reasons: [] },
        cacheHit: true,
        resolvedAt: new Date(0).toISOString(),
      };
    },
    async set() {},
  };

  const result = await resolveGeospatialLocation({ query: "Kuwait", kind: "city" }, { cache });
  assert.equal(result.query, "Kuwait");
  assert.equal(result.normalizedQuery, "kuwait");
});

test("batch keeps distinct source-coordinate requests independent", async () => {
  const requests: GeospatialResolveRequest[] = [
    { query: "", kind: "event", sourceCoordinates: { lat: 10, lon: 20 } },
    { query: "", kind: "event", sourceCoordinates: { lat: 30, lon: 40 } },
  ];

  const results = await resolveGeospatialBatch(requests);
  assert.deepEqual(results[0].coordinates, { lat: 10, lon: 20 });
  assert.deepEqual(results[1].coordinates, { lat: 30, lon: 40 });
});

test("invalid corroborated primary continues to a validated fallback", async () => {
  process.env.GEOCODIO_API_KEY = "geo-key";
  process.env.LOCATIONIQ_API_KEY = "li-key";
  process.env.MAP_TILER_API_KEY_2 = "map-key";

  const result = await resolveGeospatialLocation({
    query: "Example Installation",
    kind: "installation",
    expectedCountry: "United States",
    expectedIso2: "US",
    expectedRegion: "California",
  }, {
    fetchImpl: (async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      if (url.includes("api.geocod.io")) {
        return new Response(JSON.stringify({ results: [{
          formatted_address: "Example, Nevada, US",
          location: { lat: 36.1, lng: -115.1 },
          accuracy: 0.5,
          accuracy_type: "place",
          address_components: { state: "NV", country: "US" },
        }] }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.includes("locationiq.com")) {
        return new Response(JSON.stringify([{
          lat: "36.11",
          lon: "-115.11",
          display_name: "Example, Nevada, United States",
          importance: 0.9,
          address: { country: "United States", country_code: "us", state_code: "NV" },
        }]), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.includes("api.maptiler.com")) {
        return new Response(JSON.stringify({ features: [{
          center: [-118.24, 34.05],
          text: "Example Installation",
          place_name: "Example Installation, California, United States",
          relevance: 0.95,
          place_type: ["poi"],
          properties: { country_code: "US", region: "California" },
          context: [
            { id: "region.ca", text: "California" },
            { id: "country.us", text: "United States", properties: { short_code: "us" } },
          ],
        }] }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ candidates: [] }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch,
  });

  assert.equal(result.status, "resolved");
  assert.equal(result.provider, "maptiler");
  assert.equal(result.region, "California");
});
