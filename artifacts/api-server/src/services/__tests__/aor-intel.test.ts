import assert from "node:assert/strict";
import test from "node:test";
import { classifyRecommendation, classifyRequirement, fcdoSlugs, parseMalariaText } from "../aor-intel/adapters";
import { buildCountryIntel, type IntelDeps } from "../aor-intel/aggregate";
import { createMemoryStore } from "../aor-intel/cache";
import { countryBboxes, hasCountryPolygon, pointInCountry, resolveCountry } from "../aor-intel/geo";
import type { CountryIntelResponse } from "../aor-intel/types";

const NOW = new Date("2026-10-07T12:00:00Z");

type Fixture = Record<string, unknown | Error>;
function deps(internal: Fixture, external: Fixture = {}, store = createMemoryStore(), clock = NOW): IntelDeps {
  const pick = (table: Fixture, key: string) => {
    const match = Object.keys(table).find((prefix) => key.startsWith(prefix));
    if (!match) throw new Error(`Source returned HTTP 404 (no fixture for ${key})`);
    const value = table[match];
    if (value instanceof Error) throw value;
    return value;
  };
  return {
    store,
    now: () => clock,
    env: () => undefined,
    internalJson: async (path) => pick(internal, path),
    externalJson: async (url) => pick(external, url),
  };
}

const cdcKenya = {
  ok: true, available: true, source: "CDC Travelers' Health", sourceUrl: "https://wwwnc.cdc.gov/travel/destinations/traveler/none/kenya", retrievedAt: NOW.toISOString(), sourceUpdated: "September 3, 2026",
  vaccines: [
    { name: "Routine vaccines", recommendation: "Make sure you are up-to-date on all routine vaccines before every trip." },
    { name: "Hepatitis A", recommendation: "Recommended for unvaccinated travelers one year old or older going to Kenya." },
    { name: "Rabies", recommendation: "Recommended for some travelers, including those who will be outdoors or around animals." },
  ],
  yellowFever: { name: "Yellow Fever", recommendation: "Recommended for travelers ≥9 months of age. Proof of vaccination is required for entry for travelers arriving from countries with risk of yellow fever transmission." },
  malaria: { name: "Malaria", recommendation: "Risk throughout the country below 2,500 meters altitude, year-round. Take prophylaxis such as atovaquone-proguanil or doxycycline." },
  diseases: [{ name: "Dengue", transmission: "Mosquito bites", advice: "Prevent bug bites", category: "Vector-borne" }],
};

const kenyaFixture: Fixture = {
  "/api/aor/travel-health": cdcKenya,
  "/api/aor/travel-notices": { ok: true, notices: [{ level: 2, levelLabel: "Practice Enhanced Precautions", action: "Practice enhanced precautions.", title: "Chikungunya in Indian Ocean region", date: "August 1, 2026", summary: "Cases reported.", url: "https://wwwnc.cdc.gov/travel/notices/level2/chik", countries: ["Mauritius"], status: "active" }] },
  "/api/aor/health-outbreaks": { ok: true, available: true, outbreaks: [{ id: "1", title: "Rift Valley fever – Kenya", publicationDate: "2026-08-20T00:00:00Z", summary: "Cases in Kenya.", assessment: "Moderate", advice: "Avoid contact with livestock.", sourceUrl: "https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON999" }] },
  "/api/aor/disaster-alerts": { ok: true, available: true, events: [{ eventType: "FL", eventId: "123", name: "Floods in Kenya", alertLevel: "Orange", fromDate: "2026-09-20T00:00:00Z", latitude: -1.2, longitude: 36.8, sourceUrl: "https://www.gdacs.org/report.aspx?eventid=123&eventtype=FL" }] },
  "/api/aor/seismic-activity": { ok: true, earthquakes: [{ id: "us1", title: "M 5.8 - Lake Turkana", place: "Lake Turkana", magnitude: 5.8, occurredAt: "2026-09-30T00:00:00Z", url: "https://earthquake.usgs.gov/earthquakes/eventpage/us1", latitude: 3.5, longitude: 36.1, depthKm: 10 }] },
  "/api/public-data/aor-risk": { ok: true, found: true, advisory: { title: "Kenya Travel Advisory", level: 3, levelLabel: "Reconsider Travel", updatedAt: "2026-07-01T00:00:00Z", riskFactors: ["crime", "terrorism"], summary: "Reconsider travel to Kenya due to crime and terrorism.", sourceUrl: "https://travel.state.gov/kenya" } },
};
const kenyaExternal: Fixture = {
  "https://www.gov.uk/api/content/foreign-travel-advice/kenya": { title: "Kenya travel advice", public_updated_at: "2026-09-01T00:00:00Z", details: { alert_status: ["avoid_all_but_essential_travel_to_parts"], change_description: "Updated." } },
  "https://power.larc.nasa.gov/api/temporal/climatology/point": { properties: { parameter: {
    T2M_MAX: { JAN: 27, FEB: 28, MAR: 28, APR: 26, MAY: 24, JUN: 23, JUL: 22, AUG: 23, SEP: 25, OCT: 26, NOV: 25, DEC: 26 },
    T2M_MIN: { JAN: 13, FEB: 13, MAR: 14, APR: 15, MAY: 14, JUN: 12, JUL: 11, AUG: 11, SEP: 12, OCT: 14, NOV: 14, DEC: 13 },
    RH2M: { JAN: 60, FEB: 58, MAR: 62, APR: 75, MAY: 78, JUN: 70, JUL: 68, AUG: 66, SEP: 62, OCT: 64, NOV: 72, DEC: 66 } } } },
};

