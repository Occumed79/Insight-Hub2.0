// Command medical / Force Health Protection policy data, transcribed from the Insight Hub 2 AOR Command & Theater
// Medical Policy Extraction Pack (sections 5–10). Nothing here was re-read from the original PDFs.
//
//  - Only values the pack states are populated. Fields the source document contains but the pack did not extract are
//    listed in `sourceGaps` (open the source only when a feature needs the field or the source monitor reports a change).
//  - Thresholds are never carried from one command to another.
//  - USNORTHCOM has no public command-wide medical-entry policy in the pack: it is recorded as NOT_PUBLICLY_VERIFIED.

import type { CommandPolicy, CommandPolicyRule, CommandRuleKind, PolicyDomain, PolicyStatus, PolicyVerificationStatus, Population, RuleScope, StayThreshold } from "./types";

/** Date the pack's extraction was ingested. The pack states research "through October 2026". */
export const PACK_RETRIEVED_AT = "2026-10-09";

const ALL_DOD: Population[] = ["us_military", "dod_civilian", "dod_contractor", "volunteer", "interagency"];
const CMD: RuleScope = { level: "command", component: null, countries: [] };

type RuleInit = {
  id: string;
  domain: PolicyDomain;
  title: string;
  conditionOrRequirement: string;
  kind?: CommandRuleKind;
  scope?: RuleScope;
  populations?: Population[];
  populationText?: string;
  directedPopulations?: Population[];
  minimumStay?: StayThreshold | null;
  pcsOnly?: boolean;
  contingencyOnly?: boolean;
  maximumStayDaysExclusive?: number | null;
  thresholdOrRule?: string | null;
  status?: PolicyStatus | null;
  waiverAuthority?: string | null;
  requiredEvaluation?: string | null;
  requiredDocumentation?: string | null;
  medicationOrEquipmentRule?: string | null;
  immunizationOrProphylaxisRule?: string | null;
  sourceSection: string;
  sourceUrl?: string;
  sourceGaps?: string[];
  caveats?: string[];
  verificationStatus?: PolicyVerificationStatus;
};

function factory(policyId: string, defaultUrl: string, sourceDate: string | null, verification: PolicyVerificationStatus) {
  return (init: RuleInit): CommandPolicyRule => ({
    id: init.id,
    policyId,
    domain: init.domain,
    kind: init.kind ?? "requirement",
    scope: init.scope ?? CMD,
    applicabilityPopulation: init.populations ?? [],
    populationText: init.populationText ?? "",
    directedPopulations: init.directedPopulations ?? [],
    minimumStay: init.minimumStay ?? null,
    pcsOnly: init.pcsOnly ?? false,
    contingencyOnly: init.contingencyOnly ?? false,
    maximumStayDaysExclusive: init.maximumStayDaysExclusive ?? null,
    title: init.title,
    conditionOrRequirement: init.conditionOrRequirement,
    thresholdOrRule: init.thresholdOrRule ?? null,
    status: init.status ?? null,
    waiverAuthority: init.waiverAuthority ?? null,
    requiredEvaluation: init.requiredEvaluation ?? null,
    requiredDocumentation: init.requiredDocumentation ?? null,
    medicationOrEquipmentRule: init.medicationOrEquipmentRule ?? null,
    immunizationOrProphylaxisRule: init.immunizationOrProphylaxisRule ?? null,
    sourceSection: init.sourceSection,
    sourceUrl: init.sourceUrl ?? defaultUrl,
    sourceDate,
    verificationStatus: init.verificationStatus ?? verification,
    sourceGaps: init.sourceGaps ?? [],
    caveats: init.caveats ?? [],
  });
}

const over = (days: number, basis: string): StayThreshold => ({ days, inclusive: false, basis });
const atLeast = (days: number, basis: string): StayThreshold => ({ days, inclusive: true, basis });

/* ------------------------------------------------------------------ */
/* USCENTCOM — MOD 18 (supersedes MOD 17), Tabs A–D                    */
/* ------------------------------------------------------------------ */

const CC_PAGE = "https://www.centcom.mil/CONTACT/THEATRE-MEDICAL-REQUIREMENTS/THEATRE-MEDICAL-CLEARANCE/";
const CC_MOD18 = "https://www.centcom.mil/Portals/6/MEDICAL/MOD18FINALV2.pdf";
const CC_TAB_A = "https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabAFINAL.pdf";
const CC_TAB_B = "https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabB.pdf";
const CC_TAB_D = "https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabD.pdf";
const cc = factory("CENTCOM-MOD18", CC_MOD18, "2025-08-19", "COMMAND PUBLICATION (PACK-EXTRACTED)");
const CC_DEPLOYMENT = over(30, "MOD 18 deployment definition: expected or actual in-country time over 30 days, excluding transit/travel time");
const CC_NOT_ALL_SHORT = "Stays of 30 days or fewer fall outside the MOD 18 deployment definition as extracted. That is not evidence that no theater requirement exists for a short visit; short-stay and clearance requirements were not extracted (SOURCE_GAP).";

