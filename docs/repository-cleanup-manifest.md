# Insight Hub 2.0 Repository Cleanup Manifest

## Purpose

This file is the controlling manifest for the staged cleanup of Insight Hub 2.0. It prevents broad deletion or visual rewrites before the production application has enough automated protection.

The cleanup must proceed through isolated pull requests. A later phase may reduce any baseline maximum, but it must not raise one without a written explanation in the pull request.

## Phase 1: safety and inventory

Status: **in progress in this pull request**

Changes allowed:

- repository inventory and reachability reporting;
- build, typecheck, and repository-integrity checks;
- documentation of keep, quarantine, and deletion candidates;
- no runtime visual changes;
- no production data migration;
- no removal of existing application files.

Acceptance criteria:

- `pnpm run audit:repository` runs without dependencies beyond Node;
- pull requests run the repository audit before typecheck and build;
- the current structural debt is captured as a baseline;
- CI fails when structural debt increases;
- the working production entrypoints remain present.

## Classification

### Keep: production-critical

These files or areas are part of the deployed application and must not be removed without a replacement and route/build verification.

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

These areas can still contain defects or unused files. “Keep” means they require import, route, or replacement analysis before deletion.

### Keep: source material

These are not necessarily runtime architecture, but they contain source information that must be preserved until it has been normalized into the canonical data system.

- uploaded workbooks and reports;
- company dossier source content;
- verified location records and import source files;
- data-source notes and provenance records.

Source material must not be deleted merely because its current loader is being replaced.

### Quarantine candidates

These should be moved out of the production workspace or isolated in a later pull request after build and route checks prove they are not required.

- `artifacts/mockup-sandbox/`
- root `app/page.tsx`
- pasted implementation-prompt and historical instruction files in `attached_assets/`
- unused generated UI wrappers;
- unreachable frontend pages and panels;
- duplicate company configuration files;
- the alternate Data Visualization feed/adapter architecture if the live page does not consume it.

### Delete candidates

These can be deleted in Phase 2 after the cleanup branch proves the build regenerates anything required.

- committed `dist/` declaration output;
- committed `*.tsbuildinfo` files;
- committed declaration source maps;
- stale generated API output that is regenerated from the API specification;
- exact duplicate files whose surviving canonical copy is verified;
- temporary verification output and generated reports.

### Do not delete yet

- any company dossier or workbook containing information not represented elsewhere;
- any route registered by the production API;
- any component reachable from the production frontend entrypoint;
- any database schema or migration required by deployed data;
- any CSS rule until its effect has been transferred to the consolidated style system.

## Planned cleanup pull requests

### Phase 2: proven garbage removal

- remove committed build artifacts;
- remove the orphan root application shell;
- remove the mockup sandbox from the production workspace;
- remove prompt dumps and temporary files from the code search surface;
- remove unreachable UI wrappers only after import verification;
- update workspace configuration, lockfile, and ignore rules;
- lower the repository baseline.

### Phase 3: canonical data spine

Create one path:

`source record -> normalized fact -> validated metric/location -> company profile -> visualization`

Required fields include source identity, company identity, unit, effective date, confidence, actual/estimated/modeled status, and a stable deduplication key.

### Phase 4: visualization validity

- reject mixed-unit charts;
- remove hard-coded projections not backed by a named assumption;
- preserve missing values instead of replacing them with zero or one;
- position matrix points from actual data values;
- validate currency scaling and coordinates;
- expose provenance and status in chart details.

### Phase 5: style consolidation

Replace global patch layers and component-injected CSS with one token system, one base layer, and scoped component styles.

### Phase 6: shared-data security

Require authenticated, role-protected access for portal-link changes, entity verification, location imports, and intelligence ingestion.

## Review rule

A cleanup pull request must state:

1. which manifest items it changes;
2. which files are removed or replaced;
3. how the production build and routes were validated;
4. how the repository baseline changed;
5. whether any data or visual behavior changed.
