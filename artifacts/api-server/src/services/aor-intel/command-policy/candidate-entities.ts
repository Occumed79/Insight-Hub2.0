// Candidate entities: places that MIGHT belong to a command's declared-but-unnamed entity count, held APART from the
// authoritative registry. Nothing here is an assignment. These records are not in CURRENT_ASSIGNMENTS, are not returned by
// assignmentFor(), are not in the audit totals, and are never used to build evidence. A candidate is promoted only when an
// authoritative command source identifies the specific place.
//
// SOUTHCOM officially states 31 countries and 12 dependencies and areas of special sovereignty and names none of the 12.
// The classes below are the ones the State Department reference itself states, not a flattened "dependency". A place whose
// class wording was not read is recorded with referenceClass "candidate_unverified".

import type { CandidateEntity } from "./types";

const STATE = "https://www.state.gov/dependencies-and-areas-of-special-sovereignty/";
const WHY = "SOUTHCOM declares 12 dependencies and areas of special sovereignty and names none. This place is on the State Department list of non-U.S. entries in the Caribbean / South Atlantic, which does not assign places to commands. Candidate only: no authoritative source identifies it for SOUTHCOM.";

const RAW: Array<Pick<CandidateEntity, "iso3" | "name" | "referenceClass" | "referenceClassBasis" | "referenceSovereign">> = [
  { iso3: "AIA", name: "Anguilla", referenceClass: "candidate_unverified", referenceClassBasis: "Class wording not read for this place.", referenceSovereign: "United Kingdom (per the State list; not re-read in this pass)" },
  { iso3: "ABW", name: "Aruba", referenceClass: "autonomous_country", referenceClassBasis: "State list entry reads 'Country of Aruba', sovereignty Netherlands.", referenceSovereign: "Netherlands" },
  { iso3: "VGB", name: "British Virgin Islands", referenceClass: "candidate_unverified", referenceClassBasis: "Class wording not read for this place.", referenceSovereign: "United Kingdom (per the State list; not re-read in this pass)" },
  { iso3: "CYM", name: "Cayman Islands", referenceClass: "candidate_unverified", referenceClassBasis: "Class wording not read for this place.", referenceSovereign: "United Kingdom (per the State list; not re-read in this pass)" },
  { iso3: "CUW", name: "Curaçao", referenceClass: "autonomous_country", referenceClassBasis: "State list entry reads 'Country of Curaçao'; its note says it became an autonomous territory of the Kingdom of the Netherlands.", referenceSovereign: "Netherlands" },
  { iso3: "FLK", name: "Falkland Islands", referenceClass: "candidate_unverified", referenceClassBasis: "Class wording not read for this place.", referenceSovereign: "United Kingdom (per the State list; not re-read in this pass)" },
  { iso3: "GUF", name: "French Guiana", referenceClass: "overseas_department", referenceClassBasis: "The State Department note says French Guiana is a first-order administrative division of overseas France, included on the list only for convenience. It is not a dependency.", referenceSovereign: "France" },
  { iso3: "MSR", name: "Montserrat", referenceClass: "candidate_unverified", referenceClassBasis: "Class wording not read for this place.", referenceSovereign: "United Kingdom (per the State list; not re-read in this pass)" },
  { iso3: "BLM", name: "Saint Barthélemy", referenceClass: "candidate_unverified", referenceClassBasis: "State list entry reads 'Saint Barthelemy', sovereignty France, with no class note, so no finer class is asserted.", referenceSovereign: "France" },
  { iso3: "MAF", name: "Saint Martin", referenceClass: "collectivity", referenceClassBasis: "State note: the northern three-fifths of the island form the French collectivity of Saint-Martin.", referenceSovereign: "France" },
  { iso3: "SXM", name: "Sint Maarten", referenceClass: "autonomous_country", referenceClassBasis: "State list entry reads 'Country of Sint Maarten'; its note says it became an autonomous territory of the Kingdom of the Netherlands.", referenceSovereign: "Netherlands" },
  { iso3: "TCA", name: "Turks and Caicos Islands", referenceClass: "candidate_unverified", referenceClassBasis: "Class wording not read for this place.", referenceSovereign: "United Kingdom (per the State list; not re-read in this pass)" },
];

export const CANDIDATE_ENTITIES: readonly CandidateEntity[] = RAW.map((entry) => ({
  ...entry,
  candidateForCommand: "SOUTHCOM" as const,
  geographicClass: "candidate_unverified" as const,
  status: "LIVE_VERIFY" as const,
  isOfficialAssignment: false as const,
  reason: WHY,
  referenceUrl: STATE,
}));

export const CANDIDATE_NOTICE = "Candidate / LIVE VERIFY only. Not an official assignment. No authoritative source identifies these places for SOUTHCOM.";
