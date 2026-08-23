export type FoursquareDiagnostic = {
  source: "foursquare";
  status: "success" | "partial" | "no-results" | "not-configured" | "error";
  resultsFound: number;
  message: string;
  error?: string;
};

export type FoursquareSearchHint = {
  label?: string;
  latitude: number;
  longitude: number;
};

export type FoursquareLocationCandidate = {
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
  geocodeSource: "foursquare";
  geocodeConfidence: "exact" | "place" | "city" | "unknown";
  sourceType: string;
  sourceClass: string;
  sourceId: string;
  reviewStatus: "candidate" | "needs-review";
  sourceUrl?: string;
  sourceTitle?: string;
  evidenceSnippet?: string;
  discoveredBy: "foursquare";
};

export type FoursquareLocationDiscoveryResult = {
  locations: FoursquareLocationCandidate[];
  diagnostic: FoursquareDiagnostic;
  warnings: string[];
  requestsMade: number;
  keysConfigured: number;
  chainIds: string[];
};

type FoursquareCategory = {
  fsq_category_id?: string;
  name?: string;
  short_name?: string;
};

type FoursquareChain = {
  fsq_chain_id?: string;
  name?: string;
  parent_id?: string;
};

type FoursquarePlace = {
  fsq_place_id?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  location?: {
    address?: string;
    locality?: string;
    region?: string;
    postcode?: string;
    admin_region?: string;
    post_town?: string;
    country?: string;
    formatted_address?: string;
  };
  categories?: FoursquareCategory[];
  chains?: FoursquareChain[];
  website?: string;
  tel?: string;
  placemaker_url?: string;
  date_closed?: string | null;
};

type SearchArea = {
  label: string;
  latitude: number;
  longitude: number;
};

const API_BASE = "https://places-api.foursquare.com";
const API_VERSION = "2025-06-17";
const MAX_RESULTS_PER_QUERY = 50;

