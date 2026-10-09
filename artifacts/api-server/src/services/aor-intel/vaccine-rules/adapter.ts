import { createHash } from "node:crypto";
import type { CacheStore } from "../cache";
import { resolveCountry } from "../geo";
import type { AdapterContext, AdapterResult, EvidenceRecord, RequirementType, UrlProbe } from "../types";
import { errorText, isoOrNull, makeRecord, result } from "../util";
import { ageText, freshnessQualifiers, isDatedSource, isPriorSeason, limitText, resolvedRulesForCountry, ruleGroupKey } from "./engine";
import { UNREAD_VOLATILE_SOURCES } from "./rules-data";
import { registrySnapshotDate, registrySourcesForCountry } from "./source-registry";
import type { RuleConflict, VaccineRule } from "./types";

export const NO_VERIFIED_REQUIREMENT = "No current authoritative requirement verified from configured sources";

const ENTRY_META = {
  sourceId: "destination-entry-requirements",
  sourceName: "Vaccine entry / exit / transit / event rules (destination authority → WHO → CDC)",
  sourceUrl: "https://www.who.int/travel-advice/vaccines",
  dimension: "health_vaccines" as const,
  freshness: "STRUCTURAL_DATA" as const,
};

/* ------------------------------------------------------------------ */
/* Presentation helpers                                                */
/* ------------------------------------------------------------------ */

const GROUP_LABEL: Record<VaccineRule["travelerGroup"], string> = {
  all_arriving_travelers: "All arriving travelers",
  arrivals_from_listed_countries: "Travelers arriving from listed countries",
  arrivals_from_risk_countries: "Travelers arriving from risk / endemic countries",
  pilgrims: "Pilgrims",
  seasonal_workers: "Seasonal workers",
  residents_and_long_term_visitors: "Residents and long-term visitors",
  residents_departing: "Residents departing the country",
  transit_passengers: "Transit passengers",
};

const countryName = (iso2: string) => resolveCountry(iso2)?.name ?? iso2;

function listCountries(codes: string[], max = 60): string {
  const names = codes.map(countryName);
  return names.length <= max ? names.join(", ") : `${names.slice(0, max).join(", ")} … (+${names.length - max})`;
}

function originText(rule: VaccineRule): string {
  switch (rule.originScope) {
    case "any_origin":
      return "Any origin";
    case "listed_countries":
      return `${rule.originCountries.length} listed countries${rule.originRiskAreaNote ? ` (${rule.originRiskAreaNote})` : ""}: ${listCountries(rule.originCountries)}`;
    case "risk_countries_unenumerated":
      return `Risk / endemic countries — ${rule.originRiskAreaNote ?? "the authority's list was not captured"}`;
    case "issuing_country_residents":
      return `Residents of ${listCountries(rule.originCountries)}${rule.originRiskAreaNote ? ` — ${rule.originRiskAreaNote}` : ""}`;
  }
}

function transitText(rule: VaccineRule): string {
  if (rule.transitApplies === null) return "Not stated by the source";
  if (rule.transitApplies === false) return "Transit does not trigger the rule";
  return rule.transitThresholdHours === null ? "Transit counts; no minimum duration stated" : `Airport transit longer than ${rule.transitThresholdHours} hours counts`;
}

function residencyText(rule: VaccineRule): string | null {
  if (rule.residencyApplies === null && rule.longTermVisitorApplies === null) return null;
  const parts = [rule.residencyApplies ? "residents" : "", rule.longTermVisitorApplies ? `long-term visitors${rule.stayDurationThresholdDays ? ` (stay over ${rule.stayDurationThresholdDays} days)` : ""}` : ""].filter(Boolean);
  return parts.join(" and ") || null;
}