async function intel(iso2: string, internal: Fixture, external: Fixture = {}): Promise<CountryIntelResponse> {
  const payload = await buildCountryIntel(iso2, deps(internal, external));
  assert.ok(payload, `expected a payload for ${iso2}`);
  return payload;
}

test("recommendations and entry requirements are classified separately", () => {
  assert.equal(classifyRecommendation("Recommended for unvaccinated travelers one year old or older."), "recommended");
  assert.equal(classifyRecommendation("Make sure you are up-to-date on all routine vaccines", "Routine vaccines"), "routine");
  assert.equal(classifyRecommendation("Recommended for some travelers"), "selected_travelers");
  assert.equal(classifyRecommendation("Not recommended"), "not_routinely_recommended");
  assert.equal(classifyRequirement("Recommended for travelers ≥9 months."), null);
  assert.equal(classifyRequirement("Proof of vaccination is required for entry."), "entry_required");
  assert.equal(classifyRequirement("Proof of vaccination is required for entry for travelers arriving from countries with risk of yellow fever."), "entry_required_after_transit");
  assert.equal(classifyRequirement("Yellow fever vaccine is not required for entry."), "not_required");
});

test("malaria model keeps only what the source text states", () => {
  const countryWide = parseMalariaText("Risk throughout the country below 2,500 meters altitude, year-round. Take prophylaxis such as atovaquone-proguanil or doxycycline.");
  assert.equal(countryWide.riskScope, "country_wide");
  assert.match(countryWide.altitudeNote || "", /2,500/);
  assert.match(countryWide.seasonality || "", /year-round/i);
  assert.deepEqual(countryWide.preventionDrugs.sort(), ["atovaquone-proguanil", "doxycycline"]);

  const parts = parseMalariaText("Malaria risk exists in parts of the country, mainly in the north. Discuss prophylaxis with your clinician.");
  assert.equal(parts.riskScope, "parts_of_country");
  assert.equal(parts.altitudeNote, null);
  assert.equal(parts.seasonality, null);
  assert.deepEqual(parts.preventionDrugs, []);

  assert.equal(parseMalariaText("No malaria transmission in this country.").riskScope, "none_stated");
  assert.equal(parseMalariaText("Ask your clinician.").riskScope, "unspecified");
});

test("boundaries: antimeridian countries are split and points resolve to the right country", () => {
  assert.ok(countryBboxes("RU").length === 2, "Russia must be queried as two boxes");
  for (const box of [...countryBboxes("RU"), ...countryBboxes("US"), ...countryBboxes("FJ")]) {
    assert.ok(box[0] < box[2] && box[2] - box[0] <= 180, `box ${box.join(",")} must be valid and under 180° wide`);
  }
  assert.equal(pointInCountry("KE", 36.82, -1.29), true);
  assert.equal(pointInCountry("TZ", 36.82, -1.29), false);
  assert.equal(hasCountryPolygon("TV"), false, "Tuvalu has no 50m polygon and must be reported honestly");
  assert.equal(resolveCountry("TV")?.bboxes.length, 0);
  assert.equal(resolveCountry("ZZ"), null);
});

