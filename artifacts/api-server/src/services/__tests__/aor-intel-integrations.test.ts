import assert from "node:assert/strict";
import test from "node:test";
import { parseAltitudeLimit } from "../aor-intel/adapters";
import { buildCountryIntel, type IntelDeps } from "../aor-intel/aggregate";
import { createMemoryStore } from "../aor-intel/cache";
import { synthesizeCountry, validateStatements } from "../aor-intel/synthesis";
import type { CountryIntelResponse, EvidenceRecord } from "../aor-intel/types";

const NOW = new Date("2026-10-07T12:00:00Z");
type Fixture = Record<string, unknown | Error>;

function harness(internal: Fixture, external: Fixture = {}, env: Record<string, string> = {}): IntelDeps {
  const pick = (table: Fixture, key: string) => {
    const match = Object.keys(table).sort((a, b) => b.length - a.length).find((prefix) => key.startsWith(prefix));
    if (!match) throw new Error(`Source returned HTTP 404 (no fixture for ${key})`);
    const value = table[match];
    if (value instanceof Error) throw value;
    return value;
  };
  return { store: createMemoryStore(), now: () => NOW, env: (key) => env[key], internalJson: async (path) => pick(internal, path), externalJson: async (url) => pick(external, url) };
}

const yellowBook = {
  ok: true,
  profiles: [
    { title: "Yellow Fever", aliases: ["yellow fever"], pages: [8, 31], sourceDate: "Apr. 23, 2025", endemicity: "Tropical South America and sub-Saharan Africa", atRisk: "Unvaccinated travelers", prevention: "Vaccination and mosquito-bite avoidance", transmission: "Aedes and Haemagogus mosquitoes", keyNotes: ["Entry requirements are legally distinct from CDC recommendations."], flags: {}, operationalRules: ["ICVP valid 10 days after primary vaccination."], sourceAssets: [{ type: "table", id: "4.21.4", page: 22, title: "Table 4.21.4", excerpt: "Countries requiring proof" }] },
    { title: "Zika", aliases: ["zika"], pages: [1, 7], sourceDate: "Apr. 23, 2025", endemicity: "Worldwide", atRisk: "Pregnant travelers", prevention: "Avoid mosquito bites", transmission: "Aedes", keyNotes: [], flags: {}, operationalRules: [], sourceAssets: [] },
    { title: "Malaria", aliases: ["malaria"], pages: [100, 120], sourceDate: "Apr. 23, 2025", endemicity: "Tropics", atRisk: "Travelers", prevention: "Chemoprophylaxis and bite avoidance", transmission: "Anopheles", keyNotes: [], flags: {}, operationalRules: [], sourceAssets: [] },
  ],
};

const cdc = (name: string, yellowFever: unknown, malaria: unknown) => ({
  ok: true, available: true, source: "CDC Travelers' Health", sourceUrl: "https://wwwnc.cdc.gov/travel/destinations/traveler/none/x", retrievedAt: NOW.toISOString(), sourceUpdated: "September 3, 2026",
  vaccines: [{ name: "Hepatitis A", recommendation: "Recommended for unvaccinated travelers one year old or older." }], yellowFever, malaria, diseases: [],
});

const base: Fixture = {
  "/api/aor/travel-notices": { ok: true, notices: [] },
  "/api/aor/health-outbreaks": { ok: true, available: true, outbreaks: [] },
  "/api/aor/disaster-alerts": { ok: true, available: true, events: [] },
  "/api/aor/seismic-activity": { ok: true, earthquakes: [] },
  "/api/public-data/aor-risk": { ok: true, found: false },
  "/api/aor/yellow-book": yellowBook,
};

const immunization = (item: string, value: number) => ({ ok: true, rows: [{ iso2: "UG", code: "UGA", country: "Uganda", year: 2024, item, value, previousRevision: value + 1, gradeOfConfidence: "3", gradeOfConfidenceLabel: "Strong empirical support (3)", comment: "" }] });

