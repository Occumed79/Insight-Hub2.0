import test from "node:test";
import assert from "node:assert/strict";
import {
  REPORTED_CATEGORIES, REQUIREMENT_STATUSES, resolveMedicalApplicability, SOURCE_TEXT_QUALIFIERS,
  type MedicalApplicabilityQuery, type MedicalApplicabilityResult, type RequirementItem, type RequirementStatus,
} from "../aor-intel/command-policy/medical-applicability";
import { COMMAND_RULES } from "../aor-intel/command-policy/policies-data";
import { COMMAND_POLICIES } from "../aor-intel/command-policy/policies-data";
import { CURRENT_ASSIGNMENTS } from "../aor-intel/command-policy/assignments";

const NOW = new Date("2026-10-11T00:00:00Z");
const run = (query: MedicalApplicabilityQuery): MedicalApplicabilityResult => resolveMedicalApplicability({ now: NOW, ...query });
const contractor = (destination: string, extra: Partial<MedicalApplicabilityQuery> = {}) =>
  run({ destination, population: "dod_contractor", contractorAuthorization: "caaf", travelKind: "official_tdy_deployment", ...extra });
const item = (result: MedicalApplicabilityResult, suffix: string): RequirementItem => {
  const found = result.requirements.find((entry) => entry.id.endsWith(`:${suffix}`));
  assert.ok(found, `expected item ${suffix} for ${result.location.name}`);
  return found;
};
const statusOf = (result: MedicalApplicabilityResult, suffix: string): RequirementStatus => item(result, suffix).status;
const ids = (result: MedicalApplicabilityResult, status: RequirementStatus) => result.requirements.filter((entry) => entry.status === status).map((entry) => entry.id);

/* ---------------------------------------------------------------- */
/* Structure and the five statuses                                   */
/* ---------------------------------------------------------------- */

test("1. every result uses only the five statuses and tallies them", () => {
  assert.deepEqual([...REQUIREMENT_STATUSES], ["REQUIRED", "RECOMMENDED", "CONDITIONAL", "NOT_APPLICABLE", "UNKNOWN"]);
  for (const destination of ["Kuwait", "Kenya", "Poland", "Japan", "Colombia", "Canada"]) {
    const result = contractor(destination, { stayDays: 45 });
    for (const entry of result.requirements) assert.ok(REQUIREMENT_STATUSES.includes(entry.status), entry.id);
    const total = Object.values(result.byStatus).reduce((sum, value) => sum + value, 0);
    assert.equal(total, result.requirements.length, destination);
  }
});

test("2. every item answers the actionable questions with source traceability", () => {
  const result = contractor("Kuwait", { stayDays: 45 });
  const general = item(result, "cc:imm:general");
  assert.equal(general.status, "REQUIRED");
  assert.equal(general.layer, "combatant_command");
  assert.equal(general.category, "immunization");
  assert.ok(general.requirement.length > 20, "what the person needs");
  assert.ok(general.why.length >= 1 && general.why[0].includes("USCENTCOM"), "why / which authority");
  assert.equal(general.authority.policyId, "CENTCOM-MOD18");
  assert.ok(general.authority.sourceUrl, "source url");
  assert.ok(general.authority.sourceSection, "source section");
  assert.ok(general.appliesToContractors === "named_in_source" || general.appliesToContractors === "not_named_in_source" || general.appliesToContractors === "as_directed_by_command_or_contract");
  assert.ok("minimumStay" in general.trigger && "conditions" in general.trigger, "duration / mission trigger");
  assert.ok("waiverAuthority" in general.exceptions && "exemptDestinations" in general.exceptions, "exceptions / waivers");
  assert.ok(general.effective.status, "currently effective?");
  assert.ok(Array.isArray(general.missingInputs), "missing information");
  assert.ok(Array.isArray(general.evidence.sourceGaps), "exact evidence + gaps");
});

/* ---------------------------------------------------------------- */
/* CENTCOM                                                           */
/* ---------------------------------------------------------------- */