function timingText(rule: VaccineRule): string | null {
  const parts = [rule.vaccineTimingMinimum ? `at least ${limitText(rule.vaccineTimingMinimum)}` : "", rule.vaccineTimingMaximum ? `no more than ${limitText(rule.vaccineTimingMaximum)}` : ""].filter(Boolean);
  return parts.length ? parts.join("; ") : null;
}

export function appliesToText(rule: VaccineRule): string {
  const event = rule.eventType ? `${rule.eventType}${rule.travelerGroup === "pilgrims" ? " pilgrims" : ""} only` : "";
  const who = GROUP_LABEL[rule.travelerGroup];
  if (rule.legalForce === "who_temporary_recommendation") return `${who} of the infected State — a WHO recommendation to that State, not national law`;
  return rule.eventType ? `${event}. Not a general entry requirement for other purposes of travel.` : who;
}

export type ConditionRow = { label: string; value: string };

/** Ordered facts the UI shows for a rule. Only fields the source supports appear; silence is stated as silence. */
export function describeConditions(rule: VaccineRule, now: Date): ConditionRow[] {
  const rows: ConditionRow[] = [];
  const add = (label: string, value: string | null) => { if (value) rows.push({ label, value }); };
  add("Rule type", `${rule.ruleType}${rule.ruleType === "exit" && rule.legalForce !== "who_temporary_recommendation" ? " (resident / departure)" : ""} · ${rule.legalForce.replace(/_/g, " ")}`);
  add("Applies to", GROUP_LABEL[rule.travelerGroup]);
  add("Origin", originText(rule));
  if (rule.destinationCountries.length || rule.destinationNote) add("Destinations", [rule.destinationCountries.length ? listCountries(rule.destinationCountries) : "", rule.destinationNote ?? ""].filter(Boolean).join("; "));
  if (rule.ruleType !== "exit" || rule.legalForce !== "who_temporary_recommendation") add("Transit", transitText(rule));
  if (rule.exposureLookbackDays !== null) add("Exposure look-back", `${rule.exposureLookbackDays} days`);
  add("Age", ageText(rule) ?? "No age threshold stated by the source");
  add("Residents / long-term visitors", residencyText(rule));
  if (rule.eventType) add("Event / season", `${rule.eventType}${rule.seasonLabel ? ` · ${rule.seasonLabel}` : ""}`);
  add("Vaccine timing", timingText(rule));
  add("Vaccine detail", rule.vaccineDetail);
  add("Certificate", rule.certificateRequired === null ? rule.certificateType : `${rule.certificateRequired ? "Required" : "Not required"}${rule.certificateType ? ` — ${rule.certificateType}` : ""}`);
  add("Certificate validity", rule.certificateValidity);
  if (rule.exemptions.length) add("Exemptions", rule.exemptions.join("; "));
  add("Effective", rule.validFrom ? `from ${rule.validFrom}${rule.validUntil ? ` until ${rule.validUntil}` : ""}` : rule.validUntil ? `until ${rule.validUntil}` : "Effective date not stated by the source");
  add("Authority", `${rule.sourceAuthority} (${rule.authorityTier.replace(/_/g, " ")})`);
  add("Source published / updated", rule.sourcePublishedAt ?? "Not stated by the source");
  add("Read for this record", rule.retrievedAt);
  add("Last verified", rule.lastVerifiedAt ?? "Never re-verified against the destination authority");
  add("Next revalidation", `within ${rule.revalidateAfterDays} days of the last verification`);
  const flags = freshnessQualifiers(rule, now);
  if (flags.length) add("Freshness flags", flags.join("; "));
  return rows;
}

function requirementTypeOf(rule: VaccineRule): RequirementType | null {
  if (rule.verificationStatus === "NOT CURRENTLY VERIFIED") return "not_evaluated";
  switch (rule.legalForce) {
    case "who_temporary_recommendation":
      return null;
    case "removed":
      return "not_required";
    case "declaration":
      return "declaration_only";
    case "mandatory":
      if (rule.ruleType === "exit") return "exit_required";
      return rule.ruleType === "entry" && rule.originScope === "any_origin" && rule.travelerGroup === "all_arriving_travelers" ? "entry_required" : "entry_required_conditional";
  }
}

