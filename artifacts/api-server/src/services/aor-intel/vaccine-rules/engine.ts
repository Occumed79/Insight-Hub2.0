import { VACCINE_RULES } from "./rules-data";
import type {
  AuthorityTier, CountryRuleAnswers, ResolvedRules, RuleConflict, RuleEvaluation, TimeLimit, TravelerQuery, VaccineRule, VerificationStatus,
} from "./types";

const DAY = 86_400_000;
const TIER_RANK: Record<AuthorityTier, number> = { destination_government: 5, embassy: 4, who: 3, cdc: 2, global_compilation: 1 };
const DATED_AFTER_YEARS = 3;

/* ------------------------------------------------------------------ */
/* Selection and precedence                                            */
/* ------------------------------------------------------------------ */

function jurisdictionOf(rule: VaccineRule): string {
  return rule.destinationCountry ?? rule.issuingCountry ?? rule.originCountries[0] ?? "";
}

/** Rules compete only when they speak about the same vaccine, direction, jurisdiction and event. WHO temporary recommendations never compete. */
export function ruleGroupKey(rule: VaccineRule): string {
  const unique = rule.legalForce === "who_temporary_recommendation" ? `|${rule.id}` : "";
  return `${rule.vaccine}|${rule.ruleType}|${jurisdictionOf(rule)}|${rule.eventType ?? ""}${unique}`;
}

const publishedMs = (rule: VaccineRule) => (rule.sourcePublishedAt ? Date.parse(rule.sourcePublishedAt) : Number.NEGATIVE_INFINITY);

/** Higher authority wins; within a tier the more recently published source wins. */
function precedence(a: VaccineRule, b: VaccineRule): number {
  return TIER_RANK[b.authorityTier] - TIER_RANK[a.authorityTier] || publishedMs(b) - publishedMs(a);
}

export const limitText = (limit: TimeLimit | null) => (limit ? `${limit.value} ${limit.unit} ${limit.relativeTo === "travel" ? "before travel" : `before ${limit.relativeTo}`}` : null);
const limitEqual = (a: TimeLimit | null, b: TimeLimit | null) => (a === null && b === null) || (a !== null && b !== null && a.value === b.value && a.unit === b.unit);
export const ageText = (rule: VaccineRule) => (rule.minimumAge === null ? null : `${rule.minimumAgeExclusive ? "older than" : "from"} ${rule.minimumAge} ${rule.ageUnit}`);
const statement = (rule: VaccineRule) => rule.normalizedRule;

function conflictsBetween(effective: VaccineRule, other: VaccineRule): RuleConflict[] {
  const refs = {
    effective: { authority: effective.sourceAuthority, sourceUrl: effective.sourceUrl, publishedAt: effective.sourcePublishedAt, statement: statement(effective) },
    superseded: { authority: other.sourceAuthority, sourceUrl: other.sourceUrl, publishedAt: other.sourcePublishedAt, statement: statement(other) },
  };
  const make = (kind: RuleConflict["kind"], severity: RuleConflict["severity"], summary: string): RuleConflict => ({
    id: `${effective.id}~${other.id}~${kind}`, kind, severity, effectiveRuleId: effective.id, supersededRuleId: other.id, summary, ...refs,
  });
  const found: RuleConflict[] = [];
  if (effective.legalForce === "removed" && other.legalForce !== "removed") {
    found.push(make("rule_withdrawn", "conflict", `${other.sourceAuthority} still lists this requirement; ${effective.sourceAuthority} (${effective.sourcePublishedAt ?? "undated"}) says it is no longer mandatory. The destination authority's newer statement is shown.`));
    return found;
  }
  if (effective.travelerGroup !== other.travelerGroup || effective.originScope !== other.originScope) {
    found.push(make("scope_differs", "conflict", `Who the rule covers differs: ${effective.sourceAuthority} → ${effective.travelerGroup.replace(/_/g, " ")} (${effective.originScope.replace(/_/g, " ")}); ${other.sourceAuthority} → ${other.travelerGroup.replace(/_/g, " ")} (${other.originScope.replace(/_/g, " ")}).`));
  }
  if (effective.minimumAge !== null && other.minimumAge !== null && (effective.minimumAge !== other.minimumAge || effective.ageUnit !== other.ageUnit)) {
    found.push(make("field_differs", "conflict", `Age threshold differs: ${effective.sourceAuthority} ${ageText(effective)}; ${other.sourceAuthority} ${ageText(other)}.`));
  } else if (effective.minimumAge === null && other.minimumAge !== null) {
    found.push(make("field_unstated_by_authority", "difference", `${other.sourceAuthority} states an age threshold (${ageText(other)}) that ${effective.sourceAuthority} does not state. No age limit is applied from the baseline.`));
  }
  if (effective.vaccineTimingMaximum && other.vaccineTimingMaximum && !limitEqual(effective.vaccineTimingMaximum, other.vaccineTimingMaximum)) {
    found.push(make("field_differs", "conflict", `Maximum vaccine age differs: ${effective.sourceAuthority} ${limitText(effective.vaccineTimingMaximum)}; ${other.sourceAuthority} ${limitText(other.vaccineTimingMaximum)}.`));
  }
  return found;
}

