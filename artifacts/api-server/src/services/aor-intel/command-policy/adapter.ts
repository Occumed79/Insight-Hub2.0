import { createHash } from "node:crypto";
import type { CacheStore } from "../cache";
import type { AdapterContext, AdapterResult, EvidenceRecord } from "../types";
import { isoOrNull, makeRecord, result } from "../util";
import { checkOne } from "../vaccine-rules/adapter";
import { COMMAND_NAMES, COMMAND_SOURCES, ASSIGNMENT_REGISTRY_VERSION } from "./assignments";
import { COMMAND_MONITOR_TARGETS } from "./policies-data";
import { COMMAND_NOT_ASSIGNED_TEXT, NOT_PUBLICLY_VERIFIED_TEXT, policyQualifiers, resolveCountryCommand, stayText } from "./engine";
import type { CommandPolicy, CommandPolicyRule, CountryCommandResolution } from "./types";

// Rule class marker carried in every record's `extra`. Host-nation rules (vaccine-rules/) and CDC/WHO guidance never
// carry this value, and these records never carry a host-nation requirementType.
export const COMMAND_RULE_CLASS = "combatant_command" as const;

const META = {
  sourceId: "command-medical-policy",
  sourceName: "U.S. Geographic Combatant Command medical / Force Health Protection policy (separate from host-nation law and CDC/WHO guidance)",
  sourceUrl: "https://www.defense.gov/Resources/Military-Departments/Our-Story/Combatant-Commands/index.html/",
  dimension: "command_policy" as const,
  freshness: "STRUCTURAL_DATA" as const,
};

const SEPARATION_NOTE = "Combatant Command deployment policy for DoD-affiliated travelers. It is not host-nation entry law and not a CDC/WHO recommendation, and it does not replace either.";

const midnight = (date: string | null) => (date ? isoOrNull(`${date}T00:00:00Z`) : null);

function ruleSummary(rule: CommandPolicyRule): string {
  const bits = [rule.conditionOrRequirement];
  if (rule.status) bits.push(`Status: ${rule.status}.`);
  return bits.join(" ").slice(0, 700);
}

function ruleEvidence(rule: CommandPolicyRule): string {
  const lines: Array<[string, string | null]> = [
    ["Applies to", rule.populationText || (rule.applicabilityPopulation.length ? rule.applicabilityPopulation.join(", ") : null)],
    ["Duration trigger", rule.minimumStay ? stayText(rule.minimumStay) : rule.maximumStayDaysExclusive !== null ? `under ${rule.maximumStayDaysExclusive} days` : null],
    ["Threshold / rule", rule.thresholdOrRule],
    ["Waiver authority", rule.waiverAuthority],
    ["Required evaluation", rule.requiredEvaluation],
    ["Required documentation", rule.requiredDocumentation],
    ["Medication / equipment", rule.medicationOrEquipmentRule],
    ["Immunization / prophylaxis", rule.immunizationOrProphylaxisRule],
    ["Source section", rule.sourceSection],
  ];
  return lines.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join(" | ");
}

function ruleRecord(ctx: AdapterContext, resolution: CountryCommandResolution, rule: CommandPolicyRule): EvidenceRecord {
  const command = resolution.command as NonNullable<typeof resolution.command>;
  const scopeLabel = rule.scope.level === "command" ? "Command-wide" : rule.scope.level === "component" ? `Component: ${rule.scope.component}` : `Country supplement${rule.scope.component ? ` (${rule.scope.component})` : ""}`;
  return makeRecord(ctx, "command-medical-policy", {
    id: `command-rule:${ctx.country.iso3}:${rule.id}`,
    dimension: "command_policy",
    category: "command_rule",
    subtype: rule.domain,
    title: `${command} — ${rule.title}`,
    summary: ruleSummary(rule),
    evidence: ruleEvidence(rule),
    sourceName: `${COMMAND_NAMES[command]} — ${rule.policyId}`,
    sourceUrl: rule.sourceUrl,
    publishedAt: midnight(rule.sourceDate),
    freshness: "STRUCTURAL_DATA",
    geometry: { type: "None" },
    geographyLevel: "country",
    geographyNote: SEPARATION_NOTE,
    // requirementType / recommendationType stay null: those fields describe host-nation law and CDC/WHO guidance.
    extra: {
      ruleClass: COMMAND_RULE_CLASS,
      command,
      policyId: rule.policyId,
      scopeLabel,
      commandRule: rule,
      verificationStatus: rule.verificationStatus,
    },
  });
}

