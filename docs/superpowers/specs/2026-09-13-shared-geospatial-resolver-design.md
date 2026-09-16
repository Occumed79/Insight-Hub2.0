# Shared Geospatial Resolver Design

## Goal

Create one backend geospatial-resolution subsystem used by the Defense Map and AOR Map so both products stop accepting unvalidated browser-side geocoder results. Preserve authoritative source coordinates whenever present, use provider-specific geographic constraints, cache validated resolutions, and return unresolved rather than plot an obviously wrong location.

## Product boundaries

The resolver is shared infrastructure only. Defense and AOR remain separate products with separate data models, map semantics, controls, layers, visual architecture, and user workflows. No shared visible shell, hero, map chrome, or generic dashboard component is introduced.

## Current problems

### Defense

Both Defense renderers currently perform fallback geocoding in the browser. The 2D ArcGIS renderer and 3D MapTiler renderer can therefore resolve the same installation independently and can disagree. Ambiguous military-installation labels can produce geographically wrong results; the observed `Devens Reserve Forces Tng Area, United States` ArcGIS lookup resolving to Reserve, Louisiana demonstrates that the current fallback is unsafe.

### AOR

The active AOR v3 page performs country search directly against MapTiler from the browser. That couples AOR selection logic to one provider and bypasses a shared validation/caching layer. Health, disaster, seismic, and historical layers that already carry source coordinates or country identity should not be re-geocoded.

## Provider strategy

Provider keys are runtime-only server credentials and are never returned by the new resolver endpoints.

### Geocodio pool

Read these variables on the API server:

- `GEOCODIO_API_KEY`
- `GEOCODIO_API_KEY_2`
- `GEOCODIO_API_KEY_3`
- `GEOCODIO_API_KEY_4`
- `GEOCODIO_API_KEY_5`

Use Geocodio as the preferred external resolver for supported North American requests (United States, Canada, Mexico). United Kingdom support may be used only when the configured account supports it; the routing logic must not assume UK entitlement. Always pass the known country explicitly when a country is known because Geocodio otherwise falls back toward U.S. interpretation.

### LocationIQ pool

Read these variables on the API server:

- `LOCATIONIQ_API_KEY`
- `LOCATIONIQ_API_KEY_2`
- `LOCATIONIQ_API_KEY_3`
- `LOCATIONIQ_API_KEY_4`
- `LOCATIONIQ_API_KEY_5`

Use LocationIQ as the preferred external resolver for global requests outside the Geocodio-supported routing set. Request JSON output with `addressdetails=1`, `statecode=1`, `normalizeaddress=1`, `normalizecity=1`, `matchquality=1`, `limit=3`, and pass `countrycodes=<iso2>` whenever the expected country is known.

### Existing MapTiler and ArcGIS providers

MapTiler and ArcGIS remain rendering providers and may be used as server-side geocoding fallbacks for unresolved external-provider requests. They are not allowed to silently override a known country or region. Provider-specific geocoding must not occur separately inside Defense 2D and Defense 3D after this migration.

## Resolver request model

The backend accepts a structured request rather than only a free-form string.

```ts
export type GeospatialResolveRequest = {
  query: string;
  kind: "country" | "city" | "site" | "installation" | "event";
  expectedCountry?: string;
  expectedIso2?: string;
  expectedRegion?: string;
  city?: string;
  sourceCoordinates?: { lat: number; lon: number };
  sourceId?: string;
  sourceName?: string;
  forceRefresh?: boolean;
};
```

A batch endpoint accepts up to 250 requests per call. The API rejects empty queries when no valid source coordinates are present.

## Resolution result model

```ts
export type GeospatialResolution = {
  status: "resolved" | "unresolved";
  query: string;
  normalizedQuery: string;
  coordinates?: { lat: number; lon: number };
  provider: "source" | "canonical-country" | "geocodio" | "locationiq" | "maptiler" | "arcgis" | "cache" | "none";
  providerKeySlot?: number;
  matchedAddress?: string;
  country?: string;
  iso2?: string;
  region?: string;
  city?: string;
  confidence?: number;
  precision?: string;
  validated: boolean;
  validation: {
    countryMatch: boolean | null;
    regionMatch: boolean | null;
    coordinateValid: boolean;
    corroborated: boolean;
    reasons: string[];
  };
  cacheHit: boolean;
  resolvedAt: string;
};
```

