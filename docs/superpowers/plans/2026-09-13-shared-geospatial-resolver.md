# Shared Geospatial Resolver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace unvalidated browser-side geocoding in Defense and AOR with one server-side, provider-pooled, validated, cached geospatial resolver.

**Architecture:** The API server owns country normalization, provider routing, five-key Geocodio/LocationIQ pools, candidate validation, persistent Neon cache, and fallback behavior. Defense resolves fallback installations once in the page orchestrator and passes identical coordinates to 2D and 3D renderers; AOR country search calls the same backend resolver while keeping MapTiler only as the renderer.

**Tech Stack:** TypeScript, Express 5, Drizzle ORM/PostgreSQL (Neon), React 19, MapTiler SDK, ArcGIS SDK, Node test runner via `tsx --test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-13-shared-geospatial-resolver-design.md`

## Global Constraints

- Geocodio env names: `GEOCODIO_API_KEY`, `_2`, `_3`, `_4`, `_5`.
- LocationIQ env names: `LOCATIONIQ_API_KEY`, `_2`, `_3`, `_4`, `_5`.
- Geocodio/LocationIQ key values must never be returned to the browser or logs.
- Source coordinates always win over geocoding.
- Country/region mismatches are rejected; unresolved is preferable to guessed placement.
- Defense and AOR share only invisible resolver infrastructure, never a visible map shell.
- Extend existing tests; do not create screenshot infrastructure.
- Both Defense renderers must consume the same resolved installation coordinate map.

---

### Task 1: Add reusable resolver types, country normalization, and key pools

**Files:**
- Create: `artifacts/api-server/src/services/geospatial-resolver.ts`
- Test: `artifacts/api-server/src/services/__tests__/geospatial-resolver.test.ts`

**Interfaces:**
- Produces `GeospatialResolveRequest`, `GeospatialResolution`, `resolveGeospatialLocation()`, `resolveGeospatialBatch()`, `getGeospatialResolverStatus()`.
- Provider HTTP calls are injected for tests through an optional `fetchImpl` dependency and default to global `fetch`.

- [ ] **Step 1: Write failing tests for source-coordinate short circuit and canonical country aliases**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { resolveGeospatialLocation } from "../geospatial-resolver";

test("source coordinates bypass external providers", async () => {
  let calls = 0;
  const result = await resolveGeospatialLocation({
    query: "Known event",
    kind: "event",
    sourceCoordinates: { lat: 48.11, lon: 11.58 },
  }, { fetchImpl: async () => { calls += 1; throw new Error("should not call"); } as typeof fetch });
  assert.equal(result.provider, "source");
  assert.equal(result.validated, true);
  assert.equal(calls, 0);
});

test("country aliases resolve without provider calls", async () => {
  let calls = 0;
  const result = await resolveGeospatialLocation({ query: "Ivory Coast", kind: "country" }, {
    fetchImpl: async () => { calls += 1; throw new Error("should not call"); } as typeof fetch,
  });
  assert.equal(result.status, "resolved");
  assert.equal(result.iso2, "CI");
  assert.equal(calls, 0);
});
```

- [ ] **Step 2: Run the focused API test and verify it fails**

Run: `pnpm --filter @workspace/api-server test`

Expected: FAIL because `geospatial-resolver.ts` does not exist.

- [ ] **Step 3: Implement request/result types, coordinate validation, query normalization, canonical country aliases, and key-pool state**

Implement:

```ts
export type GeospatialKind = "country" | "city" | "site" | "installation" | "event";
export type GeospatialResolveRequest = { /* exact fields from spec */ };
export type GeospatialResolution = { /* exact fields from spec */ };

const GEOCODIO_KEYS = [
  process.env.GEOCODIO_API_KEY,
  process.env.GEOCODIO_API_KEY_2,
  process.env.GEOCODIO_API_KEY_3,
  process.env.GEOCODIO_API_KEY_4,
  process.env.GEOCODIO_API_KEY_5,
].map((value) => value?.trim()).filter(Boolean) as string[];

