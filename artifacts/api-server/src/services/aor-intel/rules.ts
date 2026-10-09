import type { AdapterResult, CountryRef, Dimension, EvidenceRecord, Freshness, Observation } from "./types";

// Deterministic rules turn normalized evidence into "What Matters Now" observations.
// Rules never rank across dimensions and never produce a numeric score; each
// observation lists the evidence ids it rests on. Thresholds below are descriptive
// cut-offs stated in the observation text, not risk scores.

const DIMENSION_ORDER: Dimension[] = ["health_vaccines", "command_policy", "malaria", "outbreaks", "disasters", "environment", "security", "medical_access"];
const DAY = 86_400_000;

const byDimension = (records: EvidenceRecord[], dimension: Dimension) => records.filter((record) => record.dimension === dimension);
const freshnessOf = (records: EvidenceRecord[]): Freshness | null => records[0]?.freshness ?? null;
let counter = 0;
const nextId = (prefix: string) => `${prefix}-${(counter += 1)}`;

export function buildObservations(country: CountryRef, results: AdapterResult[], now: Date): Observation[] {
  counter = 0;
  const records = results.flatMap((result) => result.records);
  const observations: Observation[] = [];
  const add = (observation: Omit<Observation, "id">) => observations.push({ id: nextId(observation.dimension), ...observation });
  const status = (sourceId: string) => results.find((result) => result.sourceId === sourceId)?.status;

  // --- Vaccines: recommendations and entry requirements stay separate -----------------
  const vaccines = byDimension(records, "health_vaccines");
  const recommended = vaccines.filter((r) => r.category === "travel_vaccine" && (r.recommendationType === "recommended" || r.recommendationType === "selected_travelers" || r.recommendationType === "consider"));
  if (recommended.length) {
    const names = recommended.map((r) => `${r.subtype} (${(r.recommendationType || "").replace(/_/g, " ")})`);
    add({ dimension: "health_vaccines", kind: "finding", headline: `CDC destination guidance lists ${recommended.length} travel vaccine item${recommended.length === 1 ? "" : "s"}`, detail: `${names.slice(0, 6).join("; ")}${names.length > 6 ? "; …" : ""}. These are CDC recommendations, not entry requirements.`, evidenceIds: recommended.slice(0, 8).map((r) => r.id), freshness: "CURRENT_GUIDANCE" });
  }
  const cdcText = vaccines.filter((r) => r.category === "entry_requirement" && r.sourceName.startsWith("CDC Travelers") && r.requirementType && r.requirementType !== "not_required");
  if (cdcText.length) {
    add({ dimension: "health_vaccines", kind: "finding", headline: "Entry-requirement language appears in the CDC destination text", detail: `${cdcText.map((r) => `${r.subtype.replace(/ entry requirement$/, "")}${r.requirementType === "entry_required_after_transit" ? " (tied to prior travel/transit)" : ""}`).join("; ")}. Verify against the destination government before travel.`, evidenceIds: cdcText.map((r) => r.id), freshness: "CURRENT_GUIDANCE" });
  }
  addVaccineRuleObservations(vaccines, status("destination-entry-requirements"), add);
  addCommandPolicyObservations(byDimension(records, "command_policy"), country, add);
  const yellowBook = vaccines.filter((r) => r.category === "yellow_book_reference");
  if (yellowBook.length) {
    add({ dimension: "health_vaccines", kind: "caveat", headline: `Yellow Book reference chapters linked: ${yellowBook.map((r) => r.subtype).slice(0, 8).join(", ")}`, detail: "Clinical and operational reference text for diseases the CDC/WHO items name for this country. Reference context only, not a statement of current country risk.", evidenceIds: yellowBook.map((r) => r.id).slice(0, 12), freshness: "STRUCTURAL_DATA" });
  }
  const coverage = vaccines.filter((r) => r.category === "immunization_coverage");
  const lowCoverage = coverage.filter((r) => ["mcv1", "mcv2", "dtp3", "pol3"].some((a) => r.subtype === `wuenic_${a}`) && Number(r.extra?.coveragePercent) < 90);
  if (lowCoverage.length) {
    add({ dimension: "health_vaccines", kind: "finding", headline: `WUENIC childhood coverage below 90% for ${lowCoverage.map((r) => `${String(r.extra?.antigen)} (${r.extra?.coveragePercent}%, ${r.extra?.year})`).join(", ")}`, detail: "National programme estimates against the Immunization Agenda 2030 90% coverage target. Population-level context; it does not set traveler recommendations and is an annual estimate, not current.", evidenceIds: lowCoverage.map((r) => r.id), freshness: "STRUCTURAL_DATA" });
  } else if (coverage.length) {
    add({ dimension: "health_vaccines", kind: "caveat", headline: `WUENIC childhood coverage: ${coverage.map((r) => `${String(r.extra?.antigen)} ${r.extra?.coveragePercent}%`).join(", ")} (${coverage[0].extra?.year})`, detail: "Annual national programme estimates, not current and not a traveler recommendation.", evidenceIds: coverage.map((r) => r.id), freshness: "STRUCTURAL_DATA" });
  }

  // --- Malaria ---------------------------------------------------------------------
  const malaria = records.find((r) => r.dimension === "malaria");
  if (malaria) {
    const model = (malaria.extra?.malaria ?? {}) as { riskScope?: string; seasonality?: string | null; altitudeNote?: string | null; altitudeLimitMeters?: number | null; altitudeScopeNote?: string | null; preventionDrugs?: string[]; places?: Array<{ name: string; risk: string; elevationLimitMeters: number | null }> };
    const scope = model.riskScope === "country_wide" ? "country-wide risk stated" : model.riskScope === "parts_of_country" ? "risk stated for parts of the country (areas not mapped)" : model.riskScope === "none_stated" ? "CDC states no malaria transmission" : "risk scope not stated in the retrieved text";
    const extras = [model.seasonality ? `seasonality: ${model.seasonality}` : "", model.altitudeNote ? `altitude: ${model.altitudeNote}${model.altitudeLimitMeters ? ` (limit ${model.altitudeLimitMeters} m is drawn on the terrain)` : ""}` : "", model.places?.length ? `named places (listed, not drawn): ${model.places.map((place) => `${place.name}${place.risk === "no_risk" ? " (no risk stated)" : ""}${place.elevationLimitMeters ? ` (${place.elevationLimitMeters} m limit)` : ""}`).join(", ")}` : "", model.altitudeScopeNote ? model.altitudeScopeNote : "", model.preventionDrugs?.length ? `prevention drugs named: ${model.preventionDrugs.join(", ")}` : ""].filter(Boolean);
    add({ dimension: "malaria", kind: model.riskScope === "none_stated" ? "caveat" : "finding", headline: `Malaria — ${scope}`, detail: extras.length ? `${extras.join("; ")}.` : "Seasonality, altitude limits and prophylaxis choices were not stated in the retrieved text; consult the CDC page.", evidenceIds: [malaria.id], freshness: "CURRENT_GUIDANCE" });
  }

  // --- Outbreaks -------------------------------------------------------------------
  const notices = byDimension(records, "outbreaks").filter((r) => r.category === "travel_health_notice");
  if (notices.length) {
    add({ dimension: "outbreaks", kind: "finding", headline: `${notices.length} CDC Travel Health Notice${notices.length === 1 ? "" : "s"} name this country`, detail: notices.slice(0, 4).map((r) => `${r.severity}: ${r.title}`).join("; "), evidenceIds: notices.map((r) => r.id), freshness: "CURRENT_NOTICE" });
  }
  const don = byDimension(records, "outbreaks").filter((r) => r.category === "disease_outbreak_news");
  const recentDon = don.filter((r) => r.publishedAt && now.getTime() - Date.parse(r.publishedAt) <= 180 * DAY);
  if (recentDon.length) {
    add({ dimension: "outbreaks", kind: "finding", headline: `${recentDon.length} WHO Disease Outbreak News item${recentDon.length === 1 ? "" : "s"} in the last 180 days mention this country`, detail: `${recentDon.slice(0, 3).map((r) => r.title).join("; ")}. Matched by text; the event may be sub-national or multi-country.`, evidenceIds: recentDon.map((r) => r.id), freshness: "CURRENT_NOTICE" });
  } else if (don.length) {
    add({ dimension: "outbreaks", kind: "caveat", headline: `${don.length} older WHO Disease Outbreak News item${don.length === 1 ? "" : "s"} mention this country`, detail: "None were published in the last 180 days.", evidenceIds: don.map((r) => r.id), freshness: "CURRENT_NOTICE" });
  }

  const flu = records.find((r) => r.category === "respiratory_surveillance");
  if (flu) {
    const positivity = Number(flu.extra?.positivity4Week);
    const processed = Number(flu.extra?.processed4Week);
    const ageDays = Number(flu.extra?.reportingAgeDays);
    const elevated = Number.isFinite(positivity) && processed >= 50 && positivity >= 0.1 && ageDays <= 28;
    add({ dimension: "outbreaks", kind: elevated ? "finding" : "caveat", headline: elevated ? `WHO FluNet: ${(positivity * 100).toFixed(1)}% of specimens influenza-positive over the last 4 reporting weeks (≥10% of ≥50 processed)` : `WHO FluNet influenza: ${flu.extra?.staleReporting ? "last report is old" : "reporting current"}${Number.isFinite(positivity) ? `, ${(positivity * 100).toFixed(1)}% positive over the last reporting weeks` : ""}`, detail: `${flu.summary} Weekly laboratory surveillance with reporting lag; influenza only (RSV/SARS-CoV-2 not evaluated).`, evidenceIds: [flu.id], freshness: "WEEKLY_SURVEILLANCE" });
  }

  // --- Disasters -------------------------------------------------------------------
  const gdacs = byDimension(records, "disasters").filter((r) => r.sourceName === "GDACS");
  const elevated = gdacs.filter((r) => /orange|red/i.test(r.severity || ""));
  if (elevated.length) {
    add({ dimension: "disasters", kind: "finding", headline: `${elevated.length} GDACS Orange/Red alert${elevated.length === 1 ? "" : "s"} in the last 90 days`, detail: elevated.slice(0, 4).map((r) => `${r.subtype} — ${r.severity}`).join("; "), evidenceIds: elevated.map((r) => r.id), freshness: "NEAR_REAL_TIME" });
  } else if (gdacs.length) {
    add({ dimension: "disasters", kind: "caveat", headline: `${gdacs.length} GDACS event${gdacs.length === 1 ? "" : "s"} in the last 90 days (no Orange/Red alert)`, detail: gdacs.slice(0, 3).map((r) => `${r.subtype}: ${r.title}`).join("; "), evidenceIds: gdacs.map((r) => r.id), freshness: "NEAR_REAL_TIME" });
  }
  const rw = byDimension(records, "disasters").filter((r) => r.category === "humanitarian_disaster");
  if (rw.length) {
    add({ dimension: "disasters", kind: "finding", headline: `${rw.length} alert/ongoing ReliefWeb disaster entr${rw.length === 1 ? "y" : "ies"} tagged to this country`, detail: `${rw.slice(0, 3).map((r) => r.title).join("; ")}. Country-tagged by OCHA; affected areas are not mapped.`, evidenceIds: rw.map((r) => r.id), freshness: "CURRENT_NOTICE" });
  }
  const quakes = byDimension(records, "disasters").filter((r) => r.category === "earthquake" && r.extra?.withinBorders === true);
  const strong = quakes.filter((r) => Number(r.extra?.magnitude) >= 5.5);
  if (strong.length) {
    add({ dimension: "disasters", kind: "finding", headline: `${strong.length} earthquake${strong.length === 1 ? "" : "s"} of M5.5+ inside the country in the last 30 days`, detail: strong.slice(0, 3).map((r) => r.summary).join("; "), evidenceIds: strong.map((r) => r.id), freshness: "NEAR_REAL_TIME" });
  } else if (quakes.length) {
    add({ dimension: "disasters", kind: "caveat", headline: `${quakes.length} M4.0+ earthquake${quakes.length === 1 ? "" : "s"} inside the country in the last 30 days (largest below M5.5)`, detail: "Listed in the Disasters tab with real epicentre coordinates.", evidenceIds: quakes.slice(0, 6).map((r) => r.id), freshness: "NEAR_REAL_TIME" });
  }

  // --- Environment (climatological, never current weather) --------------------------
  const climate = records.find((r) => r.category === "climatology");
  if (climate) {
    const hottest = climate.extra?.hottestMonth as { month: string; value: number } | null;
    const coldest = climate.extra?.coldestMonth as { month: string; value: number } | null;
    const flags = [hottest && hottest.value >= 35 ? `hot-season mean daily maximum ≥35 °C (${hottest.month}: ${hottest.value.toFixed(1)} °C)` : "", coldest && coldest.value <= 0 ? `cold-season mean daily minimum ≤0 °C (${coldest.month}: ${coldest.value.toFixed(1)} °C)` : ""].filter(Boolean);
    add({ dimension: "environment", kind: flags.length ? "finding" : "caveat", headline: flags.length ? `Climatology flags: ${flags.join("; ")}` : "No extreme-heat or extreme-cold climatology flag at the reference point", detail: "Historical/climatological values at one reference point; not current weather and not country-wide.", evidenceIds: [climate.id], freshness: "HISTORICAL_CLIMATOLOGICAL" });
  }
  const air = records.filter((r) => r.category === "air_quality_station");
  if (air.length) {
    const values = air.map((r) => Number(r.extra?.pm25)).filter(Number.isFinite).sort((a, b) => a - b);
    const median = values.length % 2 ? values[(values.length - 1) / 2] : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
    const high = air.filter((r) => Number(r.extra?.pm25) > 35.4);
    add({ dimension: "environment", kind: median > 35.4 ? "finding" : "caveat", headline: `OpenAQ: median latest PM2.5 ${median.toFixed(1)} µg/m³ across ${air.length} station${air.length === 1 ? "" : "s"}; ${high.length} above 35.4 µg/m³`, detail: "Latest single readings at individual stations (35.4 µg/m³ is only a descriptive reference, the upper bound of the EPA 24-hour 'Moderate' band). Not an AQI, not a 24-hour average, not representative of the whole country.", evidenceIds: air.map((r) => r.id).slice(0, 40), freshness: "NEAR_REAL_TIME" });
  }

  // --- Security: separate sources, no combined score ---------------------------------
  const state = records.find((r) => r.category === "travel_advisory");
  if (state) add({ dimension: "security", kind: (state.severityLevel ?? 0) >= 3 ? "finding" : "caveat", headline: `U.S. State Department: ${state.severity ?? "advisory on file"}`, detail: String(state.extra && Array.isArray(state.extra.riskFactors) ? (state.extra.riskFactors as string[]).join(", ") : "") || state.summary.slice(0, 200), evidenceIds: [state.id], freshness: "CURRENT_GUIDANCE" });
  const fcdo = records.find((r) => r.category === "travel_advice");
  if (fcdo) add({ dimension: "security", kind: /advises against/i.test(fcdo.severity || "") ? "finding" : "caveat", headline: `UK FCDO: ${fcdo.severity ?? "advice on file"}`, detail: fcdo.geographyNote || fcdo.summary.slice(0, 200), evidenceIds: [fcdo.id], freshness: "CURRENT_GUIDANCE" });

  // --- Medical access ------------------------------------------------------------------
  const medical = records.find((r) => r.dimension === "medical_access");
  if (medical) add({ dimension: "medical_access", kind: "caveat", headline: medical.title, detail: "Structural reviewer baseline, not live capacity. Evacuation considerations are in the evidence record.", evidenceIds: [medical.id], freshness: "STRUCTURAL_DATA" });

  const gho = records.filter((r) => r.category === "health_system_indicator");
  if (gho.length) {
    add({ dimension: "medical_access", kind: "caveat", headline: `WHO GHO national indicators: ${gho.map((r) => `${String(r.extra?.indicatorName).replace(/ \(per 10[\s\u00a0]?000 population\)/i, "")} ${r.extra?.value}${r.extra?.year ? ` (${r.extra.year})` : ""}`).join("; ")}`, detail: "National averages from WHO; they do not describe capacity, specialties or access in a deployment area. Facility markers on a map do not imply capability.", evidenceIds: gho.map((r) => r.id), freshness: "STRUCTURAL_DATA" });
  }

  // --- Source gaps that change how the summary should be read ---------------------------
  for (const result of results) {
    if (result.status === "source_unavailable" || result.status === "not_configured") {
      add({ dimension: result.dimension === "multi" ? "health_vaccines" : result.dimension, kind: "gap", headline: `${result.sourceName}: ${result.status === "not_configured" ? "not configured" : "source unavailable"}`, detail: `${result.note || "Request failed."} Absence of findings from this source must not be read as absence of risk.`, evidenceIds: [], freshness: null });
    } else if (result.status === "stale_cache") {
      add({ dimension: result.dimension === "multi" ? "health_vaccines" : result.dimension, kind: "caveat", headline: `${result.sourceName}: showing a stale cached copy`, detail: result.note || "Live refresh failed; cached data is served and may be out of date.", evidenceIds: result.records.slice(0, 3).map((r) => r.id), freshness: "STALE_CACHE" });
    }
  }

  return observations.sort((a, b) => DIMENSION_ORDER.indexOf(a.dimension) - DIMENSION_ORDER.indexOf(b.dimension) || kindRank(a.kind) - kindRank(b.kind));
}