function titleOf(rule: VaccineRule): string {
  if (rule.verificationStatus === "NOT CURRENTLY VERIFIED") return `${rule.vaccine} — baseline lists an entry requirement; current rule not verified`;
  if (rule.legalForce === "removed") return `${rule.vaccine} — requirement withdrawn by the destination authority`;
  if (rule.legalForce === "who_temporary_recommendation") return `${rule.vaccine} — WHO IHR temporary recommendation for travelers leaving this State`;
  if (rule.legalForce === "declaration") return `${rule.vaccine} — declaration regime (entry not refused for lack of vaccination)`;
  if (rule.ruleType === "exit") return `${rule.vaccine} — requirement for residents departing`;
  if (rule.eventType) return `${rule.vaccine} — ${rule.eventType} requirement${rule.seasonLabel ? ` (${rule.seasonLabel})` : ""}`;
  return `${rule.vaccine} — ${rule.originScope === "any_origin" ? "entry requirement" : "entry requirement based on origin"}`;
}

const midnight = (date: string | null) => (date ? isoOrNull(`${date.length === 10 ? date : `${date}-01`}T00:00:00Z`) : null);

function toRecord(ctx: AdapterContext, rule: VaccineRule, alsoStatedBy: VaccineRule[], conflictIds: string[]): EvidenceRecord {
  const now = ctx.now();
  const who = rule.legalForce === "who_temporary_recommendation";
  const prior = isPriorSeason(rule, now);
  const dated = isDatedSource(rule, now);
  const rows = describeConditions(rule, now);
  return makeRecord(ctx, "entry", {
    id: `entry:${ctx.country.iso2}:${rule.id}`,
    dimension: "health_vaccines",
    category: who ? "ihr_temporary_recommendation" : rule.ruleType === "exit" ? "exit_requirement" : "entry_requirement",
    subtype: `${rule.vaccine} ${rule.ruleType}${rule.eventType ? ` (${rule.eventType})` : ""} rule`,
    title: titleOf(rule),
    summary: rule.normalizedRule,
    evidence: [rule.vaccineDetail, ...rule.notes].filter(Boolean).join(" "),
    requirementType: requirementTypeOf(rule),
    recommendationType: who ? "recommended" : null,
    sourceName: rule.sourceAuthority,
    sourceUrl: rule.sourceUrl,
    publishedAt: midnight(rule.sourcePublishedAt),
    updatedAt: midnight(rule.lastVerifiedAt),
    retrievedAt: midnight(rule.retrievedAt) ?? ctx.now().toISOString(),
    freshness: "STRUCTURAL_DATA",
    geometry: { type: "None" },
    geographyLevel: "country",
    geographyNote: `Country-level rule. ${rule.verificationStatus}${prior ? " — prior-season document" : ""}${dated ? " — dated source" : ""}. Rules change without notice: confirm with the destination authority before travel.`,
    extra: {
      vaccine: rule.vaccine,
      appliesTo: appliesToText(rule),
      ruleType: rule.ruleType,
      legalForce: rule.legalForce,
      verificationStatus: rule.verificationStatus,
      authorityTier: rule.authorityTier,
      qualifiers: freshnessQualifiers(rule, now),
      conditions: rows,
      priorSeason: prior,
      datedSource: dated,
      productionVerificationRequired: rule.productionVerificationRequired,
      vaccineRule: rule,
      alsoStatedBy: alsoStatedBy.map((other) => ({ ruleId: other.id, authority: other.sourceAuthority, sourceUrl: other.sourceUrl, publishedAt: other.sourcePublishedAt, verificationStatus: other.verificationStatus, statement: other.normalizedRule })),
      supportingSources: rule.supportingSources,
      conflictIds,
    },
  });
}

