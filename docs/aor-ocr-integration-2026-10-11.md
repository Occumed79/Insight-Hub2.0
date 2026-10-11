# AOR medical source integration — 11 October 2026

Started from main at `31932a0f22bb7929b23ba70f0331f543dbb3338f`. Uses the existing extraction pack, vaccine registry and prior verified research; no UI, Cesium or unrelated changes.

Nine supplied OCR files are fingerprinted by SHA256, bytes and line count. Fourteen distinct document snapshots preserve exact OCR text and original upload line ranges. Duplicate documents are not promoted into independent authority. Sixty-nine normalized rules carry OCR provenance; placeholders retain their previous extracted observations.

## Integrated findings

- INDOPACOM P-25-0295 FY26 full-text applicability, ≥30-day operational travel, paragraph 9 deployment ≥30 versus other travel ≥45 days, short high-risk/live-fire blood-donor screening, civilian/CAAF exceptions, waiver criteria and seven component routing contacts, routine/risk vaccines, malaria selection and medication/equipment supply. Explicit cancellation of FY25 reference AE retained; issue date does not establish an independent effective date.
- EUCOM signed ECI 4202.01A of 24 July 2025 cancels the 3 July 2019 instruction. Dated instruction is stronger than stale public landing-page/pack version wording, which is retained. Baseline fitness, condition-specific OSA, screening, medication/storage, immunization and deployment-assessment details added. Interim memo of 2 March 2026 supersedes required TBE wording with exposure-based highly recommended wording; future-instruction number discrepancy retained.
- USFK base FHP instruction of 20 August 2024, IMR instruction of 30 September 2022 and air-quality instruction of 3 February 2023: medication supplies, CBRN quantities, risk-directed Korea malaria, vaccination, TB/LTBI, OSA, AQI mitigation and unit-readiness metrics. Parent FY26's newer two-dose anthrax minimum is distinguished from base USFK one-dose wording; smallpox availability exception also preserved. Unit readiness percentages are not individual clearance thresholds.
- AFRICOM July 2025 malaria first-line agents, chloroquine exclusion, G6PD restrictions, conditional terminal prophylaxis, pregnancy restrictions and return-course supplies; dated chikungunya destination recommendations and mpox isolation/contact provisions; June 2026 AC42 screening form requirements and validity. June form does not establish supersession of September publications.
- FDA's later 22 August 2025 IXCHIQ licensing suspension recorded alongside the earlier AFRICOM product paragraph. Earlier product text is historical, not an executable current vaccine recommendation. This does not cancel the command outbreak framework.
- CENTCOM additional MOD18 Tab A asthma medication/resupply, diabetes exclusion/stability, seizure and chronic-condition stability details. DTG 20 August versus existing package date 19 August conflict retained rather than replacing an effective date.
- SOUTHCOM MOD3 waiver support criteria, contractor screening/document retention and permanent civilian medical-care notice. No CENTCOM standards copied into another command.

Official source URLs, issuing authority, issue/effective dates when supported, retrieval/access date, OCR file hash/ranges, exact wording, applicability and conflicts are available through the existing registry/evidence backend. New official publication locations join the existing source monitor.

## Unresolved

Prior geography results remain intact: exact EUCOM 50-country enumeration verified; dated primary CRS AOR treatment for Taiwan and West Bank/Gaza verified. The supplied medical documents do not supply the missing exact INDOPACOM 36-country enumeration or exhaustive entity list, SOUTHCOM's 12 dependencies, or current geographic AOR treatment for Western Sahara. DSCA Western Sahara security-cooperation assignment remains separate from geographic authority. No count-matched or geographically inferred assignments added.

USFK Change 1 of 21 November 2024 is referenced by FY26 but cannot be verified from the uploaded base instruction. September 2026 AFRICOM forms, damaged FY26 smallpox paragraphs, ambiguous USFK primaquine dose and flattened table columns remain explicit gaps. Current outbreak/incidence conditions require current surveillance, not a frozen historical designation.

## Validation

- 82 targeted AOR tests pass, including provenance/excerpt integrity, duration boundaries, civilian/contractor applicability, cancellations, conflicts and rule-class separation.
- Production package build passes: `pnpm -r --filter './artifacts/**' --filter './scripts' --if-present run build`.
- Root `pnpm run build` and API typecheck stop at pre-existing TS2345 errors in untouched `src/routes/entityDiscovery.ts` lines 481 and 491 (missing entity/location fields). These same baseline errors were already verified before this continuation. No AOR type errors reported. Unrelated code is unchanged.