/** Picks the controlling rule in each group and preserves every disagreement with the rules it replaces. */
export function resolveRules(rules: readonly VaccineRule[]): ResolvedRules {
  const groups = new Map<string, VaccineRule[]>();
  for (const rule of rules) groups.set(ruleGroupKey(rule), [...(groups.get(ruleGroupKey(rule)) ?? []), rule]);
  const effective: VaccineRule[] = [];
  const superseded: VaccineRule[] = [];
  const conflicts: RuleConflict[] = [];
  for (const group of groups.values()) {
    const [winner, ...rest] = [...group].sort(precedence);
    effective.push(winner);
    for (const other of rest) {
      superseded.push(other);
      conflicts.push(...conflictsBetween(winner, other));
    }
  }
  return { effective, superseded, conflicts };
}

/** Rules that speak about a country: as destination, as issuing jurisdiction, or as a departure State named in a WHO exit recommendation. */
export function rulesForCountry(iso2: string, rules: readonly VaccineRule[] = VACCINE_RULES): VaccineRule[] {
  const code = iso2.toUpperCase();
  return rules.filter((rule) => rule.destinationCountry === code || rule.issuingCountry === code || (rule.ruleType === "exit" && rule.originCountries.includes(code)));
}

export function resolvedRulesForCountry(iso2: string, rules: readonly VaccineRule[] = VACCINE_RULES): ResolvedRules {
  return resolveRules(rulesForCountry(iso2, rules));
}

/* ------------------------------------------------------------------ */
/* Freshness qualifiers                                                */
/* ------------------------------------------------------------------ */

/** Current Hijri (Umm al-Qura) year, or null when the runtime has no Islamic calendar. */
export function currentHijriYear(now: Date): number | null {
  try {
    const text = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { year: "numeric" }).format(now);
    const year = Number(text.replace(/\D/g, ""));
    return year > 1300 && year < 1700 ? year : null;
  } catch {
    return null;
  }
}

export function isPriorSeason(rule: VaccineRule, now: Date): boolean {
  const current = currentHijriYear(now);
  return rule.hijriYear !== null && current !== null && current > rule.hijriYear;
}

export function isDatedSource(rule: VaccineRule, now: Date): boolean {
  return rule.sourcePublishedAt !== null && now.getTime() - Date.parse(rule.sourcePublishedAt) > DATED_AFTER_YEARS * 365 * DAY;
}

export function isRevalidationDue(rule: VaccineRule, now: Date): boolean {
  if (!rule.lastVerifiedAt) return true;
  return now.getTime() - Date.parse(rule.lastVerifiedAt) > rule.revalidateAfterDays * DAY;
}

/** Plain-language flags shown beside the verification status. */
export function freshnessQualifiers(rule: VaccineRule, now: Date): string[] {
  const flags: string[] = [];
  if (isPriorSeason(rule, now)) flags.push(`Prior-season document (${rule.seasonLabel}); current-season text not verified`);
  if (isDatedSource(rule, now)) flags.push(`Dated source (published ${rule.sourcePublishedAt?.slice(0, 4)})`);
  if (!rule.lastVerifiedAt) flags.push("Never re-verified against the destination authority");
  else if (isRevalidationDue(rule, now)) flags.push("Revalidation overdue");
  return flags;
}

export function rulesDueForRevalidation(now: Date, rules: readonly VaccineRule[] = VACCINE_RULES): VaccineRule[] {
  return rules.filter((rule) => rule.authorityTier !== "global_compilation" || rule.verificationStatus === "NOT CURRENTLY VERIFIED").filter((rule) => isRevalidationDue(rule, now));
}

/* ------------------------------------------------------------------ */
/* Traveler evaluation                                                 */
/* ------------------------------------------------------------------ */

type Tri = "yes" | "no" | "unknown";