function conflictRecord(ctx: AdapterContext, conflict: RuleConflict, vaccine: string): EvidenceRecord {
  return makeRecord(ctx, "entry-conflict", {
    id: `entry-conflict:${ctx.country.iso2}:${conflict.id}`,
    dimension: "health_vaccines",
    category: "entry_rule_conflict",
    subtype: conflict.kind,
    title: `${vaccine} — ${conflict.severity === "conflict" ? "sources conflict" : "sources differ"}: ${conflict.effective.authority} vs ${conflict.superseded.authority}`,
    summary: conflict.summary,
    evidence: `Shown: ${conflict.effective.statement} Also stated (not shown as current): ${conflict.superseded.statement}`,
    sourceName: conflict.effective.authority,
    sourceUrl: conflict.effective.sourceUrl,
    publishedAt: midnight(conflict.effective.publishedAt),
    freshness: "STRUCTURAL_DATA",
    geometry: { type: "None" },
    geographyLevel: "country",
    geographyNote: "Both statements are preserved. The higher-authority, newer statement controls the displayed rule; the other is kept as provenance.",
    extra: { conflict },
  });
}

/* ------------------------------------------------------------------ */
/* Adapter                                                             */
/* ------------------------------------------------------------------ */

export async function entryRequirementsAdapter(ctx: AdapterContext): Promise<AdapterResult> {
  const { iso2, iso3 } = ctx.country;
  const resolved = resolvedRulesForCountry(iso2);
  const nationalRules = resolved.effective.filter((rule) => rule.legalForce !== "who_temporary_recommendation" && rule.verificationStatus !== "NOT CURRENTLY VERIFIED");
  const records: EvidenceRecord[] = [];
  const supersededFor = (rule: VaccineRule) => resolved.superseded.filter((other) => ruleGroupKey(other) === ruleGroupKey(rule));

  for (const rule of resolved.effective) {
    records.push(toRecord(ctx, rule, supersededFor(rule), resolved.conflicts.filter((c) => c.effectiveRuleId === rule.id).map((c) => c.id)));
  }
  const vaccineOf = new Map([...resolved.effective, ...resolved.superseded].map((rule) => [rule.id, rule.vaccine]));
  for (const conflict of resolved.conflicts) records.push(conflictRecord(ctx, conflict, vaccineOf.get(conflict.effectiveRuleId) ?? "Vaccine"));

  // Coverage record: states what was and was not established, and where to look next. It never says "not required".
  const sources = registrySourcesForCountry(iso3);
  const toCheck = sources.slice(0, 14).map((source) => ({ authority: source.authority, check: source.check, url: source.url, section: source.section }));
  const unread = UNREAD_VOLATILE_SOURCES.filter((source) => source.iso2 === iso2);
  const covered = nationalRules.length > 0;
  records.push(makeRecord(ctx, "entry-coverage", {
    id: `entry-coverage:${iso2}`,
    dimension: "health_vaccines",
    category: "entry_requirement_coverage",
    subtype: "Entry / exit / transit rule coverage",
    title: covered ? "Rule coverage for this destination" : NO_VERIFIED_REQUIREMENT,
    summary: covered
      ? `${nationalRules.length} destination-authority or baseline rule${nationalRules.length === 1 ? "" : "s"} on file. Other vaccines, traveler groups and itineraries not shown here have not been evaluated.`
      : `${ctx.country.name} has no rule on file from the destination government, WHO or the CDC/WHO baseline. This is not confirmation that no requirement exists: the sources below have not been read for this country.`,
    evidence: `Source registry snapshot ${registrySnapshotDate}: ${sources.length} official link${sources.length === 1 ? "" : "s"} indexed for ${ctx.country.name}.`,
    requirementType: covered ? null : "not_evaluated",
    sourceName: "AOR vaccine-entry source registry",
    sourceUrl: sources[0]?.url ?? "https://www.who.int/travel-advice/vaccines",
    freshness: "STRUCTURAL_DATA",
    geometry: { type: "None" },
    geographyLevel: "country",
    geographyNote: "Destination-country authorities are listed before WHO profile pages.",
    extra: { sourcesToCheck: toCheck, unreadVolatileSources: unread, registrySnapshot: registrySnapshotDate, nationalRuleCount: nationalRules.length, conflictCount: resolved.conflicts.length },
  }));

  return result(ctx, ENTRY_META, covered || resolved.effective.length ? "ok" : "no_current_matching_finding", records, covered || resolved.effective.length ? null : `${NO_VERIFIED_REQUIREMENT}. Not evidence that no requirement applies.`);
}

