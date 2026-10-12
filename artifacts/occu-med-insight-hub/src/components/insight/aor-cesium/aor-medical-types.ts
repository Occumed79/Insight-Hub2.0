// Response shape of GET /api/aor/medical-applicability (mirrors api-server command-policy/medical-applicability.ts).

import type { CommandId, EvidenceClass } from "./aor-directory";

export type RequirementStatus = "REQUIRED" | "RECOMMENDED" | "CONDITIONAL" | "NOT_APPLICABLE" | "UNKNOWN";
export const REQUIREMENT_STATUSES: RequirementStatus[] = ["REQUIRED", "RECOMMENDED", "CONDITIONAL", "NOT_APPLICABLE", "UNKNOWN"];
export type AuthorityLayer = "combatant_command" | "dod_issuance" | "host_nation" | "public_health";
export type RequirementCategory = "immunization" | "malaria_chemoprophylaxis" | "infectious_disease_screening" | "medical_screening" | "medical_examination" | "medication_equipment" | "waiver_disqualifying_condition" | "documentation" | "clearance_process" | "other";

export type PublicHealthSourceReport = {
  sourceId: string; sourceName: string; sourceUrl: string; status: string; freshness: string | null; retrievedAt: string | null; lastAttemptedFetch: string | null;
  lastSuccessfulFetch: string | null; sourceUpdatedAt: string | null; sourceError: string | null; note: string | null; recordCount: number; itemsMapped: number; recordsNotMapped: number;
};

export type RequirementItem = {
  id: string;
  layer: AuthorityLayer;
  category: RequirementCategory;
  status: RequirementStatus;
  title: string;
  requirement: string;
  why: string[];
  authority: { layer: AuthorityLayer; issuer: string; policyId: string | null; policyTitle: string | null; sourceSection: string | null; sourceUrl: string; publishedDate: string | null; verificationStatus: string; citedDodInstructions: string[] };
  appliesToContractors: "named_in_source" | "as_directed_by_command_or_contract" | "not_named_in_source" | "all_travelers" | "not_applicable_to_layer";
  contractualNote: string | null;
  trigger: { populations: string; minimumStay: string | null; maximumStay: string | null; component: string | null; travelScope: string | null; conditions: string[]; thresholdOrRule: string | null };
  exceptions: { exemptDestinations: string[]; exemptionCondition: string | null; waiverAuthority: string | null; policyStatus: string | null; notes: string[] };
  effective: { status: "in_effect" | "not_yet_effective" | "effective_date_not_established" | "withdrawn"; effectiveFrom: string | null; effectiveTo: string | null; note: string };
  missingInputs: string[];
  evidence: { sourceWording: string | null; sourceProvenance: string | null; sourceGaps: string[]; caveats: string[] };
  displacedEvidence: string[];
  assignmentCaveat: string | null;
  verification: {
    state: "verified_current_source" | "unconfirmed_historical";
    possibleRequirement: string | null;
    gap: string | null;
    historicalEvidence: { authority: string; authorityTier: string; sourcePublishedAt: string | null; retrievedAt: string; lastVerifiedAt: string | null; verificationStatus: string; productionVerificationRequired: boolean; supportingSources: Array<{ authority: string; url: string; note: string }>; notes: string[] } | null;
    liveCorroboration: Array<{ itemId: string; authority: string; url: string; retrievedAt: string | null; text: string }>;
  } | null;
};

export type LayerCoverage = { layer: AuthorityLayer; coverage: string; note: string; items: number; sources?: PublicHealthSourceReport[] };

export type MedicalApplicability = {
  ok: boolean;
  generatedAt: string;
  status: "EVALUATED" | "LOCATION_AMBIGUOUS" | "LOCATION_NOT_FOUND";
  location: {
    id: string | null; name: string | null; command: CommandId | null; commandName: string | null; geographicClass: string | null; assignmentEvidenceClass: EvidenceClass | null;
    assignmentProvisional: boolean; parentIso3: string | null; message: string | null;
    ambiguity: { parentName: string; message: string; constituents: Array<{ id: string; name: string; command: CommandId }> } | null;
  };
  commandPolicy: { policyId: string | null; title: string | null; status: string; sourceDate: string | null; effectiveFrom: string | null; qualifiers: string[]; superseded: Array<{ policyId: string; title: string; note: string }> } | null;
  requirements: RequirementItem[];
  scopeRules: Array<{ id: string; title: string; text: string; sourceSection: string | null }>;
  byStatus: Record<RequirementStatus, number>;
  categories: Record<RequirementCategory, { status: RequirementStatus; itemIds: string[]; note: string }>;
  layers: Record<AuthorityLayer, LayerCoverage>;
  missingInformation: Array<{ input: string; neededFor: string[] }>;
  limitations: string[];
  error?: string;
};

