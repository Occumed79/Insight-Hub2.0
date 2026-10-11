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
  | "COMMAND PUBLICATION (USER-SUPPLIED OCR)"
  | "COMMAND PUBLICATION (PRIMARY-SOURCE VERIFIED)"
  | "COMMAND PUBLICATION (PACK-EXTRACTED)" // read from the command's own publication by the extraction pack
  | "COMMAND PUBLICATION — UNDER REWRITE" // the command says the framework is being rewritten
  | "COMMAND PUBLICATION — SUPERSEDED" // an explicitly established newer document replaced it
  | "NOT PUBLICLY VERIFIED"; // no current public command-wide policy located; nothing is borrowed from another command

export type AssignmentBasis =
  | "official_list" // the command's public page enumerates the countries
  | "official_count_normalized_list" // the command states the count / scope; the list is normalized from it
  | "official_boundary_statement" // AOR page describes geography including territories
  | "regional_geographic_mapping"; // global directory mapping by geographic footprint; the command does not name the place

export type AssignmentVerification =
  | "PUBLIC-SOURCE BASELINE"
  | "PUBLIC-SOURCE BASELINE — LIVE VERIFY"; // count is official but no one-page enumeration was retrieved

/**
 * Geographic record classes. Only `sovereign_state` counts toward a command's sovereign-state total. A class is recorded only
 * as far as an official source supports it; `candidate_unverified` is never a verified assignment class (see CandidateEntity).
 */
export type GeographicClass =
  | "sovereign_state"
  | "territory"
  | "dependency"
  | "overseas_department"
  | "autonomous_country"
  | "collectivity"
  | "area_of_special_sovereignty"
  | "sovereign_component" // geographic component of a sovereign state that spans more than one AOR (US: contiguous, Alaska, Hawaii)
  | "disputed_entity"
  | "other_entity"
  | "candidate_unverified";

/** Whether official command material itself names a non-sovereign entity. */
export type EntityEvidence = "command_page_names_it" | "primary_us_government_names_it" | "pack_only_not_named_by_command_page" | "directory_geographic_mapping";

/**
 * How well the assignment itself (not the geography) is supported. Kept apart from the assignment so a complete directory is never
 * read as 285 independently verified assignments.
 *  - individually_verified: controlling or official material names this location (or the command's own history/reassignment does).
 *  - official_aggregate_count: the command states a count / scope; the individual membership is normalized from it, not enumerated.
 *  - regional_inference: assigned by geographic footprint; no source names the location.
 *  - provisional: regional inference that the directory itself flags provisional, or a disputed / contested case. Carried into medical-rule evaluation.
 */
export type EvidenceClass = "individually_verified" | "official_aggregate_count" | "regional_inference" | "provisional";

/** 1 = Presidential UCP / official boundary reassignment … 6 = regional geographic inference (the controlling-authority order). */
export type AuthorityTier = 1 | 2 | 3 | 4 | 5 | 6;

export interface ControllingSource {
  authority: string;
  url: string;
  /** ISO date only when the source states one; otherwise null (never inferred). */
  date: string | null;
  tier: AuthorityTier;
}

export interface DirectoryCorrection {
  field: "evidence_class" | "command";
  from: string;
  to: string;
  controllingSource: ControllingSource;
  reason: string;
}

/** Everything the global directory contributes to a record, kept next to the registry fields rather than in a second registry. */
export interface DirectoryDetail {
  recordId: string;
  /** "iso_3166_1" | "workbook_code" (GENC or constituent code as published) | "synthetic" (stable slug; no code is invented). */
  idKind: "iso_3166_1" | "workbook_code" | "synthetic";
  iso2: string | null;
  workbookCode3: string | null;
  parentIso2: string | null;
  parentIso3: string | null;
  /** Parent is one of the three split ISO entities (US, UM, TF): the parent itself has no AOR. */
  splitParent: boolean;
  /** Parent record is a composite ISO entry that is itself a record (SHN, BES, SJM, PSE). */
  compositeParentRecord: boolean;
  categoryLabel: string;
  administering: string | null;
  rosterOrigin: string;
  workbookAor: string;
  workbookAlias: string;
  workbookBasis: string;
  workbookEvidence: string;
  workbookSourceDate: string;
  workbookSourceUrl: string;
  workbookNote: string | null;
  aliases: string[];
  evidenceClass: EvidenceClass;
  authorityTier: AuthorityTier;
  /** True when the directory or the registry marks the assignment provisional / contested. */
  provisional: boolean;
  /** Two applicable sources of the same authority tier disagree and no effective dates order them; the existing assignment is kept and flagged. */
  contested: boolean;
  /** The claim the evidence class and tier above were taken from. Always a claim for THIS record's command, never a displaced one. */
  evidenceBasis: { command: CommandId; label: string; origin: "registry" | "directory" | "repository_evidence"; effectiveDate: string | null; source: ControllingSource };
  /** Sovereignty is disputed or unsettled. Recorded apart from the AOR, which is never "multiple". */
  disputedSovereignty: boolean;
  /** Evidence-class / command corrections applied from stronger controlling sources; the displaced claim is kept here. */
  corrections: DirectoryCorrection[];
  /** Displaced or conflicting claims kept as provenance (not applied). */
  conflictHistory: Array<{ claim: string; source: string; reason: string }>;
}

