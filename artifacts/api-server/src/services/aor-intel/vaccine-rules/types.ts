// Vaccine entry / exit / transit / event-specific rule model for AOR Factors.
//
// A RULE is a legal or quasi-legal statement made by an authority (a destination
// government, WHO under the IHR, or a global compilation). A medical RECOMMENDATION
// (CDC / WHO clinical guidance) is a different object and never becomes a rule here.
// Only fields the source actually supports are populated; everything else stays null
// and is surfaced as "not stated by the source".

export type VaccineName = "Yellow Fever" | "Polio" | "Meningococcal (ACWY)" | "COVID-19";

export type VaccineRuleType = "entry" | "exit" | "transit" | "event-specific";

/**
 * What kind of statement the source makes.
 *  - mandatory: a national requirement stated by the issuing government
 *  - declaration: travelers must declare / may be asked for proof; entry is not refused for lacking it
 *  - removed: the authority explicitly withdraws a previously stated requirement
 *  - who_temporary_recommendation: IHR Emergency Committee temporary recommendation addressed to States
 *    (NOT national law; implementation by each State is a separate fact)
 */
export type LegalForce = "mandatory" | "declaration" | "removed" | "who_temporary_recommendation";

export type AuthorityTier = "destination_government" | "embassy" | "who" | "cdc" | "global_compilation";

export type VerificationStatus =
  | "DESTINATION-GOVERNMENT VERIFIED"
  | "WHO VERIFIED"
  | "CDC CORROBORATED"
  | "EMBASSY VERIFIED"
  | "OLDER GLOBAL BASELINE"
  | "NOT CURRENTLY VERIFIED";

export type TravelerGroup =
  | "all_arriving_travelers"
  | "arrivals_from_listed_countries"
  | "arrivals_from_risk_countries"
  | "pilgrims"
  | "seasonal_workers"
  | "residents_and_long_term_visitors"
  | "residents_departing"
  | "transit_passengers";

/** How the origin condition is defined by the source. */
export type OriginScope =
  | "any_origin"
  | "listed_countries" // the source enumerates the countries (ISO2 in originCountries)
  | "risk_countries_unenumerated" // the source refers to "endemic/risk countries" without listing them
  | "issuing_country_residents"; // applies to people resident in the issuing country

export type TimeUnit = "days" | "weeks" | "months" | "years";
export interface TimeLimit {
  value: number;
  unit: TimeUnit;
  relativeTo: "arrival" | "departure" | "travel";
}

export interface SupportingSource {
  authority: string;
  tier: AuthorityTier;
  url: string;
  note: string;
}

export interface VaccineRule {
  id: string;
  vaccine: VaccineName;
  ruleType: VaccineRuleType;
  legalForce: LegalForce;

  travelerGroup: TravelerGroup;
  originScope: OriginScope;
  /** ISO2 codes of origin / risk countries when the source lists them. */
  originCountries: string[];
  originRiskAreaNote: string | null;
  /** Jurisdiction that issues the rule (ISO2); null for WHO global recommendations. */
  issuingCountry: string | null;
  /** Country being entered (entry / transit / event rules). */
  destinationCountry: string | null;
  /** Destinations an exit rule refers to, when the source lists them. */
  destinationCountries: string[];
  destinationNote: string | null;

  minimumAge: number | null;
  maximumAge: number | null;
  ageUnit: "years" | "months";
  /** True when the source says "older than X" rather than "X and older". */
  minimumAgeExclusive: boolean;

  /** null = the source is silent about transit. */
  transitApplies: boolean | null;
  transitThresholdHours: number | null;
  /** Risk-country exposure look-back window stated by the source (e.g. "visited in the last 6 days"). */
  exposureLookbackDays: number | null;

  residencyApplies: boolean | null;
  longTermVisitorApplies: boolean | null;
  stayDurationThresholdDays: number | null;

