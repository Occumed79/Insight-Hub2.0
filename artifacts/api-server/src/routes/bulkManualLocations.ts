import { Router } from "express";
import { db, entitiesTable, locationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();
const VALID_CONFIDENCE = new Set(["exact", "place", "city", "unknown"]);
const US_STATE_CODES = new Set(["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DC", "DE", "FL", "GA", "HI", "IA", "ID", "IL", "IN", "KS", "KY", "LA", "MA", "MD", "ME", "MI", "MN", "MO", "MS", "MT", "NC", "ND", "NE", "NH", "NJ", "NM", "NV", "NY", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VA", "VT", "WA", "WI", "WV", "WY"]);
const EUROPE = new Set(["Albania", "Austria", "Belgium", "Bulgaria", "Croatia", "Czechia", "Denmark", "France", "Germany", "Greece", "Italy", "Kosovo", "Netherlands", "Norway", "Poland", "Romania", "Serbia", "Slovakia", "Spain", "Sweden", "Switzerland", "Turkey", "Ukraine", "United Kingdom", "UK"]);
const MIDDLE_EAST = new Set(["Bahrain", "Iraq", "Israel", "Jordan", "Kuwait", "Oman", "Qatar", "Saudi Arabia", "UAE", "United Arab Emirates", "Yemen"]);
const AFRICA = new Set(["Algeria", "Benin", "Botswana", "Burkina Faso", "Egypt", "Ethiopia", "Ghana", "Kenya", "Morocco", "Mozambique", "Niger", "Nigeria", "Somalia", "South Africa", "South Sudan", "Uganda"]);
const INDO_PACIFIC = new Set(["Australia", "Bangladesh", "British Indian Ocean Territory", "China", "Guam", "India", "Japan", "Malaysia", "Marshall Islands", "Philippines", "Singapore", "South Korea", "Thailand"]);
const LATAM = new Set(["Bahamas", "Brazil", "Colombia", "Cuba", "Honduras", "Mexico", "Panama"]);
const POLAR = new Set(["Antarctica", "Greenland"]);

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

type ParsedTextLocation = {
  entityName: string;
  placeName: string;
  formattedAddress: string;
  city?: string;
  state?: string;
  country: string;
  region: string;
  facilityType: string;
  activity: string;
  notes: string;
  coordinates: [number, number];
  sourceId: string;
};

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

function normalizeImportedCompanyName(value: string) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  const mapped: Record<string, string> = {
    "S3 International (Huntsville, AL)": "S3 International",
    "SOS International (Three separate companies)": "SOSi",
    "AMENTUM": "Amentum",
    "PAE (Pacific Architects and Engineers)": "PAE Legacy / Amentum",
    "KBR, Inc.": "KBR Inc.",
    "IAP Worldwide Services, Inc.": "IAP Worldwide Services",
    "General Dynamics Information Technology (GDIT)": "General Dynamics Information Technology",
    "Fluor Intercontinental, Inc.": "Fluor Corporation",
    "Weatherford International": "Weatherford",
    "DataPath": "Datapath, Inc.",
    "Dynamic Aviation": "Dynamic Aviation Group",
  };
  return mapped[cleaned] || cleaned.replace(/\s*—\s*$/g, "");
}

function normalizeCountry(country: string) {
  const cleaned = country.trim().replace(/\s+/g, " ");
  if (cleaned === "USA" || cleaned === "US") return "United States";
  if (cleaned === "UK") return "United Kingdom";
  if (cleaned === "UAE") return "United Arab Emirates";
  return cleaned;
}

function regionFor(country: string, state?: string) {
  if (country === "United States" || country === "Canada" || state) return "North America";
  if (EUROPE.has(country)) return "Europe";
  if (MIDDLE_EAST.has(country)) return "Middle East / Central Asia";
  if (AFRICA.has(country)) return "Africa";
  if (INDO_PACIFIC.has(country)) return "Indo-Pacific";
  if (LATAM.has(country)) return "Latin America / Caribbean";
  if (POLAR.has(country)) return "Polar / Arctic";
  return "Global";
}

function parsePlaceName(placeName: string) {
  const parts = placeName.split(",").map((part) => part.trim()).filter(Boolean);
  const city = parts[0] || placeName.trim();
  let state: string | undefined;
  let country = normalizeCountry(parts[parts.length - 1] || "Unknown");

  const last = parts[parts.length - 1];
  const previous = parts[parts.length - 2];
  if (last && US_STATE_CODES.has(last)) {
    state = last;
    country = "United States";
  } else if (last && previous && last.toLowerCase() === previous.toLowerCase()) {
    country = normalizeCountry(last);
  }

  return { city, state, country, region: regionFor(country, state) };
}

function importSourceId(entityName: string, placeName: string, index: number) {
  const key = `${entityName}-${placeName}-${index}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 90);
  return `company-location-text/${key}`;
}

function parseCompanyLocationText(rawText: string) {
  const parsed: ParsedTextLocation[] = [];
  const invalidRows: Array<{ line: number; error: string }> = [];
  let currentEntity = "";

  rawText.split(/\r?\n/).forEach((line, index) => {
    const heading = line.match(/^(\d+)\.\s+(.+?)\s*$/);
    if (heading) {
      currentEntity = normalizeImportedCompanyName(heading[2]);
      return;
    }

    const trimmed = line.trim();
    if (!trimmed.startsWith("-") || !trimmed.includes("Lat:") || !trimmed.includes("Lon:")) return;
    if (!currentEntity) {
      invalidRows.push({ line: index + 1, error: "Location row found before company heading" });
      return;
    }

    const coord = trimmed.match(/\[Lat:\s*(-?\d+(?:\.\d+)?),\s*Lon:\s*(-?\d+(?:\.\d+)?)\]/);
    if (!coord) {
      invalidRows.push({ line: index + 1, error: "Missing parseable Lat/Lon" });
      return;
    }

    const latitude = Number(coord[1]);
    const longitude = Number(coord[2]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      invalidRows.push({ line: index + 1, error: "Invalid coordinate" });
      return;
    }

    const content = trimmed.replace(/^[-\s]+/, "").replace(/\s*\[Lat:.*?\]\s*$/, "").trim();
    const [placePart, ...descParts] = content.split(" - ");
    const placeName = cleanText(placePart, 220);
    if (!placeName) {
      invalidRows.push({ line: index + 1, error: "Missing place name" });
      return;
    }

    const description = cleanText(descParts.join(" - "), 300) || "Operational presence";
    const place = parsePlaceName(placeName);
    parsed.push({
      entityName: currentEntity,
      placeName,
      formattedAddress: placeName,
      city: place.city,
      state: place.state,
      country: place.country,
      region: place.region,
      facilityType: description,
      activity: description,
      notes: `Imported from Company_Locations_Complete_Updated.txt: ${description}.`,
      coordinates: [longitude, latitude],
      sourceId: importSourceId(currentEntity, placeName, index),
    });
  });

  return { parsed, invalidRows };
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

async function insertInChunks(values: LocationInsert[], chunkSize = 250) {
  const inserted = [] as LocationInsert[];
  for (let index = 0; index < values.length; index += chunkSize) {
    const chunk = values.slice(index, index + chunkSize);
    if (chunk.length === 0) continue;
    const rows = await db.insert(locationsTable).values(chunk).returning();
    inserted.push(...rows);
  }
  return inserted;
}

router.post("/entities/import-company-location-text", async (req, res) => {
  try {
    const rawText = String(req.body?.text || req.body?.rawText || "");
    if (!rawText.trim()) {
      res.status(400).json({ ok: false, error: "text is required" });
      return;
    }

    const { parsed, invalidRows } = parseCompanyLocationText(rawText);
    const grouped = new Map<string, ParsedTextLocation[]>();
    for (const row of parsed) {
      const bucket = grouped.get(row.entityName) || [];
      bucket.push(row);
      grouped.set(row.entityName, bucket);
    }

    let insertedCount = 0;
    let duplicateCount = 0;
    const companies: Array<{ name: string; received: number; inserted: number; duplicatesSkipped: number }> = [];

    for (const [entityName, rows] of grouped.entries()) {
      const entity = await getOrCreateEntity(entityName);
      const existingLocations = await db.select().from(locationsTable).where(eq(locationsTable.entityId, entity.id));
      const seenKeys = new Set(existingLocations.map((loc) => looseLocationKey({ coordinates: loc.coordinates, formattedAddress: loc.formattedAddress, placeName: loc.placeName })));
      const batchKeys = new Set<string>();
      const values: LocationInsert[] = [];
      let duplicatesSkipped = 0;

      rows.forEach((row) => {
        const key = looseLocationKey(row);
        if (seenKeys.has(key) || batchKeys.has(key)) {
          duplicatesSkipped += 1;
          return;
        }
        batchKeys.add(key);
        values.push({
          entityId: entity.id,
          placeName: row.placeName,
          formattedAddress: row.formattedAddress,
          city: row.city,
          state: row.state,
          country: row.country,
          region: row.region,
          facilityType: row.facilityType,
          activity: row.activity,
          notes: row.notes,
          coordinates: row.coordinates,
          geocodeSource: "manual",
          geocodeConfidence: "place",
          sourceClass: "manual",
          sourceType: "company-location-text-import",
          sourceId: row.sourceId,
          reviewStatus: "verified",
          metadata: { manual: true, companyLocationTextImport: true },
        });
      });

      const inserted = await insertInChunks(values);
      insertedCount += inserted.length;
      duplicateCount += duplicatesSkipped;
      companies.push({ name: entityName, received: rows.length, inserted: inserted.length, duplicatesSkipped });
    }

    res.status(201).json({
      ok: true,
      counts: {
        companies: grouped.size,
        parsedRows: parsed.length,
        inserted: insertedCount,
        duplicatesSkipped: duplicateCount,
        invalidRows: invalidRows.length,
      },
      companies,
      invalidRows: invalidRows.slice(0, 50),
    });
  } catch (error) {
    console.error("Company location text import error:", error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Failed to import company location text" });
  }
});

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

    const inserted = await insertInChunks(values);

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
