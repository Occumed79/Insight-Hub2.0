import { canonicalCountry, expectedIso2, normalizeIso2, validCoordinates } from "./geospatial-country";
import type { GeospatialCandidate, GeospatialResolveRequest, ResolverDependencies } from "./geospatial-types";

export async function arcGisCandidate(request: GeospatialResolveRequest, deps: ResolverDependencies): Promise<GeospatialCandidate | null> {
  const credential = (process.env.ARCGIS_API_KEY || "").trim();
  if (!credential) return null;
  const fetchImpl = deps.fetchImpl || fetch;
  const url = new URL("https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates");
  url.searchParams.set("SingleLine", [request.query, request.city, request.expectedRegion, request.expectedCountry].filter(Boolean).join(", "));
  url.searchParams.set("maxLocations", "3");
  url.searchParams.set("outFields", "Match_addr,Addr_type,Country,Region,City");
  url.searchParams.set("forStorage", "false");
  url.searchParams.set("f", "json");
  url.searchParams.set("token", credential);
  const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  const payload: any = await response.json().catch(() => ({}));
  const iso2 = expectedIso2(request);

  for (const item of Array.isArray(payload?.candidates) ? payload.candidates : []) {
    const attrs = item?.attributes || {};
    const country = String(attrs?.Country || "") || undefined;
    const candidate: GeospatialCandidate = {
      provider: "arcgis",
      slot: 1,
      lon: Number(item?.location?.x),
      lat: Number(item?.location?.y),
      matchedAddress: String(item?.address || attrs?.Match_addr || "") || undefined,
      country,
      iso2: normalizeIso2(attrs?.Country) || canonicalCountry(country)?.iso2,
      region: String(attrs?.Region || "") || undefined,
      city: String(attrs?.City || "") || undefined,
      confidence: Number.isFinite(Number(item?.score)) ? Number(item.score) / 100 : undefined,
      precision: String(attrs?.Addr_type || "") || undefined,
    };
    if (validCoordinates(candidate.lat, candidate.lon) && (!iso2 || candidate.iso2 === iso2)) return candidate;
  }
  return null;
}