export interface CountryAorAssignment {
  iso3: string;
  name: string;
  command: CommandId;
  /** "sovereign" is counted in the command's public count; "entity" is a territory / geographic entity listed separately. */
  /** Derived: "sovereign" exactly when geographicClass is sovereign_state. */
  entityType: "sovereign" | "entity";
  geographicClass: GeographicClass;
  /** Why this class was chosen (an official statement or listing), or null for sovereign states. */
  classBasis: string | null;
  /** Non-sovereign records only. */
  entityEvidence: EntityEvidence | null;
  basis: AssignmentBasis;
  verification: AssignmentVerification;
  sourceAuthority: string;
  sourceUrl: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  /** The assignment this one replaced (assignment-history record), if the pack establishes one. */
  supersedesCommand: CommandId | null;
  note: string | null;
  /** Publication date of the specific source for this record, when the source states one. Never inferred from the retrieval date. */
  sourceDate?: string | null;
  /** How old / how well-dated the source is, stated plainly so an older source is not read as current. */
  sourceCurrencyNote?: string | null;
  lastRetrievedAt?: string;
  /** Global directory contribution (identifiers, hierarchy, workbook provenance, evidence class). */
  directory?: DirectoryDetail;
  previousEvidence?: Array<{ sourceAuthority: string; sourceUrl: string; verification: AssignmentVerification; note: string | null }>;
}

/**
 * A place that might belong to a command's AOR but that NO authoritative source identifies for that command. It is not an
 * assignment: it never appears in CURRENT_ASSIGNMENTS, assignmentFor(), the audit totals, or any evidence record.
 */
export interface CandidateEntity {
  iso3: string;
  name: string;
  /** The command whose declared-but-unnamed entity count this place might help fill. */
  candidateForCommand: CommandId;
  geographicClass: "candidate_unverified";
  /** The class the cited reference supports for the place itself, kept so it is not flattened into "dependency". */
  referenceClass: GeographicClass;
  referenceClassBasis: string;
  referenceSovereign: string;
  status: "LIVE_VERIFY";
  isOfficialAssignment: false;
  reason: string;
  referenceUrl: string;
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
  indopacomFY26Scope?: boolean;
  mandatoryVaccinationGroups?: boolean;
  durationProfile?: "indopacom_paragraph9" | "indopacom_blood_donor";
  sourceProvenance?: {access: "user_supplied_ocr"; filename: string; sha256: string; startLine: number; endLine: number; documentId: string};
  previousRuleEvidence?: Array<{conditionOrRequirement: string; sourceDate: string | null; sourceUrl: string; verificationStatus: PolicyVerificationStatus; sourceGaps: string[]; caveats: string[]}>;
  issuingAuthority?: string;
  lastRetrievedAt?: string;
  sourceWording?: string;
  sourceDocumentId?: string;
  officialTravelOnly?: boolean;
  officialTravelIncludesPcs?: boolean;
  unconditionalExemptCountries?: string[];
  applicabilityConditions?: string[];
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
  civilianCategory?: "emergency_essential" | "non_combat_essential" | "expeditionary" | "other" | null;
  contractorAuthorization?: "caaf" | "non_caaf" | null;
  contractRequirementsApply?: boolean | null;
  permanentAssignmentIso3?: string | null;
  onDeploymentOrders?: boolean | null;
  highRiskOrLiveFire?: boolean | null;
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

export interface AmbiguousParent {
  parentIso2: string;
  parentIso3: string;
  parentName: string;
  message: string;
  constituents: Array<{ id: string; name: string; command: CommandId; evidenceClass: EvidenceClass; provisional: boolean }>;
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
  commandMedicalPolicyStatus: "PUBLISHED" | "NOT_PUBLICLY_VERIFIED" | "COMMAND_NOT_ASSIGNED" | "LOCATION_AMBIGUOUS";
  /** Set when the supplied code is a split ISO parent (US, UM, TF): no AOR is returned for the parent; constituents are listed instead. */
  ambiguousParent?: AmbiguousParent | null;
  /** Qualifier carried into medical-rule evaluation when the geographic assignment itself is provisional or only regionally inferred. */
  assignmentQualifier?: { evidenceClass: EvidenceClass; provisional: boolean; text: string } | null;
  /** Command-wide rules, then component / country supplements layered on top (inheritance order). */
  rules: CommandPolicyRule[];
  note: string | null;
}
