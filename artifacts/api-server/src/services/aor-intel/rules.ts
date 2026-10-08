import type { AdapterResult, CountryRef, Dimension, EvidenceRecord, Freshness, Observation } from "./types";

// Deterministic rules turn normalized evidence into "What Matters Now" observations.
// Rules never rank across dimensions and never produce a numeric score; each
// observation lists the evidence ids it rests on. Thresholds below are descriptive
// cut-offs stated in the observation text, not risk scores.

const DIMENSION_ORDER: Dimension[] = ["health_vaccines", "malaria", "outbreaks", "disasters", "environment", "security", "medical_access"];
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
  const listed = vaccines.filter((r) => r.category === "entry_requirement" && !r.sourceName.startsWith("CDC Travelers") && r.requirementType && r.requirementType !== "not_required");
  if (listed.length) {
    add({ dimension: "health_vaccines", kind: "finding", headline: `Compiled entry-requirement list names ${listed.length} requirement${listed.length === 1 ? "" : "s"} for this destination`, detail: `${listed.map((r) => `${r.title}${r.requirementType === "entry_required_conditional" ? " (conditional: " + String(r.extra?.appliesTo ?? "see record") + ")" : ""}`).join("; ")}. Legal rules from a secondary compilation; confirm with the destination authority. Separate from the CDC recommendations above.`, evidenceIds: listed.map((r) => r.id), freshness: "STRUCTURAL_DATA" });
  } else if (status("destination-entry-requirements") === "no_current_matching_finding" && !cdcText.length) {
    add({ dimension: "health_vaccines", kind: "caveat", headline: "No entry requirement found on the compiled lists", detail: "The destination is not on the yellow fever (all arrivals) or Saudi Hajj/Umrah lists. This is not proof that none applies: transit-based and other-vaccine rules are not evaluated.", evidenceIds: [], freshness: null });
  }
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
    const model = (malaria.extra?.malaria ?? {}) as { riskScope?: string; seasonality?: string | null; altitudeNote?: string | null; altitudeLimitMeters?: number | null; preventionDrugs?: string[] };
    const scope = model.riskScope === "country_wide" ? "country-wide risk stated" : model.riskScope === "parts_of_country" ? "risk stated for parts of the country (areas not mapped)" : model.riskScope === "none_stated" ? "CDC states no malaria transmission" : "risk scope not stated in the retrieved text";
    const extras = [model.seasonality ? `seasonality: ${model.seasonality}` : "", model.altitudeNote ? `altitude: ${model.altitudeNote}${model.altitudeLimitMeters ? ` (limit ${model.altitudeLimitMeters} m is drawn on the terrain)` : ""}` : "", model.preventionDrugs?.length ? `prevention drugs named: ${model.preventionDrugs.join(", ")}` : ""].filter(Boolean);
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
