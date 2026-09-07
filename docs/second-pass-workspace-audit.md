# Insight Hub 2.0 second-pass workspace audit

Reviewed: 2026-09-07. This file records production route ownership, visible dependencies, persistence, and acceptance coverage. It is intentionally an audit artifact rather than a visual design specification.

## Migration matrix

| Workspace | Production component | Page-owned interaction / presentation | Shared visible dependency after remediation | Persistence | Acceptance |
| --- | --- | --- | --- | --- | --- |
| Injuries & Medical Conditions | `reviewer-injuries-medical` | Anatomy-first body-region navigator and evidence workbench | None at route boundary | API-backed cases; transient selection | `injury-hologram.spec.ts` |
| Job Intelligence | `job-intelligence-v2` | Occupation discovery and duty evidence editor | None at route boundary | API profiles; one explicit legacy-local import path | `job-intelligence.spec.ts` |
| AOR Factors | `reviewer-aor-factors-live` | Map-first command/country operating picture | None at route boundary | Current entity context only | `aor-consolidation.spec.ts` |
| Drug Checker | `reviewer-drug-checker` | Medication/regimen scientific workspace | None at route boundary | Temporary form state | `reviewed-intelligence.spec.ts` |
| Clinical Calculators | `reviewer-clinical-calculators` | Focused instrument selector and calculation surfaces | None at route boundary | Temporary inputs | `clinical-calculators.spec.ts` |
| Standards Intelligence | `reviewer-standards-intelligence` | Dense standards/evidence reader | None at route boundary | Source API | `reviewed-intelligence.spec.ts` |
| Federal Agencies | `federal-agencies-v2` | Agency-profile evidence workstation | None at route boundary | Source API | `ui-hardening.spec.ts` |
| State Agencies | `state-agencies-v2` | State map and jurisdiction evidence | None at route boundary | Source API | `state-map.spec.ts` |
| SEC Filings | `sec-filings` | Document/issuer intelligence terminal | None at route boundary | Tracked issuers remain session-only; durable backend migration is open | `reviewed-intelligence.spec.ts` |
| Organizational Chart | `leadership-map` | Spatial topology, relationship selection, and inspector | None at route boundary | Loaded chart is source-backed; form seed is session-only | `reviewed-intelligence.spec.ts` |
| Industry Impact | `industry-impact-calculator-v3` | Live simulation bands and scenario controls | None at route boundary | Temporary inputs | `occupational-intelligence.spec.ts` |
| Occupational Calculators | `occupational-calculators-v3` | Dedicated scientific instruments | None at route boundary | Temporary inputs | `occupational-intelligence.spec.ts` |
| Defense Medical Support | `war-costs-intelligence` | Country-first operational evidence board | None at route boundary | Source API | `reviewed-intelligence.spec.ts` |
| Footprint Map | `war-costs-map` + `war-costs-arcgis-map` | Dominant ArcGIS canvas with named layer rail and evidence inspector | None at route boundary | Source API; selection is transient | `reviewed-intelligence.spec.ts` |
| Network Priorities | `war-costs-tools` | Network-planning evidence | None at route boundary | Source API | `reviewed-intelligence.spec.ts` |
| Site & Coverage | `war-costs-special-tools` | Site/coverage analysis | None at route boundary | Source API | `reviewed-intelligence.spec.ts` |
| Footprint Visuals | `war-costs-visualizations` | Defense-specific charts | None at route boundary | Source API | `reviewed-intelligence.spec.ts` |
| Source Audit | `war-costs-accountability` | Feed audit table | None at route boundary | Source API | `reviewed-intelligence.spec.ts` |
| Source Evidence | `war-costs-site-evidence` | Approved-source evidence reader | None at route boundary | Source API | `reviewed-intelligence.spec.ts` |
| Federal Awards | `federal-awards-v2` | Recipient/time spending intelligence | None at route boundary | Shared entity state; source API | `reviewed-intelligence.spec.ts` |
| Legal & Injury | `legal-injury-intelligence-v2` | Case/evidence research interface | None at route boundary | Saved cases are still local-only; backend migration is open | `reviewed-intelligence.spec.ts` |
| Landing | `landing` | **Protected; unchanged** | Existing protected presentation | Link configuration | `ui-hardening.spec.ts` |
| DBA Data Hub | `dba-intelligence` | **Protected; page source unchanged** | None at route boundary | Source API | `ui-hardening.spec.ts` |
| O*NET Master Tool | `onet-master-tool` | **Protected; page source unchanged** | None at route boundary | Source API | `occupational-intelligence.spec.ts` |
| Occupational Data Explorer | `occupational-data-explorer` | **Protected; page source unchanged** | None at route boundary | Source API | `occupational-intelligence.spec.ts` |

