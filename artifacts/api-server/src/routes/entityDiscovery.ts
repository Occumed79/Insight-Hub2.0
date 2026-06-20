import { Router } from "express";
import { db, entitiesTable, locationsTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

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
  geocodeSource: "osm" | "photon";
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

async function queryPhoton(entityName: string): Promise<DiscoveredLocation[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", entityName);
  url.searchParams.set("limit", "40");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Occu-Med Insight Hub entity discovery (location candidate lookup)",
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Photon lookup failed with ${response.status}`);
  }

  const photonResults = await response.json() as { features: Array<{ properties: Record<string, string | number | undefined>; geometry: { coordinates: [number, number] } }> };
  const seen = new Set<string>();
  const results: DiscoveredLocation[] = [];

  for (const feature of photonResults.features) {
    const props = feature.properties;
    const coords = feature.geometry.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2) continue;

    const [lon, lat] = coords;
    if (typeof lon !== "number" || typeof lat !== "number") continue;

    const address = Object.fromEntries(Object.entries(props).map(([key, value]) => [key, String(value ?? "")])) as Record<string, string>;
    const confidence = confidenceFor({ class: String(props.osm_value || "unknown"), type: String(props.osm_key || "unknown"), address } as NominatimResult);
    const city = address.city || address.town || address.village || address.municipality || address.county;
    const country = address.country || "Unknown";
    const name = String(props.name || entityName);
    const osmId = String(props.osm_id || Math.random().toString(36).slice(2, 11));

    const location: DiscoveredLocation = {
      id: `photon-${osmId}`,
      companyName: entityName,
      placeName: name,
      formattedAddress: String(props.formatted || `${name}, ${city || ""}, ${country}`),
      city,
      state: address.state,
      postalCode: address.postcode,
      country,
      coordinates: [lon, lat],
      geocodeSource: "photon",
      geocodeConfidence: confidence,
      sourceType: String(props.osm_key || "unknown"),
      sourceClass: String(props.osm_value || "unknown"),
      sourceId: `photon/${osmId}`,
      reviewStatus: confidence === "unknown" ? "needs-review" : "candidate",
    };

    const key = `${location.coordinates[0].toFixed(5)}|${location.coordinates[1].toFixed(5)}|${location.formattedAddress}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push(location);
    }
  }

  return results;
}

router.post("/entity-discovery/locations", async (req, res) => {
  try {
    const entityName = normalizeEntityName(req.body?.entityName);
    if (!entityName) {
      res.status(400).json({ ok: false, error: "entityName is required" });
      return;
    }

    const [nominatimResults, photonResults] = await Promise.allSettled([queryNominatim(entityName), queryPhoton(entityName)]);
    const locations = [
      ...(nominatimResults.status === "fulfilled" ? nominatimResults.value : []),
      ...(photonResults.status === "fulfilled" ? photonResults.value : []),
    ];

    const seen = new Set<string>();
    const deduplicated = locations.filter((result) => {
      const key = `${result.coordinates[0].toFixed(5)}|${result.coordinates[1].toFixed(5)}|${result.formattedAddress}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const mapped = deduplicated.filter((location) => ["exact", "place", "city"].includes(location.geocodeConfidence)).length;
    const existingEntity = await db.select().from(entitiesTable).where(eq(entitiesTable.name, entityName)).limit(1);
    const entityId = existingEntity.length > 0
      ? existingEntity[0].id
      : (await db.insert(entitiesTable).values({ name: entityName, displayName: entityName, type: "company", status: "candidate", source: "discovery", metadata: {} }).returning())[0].id;

    const insertedLocations = deduplicated.length > 0
      ? await db.insert(locationsTable).values(deduplicated.map((loc) => ({
          entityId,
          placeName: loc.placeName,
          formattedAddress: loc.formattedAddress,
          city: loc.city,
          state: loc.state,
          postalCode: loc.postalCode,
          country: loc.country,
          region: loc.country,
          coordinates: loc.coordinates,
          geocodeSource: loc.geocodeSource,
          geocodeConfidence: loc.geocodeConfidence,
          sourceClass: loc.sourceClass,
          sourceType: loc.sourceType,
          sourceId: loc.sourceId,
          reviewStatus: loc.reviewStatus,
          metadata: {},
        }))).returning()
      : [];

    res.status(200).json({
      ok: true,
      entityName,
      entityId,
      source: "OpenStreetMap Nominatim + Photon",
      generatedAt: new Date().toISOString(),
      counts: { candidates: deduplicated.length, mappable: mapped, needsReview: deduplicated.length - mapped },
      locations: insertedLocations,
      warning: "These are public geocoding candidates from multiple sources. Select the locations that look correct, then add them to the verified map.",
    });
  } catch (error) {
    console.error("Entity discovery error:", error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Entity discovery failed" });
  }
});

router.post("/entities/:id/verify-selected", async (req, res) => {
  try {
    const entityId = Number(req.params.id);
    const locationIds = Array.isArray(req.body?.locationIds) ? req.body.locationIds.map(Number).filter(Number.isFinite) : [];
    if (!Number.isFinite(entityId) || locationIds.length === 0) {
      res.status(400).json({ ok: false, error: "Valid entity ID and at least one location ID are required" });
      return;
    }

    await db.update(locationsTable).set({ reviewStatus: "rejected", updatedAt: new Date() }).where(eq(locationsTable.entityId, entityId));
    const verifiedLocations = await db.update(locationsTable).set({ reviewStatus: "verified", updatedAt: new Date() }).where(and(eq(locationsTable.entityId, entityId), inArray(locationsTable.id, locationIds))).returning();
    const [entity] = await db.update(entitiesTable).set({ status: "verified", updatedAt: new Date() }).where(eq(entitiesTable.id, entityId)).returning();

    res.json({ ok: true, entity, locations: verifiedLocations });
  } catch (error) {
    console.error("Verify selected locations error:", error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Failed to verify selected locations" });
  }
});

router.get("/entities/verified", async (req, res) => {
  try {
    const verifiedEntities = await db.select().from(entitiesTable).where(eq(entitiesTable.status, "verified")).orderBy(entitiesTable.displayName);
    const result = await Promise.all(verifiedEntities.map(async (entity) => {
      const entityLocations = await db.select().from(locationsTable).where(eq(locationsTable.entityId, entity.id)).orderBy(locationsTable.placeName);
      return {
        id: entity.id,
        name: entity.displayName,
        company: entity.displayName,
        locations: entityLocations.filter((loc) => loc.reviewStatus === "verified").map((loc) => ({
          id: loc.id,
          placeName: loc.placeName,
          city: loc.city,
          country: loc.country,
          region: loc.region,
          coordinates: loc.coordinates,
          geocodeConfidence: loc.geocodeConfidence,
          geocodeSource: loc.geocodeSource,
          facilityType: loc.facilityType,
          activity: loc.activity,
          notes: loc.notes,
          formattedAddress: loc.formattedAddress,
          addressLine1: loc.addressLine1,
          addressLine2: loc.addressLine2,
          state: loc.state,
          postalCode: loc.postalCode,
        })),
      };
    }));
    res.json({ ok: true, entities: result });
  } catch (error) {
    console.error("Get verified entities error:", error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Failed to get verified entities" });
  }
});

export default router;