function policyRecord(ctx: AdapterContext, policy: CommandPolicy, now: Date, superseded: boolean): EvidenceRecord {
  const qualifiers = superseded ? [] : policyQualifiers(policy, now);
  const published = policy.commandMedicalPolicyStatus === "PUBLISHED";
  return makeRecord(ctx, "command-medical-policy", {
    id: `command-policy:${ctx.country.iso3}:${policy.policyId}`,
    dimension: "command_policy",
    category: superseded ? "command_policy_superseded" : "command_policy",
    subtype: published ? "published" : "not_publicly_verified",
    title: published ? `${policy.command} — ${policy.policyTitle}` : `${policy.command} — command medical policy: NOT PUBLICLY VERIFIED`,
    summary: published
      ? `${policy.publicStatus}.${policy.sourceDate ? ` Source dated ${policy.sourceDate}.` : ""}${qualifiers.length ? ` ${qualifiers.join("; ")}.` : ""}${policy.supersedesPolicyId ? ` Supersedes ${policy.supersedesPolicyId}.` : ""}${policy.supersededByPolicyId ? ` Superseded by ${policy.supersededByPolicyId}.` : ""}`
      : `${NOT_PUBLICLY_VERIFIED_TEXT} ${policy.caveats.join(" ")}`,
    evidence: [`Issuer: ${policy.issuingAuthority}`, `Status: ${policy.publicStatus}`, ...policy.caveats].join(" | "),
    sourceName: policy.issuingAuthority,
    sourceUrl: policy.sourceUrl,
    publishedAt: midnight(policy.sourceDate),
    updatedAt: midnight(policy.effectiveFrom),
    freshness: "STRUCTURAL_DATA",
    geometry: { type: "None" },
    geographyLevel: "country",
    geographyNote: SEPARATION_NOTE,
    extra: { ruleClass: COMMAND_RULE_CLASS, command: policy.command, policy, qualifiers, verificationStatus: policy.verificationStatus },
  });
}

function assignmentRecord(ctx: AdapterContext, resolution: CountryCommandResolution): EvidenceRecord {
  const assignment = resolution.assignment as NonNullable<typeof resolution.assignment>;
  const source = COMMAND_SOURCES[assignment.command];
  const history = resolution.history;
  return makeRecord(ctx, "command-medical-policy", {
    id: `command-assignment:${ctx.country.iso3}:${assignment.command}`,
    dimension: "command_policy",
    category: "command_assignment",
    subtype: assignment.geographicClass,
    title: assignment.geographicClass === "sovereign_state"
      ? `${ctx.country.name} is in the ${COMMAND_NAMES[assignment.command]} (${assignment.command}) area of responsibility`
      : `${ctx.country.name} (${assignment.geographicClass.replace(/_/g, " ")}, not a sovereign state) is in the ${COMMAND_NAMES[assignment.command]} (${assignment.command}) area of responsibility`,
    summary: `${assignment.verification}. ${assignment.note ?? `Assignment taken from ${assignment.sourceAuthority}.`}${history.length ? ` History preserved: previously ${history.map((entry) => entry.command).join(", ")}${history[0]?.effectiveTo ? ` until ${history[0].effectiveTo}` : ""}.` : ""}`,
    evidence: [`Registry ${ASSIGNMENT_REGISTRY_VERSION}`, `Command public scope: ${source.publicCount}`, `Authority: ${assignment.sourceAuthority}`, "The Unified Command Plan is classified; assignments are built from public DoD and command material."].join(" | "),
    sourceName: assignment.sourceAuthority,
    sourceUrl: assignment.sourceUrl,
    publishedAt: midnight(assignment.effectiveFrom),
    freshness: "STRUCTURAL_DATA",
    geometry: { type: "None" },
    geographyLevel: "country",
    geographyNote: SEPARATION_NOTE,
    extra: { ruleClass: COMMAND_RULE_CLASS, command: assignment.command, assignment, geographicClass: assignment.geographicClass, entityEvidence: assignment.entityEvidence, history, verificationStatus: assignment.verification },
  });
}

export async function commandPolicyAdapter(ctx: AdapterContext): Promise<AdapterResult> {
  const now = ctx.now();
  const resolution = resolveCountryCommand(ctx.country.iso3);
  if (!resolution.assigned) {
    return result(ctx, META, "no_current_matching_finding", [], `${COMMAND_NOT_ASSIGNED_TEXT} (${ctx.country.name}, ${ctx.country.iso3 || "no ISO3"}).`);
  }
  const records: EvidenceRecord[] = [assignmentRecord(ctx, resolution)];
  if (resolution.policy) records.push(policyRecord(ctx, resolution.policy, now, false));
  for (const old of resolution.supersededPolicies) records.push(policyRecord(ctx, old, now, true));
  for (const rule of resolution.rules) records.push(ruleRecord(ctx, resolution, rule));
  const note = resolution.commandMedicalPolicyStatus === "NOT_PUBLICLY_VERIFIED" ? NOT_PUBLICLY_VERIFIED_TEXT : null;
  return result(ctx, META, "ok", records, note);
}