test("Kenya: vaccine recommendation, requirement, malaria and every source are evidence-linked", async () => {
  const payload = await intel("KE", kenyaFixture, kenyaExternal);
  const ids = new Set(payload.evidence.map((record) => record.id));
  for (const observation of payload.whatMattersNow.observations) for (const id of observation.evidenceIds) assert.ok(ids.has(id), `observation ${observation.id} cites unknown evidence ${id}`);

  const yf = payload.evidence.filter((record) => record.subtype.startsWith("Yellow Fever"));
  assert.ok(yf.some((record) => record.category === "travel_vaccine" && record.recommendationType === "recommended" && record.requirementType === null));
  assert.ok(yf.some((record) => record.category === "entry_requirement" && record.requirementType === "entry_required_after_transit" && record.recommendationType === null), "requirement must be a separate record from the recommendation");

  const malaria = payload.evidence.find((record) => record.dimension === "malaria");
  assert.ok(malaria);
  assert.equal(malaria.geographyLevel, "country");
  assert.equal((malaria.extra?.malaria as { riskScope: string }).riskScope, "country_wide");

  assert.equal(payload.evidence.some((record) => record.category === "travel_health_notice"), false, "a notice naming only Mauritius must not attach to Kenya");
  assert.ok(payload.evidence.some((record) => record.sourceName === "WHO Disease Outbreak News" && record.geographyLevel === "text_only"));

  const quake = payload.evidence.find((record) => record.category === "earthquake");
  assert.ok(quake && quake.geometry.type === "Point");
  assert.equal(quake.extra?.withinBorders, true);

  const state = payload.evidence.find((record) => record.category === "travel_advisory");
  const fcdo = payload.evidence.find((record) => record.category === "travel_advice");
  assert.ok(state && fcdo && state.sourceName !== fcdo.sourceName, "State and FCDO stay separate records");
  assert.equal(fcdo.geographyLevel, "text_only", "FCDO parts-of-country advice must not be shaded as a whole country");
  assert.equal(fcdo.geometry.type, "None");

  const climate = payload.evidence.find((record) => record.category === "climatology");
  assert.equal(climate?.freshness, "HISTORICAL_CLIMATOLOGICAL");

  const requirementGap = payload.whatMattersNow.observations.find((o) => o.kind === "gap" && /entry vaccination requirements were not evaluated/i.test(o.headline));
  assert.equal(requirementGap, undefined, "requirement language was found, so the not-evaluated gap must not be raised");
  const text = JSON.stringify(payload);
  assert.doesNotMatch(text, /risk score|"score"/i, "no composite risk score may appear");
  assert.equal(payload.whatMattersNow.llmSynthesis, "not_configured");
});

test("Japan: no malaria row, offshore quakes are labelled, nothing is invented", async () => {
  const internal: Fixture = {
    ...kenyaFixture,
    "/api/aor/travel-health": { ...cdcKenya, malaria: null, yellowFever: null, vaccines: [{ name: "Japanese encephalitis", recommendation: "Recommended for some travelers" }] },
    "/api/aor/health-outbreaks": { ok: true, available: true, outbreaks: [] },
    "/api/aor/disaster-alerts": { ok: true, available: true, events: [] },
    "/api/aor/seismic-activity": { ok: true, earthquakes: [
      { id: "jp-land", title: "M 4.6 inland", place: "Nagano", magnitude: 4.6, occurredAt: "2026-10-01T00:00:00Z", latitude: 36.2, longitude: 138.2, url: "https://example.test/1" },
      { id: "jp-sea", title: "M 6.1 offshore", place: "Pacific", magnitude: 6.1, occurredAt: "2026-10-02T00:00:00Z", latitude: 35.0, longitude: 147.0, url: "https://example.test/2" },
    ] },
    "/api/public-data/aor-risk": { ok: true, found: true, advisory: { title: "Japan Travel Advisory", level: 1, levelLabel: "Exercise Normal Precautions", riskFactors: [], summary: "Exercise normal precautions.", sourceUrl: "https://travel.state.gov/japan" } },
  };
  const payload = await intel("JP", internal, { "https://www.gov.uk/api/content/foreign-travel-advice/japan": { title: "Japan travel advice", details: { alert_status: [] } }, ...kenyaExternal });
  assert.equal(payload.evidence.some((record) => record.dimension === "malaria"), false);
  const offshore = payload.evidence.find((record) => record.id.endsWith("jp-sea"));
  assert.equal(offshore?.extra?.withinBorders, false);
  const quakeObs = payload.whatMattersNow.observations.filter((o) => o.headline.includes("earthquake"));
  assert.ok(quakeObs.every((o) => !/M5\.5\+/.test(o.headline)), "an offshore M6.1 must not be reported as inside the country");
  const outbreakSource = payload.sources.find((source) => source.sourceId === "who-don");
  assert.equal(outbreakSource?.status, "no_current_matching_finding");
  const fcdo = payload.evidence.find((record) => record.category === "travel_advice");
  assert.equal(fcdo?.severity, "No FCDO advice-against-travel flag");
});

