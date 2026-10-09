import { assignmentFor, assignmentHistoryFor, COMMAND_NAMES } from "./assignments";
import { COMMAND_POLICIES, COMMAND_RULES } from "./policies-data";
import type {
  CommandApplicability, CommandId, CommandPolicy, CommandPolicyRule, CommandQuery, CommandRuleEvaluation, CountryCommandResolution, StayThreshold,
} from "./types";

export const NOT_PUBLICLY_VERIFIED_TEXT = "NOT PUBLICLY VERIFIED — no current public command-wide medical-entry policy was located for this command. No other command's requirements are applied.";
export const COMMAND_NOT_ASSIGNED_TEXT = "No combatant command assignment for this country is recorded in the configured registry, so no command medical policy is shown. This is not evidence that none applies.";

const POLICY_BY_ID = new Map(COMMAND_POLICIES.map((policy) => [policy.policyId, policy]));

function currentPolicyFor(command: CommandId): CommandPolicy | null {
  return COMMAND_POLICIES.find((policy) => policy.command === command && policy.effectiveTo === null && policy.verificationStatus !== "COMMAND PUBLICATION — SUPERSEDED") ?? null;
}

function supersededPoliciesFor(command: CommandId): CommandPolicy[] {
  return COMMAND_POLICIES.filter((policy) => policy.command === command && policy.verificationStatus === "COMMAND PUBLICATION — SUPERSEDED");
}

/**
 * Country → command → policy. Inheritance order: command-wide rules, then component / JTF rules, then
 * country-specific supplements. A country-scoped rule is included only for the countries it names.
 */
export function resolveCountryCommand(iso3Input: string): CountryCommandResolution {
  const iso3 = String(iso3Input || "").trim().toUpperCase();
  const assignment = assignmentFor(iso3);
  const canonical = assignment?.iso3 ?? iso3;
  const history = assignmentHistoryFor(iso3);
  if (!assignment) {
    return { iso3, assigned: false, command: null, assignment: null, history, policy: null, supersededPolicies: [], commandMedicalPolicyStatus: "COMMAND_NOT_ASSIGNED", rules: [], note: COMMAND_NOT_ASSIGNED_TEXT };
  }
  const policy = currentPolicyFor(assignment.command);
  const policyRules = policy ? COMMAND_RULES.filter((rule) => rule.policyId === policy.policyId) : [];
  const level = { command: 0, component: 1, country: 2 } as const;
  const rules = policyRules
    .filter((rule) => rule.scope.level !== "country" || rule.scope.countries.includes(canonical))
    .sort((a, b) => level[a.scope.level] - level[b.scope.level]);
  const status = policy?.commandMedicalPolicyStatus ?? "NOT_PUBLICLY_VERIFIED";
  return {
    iso3,
    assigned: true,
    command: assignment.command,
    assignment,
    history,
    policy,
    supersededPolicies: supersededPoliciesFor(assignment.command),
    commandMedicalPolicyStatus: status,
    rules,
    note: status === "NOT_PUBLICLY_VERIFIED" ? NOT_PUBLICLY_VERIFIED_TEXT : null,
  };
}

/* ------------------------------------------------------------------ */
/* Traveler evaluation                                                 */
/* ------------------------------------------------------------------ */

function stayMeets(threshold: StayThreshold, stay: number): boolean {
  return threshold.inclusive ? stay >= threshold.days : stay > threshold.days;
}

export function stayText(threshold: StayThreshold): string {
  return `${threshold.inclusive ? "at least" : "more than"} ${threshold.days} days — ${threshold.basis}`;
}

