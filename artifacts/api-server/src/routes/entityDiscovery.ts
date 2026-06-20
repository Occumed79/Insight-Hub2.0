import { Router } from "express";

const router = Router();

type NominatimResult = {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  class: string;
  type: string;
  display_name: string;
  name?: string;
  importance?: number;
  address?: Record<string, string>;
  boundingbox?: string[];
};

type DiscoveredLocation = {
  id: string;
  companyName: string;
  placeName: string;
  formattedAddress: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country: string;
  coordinates: [number, number];
  geocodeSource: "osm";
  geocodeConfidence: "exact" | "place" | "city" | "unknown";
  sourceType: string;
  sourceClass: string;
  sourceId: string;
  reviewStatus: "candidate" | "needs-review";
};

function normalizeEntityName(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 160);
}

function confidenceFor(result: NominatimResult): DiscoveredLocation["geocodeConfidence"] {
  const type = `${result.class}:${result.type}`.toLowerCase();
  if (type.includes("office") || type.includes("company") || type.includes("industrial") || type.includes("aeroway") || type.includes("amenity")) return "place";
  if (result.address?.city || result.address?.town || result.address?.village || result.address?.municipality) return "city";
  return "unknown";
}

function cityFrom(address: Record<string, string> | undefined) {
  if (!address) return undefined;
  return address.city || address.town || address.village || address.municipality || address.county;
}

function stateFrom(address: Record<string, string> | undefined) {
  if (!address) return undefined;
  return address.state || address.region || address.province;
}

function countryFrom(address: Record<string, string> | undefined, displayName: string) {
  return address?.country || displayName.split(",").map((part) => part.trim()).filter(Boolean).at(-1) || "Unknown";
}

function toDiscoveredLocation(entityName: string, result: NominatimResult): DiscoveredLocation | null {
  const lat = Number(result.lat);
  const lon = Number(result.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const confidence = confidenceFor(result);
  const formattedAddress = result.display_name;
  const placeName = result.name || formattedAddress.split(",")[0] || entityName;
  const country = countryFrom(result.address, formattedAddress);

  return {
    id: `osm-${result.osm_type}-${result.osm_id}`,
    companyName: entityName,
    placeName,
    formattedAddress,
    city: cityFrom(result.address),
    state: stateFrom(result.address),
    postalCode: result.address?.postcode,
    country,
    coordinates: [lon, lat],
    geocodeSource: "osm",
    geocodeConfidence: confidence,
    sourceType: result.type,
    sourceClass: result.class,
    sourceId: `${result.osm_type}/${result.osm_id}`,
    reviewStatus: confidence === "unknown" ? "needs-review" : "candidate",
  };
}

async function queryNominatim(entityName: string): Promise<DiscoveredLocation[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", entityName);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "40");
  url.searchParams.set("extratags", "1");
  url.searchParams.set("namedetails", "1");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Occu-Med Insight Hub entity discovery (location candidate lookup)",
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`OSM Nominatim lookup failed with ${response.status}`);
  }

  const results = (await response.json()) as NominatimResult[];
  const seen = new Set<string>();
  return results
    .map((result) => toDiscoveredLocation(entityName, result))
    .filter((result): result is DiscoveredLocation => Boolean(result))
    .filter((result) => {
      const key = `${result.coordinates[0].toFixed(5)}|${result.coordinates[1].toFixed(5)}|${result.formattedAddress}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

router.post("/entity-discovery/locations", async (req, res) => {
  try {
    const entityName = normalizeEntityName(req.body?.entityName);
    if (!entityName) {
      res.status(400).json({ ok: false, error: "entityName is required" });
      return;
    }

    const locations = await queryNominatim(entityName);
    const mapped = locations.filter((location) => ["exact", "place", "city"].includes(location.geocodeConfidence)).length;

    res.status(200).json({
      ok: true,
      entityName,
      source: "OpenStreetMap Nominatim",
      generatedAt: new Date().toISOString(),
      counts: {
        candidates: locations.length,
        mappable: mapped,
        needsReview: locations.length - mapped,
      },
      locations,
      warning: "These are public geocoding candidates. They should be treated as candidate operating locations until verified against official company, filing, contract, or client documentation.",
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Entity discovery failed" });
  }
});

export default router;