// --- Vaccine rule engine records (entry / exit / transit / event-specific) -----------------------------
type AddObservation = (observation: Omit<Observation, "id">) => unknown;
const ruleOf = (record: EvidenceRecord) => record.extra?.vaccineRule as { id: string; vaccine: string; verificationStatus: string; authorityTier: string; legalForce: string; sourcePublishedAt: string | null; eventType: string | null; seasonLabel: string | null } | undefined;
const day = (value: string | null) => (value ? value.slice(0, 10) : "undated");

function addVaccineRuleObservations(vaccines: EvidenceRecord[], entryStatus: string | undefined, add: AddObservation): void {
  const engine = vaccines.filter((r) => ruleOf(r));
  const live = engine.filter((r) => r.category !== "ihr_temporary_recommendation" && r.requirementType !== "not_evaluated");
  const authoritative = live.filter((r) => r.requirementType && r.requirementType !== "not_required" && ["destination_government", "embassy"].includes(String(r.extra?.authorityTier)));
  const baseline = live.filter((r) => r.requirementType && r.requirementType !== "not_required" && !["destination_government", "embassy"].includes(String(r.extra?.authorityTier)));
  const removed = live.filter((r) => r.requirementType === "not_required");
  const unverified = engine.filter((r) => r.requirementType === "not_evaluated");
  const who = engine.filter((r) => r.category === "ihr_temporary_recommendation");
  const conflicts = vaccines.filter((r) => r.category === "entry_rule_conflict");
  const priorSeason = authoritative.filter((r) => r.extra?.priorSeason === true);

  if (authoritative.length) {
    add({ dimension: "health_vaccines", kind: "finding", headline: `Destination authority states ${authoritative.length} vaccine rule${authoritative.length === 1 ? "" : "s"} for this country`, detail: `${authoritative.slice(0, 6).map((r) => `${r.title} [${ruleOf(r)?.verificationStatus}; source dated ${day(ruleOf(r)?.sourcePublishedAt ?? null)}]`).join("; ")}${authoritative.length > 6 ? "; …" : ""}. Legal rules, kept separate from CDC recommendations; conditions (origin, transit, age, event) are in each record.`, evidenceIds: authoritative.slice(0, 12).map((r) => r.id), freshness: "STRUCTURAL_DATA" });
  }
  if (removed.length) {
    add({ dimension: "health_vaccines", kind: "finding", headline: `Destination authority withdrew ${removed.map((r) => ruleOf(r)?.vaccine).join(", ")} requirement (${removed.map((r) => day(ruleOf(r)?.sourcePublishedAt ?? null)).join(", ")})`, detail: "The authority states the certificate is no longer mandatory. Older CDC/WHO baselines that still list it are preserved as a conflict record, not shown as current.", evidenceIds: removed.map((r) => r.id), freshness: "STRUCTURAL_DATA" });
  }
  if (conflicts.length) {
    add({ dimension: "health_vaccines", kind: "finding", headline: `${conflicts.length} vaccine-rule source ${conflicts.length === 1 ? "disagreement" : "disagreements"} preserved`, detail: conflicts.slice(0, 3).map((r) => r.summary).join(" "), evidenceIds: conflicts.map((r) => r.id), freshness: "STRUCTURAL_DATA" });
  }
  if (baseline.length && !authoritative.length) {
    add({ dimension: "health_vaccines", kind: "caveat", headline: `Older global baseline lists ${baseline.length} vaccine requirement${baseline.length === 1 ? "" : "s"}; not re-verified with the destination authority`, detail: `${baseline.map((r) => r.title).join("; ")}. Compiled CDC/WHO lists date from before 2025; confirm with the destination government or embassy.`, evidenceIds: baseline.map((r) => r.id), freshness: "STRUCTURAL_DATA" });
  }
  if (unverified.some((r) => r.category !== "entry_requirement_coverage")) {
    const items = unverified.filter((r) => r.category !== "entry_requirement_coverage");
    add({ dimension: "health_vaccines", kind: "caveat", headline: "A baseline entry requirement for this country is not currently verified", detail: `${items.map((r) => r.title).join("; ")}. The source registry flags a newer destination-government notice that could not be read; do not treat the baseline as current.`, evidenceIds: items.map((r) => r.id), freshness: "STRUCTURAL_DATA" });
  }
  if (who.length) {
    const strict = who.filter((r) => String(ruleOf(r)?.id).includes("cat1"));
    add({ dimension: "health_vaccines", kind: "finding", headline: strict.length ? "WHO polio IHR temporary recommendations: residents and long-term visitors leaving this State should be vaccinated 4 weeks–12 months before international travel" : "WHO polio IHR temporary recommendations name this State (cVDPV2): IPV encouraged before international travel", detail: `${strict.length ? "The State is also asked to restrict departure of residents without documented vaccination. " : "No departure restriction is set for this category. "}This is a WHO recommendation addressed to the State (statement of ${day(ruleOf(who[0])?.sourcePublishedAt ?? null)}), not a destination-country entry rule; national implementation is a separate fact.`, evidenceIds: who.map((r) => r.id), freshness: "STRUCTURAL_DATA" });
  }
  if (priorSeason.length) {
    add({ dimension: "health_vaccines", kind: "caveat", headline: `Pilgrimage requirements on file are for a prior season (${[...new Set(priorSeason.map((r) => ruleOf(r)?.seasonLabel))].join(", ")})`, detail: "The Ministry publishes seasonal documents; the current-season text has not been verified and last season's rule is not assumed to carry over.", evidenceIds: priorSeason.slice(0, 8).map((r) => r.id), freshness: "STRUCTURAL_DATA" });
  }
  const dated = authoritative.filter((r) => r.extra?.datedSource === true);
  if (dated.length) {
    add({ dimension: "health_vaccines", kind: "caveat", headline: `${dated.length} destination-authority rule${dated.length === 1 ? " rests" : "s rest"} on a dated source`, detail: `${dated.map((r) => `${r.title} (published ${day(ruleOf(r)?.sourcePublishedAt ?? null)})`).join("; ")}. Confirm the rule is still in force.`, evidenceIds: dated.map((r) => r.id), freshness: "STRUCTURAL_DATA" });
  }
  if (!authoritative.length && !baseline.length && !removed.length && (entryStatus === "no_current_matching_finding" || entryStatus === "ok")) {
    add({ dimension: "health_vaccines", kind: "caveat", headline: "No current authoritative requirement verified from configured sources", detail: "No destination-authority, WHO or baseline vaccine rule is on file for this country. This is not confirmation that none applies: the registry sources listed in the coverage record have not been read.", evidenceIds: vaccines.filter((r) => r.category === "entry_requirement_coverage").map((r) => r.id), freshness: null });
  }
  const changed = vaccines.filter((r) => r.category === "rule_source_check" && r.subtype === "content_changed");
  if (changed.length) {
    add({ dimension: "health_vaccines", kind: "finding", headline: `${changed.length} official rule page${changed.length === 1 ? " has" : "s have"} changed since the last check`, detail: "Content differs from the previous successful fetch (may be cosmetic). Re-read the rule before relying on the stored copy.", evidenceIds: changed.map((r) => r.id), freshness: "CURRENT_NOTICE" });
  }
}

