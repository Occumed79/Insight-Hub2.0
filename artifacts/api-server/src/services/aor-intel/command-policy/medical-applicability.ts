// Assignment-specific medical applicability.
//
// This is NOT a second rule engine. It composes the three engines that already exist and keeps their results apart:
//   - combatant-command / theater policy:  engine.ts evaluateCommandTraveler (161 rules, 18 USARPAC, 3 SOUTHCOM contractor)
//   - host-nation entry / exit rules:      vaccine-rules/engine.ts evaluateTraveler
//   - CDC / WHO recommendations:           evidence supplied by the caller (live adapters); never invented here
// and the geographic directory (resolveLocation) that turns a place into one AOR.
//
// Every result item answers: what is needed, why, which authority, does it reach contractors, what triggers it, what exceptions /
// waivers exist, is it effective, and what is missing. Status is exactly one of REQUIRED / RECOMMENDED / CONDITIONAL / NOT_APPLICABLE /
// UNKNOWN. UNKNOWN is never reported as "not required", and an AOR assignment alone never produces REQUIRED.

import { evaluateTraveler as evaluateHostTraveler, describeCountry } from "../vaccine-rules/engine";
import { VACCINE_RULES } from "../vaccine-rules/rules-data";
import type { RuleEvaluation as HostEvaluation, TravelerQuery as HostQuery, VaccineRule } from "../vaccine-rules/types";
import { COMMAND_NAMES, resolveLocation } from "./assignments";
import { evaluateCommandTraveler, policyQualifiers } from "./engine";
import type {
  AmbiguousParent, CommandId, CommandPolicy, CommandPolicyRule, CommandQuery, CommandRuleEvaluation, CountryAorAssignment, EvidenceClass, Population, TravelKind,
} from "./types";

export type RequirementStatus = "REQUIRED" | "RECOMMENDED" | "CONDITIONAL" | "NOT_APPLICABLE" | "UNKNOWN";
export const REQUIREMENT_STATUSES: readonly RequirementStatus[] = ["REQUIRED", "RECOMMENDED", "CONDITIONAL", "NOT_APPLICABLE", "UNKNOWN"];

/** The four authority layers stay distinguishable in every result. */
export type AuthorityLayer = "combatant_command" | "dod_issuance" | "host_nation" | "public_health";

export type RequirementCategory =
  | "immunization"
  | "malaria_chemoprophylaxis"
  | "infectious_disease_screening"
  | "medical_screening"
  | "medical_examination"
  | "medication_equipment"
  | "waiver_disqualifying_condition"
  | "documentation"
  | "clearance_process"
  | "other";

/** Categories the caller asked to have answered explicitly, even when no source speaks to them. */
export const REPORTED_CATEGORIES: readonly RequirementCategory[] = [
  "immunization", "malaria_chemoprophylaxis", "infectious_disease_screening", "medical_screening", "medical_examination", "waiver_disqualifying_condition",
];

export interface PublicHealthInput {
  id: string;
  topic: string;
  category?: RequirementCategory;
  authority: string;
  recommendation: string;
  url: string;
  publishedAt?: string | null;
  /** What the guidance is conditioned on (for example "travel to a malaria-risk area"). */
  condition?: string | null;
}

export interface MedicalApplicabilityQuery {
  /** ISO3, ISO2, directory id, or a place / constituent name ("Hawaii", "Kuwait"). */
  destination: string;
  /** Named installation or operating location; matched only against component / site names the integrated sources actually use. */
  installation?: string | null;
  population?: Population | null;
  civilianCategory?: CommandQuery["civilianCategory"];
  contractorAuthorization?: "caaf" | "non_caaf" | null;
  /** Whether the contract / SOW incorporates the command requirement. */
  contractRequirementsApply?: boolean | null;
  permanentAssignmentIso3?: string | null;
  onDeploymentOrders?: boolean | null;
  highRiskOrLiveFire?: boolean | null;
  stayDays?: number | null;
  travelKind?: TravelKind | null;
  component?: string | null;
  layoverInYfEndemicCountry?: boolean | null;
  /** Host-nation inputs. */
  arrivingFrom?: string | null;
  visitedCountries?: string[];
  transit?: Array<{ country: string; hours: number }>;
  ageYears?: number | null;
  /** CDC / WHO / other public-health guidance for this destination, supplied by the live adapters. */
  publicHealth?: PublicHealthInput[] | null;
  now?: Date;
}

export interface RequirementAuthority {
  layer: AuthorityLayer;
  issuer: string;
  policyId: string | null;
  policyTitle: string | null;
  sourceSection: string | null;
  sourceUrl: string;
  /** Publication date of the source. Never presented as the effective date. */
  publishedDate: string | null;
  verificationStatus: string;
  /** DoD instructions the source itself cites (references only; not separate requirements). */
  citedDodInstructions: string[];
}

export interface RequirementEffectiveness {
  status: "in_effect" | "not_yet_effective" | "effective_date_not_established" | "withdrawn";
  effectiveFrom: string | null;
  effectiveTo: string | null;
  note: string;
}