// Wide geographic seed coverage for companies whose existing public-source results are sparse.
// Existing company-location coordinates are always searched first, so these are only fallback coverage.
const FALLBACK_AREAS: SearchArea[] = [
  { label: "New York, NY", latitude: 40.7128, longitude: -74.0060 },
  { label: "Boston, MA", latitude: 42.3601, longitude: -71.0589 },
  { label: "Washington, DC", latitude: 38.9072, longitude: -77.0369 },
  { label: "Atlanta, GA", latitude: 33.7490, longitude: -84.3880 },
  { label: "Miami, FL", latitude: 25.7617, longitude: -80.1918 },
  { label: "Chicago, IL", latitude: 41.8781, longitude: -87.6298 },
  { label: "Detroit, MI", latitude: 42.3314, longitude: -83.0458 },
  { label: "Minneapolis, MN", latitude: 44.9778, longitude: -93.2650 },
  { label: "St. Louis, MO", latitude: 38.6270, longitude: -90.1994 },
  { label: "Dallas, TX", latitude: 32.7767, longitude: -96.7970 },
  { label: "Houston, TX", latitude: 29.7604, longitude: -95.3698 },
  { label: "San Antonio, TX", latitude: 29.4241, longitude: -98.4936 },
  { label: "Denver, CO", latitude: 39.7392, longitude: -104.9903 },
  { label: "Phoenix, AZ", latitude: 33.4484, longitude: -112.0740 },
  { label: "Salt Lake City, UT", latitude: 40.7608, longitude: -111.8910 },
  { label: "Los Angeles, CA", latitude: 34.0522, longitude: -118.2437 },
  { label: "San Francisco, CA", latitude: 37.7749, longitude: -122.4194 },
  { label: "Seattle, WA", latitude: 47.6062, longitude: -122.3321 },
  { label: "Portland, OR", latitude: 45.5152, longitude: -122.6784 },
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

let nextKeyIndex = 0;

function normalize(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function companyTokens(companyName: string): string[] {
  const ignored = new Set(["inc", "incorporated", "llc", "ltd", "limited", "corp", "corporation", "company", "companies", "group", "holdings", "plc", "the"]);
  return normalize(companyName).split(" ").filter((token) => token.length > 2 && !ignored.has(token));
}

function getKeys(): string[] {
  return [
    process.env.FOURSQUARE_API_KEY,
    process.env.FOURSQUARE_API_KEY_2,
    process.env.FOURSQUARE_API_KEY_3,
    process.env.FOURSQUARE_API_KEY_4,
    process.env.FOURSQUARE_API_KEY_5,
  ]
    .map((key) => key?.trim())
    .filter((key): key is string => Boolean(key))
    .filter((key, index, all) => all.indexOf(key) === index);
}

function maxRequests(): number {
  const configured = Number(process.env.FOURSQUARE_LOCATION_MAX_QUERIES || 30);
  if (!Number.isFinite(configured)) return 30;
  return Math.max(4, Math.min(80, Math.floor(configured)));
}

function askEnabled(): boolean {
  return String(process.env.FOURSQUARE_ASK_ENABLED || "").trim().toLowerCase() === "true";
}

function dedupeAreas(hints: FoursquareSearchHint[]): SearchArea[] {
  const seen = new Set<string>();
  const output: SearchArea[] = [];
  const add = (area: SearchArea) => {
    if (!Number.isFinite(area.latitude) || !Number.isFinite(area.longitude)) return;
    const key = `${area.latitude.toFixed(1)}|${area.longitude.toFixed(1)}`;
    if (seen.has(key)) return;
    seen.add(key);
    output.push(area);
  };

  for (const hint of hints) {
    add({
      label: hint.label || `${hint.latitude.toFixed(3)},${hint.longitude.toFixed(3)}`,
      latitude: hint.latitude,
      longitude: hint.longitude,
    });
  }
  FALLBACK_AREAS.forEach(add);
  return output;
}

function placeArray(payload: unknown): FoursquarePlace[] {
  const results = (payload as any)?.results;
  if (!Array.isArray(results)) return [];
  const places: FoursquarePlace[] = [];
  for (const row of results) {
    const place = row?.place && typeof row.place === "object" ? row.place : row;
    if (place && typeof place === "object") places.push(place as FoursquarePlace);
  }
  return places;
}

function matchingScore(companyName: string, place: FoursquarePlace): number {
  const company = normalize(companyName);
  const tokens = companyTokens(companyName);
  const name = normalize(place.name);
  const chainNames = (place.chains || []).map((chain) => normalize(chain.name)).filter(Boolean);
  let score = 0;

  if (name === company) score += 100;
  if (name.includes(company) || company.includes(name)) score += 55;
  if (chainNames.some((chain) => chain === company)) score += 120;
  if (chainNames.some((chain) => chain.includes(company) || company.includes(chain))) score += 75;

  const haystack = `${name} ${chainNames.join(" ")}`;
  const matches = tokens.filter((token) => haystack.includes(token)).length;
  score += matches * 24;
  if (tokens.length > 0 && matches === tokens.length) score += 35;
  if (place.date_closed) score -= 200;
  return score;
}

function placeToCandidate(companyName: string, place: FoursquarePlace): FoursquareLocationCandidate | null {
  const latitude = Number(place.latitude);
  const longitude = Number(place.longitude);
  const fsqId = String(place.fsq_place_id || "").trim();
  if (!fsqId || !Number.isFinite(latitude) || !Number.isFinite(longitude) || place.date_closed) return null;
  if (matchingScore(companyName, place) < 45) return null;

  const location = place.location || {};
  const formattedAddress = String(location.formatted_address || [
    location.address,
    location.locality || location.post_town,
    location.region || location.admin_region,
    location.postcode,
    location.country,
  ].filter(Boolean).join(", ") || place.name || companyName).trim();
  const chainNames = (place.chains || []).map((chain) => chain.name).filter((value): value is string => Boolean(value));
  const category = place.categories?.[0]?.name || place.categories?.[0]?.short_name;
  const exact = Boolean(location.address && (location.postcode || /\d/.test(location.address)));
  const sourceUrl = place.placemaker_url || place.website;

  return {
    id: `foursquare-${fsqId}`,
    companyName,
    placeName: String(place.name || companyName),
    formattedAddress,
    city: location.locality || location.post_town,
    state: location.region || location.admin_region,
    postalCode: location.postcode,
    country: location.country || "Unknown",
    region: location.region || location.admin_region || location.country || "Unknown",
    facilityType: category || "Foursquare place",
    activity: "Physical company location identified in Foursquare Places",
    notes: chainNames.length > 0
      ? `Foursquare chain association: ${chainNames.join(", ")}`
      : "Company-name match from Foursquare Places API.",
    coordinates: [longitude, latitude],
    geocodeSource: "foursquare",
    geocodeConfidence: exact ? "exact" : location.locality ? "place" : "unknown",
    sourceType: "foursquare-place",
    sourceClass: "foursquare-places",
    sourceId: fsqId,
    reviewStatus: matchingScore(companyName, place) >= 80 ? "candidate" : "needs-review",
    sourceUrl,
    sourceTitle: "Foursquare Places API",
    evidenceSnippet: `${place.name || companyName} — ${formattedAddress}`,
    discoveredBy: "foursquare",
  };
}

async function requestWithKeyPool(url: URL): Promise<{ payload: unknown; attempts: number }> {
  const keys = getKeys();
  if (keys.length === 0) throw new Error("Foursquare is not configured");
  const start = nextKeyIndex % keys.length;
  const errors: string[] = [];
  let attempts = 0;

  for (let offset = 0; offset < keys.length; offset += 1) {
    const keyIndex = (start + offset) % keys.length;
    const key = keys[keyIndex];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9_000);
    attempts += 1;
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${key}`,
          "X-Places-Api-Version": API_VERSION,
          Accept: "application/json",
        },
      });
      if (response.ok) {
        nextKeyIndex = (keyIndex + 1) % keys.length;
        return { payload: await response.json(), attempts };
      }

      const message = `key ${keyIndex + 1}: HTTP ${response.status}`;
      errors.push(message);
      if (![401, 403, 429, 500, 502, 503, 504].includes(response.status)) {
        throw new Error(`Foursquare ${message}`);
      }
    } catch (error) {
      errors.push(`key ${keyIndex + 1}: ${error instanceof Error ? error.message : "request failed"}`);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(errors.join("; ") || "All configured Foursquare keys failed");
}

async function placeSearch(params: {
  companyName?: string;
  chainIds?: string[];
  area: SearchArea;
}): Promise<{ places: FoursquarePlace[]; attempts: number }> {
  const url = new URL("/places/search", API_BASE);
  if (params.companyName) url.searchParams.set("query", params.companyName);
  if (params.chainIds?.length) url.searchParams.set("fsq_chain_ids", params.chainIds.join(","));
  url.searchParams.set("ll", `${params.area.latitude},${params.area.longitude}`);
  url.searchParams.set("radius", "100000");
  url.searchParams.set("limit", String(MAX_RESULTS_PER_QUERY));
  // Omitting fields intentionally keeps Place Search on its default Pro field set.
  const result = await requestWithKeyPool(url);
  return { places: placeArray(result.payload), attempts: result.attempts };
}

async function askSearch(companyName: string, area: SearchArea): Promise<{ places: FoursquarePlace[]; attempts: number }> {
  const url = new URL("/places/ask", API_BASE);
  url.searchParams.set("query", `physical offices, branches, facilities, stores, plants, campuses, and operating sites for ${companyName}`);
  url.searchParams.set("ll", `${area.latitude},${area.longitude}`);
  url.searchParams.set("context", "Return locations that belong to the named company or its branded chain; exclude unrelated nearby businesses.");
  // Ask is opt-in because it has separate pricing and rate limits from standard Places API Pro calls.
  const result = await requestWithKeyPool(url);
  return { places: placeArray(result.payload), attempts: result.attempts };
}

export async function discoverFoursquareLocations(
  companyName: string,
  hints: FoursquareSearchHint[] = [],
): Promise<FoursquareLocationDiscoveryResult> {
  const keys = getKeys();
  if (keys.length === 0) {
    return {
      locations: [],
      diagnostic: {
        source: "foursquare",
        status: "not-configured",
        resultsFound: 0,
        message: "No Foursquare Service API key is configured.",
      },
      warnings: [],
      requestsMade: 0,
      keysConfigured: 0,
      chainIds: [],
    };
  }

  const areas = dedupeAreas(hints);
  const requestBudget = maxRequests();
  let requestsMade = 0;
  const errors: string[] = [];
  const allPlaces = new Map<string, FoursquarePlace>();
  const chainIds = new Set<string>();

  const addPlaces = (places: FoursquarePlace[]) => {
    for (const place of places) {
      const id = String(place.fsq_place_id || "");
      if (!id || matchingScore(companyName, place) < 45) continue;
      allPlaces.set(id, place);
      for (const chain of place.chains || []) {
        if (chain.fsq_chain_id && matchingScore(companyName, { name: chain.name, chains: [chain] }) >= 45) {
          chainIds.add(chain.fsq_chain_id);
        }
      }
    }
  };

  // First identify high-confidence company/chain matches from existing-location geography or a few broad seeds.
  const discoveryAreas = areas.slice(0, Math.min(4, areas.length));
  for (const area of discoveryAreas) {
    if (requestsMade >= requestBudget) break;
    try {
      const result = await placeSearch({ companyName, area });
      requestsMade += result.attempts;
      addPlaces(result.places);
    } catch (error) {
      requestsMade += 1;
      errors.push(`${area.label}: ${error instanceof Error ? error.message : "search failed"}`);
    }
  }

  // Once a chain association is known, use the chain filter for precision across the remaining search areas.
  // Otherwise continue company-name search across the same geographic coverage.
  const remainingAreas = areas.slice(discoveryAreas.length);
  for (const area of remainingAreas) {
    if (requestsMade >= requestBudget) break;
    try {
      const result = chainIds.size > 0
        ? await placeSearch({ chainIds: Array.from(chainIds).slice(0, 4), area })
        : await placeSearch({ companyName, area });
      requestsMade += result.attempts;
      addPlaces(result.places);
    } catch (error) {
      requestsMade += 1;
      errors.push(`${area.label}: ${error instanceof Error ? error.message : "search failed"}`);
    }
  }

  // Ask remains available, but is disabled by default because it has separate PAYG pricing/rate limits.
  if (askEnabled() && allPlaces.size < 3) {
    for (const area of areas.slice(0, 2)) {
      if (requestsMade >= requestBudget) break;
      try {
        const result = await askSearch(companyName, area);
        requestsMade += result.attempts;
        addPlaces(result.places);
      } catch (error) {
        requestsMade += 1;
        errors.push(`Ask ${area.label}: ${error instanceof Error ? error.message : "search failed"}`);
      }
    }
  }

  const locations = Array.from(allPlaces.values())
    .map((place) => placeToCandidate(companyName, place))
    .filter((candidate): candidate is FoursquareLocationCandidate => Boolean(candidate))
    .slice(0, 260);

  const warnings: string[] = [];
  if (requestsMade >= requestBudget) {
    warnings.push(`Foursquare location discovery reached its per-lookup request budget (${requestBudget}). Increase FOURSQUARE_LOCATION_MAX_QUERIES if broader coverage is needed.`);
  }
  if (errors.length > 0 && locations.length > 0) {
    warnings.push(`Foursquare returned partial coverage; ${errors.length} geographic search request(s) failed.`);
  }
  if (chainIds.size === 0) {
    warnings.push("No Foursquare chain ID was confirmed for this company; Foursquare results were matched by company/place name instead.");
  }

  const status: FoursquareDiagnostic["status"] = locations.length > 0
    ? errors.length > 0 ? "partial" : "success"
    : errors.length > 0 ? "error" : "no-results";

  return {
    locations,
    diagnostic: {
      source: "foursquare",
      status,
      resultsFound: locations.length,
      message: locations.length > 0
        ? `Foursquare identified ${locations.length} company-location candidate(s) using ${requestsMade} request attempt(s) across ${keys.length} configured Service API key(s).`
        : `Foursquare completed ${requestsMade} request attempt(s) but did not return confident company-location matches.`,
      error: locations.length === 0 && errors.length > 0 ? errors.slice(0, 4).join("; ") : undefined,
    },
    warnings,
    requestsMade,
    keysConfigured: keys.length,
    chainIds: Array.from(chainIds),
  };
}