Provider key values are never included. `providerKeySlot` is an ordinal only and exists for diagnostics.

## Resolution order

1. **Source coordinates first.** If the request contains finite coordinates inside valid world bounds, return them immediately as provider `source`. No external geocoder is called.
2. **Canonical country resolution.** `kind=country` first resolves against an internal ISO/country alias index. Country aliases such as `Ivory Coast`/`Côte d’Ivoire` and `South Korea`/`Republic of Korea` resolve without spending geocoder quota.
3. **Persistent cache.** Reuse a previously validated resolution whose normalized request fingerprint matches and is not explicitly force-refreshed.
4. **Geocodio primary for US/CA/MX.** Use explicit country context and structured components where available.
5. **LocationIQ primary globally.** Use ISO country restriction whenever available and examine up to three candidates.
6. **MapTiler fallback.** Server-side only, with expected-country/region validation.
7. **ArcGIS fallback.** Server-side only and subject to the same validation.
8. **Unresolved.** If no candidate passes validation, return `status=unresolved`; do not plot a guessed coordinate.

## Validation policy

A candidate is accepted only when all applicable hard checks pass:

- latitude and longitude are finite and inside world bounds;
- if an expected ISO2/country is known, the returned country must match it after normalization;
- if an expected region/state/province is known, the returned region must match by normalized name or recognized abbreviation;
- candidates with contradictory country data are rejected regardless of provider ranking;
- Geocodio accuracy below 0.8 is not accepted as a final installation/site result without corroboration;
- LocationIQ importance/match-quality metadata is recorded but never substitutes for country/region validation;
- ambiguous installation/site results without region evidence require a second-provider corroboration or remain unresolved.

For country searches, the internal canonical-country index is authoritative for ISO identity and the selected country geometry/center; geocoder ranking does not redefine country identity.

## Key-pool behavior

Each provider owns an independent five-slot key pool.

- Start with the next healthy slot using deterministic round-robin state per provider.
- On HTTP 401/403, quarantine that slot for the process lifetime and try another configured slot.
- On HTTP 429, quarantine the slot for 15 minutes and try another configured slot.
- On HTTP 5xx/network timeout, apply a 2-minute cooldown and try another configured slot.
- A request attempts each configured provider key at most once.
- Do not multiply identical calls across all five keys when one healthy key succeeds.
- Provider-health diagnostics expose configured/healthy/cooldown counts, never credential values.

## Persistent cache

Add a `geospatial_resolutions` table in Neon independent of company-library `locations` records. It is generic infrastructure for AOR and Defense and must not attach resolutions to a company entity.

Columns:

- `cache_key text primary key`
- `normalized_query text not null`
- `kind text not null`
- `expected_iso2 text`
- `expected_region text`
- `latitude real`
- `longitude real`
- `provider text not null`
- `matched_address text`
- `country text`
- `iso2 text`
- `region text`
- `city text`
- `confidence real`
- `precision text`
- `validated boolean not null default false`
- `validation jsonb`
- `provider_metadata jsonb`
- `resolved_at timestamp not null default now()`
- `updated_at timestamp not null default now()`

Only validated resolved records are reused as authoritative cache hits. Unresolved results may be held in a short in-memory negative cache but are not treated as durable truth.

## API surface

### `POST /api/geospatial/resolve`

Resolve one structured request.

### `POST /api/geospatial/resolve-batch`

Resolve up to 250 structured requests with bounded concurrency. Return results in request order. Duplicate fingerprints inside one batch are coalesced so they spend provider quota once.

### `GET /api/geospatial/status`

Return non-secret diagnostics:

- configured Geocodio key count;
- configured LocationIQ key count;
- healthy/cooldown key counts;
- cache availability;
- provider order.

This route must never expose key values.

## Defense integration

`war-costs-map.tsx` becomes the single Defense resolution orchestrator for base-index fallback locations.

