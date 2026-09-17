import { expectedIso2, normalizeIso2, validCoordinates } from "./geospatial-country";
import { ProviderHttpError, withProviderKey } from "./geospatial-key-pool";
import type { GeospatialCandidate, GeospatialResolveRequest, ResolverDependencies } from "./geospatial-types";

function parseBbox(value: unknown): [number, number, number, number] | undefined {
  if (!Array.isArray(value) || value.length < 4) return undefined;
  const south = Number(value[0]);
  const north = Number(value[1]);
  const west = Number(value[2]);
  const east = Number(value[3]);
  return [west, south, east, north].every(Number.isFinite) ? [west, south, east, north] : undefined;
}

export async function locationIqCandidate(request: GeospatialResolveRequest, deps: ResolverDependencies): Promise<GeospatialCandidate | null> {
  const fetchImpl = deps.fetchImpl || fetch;
  return withProviderKey("locationiq", deps, async (credential, slot) => {
    const url = new URL("https://us1.locationiq.com/v1/search");
    url.searchParams.set("key", credential);
    url.searchParams.set("q", [request.query, request.city, request.expectedRegion, request.expectedCountry].filter(Boolean).join(", "));
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("statecode", "1");
    url.searchParams.set("normalizeaddress", "1");
    url.searchParams.set("normalizecity", "1");
    url.searchParams.set("matchquality", "1");
    url.searchParams.set("limit", "3");
    const iso2 = expectedIso2(request);
    if (iso2) url.searchParams.set("countrycodes", iso2.toLowerCase());

    const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new ProviderHttpError(response.status, `LocationIQ returned ${response.status}`);
    const payload: any = await response.json().catch(() => []);

    for (const item of Array.isArray(payload) ? payload : []) {
      const address = item?.address || {};
      const candidate: GeospatialCandidate = {
        provider: "locationiq",
        slot,
        lat: Number(item?.lat),
        lon: Number(item?.lon),
        matchedAddress: String(item?.display_name || "") || undefined,
        country: String(address?.country || "") || undefined,
        iso2: normalizeIso2(address?.country_code),
        region: String(address?.state || address?.state_code || "") || undefined,
        city: String(address?.city || address?.town || address?.village || address?.municipality || "") || undefined,
        confidence: Number.isFinite(Number(item?.importance)) ? Number(item.importance) : undefined,
        precision: String(item?.type || item?.class || "") || undefined,
        bbox: parseBbox(item?.boundingbox),
        metadata: item?.matchquality && typeof item.matchquality === "object" ? { matchquality: item.matchquality } : undefined,
      };
      if (validCoordinates(candidate.lat, candidate.lon) && (!iso2 || candidate.iso2 === iso2)) return candidate;
    }

    return null;
  });
}