/* ------------------------------------------------------------------ */
/* Source monitor: are the official pages behind the rules reachable / unchanged? */
/* ------------------------------------------------------------------ */

const MONITOR_META = {
  sourceId: "vaccine-rule-source-monitor",
  sourceName: "Official pages behind this country's vaccine rules (reachability and change check)",
  sourceUrl: "https://www.who.int/travel-advice/vaccines",
  dimension: "health_vaccines" as const,
  freshness: "CURRENT_NOTICE" as const,
};
const MONITOR_TTL_MS = 120 * 86_400_000;

export interface SourceCheckState {
  url: string;
  lastAttemptedFetch: string;
  lastSuccessfulFetch: string | null;
  sourceStatus: "ok" | "source_unavailable";
  sourceError: string | null;
  sourceUpdatedAt: string | null;
  httpStatus: number | null;
  finalUrl: string | null;
  contentHash: string | null;
  /** True once a later successful fetch returned different content than the first recorded one for the same page. */
  changedSincePrevious: boolean | null;
  previousContentHash: string | null;
}

const stateKey = (url: string) => `aor-vaccine-source:v1:${createHash("sha1").update(url).digest("hex")}`;

export function monitoredUrls(iso2: string): Array<{ url: string; authority: string; purpose: string }> {
  const resolved = resolvedRulesForCountry(iso2);
  const map = new Map<string, { url: string; authority: string; purpose: string }>();
  for (const rule of resolved.effective) {
    if (rule.authorityTier === "global_compilation" || rule.authorityTier === "cdc") continue;
    if (!map.has(rule.sourceUrl)) map.set(rule.sourceUrl, { url: rule.sourceUrl, authority: rule.sourceAuthority, purpose: "Page the rule was read from" });
  }
  for (const source of UNREAD_VOLATILE_SOURCES.filter((entry) => entry.iso2 === iso2)) {
    if (!map.has(source.url)) map.set(source.url, { url: source.url, authority: source.authority, purpose: `Not yet read: ${source.reason}` });
  }
  return [...map.values()].slice(0, 6);
}

export async function checkOne(target: { url: string }, ctx: AdapterContext, store: CacheStore | undefined): Promise<SourceCheckState> {
  const now = ctx.now().toISOString();
  const previous = store ? (await store.get<SourceCheckState>(stateKey(target.url)))?.payload ?? null : null;
  let probe: UrlProbe;
  try {
    probe = await (ctx.probeUrl as NonNullable<AdapterContext["probeUrl"]>)(target.url);
    if (probe.httpStatus >= 400) throw new Error(`Source returned HTTP ${probe.httpStatus}`);
  } catch (error) {
    // Keep the last-known fetch details; the failure is recorded, never silently dropped.
    return {
      url: target.url,
      lastAttemptedFetch: now,
      lastSuccessfulFetch: previous?.lastSuccessfulFetch ?? null,
      sourceStatus: "source_unavailable",
      sourceError: errorText(error),
      sourceUpdatedAt: previous?.sourceUpdatedAt ?? null,
      httpStatus: previous?.httpStatus ?? null,
      finalUrl: previous?.finalUrl ?? null,
      contentHash: previous?.contentHash ?? null,
      changedSincePrevious: previous?.changedSincePrevious ?? null,
      previousContentHash: previous?.previousContentHash ?? null,
    };
  }
  const changed = previous?.contentHash && probe.contentHash ? previous.contentHash !== probe.contentHash : null;
  const next: SourceCheckState = {
    url: target.url,
    lastAttemptedFetch: now,
    lastSuccessfulFetch: now,
    sourceStatus: "ok",
    sourceError: null,
    sourceUpdatedAt: isoOrNull(probe.lastModified),
    httpStatus: probe.httpStatus,
    finalUrl: probe.finalUrl,
    contentHash: probe.contentHash,
    changedSincePrevious: changed,
    previousContentHash: changed ? previous?.contentHash ?? null : previous?.previousContentHash ?? null,
  };
  if (store) await store.set(stateKey(target.url), next, MONITOR_TTL_MS, ctx.now());
  return next;
}