test("3. CENTCOM contractor, 45 days: MOD 18 general immunizations are REQUIRED and in effect from the stated effective date", () => {
  const result = contractor("Kuwait", { stayDays: 45 });
  assert.equal(result.status, "EVALUATED");
  assert.equal(result.location.command, "CENTCOM");
  assert.equal(result.commandPolicy?.policyId, "CENTCOM-MOD18");
  for (const suffix of ["cc:imm:general", "cc:imm:mmr", "cc:imm:tdap", "cc:imm:hepa", "cc:imm:influenza", "cc:imm:typhoid"]) assert.equal(statusOf(result, suffix), "REQUIRED", suffix);
  const general = item(result, "cc:imm:general");
  assert.equal(general.effective.status, "in_effect");
  assert.equal(general.effective.effectiveFrom, "2025-08-19");
  assert.equal(result.categories.immunization.status, "REQUIRED");
});

test("4. an unnamed population is UNKNOWN, never REQUIRED or NOT_APPLICABLE", () => {
  const result = run({ destination: "Kuwait" });
  assert.equal(statusOf(result, "cc:imm:general"), "UNKNOWN");
  assert.equal(ids(result, "REQUIRED").length, 0);
  assert.ok(item(result, "cc:imm:general").missingInputs.length > 0);
  assert.ok(result.missingInformation.some((entry) => /population/i.test(entry.input)));
});

test("5. CENTCOM dependents on a short visit are not assigned the contractor deployment requirements", () => {
  const dependent = run({ destination: "Iraq", population: "dependent", stayDays: 20, travelKind: "leisure" });
  assert.equal(ids(dependent, "REQUIRED").length, 0);
  assert.ok(dependent.byStatus.NOT_APPLICABLE > 0);
});

test("6. MOD 18 text that narrows or negates a rule is not reported as REQUIRED for everyone in the AOR", () => {
  const result = contractor("Kuwait", { stayDays: 45 });
  const smallpox = item(result, "cc:imm:smallpox");
  assert.equal(smallpox.status, "NOT_APPLICABLE");
  assert.equal(smallpox.effective.status, "withdrawn");
  assert.equal(smallpox.effective.effectiveTo, "2014-05-16");
  assert.equal(statusOf(result, "cc:imm:cholera"), "CONDITIONAL");
  assert.equal(statusOf(result, "cc:imm:rabies-groups"), "CONDITIONAL");
  assert.equal(statusOf(result, "cc:imm:covid19"), "CONDITIONAL");
  assert.equal(statusOf(result, "cc:imm:malaria"), "CONDITIONAL", "malaria applies to listed risk areas, not the whole AOR");
  assert.ok(item(result, "cc:imm:cholera").trigger.conditions.some((condition) => /designated/.test(condition)));
  // The qualifiers are anchored to the source wording they rely on.
  for (const [ruleId, qualifier] of Object.entries(SOURCE_TEXT_QUALIFIERS)) {
    const rule = COMMAND_RULES.find((entry) => entry.id === ruleId);
    assert.ok(rule, ruleId);
    assert.match(rule.conditionOrRequirement, qualifier.anchor, `${ruleId} qualifier no longer matches its source wording`);
  }
});

test("7. country-scoped rules reach only their named countries (Afghanistan/Pakistan polio booster is not a Kuwait requirement)", () => {
  const kuwait = contractor("Kuwait", { stayDays: 60 });
  assert.ok(!kuwait.requirements.some((entry) => entry.id.endsWith("polio-afg-pak") && entry.status === "REQUIRED"));
  const pakistan = contractor("Pakistan", { stayDays: 60 });
  assert.equal(statusOf(pakistan, "cc:imm:polio-afg-pak"), "REQUIRED");
  assert.equal(statusOf(pakistan, "cc:imm:rabies-pakistan"), "REQUIRED");
  assert.equal(statusOf(pakistan, "cc:imm:malaria-year-round"), "REQUIRED");
});