test("Russia: antimeridian country issues two bounded earthquake queries", async () => {
  const queries: string[] = [];
  const base = deps({ "/api/aor/seismic-activity": { ok: true, earthquakes: [] } });
  const payload = await buildCountryIntel("RU", { ...base, internalJson: async (path) => { if (path.startsWith("/api/aor/seismic-activity")) queries.push(path); return base.internalJson(path); } });
  assert.ok(payload);
  assert.equal(queries.length, 2);
  assert.equal(payload.sources.find((s) => s.sourceId === "usgs")?.status, "no_current_matching_finding");
});

test("source failures are explicit: unavailable is never reported as no risk", async () => {
  const down = new Error("Internal route returned HTTP 502");
  const internal: Fixture = { "/api/aor/travel-health": down, "/api/aor/travel-notices": down, "/api/aor/health-outbreaks": down, "/api/aor/disaster-alerts": down, "/api/aor/seismic-activity": down, "/api/public-data/aor-risk": down };
  const payload = await intel("AF", internal, { "https://www.gov.uk/api/content/foreign-travel-advice/afghanistan": new Error("Source returned HTTP 503"), "https://power.larc.nasa.gov": new Error("Source returned HTTP 503") });
  const statuses = Object.fromEntries(payload.sources.map((s) => [s.sourceId, s.status]));
  for (const id of ["cdc-travelers-health", "cdc-travel-notices", "who-don", "gdacs", "usgs", "state-travel-advisory", "fcdo-travel-advice", "nasa-power"]) assert.equal(statuses[id], "source_unavailable", id);
  for (const id of ["who-rsv-sars2", "malaria-admin-geometry", "entry-requirements-transit"]) assert.equal(statuses[id], "not_evaluated", id);
  assert.equal(statuses.openaq, "not_configured");
  assert.equal(statuses["reliefweb-ocha"], "not_configured");
  const gaps = payload.whatMattersNow.observations.filter((o) => o.kind === "gap");
  assert.ok(gaps.length >= 8);
  assert.match(payload.whatMattersNow.summary, /not proof of low risk|source gap/i);
  assert.equal(payload.evidence.filter((r) => r.dimension !== "medical_access").length, 0);
});

test("a failed live refresh serves a labelled stale copy instead of pretending it is current", async () => {
  const store = createMemoryStore();
  const first = await buildCountryIntel("KE", deps(kenyaFixture, kenyaExternal, store, NOW));
  assert.equal(first?.sources.find((s) => s.sourceId === "gdacs")?.status, "ok");

  const later = new Date(NOW.getTime() + 3 * 60 * 60_000); // past GDACS (15 min) and USGS TTLs
  const down = new Error("Internal route returned HTTP 502");
  const second = await buildCountryIntel("KE", deps({ ...kenyaFixture, "/api/aor/disaster-alerts": down }, kenyaExternal, store, later));
  const gdacs = second?.sources.find((s) => s.sourceId === "gdacs");
  assert.equal(gdacs?.status, "stale_cache");
  assert.equal(gdacs?.freshness, "STALE_CACHE");
  const staleRecords = second?.evidence.filter((r) => r.sourceName === "GDACS") ?? [];
  assert.ok(staleRecords.length > 0 && staleRecords.every((r) => r.freshness === "STALE_CACHE" && r.extra?.originalFreshness === "NEAR_REAL_TIME"));
});

test("FCDO slug candidates cover known irregular names", () => {
  assert.ok(fcdoSlugs("United States", "US").includes("usa"));
  assert.ok(fcdoSlugs("Kenya", "KE").includes("kenya"));
  assert.ok(fcdoSlugs("Myanmar", "MM").includes("myanmar-burma"));
});