const centcomRules: CommandPolicyRule[] = [
  cc({ id: "cc:applicability", domain: "applicability", title: "Who MOD 18 applies to", sourceUrl: CC_PAGE, sourceSection: "Theatre Medical Clearance page / MOD 18 applicability",
    populations: ["us_military", "dod_civilian", "dod_contractor", "volunteer", "working_dog", "tcn"],
    populationText: "U.S. military including activated Reserve/Guard; DoD civilians; DoD contractors/subcontractors; volunteers; military/contract working dogs; TCNs under DoD auspices. Local nationals follow specified minimum standards.",
    conditionOrRequirement: "MOD 18 theater medical entry requirements apply to the populations listed.", sourceGaps: ["local-national minimum standards"] }),
  cc({ id: "cc:deployment-definition", domain: "deployment_definition", title: "MOD 18 deployment definition (duration trigger)", sourceSection: "MOD 18 — deployment definition",
    populations: ALL_DOD, conditionOrRequirement: "For medical purposes a deployment is travel to/through the CENTCOM AOR with expected or actual in-country time over 30 days, excluding transit/travel time. Shipboard operations not anticipated to involve operations ashore are largely exempt beyond sea-duty and current readiness requirements.",
    thresholdOrRule: ">30 days in-country (transit excluded)", minimumStay: CC_DEPLOYMENT, caveats: [CC_NOT_ALL_SHORT] }),
  cc({ id: "cc:medical-readiness", domain: "fitness", title: "Provider evaluation and medical readiness", sourceSection: "MOD 18 — medical readiness",
    populations: ALL_DOD, minimumStay: CC_DEPLOYMENT, status: "conditional",
    conditionOrRequirement: "Deploying personnel require provider evaluation. Personnel unable to meet theater requirements are non-deployable unless the condition resolves or an approved waiver is obtained.",
    requiredEvaluation: "Provider evaluation before deployment", waiverAuthority: "CENTCOM Surgeon and/or delegated Service Component Surgeon (the evaluating clinic or local commander is not final authority)" }),
  cc({ id: "cc:core-functional-fitness", domain: "fitness", title: "Core functional fitness", sourceSection: "MOD 18 — core functional fitness",
    populations: ALL_DOD, minimumStay: CC_DEPLOYMENT,
    conditionOrRequirement: "Must be able to perform required duties in the deployed environment, wear ballistic/respiratory/safety/chemical/biological PPE, use required prophylaxis, and safely ingress/egress in emergencies." }),
  cc({ id: "cc:physical-validity", domain: "documentation", title: "Physical examination validity", sourceSection: "MOD 18 — physical validity",
    populations: ALL_DOD, minimumStay: CC_DEPLOYMENT,
    conditionOrRequirement: "A completed examination remains valid up to 15 months from the physical date or 12 months after deployment, whichever comes first. Extended/multiple-tour civilians and contractors require periodic re-evaluation.",
    thresholdOrRule: "15 months from physical date, or 12 months after deployment — whichever is first", requiredDocumentation: "Current physical examination", sourceGaps: ["re-evaluation interval for extended/multiple-tour civilians and contractors"] }),
  cc({ id: "cc:medication-supply", domain: "medication", title: "Medication supply", sourceSection: "MOD 18 / command surgeon memo — medication supply",
    populations: ALL_DOD, minimumStay: CC_DEPLOYMENT,
    conditionOrRequirement: "Deployers/travelers bring medications and prescription products for the deployment duration. For deployments over 30 days the command surgeon memo specifies a minimum 90-day supply, subject to stated exceptions such as controlled substances, shortages, quantity limits, or shelf-life.",
    thresholdOrRule: "Minimum 90-day supply for deployments over 30 days", medicationOrEquipmentRule: "Bring medications for the deployment duration; minimum 90-day supply (>30-day deployments) with exceptions", sourceGaps: ["exact exception wording"] }),
  cc({ id: "cc:immunization-prophylaxis", domain: "immunization_prophylaxis", title: "Immunization / prophylaxis (command rule)", sourceSection: "MOD 18 / command surgeon memo — immunizations and chemoprophylaxis",
    populations: ALL_DOD, minimumStay: CC_DEPLOYMENT,
    conditionOrRequirement: "MOD 18 and the command surgeon memo update pre-deployment requirements involving malaria, rabies, anthrax, and religious waiver / accommodation processes. These are command-policy rules, distinct from CDC travel advice and from host-nation entry law.",
    immunizationOrProphylaxisRule: "Command requirement; specific agents and schedules not extracted", sourceGaps: ["per-agent requirements (malaria, rabies, anthrax)", "religious waiver / accommodation process steps"],
    caveats: ["LIVE VERIFY: open the MOD 18 immunization section before stating any specific vaccine or drug requirement."] }),
  cc({ id: "cc:waiver-authority", domain: "waiver", kind: "process", title: "Waiver authority", sourceSection: "MOD 18 — waiver authority",
    populations: ALL_DOD, conditionOrRequirement: "Final waiver authority rests with the CENTCOM Surgeon and/or delegated Service Component Surgeon waiver authorities; the evaluating clinic or local commander is not final authority.",
    waiverAuthority: "CENTCOM Surgeon and/or delegated Service Component Surgeon waiver authorities", sourceGaps: ["component waiver contact list"] }),
  cc({ id: "cc:contractor-over-12-months", domain: "duration", title: "Contractors remaining in theater over 12 months", sourceSection: "MOD 18 — contractor duration",
    populations: ["dod_contractor"], minimumStay: over(365, "contract personnel remaining in theater more than 12 months"), status: "waiver-required",
    conditionOrRequirement: "Contract personnel remaining in theater over 12 months must seek a renewed waiver before expiration and submit updated health information when a waiver is required.",
    thresholdOrRule: ">12 months in theater", requiredDocumentation: "Updated health information when a waiver is required", waiverAuthority: "CENTCOM Surgeon and/or delegated Service Component Surgeon" }),
  cc({ id: "cc:cbrn-tab-d", domain: "cbrn", title: "CBRN medical defense materiel (Tab D)", sourceUrl: CC_TAB_D, sourceSection: "MOD 18 Tab D",
    populations: ["us_military", "dod_civilian"], directedPopulations: ["dod_contractor"], minimumStay: atLeast(15, "Tab D applies to personnel deployed/PCS to CENTCOM for 15 days or more"),
    populationText: "Military and DoD civilians; selected contractors as directed.", conditionOrRequirement: "Defines theater medical CBRN defense materiel and contingency-stock expectations.",
    medicationOrEquipmentRule: "Theater medical CBRN defense materiel and contingency-stock expectations (details not extracted)", sourceGaps: ["materiel list and quantities", "which contractors are directed"] }),

  // MOD 18 Tab A — condition-level rules (Tab A is not exhaustive).
  cc({ id: "cc:taba:framework", domain: "condition", kind: "process", title: "Tab A framework (not exhaustive)", sourceUrl: CC_TAB_A, sourceSection: "MOD 18 Tab A — general",
    populations: ALL_DOD, minimumStay: CC_DEPLOYMENT,
    conditionOrRequirement: "Tab A is not exhaustive. Evaluators must consider climate, altitude, food/housing, and the availability of medical, behavioral-health, dental, surgical and laboratory services at the deployment location. A chart review of new/active diagnoses and medications over the prior 12 months is recommended when reviewing a condition that may require waiver. DoD civilians may still deploy with a disqualifying condition after individualized assessment and an appropriate waiver if they can perform essential functions.",
    requiredEvaluation: "Individualized assessment; 12-month chart review for conditions that may need a waiver" }),
  cc({ id: "cc:taba:osa-mild", domain: "condition", title: "Obstructive sleep apnea — mild", sourceUrl: CC_TAB_A, sourceSection: "MOD 18 Tab A — OSA", populations: ALL_DOD, minimumStay: CC_DEPLOYMENT, status: "deployable",
    conditionOrRequirement: "Mild OSA requires no waiver.", thresholdOrRule: "AHI/RDI <15/hr" }),
  cc({ id: "cc:taba:osa-moderate", domain: "condition", title: "Obstructive sleep apnea — moderate", sourceUrl: CC_TAB_A, sourceSection: "MOD 18 Tab A — OSA", populations: ALL_DOD, minimumStay: CC_DEPLOYMENT, status: "conditional",
    conditionOrRequirement: "Moderate OSA may avoid a waiver if the person is asymptomatic, PAP-compliant, and has an Epworth score under 10.", thresholdOrRule: "AHI/RDI 15–30/hr; Epworth <10; PAP use ≥4 h/night on >70% of nights over 30 days",
    medicationOrEquipmentRule: "PAP users deploy with rechargeable battery backup and sufficient supplies" }),
  cc({ id: "cc:taba:osa-severe", domain: "condition", title: "Obstructive sleep apnea — severe", sourceUrl: CC_TAB_A, sourceSection: "MOD 18 Tab A — OSA", populations: ALL_DOD, minimumStay: CC_DEPLOYMENT, status: "waiver-required",
    conditionOrRequirement: "Severe OSA requires a waiver; AHI over 60/hr requires a specialist deployment recommendation.", thresholdOrRule: "AHI/RDI >30/hr (waiver); >60/hr (specialist deployment recommendation)",
    requiredEvaluation: "Specialist deployment recommendation when AHI >60/hr", medicationOrEquipmentRule: "PAP users deploy with rechargeable battery backup and sufficient supplies; PAP compliance ≥4 h/night on >70% of nights over 30 days" }),
  cc({ id: "cc:taba:osa-symptomatic", domain: "condition", title: "Obstructive sleep apnea — symptomatic", sourceUrl: CC_TAB_A, sourceSection: "MOD 18 Tab A — OSA", populations: ALL_DOD, minimumStay: CC_DEPLOYMENT, status: "non-waivable",
    conditionOrRequirement: "Symptomatic OSA is non-waivable regardless of severity." }),
  cc({ id: "cc:taba:osa-advanced", domain: "condition", title: "Sleep apnea — advanced ventilation, complex or central", sourceUrl: CC_TAB_A, sourceSection: "MOD 18 Tab A — OSA", populations: ALL_DOD, minimumStay: CC_DEPLOYMENT, status: "conditional",
    conditionOrRequirement: "Advanced ventilation modes, complex sleep apnea or central sleep apnea are non-deployable.", sourceGaps: ["whether a waiver is available for these"], caveats: ["The pack states 'non-deployable' and does not say whether a waiver is available; status is recorded as conditional, not as non-waivable."] }),
  cc({ id: "cc:taba:tbi", domain: "condition", title: "Traumatic brain injury", sourceUrl: CC_TAB_A, sourceSection: "MOD 18 Tab A — TBI", populations: ALL_DOD, minimumStay: CC_DEPLOYMENT, status: "conditional",
    conditionOrRequirement: "A single mild TBI may deploy after provider release and 24 hours symptom-free. A second mTBI within 12 months requires seven days symptom-free plus provider release. Three clinically diagnosed TBIs require neurologic and psychological evaluation before a deployability determination.",
    thresholdOrRule: "1 mTBI: provider release + 24 h symptom-free; 2nd mTBI <12 months: 7 days symptom-free + release; 3 TBIs: neurologic + psychological evaluation", requiredEvaluation: "Provider release; neurologic and psychological evaluation after three TBIs" }),
  cc({ id: "cc:taba:weight", domain: "condition", title: "Body weight", sourceUrl: CC_TAB_A, sourceSection: "MOD 18 Tab A — weight", populations: ALL_DOD, minimumStay: CC_DEPLOYMENT, status: "conditional",
    conditionOrRequirement: "Weight over 136 kg (300 lb) is incompatible with the deployed environment.", thresholdOrRule: ">136 kg (300 lb)", sourceGaps: ["waiver availability for this condition"] }),
  cc({ id: "cc:taba:ckd", domain: "condition", title: "Chronic kidney disease, stage I/II", sourceUrl: CC_TAB_A, sourceSection: "MOD 18 Tab A — CKD", populations: ALL_DOD, minimumStay: CC_DEPLOYMENT, status: "waiver-required",
    conditionOrRequirement: "Documented minimum six months of stability is expected before waiver approval.", thresholdOrRule: "≥6 months documented stability" }),
  cc({ id: "cc:taba:pregnancy", domain: "condition", title: "Pregnancy", sourceUrl: CC_TAB_A, sourceSection: "MOD 18 Tab A — pregnancy", populations: ALL_DOD, minimumStay: CC_DEPLOYMENT, status: "conditional",
    conditionOrRequirement: "Pregnancy is listed as a deployment-limiting condition.", sourceGaps: ["waiver availability and gestational limits"] }),
  cc({ id: "cc:taba:gender-dysphoria", domain: "condition", title: "Gender dysphoria (DoD civilians / contractors)", sourceUrl: CC_TAB_A, sourceSection: "MOD 18 Tab A — gender dysphoria", populations: ["dod_civilian", "dod_contractor"], minimumStay: CC_DEPLOYMENT, status: "waiver-required",
    conditionOrRequirement: "DoD civilians/contractors require a waiver with relevant underlying issues stable or resolved; host-nation law still controls. Uniformed members with a diagnosis are addressed under current Service/DoD policy cited by MOD 18.", sourceGaps: ["uniformed-member policy citation"] }),

  // MOD 18 Tab B — PCS.
  cc({ id: "cc:tabb:pcs", domain: "pcs", title: "PCS medical clearance (Tab B)", sourceUrl: CC_TAB_B, sourceSection: "MOD 18 Tab B", pcsOnly: true, populations: ["us_military", "dod_civilian", "dependent"],
    conditionOrRequirement: "Tab B applies to PCS personnel and identifies conditions that may deny medical clearance/PCS. Specified MOD 18 requirements continue to apply to PCS personnel, including medical readiness, fitness, pharmacy supply, psychotropic/controlled medications, TMOP, non-permitted medical equipment, immunizations, PHA, medical records and local animal contact.", sourceGaps: ["Tab B condition list"] }),
  cc({ id: "cc:tabb:family", domain: "pcs", title: "PCS family members", sourceUrl: CC_TAB_B, sourceSection: "MOD 18 Tab B — family", pcsOnly: true, populations: ["dependent"], status: "conditional",
    conditionOrRequirement: "Family members require EFMP assessment and receiving-facility / TRICARE Eurasia approval. CENTCOM does not adjudicate dependent waivers.", waiverAuthority: "Not CENTCOM — receiving facility / TRICARE Eurasia", requiredEvaluation: "EFMP assessment" }),
  cc({ id: "cc:tabb:pregnancy", domain: "pcs", title: "PCS pregnancy / delivery", sourceUrl: CC_TAB_B, sourceSection: "MOD 18 Tab B — pregnancy", pcsOnly: true, populations: ["us_military", "dependent"],
    conditionOrRequirement: "Pregnant Service Members/spouses should plan delivery outside the CENTCOM AOR as directed by TRICARE Eurasia." }),
  cc({ id: "cc:tabb:behavioral", domain: "pcs", title: "PCS behavioral-health resource limits", sourceUrl: CC_TAB_B, sourceSection: "MOD 18 Tab B — behavioral health", pcsOnly: true, populations: ["us_military", "dod_civilian", "dependent"], status: "conditional",
    conditionOrRequirement: "Behavioral-health resource limitations require receiving-care approval for concerning conditions before PCS approval.", requiredEvaluation: "Receiving-care approval" }),
];

