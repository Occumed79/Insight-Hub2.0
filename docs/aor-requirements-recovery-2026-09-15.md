# AOR requirements recovery — 2026-09-15

## Purpose

This document is the recovery ledger for the Insight Hub 2.0 **AOR Factors** workspace before any completion run is allowed to call the new globe a replacement. It reconciles retrievable prior conversation exports, user-provided AOR datasets, merged GitHub decisions, later AOR health work, and the current production code.

The rule is chronological: **later explicit user decisions override earlier proposals**. A source that was once discussed but later removed is not a missing feature.

## Product boundary

AOR Factors is a **MapTiler health/risk operating picture**, not the Defense War Map. The map is the application: country/AOR selection, map-linked evidence, meaningful layers, geographic focus, contextual country intelligence, and in-map/edge-drawer controls should dominate. Do not convert it back into a card dashboard.

The current globe work must preserve all valid AOR intelligence while changing only the map projection/surface. `MAP_TILER_API_KEY_6` is the dedicated preferred AOR key on the globe branch. MapTiler's built-in halo stays disabled. A separate orb/sphere is a later visual layer and is not part of this recovery implementation.

## Status vocabulary

- **IMPLEMENTED + VERIFIED** — present in the production architecture and backed by merged work/tests.
- **IMPLEMENTED BUT PARTIAL** — exists, but does not yet meet the recovered requirement completely.
- **DATA EXISTS BUT NOT WIRED** — user supplied the data, but production AOR does not consume it.
- **UI EXISTS BUT MANUAL** — UI control exists without the recovered data-backed behavior.
- **REQUESTED BUT MISSING** — explicit retained requirement with no complete implementation found.
- **SUPERSEDED / USER REMOVED** — older idea deliberately removed or replaced; do not restore.
- **PROPOSED / NOT RETAINED** — historical recommendation, but no later evidence makes it current scope.

## Canonical source chronology

### Retained operational sources

| Capability | Current status | Notes |
| --- | --- | --- |
| U.S. Department of State travel advisory context | IMPLEMENTED + VERIFIED | Current country source in AOR. |
| WHO Disease Outbreak News | IMPLEMENTED + VERIFIED | Strict country matching; unrelated global notices must never be substituted. |
| GDACS disaster alerts | IMPLEMENTED + VERIFIED | Country/AOR hazard intelligence; strict country behavior retained. |
| USGS seismic activity | IMPLEMENTED + VERIFIED | Country bounding/selected-context behavior retained. |
| International Crisis Group CrisisWatch | IMPLEMENTED + VERIFIED | Replaced the earlier CFR link-only conflict context. |
| CDC Travelers' Health destination guidance | IMPLEMENTED + VERIFIED | Vaccines/medicines/non-vaccine disease guidance and clinician/source links. |
| CDC Travel Health Notices | IMPLEMENTED + VERIFIED | Destination notice layer; source-defined levels remain separate from other risk signals. |
| OutbreakTracker situational awareness | IMPLEMENTED + VERIFIED | Supplemental awareness only; WHO/CDC remain authoritative operational sources. |
| Historical epidemic frequency / disease-country recurrence | IMPLEMENTED + VERIFIED | Historical occurrence, not current cases/deaths/severity. |
| Published LISA epidemic hotspot classes | IMPLEMENTED + VERIFIED | Published historical analysis; not represented as current risk. |
| CDC Yellow Book 2026 | IMPLEMENTED + VERIFIED | Structured chapters, source assets, timing/operational rules, source boundaries. |
| CDC respiratory surveillance | IMPLEMENTED + VERIFIED | ARI, Rt/trend, laboratory positivity, wastewater, and NSSP ED visit trajectories remain independent signals. |
| WHO immunization program data | IMPLEMENTED + VERIFIED | Coverage/incidence/cases/introduction/program/WUENIC remain distinct; no synthetic coverage score. |
| Historical fungal burden | IMPLEMENTED + VERIFIED | Historical/model-based estimates; must never drive current-outbreak severity. |
| AOR global watch / operational priority brief | IMPLEMENTED + VERIFIED | Preserve global-first operational context and source health. |

### Explicitly removed or replaced sources

These are **not missing** and must not be reintroduced by the completion run.