async function run(iso2: string, internal: Fixture, external: Fixture = {}, env: Record<string, string> = {}): Promise<CountryIntelResponse> {
  const payload = await buildCountryIntel(iso2, harness({ ...base, ...internal }, external, env));
  assert.ok(payload);
  return payload;
}

const flunetRows = [
  { COUNTRY_CODE: "UGA", ISO_YEAR: 2026, ISO_WEEK: 38, ISO_WEEKSTARTDATE: "2026-09-14T00:00:00Z", SPEC_PROCESSED_NB: 120, INF_A: 20, INF_B: 5, ALL_INF: 25 },
  { COUNTRY_CODE: "UGA", ISO_YEAR: 2026, ISO_WEEK: 37, ISO_WEEKSTARTDATE: "2026-09-07T00:00:00Z", SPEC_PROCESSED_NB: 100, INF_A: 14, INF_B: 4, ALL_INF: 18 },
  { COUNTRY_CODE: "UGA", ISO_YEAR: 2026, ISO_WEEK: 36, ISO_WEEKSTARTDATE: "2026-08-31T00:00:00Z", SPEC_PROCESSED_NB: 80, INF_A: 6, INF_B: 2, ALL_INF: 8 },
];

test("Yellow Book chapters attach only through country evidence, and entry requirements stay separate from recommendations", async () => {
  const internal: Fixture = {
    "/api/aor/travel-health": cdc("Uganda", { name: "Yellow Fever", recommendation: "Recommended for travelers ≥9 months of age." }, { name: "Malaria", recommendation: "Risk throughout the country, year-round." }),
    "/api/aor/immunization": immunization("MCV1", 85),
  };
  const payload = await run("UG", internal, { "https://xmart-api-public.who.int": { value: flunetRows } });

  const book = payload.evidence.filter((r) => r.category === "yellow_book_reference");
  assert.deepEqual(book.map((r) => r.subtype).sort(), ["Malaria", "Yellow Fever"], "Zika has no CDC/WHO item for Uganda, so it must not attach");
  assert.equal(book.find((r) => r.subtype === "Malaria")?.dimension, "malaria");
  assert.ok((book.find((r) => r.subtype === "Yellow Fever")?.extra?.operationalRules as string[]).length > 0);
  const linked = (book.find((r) => r.subtype === "Yellow Fever")?.extra?.linkedEvidence as Array<{ evidenceId: string }>).map((l) => l.evidenceId);
  const ids = new Set(payload.evidence.map((r) => r.id));
  assert.ok(linked.length > 0 && linked.every((id) => ids.has(id)));

  // Uganda: the CDC/WHO baseline lists all-arrivals YF, but Uganda's own immigration notice (2 Oct 2026) withdrew it.
  const rule = payload.evidence.find((r) => r.category === "entry_requirement" && r.extra?.vaccine === "Yellow Fever");
  assert.ok(rule, "Uganda has a destination-authority Yellow Fever record");
  assert.equal(rule.requirementType, "not_required", "the newer destination-government statement controls");
  assert.equal(rule.recommendationType, null);
  assert.equal(rule.extra?.verificationStatus, "DESTINATION-GOVERNMENT VERIFIED");
  assert.ok(String(rule.sourceUrl).includes("immigration.go.ug"));
  assert.equal(payload.evidence.some((r) => r.category === "entry_requirement" && r.requirementType === "entry_required"), false, "the superseded baseline must not be shown as a current requirement");
  const conflict = payload.evidence.find((r) => r.category === "entry_rule_conflict");
  assert.ok(conflict, "the disagreement is preserved, not merged");
  assert.equal((conflict.extra?.conflict as { kind: string }).kind, "rule_withdrawn");
  assert.ok(payload.whatMattersNow.observations.some((o) => /withdrew Yellow Fever requirement/.test(o.headline)));
  const recommendation = payload.evidence.find((r) => r.category === "travel_vaccine" && r.subtype === "Yellow Fever");
  assert.equal(recommendation?.requirementType, null);
  assert.equal(payload.sources.find((s) => s.sourceId === "destination-entry-requirements")?.status, "ok");
});

