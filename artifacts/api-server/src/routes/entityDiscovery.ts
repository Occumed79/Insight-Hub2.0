import { Router } from "express";
import { db, entitiesTable, locationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

    // Check if entity already exists
    const existingEntity = await db
      .select()
      .from(entitiesTable)
      .where(eq(entitiesTable.name, entityName))
      .limit(1);

    let entityId: number;

    if (existingEntity.length > 0) {
      entityId = existingEntity[0].id;
    } else {
      // Create new entity
      const [newEntity] = await db
        .insert(entitiesTable)
        .values({
          name: entityName,
          displayName: entityName,
          type: "company",
          status: "candidate",
          source: "discovery",
          metadata: {},
        })
        .returning();
      entityId = newEntity.id;
    }

    // Insert locations
    const insertedLocations = await db
      .insert(locationsTable)
      .values(
        locations.map((loc) => ({
          entityId,
          placeName: loc.placeName,
          formattedAddress: loc.formattedAddress,
          city: loc.city,
          state: loc.state,
          postalCode: loc.postalCode,
          country: loc.country,
          region: loc.country, // Default to country for now
          coordinates: loc.coordinates,
          geocodeSource: loc.geocodeSource,
          geocodeConfidence: loc.geocodeConfidence,
          sourceClass: loc.sourceClass,
          sourceType: loc.sourceType,
          sourceId: loc.sourceId,
          reviewStatus: loc.reviewStatus,
          metadata: {},
        }))
      )
      .returning();

    res.status(200).json({
      ok: true,
      entityName,
      entityId,
      source: "OpenStreetMap Nominatim",
      generatedAt: new Date().toISOString(),
      counts: {
        candidates: locations.length,
        mappable: mapped,
        needsReview: locations.length - mapped,
      },
      locations: insertedLocations,
      warning: "These are public geocoding candidates. They should be treated as candidate operating locations until verified against official company, filing, contract, or client documentation.",
    });
  } catch (error) {
    console.error("Entity discovery error:", error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Entity discovery failed" });
  }
});

// GET /api/entities - List all entities
router.get("/entities", async (req, res) => {
  try {
    const entities = await db.select().from(entitiesTable).orderBy(entitiesTable.createdAt);
    res.json({ ok: true, entities });
  } catch (error) {
    console.error("List entities error:", error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Failed to list entities" });
  }
});

// GET /api/entities/:id/locations - List locations for an entity
router.get("/entities/:id/locations", async (req, res) => {
  try {
    const entityId = parseInt(req.params.id, 10);
    if (isNaN(entityId)) {
      res.status(400).json({ ok: false, error: "Invalid entity ID" });
      return;
    }

    const locations = await db
      .select()
      .from(locationsTable)
      .where(eq(locationsTable.entityId, entityId))
      .orderBy(locationsTable.createdAt);

    res.json({ ok: true, locations });
  } catch (error) {
    console.error("List locations error:", error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Failed to list locations" });
  }
});

// PATCH /api/entities/:id - Update entity status
router.patch("/entities/:id", async (req, res) => {
  try {
    const entityId = parseInt(req.params.id, 10);
    if (isNaN(entityId)) {
      res.status(400).json({ ok: false, error: "Invalid entity ID" });
      return;
    }

    const { status } = req.body;
    if (!status || !["candidate", "verified", "rejected"].includes(status)) {
      res.status(400).json({ ok: false, error: "Invalid status. Must be candidate, verified, or rejected" });
      return;
    }

    const [updated] = await db
      .update(entitiesTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(entitiesTable.id, entityId))
      .returning();

    if (!updated) {
      res.status(404).json({ ok: false, error: "Entity not found" });
      return;
    }

    res.json({ ok: true, entity: updated });
  } catch (error) {
    console.error("Update entity error:", error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Failed to update entity" });
  }
});

// PATCH /api/locations/:id - Update location review status
router.patch("/locations/:id", async (req, res) => {
  try {
    const locationId = parseInt(req.params.id, 10);
    if (isNaN(locationId)) {
      res.status(400).json({ ok: false, error: "Invalid location ID" });
      return;
    }

    const { reviewStatus } = req.body;
    if (!reviewStatus || !["candidate", "verified", "rejected", "needs_research"].includes(reviewStatus)) {
      res.status(400).json({ ok: false, error: "Invalid reviewStatus. Must be candidate, verified, rejected, or needs_research" });
      return;
    }

    const [updated] = await db
      .update(locationsTable)
      .set({ reviewStatus, updatedAt: new Date() })
      .where(eq(locationsTable.id, locationId))
      .returning();

    if (!updated) {
      res.status(404).json({ ok: false, error: "Location not found" });
      return;
    }

    res.json({ ok: true, location: updated });
  } catch (error) {
    console.error("Update location error:", error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Failed to update location" });
  }
});

// GET /api/entities/verified - Get verified entities with their locations for dropdown
router.get("/entities/verified", async (req, res) => {
  try {
    const verifiedEntities = await db
      .select()
      .from(entitiesTable)
      .where(eq(entitiesTable.status, "verified"))
      .orderBy(entitiesTable.displayName);

    const result = await Promise.all(
      verifiedEntities.map(async (entity) => {
        const entityLocations = await db
          .select()
          .from(locationsTable)
          .where(eq(locationsTable.entityId, entity.id))
          .orderBy(locationsTable.placeName);

        return {
          id: entity.id,
          name: entity.displayName,
          company: entity.displayName,
          locations: entityLocations
            .filter((loc) => loc.reviewStatus === "verified")
            .map((loc) => ({
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
      })
    );

    res.json({ ok: true, entities: result });
  } catch (error) {
    console.error("Get verified entities error:", error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Failed to get verified entities" });
  }
});

export default router;