/* ------------------------------------------------------------------ */
/* Source monitor: fingerprint the command's official pages            */
/* ------------------------------------------------------------------ */

const MONITOR_META = {
  sourceId: "command-policy-source-monitor",
  sourceName: "Official command medical-policy pages (reachability and change check)",
  sourceUrl: "https://www.defense.gov/Resources/Military-Departments/Our-Story/Combatant-Commands/index.html/",
  dimension: "command_policy" as const,
  freshness: "CURRENT_NOTICE" as const,
};

export function monitoredCommandUrls(iso3: string): Array<{ url: string; authority: string; purpose: string }> {
  const resolution = resolveCountryCommand(iso3);
  if (!resolution.command) return [];
  const targets = [...(COMMAND_MONITOR_TARGETS[resolution.command] ?? [])];
  // Assignment pages are watched too: a changed AOR page can mean a reassignment.
  const source = COMMAND_SOURCES[resolution.command];
  if (!targets.some((target) => target.url === source.url)) targets.push({ url: source.url, authority: source.authority, purpose: "AOR assignment source (watch for a changed country list)" });
  return targets;
}

export function createCommandSourceMonitor() {
  return async function commandSourceMonitorAdapter(ctx: AdapterContext, store?: CacheStore): Promise<AdapterResult> {
    const targets = monitoredCommandUrls(ctx.country.iso3);
    if (!targets.length) return result(ctx, MONITOR_META, "not_applicable", [], "No combatant command is assigned to this country in the configured registry.");
    if (!ctx.probeUrl) return result(ctx, MONITOR_META, "not_configured", [], "Page probing is not wired in this environment. Command policy pages have not been re-checked; revalidate them manually.");

    const states = await Promise.all(targets.map((target) => checkOne(target, ctx, store)));
    const records = states.map((state, index) => {
      const target = targets[index];
      const failed = state.sourceStatus !== "ok";
      const changed = state.changedSincePrevious === true;
      const summary = failed
        ? `Could not be reached on ${state.lastAttemptedFetch.slice(0, 10)} (${state.sourceError}). ${state.lastSuccessfulFetch ? `Last-known good fetch ${state.lastSuccessfulFetch.slice(0, 10)}.` : "No successful fetch is on record."} The extracted command rules are unchanged and unconfirmed.`
        : changed
          ? `The page content changed since the earlier recorded check. The extracted command rules are NOT rewritten automatically; re-read the source and review.`
          : `Reachable (HTTP ${state.httpStatus}) on ${state.lastSuccessfulFetch?.slice(0, 10)}.${state.sourceUpdatedAt ? ` Server Last-Modified ${state.sourceUpdatedAt.slice(0, 10)}.` : " The server reports no Last-Modified date."}`;
      return makeRecord(ctx, "command-source", {
        id: `command-source:${ctx.country.iso3}:${createHash("sha1").update(state.url).digest("hex").slice(0, 10)}`,
        dimension: "command_policy",
        category: "command_source_check",
        subtype: failed ? "source_unavailable" : changed ? "content_changed" : "reachable",
        title: `Source check — ${target.authority}`,
        summary,
        evidence: `${target.purpose}. ${state.url}`,
        sourceName: target.authority,
        sourceUrl: state.url,
        updatedAt: state.sourceUpdatedAt,
        retrievedAt: state.lastSuccessfulFetch ?? state.lastAttemptedFetch,
        freshness: failed && state.lastSuccessfulFetch ? "STALE_CACHE" : "CURRENT_NOTICE",
        geometry: { type: "None" },
        geographyLevel: "country",
        extra: { ruleClass: COMMAND_RULE_CLASS, sourceCheck: state },
      });
    });
    const anyOk = states.some((state) => state.sourceStatus === "ok");
    const sorted = [...states].sort((a, b) => (b.lastSuccessfulFetch ?? "").localeCompare(a.lastSuccessfulFetch ?? ""));
    return {
      ...result(ctx, MONITOR_META, anyOk ? "ok" : "source_unavailable", records, anyOk ? null : `None of the ${states.length} monitored command page${states.length === 1 ? "" : "s"} could be reached.`),
      lastAttemptedFetch: ctx.now().toISOString(),
      lastSuccessfulFetch: sorted[0]?.lastSuccessfulFetch ?? null,
      sourceError: anyOk ? null : states[0]?.sourceError ?? null,
    };
  };
}