const kindRank = (kind: Observation["kind"]) => (kind === "finding" ? 0 : kind === "caveat" ? 1 : 2);

/** Concise, evidence-bound summary assembled from observation headlines. No generated facts. */
export function summarize(country: CountryRef, observations: Observation[]): string {
  const findings = observations.filter((o) => o.kind === "finding");
  const gaps = observations.filter((o) => o.kind === "gap");
  const lines: string[] = [];
  if (findings.length) lines.push(`${country.name}: ${findings.slice(0, 5).map((o) => o.headline).join("; ")}.`);
  else lines.push(`${country.name}: no source returned a current finding that meets the reporting rules. This is not proof of low risk — see source status.`);
  if (gaps.length) lines.push(`${gaps.length} source gap${gaps.length === 1 ? "" : "s"} affect this summary.`);
  return lines.join(" ");
}


// --- Combatant Command medical policy (its own rule class; never merged with host-nation law or CDC/WHO guidance) ---
type CommandRuleExtra = { domain: string; waiverAuthority: string | null; minimumStay: { days: number; inclusive: boolean } | null; sourceGaps: string[]; status: string | null; kind: string };

function addCommandPolicyObservations(records: EvidenceRecord[], country: CountryRef, add: AddObservation): void {
  const assignment = records.find((r) => r.category === "command_assignment");
  if (!assignment) {
    add({ dimension: "command_policy", kind: "caveat", headline: `No combatant command assignment is recorded for ${country.name}`, detail: "No command medical policy is shown. This is not evidence that none applies.", evidenceIds: [], freshness: "STRUCTURAL_DATA" });
    return;
  }
  const command = String(assignment.extra?.command ?? "");
  const policy = records.find((r) => r.category === "command_policy");
  const rules = records.filter((r) => r.category === "command_rule");
  const history = Array.isArray(assignment.extra?.history) ? (assignment.extra?.history as Array<{ command: string; effectiveTo: string | null }>) : [];
  const baselineNeedsVerify = /LIVE VERIFY/.test(String(assignment.extra?.verificationStatus ?? ""));

  if (policy?.subtype === "not_publicly_verified") {
    add({ dimension: "command_policy", kind: "caveat", headline: `${country.name} is in the ${command} area of responsibility; command medical policy: NOT PUBLICLY VERIFIED`, detail: "No current public command-wide medical-entry policy was located. No other command's requirements are applied.", evidenceIds: [assignment.id, policy.id], freshness: "STRUCTURAL_DATA" });
  } else if (policy) {
    const triggers = rules.map((r) => r.extra?.commandRule as CommandRuleExtra).filter((rule) => rule?.minimumStay);
    const triggerText = triggers.length ? ` Duration triggers in the extracted rules: ${[...new Set(triggers.map((rule) => `${rule.minimumStay?.inclusive ? "≥" : ">"}${rule.minimumStay?.days} days`))].join(", ")}.` : " No duration trigger was extracted.";
    add({ dimension: "command_policy", kind: "finding", headline: `${country.name} is in the ${command} area of responsibility; command medical policy: ${String(policy.title).replace(/^[A-Z]+ — /, "")}`, detail: `${policy.summary}${triggerText} This is U.S. Combatant Command deployment policy for DoD-affiliated travelers, separate from host-nation entry law and CDC/WHO guidance.`, evidenceIds: [assignment.id, policy.id], freshness: "STRUCTURAL_DATA" });
    const waivers = rules.filter((r) => (r.extra?.commandRule as CommandRuleExtra | undefined)?.waiverAuthority);
    if (waivers.length) add({ dimension: "command_policy", kind: "caveat", headline: `Command waiver routing: ${[...new Set(waivers.map((r) => String((r.extra?.commandRule as CommandRuleExtra).waiverAuthority)))].slice(0, 3).join("; ")}`, detail: "Routing depends on the supported component or JTF. The evaluating clinic or local commander is not necessarily the final waiver authority.", evidenceIds: waivers.slice(0, 6).map((r) => r.id), freshness: "STRUCTURAL_DATA" });
    const qualifiers = Array.isArray(policy.extra?.qualifiers) ? (policy.extra?.qualifiers as string[]) : [];
    if (qualifiers.length) add({ dimension: "command_policy", kind: "caveat", headline: `Command policy freshness: ${qualifiers.join("; ")}`, detail: "Confirm against the current command publication before operational use.", evidenceIds: [policy.id], freshness: "STRUCTURAL_DATA" });
    const gaps = rules.reduce((total, r) => total + ((r.extra?.commandRule as CommandRuleExtra | undefined)?.sourceGaps.length ?? 0), 0);
    if (gaps) add({ dimension: "command_policy", kind: "caveat", headline: `${gaps} rule field${gaps === 1 ? "" : "s"} in this command's policy were not extracted (SOURCE_GAP)`, detail: "Absence of a field here is not evidence that the source is silent. Open the linked command document for any field a decision depends on.", evidenceIds: rules.slice(0, 6).map((r) => r.id), freshness: "STRUCTURAL_DATA" });
  }
  if (history.length) add({ dimension: "command_policy", kind: "caveat", headline: `Assignment history preserved: ${country.name} was previously in ${history.map((h) => h.command).join(", ")}${history[0]?.effectiveTo ? ` until ${history[0].effectiveTo}` : ""}`, detail: "The earlier assignment is kept as a superseded record, not overwritten.", evidenceIds: [assignment.id], freshness: "STRUCTURAL_DATA" });
  if (baselineNeedsVerify) add({ dimension: "command_policy", kind: "caveat", headline: `${command} country list is a normalized baseline (LIVE VERIFY)`, detail: "The command publishes a country count, but no one-page enumeration was retrieved.", evidenceIds: [assignment.id], freshness: "STRUCTURAL_DATA" });
  const changed = records.filter((r) => r.category === "command_source_check" && r.subtype === "content_changed");
  if (changed.length) add({ dimension: "command_policy", kind: "finding", headline: `${changed.length} official ${command} page${changed.length === 1 ? "" : "s"} changed since the previous check`, detail: "Extracted command rules are not rewritten automatically; the changed source needs review.", evidenceIds: changed.map((r) => r.id), freshness: "CURRENT_NOTICE" });
}
