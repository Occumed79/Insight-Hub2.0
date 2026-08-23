import { Router } from "express";
import { db, entitiesTable, locationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  discoverCompanyLocations,
  type CompanyLocationCandidate,
  type DiscoveryDiagnostic,
} from "../lib/companyLocationDiscovery";
import {
  enrichCompanyLocationsWithAi,
  type LocationAiDiagnostic,
} from "../lib/locationAiOrchestration";
import {
  discoverFoursquareLocations,
  type FoursquareDiagnostic,
} from "../lib/foursquareLocationDiscovery";
import {
  discoverCommercialPlaces,
  type CommercialPlaceDiagnostic,
} from "../lib/commercialPlaceDiscovery";
import {
  discoverGeoPlaces,
  type GeoPlaceDiagnostic,
} from "../lib/geoPlaceDiscovery";
import {
  searchSharedWeb,
  sharedSearchKeyCounts,
  type SharedSearchDiagnostic,
} from "../lib/sharedWebSearch";

const router = Router();
const MAPPABLE_CONFIDENCE = new Set(["exact", "place", "city"]);
const STRUCTURED_PLACE_CLASSES = new Set([
  "foursquare-places",
  "tomtom-poi",
  "geoapify-geocoder",
  "locationiq-geocoder",
]);

function normalizeEntityName(value: unknown): string {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 160);
}

function normalizeKey(value: unknown): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function objectMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function coordinateKey(value: unknown): string {
  if (!Array.isArray(value) || value.length !== 2) return "missing";
  const longitude = Number(value[0]);
  const latitude = Number(value[1]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return "missing";
  return `${longitude.toFixed(4)}|${latitude.toFixed(4)}`;
}

function candidateKey(candidate: Pick<CompanyLocationCandidate, "coordinates" | "formattedAddress" | "placeName">): string {
  return `${coordinateKey(candidate.coordinates)}|${normalizeKey(candidate.formattedAddress || candidate.placeName)}`;
}

function locationKey(location: { coordinates: unknown; formattedAddress: string | null; placeName: string }): string {
  return `${coordinateKey(location.coordinates)}|${normalizeKey(location.formattedAddress || location.placeName)}`;
}

function mergeCandidates(candidates: CompanyLocationCandidate[]): CompanyLocationCandidate[] {
  const merged = new Map<string, CompanyLocationCandidate>();
  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, candidate);
      continue;
    }

    const candidateIsAiOfficial = candidate.sourceClass === "official-site-ai";
    const existingIsAiOfficial = existing.sourceClass === "official-site-ai";
    const candidateIsOfficial = candidate.discoveredBy === "official-site";
    const existingIsOfficial = existing.discoveredBy === "official-site";
    const candidateIsStructured = STRUCTURED_PLACE_CLASSES.has(String(candidate.sourceClass));
    const existingIsStructured = STRUCTURED_PLACE_CLASSES.has(String(existing.sourceClass));
    const preferCandidate = candidateIsAiOfficial && !existingIsAiOfficial
      ? true
      : candidateIsOfficial && !existingIsOfficial
        ? true
        : candidateIsStructured && !existingIsStructured && !existingIsOfficial && !existingIsAiOfficial;

    const primary = preferCandidate ? candidate : existing;
    const secondary = preferCandidate ? existing : candidate;
    merged.set(key, {
      ...secondary,
      ...primary,
      sourceUrl: primary.sourceUrl || secondary.sourceUrl,
      sourceTitle: primary.sourceTitle || secondary.sourceTitle,
      evidenceSnippet: primary.evidenceSnippet || secondary.evidenceSnippet,
      facilityType: primary.facilityType || secondary.facilityType,
      notes: primary.notes || secondary.notes,
      activity: primary.activity || secondary.activity,
      geocodeConfidence: primary.geocodeConfidence === "unknown" ? secondary.geocodeConfidence : primary.geocodeConfidence,
    });
  }
  return Array.from(merged.values()).slice(0, 500);
}

function locationMetadata(candidate: CompanyLocationCandidate): Record<string, unknown> {
  return {
    sourceUrl: candidate.sourceUrl,
    sourceTitle: candidate.sourceTitle,
    evidenceSnippet: candidate.evidenceSnippet,
    discoveredBy: candidate.discoveredBy,
    discoveredAt: new Date().toISOString(),
    aiAssisted: candidate.sourceClass === "official-site-ai",
    structuredPlaceSource: STRUCTURED_PLACE_CLASSES.has(String(candidate.sourceClass)),
  };
}

