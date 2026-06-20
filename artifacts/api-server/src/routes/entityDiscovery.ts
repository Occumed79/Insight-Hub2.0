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

type ResearchSource = {
  label: string;
  type: "official" | "filing" | "contract" | "jobs" | "web";
  url: string;
  note: string;
};

const MAPPABLE_CONFIDENCE = new Set(["exact", "place", "city"]);
const VALID_CONFIDENCE = new Set(["exact", "place", "city", "unknown"]);

function normalizeEntityName(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 160);
}

function cleanText(value: unknown, max = 280) {
  const cleaned = String(value || "").trim().replace(/\s+/g, " ");
  return cleaned ? cleaned.slice(0, max) : undefined;
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

function coordinateKey(value: unknown) {
  if (!Array.isArray(value) || value.length !== 2) return "missing-coordinate";
  const lon = Number(value[0]);
  const lat = Number(value[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return "missing-coordinate";
  return `${lon.toFixed(5)}|${lat.toFixed(5)}`;
}

function normalizeTextKey(value: unknown) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function candidateKey(loc: Pick<DiscoveredLocation, "coordinates" | "formattedAddress" | "sourceId">) {
  return `${coordinateKey(loc.coordinates)}|${normalizeTextKey(loc.formattedAddress)}|${normalizeTextKey(loc.sourceId)}`;
}

function existingLocationKey(loc: { coordinates: unknown; formattedAddress: string | null; sourceId: string | null }) {
  return `${coordinateKey(loc.coordinates)}|${normalizeTextKey(loc.formattedAddress)}|${normalizeTextKey(loc.sourceId)}`;
}

function looseLocationKey(input: { coordinates: unknown; formattedAddress?: unknown; placeName?: unknown }) {
  return `${coordinateKey(input.coordinates)}|${normalizeTextKey(input.formattedAddress || input.placeName)}`;
}

function buildResearchSources(entityName: string): ResearchSource[] {
  const encoded = encodeURIComponent(entityName);
  const quoted = encodeURIComponent(`"${entityName}"`);
  return [
    { label: "Official locations / offices search", type: "official", url: `https://www.google.com/search?q=${quoted}+locations+offices+facilities`, note: "Use this to verify company-owned office, site, and facility pages." },
    { label: "Company careers locations search", type: "jobs", url: `https://www.google.com/search?q=${quoted}+careers+locations+jobs`, note: "Career portals often expose operating cities and facility names." },
    { label: "SEC EDGAR search", type: "filing", url: `https://www.sec.gov/edgar/search/#/q=${encoded}`, note: "Use filings to verify corporate footprint, subsidiaries, segments, and HQ context." },
    { label: "SAM.gov search", type: "contract", url: `https://sam.gov/search/?index=opp&keywords=${encoded}`, note: "Use federal opportunity and award context for government operating locations." },
    { label: "USASpending search", type: "contract", url: `https://www.usaspending.gov/search/?keyword=${encoded}`, note: "Use award data to identify contract activity and possible performance locations." },
  ];
}

async function getOrCreateEntity(entityName: string, status: "candidate" | "verified" = "candidate") {
  const existingEntity = await db.select().from(entitiesTable).where(eq(entitiesTable.name, entityName)).limit(1);
  if (existingEntity.length > 0) {
    const existing = existingEntity[0];
    if (status === "verified" && existing.status !== "verified") {
      const [updated] = await db.update(entitiesTable).set({ status: "verified", updatedAt: new Date() }).where(eq(entitiesTable.id, existing.id)).returning();
      return updated;
    }
    return existing;
  }
  const [newEntity] = await db.insert(entitiesTable).values({ name: entityName, displayName: entityName, type: "company", status, source: "discovery", metadata: {} }).returning();
  return newEntity;
}

function toDiscoveredLocation(entityName: string, result: NominatimResult): DiscoveredLocation | null {
  const lat = Number(result.lat);
  const lon = Number(result.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const confidence = confidenceFor(result);
  const formattedAddress = result.display_name;
  const placeName = result.name || formattedAddress.split(",")[0] || entityName;
  const country = countryFrom(result.address, formattedAddress);

  return { id: `osm-${result.osm_type}-${result.osm_id}`, companyName: entityName, placeName, formattedAddress, city: cityFrom(result.address), state: stateFrom(result.address), postalCode: result.address?.postcode, country, coordinates: [lon, lat], geocodeSource: "osm", geocodeConfidence: confidence, sourceType: result.type, sourceClass: result.class, sourceId: `${result.osm_type}/${result.osm_id}`, reviewStatus: confidence === "unknown" ? "needs-review" : "candidate" };
}

async function queryNominatim(entityName: string): Promise<DiscoveredLocation[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", entityName);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "40");
  url.searchParams.set("extratags", "1");
  url.searchParams.set("namedetails", "1");
  const response = await fetch(url, { headers: { "User-Agent": "Occu-Med Insight Hub entity discovery (location candidate lookup)", "Accept": "application/json" } });
  if (!response.ok) throw new Error(`OSM Nominatim lookup failed with ${response.status}`);
  const results = (await response.json()) as NominatimResult[];
  const seen = new Set<string>();
  return results.map((result) => toDiscoveredLocation(entityName, result)).filter((result): result is DiscoveredLocation => Boolean(result)).filter((result) => {
    const key = candidateKey(result);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function queryPhoton(entityName: string): Promise<DiscoveredLocation[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", entityName);
  url.searchParams.set("limit", "40");
  const response = await fetch(url, { headers: { "User-Agent": "Occu-Med Insight Hub entity discovery (location candidate lookup)", "Accept": "application/json" } });
  if (!response.ok) throw new Error(`Photon lookup failed with ${response.status}`);
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
    const location: DiscoveredLocation = { id: `photon-${osmId}`, companyName: entityName, placeName: name, formattedAddress: String(props.formatted || `${name}, ${city || ""}, ${country}`), city, state: address.state, postalCode: address.postcode, country, coordinates: [lon, lat], geocodeSource: "photon", geocodeConfidence: confidence, sourceType: String(props.osm_key || "unknown"), sourceClass: String(props.osm_value || "unknown"), sourceId: `photon/${osmId}`, reviewStatus: confidence === "unknown" ? "needs-review" : "candidate" };
    const key = candidateKey(location);
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
    const locations = [...(nominatimResults.status === "fulfilled" ? nominatimResults.value : []), ...(photonResults.status === "fulfilled" ? photonResults.value : [])];
    const seen = new Set<string>();
    const deduplicated = locations.filter((result) => {
      const key = candidateKey(result);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const entity = await getOrCreateEntity(entityName);
    const existingLocations = await db.select().from(locationsTable).where(eq(locationsTable.entityId, entity.id));
    const existingKeys = new Set(existingLocations.map(existingLocationKey));
    const newLocations = deduplicated.filter((loc) => !existingKeys.has(candidateKey(loc)));
    const insertedLocations = newLocations.length > 0 ? await db.insert(locationsTable).values(newLocations.map((loc) => ({ entityId: entity.id, placeName: loc.placeName, formattedAddress: loc.formattedAddress, city: loc.city, state: loc.state, postalCode: loc.postalCode, country: loc.country, region: loc.country, coordinates: loc.coordinates, geocodeSource: loc.geocodeSource, geocodeConfidence: loc.geocodeConfidence, sourceClass: loc.sourceClass, sourceType: loc.sourceType, sourceId: loc.sourceId, reviewStatus: loc.reviewStatus, metadata: {} }))).returning() : [];
    const allLocations = [...existingLocations, ...insertedLocations];
    const mapped = allLocations.filter((location) => MAPPABLE_CONFIDENCE.has(String(location.geocodeConfidence))).length;
    res.status(200).json({ ok: true, entityName, entityId: entity.id, source: "OpenStreetMap Nominatim + Photon", researchSources: buildResearchSources(entityName), generatedAt: new Date().toISOString(), counts: { candidates: allLocations.length, mappable: mapped, needsReview: allLocations.length - mapped, newCandidates: insertedLocations.length, duplicatesSkipped: deduplicated.length - newLocations.length }, locations: allLocations, warning: "These are public geocoding candidates from multiple sources. Select the locations that look correct, then add them to the verified map." });
  } catch (error) {
    console.error("Entity discovery error:", error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Entity discovery failed" });
  }
});

router.post("/entities/manual-location", async (req, res) => {
  try {
    const entityName = normalizeEntityName(req.body?.entityName);
    const placeName = cleanText(req.body?.placeName, 180);
    const country = cleanText(req.body?.country, 120);
    const longitude = Number(req.body?.longitude ?? req.body?.coordinates?.[0]);
    const latitude = Number(req.body?.latitude ?? req.body?.coordinates?.[1]);
    const confidence = VALID_CONFIDENCE.has(String(req.body?.geocodeConfidence)) ? String(req.body.geocodeConfidence) : "exact";
    if (!entityName || !placeName || !country || !Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      res.status(400).json({ ok: false, error: "Entity name, place name, country, longitude, and latitude are required" });
      return;
    }

    const entity = await getOrCreateEntity(entityName, "verified");
    const formattedAddress = cleanText(req.body?.formattedAddress, 500) || [placeName, cleanText(req.body?.city), cleanText(req.body?.state), cleanText(req.body?.postalCode), country].filter(Boolean).join(", ");
    const coordinates: [number, number] = [longitude, latitude];
    const existingLocations = await db.select().from(locationsTable).where(eq(locationsTable.entityId, entity.id));
    const nextLooseKey = looseLocationKey({ coordinates, formattedAddress, placeName });
    const duplicate = existingLocations.find((loc) => looseLocationKey({ coordinates: loc.coordinates, formattedAddress: loc.formattedAddress, placeName: loc.placeName }) === nextLooseKey);
    if (duplicate) {
      res.json({ ok: true, entity, location: duplicate, inserted: false, duplicate: true, researchSources: buildResearchSources(entityName) });
      return;
    }

    const [location] = await db.insert(locationsTable).values({
      entityId: entity.id,
      placeName,
      formattedAddress,
      city: cleanText(req.body?.city, 140),
      state: cleanText(req.body?.state, 120),
      postalCode: cleanText(req.body?.postalCode, 40),
      country,
      region: cleanText(req.body?.region, 120) || country,
      facilityType: cleanText(req.body?.facilityType, 180) || "Manual location",
      activity: cleanText(req.body?.activity, 180) || "Manual entry",
      notes: cleanText(req.body?.notes, 500) || "Added manually from Add Entity.",
      coordinates,
      geocodeSource: "manual",
      geocodeConfidence: confidence,
      sourceClass: "manual",
      sourceType: "manual-location",
      sourceId: `manual/${Date.now()}`,
      reviewStatus: "verified",
      metadata: { manual: true },
    }).returning();

    res.status(201).json({ ok: true, entity, location, inserted: true, duplicate: false, researchSources: buildResearchSources(entityName) });
  } catch (error) {
    console.error("Manual location error:", error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Failed to create manual location" });
  }
});

router.patch("/locations/:id/details", async (req, res) => {
  try {
    const locationId = Number(req.params.id);
    if (!Number.isFinite(locationId)) {
      res.status(400).json({ ok: false, error: "Valid location ID is required" });
      return;
    }
    const coordinates = Array.isArray(req.body?.coordinates) && req.body.coordinates.length === 2 ? [Number(req.body.coordinates[0]), Number(req.body.coordinates[1])] : undefined;
    if (coordinates && (!Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1]))) {
      res.status(400).json({ ok: false, error: "Coordinates must be [longitude, latitude] numbers" });
      return;
    }
    const [updated] = await db.update(locationsTable).set({ placeName: cleanText(req.body?.placeName, 180), formattedAddress: cleanText(req.body?.formattedAddress, 500), city: cleanText(req.body?.city, 140), state: cleanText(req.body?.state, 120), postalCode: cleanText(req.body?.postalCode, 40), country: cleanText(req.body?.country, 120), region: cleanText(req.body?.region || req.body?.country, 120), facilityType: cleanText(req.body?.facilityType, 180), activity: cleanText(req.body?.activity, 180), notes: cleanText(req.body?.notes, 500), coordinates, geocodeConfidence: cleanText(req.body?.geocodeConfidence, 20), geocodeSource: "manual", updatedAt: new Date() }).where(eq(locationsTable.id, locationId)).returning();
    if (!updated) {
      res.status(404).json({ ok: false, error: "Location not found" });
      return;
    }
    res.json({ ok: true, location: updated });
  } catch (error) {
    console.error("Update location details error:", error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Failed to update location" });
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

router.get("/entities/health", async (_req, res) => {
  try {
    await db.select().from(entitiesTable).limit(1);
    res.json({ ok: true, status: "available" });
  } catch (error) {
    console.error("Entity database health error:", error);
    res.status(503).json({ ok: false, status: "unavailable", error: error instanceof Error ? error.message : "Database unavailable" });
  }
});

router.get("/entities/verified", async (_req, res) => {
  try {
    const verifiedEntities = await db.select().from(entitiesTable).where(eq(entitiesTable.status, "verified")).orderBy(entitiesTable.displayName);
    const result = await Promise.all(verifiedEntities.map(async (entity) => {
      const entityLocations = await db.select().from(locationsTable).where(eq(locationsTable.entityId, entity.id)).orderBy(locationsTable.placeName);
      return { id: entity.id, name: entity.displayName, company: entity.displayName, locations: entityLocations.filter((loc) => loc.reviewStatus === "verified").map((loc) => ({ id: loc.id, placeName: loc.placeName, city: loc.city, country: loc.country, region: loc.region, coordinates: loc.coordinates, geocodeConfidence: loc.geocodeConfidence, geocodeSource: loc.geocodeSource, facilityType: loc.facilityType, activity: loc.activity, notes: loc.notes, formattedAddress: loc.formattedAddress, addressLine1: loc.addressLine1, addressLine2: loc.addressLine2, state: loc.state, postalCode: loc.postalCode })) };
    }));
    res.json({ ok: true, entities: result });
  } catch (error) {
    console.error("Get verified entities error:", error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Failed to get verified entities" });
  }
});

export default router;