const LOCATIONIQ_KEYS = [
  process.env.LOCATIONIQ_API_KEY,
  process.env.LOCATIONIQ_API_KEY_2,
  process.env.LOCATIONIQ_API_KEY_3,
  process.env.LOCATIONIQ_API_KEY_4,
  process.env.LOCATIONIQ_API_KEY_5,
].map((value) => value?.trim()).filter(Boolean) as string[];
```

Country normalization must include at minimum `US`, `CA`, `MX`, `GB`, `CI`, `KR`, `KP`, `CZ`, `TR`, plus canonical ISO aliases used by existing AOR command coverage. For `kind=country`, return deterministic canonical center coordinates and ISO2 without external HTTP.

- [ ] **Step 4: Run API tests**

Run: `pnpm --filter @workspace/api-server test`

Expected: PASS for source and country tests.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/services/geospatial-resolver.ts artifacts/api-server/src/services/__tests__/geospatial-resolver.test.ts
git commit -m "feat: add geospatial resolver core"
```

---

### Task 2: Add provider adapters, validation, failover, and batch de-duplication

**Files:**
- Modify: `artifacts/api-server/src/services/geospatial-resolver.ts`
- Modify: `artifacts/api-server/src/services/__tests__/geospatial-resolver.test.ts`

**Interfaces:**
- `resolveGeospatialLocation(request, deps?)` routes US/CA/MX to Geocodio and other non-country place requests to LocationIQ first.
- `resolveGeospatialBatch(requests, deps?)` preserves order and coalesces duplicate fingerprints.

- [ ] **Step 1: Add failing routing and validation tests**

Cover:

```ts
// Geocodio for US installation
// LocationIQ for Germany installation with countrycodes=de
// reject LocationIQ candidate with address.country_code != expectedIso2
// reject state/region mismatch when expectedRegion is provided
// Geocodio accuracy < 0.8 requires corroboration
// 401/403 quarantines key for process lifetime
// 429 places key on 15-minute cooldown and retries next slot
// 5xx/network failure retries another slot
// batch duplicate requests make one provider call
```

Use fake `Response` objects; assert request URLs omit secrets from any returned diagnostic payload.

- [ ] **Step 2: Run focused tests and verify failures**

Run: `pnpm --filter @workspace/api-server test`

Expected: new provider tests FAIL.

- [ ] **Step 3: Implement Geocodio adapter**

Use `https://api.geocod.io/v1.9/geocode` with API key only in the outbound server request. Pass `country` whenever known. Parse `results[0].location`, `formatted_address`, `address_components`, `accuracy`, and `accuracy_type`. Do not accept invalid coordinates or hard geographic mismatches.

- [ ] **Step 4: Implement LocationIQ adapter**

Use `https://us1.locationiq.com/v1/search` with:

```ts
{
  key,
  q,
  format: "json",
  addressdetails: "1",
  statecode: "1",
  normalizeaddress: "1",
  normalizecity: "1",
  matchquality: "1",
  limit: "3",
  countrycodes: expectedIso2?.toLowerCase(),
}
```

Parse `lat`, `lon`, `display_name`, `importance`, `address.country_code`, `address.state`, `address.state_code`, and normalized city fields. Select the first candidate that passes all hard validation.

- [ ] **Step 5: Implement MapTiler and ArcGIS server-side fallback adapters**

MapTiler reads `MAP_TILER_API_KEY`/`MAP_TILER_API_KEY_2` server-side; ArcGIS reads `ARCGIS_API_KEY`. Parse candidates into the same internal candidate shape and apply identical validation. Never return these credential values.

- [ ] **Step 6: Implement provider-key cooldown/quarantine and batch de-duplication**

Use provider-local round-robin cursors and slot state. A request tries each configured slot once. Batch requests use a `Map<fingerprint, Promise<GeospatialResolution>>` so duplicates share work.

- [ ] **Step 7: Run API tests**

Run: `pnpm --filter @workspace/api-server test`

Expected: all resolver tests PASS.

- [ ] **Step 8: Commit**

```bash
git add artifacts/api-server/src/services/geospatial-resolver.ts artifacts/api-server/src/services/__tests__/geospatial-resolver.test.ts
git commit -m "feat: add geocoder routing and validation"
```

---

### Task 3: Add Neon persistent geospatial cache and API routes

**Files:**
- Modify: `lib/db/src/schema/index.ts`
- Create: `artifacts/api-server/src/routes/geospatial-resolver.ts`
- Modify: `artifacts/api-server/src/routes/index.ts`
- Modify: `artifacts/api-server/src/services/geospatial-resolver.ts`
- Modify: `artifacts/api-server/src/services/__tests__/geospatial-resolver.test.ts`

