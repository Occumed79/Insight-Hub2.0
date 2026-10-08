import assert from "node:assert/strict";
import test from "node:test";
import { buildCountryIntel } from "../aor-intel/aggregate";
import { createMemoryStore } from "../aor-intel/cache";
import { validateStatements } from "../aor-intel/synthesis";
import type { EvidenceRecord, UrlProbe } from "../aor-intel/types";
import { createRuleSourceMonitor, entryRequirementsAdapter, monitoredUrls } from "../aor-intel/vaccine-rules/adapter";
import {
  currentHijriYear, describeCountry, evaluateTraveler, freshnessQualifiers, isPriorSeason, resolveRules, rulesDueForRevalidation,
} from "../aor-intel/vaccine-rules/engine";
import { contentFingerprint } from "../aor-intel/vaccine-rules/probe";
import { UNREAD_VOLATILE_SOURCES, VACCINE_RULES } from "../aor-intel/vaccine-rules/rules-data";
import { registryGlobalSources, registryStats, registrySourcesForCountry } from "../aor-intel/vaccine-rules/source-registry";
import { REGISTRY_ROWS } from "../aor-intel/vaccine-rules/source-registry-data";
import type { VaccineRule } from "../aor-intel/vaccine-rules/types";
import { resolveCountry } from "../aor-intel/geo";

const NOW = new Date("2026-10-08T12:00:00Z");
const rule = (id: string) => {
  const found = VACCINE_RULES.find((r) => r.id === id);
  assert.ok(found, `rule ${id} exists`);
  return found;
};
const applicability = (query: Parameters<typeof evaluateTraveler>[0], ruleId: string) => evaluateTraveler(query).evaluations.find((e) => e.rule.id === ruleId);

/* ---------------------------- registry & data integrity ---------------------------- */