export interface RequirementItem {
  id: string;
  layer: AuthorityLayer;
  category: RequirementCategory;
  status: RequirementStatus;
  /** What the person needs. */
  title: string;
  requirement: string;
  /** Why it is required (or recommended): the authority's statement plus the evaluation reasons. */
  why: string[];
  authority: RequirementAuthority;
  /** Does the requirement reach contractors? */
  appliesToContractors: "named_in_source" | "as_directed_by_command_or_contract" | "not_named_in_source" | "all_travelers" | "not_applicable_to_layer";
  contractualNote: string | null;
  /** What duration, mission or population condition triggers it. */
  trigger: {
    populations: string;
    minimumStay: string | null;
    maximumStay: string | null;
    component: string | null;
    travelScope: string | null;
    conditions: string[];
    thresholdOrRule: string | null;
  };
  /** Exceptions, exemptions and waivers. */
  exceptions: { exemptDestinations: string[]; exemptionCondition: string | null; waiverAuthority: string | null; policyStatus: string | null; notes: string[] };
  effective: RequirementEffectiveness;
  /** What is missing before applicability can be determined. */
  missingInputs: string[];
  evidence: { sourceWording: string | null; sourceProvenance: string | null; sourceGaps: string[]; caveats: string[] };
  /** Earlier or conflicting source evidence kept for traceability (not applied). */
  displacedEvidence: string[];
  /** Set when the geographic assignment is provisional or only a regional mapping. */
  assignmentCaveat: string | null;
}

export interface LayerCoverage {
  layer: AuthorityLayer;
  coverage: "evaluated" | "no_public_policy" | "partial" | "not_supplied" | "not_integrated" | "no_rule_in_source_set" | "not_evaluated";
  note: string;
  items: number;
}

export interface CategorySummary {
  status: RequirementStatus;
  itemIds: string[];
  note: string;
}

export interface MedicalApplicabilityResult {
  status: "EVALUATED" | "LOCATION_AMBIGUOUS" | "LOCATION_NOT_FOUND";
  query: MedicalApplicabilityQuery;
  location: {
    id: string | null;
    name: string | null;
    command: CommandId | null;
    commandName: string | null;
    geographicClass: string | null;
    assignmentEvidenceClass: EvidenceClass | null;
    assignmentProvisional: boolean;
    parentIso3: string | null;
    ambiguity: AmbiguousParent | null;
    message: string | null;
  };
  commandPolicy: {
    policyId: string | null;
    title: string | null;
    status: string;
    sourceDate: string | null;
    effectiveFrom: string | null;
    qualifiers: string[];
    superseded: Array<{ policyId: string; title: string; note: string }>;
  } | null;
  requirements: RequirementItem[];
  /** Definitional rules (applicability, deployment definition, duration) that shaped the evaluation but are not themselves requirements. */
  scopeRules: Array<{ id: string; title: string; text: string; sourceSection: string | null }>;
  byStatus: Record<RequirementStatus, number>;
  categories: Record<RequirementCategory, CategorySummary>;
  layers: Record<AuthorityLayer, LayerCoverage>;
  missingInformation: Array<{ input: string; neededFor: string[] }>;
  limitations: string[];
}

/* ------------------------------------------------------------------ */
/* Classification helpers                                              */
/* ------------------------------------------------------------------ */

