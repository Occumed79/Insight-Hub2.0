# AOR Factor Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute this plan task-by-task. Follow test-driven-development for every behavior change and verification-before-completion before claiming success.

## Goal

Complete the retained/missing AOR Factors requirements recovered on 2026-09-15 without restoring explicitly removed sources or changing unrelated Insight Hub 2.0 workspaces. The MapTiler globe remains the map engine; the separate orb is intentionally out of scope for this run.

## Architecture

Add a source-controlled baseline-country dataset derived exactly from the user-supplied `AOR_Global_Country_Profiles_MapTiler.xlsx` `Map_Import` sheet. Expose that dataset through a narrow AOR API and keep the baseline/live distinction explicit. Extend the existing AOR country selection flow to fetch the baseline profile alongside current live sources. Derive conservative baseline factor flags only from explicit profile text. Add an optional transient medical-condition lens that produces transparent reviewer considerations from recovered explicit rule interactions; it must not generate clearance decisions or composite risk scores.

## Tech stack

- TypeScript / React 19
- Express API server
- MapTiler SDK 4.x / MapLibre runtime
- Node `node:test`
- Playwright browser acceptance
- Existing pnpm workspace / GitHub Actions build check

## Specification source

Canonical recovery ledger: `docs/aor-requirements-recovery-2026-09-15.md`.

## Global constraints

- Do not restore ReliefWeb, Healthsites, NASA FIRMS, UCDP, CFR, or ACLED.
- CrisisWatch remains the conflict-context source.
- Do not add GDELT, OFAC, CISA KEV, or WHO GHO in this run.
- Do not duplicate the open PR #197 geospatial-resolver work.
- Do not add the pending visual orb.
- Do not create custom shaders.
- Do not fabricate live WBGT, AQI, hospital capacity, pharmacy inventory, or evacuation times.
- Do not collapse live, historical, modelled, and baseline sources into one score.
- Preserve strict selected-country isolation.
- Preserve all AOR health/surveillance layers merged through PR #194.
- Preserve 2D fallback and all existing country/AOR controls.
- Preserve Defense/AOR map separation.
- No unrelated UI redesign.

## Task 1 — Add tests that prove the recovered country baseline is currently missing

**Files:**
- Modify: `artifacts/api-server/src/services/__tests__/aor-regressions.test.ts`
- Create: `artifacts/api-server/src/services/__tests__/aor-country-profiles.test.ts`

**RED assertions:**

- `AOR_COUNTRY_PROFILES` contains exactly 197 profiles.
- ISO2 lookup resolves representative records including `AF`, `KW`, `PL`, `DE`, `TW`, `XK`.
- Missing/invalid ISO2 fails closed instead of fuzzy-substituting another country.
- Afghanistan/Kuwait/Poland baseline records preserve exact source fields from the user spreadsheet.
- baseline signal derivation finds explicit heat/dust/altitude/cold/remote-care/evacuation signals only when source text supports them.
- source provenance is `AOR_Global_Country_Profiles_MapTiler.xlsx`, reviewed `2026-08-10`, type `baseline`.
- route registration exists ahead of broad fallback AOR routers.

Run the test and confirm it fails because the data module/route does not yet exist.

## Task 2 — Add the authoritative 197-country data module

**Files:**
- Create: `artifacts/api-server/src/data/aor-country-profiles.ts`

**Source:**
- User-supplied workbook `AOR_Global_Country_Profiles_MapTiler.xlsx`
- Sheet: `Map_Import`
- Rows: 197 country profiles + header

**Required exported interfaces/functions:**

```ts
export type AorCountryProfile = {
  profileId: string;
  country: string;
  iso2: string;
  iso3: string;
  mapTilerIsoA2: string;
  aorRegion: string;
  unSubregion: string;
  capital: string;
  latitude: number | null;
  longitude: number | null;
  climateEnvironment: string;
  medicalAccess: string;
  securityAccess: string;
  travelHealthContext: string;
  escalationEvacuation: string;
  reviewWatchItems: string[];
  medicalAccessTier: string;
  legacyBuiltIn: boolean;
  liveAdvisoryRequired: boolean;
};

export const AOR_COUNTRY_PROFILE_SOURCE = {
  name: "AOR_Global_Country_Profiles_MapTiler.xlsx",
  reviewedAt: "2026-08-10",
  profileType: "baseline" as const,
  coverage: 197,
};

export function getAorCountryProfileByIso2(iso2: string): AorCountryProfile | null;
```