test("source registry carries all 390 official links, destination authorities before WHO profiles", () => {
  assert.equal(REGISTRY_ROWS.length, 390);
  assert.equal(registryStats().totalLinks, 390);
  assert.equal(registryGlobalSources().length, 31);
  assert.ok(REGISTRY_ROWS.every((row) => /^https?:\/\//.test(row[4])));
  const uganda = registrySourcesForCountry("UGA");
  assert.ok(uganda.length >= 2);
  assert.equal(uganda[0].section === "B" || uganda[0].section === "C", true, "destination authority first");
  assert.equal(uganda[uganda.length - 1].section, "D", "WHO profile last");
  assert.ok(registrySourcesForCountry("SGP").some((s) => s.url.includes("ica.gov.sg")));
});

test("rule data is internally consistent and never invents fields", () => {
  const ids = new Set<string>();
  for (const r of VACCINE_RULES) {
    assert.ok(!ids.has(r.id), `duplicate id ${r.id}`);
    ids.add(r.id);
    assert.ok(r.sourceAuthority && /^https:\/\//.test(r.sourceUrl) && r.normalizedRule.length > 20, r.id);
    for (const code of [...r.originCountries, ...r.destinationCountries, r.destinationCountry, r.issuingCountry].filter(Boolean) as string[]) assert.match(code, /^[A-Z]{2}$/, `${r.id}: ${code}`);
    // A destination-authority rule must say when it was read; a baseline copy must not claim verification.
    if (r.authorityTier === "global_compilation" || r.verificationStatus === "CDC CORROBORATED") assert.equal(r.lastVerifiedAt, null, r.id);
    else assert.ok(r.lastVerifiedAt, r.id);
    if (r.originScope === "listed_countries") assert.ok(r.originCountries.length > 0, r.id);
    if (r.transitThresholdHours !== null) assert.equal(r.transitApplies, true, `${r.id}: a threshold implies transit counts`);
  }
  const lens = (id: string) => rule(id).originCountries.length;
  assert.equal(lens("yellow-fever-entry-SG-ica"), 42);
  assert.equal(lens("yellow-fever-entry-ZA-doh"), 45);
  assert.equal(lens("yellow-fever-entry-LK-immigration"), 46);
  assert.equal(lens("yellow-fever-event-SA-umrah"), 41);
  assert.equal(VACCINE_RULES.filter((r) => r.id.startsWith("polio-exit-who-cat1-")).length, 11);
  assert.equal(VACCINE_RULES.filter((r) => r.id.startsWith("polio-exit-who-cat2-")).length, 24);
  for (const source of UNREAD_VOLATILE_SOURCES) assert.ok(resolveCountry(source.iso2), source.iso2);
});

/* ---------------------------- precedence and conflicts ---------------------------- */

test("a newer destination-government rule overrides an older CDC/WHO baseline and the conflict is preserved", () => {
  const resolved = resolveRules(VACCINE_RULES.filter((r) => r.destinationCountry === "UG"));
  assert.equal(resolved.effective.length, 1);
  assert.equal(resolved.effective[0].legalForce, "removed");
  assert.equal(resolved.superseded[0].verificationStatus, "OLDER GLOBAL BASELINE");
  const [conflict] = resolved.conflicts;
  assert.equal(conflict.kind, "rule_withdrawn");
  assert.equal(conflict.severity, "conflict");
  assert.match(conflict.superseded.statement, /all arriving travelers/);
  assert.match(conflict.effective.statement, /no longer a mandatory/);
});

test("an old baseline never overrides a destination rule, and a country absent from a table is never 'not required'", () => {
  const baseline = { ...rule("yellow-fever-entry-GH-baseline"), id: "x-newer-cdc", sourcePublishedAt: "2026-09-30" };
  const government: VaccineRule = { ...rule("yellow-fever-entry-GH-baseline"), id: "x-old-gov", authorityTier: "destination_government", sourcePublishedAt: "2019-01-01", verificationStatus: "DESTINATION-GOVERNMENT VERIFIED", lastVerifiedAt: "2026-10-01" };
  assert.equal(resolveRules([baseline, government]).effective[0].id, "x-old-gov", "tier outranks recency across tiers");
  const sameTierNewer: VaccineRule = { ...government, id: "x-new-gov", sourcePublishedAt: "2026-02-01" };
  assert.equal(resolveRules([government, sameTierNewer]).effective[0].id, "x-new-gov", "recency decides within a tier");

  const kenya = describeCountry("KE", NOW);
  assert.equal(kenya.anyVerifiedRequirement, "not_verified");
  assert.equal(kenya.yellowFever.status, "not_verified");
  assert.equal(kenya.yellowFever.universal, null);
});

test("Saudi: CDC's age floor vs the Ministry's silence is a labelled difference, not a silent merge", () => {
  const resolved = resolveRules(VACCINE_RULES.filter((r) => r.destinationCountry === "SA" && r.vaccine === "Meningococcal (ACWY)"));
  const hajjPilgrim = resolved.conflicts.filter((c) => c.effectiveRuleId === "meningococcal-event-SA-hajj-pilgrims");
  assert.equal(hajjPilgrim.length, 1);
  assert.equal(hajjPilgrim[0].kind, "field_unstated_by_authority");
  assert.equal(hajjPilgrim[0].severity, "difference");
  assert.equal(rule("meningococcal-event-SA-hajj-pilgrims").minimumAge, null, "the age floor is not carried over from CDC");
});

/* ---------------------------- the questions the engine must answer ---------------------------- */

test("Q: does airport transit trigger it, and is there a duration threshold? (Singapore 12 h)", () => {
  const sg = (transit: Array<{ country: string; hours: number }>, arrivingFrom: string | null = "US") => applicability({ destination: "SG", arrivingFrom, transit }, "yellow-fever-entry-SG-ica");
  assert.equal(sg([{ country: "KE", hours: 14 }])?.applicability, "applies");
  assert.match(sg([{ country: "KE", hours: 14 }])?.reasons.join(" ") ?? "", /exceeds the 12-hour threshold/);
  assert.equal(sg([{ country: "KE", hours: 11 }])?.applicability, "does_not_apply");
  assert.equal(sg([{ country: "AE", hours: 20 }])?.applicability, "does_not_apply", "transit in an unlisted country does not trigger it");
  assert.equal(sg([], "KE")?.applicability, "applies", "arriving from a listed country applies regardless of transit");
  assert.equal(sg([], null)?.applicability, "unknown", "no itinerary → unknown, never 'not required'");
  assert.deepEqual(sg([], null)?.missingInputs, ["arrivingFrom"]);
});

test("Q: universal or origin-based? Transit without a stated threshold? (South Africa, Botswana, India)", () => {
  assert.equal(applicability({ destination: "ZA", arrivingFrom: "US", transit: [{ country: "NG", hours: 1 }] }, "yellow-fever-entry-ZA-doh")?.applicability, "applies", "transit counts; the document states no hour threshold");
  assert.equal(applicability({ destination: "ZA", arrivingFrom: "US" }, "yellow-fever-entry-ZA-doh")?.applicability, "does_not_apply");
  assert.equal(applicability({ destination: "BW", arrivingFrom: "US" }, "yellow-fever-entry-BW-moh")?.applicability, "unknown", "Botswana does not enumerate its risk countries");
  const za = describeCountry("ZA", NOW).yellowFever;
  assert.deepEqual([za.status, za.universal, za.originBased, za.transitTriggers, za.transitThresholdHours], ["origin_based", false, true, true, null]);
  const sg = describeCountry("SG", NOW).yellowFever;
  assert.deepEqual([sg.transitTriggers, sg.transitThresholdHours, sg.ageThreshold], [true, 12, null], "Singapore states no age exemption, so none is invented");
  assert.equal(describeCountry("GH", NOW).yellowFever.status, "universal");
});

test("Q: is proof via the ICVP required, and are exemptions captured without generalizing? (South Africa)", () => {
  const za = describeCountry("ZA", NOW).yellowFever;
  assert.equal(za.proofViaICVP, true);
  assert.equal(za.exemptions.length, 1);
  assert.match(za.exemptions[0], /travel physician/);
  assert.equal(rule("yellow-fever-entry-ZA-doh").minimumAge, null, "the document states no age exemption as such");
});

test("Q: does it apply only above a certain age? (Saudi YF: older than 9 months)", () => {
  const q = (ageYears: number) => applicability({ destination: "SA", arrivingFrom: "NG", event: "Umrah", ageYears }, "yellow-fever-event-SA-umrah")?.applicability;
  assert.equal(q(0.5), "does_not_apply");
  assert.equal(q(0.75), "does_not_apply", "'older than' 9 months is exclusive");
  assert.equal(q(1), "applies");
  assert.equal(applicability({ destination: "SA", arrivingFrom: "NG", event: "Umrah" }, "yellow-fever-event-SA-umrah")?.applicability, "unknown");
});

test("Q: event-specific rules apply only to that event; Hajj workers differ from pilgrims", () => {
  const umrah = applicability({ destination: "SA", arrivingFrom: "US", event: "Umrah" }, "meningococcal-event-SA-umrah-pilgrims");
  assert.equal(umrah?.applicability, "applies");
  assert.equal(applicability({ destination: "SA", arrivingFrom: "US", event: "business" }, "meningococcal-event-SA-umrah-pilgrims")?.applicability, "does_not_apply");
  assert.equal(applicability({ destination: "SA", arrivingFrom: "US" }, "meningococcal-event-SA-umrah-pilgrims")?.applicability, "unknown");
  assert.equal(applicability({ destination: "SA", arrivingFrom: "US", event: "Hajj", seasonalWorker: true }, "meningococcal-event-SA-hajj-seasonal_workers")?.applicability, "applies");
  assert.equal(applicability({ destination: "SA", arrivingFrom: "US", event: "Hajj", seasonalWorker: true }, "meningococcal-event-SA-hajj-pilgrims")?.applicability, "does_not_apply");
  const timing = rule("meningococcal-event-SA-hajj-pilgrims");
  assert.deepEqual([timing.vaccineTimingMinimum?.value, timing.vaccineTimingMinimum?.unit, timing.vaccineTimingMaximum?.value, timing.vaccineTimingMaximum?.unit], [10, "days", 5, "years"]);
  assert.match(timing.vaccineDetail ?? "", /3 years/, "polysaccharide limit is kept in the detail");
  assert.equal(timing.certificateRequired, true);
  const polio = applicability({ destination: "SA", arrivingFrom: "PK", event: "Hajj" }, "polio-event-SA-hajj-bopv-or-ipv");
  assert.equal(polio?.applicability, "applies");
  assert.equal(applicability({ destination: "SA", arrivingFrom: "US", event: "Hajj" }, "polio-event-SA-hajj-bopv-or-ipv")?.applicability, "does_not_apply");
  const answers = describeCountry("SA", NOW);
  assert.ok(answers.eventSpecific.some((e) => e.eventType === "Hajj" && e.vaccine === "Meningococcal (ACWY)"));
  assert.ok(answers.eventSpecific.every((e) => e.seasonStale), "the 1447H documents are prior-season in Oct 2026 (Hijri 1448)");
});

test("Q: polio — entry vs exit, residents vs long-term visitors, timing window, ICVP", () => {
  const exitRule = rule("polio-exit-who-cat1-PK");
  assert.equal(exitRule.ruleType, "exit");
  assert.equal(exitRule.legalForce, "who_temporary_recommendation");
  assert.deepEqual([exitRule.residencyApplies, exitRule.longTermVisitorApplies, exitRule.stayDurationThresholdDays], [true, true, 28]);
  assert.deepEqual([exitRule.vaccineTimingMinimum?.value, exitRule.vaccineTimingMinimum?.unit, exitRule.vaccineTimingMaximum?.value, exitRule.vaccineTimingMaximum?.unit], [4, "weeks", 12, "months"]);
  assert.match(exitRule.certificateType ?? "", /ICVP/);
  assert.equal(exitRule.verificationStatus, "WHO VERIFIED");

  const resident = applicability({ destination: "US", residentOf: "PK", departingFrom: "PK" }, "polio-exit-who-cat1-PK");
  assert.equal(resident?.applicability, "applies");
  const visitorShort = applicability({ destination: "US", residentOf: "US", departingFrom: "PK", stayDays: 10 }, "polio-exit-who-cat1-PK");
  assert.equal(visitorShort?.applicability, "does_not_apply");
  const visitorLong = applicability({ destination: "US", residentOf: "US", departingFrom: "PK", stayDays: 40 }, "polio-exit-who-cat1-PK");
  assert.equal(visitorLong?.applicability, "applies");
  assert.equal(applicability({ destination: "US", residentOf: "US", departingFrom: "PK" }, "polio-exit-who-cat1-PK")?.applicability, "unknown");
  assert.equal(applicability({ destination: "US", residentOf: "US", departingFrom: "FR" }, "polio-exit-who-cat1-PK"), undefined);

  const pk = describeCountry("PK", NOW);
  assert.equal(pk.polio.whoTemporaryRecommendations, 1);
  assert.equal(pk.polio.exitRules, 0, "no national Pakistani departure rule is verified, only the WHO recommendation");
  assert.match(pk.polio.summary, /recommendation to the State, not national law/);
  // States in both WHO categories keep both statements; cVDPV2-only States get the weaker one.
  assert.equal(describeCountry("NG", NOW).polio.whoTemporaryRecommendations, 2);
  assert.equal(rule("polio-exit-who-cat2-ZM").vaccineTimingMinimum?.value, 4);
  assert.match(rule("polio-exit-who-cat2-ZM").normalizedRule, /encouraged/);
});

test("Q: national rules on residents leaving (Costa Rica) and declaration regimes (Australia)", () => {
  const cr = applicability({ destination: "CO", residentOf: "CR" }, "yellow-fever-exit-CR-minsa-2026-10");
  assert.equal(cr?.applicability, "applies");
  assert.equal(applicability({ destination: "CO", residentOf: "US" }, "yellow-fever-exit-CR-minsa-2026-10"), undefined, "a non-resident is out of scope");
  assert.equal(applicability({ destination: "ZA", residentOf: "CR" }, "yellow-fever-exit-CR-minsa-2026-10")?.applicability, "unknown", "the notice also covers African destinations it does not name");
  assert.equal(applicability({ destination: "FR", residentOf: "CR" }, "yellow-fever-exit-CR-minsa-2026-10")?.applicability, "unknown");
  assert.equal(rule("yellow-fever-exit-CR-minsa-2026-10").validFrom, "2026-10-01");

  const au = rule("yellow-fever-entry-AU-health");
  assert.deepEqual([au.legalForce, au.certificateRequired, au.exposureLookbackDays], ["declaration", false, 6]);
});

test("Q: authority, publication date and last verification are always available", () => {
  const sg = describeCountry("SG", NOW);
  assert.equal(sg.authorities[0].authority, "Singapore Immigration & Checkpoints Authority");
  assert.equal(sg.authorities[0].publishedAt, "2025-05-07");
  assert.equal(sg.lastVerifiedAt, "2026-10-08");
  assert.equal(sg.anyVerifiedRequirement, "yes");
  assert.equal(describeCountry("UG", NOW).anyVerifiedRequirement, "removed");
  assert.equal(describeCountry("BJ", NOW).yellowFever.status, "not_verified", "Benin's baseline is flagged as superseded by an unread 2026 notice");
});

/* ---------------------------- freshness and revalidation ---------------------------- */

test("seasonal documents are flagged prior-season by the Hijri year, dated sources and overdue checks are labelled", () => {
  assert.equal(currentHijriYear(NOW), 1448);
  const hajj = rule("meningococcal-event-SA-hajj-pilgrims");
  assert.equal(isPriorSeason(hajj, NOW), true);
  assert.equal(isPriorSeason(hajj, new Date("2026-03-01T00:00:00Z")), false, "still the 1447H season in March 2026");
  assert.match(freshnessQualifiers(hajj, NOW).join(" "), /Prior-season document \(1447H \(2026\)\)/);
  assert.match(freshnessQualifiers(rule("yellow-fever-entry-ZA-doh"), NOW).join(" "), /Dated source \(published 2010\)/);
  assert.match(freshnessQualifiers(rule("yellow-fever-entry-GY-dpi"), NOW).join(" "), /Dated source \(published 2016\)/);
  assert.match(freshnessQualifiers(rule("yellow-fever-entry-GH-baseline"), NOW).join(" "), /Never re-verified/);

  const dueNow = rulesDueForRevalidation(NOW).map((r) => r.id);
  assert.ok(dueNow.includes("yellow-fever-entry-BJ-baseline"), "a superseded-by-unread-notice baseline is always due");
  assert.ok(!dueNow.includes("yellow-fever-entry-UG-ncic-2026-10-02"));
  const later = new Date(NOW.getTime() + 10 * 86_400_000);
  const dueLater = rulesDueForRevalidation(later).map((r) => r.id);
  assert.ok(dueLater.includes("yellow-fever-entry-UG-ncic-2026-10-02"), "volatile 2026 rules recheck after 7 days");
  assert.ok(!dueLater.includes("yellow-fever-entry-SG-ica"), "30-day rules are not yet due");
});

/* ---------------------------- adapter output (legal vs recommendation stay separate) ---------------------------- */

const harness = (probe?: (url: string) => Promise<UrlProbe>) => ({
  country: resolveCountry("SG")!,
  now: () => NOW,
  internalJson: async () => ({}),
  externalJson: async () => ({}),
  env: () => undefined,
  probeUrl: probe,
});

test("adapter emits legal rules, WHO recommendations and conflicts as distinct categories with the right requirementType", async () => {
  const ctx = (iso2: string) => ({ ...harness(), country: resolveCountry(iso2)! });
  const sg = await entryRequirementsAdapter(ctx("SG"));
  const sgRule = sg.records.find((r) => r.category === "entry_requirement");
  assert.equal(sgRule?.requirementType, "entry_required_conditional");
  assert.equal(sgRule?.recommendationType, null);
  assert.ok((sgRule?.extra?.conditions as Array<{ label: string; value: string }>).some((c) => c.label === "Transit" && /longer than 12 hours/.test(c.value)));
  assert.ok((sgRule?.extra?.conditions as Array<{ label: string; value: string }>).some((c) => c.label === "Age" && /No age threshold stated/.test(c.value)));

  const pk = await entryRequirementsAdapter(ctx("PK"));
  const who = pk.records.find((r) => r.category === "ihr_temporary_recommendation");
  assert.equal(who?.requirementType, null, "a WHO recommendation to a State is not a requirement");
  assert.equal(who?.recommendationType, "recommended");
  assert.equal(pk.records.some((r) => r.category === "entry_requirement"), false);
  assert.equal(pk.records.find((r) => r.category === "entry_requirement_coverage")?.title, "No current authoritative requirement verified from configured sources");

  const bj = await entryRequirementsAdapter(ctx("BJ"));
  assert.equal(bj.records.find((r) => r.category === "entry_requirement")?.requirementType, "not_evaluated");

  const au = await entryRequirementsAdapter(ctx("AU"));
  assert.equal(au.records.find((r) => r.category === "entry_requirement")?.requirementType, "declaration_only");

  const cr = await entryRequirementsAdapter(ctx("CR"));
  assert.equal(cr.records.find((r) => r.category === "exit_requirement")?.requirementType, "exit_required");
});

/* ---------------------------- source monitor ---------------------------- */

test("source monitor keeps fetch state, flags content changes, and labels failures as last-known", async () => {
  const store = createMemoryStore();
  const monitor = createRuleSourceMonitor();
  const probe = (hash: string): UrlProbe => ({ httpStatus: 200, finalUrl: "https://x", lastModified: "Thu, 02 Oct 2026 08:00:00 GMT", etag: null, contentType: "text/html", contentHash: hash });
  const ctxAt = (at: Date, p?: (url: string) => Promise<UrlProbe>) => ({ ...harness(p), country: resolveCountry("UG")!, now: () => at });

  assert.deepEqual(monitoredUrls("UG").map((u) => u.url), ["https://www.immigration.go.ug/index.php/node/254"]);
  assert.equal((await monitor(ctxAt(NOW), store)).status, "not_configured", "no probe wired → not configured, not 'unchanged'");

  const first = await monitor(ctxAt(NOW, async () => probe("aaa")), store);
  assert.equal(first.status, "ok");
  assert.equal(first.records[0].extra && (first.records[0].extra.sourceCheck as { changedSincePrevious: boolean | null }).changedSincePrevious, null);
  assert.equal(first.records[0].updatedAt, "2026-10-02T08:00:00.000Z");

  const t2 = new Date(NOW.getTime() + 86_400_000);
  const same = await monitor(ctxAt(t2, async () => probe("aaa")), store);
  assert.equal((same.records[0].extra?.sourceCheck as { changedSincePrevious: boolean }).changedSincePrevious, false);

  const t3 = new Date(NOW.getTime() + 2 * 86_400_000);
  const changed = await monitor(ctxAt(t3, async () => probe("bbb")), store);
  assert.equal(changed.records[0].subtype, "content_changed");

  const t4 = new Date(NOW.getTime() + 3 * 86_400_000);
  const down = await monitor(ctxAt(t4, async () => { throw new Error("fetch failed: certificate mismatch"); }), store);
  assert.equal(down.status, "source_unavailable");
  const check = down.records[0].extra?.sourceCheck as { lastAttemptedFetch: string; lastSuccessfulFetch: string; sourceStatus: string; sourceError: string; contentHash: string };
  assert.equal(check.lastAttemptedFetch, t4.toISOString());
  assert.equal(check.lastSuccessfulFetch, t3.toISOString(), "the last good fetch is retained");
  assert.equal(check.sourceStatus, "source_unavailable");
  assert.match(check.sourceError, /certificate mismatch/);
  assert.equal(check.contentHash, "bbb");
  assert.equal(down.records[0].freshness, "STALE_CACHE");
  assert.match(down.records[0].summary, /last-known data, not a current check/);

  const never = await monitor({ ...ctxAt(t4, async () => { throw new Error("TLS"); }), country: resolveCountry("BJ")! }, createMemoryStore());
  assert.match(never.records[0].summary, /not re-verified/, "Benin's unread notice stays flagged");
});

test("content fingerprints ignore scripts, styles and whitespace but catch real text changes", () => {
  const html = (body: string, script = "var a=1;") => Buffer.from(`<html><head><style>p{}</style><script>${script}</script></head><body>${body}</body></html>`);
  const a = contentFingerprint(html("<p>Yellow  fever certificate</p>"), "text/html");
  assert.equal(a, contentFingerprint(html("<p>Yellow fever   certificate</p>", "var a=2;"), "text/html"));
  assert.notEqual(a, contentFingerprint(html("<p>Yellow fever certificate is no longer required</p>"), "text/html"));
});

/* ---------------------------- full pipeline: legal vs recommended, AI validator ---------------------------- */

const record = (over: Partial<EvidenceRecord>): EvidenceRecord => ({
  id: "r", dimension: "health_vaccines", category: "entry_requirement", subtype: "s", title: "t", summary: "", evidence: "", severity: null, severityLevel: null,
  recommendationType: null, requirementType: null, sourceName: "src", sourceUrl: "", publishedAt: null, updatedAt: null, retrievedAt: NOW.toISOString(), country: "X", iso2: "XX", iso3: "XXX",
  region: null, geometry: { type: "None" }, geographyLevel: "country", geographyNote: null, freshness: "STRUCTURAL_DATA", ...over,
});

test("AI validator: recommendation never becomes requirement, silence never becomes 'not required', WHO recommendations stay recommendations", () => {
  const cdc = record({ id: "cdc", category: "travel_vaccine", recommendationType: "recommended", summary: "Yellow fever vaccine recommended" });
  const required = record({ id: "req", requirementType: "entry_required_conditional", extra: { verificationStatus: "DESTINATION-GOVERNMENT VERIFIED" } });
  const removed = record({ id: "gone", requirementType: "not_required" });
  const coverage = record({ id: "cov", category: "entry_requirement_coverage", requirementType: "not_evaluated" });
  const polio = record({ id: "polio", category: "ihr_temporary_recommendation", recommendationType: "recommended", requirementType: null });
  const baseline = record({ id: "base", requirementType: "entry_required", extra: { verificationStatus: "OLDER GLOBAL BASELINE" } });
  const all = [cdc, required, removed, coverage, polio, baseline];
  const check = (text: string, ...ids: string[]) => validateStatements({ statements: [{ text, evidenceIds: ids }] }, all).statements.length === 1;

  assert.equal(check("CDC recommends yellow fever vaccination for this destination.", "cdc"), true);
  assert.equal(check("Yellow fever vaccination is required for entry.", "cdc"), false, "recommended → required");
  assert.equal(check("Proof of yellow fever vaccination is required for travelers from listed countries.", "req"), true);
  assert.equal(check("CDC recommends the vaccine.", "req"), false, "required → recommended");
  assert.equal(check("The yellow fever certificate is no longer required.", "gone"), true, "explicit authority statement");
  assert.equal(check("No vaccination requirement applies to this destination.", "cov"), false, "absence from sources is not absence of a rule");
  assert.equal(check("The yellow fever certificate is not required.", "cov"), false);
  assert.equal(check("Residents must be vaccinated against polio before leaving.", "polio"), false, "WHO recommendation to a State restated as a requirement");
  assert.equal(check("WHO recommends polio vaccination for residents leaving this State.", "polio"), true);
  assert.equal(check("The entry requirement is confirmed and verified.", "base"), false, "baseline cannot be called verified");
});

test("pipeline: vaccine rules appear as distinct evidence, with fetch state on every source and an official-page monitor", async () => {
  const store = createMemoryStore();
  const external = async () => { throw new Error("Source returned HTTP 503"); };
  const internal = async (path: string) => { throw new Error(`Internal route returned HTTP 502 (${path})`); };
  const intel = await buildCountryIntel("SG", { store, now: () => NOW, env: () => undefined, internalJson: internal, externalJson: external, probeUrl: async () => ({ httpStatus: 200, finalUrl: "https://ica", lastModified: null, etag: null, contentType: "text/html", contentHash: "h1" }) });
  assert.ok(intel);
  const entry = intel.sources.find((s) => s.sourceId === "destination-entry-requirements");
  assert.equal(entry?.status, "ok");
  assert.equal(entry?.sourceStatus, "ok");
  assert.equal(entry?.lastAttemptedFetch, NOW.toISOString());
  assert.equal(entry?.lastSuccessfulFetch, NOW.toISOString());
  const monitor = intel.sources.find((s) => s.sourceId === "vaccine-rule-source-monitor");
  assert.equal(monitor?.status, "ok");
  const down = intel.sources.find((s) => s.sourceId === "gdacs");
  assert.equal(down?.status, "source_unavailable");
  assert.equal(down?.lastSuccessfulFetch, null, "never fetched successfully");
  assert.match(String(down?.sourceError), /502/);
  assert.ok(intel.whatMattersNow.observations.some((o) => /Destination authority states 1 vaccine rule/.test(o.headline)));
  assert.ok(intel.evidence.filter((r) => r.requirementType === "entry_required_conditional").every((r) => r.recommendationType === null));
});
