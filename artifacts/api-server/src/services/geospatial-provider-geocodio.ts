import { canonicalCountry, expectedIso2, normalizeIso2, validCoordinates } from "./geospatial-country";
import { ProviderHttpError, withProviderKey } from "./geospatial-key-pool";
import type { GeospatialCandidate, GeospatialResolveRequest, ResolverDependencies } from "./geospatial-types";

export async function geocodioCandidate(request: GeospatialResolveRequest, deps: ResolverDependencies): Promise<GeospatialCandidate | null> {
  const fetchImpl = deps.fetchImpl || fetch;
  return withProviderKey("geocodio", deps, async (credential, slot) => {
    const url = new URL("https://api.geocod.io/v1.9/geocode");
    url.searchParams.set("q", [request.query, request.city, request.expectedRegion, request.expectedCountry].filter(Boolean).join(", "));
    url.searchParams.set("api_key", credential);
    url.searchParams.set("limit", "3");
    const iso2 = expectedIso2(request);
    if (iso2) url.searchParams.set("country", iso2);
    const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new ProviderHttpError(response.status, `Geocodio returned ${response.status}`);
    const payload: any = await response.json().catch(() => ({}));
    for (const item of Array.isArray(payload?.results) ? payload.results : []) {
      const components = item?.address_components || {};
      const country = String(components?.country || "") || undefined;
      const candidate: GeospatialCandidate = {
        provider: "geocodio",
        slot,
        lat: Number(item?.location?.lat),
        lon: Number(item?.location?.lng),
        matchedAddress: String(item?.formatted_address || "") || undefined,
        country,
        iso2: normalizeIso2(components?.country_code) || canonicalCountry(country)?.iso2,
        region: String(components?.state || components?.state_province || "") || undefined,
        city: String(components?.city || "") || undefined,
        confidence: Number.isFinite(Number(item?.accuracy)) ? Number(item.accuracy) : undefined,
        precision: String(item?.accuracy_type || "") || undefined,
      };
      if (validCoordinates(candidate.lat, candidate.lon) && (!iso2 || candidate.iso2 === iso2)) return candidate;
    }
    return null;
  });
}