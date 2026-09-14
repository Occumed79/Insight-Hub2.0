import { pool } from "@workspace/db";
import type { GeospatialCache, GeospatialResolveRequest, GeospatialResolution } from "./geospatial-types";

let ready: Promise<void> | null = null;

async function ensureTable() {
  if (!ready) {
    ready = pool.query(`
      CREATE TABLE IF NOT EXISTS geospatial_resolutions (
        cache_key text PRIMARY KEY,
        normalized_query text NOT NULL,
        kind text NOT NULL,
        expected_iso2 text,
        expected_region text,
        latitude real,
        longitude real,
        provider text NOT NULL,
        matched_address text,
        country text,
        iso2 text,
        region text,
        city text,
        confidence real,
        precision text,
        validated boolean NOT NULL DEFAULT false,
        validation jsonb,
        provider_metadata jsonb,
        resolved_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `).then(() => undefined);
  }
  return ready;
}

export const geospatialCache: GeospatialCache = {
  async get(cacheKey) {
    await ensureTable();
    const result = await pool.query(
      `SELECT * FROM geospatial_resolutions WHERE cache_key = $1 AND validated = true LIMIT 1`,
      [cacheKey],
    );
    const row = result.rows[0];
    if (!row || row.latitude === null || row.longitude === null) return null;
    return {
      status: "resolved",
      query: row.normalized_query,
      normalizedQuery: row.normalized_query,
      coordinates: { lat: Number(row.latitude), lon: Number(row.longitude) },
      provider: "cache",
      matchedAddress: row.matched_address || undefined,
      country: row.country || undefined,
      iso2: row.iso2 || undefined,
      region: row.region || undefined,
      city: row.city || undefined,
      confidence: row.confidence === null ? undefined : Number(row.confidence),
      precision: row.precision || undefined,
      validated: true,
      validation: row.validation || { countryMatch: null, regionMatch: null, coordinateValid: true, corroborated: false, reasons: [] },
      cacheHit: true,
      resolvedAt: row.resolved_at instanceof Date ? row.resolved_at.toISOString() : String(row.resolved_at),
    } satisfies GeospatialResolution;
  },

  async set(cacheKey: string, request: GeospatialResolveRequest, resolution: GeospatialResolution) {
    if (!resolution.validated || !resolution.coordinates) return;
    await ensureTable();
    await pool.query(
      `INSERT INTO geospatial_resolutions (
        cache_key, normalized_query, kind, expected_iso2, expected_region,
        latitude, longitude, provider, matched_address, country, iso2, region, city,
        confidence, precision, validated, validation, provider_metadata, resolved_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,true,$16::jsonb,$17::jsonb,$18,now()
      )
      ON CONFLICT (cache_key) DO UPDATE SET
        normalized_query = EXCLUDED.normalized_query,
        kind = EXCLUDED.kind,
        expected_iso2 = EXCLUDED.expected_iso2,
        expected_region = EXCLUDED.expected_region,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        provider = EXCLUDED.provider,
        matched_address = EXCLUDED.matched_address,
        country = EXCLUDED.country,
        iso2 = EXCLUDED.iso2,
        region = EXCLUDED.region,
        city = EXCLUDED.city,
        confidence = EXCLUDED.confidence,
        precision = EXCLUDED.precision,
        validated = EXCLUDED.validated,
        validation = EXCLUDED.validation,
        provider_metadata = EXCLUDED.provider_metadata,
        resolved_at = EXCLUDED.resolved_at,
        updated_at = now()`,
      [
        cacheKey,
        resolution.normalizedQuery,
        request.kind,
        request.expectedIso2 || null,
        request.expectedRegion || null,
        resolution.coordinates.lat,
        resolution.coordinates.lon,
        resolution.provider,
        resolution.matchedAddress || null,
        resolution.country || null,
        resolution.iso2 || null,
        resolution.region || null,
        resolution.city || null,
        resolution.confidence ?? null,
        resolution.precision || null,
        JSON.stringify(resolution.validation),
        JSON.stringify({ sourceId: request.sourceId || null, sourceName: request.sourceName || null }),
        new Date(resolution.resolvedAt),
      ],
    );
  },
};

export async function geospatialCacheAvailable(): Promise<boolean> {
  try {
    await ensureTable();
    return true;
  } catch {
    return false;
  }
}
