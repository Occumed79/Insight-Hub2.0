# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Artifacts

### Occu-Med Insight Hub

- **Path**: `artifacts/occu-med-insight-hub`
- **Preview path**: `/`
- **Stack**: React + Vite + Tailwind CSS + Framer Motion + Wouter routing, Recharts, react-simple-maps, xlsx
- **Purpose**: Aurora-themed occupational medicine intelligence dashboard seeded from attached V2X/worker-comp/geographic Excel workbooks.
- **Implemented portals**:
  - `/` landing portal grid with 3 internal portals and 3 configurable external redirect cards
  - `/data-profiles` reusable company intelligence dossier with selector, expandable panels, source library, metrics, and charts
  - `/quantifiable-data` reusable quant analysis system with editable assumptions, formula explanation, charts, and report view
  - `/geographic-data` reusable geographic intelligence map with filters, parsed V2X locations, and location side panel
- **Data architecture**: Client-side reusable structures for companies, profiles, metrics, locations, sources, reports, assumptions, Excel parsing utilities, and a lightweight PDF source-note extraction interface.
- **Brand/visual system**: Uses the attached Occu-Med logo asset via Vite asset import and a premium luminous aurora glass UI with animated metrics, portal-card shimmer, executive signal strips, and pulsing geographic map markers.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
