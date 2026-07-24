export type GeographicConfidence = "exact" | "place" | "city" | "unknown";
export type GeographicReviewStatus = "candidate" | "needs-review" | "verified" | "rejected";

export type GeographicResearchSource = {
  label: string;
  type: "official" | "filing" | "contract" | "jobs" | "web";
  url: string;
  note: string;
};

export type GeographicSourceDiagnostic = {
  source: "neon-cache" | "wikidata" | "web-search" | "official-site" | "openstreetmap" | "photon" | "groq" | "cloudflare" | "gemini" | "cerebras";
  status: "success" | "partial" | "no-results" | "not-configured" | "error";
  resultsFound: number;
  message: string;
  error?: string;
};

export type GeographicLocation = {
  id: number;
  entityId: number;
  placeName: string;
  formattedAddress?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country: string;
  region?: string | null;
  facilityType?: string | null;
  activity?: string | null;
  notes?: string | null;
  coordinates: [number, number];
  geocodeSource: string;
  geocodeConfidence: GeographicConfidence;
  sourceClass?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  reviewStatus: GeographicReviewStatus;
  metadata?: Record<string, unknown> | null;
};

export type GeographicFootprintResponse = {
  ok: true;
  cacheHit?: boolean;
  entityName: string;
  enteredName: string;
  entityId: number;
  company: {
    id: number;
    enteredName: string;
    canonicalName: string;
    aliases: string[];
    wikidataId?: string;
    officialWebsite?: string;
    savedToDatabase: boolean;
    status: string;
  };
  source: string;
  sourceDiagnostics: GeographicSourceDiagnostic[];
  coverage: {
    officialPagesScanned: number;
    officialAddressesExtracted: number;
    officialLocationsGeocoded: number;
    aiPagesConsidered?: number;
    aiPagesRead?: number;
    aiAddressesExtracted?: number;
  };
  researchSources: GeographicResearchSource[];
  generatedAt: string;
  counts: {
    candidates: number;
    mappable: number;
    needsReview: number;
    newCandidates: number;
    duplicatesSkipped: number;
    enrichedExisting?: number;
  };
  locations: GeographicLocation[];
  warnings: string[];
  warning: string;
};

export type SavedGeographicEntity = {
  id: number;
  name: string;
  company: string;
  enteredName?: string;
  status: string;
  officialWebsite?: string;
  wikidataId?: string;
  lastDiscoveryAt?: string;
  discoveryStatus?: string;
  locations: GeographicLocation[];
};

export type SavedGeographicEntitiesResponse = {
  ok: true;
  entities: SavedGeographicEntity[];
};

export type VerifyGeographicLocationsResponse = {
  ok: true;
  entity: { id: number; name: string; displayName: string; status: string };
  locations: GeographicLocation[];
};

export type VerifyGeographicLocationResponse = {
  ok: true;
  entity: { id: number; name: string; displayName: string; status: string };
  location: GeographicLocation;
};

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null) as T | { error?: string } | null;
  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
      ? data.error
      : `Request failed with HTTP ${response.status}.`;
    throw new Error(message);
  }
  return data as T;
}

export async function discoverGeographicFootprint(
  entityName: string,
  options: { refresh?: boolean } = {},
): Promise<GeographicFootprintResponse> {
  const response = await fetch("/api/locations/discover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entityName, refresh: options.refresh === true }),
  });
  return readJson<GeographicFootprintResponse>(response);
}

export async function getSavedGeographicEntities(): Promise<SavedGeographicEntitiesResponse> {
  const response = await fetch("/api/entities/saved");
  return readJson<SavedGeographicEntitiesResponse>(response);
}

export async function verifyGeographicLocation(
  entityId: number,
  locationId: number,
): Promise<VerifyGeographicLocationResponse> {
  const response = await fetch(`/api/entities/${entityId}/verify-location`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locationId }),
  });
  return readJson<VerifyGeographicLocationResponse>(response);
}

export async function verifyGeographicLocations(
  entityId: number,
  locationIds: number[],
): Promise<VerifyGeographicLocationsResponse> {
  const response = await fetch(`/api/entities/${entityId}/verify-selected`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locationIds }),
  });
  return readJson<VerifyGeographicLocationsResponse>(response);
}