async function getOrCreateEntity(
  enteredName: string,
  canonicalName: string,
  metadata: Record<string, unknown>,
) {
  const existingRows = await db.select().from(entitiesTable).where(eq(entitiesTable.name, enteredName)).limit(1);
  if (existingRows.length > 0) {
    const existing = existingRows[0];
    const [updated] = await db.update(entitiesTable).set({
      displayName: canonicalName || existing.displayName,
      metadata: { ...objectMetadata(existing.metadata), ...metadata },
      updatedAt: new Date(),
    }).where(eq(entitiesTable.id, existing.id)).returning();
    return updated;
  }

  const [created] = await db.insert(entitiesTable).values({
    name: enteredName,
    displayName: canonicalName || enteredName,
    type: "company",
    status: "candidate",
    source: "locations-unified-discovery",
    metadata,
  }).returning();
  return created;
}

async function persistLocations(entityId: number, candidates: CompanyLocationCandidate[]) {
  const existingLocations = await db.select().from(locationsTable).where(eq(locationsTable.entityId, entityId));
  const existingByKey = new Map(existingLocations.map((location) => [locationKey(location), location]));
  let enrichedExisting = 0;
  let duplicatesSkipped = 0;
  const insertValues: Array<typeof locationsTable.$inferInsert> = [];

  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    const existing = existingByKey.get(key);
    if (existing) {
      const metadata = objectMetadata(existing.metadata);
      const candidateIsStructured = STRUCTURED_PLACE_CLASSES.has(String(candidate.sourceClass));
      const existingIsOfficial = existing.sourceClass === "official-site" || existing.sourceClass === "official-site-ai";
      const existingIsStructured = STRUCTURED_PLACE_CLASSES.has(String(existing.sourceClass));
      const candidateHasStrongerEvidence = (
        candidate.discoveredBy === "official-site" && (!metadata.sourceUrl || candidate.sourceClass === "official-site-ai")
      ) || (
        candidateIsStructured && !existingIsOfficial && !existingIsStructured
      );

      if (candidateHasStrongerEvidence) {
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
          metadata: { ...metadata, ...locationMetadata(candidate) },
          updatedAt: new Date(),
        }).where(eq(locationsTable.id, existing.id));
        enrichedExisting += 1;
      } else {
        duplicatesSkipped += 1;
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

  const inserted = insertValues.length > 0
    ? await db.insert(locationsTable).values(insertValues).returning()
    : [];
  const allLocations = await db.select().from(locationsTable).where(eq(locationsTable.entityId, entityId));
  return { allLocations, insertedCount: inserted.length, enrichedExisting, duplicatesSkipped };
}

function buildResearchSources(
  companyName: string,
  officialWebsite: string | undefined,
  webResults: Array<{ title: string; url: string; provider: string }>,
) {
  const encoded = encodeURIComponent(companyName);
  const quoted = encodeURIComponent(`"${companyName}"`);
  const liveSearchSources = webResults.slice(0, 12).map((result) => ({
    label: `${result.provider}: ${result.title}`,
    type: "web" as const,
    url: result.url,
    note: "Live search lead surfaced by the shared Insight Hub search stack for location verification.",
  }));
  return [
    ...(officialWebsite ? [{ label: "Official company website", type: "official" as const, url: officialWebsite, note: "Primary company-domain evidence used for location discovery." }] : []),
    ...liveSearchSources,
    { label: "Official locations search", type: "official" as const, url: `https://www.google.com/search?q=${quoted}+locations+offices+facilities`, note: "Manual verification path for public company location pages." },
    { label: "Company careers locations search", type: "jobs" as const, url: `https://www.google.com/search?q=${quoted}+careers+locations+jobs`, note: "Career pages may expose active operating cities and facility names." },
    { label: "SEC EDGAR search", type: "filing" as const, url: `https://www.sec.gov/edgar/search/#/q=${encoded}`, note: "Filings may identify principal offices, facilities, and operating regions." },
  ];
}