**Interfaces:**
- Database table: `geospatial_resolutions`.
- Routes: `POST /api/geospatial/resolve`, `POST /api/geospatial/resolve-batch`, `GET /api/geospatial/status`.

- [ ] **Step 1: Add failing cache test**

Test that a validated cache record returns `cacheHit=true` and prevents provider HTTP calls; force refresh bypasses the record.

- [ ] **Step 2: Add Drizzle schema**

Create `geospatialResolutionsTable` with the columns in the spec. Export inferred select/insert types if useful.

- [ ] **Step 3: Implement cache read/write in resolver**

Compute a SHA-256 fingerprint from normalized query + kind + expected ISO2 + expected region + city. Read only validated rows. Upsert validated external-provider results. Do not persist unresolved guesses as truth.

- [ ] **Step 4: Implement API routes**

Validation rules:

```ts
POST /geospatial/resolve      // one object
POST /geospatial/resolve-batch // { requests: [...] }, 1..250
GET  /geospatial/status
```

Return 400 for malformed inputs, 200 for resolved/unresolved domain results, and 503 only when the resolver itself cannot initialize. Status returns key counts/health and cache availability, never secrets.

- [ ] **Step 5: Register router**

Add `geospatialResolverRouter` to `artifacts/api-server/src/routes/index.ts` before map consumers.

- [ ] **Step 6: Run API tests and typecheck**

Run:

```bash
pnpm --filter @workspace/api-server test
pnpm --filter @workspace/api-server typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/db/src/schema/index.ts artifacts/api-server/src/routes/geospatial-resolver.ts artifacts/api-server/src/routes/index.ts artifacts/api-server/src/services/geospatial-resolver.ts artifacts/api-server/src/services/__tests__/geospatial-resolver.test.ts
git commit -m "feat: persist validated geospatial resolutions"
```

---

### Task 4: Migrate Defense to one shared resolved-coordinate set

**Files:**
- Modify: `artifacts/occu-med-insight-hub/src/pages/war-costs-map.tsx`
- Modify: `artifacts/occu-med-insight-hub/src/pages/war-costs-arcgis-map.tsx`
- Modify: `artifacts/occu-med-insight-hub/src/pages/war-costs-maptiler-globe.tsx`
- Modify: `artifacts/occu-med-insight-hub/tests/ui-hardening.spec.ts`

**Interfaces:**
- New renderer prop:

```ts
resolvedBaseCoordinates?: Record<string, {
  coordinates: [number, number]; // [lon, lat]
  provider: string;
  confidence?: number;
  matchedAddress?: string;
}>;
```

- [ ] **Step 1: Add failing Playwright route assertions**

Mock `/api/geospatial/resolve-batch`. Assert Defense load calls it once for missing-coordinate installations. Assert toggling 2D → 3D → 2D does not create another resolver call.

- [ ] **Step 2: Add deterministic base identity helpers in `war-costs-map.tsx`**

Use normalized `name/baseName/installation/site/facility + city/location + state + country` to produce a stable client key. Build batch requests only for rows without source coordinates.

- [ ] **Step 3: Resolve fallback bases once during `load()`**

After base-index is loaded, call `/api/geospatial/resolve-batch`; store only validated resolved results in `resolvedBaseCoordinates`. Keep unresolved count for diagnostics.

- [ ] **Step 4: Pass one coordinate map to both renderers**

Extend `mapProps` with `resolvedBaseCoordinates`.

- [ ] **Step 5: Remove renderer-side external geocoding**

Delete direct MapTiler geocoder fetch in `war-costs-maptiler-globe.tsx` and direct ArcGIS geocoder fetch in `war-costs-arcgis-map.tsx`. Each renderer uses source coordinates first and the shared resolved map second.

- [ ] **Step 6: Update placement diagnostics**

Report `source`, `resolved`, `unresolved`; provider provenance can be shown in the existing selection inspector without redesigning map UI.

- [ ] **Step 7: Run frontend typecheck/build and Playwright target**

Run:

```bash
pnpm --filter @workspace/occu-med-insight-hub typecheck
pnpm --filter @workspace/occu-med-insight-hub build
pnpm --filter @workspace/occu-med-insight-hub exec playwright test tests/ui-hardening.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add artifacts/occu-med-insight-hub/src/pages/war-costs-map.tsx artifacts/occu-med-insight-hub/src/pages/war-costs-arcgis-map.tsx artifacts/occu-med-insight-hub/src/pages/war-costs-maptiler-globe.tsx artifacts/occu-med-insight-hub/tests/ui-hardening.spec.ts
git commit -m "fix: unify Defense installation geocoding"
```

