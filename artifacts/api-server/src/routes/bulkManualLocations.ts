import { Router } from "express";
import { db, entitiesTable, locationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();
const VALID_CONFIDENCE = new Set(["exact", "place", "city", "unknown"]);

type ManualLocationInput = {
  placeName?: unknown;
  formattedAddress?: unknown;
  city?: unknown;
  state?: unknown;
  postalCode?: unknown;
  country?: unknown;
  facilityType?: unknown;
  activity?: unknown;
  notes?: unknown;
  longitude?: unknown;
  latitude?: unknown;
  coordinates?: unknown;
  geocodeConfidence?: unknown;
};

type LocationInsert = typeof locationsTable.$inferInsert;

function normalizeEntityName(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 160);
}

function cleanText(value: unknown, max = 280) {
  const cleaned = String(value || "").trim().replace(/\s+/g, " ");
  return cleaned ? cleaned.slice(0, max) : undefined;
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

function looseLocationKey(input: { coordinates: unknown; formattedAddress?: unknown; placeName?: unknown }) {
  return `${coordinateKey(input.coordinates)}|${normalizeTextKey(input.formattedAddress || input.placeName)}`;
}

async function getOrCreateEntity(entityName: string) {
  const existingEntity = await db.select().from(entitiesTable).where(eq(entitiesTable.name, entityName)).limit(1);
  if (existingEntity.length > 0) {
    const existing = existingEntity[0];
    if (existing.status !== "verified") {
      const [updated] = await db.update(entitiesTable).set({ status: "verified", updatedAt: new Date() }).where(eq(entitiesTable.id, existing.id)).returning();
      return updated;
    }
    return existing;
  }
  const [newEntity] = await db.insert(entitiesTable).values({ name: entityName, displayName: entityName, type: "company", status: "verified", source: "bulk-manual-import", metadata: {} }).returning();
  return newEntity;
}

function parseCoordinate(input: ManualLocationInput) {
  const fromArray = Array.isArray(input.coordinates) ? input.coordinates : undefined;
  const longitude = Number(input.longitude ?? fromArray?.[0]);
  const latitude = Number(input.latitude ?? fromArray?.[1]);
  return { longitude, latitude, coordinates: [longitude, latitude] as [number, number] };
}

function normalizeManualLocation(input: ManualLocationInput, index: number) {
  const placeName = cleanText(input.placeName, 180);
  const country = cleanText(input.country, 120);
  const { longitude, latitude, coordinates } = parseCoordinate(input);
  const confidence = VALID_CONFIDENCE.has(String(input.geocodeConfidence)) ? String(input.geocodeConfidence) : "exact";

  if (!placeName || !country || !Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return { ok: false as const, index, error: "placeName, country, longitude, and latitude are required" };
  }

  const formattedAddress = cleanText(input.formattedAddress, 500) || [placeName, cleanText(input.city), cleanText(input.state), cleanText(input.postalCode), country].filter(Boolean).join(", ");

  return {
    ok: true as const,
    index,
    value: {
      placeName,
      formattedAddress,
      city: cleanText(input.city, 140),
      state: cleanText(input.state, 120),
      postalCode: cleanText(input.postalCode, 40),
      country,
      region: country,
      facilityType: cleanText(input.facilityType, 180) || "Bulk manual location",
      activity: cleanText(input.activity, 180) || "Bulk manual entry",
      notes: cleanText(input.notes, 500) || "Added through bulk manual import.",
      coordinates,
      geocodeSource: "manual",
      geocodeConfidence: confidence,
      sourceClass: "manual",
      sourceType: "bulk-manual-location",
      sourceId: `bulk-manual/${Date.now()}/${index}`,
      reviewStatus: "verified",
      metadata: { manual: true, bulkImport: true },
    },
  };
}

router.post("/entities/manual-locations", async (req, res) => {
  try {
    const entityName = normalizeEntityName(req.body?.entityName);
    const rawLocations = Array.isArray(req.body?.locations) ? req.body.locations as ManualLocationInput[] : [];

    if (!entityName || rawLocations.length === 0) {
      res.status(400).json({ ok: false, error: "entityName and locations[] are required" });
      return;
    }

    const entity = await getOrCreateEntity(entityName);
    const existingLocations = await db.select().from(locationsTable).where(eq(locationsTable.entityId, entity.id));
    const seenKeys = new Set(existingLocations.map((loc) => looseLocationKey({ coordinates: loc.coordinates, formattedAddress: loc.formattedAddress, placeName: loc.placeName })));
    const batchKeys = new Set<string>();
    const rejected: Array<{ index: number; error: string }> = [];
    const values: LocationInsert[] = [];

    rawLocations.forEach((raw, index) => {
      const normalized = normalizeManualLocation(raw, index);
      if (!normalized.ok) {
        rejected.push({ index, error: normalized.error });
        return;
      }
      const key = looseLocationKey(normalized.value);
      if (seenKeys.has(key) || batchKeys.has(key)) {
        rejected.push({ index, error: "duplicate skipped" });
        return;
      }
      batchKeys.add(key);
      values.push({ entityId: entity.id, ...normalized.value });
    });

    const inserted = values.length > 0 ? await db.insert(locationsTable).values(values).returning() : [];

    res.status(201).json({
      ok: true,
      entity,
      inserted,
      counts: {
        received: rawLocations.length,
        inserted: inserted.length,
        rejected: rejected.length,
        duplicatesSkipped: rejected.filter((item) => item.error === "duplicate skipped").length,
      },
      rejected,
    });
  } catch (error) {
    console.error("Bulk manual locations error:", error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Failed to import manual locations" });
  }
});

export default router;
