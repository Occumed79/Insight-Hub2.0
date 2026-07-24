import { Router } from "express";
import { db, entitiesTable, locationsTable } from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  discoverCompanyLocations,
  type CompanyLocationCandidate,
  type DiscoveryDiagnostic,
} from "../lib/companyLocationDiscovery";

const router = Router();

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

function objectMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function coordinateKey(value: unknown) {
  if (!Array.isArray(value) || value.length !== 2) return "missing-coordinate";
  const lon = Number(value[0]);
  const lat = Number(value[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return "missing-coordinate";
  return `${lon.toFixed(4)}|${lat.toFixed(4)}`;
}

function normalizeTextKey(value: unknown) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function looseLocationKey(input: { coordinates: unknown; formattedAddress?: unknown; placeName?: unknown }) {
  return `${coordinateKey(input.coordinates)}|${normalizeTextKey(input.formattedAddress || input.placeName)}`;
}

function buildResearchSources(entityName: string, officialWebsite?: string): ResearchSource[] {
  const encoded = encodeURIComponent(entityName);
  const quoted = encodeURIComponent(`"${entityName}"`);
  return [
    ...(officialWebsite ? [{ label: "Official company website", type: "official" as const, url: officialWebsite, note: "Primary public source used for location-page and structured-address discovery." }] : []),
    { label: "Official locations / offices search", type: "official", url: `https://www.google.com/search?q=${quoted}+locations+offices+facilities`, note: "Use this to verify company-owned office, site, and facility pages." },
    { label: "Company careers locations search", type: "jobs", url: `https://www.google.com/search?q=${quoted}+careers+locations+jobs`, note: "Career portals often expose operating cities and facility names." },
    { label: "SEC EDGAR search", type: "filing", url: `https://www.sec.gov/edgar/search/#/q=${encoded}`, note: "Use filings to verify corporate footprint, subsidiaries, segments, and headquarters context." },
    { label: "SAM.gov search", type: "contract", url: `https://sam.gov/search/?index=opp&keywords=${encoded}`, note: "Use federal opportunity and award context for government operating locations." },
    { label: "USASpending search", type: "contract", url: `https://www.usaspending.gov/search/?keyword=${encoded}`, note: "Use award data to identify contract activity and possible performance locations." },
  ];
}

async function getOrCreateEntity(
  entityName: string,
  status: "candidate" | "verified" = "candidate",
  metadata: Record<string, unknown> = {},
  displayName = entityName,
) {
  const existingEntity = await db
    .select()
    .from(entitiesTable)
    .where(sql`lower(${entitiesTable.name}) = lower(${entityName})`)
    .limit(1);
  if (existingEntity.length > 0) {
    const existing = existingEntity[0];
    const [updated] = await db.update(entitiesTable).set({
      displayName: displayName || existing.displayName,
      status: status === "verified" || existing.status === "verified" ? "verified" : existing.status,
      metadata: { ...objectMetadata(existing.metadata), ...metadata },
      updatedAt: new Date(),
    }).where(eq(entitiesTable.id, existing.id)).returning();
    return updated;
  }
  const [newEntity] = await db.insert(entitiesTable).values({
    name: entityName,
    displayName,
    type: "company",
    status,
    source: "company-location-discovery",
    metadata,
  }).returning();
  return newEntity;
}

function locationMetadata(candidate: CompanyLocationCandidate): Record<string, unknown> {
  return {
    sourceUrl: candidate.sourceUrl,
    sourceTitle: candidate.sourceTitle,
    evidenceSnippet: candidate.evidenceSnippet,
    discoveredBy: candidate.discoveredBy,
    discoveredAt: new Date().toISOString(),
  };
}

async function persistDiscoveryLocations(entityId: number, candidates: CompanyLocationCandidate[]) {
  const existingLocations = await db.select().from(locationsTable).where(eq(locationsTable.entityId, entityId));
  const existingByKey = new Map(existingLocations.map((location) => [looseLocationKey(location), location]));
  const uniqueCandidates = new Map<string, CompanyLocationCandidate>();
  for (const candidate of candidates) {
    const key = looseLocationKey(candidate);
    const current = uniqueCandidates.get(key);
    if (!current || (candidate.discoveredBy === "official-site" && current.discoveredBy !== "official-site")) uniqueCandidates.set(key, candidate);
  }

  const insertValues: Array<typeof locationsTable.$inferInsert> = [];
  let enrichedExisting = 0;
  for (const candidate of uniqueCandidates.values()) {
    const key = looseLocationKey(candidate);
    const existing = existingByKey.get(key);
    if (existing) {
      const currentMetadata = objectMetadata(existing.metadata);
      const shouldEnrich = candidate.discoveredBy === "official-site"
        && (!currentMetadata.sourceUrl || currentMetadata.discoveredBy !== "official-site");
      if (shouldEnrich) {
        await db.update(locationsTable).set({
          placeName: candidate.placeName || existing.placeName,
          formattedAddress: candidate.formattedAddress || existing.formattedAddress,
          city: candidate.city || existing.city,
          state: candidate.state || existing.state,
          postalCode: candidate.postalCode || existing.postalCode,
          country: candidate.country || existing.country,
          region: candidate.region || candidate.state || candidate.country || existing.region,
          facilityType: candidate.facilityType || existing.facilityType,
          activity: candidate.activity || existing.activity,
          notes: candidate.notes || existing.notes,
          geocodeSource: candidate.geocodeSource || existing.geocodeSource,
          geocodeConfidence: candidate.geocodeConfidence === "unknown" ? existing.geocodeConfidence : candidate.geocodeConfidence,
          sourceClass: candidate.sourceClass || existing.sourceClass,
          sourceType: candidate.sourceType || existing.sourceType,
          sourceId: candidate.sourceId || existing.sourceId,
          metadata: { ...currentMetadata, ...locationMetadata(candidate) },
          updatedAt: new Date(),
        }).where(eq(locationsTable.id, existing.id));
        enrichedExisting += 1;
      }
      continue;
    }
    insertValues.push({
      entityId,
      placeName: candidate.placeName,
      formattedAddress: candidate.formattedAddress,
      city: candidate.city,
      state: candidate.state,
      postalCode: candidate.postalCode,
      country: candidate.country,
      region: candidate.region || candidate.state || candidate.country,
      facilityType: candidate.facilityType,
      activity: candidate.activity,
      notes: candidate.notes,
      coordinates: candidate.coordinates,
      geocodeSource: candidate.geocodeSource,
      geocodeConfidence: candidate.geocodeConfidence,
      sourceClass: candidate.sourceClass,
      sourceType: candidate.sourceType,
      sourceId: candidate.sourceId,
      reviewStatus: candidate.reviewStatus,
      metadata: locationMetadata(candidate),
    });
  }
  const inserted = insertValues.length > 0 ? await db.insert(locationsTable).values(insertValues).returning() : [];
  const allLocations = await db.select().from(locationsTable).where(eq(locationsTable.entityId, entityId));
  return {
    allLocations,
    insertedCount: inserted.length,
    enrichedExisting,
    duplicatesSkipped: uniqueCandidates.size - inserted.length - enrichedExisting,
  };
}

router.post("/entity-discovery/locations", async (req, res) => {
  const enteredName = normalizeEntityName(req.body?.entityName);
  if (!enteredName) {
    res.status(400).json({ ok: false, error: "entityName is required" });
    return;
  }

  let entity = await getOrCreateEntity(enteredName, "candidate", {
    enteredName,
    savedBy: "locations-tab",
    savedAt: new Date().toISOString(),
    discoveryStatus: "running",
  });

  try {
    const discovery = await discoverCompanyLocations(enteredName);
    const discoveryMetadata = {
      enteredName,
      canonicalName: discovery.canonicalName,
      aliases: discovery.aliases,
      wikidataId: discovery.wikidataId,
      officialWebsite: discovery.officialWebsite,
      officialWebsiteSource: discovery.officialWebsiteSource,
      lastDiscoveryAt: new Date().toISOString(),
      officialPagesScanned: discovery.officialPagesScanned,
      officialAddressesExtracted: discovery.officialAddressesExtracted,
      sourceDiagnostics: discovery.diagnostics,
      discoveryStatus: "completed",
    };
    entity = await getOrCreateEntity(enteredName, "candidate", discoveryMetadata, discovery.canonicalName);
    const persisted = await persistDiscoveryLocations(entity.id, discovery.locations);
    const mapped = persisted.allLocations.filter((location) => MAPPABLE_CONFIDENCE.has(String(location.geocodeConfidence)) && location.reviewStatus !== "rejected").length;
    const activeLocations = persisted.allLocations.filter((location) => location.reviewStatus !== "rejected");
    res.status(200).json({
      ok: true,
      entityName: discovery.canonicalName,
      enteredName,
      entityId: entity.id,
      company: {
        id: entity.id,
        enteredName,
        canonicalName: discovery.canonicalName,
        aliases: discovery.aliases,
        wikidataId: discovery.wikidataId,
        officialWebsite: discovery.officialWebsite,
        savedToDatabase: true,
        status: entity.status,
      },
      source: "Official company website + Wikidata + configured web search + OpenStreetMap + Photon",
      sourceDiagnostics: discovery.diagnostics,
      coverage: {
        officialPagesScanned: discovery.officialPagesScanned,
        officialAddressesExtracted: discovery.officialAddressesExtracted,
        officialLocationsGeocoded: discovery.locations.filter((location) => location.discoveredBy === "official-site").length,
      },
      researchSources: buildResearchSources(discovery.canonicalName, discovery.officialWebsite),
      generatedAt: new Date().toISOString(),
      counts: {
        candidates: activeLocations.length,
        mappable: mapped,
        needsReview: activeLocations.filter((location) => location.reviewStatus === "needs-review" || !MAPPABLE_CONFIDENCE.has(String(location.geocodeConfidence))).length,
        newCandidates: persisted.insertedCount,
        duplicatesSkipped: persisted.duplicatesSkipped,
        enrichedExisting: persisted.enrichedExisting,
      },
      locations: activeLocations,
      warnings: discovery.warnings,
      warning: discovery.warnings.join(" "),
    });
  } catch (error) {
    await db.update(entitiesTable).set({
      metadata: { ...objectMetadata(entity.metadata), discoveryStatus: "failed", lastDiscoveryError: error instanceof Error ? error.message : "Unknown error", lastDiscoveryAt: new Date().toISOString() },
      updatedAt: new Date(),
    }).where(eq(entitiesTable.id, entity.id));
    console.error("Entity discovery error:", error);
    res.status(500).json({ ok: false, entityId: entity.id, companySaved: true, error: error instanceof Error ? error.message : "Entity discovery failed" });
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

    const entity = await getOrCreateEntity(entityName, "verified", { lastManualLocationAt: new Date().toISOString() });
    const formattedAddress = cleanText(req.body?.formattedAddress, 500) || [placeName, cleanText(req.body?.city), cleanText(req.body?.state), cleanText(req.body?.postalCode), country].filter(Boolean).join(", ");
    const coordinates: [number, number] = [longitude, latitude];
    const existingLocations = await db.select().from(locationsTable).where(eq(locationsTable.entityId, entity.id));
    const nextLooseKey = looseLocationKey({ coordinates, formattedAddress, placeName });
    const duplicate = existingLocations.find((location) => looseLocationKey(location) === nextLooseKey);
    if (duplicate) {
      res.json({ ok: true, entity, location: duplicate, inserted: false, duplicate: true, researchSources: buildResearchSources(entityName, cleanText(objectMetadata(entity.metadata).officialWebsite, 500)) });
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
      metadata: { manual: true, discoveredAt: new Date().toISOString() },
    }).returning();

    res.status(201).json({ ok: true, entity, location, inserted: true, duplicate: false, researchSources: buildResearchSources(entityName, cleanText(objectMetadata(entity.metadata).officialWebsite, 500)) });
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
    const [updated] = await db.update(locationsTable).set({
      placeName: cleanText(req.body?.placeName, 180),
      formattedAddress: cleanText(req.body?.formattedAddress, 500),
      city: cleanText(req.body?.city, 140),
      state: cleanText(req.body?.state, 120),
      postalCode: cleanText(req.body?.postalCode, 40),
      country: cleanText(req.body?.country, 120),
      region: cleanText(req.body?.region || req.body?.country, 120),
      facilityType: cleanText(req.body?.facilityType, 180),
      activity: cleanText(req.body?.activity, 180),
      notes: cleanText(req.body?.notes, 500),
      coordinates,
      geocodeConfidence: cleanText(req.body?.geocodeConfidence, 20),
      geocodeSource: "manual",
      updatedAt: new Date(),
    }).where(eq(locationsTable.id, locationId)).returning();
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

router.post("/entities/:id/verify-location", async (req, res) => {
  try {
    const entityId = Number(req.params.id);
    const locationId = Number(req.body?.locationId);
    if (!Number.isFinite(entityId) || !Number.isFinite(locationId)) {
      res.status(400).json({ ok: false, error: "Valid entity ID and location ID are required" });
      return;
    }
    const [location] = await db.update(locationsTable).set({ reviewStatus: "verified", updatedAt: new Date() }).where(and(eq(locationsTable.entityId, entityId), eq(locationsTable.id, locationId))).returning();
    if (!location) {
      res.status(404).json({ ok: false, error: "Location not found for this company" });
      return;
    }
    const [entity] = await db.update(entitiesTable).set({ status: "verified", updatedAt: new Date() }).where(eq(entitiesTable.id, entityId)).returning();
    res.json({ ok: true, entity, location });
  } catch (error) {
    console.error("Verify location error:", error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Failed to verify location" });
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

async function savedEntityPayload(verifiedOnly: boolean) {
  const entities = verifiedOnly
    ? await db.select().from(entitiesTable).where(eq(entitiesTable.status, "verified")).orderBy(entitiesTable.displayName)
    : await db.select().from(entitiesTable).orderBy(entitiesTable.displayName);
  return Promise.all(entities.map(async (entity) => {
    const entityLocations = await db.select().from(locationsTable).where(eq(locationsTable.entityId, entity.id)).orderBy(locationsTable.placeName);
    const metadata = objectMetadata(entity.metadata);
    return {
      id: entity.id,
      name: entity.displayName,
      company: entity.displayName,
      enteredName: metadata.enteredName || entity.name,
      status: entity.status,
      officialWebsite: metadata.officialWebsite,
      wikidataId: metadata.wikidataId,
      lastDiscoveryAt: metadata.lastDiscoveryAt,
      discoveryStatus: metadata.discoveryStatus,
      locations: entityLocations
        .filter((location) => verifiedOnly ? location.reviewStatus === "verified" : location.reviewStatus !== "rejected")
        .map((location) => ({
          id: location.id,
          entityId: location.entityId,
          placeName: location.placeName,
          city: location.city,
          country: location.country,
          region: location.region,
          coordinates: location.coordinates,
          geocodeConfidence: location.geocodeConfidence,
          geocodeSource: location.geocodeSource,
          facilityType: location.facilityType,
          activity: location.activity,
          notes: location.notes,
          formattedAddress: location.formattedAddress,
          addressLine1: location.addressLine1,
          addressLine2: location.addressLine2,
          state: location.state,
          postalCode: location.postalCode,
          sourceClass: location.sourceClass,
          sourceType: location.sourceType,
          sourceId: location.sourceId,
          reviewStatus: location.reviewStatus,
          metadata: location.metadata,
        })),
    };
  }));
}

router.get("/entities/saved", async (_req, res) => {
  try {
    res.json({ ok: true, entities: await savedEntityPayload(false) });
  } catch (error) {
    console.error("Get saved entities error:", error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Failed to get saved entities" });
  }
});

router.get("/entities/verified", async (_req, res) => {
  try {
    res.json({ ok: true, entities: await savedEntityPayload(true) });
  } catch (error) {
    console.error("Get verified entities error:", error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Failed to get verified entities" });
  }
});

export default router;