The route-level `CinematicToolPage` and `CinematicDirectPage` abstractions were removed. Every tool now mounts directly and therefore cannot inherit its background, scene, glass treatment, or motion from `App.tsx`. The unused `CinematicStage`, `CinematicPortal`, `cinematic-stage.css`, and `translucent-tools.css` implementations were deleted; protected page source was not restyled.

## Route classification

### KEEP — current product

`/`, `/entities`, `/clients`, `/competitors`, `/federal-agencies`, `/state-agencies`, `/sec-filings`, `/leadership-map`, `/dba-intelligence`, `/fec-filings`, `/injuries-medical-conditions`, `/job-intelligence`, `/aor-factors`, `/drug-checker`, `/clinical-calculators`, `/standards-intelligence`, `/onet-master-tool`, `/occupational-data-explorer`, `/industry-impact-calculator`, `/occupational-calculators`, `/war-costs-intelligence`, `/war-costs-map`, `/war-costs-tools`, `/war-costs-special-tools`, `/war-costs-visualizations`, `/war-costs-accountability`, `/war-costs-site-evidence`, `/federal-awards`, `/public-legal-references`, and `/geographic-footprint`.

### INTERNAL — supporting capability intentionally outside primary navigation

`/data-visualization`, `/quantifiable-data`, `/hiring-intelligence`, `/corporate-structure`, `/employer-workflow`, `/employer-intelligence`, `/entity-resolution`, `/injury-workforce-exposure`, `/corporate-signals`, `/workers-comp-coverage`, and `/source-governance`.

### REDIRECT / compatibility aliases

Wouter currently resolves these aliases to their modern component without a URL rewrite: `/prospects` → entities, `/aor-risk-intelligence` → AOR Factors, `/industry-injury-benchmarks` → Industry Impact, `/occupational-demands` → Job Intelligence, `/war-costs` → Defense Medical Support, `/geographic-data` → Footprint Map, `/geographic-overlap` → Location Overlap, `/occupational-exposure` → Injury Workforce Exposure, and `/company-live-intelligence` → Corporate Signals. `/legacy-job-intelligence` is retained as an explicit legacy compatibility surface pending usage telemetry.

### DELETE

No additional route was deleted in this pass without usage telemetry. The catch-all resolves unknown paths to `not-found`.

## Shared state and persistence findings

`EmployerWorkflowContext` is the lightweight, non-visual entity context. It lets independent research tools receive the current employer without imposing any shared visible UI. Temporary workflow, map radius, URL, calculator, and form inputs appropriately remain session-scoped.

Two curated-intelligence gaps remain: SEC tracked issuers use `sessionStorage`, and Legal & Injury saved cases use `localStorage`. They were not silently moved because the current backend schema has no reviewed ownership/access model for these user-specific records. A durable migration requires authenticated ownership, retention rules, and a Neon migration; preserving the current behavior is safer than creating unauthenticated permanent records.

## Repository cleanup findings

The similarly named `industry-impact-calculator.tsx`, `occupational-calculators.tsx`, `reviewer-job-intelligence.tsx`, and the `*-legacy.tsx` files are not assumed safe to delete merely from their names: current routed files import or wrap several of them, and tests or compatibility routes still exercise others. This pass therefore records them instead of deleting live dependencies. The repository audit remains the mechanical guard against newly unreachable frontend files.

## Mechanical versus visual verification

The UI hardening audit mechanically prevents reintroduction of route-level cinematic wrappers and positional Defense Map selectors. Browser tests mechanically check rendered, loaded interaction states. Screenshot review is still a human judgment: a passing screenshot or Playwright assertion does not establish that a workspace has met the stated visual quality bar.
