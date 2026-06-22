# Insight Hub 2.0

Occupational health intelligence platform — employer injury data, O*NET job context, BLS benchmarks, and service opportunity scoring.

## Build & Start

```bash
# Install dependencies
pnpm install

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

The `render.yaml` defines a single web service. The build command runs
`pnpm install`, pushes the DB schema, builds the frontend, and builds the API server.

**Build command:**
```
pnpm install --no-frozen-lockfile && pnpm --filter @workspace/db run push && pnpm --filter @workspace/occu-med-insight-hub run build && pnpm --filter @workspace/api-server run build
```

**Start command:**
```
pnpm --filter @workspace/api-server run start
```

**Health check:** `/api/healthz`

### Required Render Environment Variables

Set these in the Render dashboard (or via `render.yaml` with `sync: false`).
**Never commit actual secret values to the repo.**

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string (Neon or Render Postgres) |
| `ONET_API_KEY` | Yes | O*NET Web Services API key for occupation mapping |
| `BLS_API_KEY` | Recommended | BLS public API v2 key for industry benchmark rates |
| `SAM_API_KEY` | Optional | SAM.gov Entity API key for federal contractor resolution |
| `COURTLISTENER_API_TOKEN` | Optional | CourtListener API token for litigation signals |
| `SEC_USER_AGENT` | Optional | SEC EDGAR requires a User-Agent header (e.g. "Company admin@example.com") |
| `OSHA_ITA_IMPORT_ENABLED` | Optional | Set to `true` to enable OSHA ITA cached data queries |
| `OSHA_DATA_DIR` | Optional | Path to OSHA ITA JSON cache directory (default: `data/osha-ita`) |
| `WORKERS_COMP_SOURCE_INDEX_ENABLED` | Optional | Set to `true` to enable state workers' comp source index |
| `USASPENDING_API_ENABLED` | Optional | Set to `true` to enable USAspending federal award lookups |

### OSHA ITA Persistent Disk (Production)

If OSHA cached data is needed in production, Render must use a **persistent disk**
mounted at `/var/data` and `OSHA_DATA_DIR` must point to a directory on that disk.

1. In the Render dashboard, add a persistent disk to the web service.
2. Set the mount path to `/var/data`.
3. Set `OSHA_DATA_DIR=/var/data/osha-ita`.
4. Set `OSHA_ITA_IMPORT_ENABLED=true`.
5. Import OSHA ITA CSV data by running the import script:
   ```bash
   pnpm --filter @workspace/api-server run build
   node artifacts/api-server/scripts/import-osha.ts --input <csv_file> --output /var/data/osha-ita/
   ```

Without a persistent disk, Render's filesystem is ephemeral — any imported OSHA
data will be lost on redeploy.

### Graceful Degradation

The API server starts successfully even when optional API keys are missing.
Each external data source connector returns a clear "not configured" response
rather than crashing. The `/api/sources/status` endpoint reports which sources
are configured and their data type (`live-api`, `cached-import`, `static-index`,
or `not-configured`).

## Project Structure

```
artifacts/
  api-server/          Express API server (TypeScript, esbuild)
    src/services/      Shared service modules (onetService, oshaDataService, blsService)
    src/routes/        Express route handlers
    scripts/           OSHA ITA CSV import script
  occu-med-insight-hub/ React frontend (Vite, TailwindCSS, shadcn/ui)
lib/
  api-client-react/    Generated React API client
  api-zod/             Zod schemas
  db/                  Drizzle ORM schema and migrations
render.yaml            Render deployment configuration
```
