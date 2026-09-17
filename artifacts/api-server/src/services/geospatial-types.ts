export type GeospatialKind = "country" | "city" | "site" | "installation" | "event";
export type GeospatialProvider = "source" | "canonical-country" | "geocodio" | "locationiq" | "maptiler" | "arcgis" | "cache" | "none";

export type GeospatialResolveRequest = {
  query: string;
  kind: GeospatialKind;
  expectedCountry?: string;
  expectedIso2?: string;
  expectedRegion?: string;
  city?: string;
  sourceCoordinates?: { lat: number; lon: number };
  sourceId?: string;
  sourceName?: string;
  forceRefresh?: boolean;
};

export type GeospatialResolution = {
  status: "resolved" | "unresolved";
  query: string;
  normalizedQuery: string;
  coordinates?: { lat: number; lon: number };
  provider: GeospatialProvider;
  providerKeySlot?: number;
  matchedAddress?: string;
  country?: string;
  iso2?: string;
  region?: string;
  city?: string;
  confidence?: number;
  precision?: string;
  bbox?: [number, number, number, number];
  validated: boolean;
  validation: {
    countryMatch: boolean | null;
    regionMatch: boolean | null;
    coordinateValid: boolean;
    corroborated: boolean;
    reasons: string[];
  };
  cacheHit: boolean;
  resolvedAt: string;
};

export type GeospatialCache = {
  get(cacheKey: string): Promise<GeospatialResolution | null>;
  set(cacheKey: string, request: GeospatialResolveRequest, resolution: GeospatialResolution): Promise<void>;
};

export type ResolverDependencies = {
  fetchImpl?: typeof fetch;
  cache?: GeospatialCache;
  now?: () => number;
};

export type GeospatialCandidate = {
  provider: Exclude<GeospatialProvider, "source" | "canonical-country" | "cache" | "none">;
  slot: number;
  lat: number;
  lon: number;
  matchedAddress?: string;
  country?: string;
  iso2?: string;
  region?: string;
  city?: string;
  confidence?: number;
  precision?: string;
  bbox?: [number, number, number, number];
  metadata?: Record<string, unknown>;
};