test("8. Hepatitis B is reported as an immunization, not as infectious-disease screening", () => {
  const result = contractor("Kuwait", { stayDays: 45 });
  assert.equal(item(result, "cc:imm:hepb").category, "immunization");
});

test("9. disqualifying conditions and waivers are CONDITIONAL with the waiver authority carried", () => {
  const result = contractor("Kuwait", { stayDays: 45 });
  const diabetes = item(result, "cc:ocr:diabetes");
  assert.equal(diabetes.status, "CONDITIONAL");
  assert.equal(diabetes.category, "waiver_disqualifying_condition");
  assert.ok(result.categories.waiver_disqualifying_condition.itemIds.length > 3);
  assert.ok(result.requirements.filter((entry) => entry.category === "waiver_disqualifying_condition").every((entry) => entry.status !== "REQUIRED"));
});

/* ---------------------------------------------------------------- */
/* AFRICOM                                                           */
/* ---------------------------------------------------------------- */

test("10. AFRICOM yellow fever: REQUIRED for Kenya, exemption countries need the layover fact, otherwise UNKNOWN", () => {
  const kenya = contractor("Kenya", { stayDays: 120 });
  assert.equal(kenya.commandPolicy?.policyId, "AFRICOM-ACI-4200.09C");
  const yf = item(kenya, "af:supplement:yellow-fever");
  assert.equal(yf.status, "REQUIRED");
  assert.equal(yf.category, "immunization");
  assert.deepEqual([...yf.exceptions.exemptDestinations].sort(), ["COM", "MAR", "TUN"]);
  assert.equal(yf.effective.status, "in_effect");
  assert.equal(yf.effective.effectiveFrom, "2026-06-01");

  const morocco = contractor("Morocco", { stayDays: 30 });
  assert.equal(statusOf(morocco, "af:supplement:yellow-fever"), "UNKNOWN", "exemption holds only without an endemic layover; the fact is missing");
  assert.ok(item(morocco, "af:supplement:yellow-fever").missingInputs.some((input) => /layover/i.test(input)));
  assert.equal(statusOf(contractor("Morocco", { stayDays: 30, layoverInYfEndemicCountry: false }), "af:supplement:yellow-fever"), "NOT_APPLICABLE");
  assert.equal(statusOf(contractor("Morocco", { stayDays: 30, layoverInYfEndemicCountry: true }), "af:supplement:yellow-fever"), "REQUIRED");
});

test("11. AFRICOM host-nation yellow fever stays in its own layer, separate from the command requirement", () => {
  const ghana = contractor("Ghana", { stayDays: 30, arrivingFrom: "USA" });
  const hostItems = ghana.requirements.filter((entry) => entry.layer === "host_nation");
  assert.ok(hostItems.length >= 1);
  assert.ok(ghana.requirements.some((entry) => entry.layer === "combatant_command"));
  for (const entry of hostItems) {
    assert.equal(entry.authority.policyId, null);
    assert.ok(entry.authority.sourceUrl);
    assert.ok(!entry.id.startsWith("combatant_command:"));
  }
  assert.equal(ghana.layers.host_nation.items, hostItems.length);
  assert.ok(hostItems.some((entry) => /Yellow Fever/.test(entry.title)));
});

/* ---------------------------------------------------------------- */
/* EUCOM                                                             */
/* ---------------------------------------------------------------- */

test("12. EUCOM contractor on a 10-day trip: >30-day assessments do not apply, and military-only rules are not assigned to contractors", () => {
  const result = contractor("Poland", { stayDays: 10 });
  assert.equal(result.commandPolicy?.policyId, "EUCOM-ECI-4202.01A");
  assert.equal(statusOf(result, "eu:ocr:assessments"), "NOT_APPLICABLE");
  assert.equal(statusOf(result, "eu:ocr:hep-ab"), "NOT_APPLICABLE");
  assert.equal(statusOf(result, "eu:contractor"), "UNKNOWN", "contractors are directed to the supported component — not a statement of no requirement");
  assert.ok(item(result, "eu:ocr:assessments").why.join(" ").length > 0);
});