/* ------------------------------------------------------------------ */
/* USAFRICOM — ACI 4200.09C and FHP supplements                        */
/* ------------------------------------------------------------------ */

const AF_PAGE = "https://www.africom.mil/Img//Large/theater-medical-clearance";
const AF_YF = "https://www.africom.mil/document/36281/yellow-fever-vaccination-requirements-for-the-usafricom-theater";
const AF_MALARIA = "https://www.africom.mil/document/36283/update-to-malaria-chemoprophylaxis-for-entry-to-the-usafricom-theater";
const AF_LIBRARY = "https://www.africom.mil/media-gallery/documents";
const af = factory("AFRICOM-ACI-4200.09C", AF_PAGE, "2026-06-01", "COMMAND PUBLICATION (PACK-EXTRACTED)");
const AF_POP: Population[] = ["us_military", "dod_civilian", "dod_contractor", "volunteer", "interagency"];
const HOA = ["BDI", "DJI", "ERI", "ETH", "KEN", "RWA", "SYC", "SOM", "SSD", "SDN", "TZA", "UGA"];

const africomRules: CommandPolicyRule[] = [
  af({ id: "af:applicability", domain: "applicability", title: "Who ACI 4200.09C applies to", populations: AF_POP, sourceSection: "Theater Medical Clearance page",
    populationText: "All U.S. military on official or leisure travel; DoD civilians, contractors, subcontractors and volunteers on official travel; and U.S. interagency personnel supporting AFRICOM missions. The public page states the instruction applies for travel of any duration.",
    conditionOrRequirement: "Force health protection instruction applies to travel of any duration.", thresholdOrRule: "Any duration", sourceGaps: ["clearance procedure steps", "condition-level standards"] }),
  af({ id: "af:waiver-delegation", domain: "waiver", kind: "process", title: "Waiver authority delegation", populations: AF_POP, sourceSection: "ACI 4200.09C — waivers",
    conditionOrRequirement: "Waiver authority is delegated to command / component / JTF surgeons according to the supported organization and location.", waiverAuthority: "Command / component / JTF surgeon, by supported organization and location" }),
  af({ id: "af:waiver-socafrica", domain: "waiver", kind: "process", scope: { level: "component", component: "SOCAFRICA", countries: [] }, title: "Waiver routing — SOCAFRICA", populations: AF_POP, sourceSection: "ACI 4200.09C — waivers",
    conditionOrRequirement: "The SOCAFRICA Command Surgeon holds waiver authority for SOF and personnel deploying in support of SOCAFRICA, regardless of location.", waiverAuthority: "SOCAFRICA Command Surgeon" }),
  af({ id: "af:waiver-cjtf-hoa", domain: "waiver", kind: "process", scope: { level: "country", component: "CJTF-HOA", countries: HOA }, title: "Waiver routing — CJTF-HOA geography", populations: AF_POP, sourceSection: "ACI 4200.09C — waivers",
    conditionOrRequirement: "CJTF-HOA Surgeon waiver geography explicitly includes Burundi, Djibouti, Eritrea, Ethiopia, Kenya, Rwanda, Seychelles, Somalia, South Sudan, Sudan, Tanzania and Uganda. Whether it governs a given traveler depends on the supported command.",
    waiverAuthority: "CJTF-HOA Surgeon (depending on supported command)", caveats: ["Applies only where the traveler is supported by CJTF-HOA; otherwise another command / component surgeon routes the waiver."] }),
  af({ id: "af:supplement:yellow-fever", domain: "supplement", title: "Yellow Fever — theater vaccination requirement (command rule)", sourceUrl: AF_YF, sourceSection: "FHP supplement: Yellow Fever vaccination requirements for the USAFRICOM theater (Jun 2024, republished Mar 2026)",
    populations: AF_POP, conditionOrRequirement: "AFRICOM publishes a theater Yellow Fever vaccination requirement. It is a command requirement and is kept separate from host-nation entry rules and from CDC recommendations. Which countries/areas and exemptions it covers were not extracted.",
    immunizationOrProphylaxisRule: "Command Yellow Fever vaccination requirement for the theater (scope not extracted)", sourceGaps: ["countries / areas covered", "exemptions and documentation", "validity"],
    caveats: ["LIVE VERIFY: read the AFRICOM Yellow Fever message before stating who must be vaccinated."] }),
  af({ id: "af:supplement:malaria", domain: "supplement", title: "Malaria chemoprophylaxis for theater entry (command rule)", sourceUrl: AF_MALARIA, sourceSection: "FHP supplement: update to malaria chemoprophylaxis for entry to the USAFRICOM theater (Jul 2025, republished Mar 2026)",
    populations: AF_POP, conditionOrRequirement: "Command-specific malaria chemoprophylaxis logic for theater entry, citing WHO, CDC, DHA deployment-health procedures and AFRICOM campaign health-service guidance. Implemented as a command rule, not as a generic CDC travel recommendation.",
    immunizationOrProphylaxisRule: "Command malaria chemoprophylaxis requirement (agents, countries and exceptions not extracted)", sourceGaps: ["agents and regimens", "countries / areas", "exceptions"],
    caveats: ["LIVE VERIFY: read the AFRICOM malaria update before stating any drug or country scope."] }),
  af({ id: "af:supplement:chikungunya", domain: "supplement", title: "Chikungunya outbreak measures (FHP update)", sourceUrl: AF_LIBRARY, sourceSection: "FHP supplement: chikungunya outbreak measures (2025 update)",
    populations: AF_POP, conditionOrRequirement: "AFRICOM publishes chikungunya outbreak measures as a force-health-protection update.", sourceGaps: ["measures, countries and dates"] }),
  af({ id: "af:supplement:mpox", domain: "supplement", title: "Mpox guidance (FHP update)", sourceUrl: AF_LIBRARY, sourceSection: "FHP supplement: mpox guidance (Oct 2024)",
    populations: AF_POP, kind: "recommendation", conditionOrRequirement: "AFRICOM publishes mpox guidance as a force-health-protection update.", sourceGaps: ["guidance content and whether any element is mandatory"] }),
];

