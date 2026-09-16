import test from "node:test";
import assert from "node:assert/strict";
import { regionEquivalent } from "../geospatial-country";
import {
  __resetGeospatialResolverStateForTests,
  resolveGeospatialBatch,
  resolveGeospatialLocation,
  type GeospatialResolveRequest,
} from "../geospatial-resolver";

type FetchInput = Parameters<typeof fetch>[0];

const managedEnv = [
  "GEOCODIO_API_KEY", "GEOCODIO_API_KEY_2", "GEOCODIO_API_KEY_3", "GEOCODIO_API_KEY_4", "GEOCODIO_API_KEY_5",
  "LOCATIONIQ_API_KEY", "LOCATIONIQ_API_KEY_2", "LOCATIONIQ_API_KEY_3", "LOCATIONIQ_API_KEY_4", "LOCATIONIQ_API_KEY_5",
  "MAP_TILER_API_KEY", "MAP_TILER_API_KEY_2", "ARCGIS_API_KEY",
] as const;
const originalEnv = Object.fromEntries(managedEnv.map((key) => [key, process.env[key]]));

function clearProviderEnv() {
  for (const key of managedEnv) delete process.env[key];
}

function restoreProviderEnv() {
  clearProviderEnv();
  for (const key of managedEnv) {
    const value = originalEnv[key];
    if (value !== undefined) process.env[key] = value;
  }
}

test.beforeEach(() => {
  clearProviderEnv();
  __resetGeospatialResolverStateForTests();
});

test.afterEach(() => {
  restoreProviderEnv();
  __resetGeospatialResolverStateForTests();
});

test("source coordinates bypass external providers", async () => {
  let calls = 0;
  const result = await resolveGeospatialLocation({
    query: "Known event",
    kind: "event",
    sourceCoordinates: { lat: 48.11, lon: 11.58 },
  }, {
    fetchImpl: (async () => {
      calls += 1;
      throw new Error("should not call provider");
    }) as typeof fetch,
  });

  assert.equal(result.provider, "source");
  assert.deepEqual(result.coordinates, { lat: 48.11, lon: 11.58 });
  assert.equal(result.validated, true);
  assert.equal(calls, 0);
});

test("canonical country aliases resolve without provider calls", async () => {
  let calls = 0;
  const result = await resolveGeospatialLocation({ query: "Ivory Coast", kind: "country" }, {
    fetchImpl: (async () => {
      calls += 1;
      throw new Error("should not call provider");
    }) as typeof fetch,
  });

  assert.equal(result.status, "resolved");
  assert.equal(result.provider, "canonical-country");
  assert.equal(result.iso2, "CI");
  assert.equal(calls, 0);
});

test("country-aware region aliases accept Canadian province abbreviations", () => {
  assert.equal(regionEquivalent("Ontario", "ON"), true);
  assert.equal(regionEquivalent("ON", "Ontario"), true);
});