test("13. EUCOM publication without an established effective date is not treated as effective", () => {
  const result = contractor("Poland", { stayDays: 45 });
  const policy = COMMAND_POLICIES.find((entry) => entry.policyId === "EUCOM-ECI-4202.01A");
  assert.equal(policy?.effectiveFrom ?? null, null);
  for (const entry of result.requirements) assert.equal(entry.effective.status, "effective_date_not_established", entry.id);
  assert.match(item(result, "eu:ocr:screening").effective.note, /not treated as the effective date/);
});

test("14. EUCOM country supplement: typhoid reaches Albania and Georgia but not Poland", () => {
  assert.ok(contractor("Albania", { stayDays: 60 }).requirements.some((entry) => entry.id.endsWith("eu:ocr:typhoid")));
  assert.ok(contractor("Georgia", { stayDays: 60 }).requirements.some((entry) => entry.id.endsWith("eu:ocr:typhoid")));
  assert.ok(!contractor("Poland", { stayDays: 60 }).requirements.some((entry) => entry.id.endsWith("eu:ocr:typhoid") && entry.status !== "NOT_APPLICABLE"));
});

/* ---------------------------------------------------------------- */
/* INDOPACOM                                                         */
/* ---------------------------------------------------------------- */

test("15. INDOPACOM: short trip drops the 30-day screening requirements to NOT_APPLICABLE", () => {
  const short = contractor("Japan", { stayDays: 10, permanentAssignmentIso3: "NONE", contractRequirementsApply: true });
  assert.ok(ids(short, "REQUIRED").length === 0, ids(short, "REQUIRED").join(","));
  assert.equal(statusOf(short, "ip:fy26:fitness"), "NOT_APPLICABLE");
  assert.equal(statusOf(short, "ip:fy26:extended-screening"), "NOT_APPLICABLE");
});

test("16. INDOPACOM: CAAF at 40 days with the SOW incorporating the policy gets REQUIRED screening; without the SOW fact it is CONDITIONAL, not REQUIRED and not dropped", () => {
  const base = { stayDays: 40, permanentAssignmentIso3: "NONE", onDeploymentOrders: true, highRiskOrLiveFire: false } as const;
  const confirmed = contractor("Japan", { ...base, contractRequirementsApply: true });
  assert.equal(statusOf(confirmed, "ip:fy26:fitness"), "REQUIRED");
  assert.equal(statusOf(confirmed, "ip:fy26:routine-vaccines"), "REQUIRED");
  assert.equal(statusOf(confirmed, "ip:fy26:extended-screening"), "REQUIRED");

  const unconfirmed = contractor("Japan", base);
  assert.equal(statusOf(unconfirmed, "ip:fy26:fitness"), "CONDITIONAL");
  assert.ok(item(unconfirmed, "ip:fy26:fitness").missingInputs.some((input) => /Statement of Work/i.test(input)));
  assert.equal(ids(unconfirmed, "REQUIRED").length, 0);
});

test("17. INDOPACOM: a Non-CAAF contractor permanently assigned in Japan is outside the FY26 travel scope", () => {
  const result = contractor("Japan", { contractorAuthorization: "non_caaf", permanentAssignmentIso3: "JPN", stayDays: 60, contractRequirementsApply: true });
  assert.equal(statusOf(result, "ip:fy26:fitness"), "NOT_APPLICABLE");
  assert.equal(ids(result, "REQUIRED").length, 0);
});

test("18. INDOPACOM: Guam-only travel is exempt; leisure travel is not official travel", () => {
  const guam = contractor("Guam", { stayDays: 60, permanentAssignmentIso3: "NONE", contractRequirementsApply: true });
  assert.equal(statusOf(guam, "ip:fy26:fitness"), "NOT_APPLICABLE");
  const leisure = contractor("Japan", { stayDays: 60, travelKind: "leisure", permanentAssignmentIso3: "NONE", contractRequirementsApply: true });
  assert.equal(ids(leisure, "REQUIRED").length, 0);
});