const baseEvent = (value: string) => value.toLowerCase().replace(/\s*\(.*$/, "").trim();

function ageMonths(query: TravelerQuery): number | null {
  return query.ageYears === null || query.ageYears === undefined ? null : query.ageYears * 12;
}

function checkAge(rule: VaccineRule, query: TravelerQuery, reasons: string[], missing: string[]): Tri {
  if (rule.minimumAge === null && rule.maximumAge === null) return "yes";
  const months = ageMonths(query);
  if (months === null) {
    missing.push("ageYears");
    return "unknown";
  }
  const unit = rule.ageUnit === "months" ? 1 : 12;
  if (rule.minimumAge !== null) {
    const floor = rule.minimumAge * unit;
    if (rule.minimumAgeExclusive ? months <= floor : months < floor) {
      reasons.push(`Age ${query.ageYears} is below the stated threshold (${ageText(rule)}).`);
      return "no";
    }
  }
  if (rule.maximumAge !== null && months > rule.maximumAge * unit) {
    reasons.push(`Age ${query.ageYears} is above the stated maximum (${rule.maximumAge} ${rule.ageUnit}).`);
    return "no";
  }
  return "yes";
}

function checkOrigin(rule: VaccineRule, query: TravelerQuery, reasons: string[], missing: string[]): { direct: Tri; transit: Tri } {
  const exposure = [query.arrivingFrom, ...(query.visitedCountries ?? [])].filter((c): c is string => Boolean(c)).map((c) => c.toUpperCase());
  const transitLegs = (query.transit ?? []).map((leg) => ({ country: leg.country.toUpperCase(), hours: leg.hours }));
  const listed = (country: string) => rule.originCountries.includes(country);

  let direct: Tri = "yes";
  if (rule.originScope === "listed_countries") {
    if (exposure.some(listed)) {
      direct = "yes";
      reasons.push(`Traveler's origin or recent travel includes a listed country (${exposure.filter(listed).join(", ")}).`);
    } else if (exposure.length) {
      direct = "no";
      reasons.push("Traveler is not arriving from, and has not visited, a listed country.");
    } else {
      direct = "unknown";
      missing.push("arrivingFrom");
    }
  } else if (rule.originScope === "risk_countries_unenumerated") {
    direct = "unknown";
    missing.push("riskCountryList");
    reasons.push("The authority refers to risk or endemic countries without listing them in the captured text; compare the traveler's origin with the authority's current list.");
  } else if (rule.originScope === "issuing_country_residents") {
    const resident = (query.residentOf ?? "").toUpperCase();
    const leaving = (query.departingFrom ?? "").toUpperCase();
    const issuer = (code: string) => Boolean(code) && (rule.originCountries.includes(code) || rule.issuingCountry === code);
    if (!resident && !leaving) {
      direct = "unknown";
      missing.push("residentOf");
    } else if (issuer(resident) && rule.residencyApplies !== false) {
      direct = "yes";
      reasons.push(`Traveler is resident in ${resident}.`);
    } else if (issuer(leaving) && rule.longTermVisitorApplies && rule.stayDurationThresholdDays !== null) {
      if (query.stayDays === null || query.stayDays === undefined) {
        direct = "unknown";
        missing.push("stayDays");
        reasons.push(`Applies to long-term visitors (stay over ${rule.stayDurationThresholdDays} days) leaving ${leaving}.`);
      } else if (query.stayDays > rule.stayDurationThresholdDays) {
        direct = "yes";
        reasons.push(`Stay of ${query.stayDays} days exceeds the ${rule.stayDurationThresholdDays}-day long-term-visitor threshold.`);
      } else {
        direct = "no";
        reasons.push(`Stay of ${query.stayDays} days does not exceed the ${rule.stayDurationThresholdDays}-day long-term-visitor threshold.`);
      }
    } else {
      direct = "no";
      reasons.push("Traveler is not a resident of the State the rule addresses.");
    }
  }

  let transit: Tri = "no";
  const exposed = transitLegs.filter((leg) => rule.originScope === "any_origin" || rule.originScope === "risk_countries_unenumerated" || listed(leg.country));
  if (rule.originScope !== "issuing_country_residents" && exposed.length) {
    if (rule.transitApplies === false) {
      reasons.push("The authority states transit does not trigger the rule.");
    } else if (rule.transitApplies === null) {
      transit = "unknown";
      reasons.push("The authority does not state how airport transit is treated.");
    } else if (rule.transitThresholdHours === null) {
      transit = rule.originScope === "risk_countries_unenumerated" ? "unknown" : "yes";
      reasons.push("Transit counts and no minimum duration is stated.");
    } else {
      const over = exposed.filter((leg) => leg.hours > (rule.transitThresholdHours as number));
      if (over.length) {
        transit = rule.originScope === "risk_countries_unenumerated" ? "unknown" : "yes";
        reasons.push(`Transit of ${over.map((leg) => `${leg.hours} h in ${leg.country}`).join(", ")} exceeds the ${rule.transitThresholdHours}-hour threshold.`);
      } else {
        reasons.push(`Transit of ${exposed.map((leg) => `${leg.hours} h`).join(", ")} does not exceed the ${rule.transitThresholdHours}-hour threshold.`);
      }
    }
  }
  return { direct, transit };
}

function relevant(rule: VaccineRule, query: TravelerQuery): { ok: boolean; unknown: boolean; reason?: string } {
  const destination = query.destination.toUpperCase();
  if (rule.ruleType !== "exit") return { ok: rule.destinationCountry === destination, unknown: false };
  const homes = [query.departingFrom, query.residentOf].filter((c): c is string => Boolean(c)).map((c) => c.toUpperCase());
  if (!homes.some((home) => rule.originCountries.includes(home) || rule.issuingCountry === home)) return { ok: false, unknown: false };
  if (rule.destinationCountries.length && !rule.destinationCountries.includes(destination)) {
    return rule.destinationNote ? { ok: true, unknown: true, reason: `${destination} is not among the destinations named in the rule; the notice also covers destinations it does not name (${rule.destinationNote}).` } : { ok: false, unknown: false };
  }
  return { ok: true, unknown: false };
}

export function evaluateRule(rule: VaccineRule, query: TravelerQuery): RuleEvaluation | null {
  const scope = relevant(rule, query);
  if (!scope.ok) return null;
  const reasons: string[] = scope.reason ? [scope.reason] : [];
  const missing: string[] = [];
  const done = (applicability: RuleEvaluation["applicability"]): RuleEvaluation => ({ rule, applicability, reasons, missingInputs: [...new Set(missing)] });

  if (rule.legalForce === "removed") {
    reasons.push("The authority states this requirement no longer applies.");
    return done("removed");
  }

  // Event-specific rules apply only to the named event (and, for Hajj workers, only to workers).
  if (rule.eventType) {
    if (!query.event) {
      missing.push("event");
      reasons.push(`Applies only to ${rule.eventType} travel.`);
      return done("unknown");
    }
    if (!baseEvent(query.event).startsWith(baseEvent(rule.eventType))) {
      reasons.push(`Traveler's event (${query.event}) is not ${rule.eventType}.`);
      return done("does_not_apply");
    }
    const worker = Boolean(query.seasonalWorker);
    if ((rule.travelerGroup === "seasonal_workers") !== worker && (rule.travelerGroup === "seasonal_workers" || rule.travelerGroup === "pilgrims")) {
      reasons.push(rule.travelerGroup === "seasonal_workers" ? "Applies to seasonal workers in Hajj areas." : "Pilgrim rule; the traveler is a seasonal worker.");
      return done("does_not_apply");
    }
  }

  const age = checkAge(rule, query, reasons, missing);
  if (age === "no") return done("does_not_apply");

  const { direct, transit } = checkOrigin(rule, query, reasons, missing);
  if (direct === "yes" || transit === "yes") return done(age === "unknown" || scope.unknown ? "unknown" : "applies");
  if (direct === "unknown" || transit === "unknown" || age === "unknown") return done("unknown");
  return done("does_not_apply");
}

const ORDER: Record<RuleEvaluation["applicability"], number> = { applies: 0, unknown: 1, removed: 2, does_not_apply: 3 };

/** Evaluate the controlling rules against a traveler scenario. Superseded rules are not evaluated; their conflicts are returned. */
export function evaluateTraveler(query: TravelerQuery, rules: readonly VaccineRule[] = VACCINE_RULES): { evaluations: RuleEvaluation[]; conflicts: RuleConflict[] } {
  const resolved = resolveRules(rules.filter((rule) => rule.destinationCountry === query.destination.toUpperCase() || rule.issuingCountry === query.destination.toUpperCase() || rule.ruleType === "exit"));
  const evaluations = resolved.effective.map((rule) => evaluateRule(rule, query)).filter((value): value is RuleEvaluation => value !== null).sort((a, b) => ORDER[a.applicability] - ORDER[b.applicability] || a.rule.vaccine.localeCompare(b.rule.vaccine));
  const ids = new Set(evaluations.map((e) => e.rule.id));
  return { evaluations, conflicts: resolved.conflicts.filter((c) => ids.has(c.effectiveRuleId)) };
}

/* ------------------------------------------------------------------ */
/* Country-level answers                                               */
/* ------------------------------------------------------------------ */

const VERIFIED_FOR_REQUIREMENT: ReadonlySet<VerificationStatus> = new Set(["DESTINATION-GOVERNMENT VERIFIED", "EMBASSY VERIFIED", "WHO VERIFIED", "CDC CORROBORATED", "OLDER GLOBAL BASELINE"]);

export function describeCountry(iso2: string, now: Date, rules: readonly VaccineRule[] = VACCINE_RULES): CountryRuleAnswers {
  const code = iso2.toUpperCase();
  const resolved = resolvedRulesForCountry(code, rules);
  const effective = resolved.effective;
  const national = effective.filter((rule) => rule.legalForce !== "who_temporary_recommendation");

  const yfEntry = effective.filter((rule) => rule.vaccine === "Yellow Fever" && rule.ruleType === "entry" && rule.destinationCountry === code).sort(precedence)[0];
  const yellowFever: CountryRuleAnswers["yellowFever"] = {
    status: "not_verified", universal: null, originBased: null, transitTriggers: null, transitThresholdHours: null, proofViaICVP: null, ageThreshold: null, exemptions: [],
  };
  if (yfEntry && VERIFIED_FOR_REQUIREMENT.has(yfEntry.verificationStatus)) {
    yellowFever.status = yfEntry.legalForce === "removed" ? "removed" : yfEntry.legalForce === "declaration" ? "declaration_only" : yfEntry.originScope === "any_origin" ? "universal" : "origin_based";
    yellowFever.universal = yfEntry.legalForce === "mandatory" ? yfEntry.originScope === "any_origin" && yfEntry.travelerGroup === "all_arriving_travelers" : null;
    yellowFever.originBased = yfEntry.legalForce === "removed" ? null : yfEntry.originScope !== "any_origin";
    yellowFever.transitTriggers = yfEntry.legalForce === "removed" ? null : yfEntry.transitApplies;
    yellowFever.transitThresholdHours = yfEntry.transitThresholdHours;
    yellowFever.proofViaICVP = yfEntry.certificateType && /ICVP|International Certificate/i.test(yfEntry.certificateType) ? true : null;
    yellowFever.ageThreshold = ageText(yfEntry);
    yellowFever.exemptions = yfEntry.exemptions;
  }

  const polioRules = effective.filter((rule) => rule.vaccine === "Polio");
  const polioEntry = polioRules.filter((rule) => rule.legalForce === "mandatory" && rule.destinationCountry === code);
  const polioExit = polioRules.filter((rule) => rule.ruleType === "exit" && rule.legalForce === "mandatory");
  const polioWho = polioRules.filter((rule) => rule.legalForce === "who_temporary_recommendation");
  const polioParts = [
    polioEntry.length ? `${polioEntry.length} event-specific entry rule${polioEntry.length === 1 ? "" : "s"} (from listed origin countries)` : "",
    polioExit.length ? `${polioExit.length} national departure rule${polioExit.length === 1 ? "" : "s"}` : "",
    polioWho.length ? `${polioWho.length} WHO IHR temporary recommendation${polioWho.length === 1 ? "" : "s"} naming this State as an exit-vaccination State (recommendation to the State, not national law)` : "",
  ].filter(Boolean);

  const authorities = [...new Map(effective.map((rule) => [rule.sourceUrl, { authority: rule.sourceAuthority, sourceUrl: rule.sourceUrl, publishedAt: rule.sourcePublishedAt, verificationStatus: rule.verificationStatus }])).values()];
  const verified = effective.map((rule) => rule.lastVerifiedAt).filter((value): value is string => Boolean(value)).sort();

  const anyRequirement = national.some((rule) => (rule.legalForce === "mandatory" || rule.legalForce === "declaration") && rule.destinationCountry === code && VERIFIED_FOR_REQUIREMENT.has(rule.verificationStatus));
  return {
    iso2: code,
    anyVerifiedRequirement: anyRequirement ? "yes" : national.some((rule) => rule.legalForce === "removed") ? "removed" : national.length ? "no_verified_requirement" : "not_verified",
    yellowFever,
    polio: { entryRules: polioEntry.length, exitRules: polioExit.length, whoTemporaryRecommendations: polioWho.length, summary: polioParts.length ? polioParts.join("; ") : "No polio entry or exit rule verified from configured sources." },
    eventSpecific: national.filter((rule) => rule.eventType && rule.destinationCountry === code).map((rule) => ({ vaccine: rule.vaccine, eventType: rule.eventType as string, ruleId: rule.id, seasonLabel: rule.seasonLabel, seasonStale: isPriorSeason(rule, now) })),
    authorities,
    lastVerifiedAt: verified.length ? verified[verified.length - 1] : null,
    conflicts: resolved.conflicts,
  };
}
