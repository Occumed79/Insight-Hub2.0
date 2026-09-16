# AOR requirements recovery — 2026-09-15

## Purpose

This document is the recovery ledger for the Insight Hub 2.0 **AOR Factors** workspace before any completion run is allowed to call the new globe a replacement. It reconciles retrievable prior conversation exports, user-provided AOR datasets, merged GitHub decisions, later AOR health work, and the current production code.

The rule is chronological: **later explicit user decisions override earlier proposals**. A source that was once discussed but later removed is not a missing feature.

## Completion status — 2026-09-16

The focused recovery implementation is now complete on PR #198. The previously missing 197-country baseline is source-controlled and wired to the selected-country AOR flow; baseline factors are evidence-backed and kept separate from reviewer-entered work conditions; the transient medical-condition × deployment-context lens is implemented; the MapTiler AOR surface defaults to 3D globe with a retained 2D fallback; `MAP_TILER_API_KEY_6` is preferred; MapTiler's built-in halo is disabled; and no synthetic CSS orb or custom shader was introduced. Existing State/WHO/GDACS/USGS/CrisisWatch/CDC and AOR health/surveillance capabilities remain in place. The user-approved transparent particle-shell image is now implemented as the separate click-through outer orb overlay.

## Product boundary

AOR Factors is a **MapTiler health/risk operating picture**, not the Defense War Map. The map is the application: country/AOR selection, map-linked evidence, meaningful layers, geographic focus, contextual country intelligence, and in-map/edge-drawer controls should dominate. Do not convert it back into a card dashboard.

The current globe work must preserve all valid AOR intelligence while changing only the map projection/surface. `MAP_TILER_API_KEY_6` is the dedicated preferred AOR key on the globe branch. MapTiler's built-in halo stays disabled. The approved outer shell is a separate visual layer above the real MapTiler globe, not part of MapTiler's atmosphere or renderer.

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

### Recovery finding

The dataset existed but was not wired into AOR before this focused recovery run.

### Completion state

**IMPLEMENTED + VERIFIED.** All 197 reviewed profiles are now available to the AOR backend and selected-country inspector by exact ISO2 lookup, with provenance, review date, baseline/live distinction, and fail-closed behavior.

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

### Recovery finding

The pre-recovery AOR UI had manual work-condition buttons for heat, cold, altitude, poor air, fatigue, PPE burden, and night/circadian disruption, while the country baseline fields were not connected to those controls.

### Completion state

**IMPLEMENTED + VERIFIED.** Explicit country-profile evidence now produces separately labeled baseline signals such as heat, cold, altitude, dust/air, remote care, specialty access, evacuation, medication continuity, severe weather, seismic exposure, vector exposure, and food/water exposure. Reviewer-entered work factors remain independent and are never silently auto-selected from baseline data.

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

### Recovery finding

The pre-recovery AOR had no shared condition-context interaction layer.

### Completion state

**IMPLEMENTED + VERIFIED.** A transient, non-persistent condition/medication/work-context lens now evaluates the recovered explicit interactions against country evidence and returns evidence-linked **review considerations** only. It does not issue diagnoses, clearance decisions, fit/unfit determinations, or composite danger scores.

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

PR #198 changes AOR to a 3D globe default while retaining a 2D fallback and existing data capabilities. The approved particle-shell image is implemented as a separate `AorOrbOverlay` above the real globe, with `pointer-events: none`, reduced-motion support, and automatic hide/show on 2D↔3D projection changes. No custom shaders, Three.js renderer, CSS-generated orb, or MapTiler halo is used.

## Guardrails retained after completion

- Preserve all merged AOR health/surveillance work from PRs #185–#194.
- Preserve strict selected-country isolation; never substitute unrelated global/AOR records.
- Preserve MapTiler as the AOR engine and the Defense map boundary.
- Preserve historical/live/modelled distinctions.
- Preserve source dates, links, freshness/cache state, and limitations.
- No composite danger score.
- No fabricated live environmental measurements.
- No ACLED, ReliefWeb, Healthsites, FIRMS, UCDP, or CFR restoration.
- Do not duplicate the open PR #197 geospatial-resolver work.
- Keep the approved orb isolated from the MapTiler renderer and non-interactive so map gestures/clicks remain owned by MapTiler.
- No unrelated workspace redesign.

## Acceptance definition

The recovery implementation is complete when a selected country on the MapTiler globe can drive, on one operating picture:

1. the authoritative 197-country baseline profile;
2. retained State/WHO/GDACS/USGS/CrisisWatch/CDC live intelligence;
3. retained historical epidemic/Yellow Book/surveillance/program layers;
4. clearly separated country-baseline versus reviewer-entered work factors;
5. medical-access / evacuation / security / travel-health baseline context;
6. optional condition-context review interactions;
7. source provenance and limitations for every non-live baseline signal;
8. the existing 2D fallback without loss of data or controls.

All eight items are implemented and browser-tested on PR #198. The approved outer orb is also implemented and kept separate from the functional acceptance criteria so it cannot interfere with map/data behavior. Anything older that conflicts with the explicit removed/superseded list is not to be restored.