test("19. INDOPACOM component rules (USARPAC) need the component; with it they resolve", () => {
  const without = contractor("Japan", { stayDays: 40, permanentAssignmentIso3: "NONE", contractRequirementsApply: true });
  assert.equal(statusOf(without, "ip:usarpac:malaria-selection"), "UNKNOWN");
  assert.ok(item(without, "ip:usarpac:malaria-selection").missingInputs.some((input) => /USARPAC/.test(input)));
  const withComponent = contractor("Japan", { stayDays: 40, permanentAssignmentIso3: "NONE", contractRequirementsApply: true, component: "USARPAC", onDeploymentOrders: true });
  assert.notEqual(statusOf(withComponent, "ip:usarpac:malaria-selection"), "UNKNOWN");
  assert.equal(withComponent.byStatus.UNKNOWN, 0);
});

test("20. command-side reference rules (authorities cited, waiver reporting) are not presented as traveler duties", () => {
  const result = contractor("Japan", { stayDays: 40, permanentAssignmentIso3: "NONE", contractRequirementsApply: true });
  assert.ok(!result.requirements.some((entry) => entry.id.endsWith("ip:references") || entry.id.endsWith("ip:waiver-reporting")));
  assert.ok(result.scopeRules.some((entry) => entry.id === "ip:references" || entry.id === "ip:waiver-reporting"));
});

/* ---------------------------------------------------------------- */
/* SOUTHCOM                                                          */
/* ---------------------------------------------------------------- */

test("21. SOUTHCOM contractor requirements are CONDITIONAL until the contract clause is confirmed, then REQUIRED", () => {
  const unconfirmed = contractor("Colombia", { stayDays: 30 });
  assert.equal(unconfirmed.commandPolicy?.policyId, "SOUTHCOM-REG-40-501");
  for (const suffix of ["sc:dpap:fitness-screening", "sc:dpap:immunization-and-icv", "sc:dpap:medevac-and-dna"]) assert.equal(statusOf(unconfirmed, suffix), "CONDITIONAL", suffix);
  const dpap = item(unconfirmed, "sc:dpap:immunization-and-icv");
  assert.equal(dpap.category, "immunization");
  assert.match(dpap.authority.issuer ?? "", /DPAP|Defense Procurement|OUSD/i);
  assert.match(dpap.why.join(" "), /contract/i);

  const confirmed = contractor("Colombia", { stayDays: 30, contractRequirementsApply: true });
  assert.equal(statusOf(confirmed, "sc:dpap:fitness-screening"), "REQUIRED");
  assert.equal(statusOf(confirmed, "sc:dpap:immunization-and-icv"), "REQUIRED");
});

test("22. SOUTHCOM contractor-only rules do not reach military travelers", () => {
  const military = run({ destination: "Colombia", population: "us_military", stayDays: 30, travelKind: "official_tdy_deployment" });
  for (const entry of military.requirements.filter((candidate) => candidate.id.includes("sc:dpap:"))) assert.equal(entry.status, "NOT_APPLICABLE", entry.id);
});

test("23. a regionally inferred assignment keeps its caveat on the items", () => {
  const cayman = contractor("Cayman Islands", { stayDays: 30 });
  assert.equal(cayman.location.assignmentEvidenceClass, "regional_inference");
  assert.ok(cayman.requirements.length > 0);
  assert.ok(cayman.requirements.every((entry) => entry.assignmentCaveat && /regional/i.test(entry.assignmentCaveat)));
});

/* ---------------------------------------------------------------- */
/* NORTHCOM, ambiguity, provisional                                  */
/* ---------------------------------------------------------------- */

