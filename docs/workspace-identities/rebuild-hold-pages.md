# Rebuild Hold — Workspace Identity Manifest

Date: 2026-09-21

This manifest tracks remaining blank rebuild-hold workspaces and records superseded workspaces removed or completed since 2026-09-21.

Preserve the documented identity of active tools; do not revive retired implementations. A blank shell must not be treated as a new product definition. When rebuilding, use the identities below as binding constraints so the pages do not drift into unrelated tools.

## 1. Injuries & Medical Conditions

- Route: `/injuries-medical-conditions`
- Sidebar label: `Injuries & Medical Conditions`
- Identity key: `injuries-medical-conditions`
- Route component: `src/pages/reviewer-injuries-medical.tsx` → renders the hologram page in `src/pages/health-intelligence/` (exact supplied gold front/back image at `public/health/hologram-body.png`, Strands rings, data-driven body-region zones)
- Preserved implementation: `src/pages/reviewer-injuries-medical-legacy.tsx`
- Preserved visual/support code: `src/pages/reviewer-injury-hologram.tsx`, `src/pages/reviewer-injuries-workbench.css`
- Core product identity:
  - two distinct modes: `Injury Intelligence` and `Medical Conditions`
  - resolve an occupation through O*NET before presenting occupation-linked injury evidence
  - use imported OSHA case characteristics as evidence, not as an individual injury probability
  - show reported case outcomes and distributions such as body part, event/exposure, nature, and primary source
  - retain a searchable medical-condition reference library organized by clinical/system context
  - do not convert either injury evidence or condition context into an automatic fitness-for-duty decision
- Important live data / APIs:
  - `/api/occupational-discovery/onet/profile`
  - `/api/occupational-discovery/osha-occupation-profile`
- Rebuild rule: this remains an occupation-linked injury/medical evidence workspace. Do not turn it into a generic anatomy viewer, a generic medical encyclopedia, or an automatic clearance engine.

## 2. Standards Intelligence — regulatory changes monitor (awaiting implementation)

- Route: `/standards-intelligence`
- Sidebar label: `Standards Intelligence`
- Identity key: `standards-intelligence`
- Route component: `src/pages/reviewer-standards-experience.tsx` (blank rebuild hold)
- **Product purpose:** detect and surface changes to regulatory and occupational-health standards and guidance across professions, industries, states and federal agencies.
- Monitor official authoritative publications and amendments. Organize findings by issuing body, jurisdiction, specialty, effective date and practical impact.
- Track proposed, final, revised, superseded and withdrawn rules, medical guidance and occupational-health recommendations.
- Preserve source links, publication/verification timestamps and update history; explicitly distinguish issued changes from speculation and commentary.
- Initial public sources can include Federal Register and agency RSS/news/official publications; gated sources require a verified access plan. There is no requirement for a single universal API key.
- **Retired and deleted:** old `/api/standards/catalog`, `/api/standards/evaluate` case evaluator and `reviewer-standards-intelligence.tsx` page. They must not be restored.
- A new monitoring API and UI must be designed separately for the actual update-tracking purpose; no old clinical case-evaluator code should be reused.

## 3. Organizational Chart

- Route: `/leadership-map`
- Sidebar label: `Organizational Chart`
- Identity key: `organizational-chart`
- Original route component: `src/pages/leadership-map-experience.tsx`
- Preserved implementation: `src/pages/leadership-map.tsx`
- Preserved API client: `src/data/leadershipMapApi`
- Core product identity:
  - organization / leadership topology workspace
  - saved and new-company modes
  - people, roles, hierarchy levels, reporting edges, confidence, evidence, gaps, and selected-person detail
  - preserve explicit vs inferred reporting relationships
  - support source refresh / analysis and saved organizational charts
  - support contact-domain context and professional-contact paths without treating guessed contact information as verified
- Important live data / API families:
  - `/leadership-map/saved`
  - `/leadership-map/saved/:entityId`
  - `/leadership-map/analyze`
  - related leadership-map orchestration / source-refresh routes
- Rebuild rule: this remains a navigable organizational topology/evidence tool. Do not reduce it to a static org-chart picture or a generic people directory.

## 4. Occupational Calculators

- Route: `/occupational-calculators`
- Sidebar label: `Occupational Calculators`
- Identity key: `occupational-calculators`
- Original route component: `src/pages/occupational-calculators-experience.tsx`
- Preserved implementation: `src/pages/occupational-calculators-v3.tsx`
- Shared context dependency: `EmployerWorkflowContext`
- Core product identity:
  - occupational-health calculator workstation
  - shared employer, workforce, annual-hours, and industry/BLS context
  - five calculator families: Safety Rates; Workers’ Comp & Cost; Workforce Health; Readiness; Job & Exposure
  - eleven existing tools:
    1. TRIR & DART
    2. Workers’ Comp Cost
    3. Lost Time
    4. Return to Work
    5. Intervention Break-Even
    6. Workforce Health Burden
    7. Age-Based Chronic Conditions
    8. Aggravation & Comorbidity Overlap
    9. Deployment Readiness
    10. Condition × Job Demands
    11. Shift & Fatigue Exposure
  - preserve evidence-kind distinctions: straight arithmetic, official benchmark, user assumption, O*NET source data, and operational input
  - calculations must remain transparent about formulas, assumptions, and source/reference
  - do not convert planning arithmetic into individual medical conclusions