---

### Task 5: Migrate active AOR country search to resolver

**Files:**
- Modify: `artifacts/occu-med-insight-hub/src/pages/reviewer-aor-factors-v3.tsx`
- Modify: `artifacts/occu-med-insight-hub/tests/aor-consolidation.spec.ts`

**Interfaces:**
- AOR calls `POST /api/geospatial/resolve` with `{ query, kind: "country" }`.
- Resolver response supplies canonical country name, `iso2`, center coordinates, and optional bbox metadata used by the existing map selection flow.

- [ ] **Step 1: Change AOR Playwright fixture to mock internal resolver**

Remove the test dependency on `https://api.maptiler.com/geocoding/**` for country search. Add `/api/geospatial/resolve` fixture returning a canonical country response.

- [ ] **Step 2: Add failing assertion that no direct MapTiler geocoder request occurs**

Count any `api.maptiler.com/geocoding` requests during country search and assert zero.

- [ ] **Step 3: Replace browser geocoder call in v3**

Submit country search to `/api/geospatial/resolve`, reject unresolved response, then set `SelectedCountry` from the normalized result.

- [ ] **Step 4: Preserve rendering-only MapTiler configuration**

Do not remove `/api/map-config` or SDK key usage required to render the AOR map/tiles. Only geocoding leaves the browser.

- [ ] **Step 5: Add projection stability assertion**

Select a country, switch AOR 2D/3D/2D, and assert the selected ISO2/country remains unchanged.

- [ ] **Step 6: Run AOR Playwright test plus typecheck**

Run:

```bash
pnpm --filter @workspace/occu-med-insight-hub typecheck
pnpm --filter @workspace/occu-med-insight-hub exec playwright test tests/aor-consolidation.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add artifacts/occu-med-insight-hub/src/pages/reviewer-aor-factors-v3.tsx artifacts/occu-med-insight-hub/tests/aor-consolidation.spec.ts
git commit -m "fix: route AOR country resolution through backend"
```

---

### Task 6: Full verification, PR review, merge, and production validation

**Files:**
- No new feature files; fixes from review may touch prior task files.

- [ ] **Step 1: Run complete repository verification**

Run the repository's existing CI-equivalent commands: API tests/typecheck, frontend typecheck/build, and full Playwright suite. Do not claim completion until all current checks pass on the exact branch head.

- [ ] **Step 2: Open PR from `feature/shared-geospatial-resolver` to `main`**

PR description must list provider routing, secret-handling guarantees, Defense/AOR migrations, database cache, and tests.

- [ ] **Step 3: Run CodeRabbit review**

Address real findings; rerun affected tests after each repair.

- [ ] **Step 4: Verify GitHub CI on the exact final head**

All required jobs must pass after the last review fix.

- [ ] **Step 5: Prepare/apply Neon schema change safely**

Use the Neon migration workflow against `INSIGHT_HUB_DATABASE_2`. Inspect the prepared migration on its temporary branch before applying to production. Do not drop or rewrite unrelated tables.

- [ ] **Step 6: Merge only after exact-head CI is green**

Record the merge SHA.

- [ ] **Step 7: Verify Render auto-deploy**

Confirm Render service `srv-d9vkd37qj5pc73dqqqkg` deploys the exact merge SHA. Verify `/api/health` and `/api/geospatial/status`.

- [ ] **Step 8: Production browser verification**

Defense:
- inspect 2D and 3D;
- verify identical placement for the same installation;
- test the previously ambiguous Devens record;
- verify unresolved locations are not guessed.

AOR:
- search at least one alias and one non-U.S. country;
- switch 2D/3D and verify selection stability;
- confirm browser network does not expose Geocodio/LocationIQ keys.

- [ ] **Step 9: Inspect Render logs**

Confirm no secret-bearing provider URLs appear and provider failover logs contain only safe slot/status metadata.

- [ ] **Step 10: Report completion only with production evidence**

State exact final PR, merge SHA, Render deploy state, key counts from safe status endpoint, tests run, and any unresolved provider/configuration gaps.