test("countries with no rule on file get 'No current authoritative requirement verified', never a 'not required' claim", async () => {
  const payload = await run("KE", { "/api/aor/travel-health": cdc("Kenya", null, null), "/api/aor/immunization": immunization("DTP3", 90) });
  assert.equal(payload.evidence.some((r) => r.category === "entry_requirement"), false);
  const coverage = payload.evidence.find((r) => r.category === "entry_requirement_coverage");
  assert.equal(coverage?.title, "No current authoritative requirement verified from configured sources");
  assert.equal(coverage?.requirementType, "not_evaluated");
  const toCheck = (coverage?.extra?.sourcesToCheck as Array<{ url: string }>) ?? [];
  assert.ok(toCheck.some((s) => s.url === "https://www.health.go.ke/index.php/incoming-travellers"), "registry destination-authority links are surfaced");
  assert.ok(((coverage?.extra?.unreadVolatileSources as unknown[]) ?? []).length > 0, "pages that could not be read are listed, not ignored");
  assert.ok(payload.whatMattersNow.observations.some((o) => /No current authoritative requirement verified from configured sources/.test(o.headline)));
  assert.equal(payload.evidence.some((r) => r.requirementType === "not_required"), false);
});

test("Saudi Arabia: Hajj/Umrah rules come from the Ministry, are event-specific, and carry the prior-season caveat", async () => {
  const payload = await run("SA", { "/api/aor/travel-health": cdc("Saudi Arabia", null, null) });
  const meningococcal = payload.evidence.filter((r) => r.category === "entry_requirement" && r.extra?.vaccine === "Meningococcal (ACWY)");
  assert.ok(meningococcal.length >= 3, "Umrah and Hajj pilgrims plus Hajj seasonal workers");
  for (const rule of meningococcal) {
    assert.equal(rule.requirementType, "entry_required_conditional");
    assert.equal(rule.extra?.verificationStatus, "DESTINATION-GOVERNMENT VERIFIED");
    assert.match(String(rule.extra?.appliesTo), /(?:Umrah|Hajj)[^.]* only\. Not a general entry requirement/);
    assert.equal(rule.extra?.priorSeason, true, "the 1447H documents are not the current (1448H) season");
  }
  assert.ok(payload.evidence.some((r) => r.category === "entry_rule_conflict" && r.subtype === "field_unstated_by_authority"), "CDC's age floor vs the Ministry's silence is preserved");
  assert.ok(payload.whatMattersNow.observations.some((o) => /prior season \(1447H/.test(o.headline)));
});

test("WHO FluNet is weekly surveillance with a stated reporting age, and WUENIC coverage flags below 90%", async () => {
  const internal: Fixture = {
    "/api/aor/travel-health": cdc("Uganda", null, null),
    "/api/aor/immunization?dataset=wuenic&country=UG&item=MCV1": immunization("MCV1", 85),
    "/api/aor/immunization?dataset=wuenic&country=UG&item=DTP3": immunization("DTP3", 93),
    "/api/aor/immunization?dataset=wuenic&country=UG&item=MCV2": { ok: true, rows: [] },
    "/api/aor/immunization?dataset=wuenic&country=UG&item=POL3": immunization("POL3", 91),
  };
  const payload = await run("UG", internal, { "https://xmart-api-public.who.int": { value: flunetRows } });
  const flu = payload.evidence.find((r) => r.category === "respiratory_surveillance");
  assert.equal(flu?.freshness, "WEEKLY_SURVEILLANCE");
  assert.equal(flu?.extra?.processed4Week, 300);
  assert.equal(flu?.extra?.positive4Week, 51);
  assert.equal(Number(flu?.extra?.reportingAgeDays), 23);
  const fluObs = payload.whatMattersNow.observations.find((o) => /FluNet/.test(o.headline));
  assert.equal(fluObs?.kind, "finding", "17% positivity over ≥50 specimens within 28 days is flagged descriptively");

  const coverage = payload.evidence.filter((r) => r.category === "immunization_coverage");
  assert.deepEqual(coverage.map((r) => r.extra?.antigen).sort(), ["DTP3", "MCV1", "POL3"]);
  assert.match(payload.sources.find((s) => s.sourceId === "who-immunization")?.note ?? "", /MCV2 \(no WUENIC estimate\)/);
  const low = payload.whatMattersNow.observations.find((o) => /below 90%/.test(o.headline));
  assert.ok(low && low.evidenceIds.length === 1 && /MCV1/.test(low.headline));
});

test("FluNet with no rows reports 'source returned no data', not absence of influenza", async () => {
  const payload = await run("UG", { "/api/aor/travel-health": cdc("Uganda", null, null) }, { "https://xmart-api-public.who.int": { value: [] } });
  const source = payload.sources.find((s) => s.sourceId === "who-flunet");
  assert.equal(source?.status, "source_returned_no_data");
  assert.match(source?.note ?? "", /not evidence of no circulation/);
});

test("WHO GHO indicators are resolved by exact catalogue name and kept as structural data", async () => {
  const ghoBase = "https://ghoapi.azureedge.net/api";
  const external: Fixture = {
    [`${ghoBase}/Indicator?$filter=${encodeURIComponent("contains(IndicatorName,'Hospital beds')")}`]: { value: [{ IndicatorCode: "WRONG_1", IndicatorName: "Hospital beds (per 10 000 population) by sector" }, { IndicatorCode: "BEDS_X", IndicatorName: "Hospital beds (per 10 000 population)" }] },
    [`${ghoBase}/Indicator?$filter=${encodeURIComponent("contains(IndicatorName,'Medical doctors')")}`]: { value: [{ IndicatorCode: "DOC_X", IndicatorName: "Medical doctors (per 10 000 population)" }] },
    [`${ghoBase}/Indicator?$filter=${encodeURIComponent("contains(IndicatorName,'Nursing and midwifery')")}`]: { value: [] },
    [`${ghoBase}/Indicator?$filter=${encodeURIComponent("contains(IndicatorName,'UHC service coverage index')")}`]: { value: [{ IndicatorCode: "UHC_X", IndicatorName: "UHC service coverage index" }] },
    [`${ghoBase}/BEDS_X`]: { value: [{ TimeDim: 2019, NumericValue: 5.0 }, { TimeDim: 2012, NumericValue: 4.1 }] },
    [`${ghoBase}/DOC_X`]: { value: [{ TimeDim: 2021, NumericValue: 1.7 }] },
    [`${ghoBase}/UHC_X`]: { value: [{ TimeDim: 2021, NumericValue: null }] },
  };
  const payload = await run("UG", { "/api/aor/travel-health": cdc("Uganda", null, null) }, external);
  const gho = payload.evidence.filter((r) => r.category === "health_system_indicator");
  assert.deepEqual(gho.map((r) => r.subtype), ["hospital_beds", "medical_doctors"]);
  assert.equal(gho[0].extra?.indicatorCode, "BEDS_X", "the 'by sector' lookalike must not be picked");
  assert.ok(gho.every((r) => r.freshness === "STRUCTURAL_DATA"));
  assert.match(payload.sources.find((s) => s.sourceId === "who-gho")?.note ?? "", /Nursing and midwifery: indicator not found/);
});

test("OpenAQ: no key is 'not configured'; with a key only fresh station readings become point evidence", async () => {
  const none = await run("UG", { "/api/aor/travel-health": cdc("Uganda", null, null) });
  assert.equal(none.sources.find((s) => s.sourceId === "openaq")?.status, "not_configured");
  assert.match(none.sources.find((s) => s.sourceId === "openaq")?.note ?? "", /OPENAQ_API_KEY/);

  const external: Fixture = {
    "https://api.openaq.org/v3/locations?iso=UG": { results: [
      { id: 11, name: "Kampala US Embassy", coordinates: { latitude: 0.3, longitude: 32.58 }, provider: { name: "AirNow" }, isMonitor: true, datetimeLast: { utc: "2026-10-07T10:00:00Z" } },
      { id: 12, name: "Old station", coordinates: { latitude: 1.0, longitude: 32.0 }, provider: { name: "X" }, isMonitor: false, datetimeLast: { utc: "2026-08-01T10:00:00Z" } },
    ] },
    "https://api.openaq.org/v3/parameters/2/latest": { results: [{ locationsId: 11, value: 48.5, datetime: { utc: "2026-10-07T10:00:00Z" } }] },
  };
  const live = await run("UG", { "/api/aor/travel-health": cdc("Uganda", null, null) }, external, { OPENAQ_API_KEY: "test-key" });
  const stations = live.evidence.filter((r) => r.category === "air_quality_station");
  assert.equal(stations.length, 1);
  assert.deepEqual(stations[0].geometry, { type: "Point", coordinates: [32.58, 0.3] });
  assert.equal(stations[0].freshness, "NEAR_REAL_TIME");
  assert.match(stations[0].geographyNote ?? "", /not an air-quality index/);
  assert.ok(live.whatMattersNow.observations.some((o) => /OpenAQ: median latest PM2.5 48.5/.test(o.headline) && o.kind === "finding"));
});

test("ReliefWeb: needs a pre-approved appname; with one, disasters are country-tagged text records, never drawn", async () => {
  const none = await run("UG", { "/api/aor/travel-health": cdc("Uganda", null, null) });
  const status = none.sources.find((s) => s.sourceId === "reliefweb-ocha");
  assert.equal(status?.status, "not_configured");
  assert.match(status?.note ?? "", /RELIEFWEB_APPNAME.*pre-approved/);

  const external: Fixture = {
    "https://api.reliefweb.int/v2/disasters?appname=occu-med": { data: [{ fields: { name: "Uganda: Floods - Sep 2026", status: "ongoing", glide: "FL-2026-000123-UGA", date: { event: "2026-09-10T00:00:00+00:00", changed: "2026-10-01T00:00:00+00:00" }, type: [{ name: "Flood" }], country: [{ name: "Uganda" }], url: "https://reliefweb.int/disaster/fl-2026-000123-uga", profile: { overview: "Heavy rains displaced thousands." } } }] },
    "https://api.reliefweb.int/v2/reports?appname=occu-med": { data: [{ fields: { title: "Uganda Humanitarian Update", url: "https://reliefweb.int/report/uganda/x", date: { original: "2026-10-02T00:00:00+00:00" } } }] },
  };
  const live = await run("UG", { "/api/aor/travel-health": cdc("Uganda", null, null) }, external, { RELIEFWEB_APPNAME: "occu-med" });
  const rw = live.evidence.filter((r) => r.sourceName.startsWith("ReliefWeb"));
  assert.deepEqual(rw.map((r) => r.category).sort(), ["humanitarian_disaster", "ocha_situation_report"]);
  assert.ok(rw.every((r) => r.geometry.type === "None" && r.geographyLevel === "text_only"));
  assert.ok(live.whatMattersNow.observations.some((o) => /ReliefWeb disaster/.test(o.headline)));
});

test("altitude limit is extracted only when the text states one", () => {
  assert.equal(parseAltitudeLimit("Malaria transmission does not occur at altitudes above 2,000 m.")?.meters, 2000);
  assert.equal(parseAltitudeLimit("No transmission above 6,500 feet.")?.meters, 1981);
  assert.equal(parseAltitudeLimit("Risk is limited to areas below 1,500 meters.")?.meters, 1500);
  assert.equal(parseAltitudeLimit("Risk throughout the country below 2,500 meters altitude, year-round."), null, "a bare 'below' is not an explicit limit");
  assert.equal(parseAltitudeLimit("Risk exists in areas above 1,000 m during the rainy season."), null, "a positive statement is not a limit");
});

const evidence = (over: Partial<EvidenceRecord>): EvidenceRecord => ({
  id: "e1", dimension: "health_vaccines", category: "travel_vaccine", subtype: "Hepatitis A", title: "Hepatitis A", summary: "Recommended for unvaccinated travelers.", evidence: "", severity: null, severityLevel: null,
  recommendationType: "recommended", requirementType: null, sourceName: "CDC", sourceUrl: "", publishedAt: null, updatedAt: null, retrievedAt: NOW.toISOString(), country: "Uganda", iso2: "UG", iso3: "UGA", region: null,
  geometry: { type: "None" }, geographyLevel: "country", geographyNote: null, freshness: "CURRENT_GUIDANCE", ...over,
});

test("synthesis validator keeps only statements grounded in the evidence they cite", () => {
  const records = [evidence({}), evidence({ id: "e2", category: "entry_requirement", title: "Yellow Fever — entry requirement", summary: "Proof of YF vaccination required from all arriving travelers.", recommendationType: null, requirementType: "entry_required" }), evidence({ id: "e3", category: "immunization_coverage", title: "MCV1 coverage", summary: "MCV1 coverage 85% (WUENIC 2024).", extra: { coveragePercent: 85, year: 2024 } })];
  const { statements, discarded } = validateStatements({ statements: [
    { text: "CDC recommends hepatitis A vaccination for unvaccinated travelers.", evidenceIds: ["e1"] },
    { text: "Proof of yellow fever vaccination is listed as an entry requirement.", evidenceIds: ["e2"] },
    { text: "MCV1 coverage was 85% in 2024 (annual estimate).", evidenceIds: ["e3"] },
    { text: "MCV1 coverage was 72% in 2024.", evidenceIds: ["e3"] },
    { text: "Hepatitis A vaccination is an entry requirement.", evidenceIds: ["e1"] },
    { text: "Yellow fever vaccination is recommended.", evidenceIds: ["e2"] },
    { text: "Travel here is low risk.", evidenceIds: ["e1"] },
    { text: "Uncited claim.", evidenceIds: [] },
    { text: "Cites a record that does not exist.", evidenceIds: ["nope"] },
  ] }, records);
  assert.equal(statements.length, 3);
  assert.equal(discarded, 6);
  assert.deepEqual(statements.map((s) => s.evidenceIds), [["e1"], ["e2"], ["e3"]]);
});

test("synthesis: not configured without a key; with a key the model output is validated before use", async () => {
  const country = { iso2: "UG", iso3: "UGA", name: "Uganda", center: null, capital: null, aorRegion: null, bboxes: [] };
  const records = [evidence({})];
  const store = createMemoryStore();
  const off = await synthesizeCountry(country, records, [], { externalJson: async () => { throw new Error("must not be called"); }, env: () => undefined, store, now: () => NOW });
  assert.equal(off.status, "not_configured");

  const reply = (statements: unknown) => async () => ({ choices: [{ message: { content: JSON.stringify({ statements }) } }] });
  const env = (key: string) => (key === "CEREBRAS_API_KEY" ? "k" : undefined);
  const good = await synthesizeCountry(country, records, [], { externalJson: reply([{ text: "CDC recommends hepatitis A vaccination.", evidenceIds: ["e1"] }, { text: "Unsupported 99% claim.", evidenceIds: ["e1"] }]), env, store, now: () => NOW });
  assert.equal(good.status, "applied");
  assert.equal(good.statements.length, 1);
  assert.equal(good.discarded, 1);

  const bad = await synthesizeCountry(country, records, [], { externalJson: reply([{ text: "Totally safe.", evidenceIds: ["e1"] }]), env: (k) => (k === "CEREBRAS_API_KEY" ? "k2" : undefined), store: createMemoryStore(), now: () => NOW });
  assert.equal(bad.status, "rejected");
  assert.equal(bad.statements.length, 0);

  const failed = await synthesizeCountry(country, records, [], { externalJson: async () => { throw new Error("Source returned HTTP 429"); }, env, store: createMemoryStore(), now: () => NOW });
  assert.equal(failed.status, "failed");
});
