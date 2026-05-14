# Occu-Med Insight Hub 2.0

Insight Hub is a strategic intelligence dashboard for Occu-Med. It combines account profiles, workforce and workers-compensation proxy metrics, geographic footprint mapping, executive readouts, and a backend foundation for future source discovery and enrichment workflows.

## Current status

This repo is now structured as a production-style foundation rather than a static-only mockup.

It currently includes:

- React/Vite frontend with portal routing.
- Express API server.
- Backend dataset API for companies, profiles, metrics, sources, locations, assumptions, reports, and search runs.
- Drizzle/Postgres schema for the core Insight Hub entities.
- Render blueprint for a single web service that builds the frontend and serves it through the API server.
- Workbook/seed-data fallback so the frontend can still render if the backend dataset endpoint is unavailable.

It does not yet include live third-party discovery workflows. The API-key environment variables are reserved for that next layer.

## App routes

Frontend routes:

- `/` — Insight Hub landing page.
- `/data-profiles` — company dossier and source-backed profile view.
- `/quantifiable-data` — editable cost model and executive report view.
- `/geographic-data` — global footprint map and location register.

API routes:

- `GET /api/healthz` — server health check.
- `GET /api/insight/dataset` — full backend seed dataset.
- `GET /api/insight/dataset?companyId=v2x` — company-filtered dataset.
- `GET /api/insight/companies` — company list.
- `GET /api/insight/companies/:companyId` — company detail bundle.
- `GET /api/insight/search-runs` — search-run records.
- `POST /api/insight/search-runs` — creates a mock completed search run.

## Workspace layout

```text
.
├── artifacts/
│   ├── api-server/                # Express backend
│   ├── occu-med-insight-hub/      # React/Vite frontend
│   └── mockup-sandbox/            # Sandbox artifact from earlier mockup work
├── lib/
│   ├── api-client-react/          # Generated/future client helpers
│   ├── api-zod/                   # Generated/future API schemas
│   └── db/                        # Drizzle/Postgres schema
├── attached_assets/               # workbook/image assets consumed by frontend
├── package.json
├── pnpm-workspace.yaml
└── render.yaml
```

## Local development

Use pnpm only. The root `preinstall` script blocks npm/yarn installs to prevent lockfile drift.

```bash
corepack enable
pnpm install
pnpm run dev:web
```

In another terminal:

```bash
pnpm run dev:api
```

For local API development, create an `.env` file inside `artifacts/api-server/` with at least:

```bash
PORT=3001
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DATABASE
```

The frontend will try to load `/api/insight/dataset`. If that request fails, it falls back to workbook/seed data.

## Build

```bash
pnpm run build
```

Or separately:

```bash
pnpm run build:web
pnpm run build:api
```

## Render deployment

The included `render.yaml` provisions:

- A free Render Postgres database named `insight-hub-db`.
- A free Render Node web service named `occu-med-insight-hub`.
- A health check at `/api/healthz`.

The Render build command is:

```bash
corepack enable && pnpm install --frozen-lockfile && pnpm run build:web && pnpm run build:api
```

The start command is:

```bash
node --enable-source-maps ./artifacts/api-server/dist/index.mjs
```

## Database

The Drizzle schema currently defines:

- `companies`
- `sources`
- `metrics`
- `profiles`
- `locations`
- `assumptions`
- `reports`
- `search_runs`

To push schema changes, set `DATABASE_URL` and run:

```bash
pnpm --filter @workspace/db run push
```

## Next build targets

Recommended next steps:

1. Replace backend seed arrays with database-backed reads.
2. Add a seed script to insert the current dataset into Postgres.
3. Add admin upload/import for workbooks.
4. Add live discovery providers using Serper, Tavily, Exa, Firecrawl, Apify, or Jina.
5. Replace hard-coded external portal URLs with database or environment-configured portal records.
6. Add authentication before exposing admin/import/search-write functions publicly.

## Important note

The app is now much closer to a real architecture, but it should still be treated as a foundation. The current search-run endpoint intentionally creates a mock record. Live search/enrichment should be added behind authenticated API routes before being presented as production intelligence automation.
