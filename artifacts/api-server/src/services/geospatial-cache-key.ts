import { createHash } from "node:crypto";
import { expectedIso2, normalizeText } from "./geospatial-country";
import { normalizedQuery } from "./geospatial-validation";
import type { GeospatialResolveRequest } from "./geospatial-types";

export function geospatialCacheKey(request: GeospatialResolveRequest): string {
  return createHash("sha256").update(JSON.stringify({
    query: normalizedQuery(request),
    kind: request.kind,
    iso2: expectedIso2(request),
    region: normalizeText(request.expectedRegion),
  })).digest("hex");
}