export function evaluateCommandRule(rule: CommandPolicyRule, query: CommandQuery): CommandRuleEvaluation {
  const reasons: string[] = [];
  const missing: string[] = [];
  let excluded = false;

  if (rule.applicabilityPopulation.length) {
    if (!query.population) missing.push("traveler population (military, DoD civilian, contractor, dependent …)");
    else if (rule.directedPopulations.includes(query.population)) {
      missing.push(`whether this rule reaches ${query.population.replace(/_/g, " ")} personnel (the source limits it to a subgroup or to cases the command or contract directs)`);
    } else if (!rule.applicabilityPopulation.includes(query.population)) {
      excluded = true;
      reasons.push(`The source does not name this population for this rule (it names: ${rule.applicabilityPopulation.join(", ")}).`);
    }
  }
  if (rule.pcsOnly) {
    if (!query.travelKind) missing.push("type of travel (PCS, TDY/deployment, leisure)");
    else if (query.travelKind !== "pcs") {
      excluded = true;
      reasons.push("This rule is for PCS personnel only.");
    }
  }
  if (rule.contingencyOnly) {
    if (!query.travelKind) missing.push("type of travel (contingency operation or not)");
    else if (query.travelKind !== "contingency") {
      excluded = true;
      reasons.push("This rule is for contingency-operation deployers only.");
    }
  }
  if (rule.minimumStay) {
    if (query.stayDays === null || query.stayDays === undefined) missing.push("planned in-country days");
    else if (!stayMeets(rule.minimumStay, query.stayDays)) {
      excluded = true;
      reasons.push(`Trigger not met: the rule applies ${stayText(rule.minimumStay)}; stay entered is ${query.stayDays} days.`);
    } else reasons.push(`Duration trigger met (${stayText(rule.minimumStay)}).`);
  }
  if (rule.maximumStayDaysExclusive !== null) {
    if (query.stayDays === null || query.stayDays === undefined) missing.push("planned in-country days");
    else if (query.stayDays >= rule.maximumStayDaysExclusive) {
      excluded = true;
      reasons.push(`This rule covers stays under ${rule.maximumStayDaysExclusive} days; stay entered is ${query.stayDays} days.`);
    } else reasons.push(`Stay is under ${rule.maximumStayDaysExclusive} days.`);
  }
  if (rule.scope.level !== "command" && rule.scope.component) {
    if (!query.component) missing.push(`supported component / JTF (this rule is specific to ${rule.scope.component})`);
    else if (query.component.trim().toLowerCase() !== rule.scope.component.toLowerCase()) {
      excluded = true;
      reasons.push(`This rule is specific to ${rule.scope.component}; the traveler is supported by ${query.component}.`);
    } else reasons.push(`Traveler is supported by ${rule.scope.component}.`);
  }
  if (rule.exemptCountries.includes(query.iso3.toUpperCase())) {
    if (query.layoverInYfEndemicCountry === true) reasons.push(`${query.iso3} is named as exempt, but the exemption does not hold with a layover in a yellow fever endemic country.`);
    else if (query.layoverInYfEndemicCountry === false) {
      excluded = true;
      reasons.push(`${query.iso3} is named as exempt${rule.exemptionCondition ? ` (${rule.exemptionCondition})` : ""}.`);
    } else missing.push("whether the itinerary includes a layover in a yellow fever endemic country (the exemption holds only without one)");
  }
  if (rule.domain === "condition" && !excluded) reasons.push("Applies only if the person has the condition described.");

  let applicability: CommandApplicability = "applies";
  if (excluded) applicability = "does_not_apply";
  else if (missing.length) applicability = "unknown";
  return { rule, applicability, reasons, missingInputs: missing };
}

export function evaluateCommandTraveler(query: CommandQuery): { resolution: CountryCommandResolution; evaluations: CommandRuleEvaluation[]; shortStayNote: string | null } {
  const resolution = resolveCountryCommand(query.iso3);
  const evaluations = resolution.rules.map((rule) => evaluateCommandRule(rule, query));
  let shortStayNote: string | null = null;
  const stay = query.stayDays;
  if (resolution.policy && stay !== null && stay !== undefined) {
    const gated = evaluations.filter((entry) => entry.rule.minimumStay || entry.rule.maximumStayDaysExclusive !== null);
    const triggered = gated.some((entry) => entry.applicability !== "does_not_apply");
    const suppressed = gated.some((entry) => entry.reasons.some((reason) => reason.startsWith("Trigger not met")));
    if (suppressed && !triggered) shortStayNote = "No duration-triggered rule in the extracted policy is met by this stay length. Rules with no duration trigger (for example the MOD 18 immunizations, which apply for any period in theater) are evaluated separately. That does not establish that the command has no short-stay requirement; short-visit and clearance requirements were not extracted from the source.";
  }
  return { resolution, evaluations, shortStayNote };
}