- Important live data / APIs:
  - `/api/occupational-discovery/bls-overview`
  - `/api/occupational-discovery/onet/profile`
- Rebuild rule: this remains a multi-instrument occupational calculation workstation. Do not collapse it into a generic KPI dashboard.


## 5. Industry Impact Calculator

- Route: `/industry-impact-calculator`
- Sidebar label: `Industry Impact Calculator`
- Identity key: `industry-impact`
- Original route component: `src/pages/industry-impact-experience.tsx`
- Preserved implementation: `src/pages/industry-impact-calculator-v3.tsx`
- Core product identity:
  - workforce-scaled scenario laboratory
  - keeps observed employer baseline, official BLS benchmark, user assumptions, and modeled outputs visibly distinct
  - models annual hours, current/target recordables, DART context, lost workdays, low/base/high cost assumptions, savings, benchmark gap, and scenario trajectory
  - supports workforce basis/provenance, NAICS/BLS benchmark selection, and cost-sensitivity planning
  - modeled outputs are scenarios, not forecasts
- Important live data / APIs:
  - `/api/occupational-discovery/bls-overview`
  - `/api/bls/industry-benchmark`
- Rebuild rule: this remains an employer/BLS scenario laboratory. Do not turn it into a generic KPI dashboard or present modeled savings as observed facts.

## 6. SEC Filings

- Route: `/sec-filings`
- Sidebar label: `SEC Filings`
- Identity key: `sec-filings`
- Original route component: `src/pages/sec-filings-experience.tsx`
- Preserved implementation: `src/pages/sec-filings.tsx`
- Preserved API client: `src/data/secFilingsApi.ts`
- Core product identity:
  - employer/public-company intelligence workspace backed by SEC EDGAR
  - tracked issuers plus issuer discovery
  - dense filing timeline/feed with filtering by filing metadata
  - persistent selected-filing inspector with accession/report dates, document type, XBRL state, and direct official SEC document/index links
  - refreshes public filing data while keeping the selected filing in context
- Important live data / APIs:
  - `GET /api/sec-filings/search?q=...`
  - `POST /api/sec-filings/feed`
- Rebuild rule: this remains a live SEC filing discovery/timeline/reader workspace, not a generic company-news page and not an investment-rating tool.

## 7. Drug Checker

- Route: `/drug-checker`
- Sidebar label: `Drug Checker`
- Identity key: `drug-checker`
- Original route component: `src/pages/reviewer-drug-checker-experience.tsx`
- Preserved implementation: `src/pages/reviewer-drug-checker.tsx`
- Core product identity:
  - medication / occupational-review workspace
  - regimen builder that keeps multiple selected medications in context
  - medication identity and class evidence from NLM/RxNorm/RxClass-style source data
  - product-label evidence from FDA Structured Product Labeling / openFDA with DailyMed source paths
  - PubChem molecular record support
  - occupationally relevant medication signals and cross-medication evidence
  - does not diagnose, prescribe, invent interaction severity, or issue fitness-for-duty clearance
- Important live data / APIs include:
  - reviewer-tools medication search/intelligence routes used by the existing implementation
  - `/api/reviewer-tools/pubchem?name=...`
- Rebuild rule: this remains a source-backed medication evidence/regimen workspace. Do not reduce it to a generic drug encyclopedia or convert source signals into invented clinical judgments.

## Retired — Clinical Calculators

The former `/clinical-calculators` route, navigation entry, UI, and standalone clinical equation library were removed on 2026-10-12 at the user's direction. The page was already on rebuild hold and had no dedicated API router or database tables. Do not restore it during later redesigns or confuse it with the **separate** retained `/occupational-calculators` workspace.

## Retired — Job Intelligence

The duplicate Job Intelligence tab, legacy pages, profile APIs, and job-intelligence database service were removed on 2026-10-12. Do not restore them in a workspace rebuild. Official O*NET browsing remains under the `/onet-master-tool` route; shared O*NET APIs still serve independent active tools. Historical database rows were not dropped.

## UI hold state

The current visible route implementations intentionally render only:
- the existing Insight Hub sidebar/navigation
- an empty workspace body
- hidden route/workspace identity attributes

No cards, legacy page information, metrics, forms, tables, diagrams, charts, feeds, or other page content should be visible on these **six routes** until their rebuilds are deliberately started:

1. `/drug-checker`
2. `/standards-intelligence`
3. `/sec-filings`
4. `/leadership-map`
5. `/industry-impact-calculator`
6. `/occupational-calculators`

The preserved implementation files above are intentionally left in the repository so behavior, terminology, formulas, source boundaries, data contracts, and page identity remain available during reconstruction.