| Source / feature | Status | Binding decision |
| --- | --- | --- |
| ReliefWeb integration | SUPERSEDED / USER REMOVED | Merged PR #97 explicitly removed the declined ReliefWeb/appname integration. |
| Healthsites facility inventory | SUPERSEDED / USER REMOVED | Merged PR #97 explicitly removed it. Do not revive provider/clinic feasibility inside AOR. |
| NASA FIRMS active fires | SUPERSEDED / USER REMOVED | Merged PR #97 explicitly removed it. |
| UCDP conflict baseline | SUPERSEDED / USER REMOVED | Merged PR #97 explicitly removed it. |
| CFR Global Conflict Tracker | SUPERSEDED / REPLACED | Replaced by live CrisisWatch in PR #108. Do not restore CFR as another conflict surface. |
| ACLED conflict events | SUPERSEDED / USER REMOVED | Merged PR #110 removed ACLED from AOR, source readiness, Render declarations, and retired `/aor/conflict-events` with HTTP 410. CrisisWatch is the retained conflict-context source. |

### Historical proposals that are not current retained scope

GDELT media signals, OFAC sanctions context, CISA KEV, and a WHO Global Health Observatory baseline were discussed during broader source exploration. They are **not automatically part of this completion run** because later retained AOR source sets did not establish them as required current features. Do not add them without a new explicit product decision.

## User-supplied country baseline dataset

The user supplied `AOR_Global_Country_Profiles_MapTiler.xlsx`, generated/reviewed 2026-08-10. It contains **197 country-level profiles** and is explicitly designed for MapTiler level-0 country polygons using `iso_a2` ↔ `iso2`.

The map-ready import contains these fields:

- `profile_id`
- country / ISO2 / ISO3 / MapTiler ISO A2
- AOR region and UN subregion
- capital and representative latitude/longitude
- climate/environment
- medical access
- security/access
- travel-health context
- escalation/evacuation
- review-watch items
- medical-access tier
- legacy-built-in marker
- live-advisory-required marker
- search text

### Current finding

**DATA EXISTS BUT NOT WIRED.** Current AOR production code does not consume this spreadsheet or an equivalent generated data module. This is the clearest recovered implementation gap.

### Required treatment

The country profile is **baseline reviewer orientation**, not a live feed. It must be displayed alongside live sources with its review date/provenance and must never override current CDC, State Department, employer/client, or site-specific guidance.

## Deployment-country factor requirements

Recovered retained country/deployment factors include:

- extreme heat
- extreme cold
- humidity
- altitude / terrain
- desert / dust
- poor air quality
- infectious-disease exposure
- vector-borne disease exposure
- food / water safety
- medication availability / continuity concerns
- local medical infrastructure
- emergency evacuation concerns
- specialty-care availability
- pharmacy reliability
- security / civil-unrest context
- occupational exposure context
- remote / austere-site access constraints

### Current finding

The AOR UI currently has manual work-condition buttons for heat, cold, altitude, poor air, fatigue, PPE burden, and night/circadian disruption. Country baseline fields that could support heat/cold/altitude/dust/medical-access/evacuation context are not wired into those controls.

Classify this as **UI EXISTS BUT MANUAL / IMPLEMENTED BUT PARTIAL**.

### Required behavior

- Country-derived factors must be visually distinguished as **baseline country signals** from the 2026-08-10 profile dataset.
- Reviewer-entered work factors such as fatigue, PPE burden, and night work remain manual because they are job/site facts, not country facts.
- Do not present the baseline profile as live meteorology/AQI.
- Do not fabricate WBGT, AQI, hospital capacity, pharmacy stock, evacuation time, or similar live values.
- The selected-country inspector must expose climate/environment, medical access, security/access, travel-health context, escalation/evacuation, watch items, medical-access tier, and source/review date.

## Medical-condition × deployment-context requirement

The recovered requirement explicitly asked the country profile to interact with medical-condition context. The canonical examples are:

- diabetes + insulin + remote deployment / refrigeration limitations → medication-storage/access review consideration
- asthma + dust / poor air quality → respiratory-exacerbation review consideration
- seizure disorder + remote location / limited emergency care → emergency-access review consideration
- cardiac history + extreme heat / heavy exertion → cardiovascular review consideration
- sleep apnea + unreliable power / CPAP access → treatment-continuity review consideration

