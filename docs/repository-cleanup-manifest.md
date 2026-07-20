# Insight Hub 2.0 Repository Cleanup Manifest

## Purpose

This file controls the staged cleanup of Insight Hub 2.0. Cleanup must proceed through isolated pull requests, preserve production behavior, and lower—never silently raise—the repository integrity baseline.

## Phase status

- **Phase 1 — safety and inventory:** complete in PR #29.
- **Phase 2 — proven garbage removal:** complete in PR #30.
- **Phase 3 — canonical data spine:** implemented in PR #31.
- **Phase 4 — visualization validity:** pending.
- **Phase 5 — style consolidation:** pending.
- **Phase 6 — shared-data security:** pending.

## Canonical data path

The application now assembles data through one explicit precedence model:

`seed -> configuration registry -> uploaded workbooks -> curated dossiers -> uploaded report replacements -> live intelligence`

Every collection is normalized by canonical company ID and deduplicated through one assembler before it reaches a page. Uploaded-report replacements remain explicit rather than relying on array order.

## Phase 3 changes

- added `canonicalDataset.ts` as the only dataset assembly and validation layer;
- added `datasetLayers.ts` as the authoritative source precedence registry;
- removed the 20-company intelligence cap and replaced it with bounded-concurrency loading for every actual company;
- classified company, portfolio, dashboard, network, methodology, and temporary entities so non-company collections are not queried as companies;
- changed workbook ingestion from a competing full dataset into a normalized source layer;
- stopped truncating proxy rows and geographic locations;
- stopped replacing all seed locations when workbook locations exist;
- stopped inventing workbook trend values;
- preserved missing numeric values instead of automatically manufacturing zero-valued metrics;
- added source linkage, record status, deduplication, layer diagnostics, orphan checks, and coordinate checks;
- corrected the known Camp Patriot coordinate that previously plotted in Antarctica.

## Keep: production-critical

Production entrypoints, live routes, reachable components, API services, database schemas, migrations, Render configuration, and the current styling system remain protected.

## Keep: source material

Uploaded workbooks, reports, company dossier content, verified location imports, and source/provenance records remain preserved until their information is represented in the canonical data spine.

## Remaining phases

### Phase 4: visualization validity

Reject mixed-unit charts, remove unsupported hard-coded projections, preserve missing values in chart data, position matrix points from real values, validate currency scaling, and expose provenance/status in chart details.

### Phase 5: style consolidation

Replace global patch layers and component-injected CSS with one token system, one base layer, and scoped component styles while preserving the existing glassmorphic macOS Tahoe appearance.

### Phase 6: shared-data security

Require authenticated, role-protected access for portal-link changes, entity verification, location imports, and intelligence ingestion.

## Review rule

Every cleanup pull request must state what it removes or replaces, how production behavior was validated, how the baseline changed, and whether data or visual behavior changed.
