import { expectedIso2, normalizeIso2, validCoordinates } from "./geospatial-country";
import type { GeospatialCandidate, GeospatialResolveRequest, ResolverDependencies } from "./geospatial-types";

export async function mapTilerCandidate(request: GeospatialResolveRequest, deps: ResolverDependencies): Promise<GeospatialCandidate | null> {
  const credential = (process.env.MAP_TILER_API_KEY_2 || process.env.MAP_TILER_API_KEY || "").trim();
  if (!credential) return null;
  const fetchImpl = deps.fetchImpl || fetch;
  const query = [request.query, request.city, request.expectedRegion, request.expectedCountry].filter(Boolean).join(", ");
  const url = new URL(`https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json`);
  url.searchParams.set("key", credential);
  url.searchParams.set("limit", "3");
  if (request.kind === "country") url.searchParams.set("types", "country");
  const iso2 = expectedIso2(request);
  if (iso2) url.searchParams.set("country", iso2.toLowerCase());

  const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  const payload: any = await response.json().catch(() => ({}));

  for (const item of Array.isArray(payload?.features) ? payload.features : []) {
    const center = item?.center;
    const props = item?.properties || {};
    const contexts = Array.isArray(item?.context) ? item.context : [];
    const countryContext = contexts.find((entry: any) => String(entry?.id || "").startsWith("country."));
    const regionContext = contexts.find((entry: any) => String(entry?.id || "").startsWith("region."));
    const candidate: GeospatialCandidate = {
      provider: "maptiler",
      slot: 1,
      lon: Number(center?.[0]),
      lat: Number(center?.[1]),
      matchedAddress: String(item?.place_name || item?.text || "") || undefined,
      country: String(countryContext?.text || props?.country || "") || undefined,
      iso2: normalizeIso2(props?.country_code || props?.iso_a2 || countryContext?.properties?.short_code?.slice(-2)),
      region: String(regionContext?.text || props?.region || "") || undefined,
      city: String(item?.text || "") || undefined,
      confidence: Number.isFinite(Number(item?.relevance)) ? Number(item.relevance) : undefined,
      precision: String(item?.place_type?.[0] || "") || undefined,
      bbox: Array.isArray(item?.bbox) && item.bbox.length >= 4 ? item.bbox.slice(0, 4).map(Number) as [number, number, number, number] : undefined,
    };
    if (validCoordinates(candidate.lat, candidate.lon) && (!iso2 || candidate.iso2 === iso2)) return candidate;
  }

  return null;
}