router.post("/locations/discover", async (req, res) => {
  const enteredName = normalizeEntityName(req.body?.entityName);
  if (!enteredName) {
    res.status(400).json({ ok: false, error: "entityName is required" });
    return;
  }

  let entity = await getOrCreateEntity(enteredName, enteredName, {
    enteredName,
    savedBy: "locations-tab",
    savedAt: new Date().toISOString(),
    discoveryStatus: "running",
  });

  try {
    const baseline = await discoverCompanyLocations(enteredName);
    const locationHints = baseline.locations
      .filter((location) => Array.isArray(location.coordinates) && location.coordinates.length === 2)
      .map((location) => ({
        label: [location.city, location.state, location.country].filter(Boolean).join(", "),
        latitude: Number(location.coordinates[1]),
        longitude: Number(location.coordinates[0]),
      }))
      .filter((hint) => Number.isFinite(hint.latitude) && Number.isFinite(hint.longitude));

    const locationWebQuery = `"${baseline.canonicalName}" locations offices branches facilities plants warehouses campuses service centers operating sites`;
    const [foursquare, commercial, geoPlaces, ai, webSearch] = await Promise.all([
      discoverFoursquareLocations(baseline.canonicalName, locationHints),
      discoverCommercialPlaces(baseline.canonicalName, locationHints),
      discoverGeoPlaces(baseline.canonicalName, locationHints),
      enrichCompanyLocationsWithAi(baseline.canonicalName, baseline.officialWebsite),
      searchSharedWeb(locationWebQuery, { limit: 16 }),
    ]);

    const foursquareLocations = foursquare.locations as unknown as CompanyLocationCandidate[];
    const commercialLocations = commercial.locations as unknown as CompanyLocationCandidate[];
    const geoLocations = geoPlaces.locations as unknown as CompanyLocationCandidate[];
    const candidates = mergeCandidates([
      ...baseline.locations,
      ...foursquareLocations,
      ...commercialLocations,
      ...geoLocations,
      ...ai.locations,
    ]);

    const diagnostics: Array<
      DiscoveryDiagnostic
      | LocationAiDiagnostic
      | FoursquareDiagnostic
      | CommercialPlaceDiagnostic
      | GeoPlaceDiagnostic
      | SharedSearchDiagnostic
    > = [
      ...baseline.diagnostics,
      foursquare.diagnostic,
      ...commercial.diagnostics,
      ...geoPlaces.diagnostics,
      ...ai.diagnostics,
      ...webSearch.diagnostics,
    ];
    const warnings = Array.from(new Set([
      ...baseline.warnings,
      ...foursquare.warnings,
      ...commercial.warnings,
      ...geoPlaces.warnings,
      ...ai.warnings,
    ]));
    const searchKeyCounts = sharedSearchKeyCounts();
    const geoapifyLocations = geoPlaces.locations.filter((location) => location.discoveredBy === "geoapify").length;
    const locationiqLocations = geoPlaces.locations.filter((location) => location.discoveredBy === "locationiq").length;

    const metadata = {
      enteredName,
      canonicalName: baseline.canonicalName,
      aliases: baseline.aliases,
      wikidataId: baseline.wikidataId,
      officialWebsite: baseline.officialWebsite,
      officialWebsiteSource: baseline.officialWebsiteSource,
      sourceDiagnostics: diagnostics,
      discoveryStatus: "completed",
      lastDiscoveryAt: new Date().toISOString(),
      officialPagesScanned: baseline.officialPagesScanned,
      officialAddressesExtracted: baseline.officialAddressesExtracted,
      foursquare: {
        locationsDiscovered: foursquare.locations.length,
        requestsMade: foursquare.requestsMade,
        keysConfigured: foursquare.keysConfigured,
        chainIds: foursquare.chainIds,
      },
      tomtom: {
        locationsDiscovered: commercial.locations.length,
        requestsMade: commercial.tomtomRequestsMade,
        keysConfigured: commercial.tomtomKeysConfigured,
      },
      geoapify: {
        locationsDiscovered: geoapifyLocations,
        requestsMade: geoPlaces.geoapifyRequestsMade,
        keysConfigured: geoPlaces.geoapifyKeysConfigured,
      },
      locationiq: {
        locationsDiscovered: locationiqLocations,
        requestsMade: geoPlaces.locationiqRequestsMade,
        keysConfigured: geoPlaces.locationiqKeysConfigured,
      },
      sharedSearch: {
        providersUsed: webSearch.providersUsed,
        resultsFound: webSearch.results.length,
        keyCounts: searchKeyCounts,
      },
      aiPagesConsidered: ai.pagesConsidered,
      aiPagesRead: ai.pagesRead,
      aiAddressesExtracted: ai.addressesExtracted,
      aiProviders: {
        groq: Boolean(process.env.GROQ_API_KEY),
        cloudflare: Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && (process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_AUTH_TOKEN)),
        gemini: Boolean(process.env.GEMINI_API_KEY),
        cerebras: Boolean(process.env.CEREBRAS_API_KEY),
      },
    };

    entity = await getOrCreateEntity(enteredName, baseline.canonicalName, metadata);
    const persisted = await persistLocations(entity.id, candidates);
    const activeLocations = persisted.allLocations.filter((location) => location.reviewStatus !== "rejected");
    const mapped = activeLocations.filter((location) => MAPPABLE_CONFIDENCE.has(String(location.geocodeConfidence))).length;
    const tomtomLocations = commercial.locations.length;

    res.status(200).json({
      ok: true,
      entityName: baseline.canonicalName,
      enteredName,
      entityId: entity.id,
      company: {
        id: entity.id,
        enteredName,
        canonicalName: baseline.canonicalName,
        aliases: baseline.aliases,
        wikidataId: baseline.wikidataId,
        officialWebsite: baseline.officialWebsite,
        savedToDatabase: true,
        status: entity.status,
      },
      source: "Official website + Foursquare Places + TomTom Places + Geoapify + LocationIQ + Keenable/Algolia/LangSearch/Exa/Tavily + Groq/Gemini/Cerebras + Wikidata + OpenStreetMap + Photon",
      sourceDiagnostics: diagnostics,
      coverage: {
        officialPagesScanned: baseline.officialPagesScanned + ai.pagesRead,
        officialAddressesExtracted: baseline.officialAddressesExtracted + ai.addressesExtracted,
        officialLocationsGeocoded: candidates.filter((location) => location.discoveredBy === "official-site").length,
        foursquareLocationsDiscovered: foursquare.locations.length,
        foursquareRequestsMade: foursquare.requestsMade,
        foursquareKeysConfigured: foursquare.keysConfigured,
        foursquareChainIds: foursquare.chainIds,
        tomtomLocationsDiscovered: tomtomLocations,
        tomtomRequestsMade: commercial.tomtomRequestsMade,
        tomtomKeysConfigured: commercial.tomtomKeysConfigured,
        geoapifyLocationsDiscovered: geoapifyLocations,
        geoapifyRequestsMade: geoPlaces.geoapifyRequestsMade,
        geoapifyKeysConfigured: geoPlaces.geoapifyKeysConfigured,
        locationiqLocationsDiscovered: locationiqLocations,
        locationiqRequestsMade: geoPlaces.locationiqRequestsMade,
        locationiqKeysConfigured: geoPlaces.locationiqKeysConfigured,
        sharedSearchResults: webSearch.results.length,
        sharedSearchProvidersUsed: webSearch.providersUsed,
        sharedSearchKeyCounts: searchKeyCounts,
        aiPagesConsidered: ai.pagesConsidered,
        aiPagesRead: ai.pagesRead,
        aiAddressesExtracted: ai.addressesExtracted,
      },
      researchSources: buildResearchSources(
        baseline.canonicalName,
        baseline.officialWebsite,
        webSearch.results.map((result) => ({ title: result.title, url: result.url, provider: result.provider })),
      ),
      generatedAt: new Date().toISOString(),
      counts: {
        candidates: activeLocations.length,
        mappable: mapped,
        needsReview: activeLocations.filter((location) => location.reviewStatus === "needs-review" || !MAPPABLE_CONFIDENCE.has(String(location.geocodeConfidence))).length,
        foursquare: foursquare.locations.length,
        tomtom: tomtomLocations,
        geoapify: geoapifyLocations,
        locationiq: locationiqLocations,
        newCandidates: persisted.insertedCount,
        duplicatesSkipped: persisted.duplicatesSkipped,
        enrichedExisting: persisted.enrichedExisting,
      },
      locations: activeLocations,
      warnings,
      warning: warnings.join(" "),
    });
  } catch (error) {
    await db.update(entitiesTable).set({
      metadata: {
        ...objectMetadata(entity.metadata),
        discoveryStatus: "failed",
        lastDiscoveryAt: new Date().toISOString(),
        lastDiscoveryError: error instanceof Error ? error.message : "Unknown error",
      },
      updatedAt: new Date(),
    }).where(eq(entitiesTable.id, entity.id));
    console.error("Unified location discovery error:", error);
    res.status(500).json({
      ok: false,
      entityId: entity.id,
      companySaved: true,
      error: error instanceof Error ? error.message : "Location discovery failed",
    });
  }
});

export default router;