/* ------------------------------------------------------------------ */
/* USEUCOM — ECI 4202.01A                                              */
/* ------------------------------------------------------------------ */

const EU_PAGE = "https://www.eucom.mil/staff-resources/eucom-theatre-medical-clearance-information";
const EU_ECI = "https://www.eucom.mil/documents/43211/eci-420201apdf";
const EU_LIBRARY = "https://www.eucom.mil/media-gallery/documents";
const eu = factory("EUCOM-ECI-4202.01A", EU_ECI, "2019-07-03", "COMMAND PUBLICATION — UNDER REWRITE");
const EU_POP: Population[] = ["us_military", "dod_civilian", "dod_contractor", "volunteer", "interagency"];
const euComponent = (component: string, extra: Partial<RuleInit> = {}) =>
  eu({ id: `eu:waiver:${component.toLowerCase()}`, domain: "waiver", kind: "process", scope: { level: "component", component, countries: [] }, title: `Waiver routing — ${component}`, sourceUrl: EU_PAGE, populations: EU_POP, sourceSection: "Theatre Medical Clearance page — waiver routing",
    conditionOrRequirement: `Waiver routing is component-specific; ${component} is a named waiver-routing component.`, waiverAuthority: `${component} (component-specific routing)`, sourceGaps: ["contact details", "case types routed to this component"], ...extra });