### Current finding

**REQUESTED BUT MISSING.** AOR currently has no shared case/condition context and no deterministic country-factor interaction layer.

### Required implementation boundary

Implement an **optional, non-persistent reviewer condition lens** inside AOR unless an already-existing authenticated/shared reviewer-context API is discovered during implementation. It may accept condition/medication/context terms and return transparent, source-linked **review considerations**, never clearance decisions, diagnoses, causation claims, or a composite danger score.

The first implementation must be rule/evidence based and limited to recovered explicit interactions plus clearly equivalent aliases. Do not invent clinical thresholds.

## Map-first interaction requirements

The recovered design direction remains binding:

- dominant continuous geospatial canvas
- country/AOR selection through the map
- outbreak, travel-health, disaster/hazard, seismic/environmental intelligence
- infrastructure/medical context where legitimately available
- contextual country inspector
- map-linked evidence
- geographic drilldown
- meaningful layer controls
- no search required to understand current AOR conditions
- motion only where it communicates geographic/state change
- do not spray glow, particles, cards, or decorative effects everywhere

### Globe-specific boundary

PR #198 may change AOR to a 3D globe default, but it must not delete or hide retained data capabilities. No custom shaders are required. The separate visual orb remains pending an actual selected asset/component.

## Completion-run implementation targets

### P0 — wire the missing country baseline

1. Convert the authoritative `Map_Import` sheet to a reviewed source-controlled data module containing all 197 profiles.
2. Add a server endpoint for exact ISO2 profile lookup and optional full profile collection for map/inspector use.
3. Return provenance fields including source name, profile review date, baseline/live distinction, and dataset coverage.
4. Load the profile with every selected country.
5. Add country-baseline context to the selected-country inspector without replacing live source sections.

### P0 — data-backed factor state

1. Derive conservative country baseline flags only from explicit dataset text/watch items.
2. Auto-surface heat/cold/altitude/dust/air-access/remote-care/evacuation/watch signals where the dataset actually supports them.
3. Keep fatigue/PPE/night manual.
4. Preserve manual reviewer override/selection separately from baseline evidence.
5. Show the evidence text that caused each baseline signal; never infer an unsupported numeric value.

### P1 — condition lens

1. Add optional condition/medication/context inputs or reuse an existing safe reviewer-context API if one is already present.
2. Implement transparent rule matches for the recovered interaction examples.
3. Every match must identify the country factor(s) and condition/context term(s) that triggered it.
4. Label output as reviewer consideration, not determination.
5. Keep this transient unless an existing authenticated persistence model already owns case context.

### P1 — priority integration

Feed country baseline access/evacuation/watch signals into the existing country inspector/priority surface as separately labeled baseline evidence. Do not merge them mathematically with WHO, CDC, GDACS, USGS, or CrisisWatch.

## Guardrails for the completion run

- Preserve all merged AOR health/surveillance work from PRs #185–#194.
- Preserve strict selected-country isolation; never substitute unrelated global/AOR records.
- Preserve MapTiler as the AOR engine and the Defense map boundary.
- Preserve historical/live/modelled distinctions.
- Preserve source dates, links, freshness/cache state, and limitations.
- No composite danger score.
- No fabricated live environmental measurements.
- No ACLED, ReliefWeb, Healthsites, FIRMS, UCDP, or CFR restoration.
- Do not duplicate the open PR #197 geospatial-resolver work.
- Do not add the pending visual orb during the data-completion run.
- No unrelated workspace redesign.

## Acceptance definition

The AOR replacement is not complete until a selected country on the MapTiler globe can drive, on one operating picture:

1. the authoritative 197-country baseline profile;
2. retained State/WHO/GDACS/USGS/CrisisWatch/CDC live intelligence;
3. retained historical epidemic/Yellow Book/surveillance/program layers;
4. clearly separated country-baseline versus reviewer-entered work factors;
5. medical-access / evacuation / security / travel-health baseline context;
6. optional condition-context review interactions;
7. source provenance and limitations for every non-live baseline signal;
8. the existing 2D fallback without loss of data or controls.

Anything older that conflicts with the explicit removed/superseded list is not to be restored.