**Rules:**
- Preserve source text exactly apart from column-name normalization and `review_watch_items` split on semicolons.
- Do not enrich the dataset with guessed facts.
- Do not turn representative coordinates into facility/site coordinates.

Run unit tests until dataset/lookup tests pass.

## Task 3 — Add conservative baseline-signal derivation and condition-lens logic

**Files:**
- Create: `artifacts/api-server/src/services/aor-country-factor-service.ts`
- Modify: `artifacts/api-server/src/services/__tests__/aor-country-profiles.test.ts`

**Required API:**

```ts
export type AorBaselineSignalKey =
  | "heat"
  | "cold"
  | "humidity"
  | "altitude"
  | "dustAir"
  | "vector"
  | "foodWater"
  | "severeWeather"
  | "seismic"
  | "remoteCare"
  | "specialtyAccess"
  | "evacuation"
  | "medicationContinuity"
  | "securityAccess";

export function deriveAorBaselineSignals(profile: AorCountryProfile): AorBaselineSignal[];

export function evaluateDeploymentConditionLens(input: {
  profile: AorCountryProfile;
  condition?: string;
  medication?: string;
  workContext?: string;
}): AorConditionConsideration[];
```

**Signal rule constraints:**
- Match only explicit words/phrases from `climateEnvironment`, `medicalAccess`, `securityAccess`, `travelHealthContext`, `escalationEvacuation`, and `reviewWatchItems`.
- Every signal returns `evidenceField` and `evidenceText`.
- No numeric environmental values are invented.

**Condition-lens rules required by recovered user examples:**
- diabetes/insulin + remote/evacuation/medication-storage context
- asthma + dust/poor-air context
- seizure/epilepsy + remote/limited-emergency-care context
- cardiac/cardiovascular history + heat context; heavy exertion only if work context says it
- OSA/sleep apnea/CPAP + power/treatment-continuity context; never assume unreliable power from country alone unless source text explicitly supports continuity/access concern

**Output boundary:** reviewer consideration only; no fit/unfit/clearance result.

Run the unit tests and confirm all rule/evidence cases pass.

## Task 4 — Expose the baseline through a narrow AOR route

**Files:**
- Create: `artifacts/api-server/src/routes/aor-country-profiles.ts`
- Modify: `artifacts/api-server/src/routes/index.ts`
- Modify: `artifacts/api-server/src/services/__tests__/aor-regressions.test.ts`

**Endpoints:**

```text
GET /api/aor/country-profile?iso2=KW
GET /api/aor/country-profiles
POST /api/aor/country-condition-lens
```

**Country-profile response:**
- `ok`
- `profile`
- `baselineSignals`
- `source` with dataset name/reviewedAt/profileType/coverage
- `limitation`: baseline reviewer orientation, not live advisory/environmental measurement

**Collection response:**
- may return all 197 baseline profiles and lightweight signals for map/lookup use
- no secrets and no upstream call

**Condition-lens request:**
- ISO2 required
- condition/medication/workContext bounded strings
- no persistence
- response returns matched considerations and the exact baseline evidence used

**Failures:**
- 400 invalid ISO2/input
- 404 unknown profile
- no fuzzy substitution

Run API/unit tests.

## Task 5 — Add baseline profile to the selected-country AOR data flow

**Files:**
- Modify: `artifacts/occu-med-insight-hub/src/pages/reviewer-aor-factors-v3.tsx`

**Frontend types:**
- add `baseline` to `CountrySources` or a dedicated typed `countryBaseline` state
- type profile/source/signals/condition considerations explicitly enough to avoid `any` propagation for new data

**Selection behavior:**
- on selected country, fetch `/api/aor/country-profile?iso2=<selectedCountry.iso2>` alongside existing State/WHO/GDACS/USGS/CrisisWatch/CDC requests
- clear profile on country clear
- never block live sources if baseline lookup fails