const eucomRules: CommandPolicyRule[] = [
  eu({ id: "eu:applicability", domain: "applicability", title: "Who ECI 4202.01A applies to", sourceUrl: EU_PAGE, populations: EU_POP, sourceSection: "Theatre Medical Clearance page (current as of 24 Jul 2025)",
    populationText: "U.S. military on official or leisure travel; DoD civilians, contractors, subcontractors, volunteers on official travel; U.S. interagency personnel supporting EUCOM missions. The public page states it applies for travel of any duration.",
    conditionOrRequirement: "Theater medical framework applies for travel of any duration.", thresholdOrRule: "Any duration", sourceGaps: ["uniform standards — ECI delegates standards to components"] }),
  eu({ id: "eu:component-readiness", domain: "fitness", kind: "process", title: "Medical readiness set by Service Component Commanders", populations: EU_POP, sourceSection: "ECI 4202.01A — delegation",
    conditionOrRequirement: "ECI 4202.01A delegates to Service Component Commanders the responsibility to determine medical readiness and fitness requirements for personnel participating in EUCOM missions/operations.", waiverAuthority: "Service Component Commanders (component-specific)",
    caveats: ["The framework is under rewrite. There is no single EUCOM-wide threshold table to apply; the supporting component's requirements govern."] }),
  eu({ id: "eu:waiver-routing-eucom", domain: "waiver", kind: "process", title: "Some cases remain EUCOM Surgeon-level", sourceUrl: EU_PAGE, populations: EU_POP, sourceSection: "Theatre Medical Clearance page — waiver routing",
    conditionOrRequirement: "Waiver routing is component-specific, but some cases remain EUCOM Surgeon-level.", waiverAuthority: "EUCOM Surgeon (for cases not routed to a component)", sourceGaps: ["which cases remain EUCOM Surgeon-level"] }),
  euComponent("USAREUR-AF"), euComponent("USAFE"), euComponent("NAVEUR-AF"), euComponent("MARFOREUR-AF"), euComponent("SOCEUR"),
  eu({ id: "eu:contractor", domain: "waiver", kind: "process", scope: { level: "component", component: "USAREUR-AF", countries: [] }, title: "Contractors — consult the supported component", sourceUrl: EU_PAGE, populations: ["dod_contractor"], sourceSection: "Theatre Medical Clearance public FAQ",
    conditionOrRequirement: "The public FAQ directs contractor companies to consult the supported component. USAREUR does not review or approve contractor waivers; the company is responsible for determining fitness for deployment while recognizing reliance on host-nation medical care.",
    waiverAuthority: "Not USAREUR for contractor waivers — consult the supported component" }),
  eu({ id: "eu:tbe", domain: "guidance", kind: "recommendation", title: "Tick-borne encephalitis vaccine recommendation memo (command FHP guidance)", sourceUrl: EU_LIBRARY, populations: EU_POP, sourceSection: "EUCOM document library — TBE vaccine recommendation memo (Mar 2026)",
    conditionOrRequirement: "EUCOM publishes a Tick-borne Encephalitis vaccine recommendation memo. Represented as command FHP guidance, not host-nation law and not a mandatory requirement.",
    immunizationOrProphylaxisRule: "Command TBE vaccine recommendation (recommendation only)", sourceGaps: ["countries / areas, risk criteria and schedule"] }),
];

/* ------------------------------------------------------------------ */
/* USINDOPACOM — FY26 Force Health Protection Guidance (P-25-0295)     */
/* ------------------------------------------------------------------ */

const IP_PAGE = "https://www.pacom.mil/Resources/Travel-Requirements/";
const IP_FHP = "https://www.pacom.mil/Portals/55/Documents/Surgeon/FY26%20Force%20Health%20Protection%20Guidance%20for%20USINDOPACOM%20AOR.pdf?ver=BeAhcnVciTeRV1jWl1x5BA%3D%3D";
const ip = factory("INDOPACOM-FY26-FHP-P-25-0295", IP_FHP, null, "COMMAND PUBLICATION (PACK-EXTRACTED)");
const IP_POP: Population[] = ["us_military", "dod_civilian", "dod_contractor"];
const ipWaiver = (component: string) =>
  ip({ id: `ip:waiver:${component.toLowerCase()}`, domain: "waiver", kind: "process", scope: { level: "component", component, countries: [] }, title: `Waiver contact — ${component}`, populations: IP_POP, sourceSection: "FY26 FHP Guidance — component waiver contacts",
    conditionOrRequirement: `${component} is a named component waiver contact in the public guidance.`, waiverAuthority: component, sourceGaps: ["contact details", "case types"] });