test("24. NORTHCOM has no public medical policy: the command layer is UNKNOWN, never 'nothing required'", () => {
  for (const destination of ["Canada", "Mexico"]) {
    const result = contractor(destination, { stayDays: 30 });
    assert.equal(result.location.command, "NORTHCOM");
    assert.equal(result.layers.combatant_command.coverage, "no_public_policy");
    assert.match(result.layers.combatant_command.note, /not (?:publicly )?verified|no public/i);
    assert.equal(ids(result, "NOT_APPLICABLE").filter((id) => id.startsWith("combatant_command")).length, 0);
    assert.equal(result.requirements.filter((entry) => entry.layer === "combatant_command" && entry.status === "REQUIRED").length, 0);
    for (const category of REPORTED_CATEGORIES) {
      const summary = result.categories[category];
      assert.ok(["UNKNOWN", "CONDITIONAL"].includes(summary.status), `${destination} ${category} = ${summary.status}`);
      assert.notEqual(summary.status, "NOT_APPLICABLE");
    }
  }
});

test("25. split parents are LOCATION_AMBIGUOUS with no requirements; their constituents resolve to their own command", () => {
  for (const destination of ["United States", "USA", "United States Minor Outlying Islands"]) {
    const result = contractor(destination, { stayDays: 30 });
    assert.equal(result.status, "LOCATION_AMBIGUOUS", destination);
    assert.equal(result.requirements.length, 0);
    assert.ok(result.location.ambiguity?.constituents.length);
    assert.ok(result.limitations.some((line) => /ambiguous|constituent|specific/i.test(line)));
    for (const category of REPORTED_CATEGORIES) assert.equal(result.categories[category].status, "UNKNOWN");
  }
  const hawaii = contractor("Hawaii", { stayDays: 30 });
  assert.equal(hawaii.status, "EVALUATED");
  assert.equal(hawaii.location.command, "INDOPACOM");
});

test("26. an unrecognized destination is LOCATION_NOT_FOUND, with every category UNKNOWN", () => {
  const result = run({ destination: "Narnia", population: "dod_contractor" });
  assert.equal(result.status, "LOCATION_NOT_FOUND");
  assert.equal(result.requirements.length, 0);
  for (const category of REPORTED_CATEGORIES) assert.equal(result.categories[category].status, "UNKNOWN");
});

test("27. a provisional assignment (Western Sahara) is never reported REQUIRED; unresolved items stay UNKNOWN and carry the caveat", () => {
  const result = contractor("Western Sahara", { stayDays: 30 });
  assert.equal(result.location.assignmentProvisional, true);
  assert.equal(result.requirements.filter((entry) => entry.status === "REQUIRED").length, 0);
  assert.equal(statusOf(result, "af:supplement:yellow-fever"), "UNKNOWN");
  assert.ok(result.requirements.every((entry) => entry.assignmentCaveat));
});

/* ---------------------------------------------------------------- */
/* Authority layers, public health, conflicts, supersession          */
/* ---------------------------------------------------------------- */

test("28. public-health guidance is supplied by the caller, kept in its own layer, and is never REQUIRED", () => {
  const without = contractor("Kenya", { stayDays: 30 });
  assert.equal(without.layers.public_health.coverage, "not_supplied");
  assert.ok(without.limitations.some((line) => /CDC|WHO/.test(line)));
  assert.ok(!without.requirements.some((entry) => entry.layer === "public_health"));

  const withGuidance = contractor("Kenya", {
    stayDays: 30,
    publicHealth: [
      { id: "cdc-malaria-ke", topic: "Malaria", category: "malaria_chemoprophylaxis", authority: "CDC Travelers' Health", recommendation: "Take malaria prophylaxis when traveling to malaria-risk areas.", url: "https://wwwnc.cdc.gov/travel/destinations/traveler/none/kenya", condition: "travel to a malaria-risk area" },
      { id: "cdc-typhoid-ke", topic: "Typhoid", category: "immunization", authority: "CDC Travelers' Health", recommendation: "Typhoid vaccine is recommended for most travelers.", url: "https://wwwnc.cdc.gov/travel/destinations/traveler/none/kenya" },
    ],
  });
  const publicHealth = withGuidance.requirements.filter((entry) => entry.layer === "public_health");
  assert.equal(publicHealth.length, 2);
  assert.ok(publicHealth.every((entry) => entry.status !== "REQUIRED"));
  assert.equal(publicHealth.find((entry) => entry.id.includes("typhoid"))?.status, "RECOMMENDED");
  assert.equal(publicHealth.find((entry) => entry.id.includes("malaria"))?.status, "CONDITIONAL");
  assert.equal(publicHealth[0].authority.layer, "public_health");
  assert.ok(publicHealth.every((entry) => entry.authority.sourceUrl));
  assert.equal(withGuidance.layers.public_health.coverage, "evaluated");
});