**Inspector behavior:**
Add a country-baseline section containing:
- AOR region / subregion
- climate/environment
- medical access + tier
- security/access
- travel-health context
- escalation/evacuation
- review-watch items
- reviewed date and explicit `Baseline profile — not live` label

Do not replace existing live source sections.

## Task 6 — Make Work Conditions evidence-backed without pretending they are live

**Files:**
- Modify: `artifacts/occu-med-insight-hub/src/pages/reviewer-aor-factors-v3.tsx`

**Behavior:**
- derive visible baseline badges/indicators for `heat`, `cold`, `altitude`, and `poorAir` from baseline signals
- `poorAir` may be supported by explicit dust/air-quality language only; label as baseline environmental context, not AQI
- keep `fatigue`, `ppe`, and `night` fully manual
- reviewer toggles remain independently clickable and are not silently changed by baseline data
- show evidence text/source when a baseline-backed factor is present

This must make the difference visually explicit:

```text
Baseline signal: Heat / dust
Reviewer work factor: PPE burden [selected]
```

Do not auto-select manual factors.

## Task 7 — Add the transient medical-condition lens to the country inspector

**Files:**
- Modify: `artifacts/occu-med-insight-hub/src/pages/reviewer-aor-factors-v3.tsx`

**UI:**
- compact optional condition field
- optional medication field
- optional work-context field
- `Evaluate context` action
- results shown immediately under country baseline context

**Behavior:**
- call `/api/aor/country-condition-lens`
- clear results when selected country changes
- no localStorage/sessionStorage/Neon persistence
- label: `Reviewer consideration — not a determination`
- show the matched country evidence for each consideration

Do not create generic AI-generated medical prose.

## Task 8 — Integrate baseline signals into the priority/context layer without a score

**Files:**
- Modify: `artifacts/occu-med-insight-hub/src/components/insight/AorPriorityBrief.tsx` only if the existing interface supports source-defined items cleanly; otherwise keep this in the country inspector and document why.
- Modify: `artifacts/occu-med-insight-hub/src/pages/reviewer-aor-factors-v3.tsx`

**Rule:**
- medical-access / evacuation / severe-weather / security baseline items may be surfaced as separately labeled `Country baseline` signals
- do not mathematically combine with State/WHO/GDACS/USGS/CrisisWatch/CDC
- priority level must be source-defined or neutral; do not invent severity from text

## Task 9 — Browser acceptance for recovered requirements

**Files:**
- Modify: `artifacts/occu-med-insight-hub/tests/aor-consolidation.spec.ts`

**RED then GREEN scenarios:**

1. Mock `GET /api/aor/country-profile?iso2=KW` with a baseline Kuwait profile containing hot/arid/dust/medical-access context.
2. Select Kuwait through the existing country search/map flow.
3. Assert baseline profile fields render with `Baseline profile — not live` and reviewed date.
4. Assert heat/dust baseline evidence appears without auto-selecting reviewer work-condition buttons.
5. Assert existing CDC/WHO/GDACS/USGS/CrisisWatch sections remain available.
6. Mock condition-lens POST and assert a reviewer consideration renders with evidence and no clearance language.
7. Switch 3D ↔ 2D and confirm baseline/health data remains visible/unchanged.
8. Assert no `aor-holographic-shell` or unapproved orb node appears.

## Task 10 — Repository integrity + full verification

Run, in this order:

```bash
pnpm run audit:repository
pnpm test
pnpm run typecheck
pnpm --filter @workspace/occu-med-insight-hub run build
pnpm --filter @workspace/occu-med-insight-hub exec playwright test tests/aor-consolidation.spec.ts
```

Then run the repository's full configured Build Check / browser acceptance workflow on the exact PR head.

Before declaring completion, inspect the exact PR diff and verify:
- only AOR/data/test/docs scope changed
- no explicitly removed source was restored
- no orb/shader was added
- no Defense map code changed
- the 197-profile dataset count is exact
- source provenance/review date is present
- all tests are green

## Completion output

Update PR #198 body to state exactly what is implemented and what remains pending. The visual orb must remain listed as pending until an actual asset/component is selected and visually approved.