const indopacomRules: CommandPolicyRule[] = [
  ip({ id: "ip:order", domain: "applicability", kind: "process", title: "GENADMIN P-25-0295 — FY2026 FHP Guidance (active until cancelled)", sourceUrl: IP_PAGE, populations: IP_POP, sourceSection: "USINDOPACOM Travel Requirements page / GENADMIN P-25-0295",
    conditionOrRequirement: "USINDOPACOM GENADMIN P-25-0295, FY2026 Force Health Protection Guidance for the USINDOPACOM AOR, is active until cancelled. Responsible office: J07 / Office of the Command Surgeon.",
    sourceGaps: ["population definition", "stay-duration triggers", "condition standards", "immunization requirements"],
    caveats: ["Duration triggers, populations and immunization rules were not extracted. Do not assume CENTCOM's or SOUTHCOM's 30-day thresholds apply."] }),
  ip({ id: "ip:references", domain: "guidance", kind: "process", title: "Authorities cited by the guidance", populations: IP_POP, sourceSection: "FY26 FHP Guidance — references",
    conditionOrRequirement: "Cites DoDI 6490.03 Deployment Health, DHA-PI 6490.03, DoDI 6490.07 deployment-limiting conditions, DoDD 6200.04 Force Health Protection, DoDI 3020.41 Operational Contract Support Outside the United States, joint immunization/chemoprophylaxis guidance, current USFK FHP policy, CDC Travelers Health, ACIP and other theater references." }),
  ip({ id: "ip:waiver-reporting", domain: "documentation", title: "Waiver reporting data elements", populations: IP_POP, sourceSection: "FY26 FHP Guidance — waiver reporting",
    conditionOrRequirement: "Waiver reporting tracks member identity, DoD ID, UIC, theater entry date, order duration, condition, and waiver disposition.",
    requiredDocumentation: "Member identity, DoD ID, UIC, theater entry date, order duration, condition, waiver disposition" }),
  ipWaiver("USINDOPACOM"), ipWaiver("USARPAC"), ipWaiver("PACAF"),
  ip({ id: "ip:waiver-others", domain: "waiver", kind: "process", title: "Other component waiver contacts", populations: IP_POP, sourceSection: "FY26 FHP Guidance — component waiver contacts",
    conditionOrRequirement: "The public guidance lists further component waiver contacts beyond USINDOPACOM, USARPAC and PACAF.", sourceGaps: ["remaining component contacts"] }),
  ip({ id: "ip:usfk", domain: "supplement", kind: "process", scope: { level: "country", component: "USFK", countries: ["KOR"] }, title: "USFK subordinate FHP policy (inherits, may add rules)", populations: IP_POP, sourceSection: "FY26 FHP Guidance — subordinate requirements",
    conditionOrRequirement: "Country- and component-specific subordinate requirements (for example USFK) may add theater rules. The command policy is inherited by the component policy; it is not flattened into one INDOPACOM rule set.",
    sourceGaps: ["USFK FHP policy content"], caveats: ["USFK requirements were not extracted. Treat Korea-specific requirements as NOT EXTRACTED, not as absent."] }),
];

/* ------------------------------------------------------------------ */
/* USSOUTHCOM — SC Reg 40-501, MOD 3, waiver process                   */
/* ------------------------------------------------------------------ */

const SC_CLEARANCE = "https://www.southcom.mil/Military-and-Family-Services/Theater-Clearance-Info/";
const SC_REG = "https://www.southcom.mil/Portals/7/Documents/SC%20REG%2040-501-Medical%20Suitability%20Screening_UPDATED_21FEB23.pdf?ver=DOLuGUtaX1quDzvSB-aYEQ%3D%3D";
const SC_MOD3 = "https://www.southcom.mil/Portals/7/Documents/Attachment%20B_MOD%203%20AMPLIFICATION%20OF%20THE%20MINIMAL%20STANDARDS%20OF%20FITNESS_UPDATED_21FEB23.pdf?ver=P7LRZeCpFnSGvcyXVjUJxw%3D%3D";
const SC_WAIVER = "https://www.southcom.mil/Portals/7/Documents/Attachment%20C_Medical%20Waiver%20Process%202022-2024_UPDATED_21FEB23.pdf?ver=FbStAPQZvuq0jmJQqE40Vg%3D%3D";
const sc = factory("SOUTHCOM-REG-40-501", SC_REG, "2023-02-21", "COMMAND PUBLICATION (PACK-EXTRACTED)");
const SC_POP: Population[] = ["us_military", "dod_civilian", "dod_contractor", "dependent"];
const SC_30 = atLeast(30, "MOD 3: anticipated 30 or more consecutive days");

