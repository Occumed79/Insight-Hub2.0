// Reviewed reference data for destination vaccination ENTRY REQUIREMENTS (legal rules).
// These are never inferred from CDC/WHO recommendations and are never merged with them.
// Each entry names the compilation it was taken from and the date it was reviewed there.
// Entry rules change without notice: every record tells the reader to confirm with the
// destination authority.

export type EntryRequirementEntry = {
  iso2: string;
  vaccine: string;
  requirementType: "entry_required" | "entry_required_conditional";
  statement: string;
  appliesTo: string;
  sourceName: string;
  sourceUrl: string;
  /** Date the compilation was last reviewed according to the publisher. */
  sourceReviewed: string;
  /** Date this repository copied the entry. */
  recordedAt: string;
};

const YB_YF = {
  sourceName: "CDC Yellow Book 2026, Table 4.21.4 (WHO International Travel and Health Annex 1, list last published Jan 2023)",
  sourceUrl: "https://www.cdc.gov/yellow-book/hcp/travel-associated-infections-diseases/yellow-fever.html",
  sourceReviewed: "2024-09 (table note); chapter reviewed 2025-04-23",
  recordedAt: "2026-10-08",
};

/** Countries that require proof of yellow fever vaccination from ALL arriving travelers (Table 4.21.4). */
export const YF_ALL_ARRIVALS: Record<string, string> = {
  AO: "Angola", BJ: "Benin", BF: "Burkina Faso", BI: "Burundi", CM: "Cameroon", CF: "Central African Republic",
  CG: "Congo, Republic of the", CI: "Côte d'Ivoire", CD: "Democratic Republic of the Congo", GA: "Gabon", GH: "Ghana",
  GN: "Guinea", GW: "Guinea-Bissau", ML: "Mali", NE: "Niger", SL: "Sierra Leone", SS: "South Sudan", TG: "Togo", UG: "Uganda",
  BO: "Bolivia", GF: "French Guiana",
};

export const ENTRY_REQUIREMENTS: EntryRequirementEntry[] = [
  ...Object.keys(YF_ALL_ARRIVALS).map((iso2): EntryRequirementEntry => ({
    iso2,
    vaccine: "Yellow Fever",
    requirementType: "entry_required",
    statement: `${YF_ALL_ARRIVALS[iso2]} is listed as requiring proof of yellow fever vaccination from all arriving travelers.`,
    appliesTo: "All arriving travelers (age thresholds may apply; confirm with the destination authority).",
    ...YB_YF,
  })),
  {
    iso2: "SA",
    vaccine: "Meningococcal (quadrivalent ACWY)",
    requirementType: "entry_required_conditional",
    statement: "Saudi Arabia requires proof of quadrivalent (A, C, W, Y) meningococcal vaccination for travelers ≥1 year of age making the Umrah or Hajj pilgrimage. Timing: ≥10 days and ≤3 years before arrival for polysaccharide vaccine (MPSV4, no longer available in the United States); ≤5 years before arrival for conjugate vaccine.",
    appliesTo: "Umrah and Hajj pilgrims only. This is not a general entry requirement for other travel purposes.",
    sourceName: "CDC Yellow Book 2026, Meningococcal Disease chapter",
    sourceUrl: "https://www.cdc.gov/yellow-book/hcp/travel-associated-infections-diseases/meningococcal-disease.html",
    sourceReviewed: "2025-04-23",
    recordedAt: "2026-10-08",
  },
];

export const ENTRY_COMPILATION_NOTE =
  "Compiled lists are secondary to the destination government. Requirements that depend on prior travel or transit (for example yellow fever for travelers arriving from risk countries), polio departure rules under IHR temporary recommendations, and rules for other vaccines are not covered by this list.";
