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
  const requirements = vaccines.filter((r) => r.category === "entry_requirement" && r.requirementType && r.requirementType !== "not_required");
  if (requirements.length) {
    add({ dimension: "health_vaccines", kind: "finding", headline: "Entry-requirement language appears in the CDC destination text", detail: `${requirements.map((r) => `${r.subtype}${r.requirementType === "entry_required_after_transit" ? " (tied to prior travel/transit)" : ""}`).join("; ")}. Verify against the destination government before travel.`, evidenceIds: requirements.map((r) => r.id), freshness: "CURRENT_GUIDANCE" });
  } else if (status("destination-entry-requirements") === "not_evaluated") {
    add({ dimension: "health_vaccines", kind: "gap", headline: "Entry vaccination requirements were not evaluated", detail: "No destination-government source has been connected. CDC recommendations shown above are not legal entry requirements, and requirements based on previous travel/transit are not assessed.", evidenceIds: [], freshness: null });
  }

  // --- Malaria ---------------------------------------------------------------------
  const malaria = records.find((r) => r.dimension === "malaria");
  if (malaria) {
    const model = (malaria.extra?.malaria ?? {}) as { riskScope?: string; seasonality?: string | null; altitudeNote?: string | null; preventionDrugs?: string[] };
    const scope = model.riskScope === "country_wide" ? "country-wide risk stated" : model.riskScope === "parts_of_country" ? "risk stated for parts of the country (areas not mapped)" : model.riskScope === "none_stated" ? "CDC states no malaria transmission" : "risk scope not stated in the retrieved text";
    const extras = [model.seasonality ? `seasonality: ${model.seasonality}` : "", model.altitudeNote ? `altitude: ${model.altitudeNote}` : "", model.preventionDrugs?.length ? `prevention drugs named: ${model.preventionDrugs.join(", ")}` : ""].filter(Boolean);
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

  // --- Disasters -------------------------------------------------------------------
  const gdacs = byDimension(records, "disasters").filter((r) => r.sourceName === "GDACS");
  const elevated = gdacs.filter((r) => /orange|red/i.test(r.severity || ""));
  if (elevated.length) {
    add({ dimension: "disasters", kind: "finding", headline: `${elevated.length} GDACS Orange/Red alert${elevated.length === 1 ? "" : "s"} in the last 90 days`, detail: elevated.slice(0, 4).map((r) => `${r.subtype} — ${r.severity}`).join("; "), evidenceIds: elevated.map((r) => r.id), freshness: "NEAR_REAL_TIME" });
  } else if (gdacs.length) {
    add({ dimension: "disasters", kind: "caveat", headline: `${gdacs.length} GDACS event${gdacs.length === 1 ? "" : "s"} in the last 90 days (no Orange/Red alert)`, detail: gdacs.slice(0, 3).map((r) => `${r.subtype}: ${r.title}`).join("; "), evidenceIds: gdacs.map((r) => r.id), freshness: "NEAR_REAL_TIME" });
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
    add({ dimension: "environment", kind: flags.length ? "finding" : "caveat", headline: flags.length ? `Climatology flags: ${flags.join("; ")}` : "No extreme-heat or extreme-cold climatology flag at the reference point", detail: "Historical/climatological values at one reference point; not current weather and not country-wide. Altitude and air quality were not evaluated.", evidenceIds: [climate.id], freshness: "HISTORICAL_CLIMATOLOGICAL" });
  }

  // --- Security: separate sources, no combined score ---------------------------------
  const state = records.find((r) => r.category === "travel_advisory");
  if (state) add({ dimension: "security", kind: (state.severityLevel ?? 0) >= 3 ? "finding" : "caveat", headline: `U.S. State Department: ${state.severity ?? "advisory on file"}`, detail: String(state.extra && Array.isArray(state.extra.riskFactors) ? (state.extra.riskFactors as string[]).join(", ") : "") || state.summary.slice(0, 200), evidenceIds: [state.id], freshness: "CURRENT_GUIDANCE" });
  const fcdo = records.find((r) => r.category === "travel_advice");
  if (fcdo) add({ dimension: "security", kind: /advises against/i.test(fcdo.severity || "") ? "finding" : "caveat", headline: `UK FCDO: ${fcdo.severity ?? "advice on file"}`, detail: fcdo.geographyNote || fcdo.summary.slice(0, 200), evidenceIds: [fcdo.id], freshness: "CURRENT_GUIDANCE" });

  // --- Medical access ------------------------------------------------------------------
  const medical = records.find((r) => r.dimension === "medical_access");
  if (medical) add({ dimension: "medical_access", kind: "caveat", headline: medical.title, detail: "Structural reviewer baseline, not live capacity. Evacuation considerations are in the evidence record.", evidenceIds: [medical.id], freshness: "STRUCTURAL_DATA" });

  // --- Source gaps that change how the summary should be read ---------------------------
  for (const result of results) {
    if (result.status === "source_unavailable" || result.status === "not_configured") {
      add({ dimension: result.dimension === "multi" ? "health_vaccines" : result.dimension, kind: "gap", headline: `${result.sourceName}: source unavailable`, detail: `${result.note || "Request failed."} Absence of findings from this source must not be read as absence of risk.`, evidenceIds: [], freshness: null });
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
