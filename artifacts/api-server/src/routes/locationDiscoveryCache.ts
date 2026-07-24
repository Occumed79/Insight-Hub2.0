import { Router } from "express";
import { db, entitiesTable, locationsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();
const MAPPABLE_CONFIDENCE = new Set(["exact", "place", "city"]);

function normalizeEntityName(value: unknown): string {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 160);
}

function objectMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function numberMetadata(metadata: Record<string, unknown>, key: string): number {
  const value = Number(metadata[key]);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function stringMetadata(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArrayMetadata(metadata: Record<string, unknown>, key: string): string[] {
  const value = metadata[key];
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 20)
    : [];
}

function diagnosticArray(metadata: Record<string, unknown>): Array<Record<string, unknown>> {
  return Array.isArray(metadata.sourceDiagnostics)
    ? metadata.sourceDiagnostics.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    : [];
}

function buildResearchSources(entityName: string, officialWebsite?: string) {
  const encoded = encodeURIComponent(entityName);
  const quoted = encodeURIComponent(`"${entityName}"`);
  return [
    ...(officialWebsite ? [{
      label: "Official company website",
      type: "official",
      url: officialWebsite,
      note: "Primary public source used for the saved company-location discovery.",
    }] : []),
    {
      label: "Official locations / offices search",
      type: "official",
      url: `https://www.google.com/search?q=${quoted}+locations+offices+facilities`,
      note: "Manual verification path for company-owned offices, sites, and facilities.",
    },
    {
      label: "SEC EDGAR search",
      type: "filing",
      url: `https://www.sec.gov/edgar/search/#/q=${encoded}`,
      note: "Manual verification path for corporate footprint and subsidiary context.",
    },
  ];
}

router.post("/entity-discovery/locations", async (req, res, next) => {
  const enteredName = normalizeEntityName(req.body?.entityName);
  const forceRefresh = req.body?.refresh === true || req.body?.forceRefresh === true;

  if (!enteredName || forceRefresh) {
    next();
    return;
  }

  try {
    const [entity] = await db
      .select()
      .from(entitiesTable)
      .where(sql`
        lower(${entitiesTable.name}) = lower(${enteredName})
        OR lower(${entitiesTable.displayName}) = lower(${enteredName})
        OR lower(coalesce(${entitiesTable.metadata}->>'enteredName', '')) = lower(${enteredName})
        OR lower(coalesce(${entitiesTable.metadata}->>'canonicalName', '')) = lower(${enteredName})
      `)
      .limit(1);

    if (!entity) {
      next();
      return;
    }

    const metadata = objectMetadata(entity.metadata);
    const discoveryStatus = stringMetadata(metadata, "discoveryStatus");
    const locations = await db
      .select()
      .from(locationsTable)
      .where(eq(locationsTable.entityId, entity.id));
    const activeLocations = locations.filter((location) => location.reviewStatus !== "rejected");

    // A submitted company with completed discovery is a valid cache entry even when
    // no public locations were found. Explicit refresh is required to spend provider
    // quota on it again. Legacy saved companies with locations are also reusable.
    const reusable = discoveryStatus === "completed" || activeLocations.length > 0;
    if (!reusable) {
      next();
      return;
    }

    const canonicalName = stringMetadata(metadata, "canonicalName") || entity.displayName || entity.name;
    const officialWebsite = stringMetadata(metadata, "officialWebsite");
    const aliases = stringArrayMetadata(metadata, "aliases");
    const savedDiagnostics = diagnosticArray(metadata);
    const mapped = activeLocations.filter((location) => MAPPABLE_CONFIDENCE.has(String(location.geocodeConfidence))).length;
    const needsReview = activeLocations.filter((location) => location.reviewStatus === "needs-review" || !MAPPABLE_CONFIDENCE.has(String(location.geocodeConfidence))).length;
    const lastDiscoveryAt = stringMetadata(metadata, "lastDiscoveryAt") || entity.updatedAt.toISOString();
    const cacheDiagnostic = {
      source: "neon-cache",
      status: "success",
      resultsFound: activeLocations.length,
      message: `Loaded ${activeLocations.length} saved location candidates from Neon without calling external AI or search providers.`,
    };

    res.setHeader("X-Insight-Hub-Location-Cache", "HIT");
    res.status(200).json({
      ok: true,
      cacheHit: true,
      entityName: canonicalName,
      enteredName,
      entityId: entity.id,
      company: {
        id: entity.id,
        enteredName: stringMetadata(metadata, "enteredName") || entity.name,
        canonicalName,
        aliases,
        wikidataId: stringMetadata(metadata, "wikidataId"),
        officialWebsite,
        savedToDatabase: true,
        status: entity.status,
      },
      source: "Neon saved company-location discovery",
      sourceDiagnostics: [cacheDiagnostic, ...savedDiagnostics],
      coverage: {
        officialPagesScanned: numberMetadata(metadata, "officialPagesScanned"),
        officialAddressesExtracted: numberMetadata(metadata, "officialAddressesExtracted"),
        officialLocationsGeocoded: activeLocations.filter((location) => objectMetadata(location.metadata).discoveredBy === "official-site").length,
      },
      researchSources: buildResearchSources(canonicalName, officialWebsite),
      generatedAt: lastDiscoveryAt,
      counts: {
        candidates: activeLocations.length,
        mappable: mapped,
        needsReview,
        newCandidates: 0,
        duplicatesSkipped: 0,
        enrichedExisting: 0,
      },
      locations: activeLocations,
      warnings: [
        "Loaded from the saved Neon discovery. No Groq, Cloudflare, Gemini, Cerebras, Photon, or Nominatim quota was used for this request.",
        "Use an explicit refresh request only when the company footprint needs to be researched again.",
      ],
      warning: "Loaded from Neon cache without spending external provider quota.",
    });
  } catch (error) {
    // Cache lookup failures must not prevent a new manual discovery attempt.
    console.error("Location discovery cache lookup failed:", error);
    next();
  }
});

export default router;
