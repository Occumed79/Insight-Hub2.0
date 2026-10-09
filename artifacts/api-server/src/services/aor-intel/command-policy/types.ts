// U.S. Geographic Combatant Command (GCC) medical / Force Health Protection policy model for AOR Factors.
//
// RULE CLASS: "combatant_command". This is a different object from
//   - host-nation entry / exit / transit law (vaccine-rules/, authority = the destination government), and
//   - CDC / WHO travel-health recommendations (evidence from the CDC/WHO adapters).
// Nothing in this folder reads from or writes to either of those, and the evidence records built from it carry
// ruleClass = "combatant_command" so nothing downstream can fold them together.

import type { CommandId } from "./assignments-rows";
export type { CommandId };

export const SOURCE_GAP = "SOURCE_GAP" as const;

export type PolicyVerificationStatus =
  | "COMMAND PUBLICATION (PACK-EXTRACTED)" // read from the command's own publication by the extraction pack
  | "COMMAND PUBLICATION — UNDER REWRITE" // the command says the framework is being rewritten
  | "COMMAND PUBLICATION — SUPERSEDED" // an explicitly established newer document replaced it
  | "NOT PUBLICLY VERIFIED"; // no current public command-wide policy located; nothing is borrowed from another command

export type AssignmentBasis =
  | "official_list" // the command's public page enumerates the countries
  | "official_count_normalized_list" // the command states the count / scope; the list is normalized from it
  | "official_boundary_statement"; // AOR page describes geography including territories

export type AssignmentVerification =
  | "PUBLIC-SOURCE BASELINE"
  | "PUBLIC-SOURCE BASELINE — LIVE VERIFY"; // count is official but no one-page enumeration was retrieved

export interface CountryAorAssignment {
  iso3: string;
  name: string;
  command: CommandId;
  /** "sovereign" is counted in the command's public count; "entity" is a territory / geographic entity listed separately. */
  entityType: "sovereign" | "entity";
  basis: AssignmentBasis;
  verification: AssignmentVerification;
  sourceAuthority: string;
  sourceUrl: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  /** The assignment this one replaced (assignment-history record), if the pack establishes one. */
  supersedesCommand: CommandId | null;
  note: string | null;
}

export type Population =
  | "us_military"
  | "dod_civilian"
  | "dod_contractor"
  | "dependent"
  | "volunteer"
  | "interagency"
  | "tcn"
  | "local_national"
  | "working_dog";

export type TravelKind = "official_tdy_deployment" | "pcs" | "leisure" | "contingency";

/** deployable | waiver-required | non-waivable | conditional — as defined by the pack's data model. */
export type PolicyStatus = "deployable" | "waiver-required" | "non-waivable" | "conditional";

export type PolicyDomain =
  | "applicability"
  | "deployment_definition"
  | "fitness"
  | "condition"
  | "medication"
  | "immunization_prophylaxis"
  | "waiver"
  | "documentation"
  | "duration"
  | "cbrn"
  | "pcs"
  | "clearance" // theater / country clearance workflow — separate from medical suitability
  | "supplement"
  | "guidance";

/** requirement = command-issued mandatory; recommendation = command FHP guidance; process = routing / workflow. */
export type CommandRuleKind = "requirement" | "recommendation" | "process";

export interface RuleScope {
  level: "command" | "component" | "country";
  /** Sub-theater / component or JTF name for component and country scoped rules. */
  component: string | null;
  /** ISO3 list for country scoped rules. */
  countries: string[];
}

export interface StayThreshold {
  days: number;
  /** true: "at least N days" ; false: "more than N days". */
  inclusive: boolean;
  basis: string;
}

export interface CommandPolicyRule {
  id: string;
  policyId: string;
  domain: PolicyDomain;
  kind: CommandRuleKind;
  scope: RuleScope;
  /** Populations the source names; an empty list means the source names none for this rule. */
  applicabilityPopulation: Population[];
  populationText: string;
  /** Populations the rule reaches only when the command or contract directs it (e.g. "selected contractors as directed"). */
  directedPopulations: Population[];
  /** Only populated when the source states a duration trigger. */
  minimumStay: StayThreshold | null;
  /** Rule applies to PCS (permanent change of station) personnel only. */
  pcsOnly: boolean;
  /** Rule applies only when the traveler is going to a named contingency operation. */
  contingencyOnly: boolean;
  /** Destinations (ISO3) the source names as exempt from a command-wide rule, and the condition attached to that exemption. */
  exemptCountries: string[];
  exemptionCondition: string | null;
  /** Maximum stay (days) the rule covers, e.g. "visits under 30 days". */
  maximumStayDaysExclusive: number | null;

  title: string;
  conditionOrRequirement: string;
  thresholdOrRule: string | null;
  status: PolicyStatus | null;
  waiverAuthority: string | null;
  requiredEvaluation: string | null;
  requiredDocumentation: string | null;
  medicationOrEquipmentRule: string | null;
  immunizationOrProphylaxisRule: string | null;

  sourceSection: string;
  sourceUrl: string;
  sourceDate: string | null;
  verificationStatus: PolicyVerificationStatus;
  /** Fields that exist in the source document but were not extracted into the pack. Open the source only if a feature needs one. */
  sourceGaps: string[];
  caveats: string[];
}

export interface CommandPolicy {
  policyId: string;
  command: CommandId;
  policyTitle: string;
  issuingAuthority: string;
  sourceUrl: string;
  additionalSources: Array<{ title: string; url: string }>;
  sourceDate: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  supersedesPolicyId: string | null;
  supersededByPolicyId: string | null;
  publicStatus: string;
  verificationStatus: PolicyVerificationStatus;
  lastRetrievedAt: string;
  /** Present when the command has no located public command-wide medical policy. */
  commandMedicalPolicyStatus: "PUBLISHED" | "NOT_PUBLICLY_VERIFIED";
  caveats: string[];
}

export interface CommandQuery {
  /** Destination country (ISO3). */
  iso3: string;
  population?: Population | null;
  /** Expected / actual in-country days, excluding transit time where the policy says so. */
  stayDays?: number | null;
  travelKind?: TravelKind | null;
  /** Component / sub-theater the traveler is supported by (e.g. "USAREUR-AF", "PACAF", "CJTF-HOA"). */
  component?: string | null;
  /** Whether the itinerary includes a layover in a yellow fever endemic country (AFRICOM YF exemptions depend on it). */
  layoverInYfEndemicCountry?: boolean | null;
  now?: Date;
}

export type CommandApplicability = "applies" | "does_not_apply" | "unknown";

export interface CommandRuleEvaluation {
  rule: CommandPolicyRule;
  applicability: CommandApplicability;
  reasons: string[];
  missingInputs: string[];
}

export interface CountryCommandResolution {
  iso3: string;
  assigned: boolean;
  command: CommandId | null;
  assignment: CountryAorAssignment | null;
  /** Previous assignments the registry preserves (never overwritten). */
  history: CountryAorAssignment[];
  policy: CommandPolicy | null;
  supersededPolicies: CommandPolicy[];
  commandMedicalPolicyStatus: "PUBLISHED" | "NOT_PUBLICLY_VERIFIED" | "COMMAND_NOT_ASSIGNED";
  /** Command-wide rules, then component / country supplements layered on top (inheritance order). */
  rules: CommandPolicyRule[];
  note: string | null;
}
