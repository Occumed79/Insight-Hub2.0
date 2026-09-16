import { expectedIso2 } from "./geospatial-country";
import { arcGisCandidate } from "./geospatial-provider-arcgis";
import { geocodioCandidate } from "./geospatial-provider-geocodio";
import { locationIqCandidate } from "./geospatial-provider-locationiq";
import { mapTilerCandidate } from "./geospatial-provider-maptiler";
import { haversineKm, resolutionFromCandidate, unresolvedResolution } from "./geospatial-validation";
import type { GeospatialResolveRequest, GeospatialResolution, ResolverDependencies } from "./geospatial-types";

export async function resolveExternalGeospatial(request: GeospatialResolveRequest, deps: ResolverDependencies): Promise<GeospatialResolution> {
  const iso2 = expectedIso2(request);
  const northAmerica = ["US", "CA", "MX"].includes(iso2);
  const primary = northAmerica ? await geocodioCandidate(request, deps) : await locationIqCandidate(request, deps);

  if (primary) {
    const lowGeocodio = primary.provider === "geocodio" && (primary.confidence ?? 0) < 0.8;
    const weakSite = ["installation", "site"].includes(request.kind) && !request.expectedRegion && !primary.region;
    if (lowGeocodio || weakSite) {
      const secondary = primary.provider === "geocodio"
        ? await locationIqCandidate(request, deps)
        : await mapTilerCandidate(request, deps);
      if (secondary && haversineKm(primary, secondary) <= 50) return resolutionFromCandidate(request, primary, true);
    } else {
      const direct = resolutionFromCandidate(request, primary, false);
      if (direct.status === "resolved") return direct;
    }
  }

  if (northAmerica) {
    const globalFallback = await locationIqCandidate(request, deps);
    if (globalFallback) {
      const result = resolutionFromCandidate(request, globalFallback, false);
      if (result.status === "resolved") return result;
    }
  }

  const maptiler = await mapTilerCandidate(request, deps);
  if (maptiler) {
    const result = resolutionFromCandidate(request, maptiler, false);
    if (result.status === "resolved") return result;
  }

  const arcgis = await arcGisCandidate(request, deps);
  if (arcgis) {
    const result = resolutionFromCandidate(request, arcgis, false);
    if (result.status === "resolved") return result;
  }

  return unresolvedResolution(request, ["No provider returned a candidate that passed geographic validation."]);
}
