export type GeoPlaceProvider = "geoapify" | "locationiq";

export type GeoPlaceSearchHint = {
  label?: string;
  latitude: number;
  longitude: number;
};

export type GeoPlaceCandidate = {
  id: string;
  companyName: string;
  placeName: string;
  formattedAddress: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country: string;
  region?: string;
  facilityType?: string;
  activity?: string;
  notes?: string;
  coordinates: [number, number];
  geocodeSource: "geoapify" | "locationiq";
  geocodeConfidence: "exact" | "place" | "city" | "unknown";
  sourceType: string;
  sourceClass: string;
  sourceId: string;
  reviewStatus: "candidate" | "needs-review";
  sourceUrl?: string;
  sourceTitle?: string;
  evidenceSnippet?: string;
  discoveredBy: "geoapify" | "locationiq";
};

export type GeoPlaceDiagnostic = {
  source: GeoPlaceProvider;
  status: "success" | "partial" | "no-results" | "not-configured" | "error";
  resultsFound: number;
  message: string;
  error?: string;
};

export type GeoPlaceDiscoveryResult = {
  locations: GeoPlaceCandidate[];
  diagnostics: GeoPlaceDiagnostic[];
  warnings: string[];
  geoapifyRequestsMade: number;
  geoapifyKeysConfigured: number;
  locationiqRequestsMade: number;
  locationiqKeysConfigured: number;
};

type SearchArea = { label: string; latitude: number; longitude: number };

const FALLBACK_AREAS: SearchArea[] = [
  { label: "New York, NY", latitude: 40.7128, longitude: -74.0060 },
  { label: "Washington, DC", latitude: 38.9072, longitude: -77.0369 },
  { label: "Atlanta, GA", latitude: 33.7490, longitude: -84.3880 },
  { label: "Chicago, IL", latitude: 41.8781, longitude: -87.6298 },
  { label: "Dallas, TX", latitude: 32.7767, longitude: -96.7970 },
  { label: "Houston, TX", latitude: 29.7604, longitude: -95.3698 },
  { label: "Denver, CO", latitude: 39.7392, longitude: -104.9903 },
  { label: "Los Angeles, CA", latitude: 34.0522, longitude: -118.2437 },
  { label: "San Francisco, CA", latitude: 37.7749, longitude: -122.4194 },
  { label: "Seattle, WA", latitude: 47.6062, longitude: -122.3321 },
  { label: "Toronto, Canada", latitude: 43.6532, longitude: -79.3832 },
  { label: "Mexico City, Mexico", latitude: 19.4326, longitude: -99.1332 },
  { label: "London, UK", latitude: 51.5074, longitude: -0.1278 },
  { label: "Frankfurt, Germany", latitude: 50.1109, longitude: 8.6821 },
  { label: "Warsaw, Poland", latitude: 52.2297, longitude: 21.0122 },
  { label: "Dubai, UAE", latitude: 25.2048, longitude: 55.2708 },
  { label: "Singapore", latitude: 1.3521, longitude: 103.8198 },
  { label: "Tokyo, Japan", latitude: 35.6762, longitude: 139.6503 },
  { label: "Sydney, Australia", latitude: -33.8688, longitude: 151.2093 },
];

let nextGeoapifyKeyIndex = 0;
let nextLocationiqKeyIndex = 0;

