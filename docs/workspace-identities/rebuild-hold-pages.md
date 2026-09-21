# Rebuild Hold — Workspace Identity Manifest

Date: 2026-09-21

These workspaces are intentionally blank in the UI while they are being rebuilt.

The routes, navigation labels, underlying source implementations, data contracts, and product purpose are preserved. The blank shell must not be treated as a new product definition. When rebuilding, use the identities below as binding constraints so the pages do not drift into unrelated tools.

## 1. Injuries & Medical Conditions

- Route: `/injuries-medical-conditions`
- Sidebar label: `Injuries & Medical Conditions`
- Identity key: `injuries-medical-conditions`
- Original route component: `src/pages/reviewer-injuries-medical.tsx`
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

## 2. Standards Intelligence

- Route: `/standards-intelligence`
- Sidebar label: `Standards Intelligence`
- Identity key: `standards-intelligence`
- Original route component: `src/pages/reviewer-standards-experience.tsx`
- Preserved implementation: `src/pages/reviewer-standards-intelligence.tsx`
- Core product identity:
  - standards/evidence reader for occupational, deployment, transportation, emergency-response, and medical-surveillance requirements
  - source registry with selectable standards and source provenance
  - case evaluator that accepts occupation/context, condition, medication, measurements, and program/exposure triggers
  - distinguish automated-medical, trigger-based, and reference-only coverage
  - matched findings must retain source/citation/action context
  - standards remain controlling references; the UI must not invent requirements
- Important live data / APIs:
  - `GET /api/standards/catalog`
  - `POST /api/standards/evaluate`
- Known source families represented in the existing implementation include CENTCOM MOD 18, FMCSA, transportation/FAA references, NFPA/emergency-response material, and OSHA surveillance standards.
- Rebuild rule: this remains a standards intelligence and case-evaluation workspace, not a generic document library and not a replacement for controlling source text.

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

## UI hold state

The current visible route implementations intentionally render only:
- the existing Insight Hub sidebar/navigation
- an empty workspace body
- hidden route/workspace identity attributes

No cards, legacy page information, metrics, forms, tables, diagrams, or feeds should be visible on these four routes until their rebuilds are deliberately started.

The preserved implementation files above are intentionally left in the repository so behavior, terminology, formulas, source boundaries, and data contracts remain available during reconstruction.
