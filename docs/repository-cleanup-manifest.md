# Insight Hub 2.0 Repository Cleanup Manifest

## Purpose

This file controls the staged cleanup of Insight Hub 2.0. Cleanup must proceed through isolated pull requests, preserve production behavior, and lower—never silently raise—the repository integrity baseline.

## Phase status

- **Phase 1 — safety and inventory:** complete in PR #29.
- **Phase 2 — proven garbage removal:** implemented in the current pull request.
- **Phase 3 — canonical data spine:** pending.
- **Phase 4 — visualization validity:** pending.
- **Phase 5 — style consolidation:** pending.
- **Phase 6 — shared-data security:** pending.

## Classification

### Keep: production-critical

These areas require route, import, replacement, and build verification before removal:

- `artifacts/occu-med-insight-hub/src/main.tsx`
- `artifacts/occu-med-insight-hub/src/App.tsx`
- `artifacts/occu-med-insight-hub/src/pages/`
- `artifacts/occu-med-insight-hub/src/components/insight/`
- `artifacts/occu-med-insight-hub/src/components/company/`
- `artifacts/api-server/src/index.ts`
- `artifacts/api-server/src/routes/`
- `artifacts/api-server/src/services/`
- `lib/db/src/`
- `render.yaml`
- `.github/workflows/build-check.yml`

### Keep: source material

Preserve uploaded workbooks, reports, company dossier content, verified location imports, and source/provenance records until their information exists in the canonical data spine.

### Removed in Phase 2

- the orphan root `app/page.tsx` shell;
- the separate `artifacts/mockup-sandbox/` application and duplicate UI library;
- committed `dist/` declaration output;
- committed `*.tsbuildinfo` files;
- committed declaration source maps;
- pasted implementation-prompt text files in `attached_assets/`;
- the stale mockup workspace importer and build exclusions.

### Still quarantined for later verification

- unused generated UI wrappers;
- unreachable frontend pages and panels;
- duplicate company configuration files;
- the alternate Data Visualization feed/adapter architecture.

### Do not delete yet

- any company dossier or workbook containing unique information;
- any route registered by the production API;
- any component reachable from the production frontend entrypoint;
- any deployed database schema or migration;
- any CSS rule before its visual effect is transferred to the consolidated style system.

## Phase 2 acceptance criteria

- one application shell remains;
- no committed generated artifacts remain;
- no exact duplicate file groups remain;
- workspace configuration references only the two production applications;
- GitHub Actions passes the repository audit, TypeScript typecheck, and production build;
- no production data, routes, visual behavior, or CSS are changed.

## Remaining phases

### Phase 3: canonical data spine

Create one path:

`source record -> normalized fact -> validated metric/location -> company profile -> visualization`

Every fact must carry source identity, company identity, unit, effective date, confidence, actual/estimated/modeled status, and a stable deduplication key.

### Phase 4: visualization validity

Reject mixed-unit charts, remove unsupported hard-coded projections, preserve missing values, position matrix points from real values, validate currency scaling and coordinates, and expose provenance/status in chart details.

### Phase 5: style consolidation

Replace global patch layers and component-injected CSS with one token system, one base layer, and scoped component styles while preserving the existing glassmorphic macOS Tahoe appearance.

### Phase 6: shared-data security

Require authenticated, role-protected access for portal-link changes, entity verification, location imports, and intelligence ingestion.

## Review rule

Every cleanup pull request must state what it removes, how production behavior was validated, how the baseline changed, and whether data or visual behavior changed.
