export type GeographicConfidence = "exact" | "place" | "city" | "unknown";
export type GeographicReviewStatus = "candidate" | "needs-review" | "verified" | "rejected";

export type GeographicResearchSource = {
  label: string;
  type: "official" | "filing" | "contract" | "jobs" | "web";
  url: string;
  note: string;
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
};

export type GeographicFootprintResponse = {
  ok: true;
  entityName: string;
  entityId: number;
  source: string;
  researchSources: GeographicResearchSource[];
  generatedAt: string;
  counts: {
    candidates: number;
    mappable: number;
    needsReview: number;
    newCandidates: number;
    duplicatesSkipped: number;
  };
  locations: GeographicLocation[];
  warning: string;
};

export type VerifyGeographicLocationsResponse = {
  ok: true;
  entity: { id: number; name: string; displayName: string; status: string };
  locations: GeographicLocation[];
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

export async function discoverGeographicFootprint(entityName: string): Promise<GeographicFootprintResponse> {
  const response = await fetch("/api/entity-discovery/locations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entityName }),
  });
  return readJson<GeographicFootprintResponse>(response);
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
