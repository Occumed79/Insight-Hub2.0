export type CommercialPlaceProvider = "tomtom";

export type CommercialPlaceSearchHint = {
  label?: string;
  latitude: number;
  longitude: number;
};

export type CommercialPlaceCandidate = {
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
  geocodeSource: "tomtom";
  geocodeConfidence: "exact" | "place" | "city" | "unknown";
  sourceType: string;
  sourceClass: string;
  sourceId: string;
  reviewStatus: "candidate" | "needs-review";
  sourceUrl?: string;
  sourceTitle?: string;
  evidenceSnippet?: string;
  discoveredBy: "tomtom";
};

export type CommercialPlaceDiagnostic = {
  source: CommercialPlaceProvider;
  status: "success" | "partial" | "no-results" | "not-configured" | "error";
  resultsFound: number;
  message: string;
  error?: string;
};

export type CommercialPlaceDiscoveryResult = {
  locations: CommercialPlaceCandidate[];
  diagnostics: CommercialPlaceDiagnostic[];
  warnings: string[];
  tomtomRequestsMade: number;
  tomtomKeysConfigured: number;
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

let nextTomTomKeyIndex = 0;

function normalize(value: unknown): string {
  return String(value || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function companyTokens(companyName: string): string[] {
  const ignored = new Set(["inc", "incorporated", "llc", "ltd", "limited", "corp", "corporation", "company", "companies", "group", "holdings", "plc", "the"]);
  return normalize(companyName).split(" ").filter((token) => token.length > 2 && !ignored.has(token));
}

function scoreName(companyName: string, candidateName: string, brandNames: string[] = []): number {
  const company = normalize(companyName);
  const name = normalize(candidateName);
  const brands = brandNames.map(normalize).filter(Boolean);
  const tokens = companyTokens(companyName);
  let score = 0;
  if (name === company) score += 100;
  if (name.includes(company) || company.includes(name)) score += 55;
  if (brands.some((brand) => brand === company)) score += 120;
  if (brands.some((brand) => brand.includes(company) || company.includes(brand))) score += 75;
  const haystack = `${name} ${brands.join(" ")}`;
  const matches = tokens.filter((token) => haystack.includes(token)).length;
  score += matches * 24;
  if (tokens.length > 0 && matches === tokens.length) score += 35;
  return score;
}

function tomtomKeys(): string[] {
  return [
    process.env.TOMTOM_API_KEY,
    process.env.TOMTOM_API_KEY_2,
    process.env.TOMTOM_API_KEY_3,
    process.env.TOMTOM_API_KEY_4,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .filter((value, index, all) => all.indexOf(value) === index);
}

function requestBudget(fallback = 24): number {
  const parsed = Number(process.env.TOMTOM_LOCATION_MAX_QUERIES || fallback);
  return Number.isFinite(parsed) ? Math.max(3, Math.min(80, Math.floor(parsed))) : fallback;
}

function dedupeAreas(hints: CommercialPlaceSearchHint[]): SearchArea[] {
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

async function withKeyPool(buildUrl: (key: string) => URL): Promise<{ payload: any; attempts: number }> {
  const keys = tomtomKeys();
  if (!keys.length) throw new Error("tomtom is not configured");
  const start = nextTomTomKeyIndex % keys.length;
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
      const payload: Record<string, any> = await response.json().catch(() => ({}));
      if (response.ok) {
        nextTomTomKeyIndex = (index + 1) % keys.length;
        return { payload, attempts };
      }
      const detail = String(payload?.title || payload?.error || payload?.message || `HTTP ${response.status}`).slice(0, 180);
      errors.push(`key ${index + 1}: ${detail}`);
      if (![401, 403, 429, 500, 502, 503, 504].includes(response.status)) break;
    } catch (error) {
      errors.push(`key ${index + 1}: ${error instanceof Error ? error.message : "request failed"}`);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(errors.join("; ") || "TomTom request failed");
}

function tomtomCandidate(companyName: string, item: any): CommercialPlaceCandidate | null {
  const id = String(item?.id || "").trim();
  const latitude = Number(item?.position?.lat);
  const longitude = Number(item?.position?.lon);
  const title = String(item?.poi?.name || item?.address?.freeformAddress || companyName);
  const brands = (Array.isArray(item?.poi?.brands) ? item.poi.brands : [])
    .map((brand: any) => String(brand?.name || brand || ""))
    .filter(Boolean);
  const score = scoreName(companyName, title, brands);
  if (!id || !Number.isFinite(latitude) || !Number.isFinite(longitude) || score < 45) return null;
  const address = item?.address || {};
  const formattedAddress = String(
    address?.freeformAddress
      || [address?.streetNumber, address?.streetName, address?.municipality, address?.countrySubdivision, address?.postalCode, address?.country]
        .filter(Boolean)
        .join(", ")
      || title,
  ).trim();
  const classification = Array.isArray(item?.poi?.classifications) ? item.poi.classifications[0] : undefined;
  const exact = Boolean(address?.streetNumber || address?.postalCode);

  return {
    id: `tomtom-${id}`,
    companyName,
    placeName: title,
    formattedAddress,
    city: address?.municipality || address?.localName,
    state: address?.countrySubdivision,
    postalCode: address?.postalCode,
    country: address?.country || address?.countryCode || "Unknown",
    region: address?.countrySubdivision || address?.country || address?.countryCode || "Unknown",
    facilityType: classification?.names?.[0]?.name || classification?.code || "TomTom POI",
    activity: "Physical company location identified by TomTom Places Search",
    notes: brands.length ? `TomTom brand association: ${brands.join(", ")}` : "Company-name POI match from TomTom Search API.",
    coordinates: [longitude, latitude],
    geocodeSource: "tomtom",
    geocodeConfidence: exact ? "exact" : address?.municipality ? "place" : "unknown",
    sourceType: String(item?.type || "POI"),
    sourceClass: "tomtom-poi",
    sourceId: id,
    reviewStatus: score >= 80 ? "candidate" : "needs-review",
    sourceUrl: item?.poi?.url,
    sourceTitle: "TomTom Places Search",
    evidenceSnippet: `${title} — ${formattedAddress}`,
    discoveredBy: "tomtom",
  };
}

async function searchTomTom(companyName: string, area: SearchArea): Promise<{ candidates: CommercialPlaceCandidate[]; attempts: number }> {
  const result = await withKeyPool((key) => {
    const query = encodeURIComponent(companyName);
    const url = new URL(`https://api.tomtom.com/search/2/poiSearch/${query}.json`);
    url.searchParams.set("lat", String(area.latitude));
    url.searchParams.set("lon", String(area.longitude));
    url.searchParams.set("radius", "50000");
    url.searchParams.set("limit", "100");
    url.searchParams.set("key", key);
    return url;
  });
  const rows = Array.isArray(result.payload?.results) ? result.payload.results : [];
  return {
    candidates: rows
      .map((row: any) => tomtomCandidate(companyName, row))
      .filter((item: CommercialPlaceCandidate | null): item is CommercialPlaceCandidate => Boolean(item)),
    attempts: result.attempts,
  };
}

export async function discoverCommercialPlaces(
  companyName: string,
  hints: CommercialPlaceSearchHint[] = [],
): Promise<CommercialPlaceDiscoveryResult> {
  const areas = dedupeAreas(hints);
  const tomtomLimit = requestBudget();
  const byId = new Map<string, CommercialPlaceCandidate>();
  const diagnostics: CommercialPlaceDiagnostic[] = [];
  const warnings: string[] = [];
  const tomtomErrors: string[] = [];
  let tomtomRequestsMade = 0;

  if (tomtomKeys().length) {
    for (const area of areas) {
      if (tomtomRequestsMade >= tomtomLimit) break;
      try {
        const result = await searchTomTom(companyName, area);
        tomtomRequestsMade += result.attempts;
        result.candidates.forEach((candidate) => byId.set(candidate.id, candidate));
      } catch (error) {
        tomtomRequestsMade += 1;
        tomtomErrors.push(`${area.label}: ${error instanceof Error ? error.message : "search failed"}`);
      }
    }

    const count = byId.size;
    diagnostics.push({
      source: "tomtom",
      status: count ? tomtomErrors.length ? "partial" : "success" : tomtomErrors.length ? "error" : "no-results",
      resultsFound: count,
      message: `TomTom Places Search identified ${count} candidate(s) using ${tomtomRequestsMade} request attempt(s) across ${tomtomKeys().length} configured key(s).`,
      error: !count && tomtomErrors.length ? tomtomErrors.slice(0, 3).join("; ") : undefined,
    });
  } else {
    diagnostics.push({
      source: "tomtom",
      status: "not-configured",
      resultsFound: 0,
      message: "No TomTom API key is configured.",
    });
  }

  if (tomtomRequestsMade >= tomtomLimit) {
    warnings.push(`TomTom discovery reached its per-company request budget (${tomtomLimit}).`);
  }
  if (tomtomErrors.length && byId.size) {
    warnings.push(`TomTom returned partial coverage; ${tomtomErrors.length} geographic request(s) failed.`);
  }

  return {
    locations: Array.from(byId.values()).slice(0, 400),
    diagnostics,
    warnings,
    tomtomRequestsMade,
    tomtomKeysConfigured: tomtomKeys().length,
  };
}