/* ------------------------------------------------------------------ */
/* Summaries and freshness                                             */
/* ------------------------------------------------------------------ */

export function policyQualifiers(policy: CommandPolicy, now: Date): string[] {
  const out: string[] = [];
  if (policy.verificationStatus === "COMMAND PUBLICATION — UNDER REWRITE") out.push("Framework under rewrite — a replacement can change these rules");
  if (policy.sourceDate) {
    const ageMonths = (now.getTime() - Date.parse(`${policy.sourceDate}T00:00:00Z`)) / (30.4375 * 86_400_000);
    if (ageMonths > 36) out.push(`Source document dated ${policy.sourceDate} — over 3 years old; confirm no newer version`);
  } else if (policy.commandMedicalPolicyStatus === "PUBLISHED") out.push("Issue date not extracted");
  return out;
}

export interface CommandAnswers {
  iso3: string;
  assigned: boolean;
  command: CommandId | null;
  commandName: string | null;
  commandMedicalPolicyStatus: CountryCommandResolution["commandMedicalPolicyStatus"];
  policyId: string | null;
  policyTitle: string | null;
  policySourceDate: string | null;
  policyStatusText: string | null;
  qualifiers: string[];
  durationTriggers: Array<{ ruleId: string; title: string; trigger: string }>;
  waiverRouting: Array<{ ruleId: string; title: string; authority: string; scope: string }>;
  supplements: Array<{ ruleId: string; title: string; kind: string }>;
  ruleCount: number;
  sourceGapCount: number;
  assignmentHistory: Array<{ command: CommandId; effectiveTo: string | null; note: string | null }>;
}

export function describeCommandCountry(iso3: string, now: Date = new Date()): CommandAnswers {
  const resolution = resolveCountryCommand(iso3);
  const rules = resolution.rules;
  return {
    iso3: resolution.iso3,
    assigned: resolution.assigned,
    command: resolution.command,
    commandName: resolution.command ? COMMAND_NAMES[resolution.command] : null,
    commandMedicalPolicyStatus: resolution.commandMedicalPolicyStatus,
    policyId: resolution.policy?.policyId ?? null,
    policyTitle: resolution.policy?.policyTitle ?? null,
    policySourceDate: resolution.policy?.sourceDate ?? null,
    policyStatusText: resolution.policy?.publicStatus ?? null,
    qualifiers: resolution.policy ? policyQualifiers(resolution.policy, now) : [],
    durationTriggers: rules.filter((rule) => rule.minimumStay || rule.maximumStayDaysExclusive !== null).map((rule) => ({
      ruleId: rule.id,
      title: rule.title,
      trigger: rule.minimumStay ? stayText(rule.minimumStay) : `under ${rule.maximumStayDaysExclusive} days`,
    })),
    waiverRouting: rules.filter((rule) => rule.waiverAuthority).map((rule) => ({
      ruleId: rule.id,
      title: rule.title,
      authority: rule.waiverAuthority as string,
      scope: rule.scope.level === "command" ? "Command-wide" : rule.scope.level === "component" ? `Component: ${rule.scope.component}` : `Country supplement${rule.scope.component ? ` (${rule.scope.component})` : ""}`,
    })),
    supplements: rules.filter((rule) => rule.domain === "supplement" || rule.domain === "guidance").map((rule) => ({ ruleId: rule.id, title: rule.title, kind: rule.kind })),
    ruleCount: rules.length,
    sourceGapCount: rules.reduce((total, rule) => total + rule.sourceGaps.length, 0),
    assignmentHistory: resolution.history.map((entry) => ({ command: entry.command, effectiveTo: entry.effectiveTo, note: entry.note })),
  };
}

export function policyById(policyId: string): CommandPolicy | null {
  return POLICY_BY_ID.get(policyId) ?? null;
}
