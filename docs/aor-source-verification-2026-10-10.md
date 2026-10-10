# AOR source verification — 10 October 2026

Base: `5a55f33727e5c529695862327f67f683e2cdeb94`, latest `main` confirmed by fetch. Existing vaccine registry and command/theater extraction pack reused; settled CENTCOM/AFRICOM vaccine rules retained. Changes are confined to AOR backend data, provenance, applicability, targeted tests and this report.

## Geographic findings

| Item | Result | Primary source and limitation |
|---|---|---|
| EUCOM 50 | Exact membership verified against all nine command-published geographic groups; NATO tab excluded. Existing ISO3 rows match. | [USEUCOM The Region](https://www.eucom.mil/about/the-region), undated. Full indexed primary text retrieved; direct fetch 403. |
| Taiwan | Explicitly treated in INDOPACOM AOR; remains a separate entity. | [CRS IF12604 v2](https://www.congress.gov/crs_external_products/IF/PDF/IF12604/IF12604.2.pdf), 5 March 2024, page 1. Does not resolve inclusion in the 36-country count. |
| Palestinian Territories | CRS explicitly names West Bank & Gaza in CENTCOM AOR. | [CRS IF11428 v4](https://www.congress.gov/crs_external_products/IF/PDF/IF11428/IF11428.4.pdf), 30 March 2022. Dated entity evidence, not a new country count or effective date. |
| Western Sahara | AFRICOM security-cooperation treatment verified; geographic assignment remains provisional. | [DSCA SAMM C4.T2A](https://samm.dsca.mil/table/table-c4t2a), undated live table. Customer command codes do not establish geographic UCP boundaries. |
| INDOPACOM 36 | Still unresolved: count verified previously, exact current membership not located. | Previous fact sheet/2026 Keystone evidence retained. DSCA named entities captured only as security cooperation; no count-matched geographic reconstruction. |
| SOUTHCOM 12 | Still unresolved: command declares the count without naming the places. | [SOUTHCOM AOR](https://www.southcom.mil/About/Area-of-Responsibility/). Historical 16 retained. DSCA entities cannot substitute for a command geographic enumeration. |

The DSCA source rows remain separate from assignments. In particular, DSCA codes Cuba NO and Greenland EU, whereas command geographic sources place them in SOUTHCOM and NORTHCOM respectively. Geographic command sources control geographic assignments; both scopes are preserved. No SOUTHCOM candidate was promoted. EUCOM territory completeness and exhaustive INDOPACOM entity coverage remain open.

## Medical findings integrated

[USARPAC FHP handbook](https://api.army.mil/e2/c/downloads/2025/12/11/f068780d/fy25-usarpac-force-health-protection-guidance.pdf), 1 March 2025, full 36-page document: 18 component summaries covering scope/duration, risk-based short visits, waiver process/routing, G6PD, TB, HIV/serum timing, vision, dental, Korea JEV, Japan/Korea typhoid, occupational rabies, malaria prescribing, whole-blood donor screening, 90-day prescribed medication supply, individual medical equipment, CPAP/OSA waiver distinction, and Korea CBRN countermeasures.

These are advisory summaries of cited requirements. The handbook expressly disclaims independent authority, cites FY25 parent guidance, and does not establish FY26 compatibility or supersession. All summaries retain source sections, date, retrieval date, component scope, civilian/contractor limitations, applicable duration and unresolved inputs. They are not new theater-wide orders. Hawaii/Alaska/Guam exclusions are preserved; the current country engine can enforce Guam, while Hawaii/Alaska location handling remains outside its country granularity.

Source conflicts retained: both ≥30 and ≤30-day clauses at exactly 30 days; Anthrax section's Jynneos/ACAM2000 product mismatch. The latter is evidence only and never an executable anthrax rule. More stringent subordinate policy remains in force. Effective upon signature/three-year expiry wording is preserved without inventing a signature date.

The official [FY26 INDOPACOM PDF](https://www.pacom.mil/Portals/55/Documents/Surgeon/FY26%20Force%20Health%20Protection%20Guidance%20for%20USINDOPACOM%20AOR.pdf?ver=BeAhcnVciTeRV1jWl1x5BA%3D%3D) indexed header verifies DTG 070905Z Nov 25: issue date 7 November 2025. Effective date remains unknown. Direct PDF download returned 403; complete FY26 thresholds, medical standards, supplements and supersession remain open.

[AFRICOM Theater Medical Clearance](https://www.africom.mil/staff-resources/theater-medical-clearance), indexed primary text: AC Form 42/43, electronic waiver completion/signing and SETAF-AF/Naval Forces Africa/HQ routing contacts integrated. September 2026 screening/counseling library postings remain a version/content gap; posting dates do not establish replacement of June forms.

## Validation

- 77 targeted AOR tests pass, including four new research/applicability/provenance tests.
- Library TypeScript build and all three configured build guards pass.
- API and frontend production package builds pass.
- Full `pnpm run build` is blocked by pre-existing TS2345 errors in unchanged `entityDiscovery.ts` at lines 481 and 491. The same two errors reproduce on the detached base commit. No AOR TypeScript errors reported; unrelated code was not modified.
- No UI or Cesium changes. Retrieval for this follow-up is 10 October 2026; publication, effective and retrieval dates remain separate. Original assignment and gap-ledger evidence is preserved.
