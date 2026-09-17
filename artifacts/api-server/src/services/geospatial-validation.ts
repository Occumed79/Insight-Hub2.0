import { expectedIso2, normalizeText, regionEquivalent, validCoordinates } from "./geospatial-country";
import type { GeospatialCandidate, GeospatialResolveRequest, GeospatialResolution } from "./geospatial-types";

export function normalizedQuery(request: GeospatialResolveRequest): string {
  return [request.query, request.city, request.expectedRegion, request.expectedCountry || request.expectedIso2]
    .map(normalizeText)
    .filter(Boolean)
    .join(" | ");
}

export function validateCandidate(request: GeospatialResolveRequest, candidate: GeospatialCandidate) {
  const reasons: string[] = [];
  const coordinateValid = validCoordinates(candidate.lat, candidate.lon);
  if (!coordinateValid) reasons.push("invalid coordinates");

  const expectedCountry = expectedIso2(request);
  const actualCountry = String(candidate.iso2 || "").trim().toUpperCase();
  const countryMatch = expectedCountry ? actualCountry === expectedCountry : null;
  if (expectedCountry && !countryMatch) reasons.push(`country mismatch (${actualCountry || "unknown"} != ${expectedCountry})`);

  const regionMatch = request.expectedRegion ? regionEquivalent(request.expectedRegion, candidate.region) : null;
  if (request.expectedRegion && !regionMatch) reasons.push(`region mismatch (${candidate.region || "unknown"})`);

  return {
    accepted: coordinateValid && countryMatch !== false && regionMatch !== false,
    countryMatch,
    regionMatch,
    coordinateValid,
    reasons,
  };
}

export function unresolvedResolution(request: GeospatialResolveRequest, reasons: string[]): GeospatialResolution {
  return {
    status: "unresolved",
    query: request.query,
    normalizedQuery: normalizedQuery(request),
    provider: "none",
    validated: false,
    validation: { countryMatch: null, regionMatch: null, coordinateValid: false, corroborated: false, reasons },
    cacheHit: false,
    resolvedAt: new Date().toISOString(),
  };
}

export function resolutionFromCandidate(request: GeospatialResolveRequest, candidate: GeospatialCandidate, corroborated = false): GeospatialResolution {
  const checked = validateCandidate(request, candidate);
  return {
    status: checked.accepted ? "resolved" : "unresolved",
    query: request.query,
    normalizedQuery: normalizedQuery(request),
    coordinates: checked.accepted ? { lat: candidate.lat, lon: candidate.lon } : undefined,
    provider: checked.accepted ? candidate.provider : "none",
    providerKeySlot: checked.accepted ? candidate.slot : undefined,
    matchedAddress: candidate.matchedAddress,
    country: candidate.country,
    iso2: candidate.iso2,
    region: candidate.region,
    city: candidate.city,
    confidence: candidate.confidence,
    precision: candidate.precision,
    bbox: candidate.bbox,
    validated: checked.accepted,
    validation: {
      countryMatch: checked.countryMatch,
      regionMatch: checked.regionMatch,
      coordinateValid: checked.coordinateValid,
      corroborated,
      reasons: checked.reasons,
    },
    cacheHit: false,
    resolvedAt: new Date().toISOString(),
  };
}

export function haversineKm(a: GeospatialCandidate, b: GeospatialCandidate): number {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const lat1 = rad(a.lat);
  const lat2 = rad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}
