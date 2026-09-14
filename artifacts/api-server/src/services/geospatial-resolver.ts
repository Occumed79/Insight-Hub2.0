import { geospatialCacheKey } from "./geospatial-cache-key";
import { canonicalCountry, expectedIso2, validCoordinates } from "./geospatial-country";
import { resolveExternalGeospatial } from "./geospatial-external";
import { describeProviderPool, resetProviderPoolsForTests } from "./geospatial-key-pool";
import { normalizedQuery, unresolvedResolution } from "./geospatial-validation";
import type { GeospatialResolveRequest, GeospatialResolution, ResolverDependencies } from "./geospatial-types";

export type { GeospatialResolveRequest, GeospatialResolution } from "./geospatial-types";

export async function resolveGeospatialLocation(
  request: GeospatialResolveRequest,
  deps: ResolverDependencies = {},
): Promise<GeospatialResolution> {
  const normalizedRequest: GeospatialResolveRequest = {
    ...request,
    query: String(request.query || "").trim(),
  };

  if (request.sourceCoordinates && validCoordinates(request.sourceCoordinates.lat, request.sourceCoordinates.lon)) {
    return {
      status: "resolved",
      query: normalizedRequest.query,
      normalizedQuery: normalizedQuery(normalizedRequest),
      coordinates: { lat: request.sourceCoordinates.lat, lon: request.sourceCoordinates.lon },
      provider: "source",
      country: request.expectedCountry,
      iso2: expectedIso2(normalizedRequest) || undefined,
      region: request.expectedRegion,
      city: request.city,
      validated: true,
      validation: { countryMatch: null, regionMatch: null, coordinateValid: true, corroborated: true, reasons: [] },
      cacheHit: false,
      resolvedAt: new Date(deps.now?.() ?? Date.now()).toISOString(),
    };
  }

  if (!normalizedRequest.query) {
    return unresolvedResolution(normalizedRequest, ["Query is required when source coordinates are absent."]);
  }

  if (normalizedRequest.kind === "country") {
    const country = canonicalCountry(normalizedRequest.query);
    if (country?.center) {
      return {
        status: "resolved",
        query: normalizedRequest.query,
        normalizedQuery: normalizedQuery(normalizedRequest),
        coordinates: { lon: country.center[0], lat: country.center[1] },
        provider: "canonical-country",
        matchedAddress: country.name,
        country: country.name,
        iso2: country.iso2,
        bbox: country.bbox,
        validated: true,
        validation: { countryMatch: true, regionMatch: null, coordinateValid: true, corroborated: true, reasons: [] },
        cacheHit: false,
        resolvedAt: new Date(deps.now?.() ?? Date.now()).toISOString(),
      };
    }
  }

  const cacheKey = geospatialCacheKey(normalizedRequest);
  if (!normalizedRequest.forceRefresh && deps.cache) {
    const cached = await deps.cache.get(cacheKey).catch(() => null);
    if (cached?.status === "resolved" && cached.validated && cached.coordinates) {
      return { ...cached, provider: "cache", cacheHit: true };
    }
  }

  const result = await resolveExternalGeospatial(normalizedRequest, deps);
  if (result.status === "resolved" && result.validated && deps.cache) {
    await deps.cache.set(cacheKey, normalizedRequest, result).catch(() => undefined);
  }
  return result;
}

export async function resolveGeospatialBatch(
  requests: GeospatialResolveRequest[],
  deps: ResolverDependencies = {},
): Promise<GeospatialResolution[]> {
  const work = new Map<string, Promise<GeospatialResolution>>();
  return Promise.all(requests.map((request) => {
    const key = geospatialCacheKey(request);
    const existing = work.get(key);
    if (existing) return existing;
    const promise = resolveGeospatialLocation(request, deps);
    work.set(key, promise);
    return promise;
  }));
}

export function getGeospatialResolverStatus(deps: ResolverDependencies = {}) {
  return {
    geocodio: describeProviderPool("geocodio", deps),
    locationiq: describeProviderPool("locationiq", deps),
    fallbacks: {
      maptiler: Boolean((process.env.MAP_TILER_API_KEY_2 || process.env.MAP_TILER_API_KEY || "").trim()),
      arcgis: Boolean((process.env.ARCGIS_API_KEY || "").trim()),
    },
    providerOrder: ["source", "canonical-country", "cache", "geocodio-or-locationiq", "maptiler", "arcgis", "unresolved"],
  };
}

export function __resetGeospatialResolverStateForTests() {
  resetProviderPoolsForTests();
}