const southcomRules: CommandPolicyRule[] = [
  sc({ id: "sc:baseline-screening", domain: "applicability", title: "Pre-entry medical screening population", sourceSection: "SC Reg 40-501 — baseline policy",
    populations: ["us_military", "dod_civilian", "dod_contractor", "dependent"],
    populationText: "PCS personnel, command-sponsored dependents, uniformed personnel scheduled for TDY over 30 days, DoD personnel deploying to contingency operations, and contractors entering the AOR.",
    conditionOrRequirement: "These populations are medically screened before theater entry and must meet minimum suitability standards. Components may impose approved differing requirements.",
    thresholdOrRule: "Uniformed TDY >30 days; PCS, dependents, contingency deployers and contractors regardless of the extracted duration",
    caveats: ["For contractors the pack states screening without a duration trigger; the regulation text was not re-read."] }),
  sc({ id: "sc:short-visit", domain: "duration", title: "Visits under 30 days", sourceSection: "SC Reg 40-501 — short visits", maximumStayDaysExclusive: 30,
    populations: SC_POP, status: "conditional",
    conditionOrRequirement: "For visits under 30 days, responsible medical personnel determine suitability based on anticipated risk and individual condition. The public regulation states no medical waiver is required solely on the basis of that short duration.",
    thresholdOrRule: "<30 days", requiredEvaluation: "Suitability determination by responsible medical personnel (anticipated risk and individual condition)" }),
  sc({ id: "sc:support-system", domain: "fitness", title: "Healthcare support system must be validated", sourceSection: "SC Reg 40-501 — waivers for ongoing care",
    populations: SC_POP, status: "conditional",
    conditionOrRequirement: "A healthcare support system must be validated before approving waivers for conditions requiring ongoing care or medications; medications must be accessible through available resources and not require unsupported storage/handling.",
    medicationOrEquipmentRule: "Medications must be accessible through available resources; no unsupported storage/handling" }),
  sc({ id: "sc:mod3-fitness", domain: "fitness", title: "MOD 3 — fitness for 30+ consecutive days", sourceUrl: SC_MOD3, sourceSection: "MOD 3 Amplification of the Minimal Standards of Fitness",
    populations: SC_POP, minimumStay: SC_30, status: "conditional",
    conditionOrRequirement: "For anticipated 30 or more consecutive days, personnel must be medically, dentally and psychologically fit and have a current PHA/physical.", requiredEvaluation: "Medical, dental and psychological fitness", requiredDocumentation: "Current PHA / physical" }),
  sc({ id: "sc:mod3-waiver-validity", domain: "duration", title: "MOD 3 waiver validity", sourceUrl: SC_MOD3, sourceSection: "MOD 3 — waiver validity",
    populations: SC_POP, minimumStay: SC_30, status: "waiver-required",
    conditionOrRequirement: "MOD 3 waivers are valid 18 months; personnel remaining over 18 months require a new workup and, if still not meeting requirements, a new waiver.", thresholdOrRule: "Waiver valid 18 months" }),
  sc({ id: "sc:mod3-conditions", domain: "condition", title: "MOD 3 waiver-triggering conditions and medication categories (examples)", sourceUrl: SC_MOD3, sourceSection: "MOD 3 — waiver-triggering conditions",
    populations: SC_POP, minimumStay: SC_30, status: "waiver-required",
    conditionOrRequirement: "MOD 3 lists waiver-triggering conditions and medication categories. Examples: asthma/respiratory disease with FEV1 <50% despite therapy, hospitalization within 12 months, or daily systemic steroids; recent/treated seizure disorder; therapeutic anticoagulants; specified platelet inhibitors; hematopoietics; antihemophilics; antineoplastics; chronic systemic immunosuppressants/biologics; and multiple controlled-substance classes.",
    thresholdOrRule: "Examples only — FEV1 <50% despite therapy; hospitalization within 12 months; daily systemic steroids", medicationOrEquipmentRule: "Anticoagulants, specified platelet inhibitors, hematopoietics, antihemophilics, antineoplastics, chronic systemic immunosuppressants/biologics, multiple controlled-substance classes",
    sourceGaps: ["complete condition and medication list"], caveats: ["Examples only. This is not the complete MOD 3 list."] }),
  sc({ id: "sc:waiver-process", domain: "waiver", kind: "process", title: "Medical waiver process", sourceUrl: SC_WAIVER, sourceSection: "Medical Waiver Process attachment",
    populations: SC_POP, conditionOrRequirement: "Requests are expected 60–90 days before deployment when a waiver is pursued, with supporting workup / specialty documentation. Component surgeon adjudication is generally within 15 business days after receipt.",
    thresholdOrRule: "Request 60–90 days ahead; adjudication generally ≤15 business days", waiverAuthority: "Component surgeon", requiredDocumentation: "Supporting workup and specialty documentation", sourceGaps: ["form names and routing addresses"] }),
  sc({ id: "sc:clearance", domain: "clearance", kind: "process", title: "Theater clearance and APACS / Foreign Clearance Guide (not a medical rule)", sourceUrl: SC_CLEARANCE, sourceSection: "Theater Clearance Info",
    populations: ["us_military", "dod_civilian", "dod_contractor"], conditionOrRequirement: "All DoD military/civilian/contractor personnel on official business into or within SOUTHCOM require theater clearance plus destination-country clearance as applicable. The APACS / Foreign Clearance Guide workflow is separate from medical suitability and stays a distinct rule domain.",
    sourceGaps: ["clearance lead times and procedure"] }),
];

/* ------------------------------------------------------------------ */
/* Policies                                                            */
/* ------------------------------------------------------------------ */