const DOD_ISSUER = /^\s*(?:OUSD|USD\(|ASD\(|Defense Procurement|DPAP|Defense Health Agency|DHA\b|Department of Defense|Office of the Secretary of Defense)/i;
const DOD_INSTRUCTION = /\b(?:DoDI|DODI|DoD Instruction|DHA-PI|DHA-PM|DHA-IPM)\s*\d{4}\.\d{2}\b/gi;
/** Supplement / medication-domain rules that are really vaccine requirements (e.g. the AFRICOM yellow-fever and chikungunya supplements). */
const VACCINE_TEXT = /vaccin|yellow fever|YF-VAX|chikungunya|typhoid|immuniz|tick-borne|\bTBE\b/i;
const MALARIA = /malaria|chemoprophylaxis|doxycycline|mefloquine|atovaquone|tafenoquine|primaquine/i;
/** Within the immunization domain "Hepatitis A/B" names a vaccine, so only tests count as screening there. */
const ID_SCREEN_TESTS = /tubercul|\bTB\b|IGRA|\bTST\b|HIV|syphilis|serolog|infectious disease screen/i;
const ID_SCREEN = /tubercul|\bTB\b|IGRA|\bTST\b|HIV|hepatitis [BC]\b|syphilis|serolog|infectious disease screen/i;
const EXAM = /\bexam(?:ination)?s?\b|physical|periodic health|PHA\b|health assessment|dental|readiness (?:assessment|class)|medical clearance|PHS Form 791/i;

export function layerOfRule(rule: CommandPolicyRule): AuthorityLayer {
  // The issuer decides the layer: a DoD-level issuer (OUSD, DPAP, DHA …) is a DoD issuance even when the text names a command that requested it.
  return rule.issuingAuthority && DOD_ISSUER.test(rule.issuingAuthority) ? "dod_issuance" : "combatant_command";
}

export function categoryOfRule(rule: CommandPolicyRule): RequirementCategory {
  const text = `${rule.title} ${rule.conditionOrRequirement} ${rule.thresholdOrRule ?? ""} ${rule.medicationOrEquipmentRule ?? ""} ${rule.immunizationOrProphylaxisRule ?? ""}`;
  if (MALARIA.test(rule.title) || (MALARIA.test(text) && (rule.domain === "immunization_prophylaxis" || rule.domain === "medication"))) return "malaria_chemoprophylaxis";
  switch (rule.domain) {
    case "immunization_prophylaxis":
      return ID_SCREEN_TESTS.test(rule.title) ? "infectious_disease_screening" : "immunization";
    case "waiver":
    case "condition":
      return ID_SCREEN.test(rule.title) ? "infectious_disease_screening" : "waiver_disqualifying_condition";
    case "fitness":
      return "medical_screening";
    case "medication":
    case "supplement":
      if (ID_SCREEN.test(rule.title)) return "infectious_disease_screening";
      return VACCINE_TEXT.test(`${rule.title} ${rule.immunizationOrProphylaxisRule ?? ""}`) ? "immunization" : "medication_equipment";
    case "documentation":
      if (ID_SCREEN.test(rule.title)) return "infectious_disease_screening";
      if (/immuniz|vaccin/i.test(rule.title)) return "immunization";
      return EXAM.test(rule.title) || rule.requiredEvaluation ? "medical_examination" : "documentation";
    case "clearance":
      return "clearance_process";
    case "cbrn":
    case "pcs":
    case "guidance":
      return ID_SCREEN.test(rule.title) ? "infectious_disease_screening" : EXAM.test(rule.title) ? "medical_examination" : "other";
    default:
      return "other";
  }
}


/**
 * Rules whose own wording narrows or negates the requirement even though the rule is filed as kind "requirement" with no structured
 * condition. Each entry is anchored to the source wording (a test asserts the anchor still matches), so a wording change cannot leave a
 * stale qualifier behind. A narrowed rule is never reported REQUIRED for everyone in the AOR.
 */
export const SOURCE_TEXT_QUALIFIERS: Record<string, { anchor: RegExp; status: "NOT_APPLICABLE" | "CONDITIONAL"; reason: string; condition?: string; endedOn?: string }> = {
  "cc:imm:smallpox": { anchor: /no longer required/i, status: "NOT_APPLICABLE", reason: "The source states smallpox vaccination is no longer required for the CENTCOM AOR (explicit command statement as of 16 May 2014).", endedOn: "2014-05-16" },
  "cc:imm:cholera": { anchor: /Not required for most personnel/i, status: "CONDITIONAL", reason: "The source says this is not required for most personnel; only those designated by the unit or mission.", condition: "the traveler is designated for cholera vaccination by the unit or mission" },
  "cc:imm:rabies-groups": { anchor: /high-risk personnel/i, status: "CONDITIONAL", reason: "The source requires pre-exposure rabies vaccination for named high-risk groups (and SOF deployers), not for all personnel in the AOR.", condition: "the traveler is in a high-risk group the source names (veterinary, military working dog handler, animal control, certain security, at-risk civil engineer, rabies-sample laboratory) or deploys in support of SOF" },
  "cc:imm:covid19": { anchor: /Country-dependent/i, status: "CONDITIONAL", reason: "The source defers to the host nation: personnel must meet the host nation's definition of vaccinated only where the country has a requirement.", condition: "the destination host nation has a COVID-19 vaccination requirement (Foreign Clearance Guide)" },
  "cc:imm:malaria": { anchor: /listed risk areas/i, status: "CONDITIONAL", reason: "The source requires malaria chemoprophylaxis for personnel deploying to listed risk areas in the absence of a local risk assessment; it is not a blanket AOR requirement.", condition: "the destination or operating area is a listed malaria-risk area and no local risk assessment supersedes the listing" },
  "ip:fy26:tb": { anchor: /risk-based/i, status: "CONDITIONAL", reason: "The source makes TB testing risk-based (extended high-risk population contact) and says to avoid routine testing of low-risk personnel.", condition: "the traveler has extended contact with a high-risk population or the Service questionnaire indicates risk" },
  "eu:ocr:g6pd-tb": { anchor: /TB testing is risk-targeted/i, status: "CONDITIONAL", reason: "The source makes TB testing risk-targeted rather than universal; the one-time G6PD documentation is a separate element of the same rule.", condition: "TB testing is indicated by the risk-targeting criteria; G6PD documentation applies independently" },
};

const SCOPE_DOMAINS = new Set(["applicability", "deployment_definition", "duration"]);
/** Rules that list authorities or describe command-side record keeping: shown as scope / reference, never as a duty on the traveler. */
const COMMAND_SIDE_RULES = new Set(["ip:references", "ip:waiver-reporting", "sc:ocr:contract"]);
const isDirectedMessage = (message: string) => /^whether this rule reaches/.test(message);
/** The source reaches contractors only through the contract; whether the SOW does so is a contract fact the caller must confirm, not a missing assignment fact. */
const isContractReachMessage = (message: string) => /Statement of Work reaches/i.test(message);

const stayText = (rule: CommandPolicyRule) => (rule.minimumStay ? `${rule.minimumStay.inclusive ? "at least" : "more than"} ${rule.minimumStay.days} days — ${rule.minimumStay.basis}` : null);

const populationLabel = (rule: CommandPolicyRule) => rule.populationText || (rule.applicabilityPopulation.length ? rule.applicabilityPopulation.join(", ") : "population not named by the source");

function contractorReach(rule: CommandPolicyRule): RequirementItem["appliesToContractors"] {
  if (rule.directedPopulations.includes("dod_contractor")) return "as_directed_by_command_or_contract";
  if (rule.applicabilityPopulation.includes("dod_contractor")) return "named_in_source";
  return "not_named_in_source";
}

function ruleEffectiveness(rule: CommandPolicyRule, policy: CommandPolicy | null, layer: AuthorityLayer, now: Date): RequirementEffectiveness {
  // A DoD issuance carried inside a command policy is dated on its own; the command policy's effective date does not stand in for it.
  const from = layer === "dod_issuance" ? null : policy?.effectiveFrom ?? null;
  const to = layer === "dod_issuance" ? null : policy?.effectiveTo ?? null;
  const published = rule.sourceDate ?? policy?.sourceDate ?? null;
  if (to && Date.parse(`${to}T00:00:00Z`) <= now.getTime()) return { status: "withdrawn", effectiveFrom: from, effectiveTo: to, note: `Effective period ended ${to}.` };
  if (from) {
    return Date.parse(`${from}T00:00:00Z`) > now.getTime()
      ? { status: "not_yet_effective", effectiveFrom: from, effectiveTo: to, note: `Takes effect ${from}.` }
      : { status: "in_effect", effectiveFrom: from, effectiveTo: to, note: `Effective ${from}; current published policy, not superseded.` };
  }
  return {
    status: "effective_date_not_established",
    effectiveFrom: null,
    effectiveTo: null,
    note: `${published ? `Published ${published}; ` : "No publication date extracted; "}the source's own effective date was not established, so the publication date is not treated as the effective date. It is the command's current published policy and has not been superseded in the registry.`,
  };
}

const ruleText = (rule: CommandPolicyRule) => `${rule.title} ${rule.conditionOrRequirement} ${rule.thresholdOrRule ?? ""} ${rule.sourceWording ?? ""}`;

function citedInstructions(rule: CommandPolicyRule): string[] {
  const found = `${ruleText(rule)} ${rule.sourceSection ?? ""}`.match(DOD_INSTRUCTION) ?? [];
  return [...new Set(found.map((value) => value.replace(/\s+/g, " ").trim()))];
}

/* ------------------------------------------------------------------ */
/* Combatant-command / DoD-issuance items                              */
/* ------------------------------------------------------------------ */

function commandItem(
  evaluation: CommandRuleEvaluation, query: MedicalApplicabilityQuery, policy: CommandPolicy | null, command: CommandId, caveat: string | null, now: Date,
): RequirementItem {
  const rule = evaluation.rule;
  const layer = layerOfRule(rule);
  const conditions = new Set(rule.applicabilityConditions ?? []);
  const inputsMissing = evaluation.missingInputs.filter((message) => !conditions.has(message) && !isDirectedMessage(message) && !isContractReachMessage(message));
  const conditionsMissing = evaluation.missingInputs.filter((message) => conditions.has(message) || isDirectedMessage(message) || isContractReachMessage(message));
  const category = categoryOfRule(rule);
  const notes: string[] = [];
  // Contract reach stays listed as missing information even though it makes the item CONDITIONAL rather than UNKNOWN.
  let missing = [...inputsMissing, ...conditionsMissing.filter(isContractReachMessage)];
  const reasons = [...evaluation.reasons];

  let status: RequirementStatus;
  if (evaluation.applicability === "does_not_apply") status = "NOT_APPLICABLE";
  else if (evaluation.applicability === "unknown") status = inputsMissing.length ? "UNKNOWN" : "CONDITIONAL";
  else if (rule.kind === "recommendation") status = "RECOMMENDED";
  else if (rule.domain === "condition" || rule.status === "conditional" || rule.status === "waiver-required" || rule.status === "non-waivable" || (rule.kind === "process" && rule.domain === "waiver")) status = "CONDITIONAL";
  else status = "REQUIRED";

  // Source wording that narrows or negates the rule overrides the bare "requirement" filing.
  const qualifier = SOURCE_TEXT_QUALIFIERS[rule.id];
  let qualifierEnded: string | null = null;
  if (qualifier && qualifier.anchor.test(rule.conditionOrRequirement) && (status === "REQUIRED" || status === "RECOMMENDED" || status === "UNKNOWN")) {
    status = qualifier.status;
    reasons.push(qualifier.reason);
    if (qualifier.condition) conditions.add(qualifier.condition);
    qualifierEnded = qualifier.endedOn ?? null;
  }

  // Contractor-specific applicability.
  let contractualNote: string | null = null;
  if (query.population === "dod_contractor" && status !== "NOT_APPLICABLE") {
    const mentionsCaaf = /\bCAAF\b|contractors? authorized to accompany/i.test(ruleText(rule));
    if (mentionsCaaf && !query.contractorAuthorization && !rule.indopacomFY26Scope && !rule.mandatoryVaccinationGroups) {
      missing.push("CAAF / Non-CAAF classification (the source distinguishes contractor categories)");
      if (status === "REQUIRED" || status === "RECOMMENDED") status = "UNKNOWN";
    }
    if (query.contractRequirementsApply === false && !rule.indopacomFY26Scope && (status === "REQUIRED" || status === "RECOMMENDED")) {
      status = "CONDITIONAL";
      contractualNote = "The caller states the contract does not incorporate this requirement. The command source does not itself limit contractor applicability, so contractual enforceability is unconfirmed; confirm with the contracting officer.";
    } else if (status === "REQUIRED" || status === "RECOMMENDED") {
      contractualNote = rule.applicabilityPopulation.includes("dod_contractor")
        ? "The source names DoD contractors. Enforcement reaches a contractor through the contract; confirm the SOW / clause incorporates it."
        : null;
    }
    if (rule.directedPopulations.includes("dod_contractor")) contractualNote = "The source reaches contractors only where the command or contract directs it.";
  }
  if (status === "NOT_APPLICABLE") contractualNote = null;
  if (rule.id.startsWith("sc:dpap:") && query.population === "dod_contractor" && query.contractRequirementsApply === true && status === "CONDITIONAL") {
    // The only gating condition (the clause is in the contract) has been confirmed by the caller; remaining conditions stay.
    const remaining = conditionsMissing.filter((message) => !/contract contains|contract-personnel clause/i.test(message));
    if (!remaining.length && !inputsMissing.length) {
      status = "REQUIRED";
      reasons.push("The caller confirms the contract contains the SOUTHCOM AOR contractor-personnel clause.");
    }
  }

  const exempt = [...rule.exemptCountries, ...(rule.unconditionalExemptCountries ?? [])];
  const published = rule.sourceDate ?? policy?.sourceDate ?? null;
  const issuer = rule.issuingAuthority ?? policy?.issuingAuthority ?? COMMAND_NAMES[command];
  const authorityLine = `${issuer}${rule.sourceSection ? `, ${rule.sourceSection}` : ""}: ${rule.kind === "requirement" ? "requirement" : rule.kind === "recommendation" ? "recommendation" : "process / workflow"} — ${rule.conditionOrRequirement}`.slice(0, 600);
  const supersededEvidence = (rule.previousRuleEvidence ?? []).map((entry) => `${entry.verificationStatus}${entry.sourceDate ? ` (${entry.sourceDate})` : ""}: ${entry.conditionOrRequirement}`.slice(0, 400));
  const travelScope = [rule.pcsOnly ? "PCS personnel only" : null, rule.contingencyOnly ? "contingency-operation deployers only" : null, rule.officialTravelOnly ? `official travel only${rule.officialTravelIncludesPcs ? " (PCS included)" : ""}` : null, rule.indopacomFY26Scope ? "INDOPACOM FY26 scope: excludes personal leave; Guam-only travel exempt" : null].filter((value): value is string => Boolean(value)).join("; ") || null;

  return {
    id: `${layer}:${rule.id}`,
    layer,
    category,
    status,
    title: rule.title,
    requirement: rule.conditionOrRequirement,
    why: [authorityLine, ...reasons, ...(conditionsMissing.length || qualifier?.condition ? [`Applies only where: ${[...conditionsMissing, ...(qualifier?.condition && status === "CONDITIONAL" ? [qualifier.condition] : [])].join("; ")}.`] : [])],
    authority: {
      layer,
      issuer,
      policyId: rule.policyId,
      policyTitle: policy?.policyTitle ?? null,
      sourceSection: rule.sourceSection,
      sourceUrl: rule.sourceUrl,
      publishedDate: published,
      verificationStatus: rule.verificationStatus,
      citedDodInstructions: citedInstructions(rule),
    },
    appliesToContractors: contractorReach(rule),
    contractualNote,
    trigger: {
      populations: populationLabel(rule),
      minimumStay: stayText(rule),
      maximumStay: rule.maximumStayDaysExclusive !== null ? `under ${rule.maximumStayDaysExclusive} days` : null,
      component: rule.scope.component,
      travelScope,
      conditions: [...conditions],
      thresholdOrRule: rule.thresholdOrRule,
    },
    exceptions: { exemptDestinations: exempt, exemptionCondition: rule.exemptionCondition, waiverAuthority: rule.waiverAuthority, policyStatus: rule.status, notes },
    effective: qualifierEnded
      ? { status: "withdrawn", effectiveFrom: null, effectiveTo: qualifierEnded, note: `The source itself states the requirement ended ${qualifierEnded}.` }
      : ruleEffectiveness(rule, policy, layer, now),
    missingInputs: [...new Set(missing)],
    evidence: {
      sourceWording: rule.sourceWording ?? null,
      sourceProvenance: rule.sourceProvenance ? `${rule.sourceProvenance.filename} lines ${rule.sourceProvenance.startLine}-${rule.sourceProvenance.endLine} (sha256 ${rule.sourceProvenance.sha256.slice(0, 12)}…)` : null,
      sourceGaps: rule.sourceGaps,
      caveats: rule.caveats,
    },
    displacedEvidence: supersededEvidence,
    assignmentCaveat: caveat,
  };
}

/* ------------------------------------------------------------------ */
/* Host-nation items                                                   */
/* ------------------------------------------------------------------ */

const HOST_CATEGORY: RequirementCategory = "immunization";

function hostItem(evaluation: HostEvaluation, now: Date): RequirementItem {
  const rule: VaccineRule = evaluation.rule;
  const notVerified = rule.verificationStatus === "NOT CURRENTLY VERIFIED";
  let status: RequirementStatus;
  if (evaluation.applicability === "does_not_apply" || evaluation.applicability === "removed") status = "NOT_APPLICABLE";
  else if (evaluation.applicability === "unknown") status = "UNKNOWN";
  else if (notVerified) status = "UNKNOWN";
  else if (rule.legalForce === "mandatory") status = "REQUIRED";
  else if (rule.legalForce === "declaration") status = "CONDITIONAL";
  else status = "RECOMMENDED"; // WHO IHR temporary recommendation: addressed to States, not national law
  const reasons = [...evaluation.reasons];
  if (notVerified && evaluation.applicability === "applies") reasons.push("The rule on file is NOT CURRENTLY VERIFIED against the destination government, so it is not reported as required.");
  if (rule.verificationStatus === "OLDER GLOBAL BASELINE") reasons.push("Verification status is OLDER GLOBAL BASELINE: the destination government's current rule was not re-verified; confirm before relying on it.");
  if (rule.legalForce === "declaration") reasons.push("The destination asks travelers to declare or may request proof; entry is not stated to be refused for lacking it.");
  if (rule.legalForce === "who_temporary_recommendation") reasons.push("WHO IHR Emergency Committee temporary recommendation addressed to States — not national law.");
  const validFrom = rule.validFrom;
  const validUntil = rule.validUntil;
  const withdrawn = evaluation.applicability === "removed" || (validUntil !== null && Date.parse(`${validUntil}T00:00:00Z`) <= now.getTime());
  const effective: RequirementEffectiveness = withdrawn
    ? { status: "withdrawn", effectiveFrom: validFrom, effectiveTo: validUntil, note: evaluation.applicability === "removed" ? "The authority states the requirement no longer applies." : `Valid period ended ${validUntil}.` }
    : validFrom
      ? { status: Date.parse(`${validFrom}T00:00:00Z`) > now.getTime() ? "not_yet_effective" : "in_effect", effectiveFrom: validFrom, effectiveTo: validUntil, note: `Valid from ${validFrom}.` }
      : { status: "effective_date_not_established", effectiveFrom: null, effectiveTo: validUntil, note: `${rule.sourcePublishedAt ? `Source published ${rule.sourcePublishedAt}; ` : ""}no effective date is stated, so publication is not treated as the effective date. Verification: ${rule.verificationStatus}.` };
  return {
    id: `host_nation:${rule.id}`,
    layer: "host_nation",
    category: HOST_CATEGORY,
    status,
    title: `${rule.vaccine} — ${rule.ruleType} requirement (${rule.legalForce.replace(/_/g, " ")})`,
    requirement: rule.normalizedRule,
    why: [`${rule.sourceAuthority}: ${rule.normalizedRule}`.slice(0, 600), ...reasons],
    authority: {
      layer: "host_nation", issuer: rule.sourceAuthority, policyId: null, policyTitle: null, sourceSection: null, sourceUrl: rule.sourceUrl,
      publishedDate: rule.sourcePublishedAt, verificationStatus: rule.verificationStatus, citedDodInstructions: [],
    },
    appliesToContractors: "all_travelers",
    contractualNote: "Host-nation law applies to the person as a traveler, whatever the DoD status. Status-of-forces or official-passport treatment is not modeled here and could change entry documentation (UNKNOWN).",
    trigger: {
      populations: rule.travelerGroup.replace(/_/g, " "),
      minimumStay: rule.stayDurationThresholdDays !== null ? `stay of ${rule.stayDurationThresholdDays} days or more` : null,
      maximumStay: null,
      component: null,
      travelScope: [rule.originScope.replace(/_/g, " "), rule.eventType ? `event: ${rule.eventType}` : null, rule.transitApplies === true ? `transit counts${rule.transitThresholdHours !== null ? ` beyond ${rule.transitThresholdHours} h` : ""}` : null].filter((value): value is string => Boolean(value)).join("; "),
      conditions: [],
      thresholdOrRule: rule.vaccineDetail,
    },
    exceptions: { exemptDestinations: [], exemptionCondition: null, waiverAuthority: null, policyStatus: rule.legalForce, notes: rule.exemptions },
    effective,
    missingInputs: evaluation.missingInputs,
    evidence: { sourceWording: null, sourceProvenance: null, sourceGaps: [], caveats: rule.notes },
    displacedEvidence: [],
    assignmentCaveat: null,
  };
}

/* ------------------------------------------------------------------ */
/* Public-health items                                                 */
/* ------------------------------------------------------------------ */

function publicHealthItem(input: PublicHealthInput): RequirementItem {
  const category: RequirementCategory = input.category ?? (MALARIA.test(`${input.topic} ${input.recommendation}`) ? "malaria_chemoprophylaxis" : "immunization");
  return {
    id: `public_health:${input.id}`,
    layer: "public_health",
    category,
    // CDC / WHO guidance is a recommendation by nature; it is never reported as a requirement.
    status: input.condition ? "CONDITIONAL" : "RECOMMENDED",
    title: input.topic,
    requirement: input.recommendation,
    why: [`${input.authority} recommendation: ${input.recommendation}`.slice(0, 600), "A public-health recommendation is not a host-nation entry rule and not a combatant-command requirement."],
    authority: { layer: "public_health", issuer: input.authority, policyId: null, policyTitle: null, sourceSection: null, sourceUrl: input.url, publishedDate: input.publishedAt ?? null, verificationStatus: "SUPPLIED PUBLIC-HEALTH EVIDENCE", citedDodInstructions: [] },
    appliesToContractors: "all_travelers",
    contractualNote: null,
    trigger: { populations: "travelers to the destination", minimumStay: null, maximumStay: null, component: null, travelScope: null, conditions: input.condition ? [input.condition] : [], thresholdOrRule: null },
    exceptions: { exemptDestinations: [], exemptionCondition: null, waiverAuthority: null, policyStatus: null, notes: [] },
    effective: { status: "effective_date_not_established", effectiveFrom: null, effectiveTo: null, note: `${input.publishedAt ? `Published ${input.publishedAt}; ` : ""}guidance is current as supplied; no effective date applies to a recommendation.` },
    missingInputs: [],
    evidence: { sourceWording: null, sourceProvenance: null, sourceGaps: [], caveats: [] },
    displacedEvidence: [],
    assignmentCaveat: null,
  };
}

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

const PRIORITY: Record<RequirementStatus, number> = { REQUIRED: 5, CONDITIONAL: 4, UNKNOWN: 3, RECOMMENDED: 2, NOT_APPLICABLE: 1 };
const emptyLocation = (): MedicalApplicabilityResult["location"] => ({ id: null, name: null, command: null, commandName: null, geographicClass: null, assignmentEvidenceClass: null, assignmentProvisional: false, parentIso3: null, ambiguity: null, message: null });

function summarize(items: RequirementItem[]): Pick<MedicalApplicabilityResult, "byStatus" | "categories" | "missingInformation"> {
  const byStatus = Object.fromEntries(REQUIREMENT_STATUSES.map((status) => [status, 0])) as Record<RequirementStatus, number>;
  for (const item of items) byStatus[item.status] += 1;
  const names: RequirementCategory[] = ["immunization", "malaria_chemoprophylaxis", "infectious_disease_screening", "medical_screening", "medical_examination", "medication_equipment", "waiver_disqualifying_condition", "documentation", "clearance_process", "other"];
  const categories = {} as Record<RequirementCategory, CategorySummary>;
  for (const name of names) {
    const mine = items.filter((item) => item.category === name);
    if (!mine.length) {
      categories[name] = {
        status: "UNKNOWN", itemIds: [],
        note: REPORTED_CATEGORIES.includes(name) ? "No integrated source speaks to this category for this assignment. That is not evidence that nothing is required." : "No integrated source item in this category.",
      };
      continue;
    }
    const top = mine.reduce((best, item) => (PRIORITY[item.status] > PRIORITY[best.status] ? item : best));
    categories[name] = { status: top.status, itemIds: mine.map((item) => item.id), note: `${mine.length} item${mine.length === 1 ? "" : "s"}; highest-priority status ${top.status}.` };
  }
  const missing = new Map<string, string[]>();
  for (const item of items) for (const input of item.missingInputs) missing.set(input, [...(missing.get(input) ?? []), item.id]);
  return { byStatus, categories, missingInformation: [...missing.entries()].map(([input, neededFor]) => ({ input, neededFor })).sort((a, b) => b.neededFor.length - a.neededFor.length) };
}

function emptyLayers(): Record<AuthorityLayer, LayerCoverage> {
  return {
    combatant_command: { layer: "combatant_command", coverage: "not_evaluated", note: "Not evaluated.", items: 0 },
    dod_issuance: { layer: "dod_issuance", coverage: "not_integrated", note: "Not evaluated.", items: 0 },
    host_nation: { layer: "host_nation", coverage: "not_evaluated", note: "Not evaluated.", items: 0 },
    public_health: { layer: "public_health", coverage: "not_supplied", note: "Not evaluated.", items: 0 },
  };
}

export function resolveMedicalApplicability(query: MedicalApplicabilityQuery): MedicalApplicabilityResult {
  const now = query.now ?? new Date();
  const base = { query, scopeRules: [], requirements: [] as RequirementItem[], layers: emptyLayers(), limitations: [] as string[] };
  const empty = summarize([]);

  const located = resolveLocation(query.destination);
  if (located.status === "ambiguous_parent") {
    return { status: "LOCATION_AMBIGUOUS", ...base, ...empty, commandPolicy: null, location: { ...emptyLocation(), ambiguity: located.ambiguity, message: located.ambiguity.message }, limitations: ["No requirement is produced for an ambiguous parent: a split ISO entity has no single AOR, and a command-wide requirement must not be applied to every constituent."] };
  }
  if (located.status === "not_found") {
    return { status: "LOCATION_NOT_FOUND", ...base, ...empty, commandPolicy: null, location: { ...emptyLocation(), message: "No directory location matches. Supply a more specific country, territory or island name." }, limitations: ["The destination could not be resolved, so no AOR, command policy or host-nation rule was evaluated."] };
  }

  const record: CountryAorAssignment = located.record;
  const detail = record.directory;
  const limitations: string[] = [];
  const items: RequirementItem[] = [];

  /* --- combatant-command + DoD issuance layer ------------------------------------------------ */
  const component = query.component ?? matchComponent(query.installation ?? null, record);
  const commandQuery: CommandQuery = {
    iso3: record.iso3,
    civilianCategory: query.civilianCategory ?? null,
    contractorAuthorization: query.contractorAuthorization ?? null,
    contractRequirementsApply: query.contractRequirementsApply ?? null,
    permanentAssignmentIso3: query.permanentAssignmentIso3 ?? null,
    onDeploymentOrders: query.onDeploymentOrders ?? null,
    highRiskOrLiveFire: query.highRiskOrLiveFire ?? null,
    population: query.population ?? null,
    stayDays: query.stayDays ?? null,
    travelKind: query.travelKind ?? null,
    component,
    layoverInYfEndemicCountry: query.layoverInYfEndemicCountry ?? null,
    now,
  };
  const { resolution, evaluations } = evaluateCommandTraveler(commandQuery);
  const layers = emptyLayers();
  const scopeRules: MedicalApplicabilityResult["scopeRules"] = [];
  const caveat = resolution.assignmentQualifier?.text ?? null;

  for (const evaluation of evaluations) {
    if (SCOPE_DOMAINS.has(evaluation.rule.domain) || COMMAND_SIDE_RULES.has(evaluation.rule.id)) {
      scopeRules.push({ id: evaluation.rule.id, title: evaluation.rule.title, text: evaluation.rule.conditionOrRequirement, sourceSection: evaluation.rule.sourceSection });
      continue;
    }
    items.push(commandItem(evaluation, query, resolution.policy, record.command, caveat, now));
  }

  const commandPolicy: MedicalApplicabilityResult["commandPolicy"] = {
    policyId: resolution.policy?.policyId ?? null,
    title: resolution.policy?.policyTitle ?? null,
    status: resolution.commandMedicalPolicyStatus,
    sourceDate: resolution.policy?.sourceDate ?? null,
    effectiveFrom: resolution.policy?.effectiveFrom ?? null,
    qualifiers: resolution.policy ? policyQualifiers(resolution.policy, now) : [],
    superseded: resolution.supersededPolicies.map((policy) => ({ policyId: policy.policyId, title: policy.policyTitle, note: `Superseded${policy.supersededByPolicyId ? ` by ${policy.supersededByPolicyId}` : ""}; its rules are not evaluated and are never applied.` })),
  };
  const commandItems = items.filter((item) => item.layer === "combatant_command");
  const dodItems = items.filter((item) => item.layer === "dod_issuance");
  if (resolution.commandMedicalPolicyStatus === "NOT_PUBLICLY_VERIFIED") {
    layers.combatant_command = { layer: "combatant_command", coverage: "no_public_policy", note: `${record.command} has no public command-wide medical policy in the integrated sources. That is UNKNOWN, not "no requirement"; no other command's requirements are borrowed.`, items: 0 };
    limitations.push(`${record.command}: no public command-wide medical-entry policy located; requirements for this assignment are UNKNOWN, not absent.`);
  } else {
    const partial = commandItems.some((item) => item.evidence.sourceGaps.length > 0) || (resolution.policy?.verificationStatus ?? "").includes("UNDER REWRITE");
    layers.combatant_command = {
      layer: "combatant_command",
      coverage: partial ? "partial" : "evaluated",
      note: `${resolution.policy?.policyId ?? record.command} (${resolution.policy?.verificationStatus ?? "n/a"}) evaluated; ${commandItems.length} item${commandItems.length === 1 ? "" : "s"}.${partial ? " Some source fields were not extracted (see item evidence gaps) or the framework is under rewrite." : ""}`,
      items: commandItems.length,
    };
  }
  layers.dod_issuance = dodItems.length
    ? { layer: "dod_issuance", coverage: "partial", note: `${dodItems.length} DoD-issued item${dodItems.length === 1 ? "" : "s"} integrated (acquisition class deviation). No standalone DoD-wide medical-readiness instruction is integrated as rules; instructions that command policies cite (for example DoDI 6490.07, 3020.41) appear only as references on those items.`, items: dodItems.length }
    : { layer: "dod_issuance", coverage: "not_integrated", note: "No standalone DoD-wide medical-readiness instruction is integrated as evaluable rules. DoD instructions cited by command policies appear as references on command items. Whether a DoD-wide requirement adds to this assignment is UNKNOWN.", items: 0 };
  limitations.push("DoD-wide medical-readiness instructions are not integrated as standalone rules; only the instructions cited inside command policies are traceable (citedDodInstructions).");

  /* --- host-nation layer --------------------------------------------------------------------- */
  const iso2 = detail?.iso2 && !detail.parentIso2 ? detail.iso2 : detail?.iso2 ?? null;
  if (iso2) {
    const hostQuery: HostQuery = {
      destination: iso2, arrivingFrom: query.arrivingFrom ?? null, visitedCountries: query.visitedCountries ?? [], transit: query.transit ?? [],
      ageYears: query.ageYears ?? null, stayDays: query.stayDays ?? null, now,
    };
    const hostEvaluations = evaluateHostTraveler(hostQuery, VACCINE_RULES).evaluations;
    const hostItems = hostEvaluations.map((evaluation) => hostItem(evaluation, now));
    items.push(...hostItems);
    const answers = describeCountry(iso2, now);
    layers.host_nation = {
      layer: "host_nation",
      coverage: hostItems.length ? "partial" : "no_rule_in_source_set",
      note: hostItems.length
        ? `${hostItems.length} host-nation rule${hostItems.length === 1 ? "" : "s"} evaluated (${answers.anyVerifiedRequirement}). The configured set covers yellow fever, polio, meningococcal and COVID-19 entry / exit rules only.`
        : `No host-nation vaccine rule for ${iso2} is in the configured source set (${answers.anyVerifiedRequirement}). That is not evidence that none exists.`,
      items: hostItems.length,
    };
  } else {
    layers.host_nation = { layer: "host_nation", coverage: "not_evaluated", note: "This location has no ISO 3166 country code of its own, so no host-nation rule was matched. Host-nation requirements are UNKNOWN.", items: 0 };
  }
  limitations.push("Host-nation checks cover the configured vaccine rule set only; other national entry medical requirements and status-of-forces treatment are not modeled.");

  /* --- public-health layer ------------------------------------------------------------------- */
  if (query.publicHealth) {
    const publicItems = query.publicHealth.map(publicHealthItem);
    items.push(...publicItems);
    layers.public_health = { layer: "public_health", coverage: "evaluated", note: `${publicItems.length} supplied CDC / WHO item${publicItems.length === 1 ? "" : "s"}; recommendations only.`, items: publicItems.length };
  } else {
    layers.public_health = { layer: "public_health", coverage: "not_supplied", note: "No CDC / WHO guidance was supplied for this destination, so malaria risk, travel vaccines and outbreak notices are UNKNOWN here (the live adapters provide them).", items: 0 };
    limitations.push("CDC / WHO guidance was not supplied; malaria chemoprophylaxis and public-health vaccine recommendations are UNKNOWN until it is.");
  }

  if (query.installation && !component) limitations.push(`Installation "${query.installation}" matched no component or site named by the integrated sources; installation-specific medical requirements are UNKNOWN.`);
  if (detail?.provisional) limitations.push(`The geographic assignment for ${record.name} is PROVISIONAL; command rules are shown as UNKNOWN until it is confirmed.`);
  if (resolution.supersededPolicies.length) limitations.push(`Superseded policy versions (${resolution.supersededPolicies.map((policy) => policy.policyId).join(", ")}) are kept for traceability and are not applied.`);

  const sorted = items.sort((a, b) => PRIORITY[b.status] - PRIORITY[a.status] || a.layer.localeCompare(b.layer) || a.id.localeCompare(b.id));
  return {
    status: "EVALUATED",
    query,
    location: {
      id: record.iso3, name: record.name, command: record.command, commandName: COMMAND_NAMES[record.command], geographicClass: record.geographicClass,
      assignmentEvidenceClass: detail?.evidenceClass ?? null, assignmentProvisional: detail?.provisional ?? false, parentIso3: detail?.parentIso3 ?? null, ambiguity: null, message: null,
    },
    commandPolicy,
    requirements: sorted,
    scopeRules,
    layers,
    limitations,
    ...summarize(sorted),
  };
}

/** An installation resolves to a component only when its name contains a component the integrated sources actually name. */
function matchComponent(installation: string | null, record: CountryAorAssignment): string | null {
  if (!installation) return null;
  const text = installation.toLowerCase();
  const known = ["USFK", "USARPAC", "PACAF", "PACFLT", "MARFORPAC", "SOCPAC", "USAREUR-AF", "USAFE", "NAVEUR-AF", "MARFOREUR-AF", "SOCEUR", "SOCAFRICA", "CJTF-HOA"];
  void record;
  return known.find((name) => text.includes(name.toLowerCase())) ?? null;
}

