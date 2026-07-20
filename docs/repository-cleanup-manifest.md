# Insight Hub 2.0 Repository Cleanup Manifest

## Purpose

This file controls the staged cleanup of Insight Hub 2.0. Cleanup must proceed through isolated pull requests, preserve production behavior, and lower—never silently raise—the repository integrity baseline.

## Phase status

- **Phase 1 — safety and inventory:** complete in PR #29.
- **Phase 2 — proven garbage removal:** complete in PR #30.
- **Phase 3 — canonical data spine:** complete in PR #31.
- **Phase 4 — visualization validity:** implemented in PR #32.
- **Phase 5 — style consolidation:** pending.
- **Phase 6 — shared-data security:** pending.

## Canonical data path

`seed -> configuration registry -> uploaded workbooks -> curated dossiers -> uploaded report replacements -> live intelligence`

## Phase 4 visualization contract

- incompatible units never share one chart axis;
- missing or invalid values are not converted to zero;
- raw dollar/hour values are normalized to the declared display scale;
- single values and insufficient trends render as proof objects or warnings rather than exaggerated charts;
- direct metric summaries are separated by unit;
- modeled cost outputs are labeled modeled and no hard-coded future growth rates are manufactured;
- matrix points are positioned from their actual X/Y values rather than array order;
- matrices without explicit currency metadata use neutral source-unit labels instead of falsely claiming thousands or millions;
- source, confidence, date, and status fields remain available to chart details and tooltips.

## Keep: production-critical

Production entrypoints, live routes, reachable components, API services, database schemas, migrations, Render configuration, and the current styling system remain protected.

## Keep: source material

Uploaded workbooks, reports, company dossier content, verified location imports, and source/provenance records remain preserved.

## Remaining phases

### Phase 5: style consolidation

Replace global patch layers and component-injected CSS with one token system, one base layer, and scoped component styles while preserving the existing glassmorphic macOS Tahoe appearance.

### Phase 6: shared-data security

Require authenticated, role-protected access for portal-link changes, entity verification, location imports, and intelligence ingestion.

## Review rule

Every cleanup pull request must state what it removes or replaces, how production behavior was validated, how the baseline changed, and whether data or visual behavior changed.