export const COMMAND_POLICIES: CommandPolicy[] = [
  { policyId: "CENTCOM-MOD18", command: "CENTCOM", policyTitle: "USCENTCOM theater medical entry requirements — MOD 18 with Tabs A–D", issuingAuthority: "USCENTCOM Command Surgeon", sourceUrl: CC_PAGE,
    additionalSources: [{ title: "MOD 18", url: CC_MOD18 }, { title: "MOD 18 Tab A", url: CC_TAB_A }, { title: "MOD 18 Tab B", url: CC_TAB_B }, { title: "MOD 18 Tab D", url: CC_TAB_D }],
    sourceDate: "2025-08-19", effectiveFrom: "2025-08-19", effectiveTo: null, supersedesPolicyId: "CENTCOM-MOD17", supersededByPolicyId: null, publicStatus: "Current public package, Aug 2025", verificationStatus: "COMMAND PUBLICATION (PACK-EXTRACTED)", lastRetrievedAt: PACK_RETRIEVED_AT, commandMedicalPolicyStatus: "PUBLISHED",
    caveats: ["Tab C is not part of the extraction; its content is SOURCE_GAP."] },
  { policyId: "CENTCOM-MOD17", command: "CENTCOM", policyTitle: "USCENTCOM Modification 17 (MOD 17)", issuingAuthority: "USCENTCOM Command Surgeon", sourceUrl: CC_PAGE, additionalSources: [],
    sourceDate: null, effectiveFrom: null, effectiveTo: "2025-08-19", supersedesPolicyId: null, supersededByPolicyId: "CENTCOM-MOD18", publicStatus: "Superseded by MOD 18 (19 Aug 2025)", verificationStatus: "COMMAND PUBLICATION — SUPERSEDED", lastRetrievedAt: PACK_RETRIEVED_AT, commandMedicalPolicyStatus: "PUBLISHED",
    caveats: ["Kept as history only. The pack records that MOD 18 supersedes MOD 17 and does not extract MOD 17's content; none is shown."] },
  { policyId: "AFRICOM-ACI-4200.09C", command: "AFRICOM", policyTitle: "USAFRICOM ACI 4200.09C Force Health Protection (with current FHP updates)", issuingAuthority: "USAFRICOM Command Surgeon", sourceUrl: AF_PAGE,
    additionalSources: [{ title: "Yellow Fever vaccination requirements for the USAFRICOM theater", url: AF_YF }, { title: "Update to malaria chemoprophylaxis for entry to the USAFRICOM theater", url: AF_MALARIA }, { title: "Force Health Protection document library", url: AF_LIBRARY }],
    sourceDate: "2026-06-01", effectiveFrom: "2026-06-01", effectiveTo: null, supersedesPolicyId: null, supersededByPolicyId: null, publicStatus: "ACI 4200.09C dated 1 Jun 2026", verificationStatus: "COMMAND PUBLICATION (PACK-EXTRACTED)", lastRetrievedAt: PACK_RETRIEVED_AT, commandMedicalPolicyStatus: "PUBLISHED",
    caveats: ["The pack does not name the instruction version that ACI 4200.09C replaced, so no supersession is recorded."] },
  { policyId: "EUCOM-ECI-4202.01A", command: "EUCOM", policyTitle: "USEUCOM ECI 4202.01A (theater entry framework, with component guidance)", issuingAuthority: "USEUCOM Command Surgeon", sourceUrl: EU_PAGE,
    additionalSources: [{ title: "ECI 4202.01A document page", url: EU_ECI }, { title: "EUCOM document library", url: EU_LIBRARY }],
    sourceDate: "2019-07-03", effectiveFrom: "2019-07-03", effectiveTo: null, supersedesPolicyId: null, supersededByPolicyId: null, publicStatus: "ECI remains applicable but is under rewrite; EUCOM public page current as of 24 Jul 2025", verificationStatus: "COMMAND PUBLICATION — UNDER REWRITE", lastRetrievedAt: PACK_RETRIEVED_AT, commandMedicalPolicyStatus: "PUBLISHED",
    caveats: ["Under rewrite: a replacement instruction can change these rules without notice. The monitor flags page changes for review."] },
  { policyId: "INDOPACOM-FY26-FHP-P-25-0295", command: "INDOPACOM", policyTitle: "USINDOPACOM GENADMIN P-25-0295 — FY2026 Force Health Protection Guidance", issuingAuthority: "USINDOPACOM J07 / Office of the Command Surgeon", sourceUrl: IP_PAGE,
    additionalSources: [{ title: "FY26 Force Health Protection Guidance (PDF)", url: IP_FHP }],
    sourceDate: null, effectiveFrom: null, effectiveTo: null, supersedesPolicyId: null, supersededByPolicyId: null, publicStatus: "Active until cancelled", verificationStatus: "COMMAND PUBLICATION (PACK-EXTRACTED)", lastRetrievedAt: PACK_RETRIEVED_AT, commandMedicalPolicyStatus: "PUBLISHED",
    caveats: ["Issue date of the GENADMIN was not extracted."] },
  { policyId: "SOUTHCOM-REG-40-501", command: "SOUTHCOM", policyTitle: "USSOUTHCOM SC Reg 40-501 Medical Suitability Screening, MOD 3 and medical waiver process", issuingAuthority: "USSOUTHCOM Command Surgeon", sourceUrl: SC_CLEARANCE,
    additionalSources: [{ title: "SC Regulation 40-501", url: SC_REG }, { title: "MOD 3 Amplification of the Minimal Standards of Fitness", url: SC_MOD3 }, { title: "Medical Waiver Process", url: SC_WAIVER }],
    sourceDate: "2023-02-21", effectiveFrom: null, effectiveTo: null, supersedesPolicyId: null, supersededByPolicyId: null, publicStatus: "Public 2023-updated package (UPDATED_21FEB23 in document names)", verificationStatus: "COMMAND PUBLICATION (PACK-EXTRACTED)", lastRetrievedAt: PACK_RETRIEVED_AT, commandMedicalPolicyStatus: "PUBLISHED",
    caveats: ["The 2023 date is taken from the document file names; the pack calls the package 'public 2023-updated'."] },
  { policyId: "NORTHCOM-NONE", command: "NORTHCOM", policyTitle: "No public USNORTHCOM command-wide theater medical-entry policy located", issuingAuthority: "USNORTHCOM", sourceUrl: "https://www.northcom.mil/About/About/", additionalSources: [],
    sourceDate: null, effectiveFrom: null, effectiveTo: null, supersedesPolicyId: null, supersededByPolicyId: null, publicStatus: "Not located in the research pass. Do not fabricate one.", verificationStatus: "NOT PUBLICLY VERIFIED", lastRetrievedAt: PACK_RETRIEVED_AT, commandMedicalPolicyStatus: "NOT_PUBLICLY_VERIFIED",
    caveats: ["Not evidence that none exists. Do not apply another command's thresholds."] },
];

export const COMMAND_RULES: CommandPolicyRule[] = [...centcomRules, ...africomRules, ...eucomRules, ...indopacomRules, ...southcomRules];

/** Official pages and documents the source monitor fingerprints for change (command → URLs). */
export const COMMAND_MONITOR_TARGETS: Record<string, Array<{ url: string; authority: string; purpose: string }>> = {
  CENTCOM: [
    { url: CC_PAGE, authority: "USCENTCOM – Theatre Medical Clearance", purpose: "Command medical policy index page" },
    { url: CC_MOD18, authority: "USCENTCOM – MOD 18", purpose: "Policy document the rules were read from" },
    { url: CC_TAB_A, authority: "USCENTCOM – MOD 18 Tab A", purpose: "Condition-level rules" },
  ],
  AFRICOM: [
    { url: AF_PAGE, authority: "USAFRICOM – Theater Medical Clearance", purpose: "Command medical policy index page" },
    { url: AF_YF, authority: "USAFRICOM – Yellow Fever vaccination requirements", purpose: "Command YF requirement message" },
    { url: AF_MALARIA, authority: "USAFRICOM – Malaria chemoprophylaxis update", purpose: "Command malaria message" },
    { url: AF_LIBRARY, authority: "USAFRICOM – FHP document library", purpose: "New or replaced FHP documents" },
  ],
  EUCOM: [
    { url: EU_PAGE, authority: "USEUCOM – Theatre Medical Clearance", purpose: "Command medical policy index page (framework under rewrite)" },
    { url: EU_ECI, authority: "USEUCOM – ECI 4202.01A", purpose: "Policy document; watch for the rewrite" },
    { url: EU_LIBRARY, authority: "USEUCOM – document library", purpose: "New or replaced guidance (TBE memo, ECI rewrite)" },
  ],
  INDOPACOM: [
    { url: IP_PAGE, authority: "USINDOPACOM – Travel Requirements", purpose: "Command FHP landing page" },
    { url: IP_FHP, authority: "USINDOPACOM – FY26 FHP Guidance", purpose: "Policy document the rules were read from" },
  ],
  SOUTHCOM: [
    { url: SC_CLEARANCE, authority: "USSOUTHCOM – Theater Clearance Info", purpose: "Command medical policy index page" },
    { url: SC_REG, authority: "USSOUTHCOM – SC Reg 40-501", purpose: "Policy document the rules were read from" },
    { url: SC_MOD3, authority: "USSOUTHCOM – MOD 3", purpose: "Fitness standards and waiver triggers" },
    { url: SC_WAIVER, authority: "USSOUTHCOM – Medical Waiver Process", purpose: "Waiver process" },
  ],
  NORTHCOM: [{ url: "https://www.northcom.mil/About/About/", authority: "USNORTHCOM – About / AOR", purpose: "AOR page; watch for a published medical-entry policy" }],
};