test("29. the four authority layers stay distinguishable, and every item belongs to exactly one", () => {
  const result = contractor("Ghana", {
    stayDays: 30, arrivingFrom: "USA",
    publicHealth: [{ id: "who-yf-gh", topic: "Yellow fever", authority: "WHO", recommendation: "Vaccinate against yellow fever.", url: "https://www.who.int/" }],
  });
  const layers = new Set(result.requirements.map((entry) => entry.layer));
  assert.ok(layers.has("combatant_command") && layers.has("host_nation") && layers.has("public_health"));
  assert.deepEqual(Object.keys(result.layers).sort(), ["combatant_command", "dod_issuance", "host_nation", "public_health"]);
  for (const entry of result.requirements) {
    assert.equal(entry.layer, entry.authority.layer);
    assert.ok(entry.id.startsWith(`${entry.layer}:`));
  }
});

test("30. DoD-wide medical-readiness instructions are reported as not integrated rather than silently absent", () => {
  const result = contractor("Kuwait", { stayDays: 45 });
  assert.ok(["not_integrated", "partial"].includes(result.layers.dod_issuance.coverage));
  assert.ok(result.limitations.some((line) => /DoD-wide|DoDI|instruction/i.test(line)));
  const colombia = contractor("Colombia", { stayDays: 30 });
  assert.equal(colombia.layers.dod_issuance.coverage, "partial", "DPAP class-deviation items are DoD-level and carried in their own layer");
  assert.equal(item(colombia, "sc:dpap:fitness-screening").layer, "dod_issuance");
});

test("31. superseded policy versions are listed for traceability and never applied", () => {
  const result = contractor("Kuwait", { stayDays: 45 });
  assert.ok(result.commandPolicy?.superseded.some((entry) => entry.policyId === "CENTCOM-MOD17"));
  assert.ok(result.requirements.every((entry) => entry.authority.policyId !== "CENTCOM-MOD17"));
  assert.ok(result.limitations.some((line) => /Superseded/i.test(line)));
});

test("32. displaced rule wording from an earlier source is retained as evidence, not applied", () => {
  const withDisplaced = contractor("Poland", { stayDays: 45 }).requirements.filter((entry) => entry.displacedEvidence.length > 0);
  assert.ok(withDisplaced.length > 0);
  for (const entry of withDisplaced) assert.ok(entry.displacedEvidence.every((line) => line.length > 0));
  const tbe = contractor("Poland", { stayDays: 45 }).requirements.find((entry) => entry.id.endsWith("eu:tbe"));
  assert.ok(tbe);
  assert.notEqual(tbe.status, "REQUIRED", "the EUCOM TBE recommendation supersedes the earlier required wording");
});

test("33. host-nation rule that is not currently verified is UNKNOWN, not REQUIRED", () => {
  const result = contractor("Saudi Arabia", { stayDays: 30, arrivingFrom: "USA" });
  const host = result.requirements.filter((entry) => entry.layer === "host_nation");
  assert.ok(host.length > 0);
  assert.ok(host.every((entry) => entry.status !== "REQUIRED" || entry.authority.verificationStatus !== "NOT CURRENTLY VERIFIED"));
  assert.ok(host.every((entry) => entry.contractualNote && /status-of-forces|official-passport/i.test(entry.contractualNote)));
});

