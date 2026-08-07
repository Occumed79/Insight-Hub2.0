# Insight Hub 2.0

Occupational health intelligence platform — employer injury data, O*NET job context, BLS benchmarks, and service opportunity scoring.

## Build & Start

```bash
# Install dependencies exactly from the lockfile
pnpm install --frozen-lockfile

# Typecheck all workspace projects
pnpm run typecheck

# Build all artifacts (frontend + api-server)
pnpm run build

# Start the API server (after build)
pnpm --filter @workspace/api-server run start

# Development mode (hot reload)
pnpm --filter @workspace/api-server run dev
```

## Render Deployment

The `render.yaml` defines a single web service. The build command installs the locked dependencies, pushes the database schema, builds the frontend, and builds the API server.

**Build command:**
```bash
pnpm install --frozen-lockfile && pnpm --filter @workspace/db run push && pnpm --filter @workspace/occu-med-insight-hub run build && pnpm --filter @workspace/api-server run build
```

**Start command:**
```bash
pnpm --filter @workspace/api-server run start
```

**Health check:** `/api/healthz`

### Required Render Environment Variables

Set these in the Render dashboard (or via `render.yaml` with `sync: false`).
**Never commit actual secret values to the repo.**

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string (Neon or Render Postgres). OSHA ITA persistence uses the same database. |
| `ONET_API_KEY` | Yes | O*NET Web Services API key for occupation mapping |
| `BLS_API_KEY` | Recommended | BLS public API v2 key for industry benchmark rates |
| `BLS_AUTH_MODE` | Optional | BLS auth mode: `auto` (default) uses v2 if key present, v1 public fallback otherwise |
| `BLS_SERIES_MAPPING_ENABLED` | Optional | Set to `true` to enable curated BLS SOII series ID mapping table (default: enabled) |
| `SAM_API_KEY` | Optional | SAM.gov Entity API key for federal contractor resolution |
| `COURTLISTENER_API_TOKEN` | Optional | CourtListener API token for litigation signals |
| `SEC_USER_AGENT` | Optional | SEC EDGAR requires a User-Agent header (e.g. "Company admin@example.com") |
| `OSHA_ITA_IMPORT_ENABLED` | Optional | Set to `true` to mark OSHA ITA database imports as enabled in source-status/governance views |
| `WORKERS_COMP_SOURCE_INDEX_ENABLED` | Optional | Set to `true` to enable state workers' comp source index |
| `USASPENDING_API_ENABLED` | Optional | Set to `true` to enable USAspending federal award lookups |
| `HHS_SOCRATA_APP_TOKEN` | Optional | Socrata app token for HealthData.gov higher rate limits (catalog discovery works without it) |
| `HHS_CATALOG_ENABLED` | Optional | Set to `true` to enable HHS/HealthData.gov catalog discovery (default: enabled) |
| `HHS_CATALOG_DOMAIN` | Optional | HealthData.gov domain (default: `healthdata.gov`) |
| `CMS_PROVIDER_DATA_ENABLED` | Optional | Set to `true` to enable CMS Provider Data catalog (default: enabled) |
| `CMS_PROVIDER_DATA_BASE_URL` | Optional | CMS Provider Data API base URL (default: `https://data.cms.gov/provider-data/api/1`) |
| `CMS_DATA_API_KEY` | Optional | Unused for public catalog access; reserved for future CMS API requirements |

### OSHA ITA Database Persistence

OSHA establishment-level ITA data is persisted in Postgres. A Render persistent disk and `OSHA_DATA_DIR` are **not** required.

The normal Render build pushes the shared Drizzle schema. The OSHA service also performs an idempotent persistence bootstrap so these tables and supporting indexes exist before an OSHA query or import:

- `osha_import_runs`
- `osha_source_files`
- `osha_establishments`
- `employer_aliases`
- `osha_entity_matches`

To import an OSHA ITA CSV file into the database:

```bash
pnpm --filter @workspace/api-server run import:osha -- \
  --input <osha_file.csv> \
  --year 2025 \
  --name "OSHA ITA 2025"
```

Imports are transactional. By default, importing the same dataset name/year replaces the prior import for that dataset/year; pass `--append` only when an additional batch should coexist.

Legacy Hub 2 OSHA JSON-cache exports can be migrated directly into Postgres with the same importer:

```bash
pnpm --filter @workspace/api-server run import:osha -- \
  --input <legacy_osha_cache.json> \
  --year 2025 \
  --name "OSHA ITA 2025"
```

The importer records import-run metadata, source-file metadata and SHA-256 provenance together with the establishment records. Runtime OSHA queries read Postgres only; they no longer depend on local JSON files or an ephemeral application filesystem.

### Graceful Degradation

The API server starts successfully even when optional API keys are missing.
Each external data source connector returns a clear "not configured" response rather than crashing. The `/api/sources/status` endpoint reports which sources are configured and their data type (`live-api`, `database-import`, `cached-import`, `static-index`, or `not-configured`).

## Project Structure

```
artifacts/
  api-server/           Express API server (TypeScript, esbuild)
    src/services/       Shared service modules (onetService, oshaDataService, blsService)
    src/routes/         Express route handlers
    scripts/            OSHA ITA database import script
  occu-med-insight-hub/ React frontend (Vite, TailwindCSS, shadcn/ui)
lib/
  api-client-react/     Generated React API client
  api-zod/              Zod schemas
  db/                   Drizzle ORM schema
  react-simple-maps/    First-party React 19 state-map compatibility workspace
render.yaml             Render deployment configuration
```