1. Preserve rows that already contain valid source coordinates.
2. Build structured installation requests only for rows missing coordinates.
3. Call `/api/geospatial/resolve-batch` once per Defense data load.
4. Store the resulting coordinate map in page state keyed by a deterministic row identity.
5. Pass the same `resolvedBaseCoordinates` map to `WarCostsArcGisMap` and `WarCostsMapTilerGlobe`.
6. Remove direct ArcGIS and MapTiler fallback geocoding from the two renderer components.
7. Renderer placement diagnostics become `source`, `resolved`, and `unresolved` counts.

This guarantees that switching between Defense 2D and Defense 3D cannot move the same installation to two provider-specific coordinates.

## AOR integration

AOR continues to render with MapTiler, but selection resolution moves to the backend.

1. Active AOR country search calls `/api/geospatial/resolve` with `kind=country`.
2. The canonical-country resolver returns normalized country name, ISO2, center, and optional bbox/geometry metadata without spending provider quota when possible.
3. Existing source events that already provide coordinates retain source coordinates and do not enter the geocoder pipeline.
4. Country-level health/historical data attaches to canonical country identity rather than repeated geocoder calls.
5. Remove direct browser requests to `api.maptiler.com/geocoding/**` from the active AOR page.
6. AOR 2D/3D projection switching remains purely a rendering concern and must not change the selected country coordinates.

## Security

- The ten Geocodio/LocationIQ credentials are server-only environment variables.
- No new endpoint returns credential values.
- Existing `/api/map-config` and `/api/war-costs/map-config` remain only for SDK rendering credentials required by the browser; the new resolver does not use those endpoints to distribute geocoding secrets.
- Logs may include provider name, slot number, HTTP status, cache key prefix, and request kind, but never the key or full provider URL containing a key.

## Failure behavior

- A single provider failure must not fail an entire batch.
- If all providers fail or validation rejects every result, return an unresolved result with validation reasons.
- Defense/AOR maps continue rendering all source-coordinate data even when external geocoding is unavailable.
- The UI may report unresolved counts but must not fabricate placement.

## Testing

### API service tests

Add unit tests covering:

- source-coordinate short circuit;
- canonical-country aliases;
- Geocodio routing for US/CA/MX;
- LocationIQ routing outside those countries;
- country mismatch rejection;
- region mismatch rejection;
- low-confidence Geocodio result requiring corroboration;
- LocationIQ country restriction and result parsing;
- 401/403 permanent slot quarantine;
- 429 temporary cooldown/failover;
- 5xx/network failover;
- cache hit avoiding provider calls;
- batch de-duplication;
- unresolved response when every candidate is unsafe.

### Frontend/browser tests

Extend existing Playwright infrastructure; do not create a new screenshot/test harness.

- Defense load performs one resolver-batch request and both 2D/3D renderers receive the same resolved installation coordinates.
- Switching Defense 2D → 3D → 2D does not trigger new external geocoder requests.
- AOR country search uses `/api/geospatial/resolve` and no longer calls direct MapTiler geocoding.
- AOR selected country remains stable across 2D/3D projection changes.
- unresolved locations remain absent from map points and are reflected in diagnostics.

## Production verification

After CI passes and the PR is merged:

1. Confirm Render deploy uses the exact merge commit.
2. Call `/api/geospatial/status` and verify nonzero configured key counts without exposing values.
3. Verify Defense 2D and 3D on production with a known ambiguous installation such as Devens and confirm identical validated placement or unresolved status.
4. Verify AOR country selection for aliases and non-U.S. countries.
5. Verify no browser network request contains a Geocodio or LocationIQ key.
6. Inspect Render logs for provider failures/quarantine behavior without secret leakage.
7. Use CodeRabbit review plus production browser/runtime validation before claiming completion.

## Non-goals

- No redesign of AOR or Defense visual architecture.
- No new generic map shell.
- No change to the semantics of AOR health-risk layers or Defense source families.
- No attempt to geocode records that already carry authoritative coordinates.
- No assumption that five API keys equal five independent paid/free quotas.