test("global installation requests use LocationIQ country restriction", async () => {
  process.env.LOCATIONIQ_API_KEY = "test-locationiq-1";
  let requested = "";
  const result = await resolveGeospatialLocation({
    query: "Ramstein Air Base",
    kind: "installation",
    expectedCountry: "Germany",
    expectedIso2: "DE",
    expectedRegion: "Rhineland-Palatinate",
  }, {
    fetchImpl: (async (input: FetchInput) => {
      requested = String(input);
      return new Response(JSON.stringify([{
        lat: "49.4369",
        lon: "7.6003",
        display_name: "Ramstein Air Base, Rhineland-Palatinate, Germany",
        importance: 0.91,
        type: "aerodrome",
        address: { country: "Germany", country_code: "de", state: "Rhineland-Palatinate", city: "Ramstein-Miesenbach" },
      }]), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch,
  });

  assert.equal(result.status, "resolved");
  assert.equal(result.provider, "locationiq");
  assert.equal(result.iso2, "DE");
  assert.match(requested, /countrycodes=de/);
});

test("North American installation requests use Geocodio first", async () => {
  process.env.GEOCODIO_API_KEY = "test-geocodio-1";
  let requested = "";
  const result = await resolveGeospatialLocation({
    query: "Devens Reserve Forces Training Area",
    kind: "installation",
    expectedCountry: "United States",
    expectedIso2: "US",
    expectedRegion: "Massachusetts",
    city: "Devens",
  }, {
    fetchImpl: (async (input: FetchInput) => {
      requested = String(input);
      return new Response(JSON.stringify({
        results: [{
          formatted_address: "Devens, MA 01434",
          location: { lat: 42.5465, lng: -71.6137 },
          accuracy: 0.94,
          accuracy_type: "place",
          address_components: { city: "Devens", state: "MA", country: "US" },
        }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch,
  });

  assert.equal(result.status, "resolved");
  assert.equal(result.provider, "geocodio");
  assert.match(requested, /api\.geocod\.io/);
  assert.match(requested, /country=US/);
});

test("wrong-country provider result is rejected", async () => {
  process.env.LOCATIONIQ_API_KEY = "test-locationiq-1";
  const result = await resolveGeospatialLocation({
    query: "Spangdahlem Air Base",
    kind: "installation",
    expectedCountry: "Germany",
    expectedIso2: "DE",
  }, {
    fetchImpl: (async () => new Response(JSON.stringify([{
      lat: "30.0567",
      lon: "-90.5484",
      display_name: "Reserve, Louisiana, USA",
      importance: 0.9,
      address: { country: "United States of America", country_code: "us", state: "Louisiana" },
    }]), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch,
  });

  assert.equal(result.status, "unresolved");
  assert.equal(result.validated, false);
});

test("LocationIQ 429 cools down one slot and fails over to the next key", async () => {
  process.env.LOCATIONIQ_API_KEY = "test-locationiq-1";
  process.env.LOCATIONIQ_API_KEY_2 = "test-locationiq-2";
  const seen: string[] = [];
  const result = await resolveGeospatialLocation({
    query: "Aviano Air Base",
    kind: "installation",
    expectedCountry: "Italy",
    expectedIso2: "IT",
  }, {
    now: () => 1000,
    fetchImpl: (async (input: FetchInput) => {
      const url = String(input);
      seen.push(url);
      if (url.includes("test-locationiq-1")) return new Response("rate limited", { status: 429 });
      return new Response(JSON.stringify([{
        lat: "46.0319",
        lon: "12.5965",
        display_name: "Aviano Air Base, Italy",
        importance: 0.91,
        address: { country: "Italy", country_code: "it", state: "Friuli-Venezia Giulia", city: "Aviano" },
      }]), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch,
  });

  assert.equal(result.status, "resolved");
  assert.equal(result.providerKeySlot, 2);
  assert.equal(seen.length, 2);
});

test("batch de-duplicates truly identical requests", async () => {
  process.env.LOCATIONIQ_API_KEY = "test-locationiq-1";
  let calls = 0;
  const request: GeospatialResolveRequest = { query: "Aviano Air Base", kind: "installation", expectedCountry: "Italy", expectedIso2: "IT" };
  const results = await resolveGeospatialBatch([request, request], {
    fetchImpl: (async () => {
      calls += 1;
      return new Response(JSON.stringify([{
        lat: "46.0319",
        lon: "12.5965",
        display_name: "Aviano Air Base, Italy",
        importance: 0.91,
        address: { country: "Italy", country_code: "it", state: "Friuli-Venezia Giulia", city: "Aviano" },
      }]), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch,
  });

  assert.equal(results.length, 2);
  assert.equal(calls, 1);
});

test("batch keeps distinct source-coordinate requests independent", async () => {
  const results = await resolveGeospatialBatch([
    { query: "", kind: "event", sourceCoordinates: { lat: 10, lon: 20 } },
    { query: "", kind: "event", sourceCoordinates: { lat: 30, lon: 40 } },
  ]);
  assert.deepEqual(results[0].coordinates, { lat: 10, lon: 20 });
  assert.deepEqual(results[1].coordinates, { lat: 30, lon: 40 });
});

test("cache hit preserves the current request query while retaining normalized cache identity", async () => {
  const cache = {
    async get() {
      return {
        status: "resolved" as const,
        query: "kuwait",
        normalizedQuery: "kuwait",
        coordinates: { lat: 29.3117, lon: 47.4818 },
        provider: "cache" as const,
        validated: true,
        validation: { countryMatch: true, regionMatch: null, coordinateValid: true, corroborated: true, reasons: [] },
        cacheHit: true,
        resolvedAt: new Date(0).toISOString(),
      };
    },
    async set() {},
  };
  const result = await resolveGeospatialLocation({ query: "Kuwait City", kind: "city", expectedCountry: "Kuwait" }, { cache });
  assert.equal(result.query, "Kuwait City");
  assert.equal(result.normalizedQuery, "kuwait");
});

test("corroborated invalid primary does not short-circuit a valid secondary candidate", async () => {
  process.env.GEOCODIO_API_KEY = "test-geocodio-1";
  process.env.LOCATIONIQ_API_KEY = "test-locationiq-1";
  const result = await resolveGeospatialLocation({
    query: "Test Installation",
    kind: "installation",
    expectedCountry: "United States",
    expectedIso2: "US",
    expectedRegion: "Massachusetts",
  }, {
    fetchImpl: (async (input: FetchInput) => {
      const url = String(input);
      if (url.includes("api.geocod.io")) {
        return new Response(JSON.stringify({ results: [{
          formatted_address: "Test Installation, NH",
          location: { lat: 42.55, lng: -71.62 },
          accuracy: 0.7,
          accuracy_type: "place",
          address_components: { city: "Test", state: "NH", country: "US" },
        }] }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify([{
        lat: "42.55", lon: "-71.62", display_name: "Test Installation, Massachusetts, USA", importance: 0.9,
        address: { country: "United States", country_code: "us", state: "Massachusetts", city: "Test" },
      }]), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch,
  });
  assert.equal(result.status, "resolved");
  assert.equal(result.provider, "locationiq");
  assert.equal(result.region, "Massachusetts");
});

test("provider requests are aborted within the configured test timeout", async () => {
  process.env.LOCATIONIQ_API_KEY = "test-locationiq-1";
  const started = Date.now();
  const result = await resolveGeospatialLocation({ query: "Aviano Air Base", kind: "installation", expectedCountry: "Italy", expectedIso2: "IT" }, {
    fetchTimeoutMs: 20,
    fetchImpl: ((_: FetchInput, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    })) as typeof fetch,
  });
  assert.equal(result.status, "unresolved");
  assert.ok(Date.now() - started < 1000);
});