test("34. categories with no supporting source report UNKNOWN with an explicit not-evidence-of-absence note", () => {
  const result = contractor("Poland", { stayDays: 10 });
  for (const category of REPORTED_CATEGORIES) {
    const summary = result.categories[category];
    assert.ok(REQUIREMENT_STATUSES.includes(summary.status), category);
    if (summary.itemIds.length === 0) {
      assert.equal(summary.status, "UNKNOWN", category);
      assert.match(summary.note, /not evidence/i);
    }
  }
  assert.equal(result.categories.malaria_chemoprophylaxis.status === "REQUIRED", false);
});

test("35. malaria chemoprophylaxis is category-tagged and conditional on a risk area, never blanket-required", () => {
  for (const destination of ["Kuwait", "Kenya", "Japan"]) {
    const result = contractor(destination, { stayDays: 45, permanentAssignmentIso3: "NONE", contractRequirementsApply: true });
    const malaria = result.requirements.filter((entry) => entry.category === "malaria_chemoprophylaxis");
    assert.ok(malaria.length > 0, destination);
    assert.ok(malaria.every((entry) => entry.status !== "REQUIRED"), `${destination}: ${malaria.map((entry) => `${entry.id}=${entry.status}`).join(",")}`);
  }
});

test("36. installation is matched only against component names the sources use; an unknown installation does not invent a rule", () => {
  const known = contractor("South Korea", { stayDays: 40, permanentAssignmentIso3: "NONE", contractRequirementsApply: true, installation: "Camp Humphreys (USFK)" });
  assert.ok(known.requirements.some((entry) => entry.id.includes("ip:usfk")));
  const unknown = contractor("South Korea", { stayDays: 40, permanentAssignmentIso3: "NONE", contractRequirementsApply: true, installation: "Some Unlisted Site" });
  assert.equal(unknown.query.installation, "Some Unlisted Site");
  assert.ok(unknown.requirements.every((entry) => entry.status !== "REQUIRED" || !entry.id.includes("ip:usfk")));
});

test("37. command-wide requirements are not assigned to everyone entering the AOR: status varies with population, duration and destination", () => {
  const signature = (result: MedicalApplicabilityResult) => result.requirements.map((entry) => `${entry.id}=${entry.status}`).join("|");
  const longContractor = signature(contractor("Kuwait", { stayDays: 60 }));
  const military = signature(run({ destination: "Kuwait", population: "us_military", stayDays: 60, travelKind: "official_tdy_deployment" }));
  const dependent = signature(run({ destination: "Kuwait", population: "dependent", stayDays: 60, travelKind: "leisure" }));
  assert.notEqual(longContractor, dependent);
  assert.notEqual(military, dependent);
  const required = (result: MedicalApplicabilityResult) => ids(result, "REQUIRED").length;
  assert.ok(required(run({ destination: "Kuwait", population: "dependent", stayDays: 60, travelKind: "leisure" })) < required(contractor("Kuwait", { stayDays: 60 })));
  // No command assigns the same rule set to a Pakistan trip and a Kuwait trip.
  assert.notEqual(signature(contractor("Pakistan", { stayDays: 60 })), longContractor);
});

test("38. every command resolves for at least one realistic contractor assignment and policy ids are the registry's own", () => {
  const sample: Array<[string, string]> = [["Kuwait", "CENTCOM"], ["Kenya", "AFRICOM"], ["Poland", "EUCOM"], ["Japan", "INDOPACOM"], ["Colombia", "SOUTHCOM"], ["Canada", "NORTHCOM"]];
  for (const [destination, command] of sample) {
    const result = contractor(destination, { stayDays: 45, permanentAssignmentIso3: "NONE" });
    assert.equal(result.location.command, command, destination);
    const record = CURRENT_ASSIGNMENTS.find((entry) => entry.iso3 === result.location.id);
    assert.ok(record, destination);
    if (command !== "NORTHCOM") assert.ok(COMMAND_POLICIES.some((policy) => policy.policyId === result.commandPolicy?.policyId), destination);
  }
});