function normalize(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function companyTokens(companyName: string): string[] {
  const ignored = new Set([
    "inc", "incorporated", "llc", "ltd", "limited", "corp", "corporation",
    "company", "companies", "group", "holdings", "plc", "the",
  ]);
  return normalize(companyName)
    .split(" ")
    .filter((token) => token.length > 2 && !ignored.has(token));
}

function scoreName(companyName: string, candidateName: string, extra: string[] = []): number {
  const company = normalize(companyName);
  const names = [candidateName, ...extra].map(normalize).filter(Boolean);
  const tokens = companyTokens(companyName);
  let score = 0;

  for (const name of names) {
    if (name === company) score = Math.max(score, 120);
    if (name.includes(company) || company.includes(name)) score = Math.max(score, 75);
  }

  const haystack = names.join(" ");
  const matches = tokens.filter((token) => haystack.includes(token)).length;
  score += matches * 24;
  if (tokens.length > 0 && matches === tokens.length) score += 35;
  return score;
}

function uniqueKeys(values: Array<string | undefined>): string[] {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .filter((value, index, all) => all.indexOf(value) === index);
}

function geoapifyKeys(): string[] {
  return uniqueKeys([
    process.env.GEOAPIFY_API_KEY,
    process.env.GEOAPIFY_API_KEY_2,
    process.env.GEOAPIFY_API_KEY_3,
    process.env.GEOAPIFY_API_KEY_4,
  ]);
}

function locationiqKeys(): string[] {
  return uniqueKeys([
    process.env.LOCATIONIQ_API_KEY,
    process.env.LOCATIONIQ_API_KEY_2,
    process.env.LOCATIONIQ_API_KEY_3,
    process.env.LOCATIONIQ_API_KEY_4,
  ]);
}

function requestBudget(name: "GEOAPIFY_LOCATION_MAX_QUERIES" | "LOCATIONIQ_LOCATION_MAX_QUERIES", fallback: number): number {
  const parsed = Number(process.env[name] || fallback);
  return Number.isFinite(parsed) ? Math.max(2, Math.min(60, Math.floor(parsed))) : fallback;
}

function dedupeAreas(hints: GeoPlaceSearchHint[]): SearchArea[] {
  const seen = new Set<string>();
  const output: SearchArea[] = [];
  const add = (area: SearchArea) => {
    if (!Number.isFinite(area.latitude) || !Number.isFinite(area.longitude)) return;
    const key = `${area.latitude.toFixed(1)}|${area.longitude.toFixed(1)}`;
    if (seen.has(key)) return;
    seen.add(key);
    output.push(area);
  };

  hints.forEach((hint) => add({
    label: hint.label || `${hint.latitude.toFixed(3)},${hint.longitude.toFixed(3)}`,
    latitude: hint.latitude,
    longitude: hint.longitude,
  }));
  FALLBACK_AREAS.forEach(add);
  return output;
}

async function geoapifyRequest(buildUrl: (key: string) => URL): Promise<{ payload: any; attempts: number }> {
  const keys = geoapifyKeys();
  if (!keys.length) throw new Error("Geoapify is not configured");
  const start = nextGeoapifyKeyIndex % keys.length;
  const errors: string[] = [];
  let attempts = 0;

  for (let offset = 0; offset < keys.length; offset += 1) {
    const index = (start + offset) % keys.length;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9_000);
    attempts += 1;
    try {
      const response = await fetch(buildUrl(keys[index]), {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        nextGeoapifyKeyIndex = (index + 1) % keys.length;
        return { payload, attempts };
      }
      const detail = String(payload?.message || payload?.error || payload?.error_code || `HTTP ${response.status}`).slice(0, 180);
      errors.push(`key ${index + 1}: ${detail}`);
      if (![401, 403, 429, 500, 502, 503, 504].includes(response.status)) break;
    } catch (error) {
      errors.push(`key ${index + 1}: ${error instanceof Error ? error.message : "request failed"}`);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(errors.join("; ") || "Geoapify request failed");
}

async function locationiqRequest(buildUrl: (key: string) => URL): Promise<{ payload: any; attempts: number }> {
  const keys = locationiqKeys();
  if (!keys.length) throw new Error("LocationIQ is not configured");
  const start = nextLocationiqKeyIndex % keys.length;
  const errors: string[] = [];
  let attempts = 0;

  for (let offset = 0; offset < keys.length; offset += 1) {
    const index = (start + offset) % keys.length;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9_000);
    attempts += 1;
    try {
      const response = await fetch(buildUrl(keys[index]), {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        nextLocationiqKeyIndex = (index + 1) % keys.length;
        return { payload, attempts };
      }
      const detail = String(payload?.error || payload?.message || `HTTP ${response.status}`).slice(0, 180);
      errors.push(`key ${index + 1}: ${detail}`);
      if (![401, 403, 429, 500, 502, 503, 504].includes(response.status)) break;
    } catch (error) {
      errors.push(`key ${index + 1}: ${error instanceof Error ? error.message : "request failed"}`);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(errors.join("; ") || "LocationIQ request failed");
}

function geoapifyCandidate(companyName: string, item: any): GeoPlaceCandidate | null {
  const latitude = Number(item?.lat);
  const longitude = Number(item?.lon);
  const id = String(item?.place_id || item?.datasource?.raw?.osm_id || `${latitude},${longitude}`).trim();
  const name = String(item?.name || item?.address_line1 || item?.formatted || "").trim();
  const formattedAddress = String(item?.formatted || [item?.address_line1, item?.address_line2].filter(Boolean).join(", ") || name).trim();
  const score = scoreName(companyName, name, [item?.formatted, item?.address_line1, item?.datasource?.raw?.name]);
  if (!id || !Number.isFinite(latitude) || !Number.isFinite(longitude) || score < 45) return null;

  const exact = Boolean(item?.housenumber || item?.postcode || item?.street);
  return {
    id: `geoapify-${id}`,
    companyName,
    placeName: name || companyName,
    formattedAddress,
    city: item?.city || item?.municipality || item?.county,
    state: item?.state,
    postalCode: item?.postcode,
    country: item?.country || item?.country_code || "Unknown",
    region: item?.state || item?.country || item?.country_code || "Unknown",
    facilityType: item?.category || item?.result_type || "Geoapify place",
    activity: "Physical company location identified by Geoapify Geocoding API",
    notes: `Company-name geographic match from Geoapify${item?.rank?.confidence ? `; confidence ${item.rank.confidence}` : ""}.`,
    coordinates: [longitude, latitude],
    geocodeSource: "geoapify",
    geocodeConfidence: exact ? "exact" : item?.city ? "place" : "unknown",
    sourceType: String(item?.result_type || item?.category || "place"),
    sourceClass: "geoapify-geocoder",
    sourceId: id,
    reviewStatus: score >= 80 ? "candidate" : "needs-review",
    sourceTitle: "Geoapify Geocoding API",
    evidenceSnippet: `${name || companyName} — ${formattedAddress}`,
    discoveredBy: "geoapify",
  };
}

function locationiqCandidate(companyName: string, item: any): GeoPlaceCandidate | null {
  const latitude = Number(item?.lat);
  const longitude = Number(item?.lon);
  const id = String(item?.place_id || `${item?.osm_type || "osm"}-${item?.osm_id || `${latitude},${longitude}`}`).trim();
  const address = item?.address || {};
  const displayName = String(item?.display_name || "").trim();
  const firstLabel = displayName.split(",")[0]?.trim() || "";
  const explicitName = String(item?.namedetails?.name || item?.name || firstLabel || companyName).trim();
  const score = scoreName(companyName, explicitName, [displayName]);
  if (!id || !Number.isFinite(latitude) || !Number.isFinite(longitude) || score < 45) return null;

  const city = address?.city || address?.town || address?.village || address?.municipality || address?.county;
  const exact = Boolean(address?.house_number || address?.road || address?.postcode);
  return {
    id: `locationiq-${id}`,
    companyName,
    placeName: explicitName,
    formattedAddress: displayName || explicitName,
    city,
    state: address?.state || address?.state_code,
    postalCode: address?.postcode,
    country: address?.country || address?.country_code || "Unknown",
    region: address?.state || address?.country || address?.country_code || "Unknown",
    facilityType: item?.type || item?.class || "LocationIQ place",
    activity: "Physical company location identified by LocationIQ Search API",
    notes: "Company-name address/location match from LocationIQ.",
    coordinates: [longitude, latitude],
    geocodeSource: "locationiq",
    geocodeConfidence: exact ? "exact" : city ? "place" : "unknown",
    sourceType: String(item?.type || item?.class || "place"),
    sourceClass: "locationiq-geocoder",
    sourceId: id,
    reviewStatus: score >= 80 ? "candidate" : "needs-review",
    sourceTitle: "LocationIQ Search API",
    evidenceSnippet: `${explicitName} — ${displayName}`,
    discoveredBy: "locationiq",
  };
}

async function searchGeoapify(companyName: string, area: SearchArea): Promise<{ candidates: GeoPlaceCandidate[]; attempts: number }> {
  const result = await geoapifyRequest((key) => {
    const url = new URL("https://api.geoapify.com/v1/geocode/search");
    url.searchParams.set("text", companyName);
    url.searchParams.set("format", "json");
    url.searchParams.set("filter", `circle:${area.longitude},${area.latitude},100000`);
    url.searchParams.set("bias", `proximity:${area.longitude},${area.latitude}`);
    url.searchParams.set("limit", "20");
    url.searchParams.set("lang", "en");
    url.searchParams.set("apiKey", key);
    return url;
  });
  const rows = Array.isArray(result.payload?.results) ? result.payload.results : [];
  return {
    candidates: rows
      .map((row: any) => geoapifyCandidate(companyName, row))
      .filter((candidate: GeoPlaceCandidate | null): candidate is GeoPlaceCandidate => Boolean(candidate)),
    attempts: result.attempts,
  };
}

function viewboxFor(area: SearchArea): string {
  const latDelta = 0.9;
  const cosine = Math.max(0.25, Math.cos((area.latitude * Math.PI) / 180));
  const lonDelta = Math.min(2.5, 0.9 / cosine);
  const minLon = Math.max(-180, area.longitude - lonDelta);
  const maxLon = Math.min(180, area.longitude + lonDelta);
  const minLat = Math.max(-90, area.latitude - latDelta);
  const maxLat = Math.min(90, area.latitude + latDelta);
  return `${minLon},${minLat},${maxLon},${maxLat}`;
}

async function searchLocationIQ(companyName: string, area: SearchArea): Promise<{ candidates: GeoPlaceCandidate[]; attempts: number }> {
  const result = await locationiqRequest((key) => {
    const url = new URL("https://us1.locationiq.com/v1/search");
    url.searchParams.set("key", key);
    url.searchParams.set("q", companyName);
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("namedetails", "1");
    url.searchParams.set("normalizeaddress", "1");
    url.searchParams.set("normalizecity", "1");
    url.searchParams.set("viewbox", viewboxFor(area));
    url.searchParams.set("bounded", "1");
    url.searchParams.set("limit", "20");
    url.searchParams.set("accept-language", "en");
    return url;
  });
  const rows = Array.isArray(result.payload) ? result.payload : [];
  return {
    candidates: rows
      .map((row: any) => locationiqCandidate(companyName, row))
      .filter((candidate: GeoPlaceCandidate | null): candidate is GeoPlaceCandidate => Boolean(candidate)),
    attempts: result.attempts,
  };
}

export async function discoverGeoPlaces(
  companyName: string,
  hints: GeoPlaceSearchHint[] = [],
): Promise<GeoPlaceDiscoveryResult> {
  const areas = dedupeAreas(hints);
  const geoapifyLimit = requestBudget("GEOAPIFY_LOCATION_MAX_QUERIES", 24);
  const locationiqLimit = requestBudget("LOCATIONIQ_LOCATION_MAX_QUERIES", 8);
  const byId = new Map<string, GeoPlaceCandidate>();
  const diagnostics: GeoPlaceDiagnostic[] = [];
  const warnings: string[] = [];
  const geoapifyErrors: string[] = [];
  const locationiqErrors: string[] = [];
  let geoapifyRequestsMade = 0;
  let locationiqRequestsMade = 0;

  if (geoapifyKeys().length) {
    for (const area of areas) {
      if (geoapifyRequestsMade >= geoapifyLimit) break;
      try {
        const result = await searchGeoapify(companyName, area);
        geoapifyRequestsMade += result.attempts;
        result.candidates.forEach((candidate) => byId.set(candidate.id, candidate));
      } catch (error) {
        geoapifyRequestsMade += 1;
        geoapifyErrors.push(`${area.label}: ${error instanceof Error ? error.message : "search failed"}`);
      }
    }
    const count = Array.from(byId.values()).filter((candidate) => candidate.discoveredBy === "geoapify").length;
    diagnostics.push({
      source: "geoapify",
      status: count ? geoapifyErrors.length ? "partial" : "success" : geoapifyErrors.length ? "error" : "no-results",
      resultsFound: count,
      message: `Geoapify identified ${count} candidate(s) using ${geoapifyRequestsMade} request attempt(s) across ${geoapifyKeys().length} configured key(s).`,
      error: !count && geoapifyErrors.length ? geoapifyErrors.slice(0, 3).join("; ") : undefined,
    });
  } else {
    diagnostics.push({ source: "geoapify", status: "not-configured", resultsFound: 0, message: "No Geoapify API key is configured." });
  }

  if (locationiqKeys().length) {
    for (const area of areas) {
      if (locationiqRequestsMade >= locationiqLimit) break;
      try {
        const result = await searchLocationIQ(companyName, area);
        locationiqRequestsMade += result.attempts;
        result.candidates.forEach((candidate) => byId.set(candidate.id, candidate));
      } catch (error) {
        locationiqRequestsMade += 1;
        locationiqErrors.push(`${area.label}: ${error instanceof Error ? error.message : "search failed"}`);
      }
    }
    const count = Array.from(byId.values()).filter((candidate) => candidate.discoveredBy === "locationiq").length;
    diagnostics.push({
      source: "locationiq",
      status: count ? locationiqErrors.length ? "partial" : "success" : locationiqErrors.length ? "error" : "no-results",
      resultsFound: count,
      message: `LocationIQ identified ${count} candidate(s) using ${locationiqRequestsMade} request attempt(s) across ${locationiqKeys().length} configured key(s).`,
      error: !count && locationiqErrors.length ? locationiqErrors.slice(0, 3).join("; ") : undefined,
    });
  } else {
    diagnostics.push({ source: "locationiq", status: "not-configured", resultsFound: 0, message: "No LocationIQ API key is configured." });
  }

  if (geoapifyRequestsMade >= geoapifyLimit) warnings.push(`Geoapify discovery reached its per-company request budget (${geoapifyLimit}).`);
  if (locationiqRequestsMade >= locationiqLimit) warnings.push(`LocationIQ discovery reached its per-company request budget (${locationiqLimit}).`);
  if (geoapifyErrors.length && byId.size) warnings.push(`Geoapify returned partial coverage; ${geoapifyErrors.length} geographic request(s) failed.`);
  if (locationiqErrors.length && byId.size) warnings.push(`LocationIQ returned partial coverage; ${locationiqErrors.length} geographic request(s) failed.`);

  return {
    locations: Array.from(byId.values()).slice(0, 400),
    diagnostics,
    warnings,
    geoapifyRequestsMade,
    geoapifyKeysConfigured: geoapifyKeys().length,
    locationiqRequestsMade,
    locationiqKeysConfigured: locationiqKeys().length,
  };
}