export function createRuleSourceMonitor() {
  return async function ruleSourceMonitorAdapter(ctx: AdapterContext, store?: CacheStore): Promise<AdapterResult> {
    const targets = monitoredUrls(ctx.country.iso2);
    if (!targets.length) return result(ctx, MONITOR_META, "not_applicable", [], "No destination-authority or WHO page is attached to this country's rules.");
    if (!ctx.probeUrl) return result(ctx, MONITOR_META, "not_configured", [], "Page probing is not wired in this environment. Rule pages have not been re-checked; revalidate them manually.");

    const states = await Promise.all(targets.map((target) => checkOne(target, ctx, store)));
    const records = states.map((state, index) => {
      const target = targets[index];
      const failed = state.sourceStatus !== "ok";
      const summary = failed
        ? `Could not be reached on ${state.lastAttemptedFetch.slice(0, 10)} (${state.sourceError}). ${state.lastSuccessfulFetch ? `Last-known good fetch ${state.lastSuccessfulFetch.slice(0, 10)}; details below are last-known data, not a current check.` : "It has not been fetched successfully by this system, so the rule shown from this page is not re-verified."}`
        : `Reachable (HTTP ${state.httpStatus}) on ${state.lastSuccessfulFetch?.slice(0, 10)}.${state.sourceUpdatedAt ? ` Server Last-Modified ${state.sourceUpdatedAt.slice(0, 10)}.` : " The server reports no Last-Modified date."} ${state.changedSincePrevious === null ? "First successful check recorded; later checks will flag content changes." : state.changedSincePrevious ? "Page content differs from the previous successful check (may be cosmetic): re-read the rule." : "Page content is unchanged since the previous successful check."}`;
      return makeRecord(ctx, "entry-source", {
        id: `entry-source:${ctx.country.iso2}:${createHash("sha1").update(state.url).digest("hex").slice(0, 10)}`,
        dimension: "health_vaccines",
        category: "rule_source_check",
        subtype: failed ? "source_unavailable" : state.changedSincePrevious ? "content_changed" : "reachable",
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
        extra: { sourceCheck: state },
      });
    });
    const anyOk = states.some((state) => state.sourceStatus === "ok");
    const sorted = [...states].sort((a, b) => (b.lastSuccessfulFetch ?? "").localeCompare(a.lastSuccessfulFetch ?? ""));
    return {
      ...result(ctx, MONITOR_META, anyOk ? "ok" : "source_unavailable", records, anyOk ? null : `None of the ${states.length} monitored official page${states.length === 1 ? "" : "s"} could be reached: ${states.map((s) => s.sourceError).filter(Boolean).slice(0, 2).join("; ")}.`),
      lastAttemptedFetch: ctx.now().toISOString(),
      lastSuccessfulFetch: sorted[0]?.lastSuccessfulFetch ?? null,
      sourceError: anyOk ? null : states[0]?.sourceError ?? null,
    };
  };
}