export type Tri = "" | "yes" | "no";

/** Everything the person can change; every field is optional and "" means "not specified" (never assumed). */
export type MedicalInputs = {
  population: string;
  civilianCategory: string;
  contractorAuthorization: "" | "caaf" | "non_caaf";
  contractRequirementsApply: Tri;
  travelKind: string;
  stayDays: string;
  component: string;
  installation: string;
  onDeploymentOrders: Tri;
  highRiskOrLiveFire: Tri;
  layoverInYfEndemicCountry: Tri;
  arrivingFrom: string;
  ageYears: string;
  permanentAssignment: "" | "none" | "destination";
};

export const EMPTY_MEDICAL_INPUTS: MedicalInputs = {
  population: "", civilianCategory: "", contractorAuthorization: "", contractRequirementsApply: "", travelKind: "", stayDays: "", component: "", installation: "",
  onDeploymentOrders: "", highRiskOrLiveFire: "", layoverInYfEndemicCountry: "", arrivingFrom: "", ageYears: "", permanentAssignment: "",
};

export const POPULATION_OPTIONS: Array<[string, string]> = [
  ["us_military", "U.S. military member"], ["dod_civilian", "DoD civilian employee"], ["dod_contractor", "DoD contractor"], ["dependent", "Family member / dependent"],
  ["volunteer", "Volunteer"], ["interagency", "Interagency personnel"], ["tcn", "Third-country national"], ["local_national", "Local national"], ["working_dog", "Military working dog"],
];
export const CIVILIAN_CATEGORY_OPTIONS: Array<[string, string]> = [
  ["emergency_essential", "Emergency essential"], ["non_combat_essential", "Non-combat essential"], ["expeditionary", "Expeditionary civilian"], ["other", "Other civilian"],
];
export const TRAVEL_KIND_OPTIONS: Array<[string, string]> = [
  ["official_tdy_deployment", "Official TDY / deployment"], ["pcs", "Permanent change of station (PCS)"], ["contingency", "Contingency operation"], ["leisure", "Leisure / personal travel"],
];

export function medicalQueryString(destination: string, inputs: MedicalInputs, destinationIso3: string | null): string {
  const params = new URLSearchParams({ destination });
  const set = (key: string, value: string) => { if (value) params.set(key, value); };
  const tri = (key: string, value: Tri) => { if (value) params.set(key, value === "yes" ? "true" : "false"); };
  set("population", inputs.population);
  if (inputs.population === "dod_civilian") set("civilianCategory", inputs.civilianCategory);
  if (inputs.population === "dod_contractor") { set("contractorAuthorization", inputs.contractorAuthorization); tri("contractRequirementsApply", inputs.contractRequirementsApply); }
  set("travelKind", inputs.travelKind);
  const days = Number(inputs.stayDays);
  if (inputs.stayDays.trim() && Number.isFinite(days) && days >= 0) params.set("stayDays", String(Math.floor(days)));
  set("component", inputs.component);
  set("installation", inputs.installation.trim());
  tri("onDeploymentOrders", inputs.onDeploymentOrders);
  tri("highRiskOrLiveFire", inputs.highRiskOrLiveFire);
  tri("layoverInYfEndemicCountry", inputs.layoverInYfEndemicCountry);
  set("arrivingFrom", inputs.arrivingFrom.trim().toUpperCase());
  const age = Number(inputs.ageYears);
  if (inputs.ageYears.trim() && Number.isFinite(age) && age >= 0) params.set("ageYears", String(Math.floor(age)));
  if (inputs.permanentAssignment === "none") params.set("permanentAssignmentIso3", "NONE");
  else if (inputs.permanentAssignment === "destination" && destinationIso3) params.set("permanentAssignmentIso3", destinationIso3);
  return params.toString();
}