  eventType: string | null;
  /** Seasonal documents: the Hijri year the source document was issued for. */
  hijriYear: number | null;
  seasonLabel: string | null;

  vaccineTimingMinimum: TimeLimit | null;
  vaccineTimingMaximum: TimeLimit | null;
  /** Verbatim or near-verbatim statement of timing / dose detail that the numeric fields cannot carry. */
  vaccineDetail: string | null;

  certificateRequired: boolean | null;
  certificateType: string | null;
  certificateValidity: string | null;
  exemptions: string[];

  validFrom: string | null;
  validUntil: string | null;

  sourceAuthority: string;
  authorityTier: AuthorityTier;
  sourceUrl: string;
  sourcePublishedAt: string | null;
  /** Date the page text was captured for this rule. */
  retrievedAt: string;
  /** Date the rule text was read against its authority; null for baseline copies that were never re-verified. */
  lastVerifiedAt: string | null;
  revalidateAfterDays: number;
  supportingSources: SupportingSource[];

  normalizedRule: string;
  verificationStatus: VerificationStatus;
  /** What the source does NOT state, and any caution about how the text was captured. */
  notes: string[];
  /** Set when the rule must be re-read from the live government page before operational use. */
  productionVerificationRequired: boolean;
}

export type ConflictKind = "rule_withdrawn" | "scope_differs" | "field_differs" | "field_unstated_by_authority";

export interface RuleConflict {
  id: string;
  kind: ConflictKind;
  /** "conflict" = the two sources contradict; "difference" = the authority is silent where the baseline speaks. */
  severity: "conflict" | "difference";
  effectiveRuleId: string;
  supersededRuleId: string;
  summary: string;
  effective: { authority: string; sourceUrl: string; publishedAt: string | null; statement: string };
  superseded: { authority: string; sourceUrl: string; publishedAt: string | null; statement: string };
}

export interface ResolvedRules {
  effective: VaccineRule[];
  superseded: VaccineRule[];
  conflicts: RuleConflict[];
}

export interface TravelerQuery {
  destination: string;
  /** Country the traveler is arriving from (departure point of the final leg). */
  arrivingFrom?: string | null;
  /** Other countries visited within the exposure look-back window. */
  visitedCountries?: string[];
  transit?: Array<{ country: string; hours: number }>;
  /** Country of residence / the country the traveler is leaving (for exit rules). */
  residentOf?: string | null;
  departingFrom?: string | null;
  ageYears?: number | null;
  stayDays?: number | null;
  event?: string | null;
  /** True for seasonal workers in Hajj areas (distinct from pilgrims). */
  seasonalWorker?: boolean;
  now?: Date;
}

export type Applicability = "applies" | "does_not_apply" | "removed" | "unknown";

export interface RuleEvaluation {
  rule: VaccineRule;
  applicability: Applicability;
  reasons: string[];
  missingInputs: string[];
}

export interface CountryRuleAnswers {
  iso2: string;
  /** Does any verified source require / ask for a vaccine at this destination? */
  anyVerifiedRequirement: "yes" | "no_verified_requirement" | "removed" | "not_verified";
  yellowFever: {
    status: "universal" | "origin_based" | "declaration_only" | "removed" | "not_verified";
    universal: boolean | null;
    originBased: boolean | null;
    transitTriggers: boolean | null;
    transitThresholdHours: number | null;
    proofViaICVP: boolean | null;
    ageThreshold: string | null;
    exemptions: string[];
  };
  polio: { entryRules: number; exitRules: number; whoTemporaryRecommendations: number; summary: string };
  eventSpecific: Array<{ vaccine: string; eventType: string; ruleId: string; seasonLabel: string | null; seasonStale: boolean }>;
  authorities: Array<{ authority: string; sourceUrl: string; publishedAt: string | null; verificationStatus: VerificationStatus }>;
  lastVerifiedAt: string | null;
  conflicts: RuleConflict[];
}
