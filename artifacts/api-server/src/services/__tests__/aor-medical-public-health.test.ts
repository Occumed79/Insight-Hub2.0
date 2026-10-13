import test from "node:test";
import assert from "node:assert/strict";
import { buildCountryIntel, type IntelDeps } from "../aor-intel/aggregate";
import { createMemoryStore } from "../aor-intel/cache";
import { VACCINE_RULES } from "../aor-intel/vaccine-rules/rules-data";
import type { VaccineRule } from "../aor-intel/vaccine-rules/types";
import {
  isUnconfirmedHistoricalRule, resolveMedicalApplicability, type MedicalApplicabilityQuery, type MedicalApplicabilityResult, type RequirementItem,
} from "../aor-intel/command-policy/medical-applicability";
import { publicHealthFromAdapterResults, resolveMedicalApplicabilityWithPublicHealth } from "../aor-intel/medical-public-health";
import { cdcGuidanceAdapter } from "../aor-intel/adapters";
import { resolveCountry } from "../aor-intel/geo";
import type { AdapterContext } from "../aor-intel/types";
import { parseTravelHealth } from "../../routes/aor-travel-health";

const NOW = new Date("2026-10-12T12:00:00Z");

test("CDC section extraction ignores navigation labels and retains recommendation evidence", async () => {
  const html = `<html><nav><a href="#vaccines">Vaccines and Medicines</a><a href="#diseases">Non-Vaccine-Preventable Diseases</a><a href="#safe">Stay Healthy and Safe</a></nav>
    <h3>Travel Health Notices</h3><h4>Example destination notice</h4>
    <h3>Vaccines and Medicines</h3><table>
      <tr><th>Vaccines for disease</th><th>Recommendations</th></tr>
      <tr><td>Hepatitis A</td><td>Recommended for unvaccinated travelers.</td></tr>
      <tr><td>Malaria</td><td>CDC recommends prescription medicine in the risk areas listed here.</td></tr>
    </table><h3>Non-Vaccine-Preventable Diseases</h3><table>
      <tr><td>Leptospirosis</td><td>Freshwater contact</td><td>Avoid contaminated water.</td></tr>
    </table><h3>Stay Healthy and Safe</h3><table><tr><td>Page furniture</td><td>Excluded</td></tr></table></html>`;
  const payload = parseTravelHealth("Kenya", html, "https://wwwnc.cdc.gov/travel/destinations/traveler/none/Kenya", "refreshed");
  assert.deepEqual(payload.vaccines.map((item) => item.name), ["Hepatitis A"]);
  assert.equal(payload.malaria?.name, "Malaria");
  assert.deepEqual(payload.diseases.map((item) => item.name), ["Leptospirosis"]);
  assert.deepEqual(payload.notices, ["Example destination notice"]);
  const result = await cdcGuidanceAdapter({ country: resolveCountry("KE")!, now: () => NOW, internalJson: async () => payload, externalJson: async () => ({}), env: () => undefined });
  const mapped = publicHealthFromAdapterResults([result]);
  assert.ok(mapped.inputs.some((item) => item.topic === "Hepatitis A" && item.kind === "recommendation"));
  assert.ok(mapped.inputs.some((item) => item.category === "malaria_chemoprophylaxis"));
  assert.ok(mapped.inputs.every((item) => item.url === payload.sourceUrl));
});

/* ---------------------------------------------------------------- */
/* Historical host-nation confidence                                 */
/* ---------------------------------------------------------------- */

const baselineGhana = VACCINE_RULES.find((rule) => rule.id === "yellow-fever-entry-GH-baseline") as VaccineRule;
const base = (destination: string, extra: Partial<MedicalApplicabilityQuery> = {}) =>
  resolveMedicalApplicability({ destination, population: "dod_contractor", contractorAuthorization: "caaf", stayDays: 30, travelKind: "official_tdy_deployment", arrivingFrom: "USA", now: NOW, ...extra });
const hostItems = (result: MedicalApplicabilityResult) => result.requirements.filter((entry) => entry.layer === "host_nation");

test("1. an OLDER GLOBAL BASELINE mandatory rule flagged for production verification is not reported REQUIRED", () => {
  assert.equal(baselineGhana.verificationStatus, "OLDER GLOBAL BASELINE");
  assert.equal(baselineGhana.legalForce, "mandatory");
  assert.equal(baselineGhana.productionVerificationRequired, true);
  assert.ok(isUnconfirmedHistoricalRule(baselineGhana));
  const yf = hostItems(base("Ghana")).find((entry) => entry.id === "host_nation:yellow-fever-entry-GH-baseline") as RequirementItem;
  assert.ok(yf);
  assert.equal(yf.status, "UNKNOWN");
  assert.equal(yf.verification?.state, "unconfirmed_historical");
});

test("2. the historical evidence, the possible requirement and the verification gap are preserved", () => {
  const yf = hostItems(base("Ghana"))[0];
  const verification = yf.verification!;
  assert.match(verification.possibleRequirement ?? "", /^Possible entry requirement \(unconfirmed\)/);
  assert.match(verification.possibleRequirement ?? "", /proof of yellow fever vaccination/i);
  assert.match(verification.gap ?? "", /OLDER GLOBAL BASELINE/);
  assert.match(verification.gap ?? "", /cannot independently establish/i);
  const evidence = verification.historicalEvidence!;
  assert.match(evidence.authority, /Yellow Book/);
  assert.equal(evidence.authorityTier, "global_compilation");
  assert.equal(evidence.verificationStatus, "OLDER GLOBAL BASELINE");
  assert.equal(evidence.productionVerificationRequired, true);
  assert.equal(evidence.lastVerifiedAt, null);
  assert.ok(evidence.supportingSources.length >= 1 && evidence.supportingSources.every((source) => source.url));
  assert.ok(evidence.notes.length >= 1);
  assert.ok(yf.missingInputs.some((input) => /current destination-government confirmation/i.test(input)));
  assert.ok(yf.why.some((line) => /becomes REQUIRED only when a current/i.test(line)));
  assert.equal(yf.authority.verificationStatus, "OLDER GLOBAL BASELINE");
  assert.equal(yf.effective.status, "effective_date_not_established");
});

test("3. a NOT CURRENTLY VERIFIED rule (Benin) is also UNKNOWN with the gap, never REQUIRED", () => {
  const benin = hostItems(base("Benin"));
  assert.ok(benin.length > 0);
  for (const entry of benin.filter((item) => item.id.includes("yellow-fever-entry-BJ"))) {
    assert.equal(entry.status, "UNKNOWN");
    assert.equal(entry.verification?.state, "unconfirmed_historical");
    assert.match(entry.verification?.gap ?? "", /NOT CURRENTLY VERIFIED/);
  }
});

test("4. a current destination-government source establishes REQUIRED for the same requirement", () => {
  const government: VaccineRule = {
    ...baselineGhana, id: "yellow-fever-entry-GH-government", sourceAuthority: "Ghana Ministry of Health (test fixture)", authorityTier: "destination_government",
    verificationStatus: "DESTINATION-GOVERNMENT VERIFIED", lastVerifiedAt: "2026-10-01", productionVerificationRequired: false,
  };
  assert.ok(!isUnconfirmedHistoricalRule(government));
  const alone = hostItems(base("Ghana", { hostNationRules: [government] }));
  assert.equal(alone.length, 1);
  assert.equal(alone[0].status, "REQUIRED");
  assert.equal(alone[0].verification?.state, "verified_current_source");
  assert.equal(alone[0].verification?.possibleRequirement, null);
  // With both on file, the authoritative reading governs and the baseline does not downgrade it.
  const both = hostItems(base("Ghana", { hostNationRules: [baselineGhana, government] }));
  assert.ok(both.some((entry) => entry.status === "REQUIRED" && entry.id.endsWith("GH-government")));
  assert.ok(!both.some((entry) => entry.status === "REQUIRED" && entry.id.includes("baseline")));
});

test("5. across every rule country, no REQUIRED host-nation item rests on an unconfirmed historical rule, and verified rules still produce REQUIRED", () => {
  const countries = [...new Set(VACCINE_RULES.map((rule) => rule.destinationCountry))].filter((code): code is string => Boolean(code));
  const unconfirmedIds = new Set(VACCINE_RULES.filter(isUnconfirmedHistoricalRule).map((rule) => `host_nation:${rule.id}`));
  assert.ok(unconfirmedIds.size > 10, "the registry carries many baseline copies");
  let verifiedRequired = 0;
  for (const iso2 of countries) {
    for (const origin of ["USA", "KE"]) for (const entry of hostItems(base(iso2, { arrivingFrom: origin, visitedCountries: [origin] }))) {
      if (entry.status === "REQUIRED") {
        assert.ok(!unconfirmedIds.has(entry.id), `${entry.id} is REQUIRED on an unconfirmed historical rule`);
        assert.equal(entry.verification?.state, "verified_current_source");
        verifiedRequired += 1;
      }
      if (unconfirmedIds.has(entry.id)) {
        assert.notEqual(entry.status, "REQUIRED");
        assert.notEqual(entry.status, "NOT_APPLICABLE", "an unverified compilation cannot establish non-applicability either");
      }
    }
  }
  assert.ok(verifiedRequired > 0, "destination-government verified rules still establish REQUIRED");
});

test("6. the layer note says how many host-nation rules rest only on an unverified compilation", () => {
  const ghana = base("Ghana");
  assert.equal(ghana.layers.host_nation.coverage, "partial");
  assert.match(ghana.layers.host_nation.note, /older, unverified compilation/);
  assert.match(ghana.layers.host_nation.note, /not REQUIRED/);
  assert.ok(!/\(yes\)/.test(ghana.layers.host_nation.note));
});

test("7. live public-health entry-requirement language is shown as corroboration but never establishes the host-nation rule", () => {
  const result = base("Ghana", {
    publicHealth: [{ id: "cdc-yf-entry-gh", topic: "Yellow Fever: entry requirement language", kind: "entry_requirement_language", authority: "CDC Travelers' Health", recommendation: "Proof of vaccination is required for entry.", url: "https://wwwnc.cdc.gov/travel/destinations/traveler/none/ghana", retrievedAt: NOW.toISOString() }],
  });
  const yf = hostItems(result)[0];
  assert.equal(yf.status, "UNKNOWN");
  assert.equal(yf.verification?.liveCorroboration.length, 1);
  assert.equal(yf.verification?.liveCorroboration[0].itemId, "public_health:cdc-yf-entry-gh");
  const language = result.requirements.find((entry) => entry.id === "public_health:cdc-yf-entry-gh") as RequirementItem;
  assert.notEqual(language.status, "REQUIRED");
  assert.equal(language.status, "CONDITIONAL");
});

/* ---------------------------------------------------------------- */
/* Automatic CDC / WHO supply                                        */
/* ---------------------------------------------------------------- */

type Fixture = Record<string, unknown | Error>;
const pick = (table: Fixture, key: string) => {
  const match = Object.keys(table).find((prefix) => key.startsWith(prefix));
  if (!match) throw new Error(`Source returned HTTP 404 (no fixture for ${key})`);
  const value = table[match];
  if (value instanceof Error) throw value;
  return value;
};
const calls: string[] = [];
function deps(internal: Fixture, store = createMemoryStore(), clock: Date = NOW): IntelDeps {
  return { store, now: () => clock, env: () => undefined, internalJson: async (path) => { calls.push(path); return pick(internal, path); }, externalJson: async (url) => pick({}, url) };
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
const kenya: Fixture = {
  "/api/aor/travel-health": cdcKenya,
  "/api/aor/travel-notices": { ok: true, notices: [{ level: 2, levelLabel: "Practice Enhanced Precautions", action: "Practice enhanced precautions.", title: "Chikungunya in Indian Ocean region", date: "August 1, 2026", summary: "Cases reported.", url: "https://wwwnc.cdc.gov/travel/notices/level2/chik", countries: ["Mauritius"], status: "active" }] },
  "/api/aor/health-outbreaks": { ok: true, available: true, outbreaks: [{ id: "1", title: "Rift Valley fever – Kenya", publicationDate: "2026-08-20T00:00:00Z", summary: "Cases in Kenya.", assessment: "Moderate", advice: "Avoid contact with livestock.", sourceUrl: "https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON999" }] },
};
const query = (extra: Partial<MedicalApplicabilityQuery> = {}): MedicalApplicabilityQuery => ({
  destination: "Kenya", population: "dod_contractor", contractorAuthorization: "caaf", stayDays: 120, travelKind: "official_tdy_deployment", now: NOW, ...extra,
});
const publicItems = (result: MedicalApplicabilityResult) => result.requirements.filter((entry) => entry.layer === "public_health");
const signature = (result: MedicalApplicabilityResult) => result.requirements.filter((entry) => entry.layer !== "public_health").map((entry) => `${entry.id}=${entry.status}`).join("|");

test("8. the existing CDC / WHO adapters supply destination guidance without the caller assembling anything", async () => {
  calls.length = 0;
  const result = await resolveMedicalApplicabilityWithPublicHealth(query(), deps(kenya));
  assert.ok(calls.some((path) => path.startsWith("/api/aor/travel-health")) && calls.some((path) => path.startsWith("/api/aor/health-outbreaks")));
  const items = publicItems(result);
  assert.ok(items.length >= 5, items.map((entry) => entry.title).join(", "));
  const hepA = items.find((entry) => entry.title === "Hepatitis A") as RequirementItem;
  assert.equal(hepA.status, "RECOMMENDED");
  assert.equal(hepA.category, "immunization");
  assert.equal(hepA.authority.issuer, "CDC Travelers' Health");
  assert.match(hepA.authority.sourceUrl ?? "", /wwwnc\.cdc\.gov\/travel\/destinations\/traveler\/none\/kenya/);
  assert.match(hepA.authority.verificationStatus ?? "", /^LIVE ADAPTER \(cdc-travelers-health\)/);
  assert.match(hepA.evidence.sourceWording ?? "", /Recommended for unvaccinated travelers/);
  assert.match(hepA.evidence.sourceProvenance ?? "", /cdc-travelers-health record/);
  const rabies = items.find((entry) => entry.title === "Rabies") as RequirementItem;
  assert.equal(rabies.status, "CONDITIONAL", "'some travelers' is conditional, not a blanket recommendation");
  const malaria = items.find((entry) => entry.category === "malaria_chemoprophylaxis") as RequirementItem;
  assert.ok(malaria);
  assert.notEqual(malaria.status, "REQUIRED");
  assert.match(malaria.evidence.sourceWording ?? "", /atovaquone-proguanil/);
  const outbreak = items.find((entry) => /Rift Valley/.test(entry.title)) as RequirementItem;
  assert.equal(outbreak.status, "CONDITIONAL");
  assert.equal(outbreak.authority.issuer, "WHO Disease Outbreak News");
  assert.ok(items.every((entry) => entry.status !== "REQUIRED"), "public-health guidance is never REQUIRED");
});

test("9. every live item cites an evidence record the existing country-intel workspace itself returns (nothing fabricated)", async () => {
  const store = createMemoryStore();
  const result = await resolveMedicalApplicabilityWithPublicHealth(query(), deps(kenya, store));
  const intel = await buildCountryIntel("KE", deps(kenya, store));
  const known = new Map((intel?.evidence ?? []).map((record) => [`public_health:${record.id}`, record]));
  assert.ok(publicItems(result).length > 0);
  for (const entry of publicItems(result)) {
    const record = known.get(entry.id);
    assert.ok(record, `${entry.id} is not an adapter evidence record`);
    assert.equal(entry.authority.sourceUrl, record.sourceUrl);
    assert.equal(entry.evidence.sourceWording, record.evidence);
  }
});

test("10. the layer reports each adapter's status and freshness; entry-requirement language is CONDITIONAL, exposure-only records are not converted", async () => {
  const result = await resolveMedicalApplicabilityWithPublicHealth(query(), deps(kenya));
  const layer = result.layers.public_health;
  assert.equal(layer.coverage, "evaluated");
  assert.deepEqual(layer.sources?.map((source) => source.sourceId).sort(), ["cdc-travel-notices", "cdc-travelers-health", "who-don"]);
  const cdc = layer.sources?.find((source) => source.sourceId === "cdc-travelers-health");
  assert.equal(cdc?.status, "ok");
  assert.equal(cdc?.freshness, "CURRENT_GUIDANCE");
  assert.ok(cdc?.lastSuccessfulFetch && cdc.retrievedAt);
  assert.ok(cdc?.sourceUpdatedAt);
  assert.ok((cdc?.recordsNotMapped ?? 0) >= 1, "the Dengue exposure record is context, not a recommendation");
  assert.equal(layer.sources?.find((source) => source.sourceId === "cdc-travel-notices")?.status, "no_current_matching_finding");
  assert.ok(result.limitations.some((line) => /no matching finding is not evidence/i.test(line)));
  const entry = publicItems(result).find((item) => /entry requirement/i.test(item.title)) as RequirementItem;
  assert.equal(entry.status, "CONDITIONAL");
  assert.match(entry.trigger.conditions.join(" "), /destination government's own rule/);
  assert.ok(!publicItems(result).some((item) => /Dengue/.test(item.title)));
});

test("11. public-health guidance does not change command-policy applicability or the other three layers", async () => {
  const live = await resolveMedicalApplicabilityWithPublicHealth(query(), deps(kenya));
  const off = await resolveMedicalApplicabilityWithPublicHealth(query(), deps(kenya), { livePublicHealth: false });
  assert.equal(signature(live), signature(off));
  assert.equal(live.layers.combatant_command.coverage, off.layers.combatant_command.coverage);
  assert.ok(live.requirements.some((entry) => entry.layer === "combatant_command" && entry.status === "REQUIRED"), "AFRICOM yellow fever stays REQUIRED from the command policy");
  assert.equal(live.requirements.find((entry) => entry.id.endsWith("af:supplement:yellow-fever"))?.layer, "combatant_command");
  for (const entry of live.requirements) assert.equal(entry.layer, entry.authority.layer);
});

test("12. live collection can be switched off: no adapter is called and the layer reports not_supplied", async () => {
  calls.length = 0;
  const result = await resolveMedicalApplicabilityWithPublicHealth(query(), deps(kenya), { livePublicHealth: false });
  assert.equal(calls.length, 0);
  assert.equal(result.layers.public_health.coverage, "not_supplied");
  assert.equal(result.categories.malaria_chemoprophylaxis.status === "REQUIRED", false);
});

test("13. an unavailable adapter yields explicit UNKNOWN coverage and the rest of the evaluation continues", async () => {
  const down = new Error("Internal route returned HTTP 502");
  const result = await resolveMedicalApplicabilityWithPublicHealth(query(), deps({ ...kenya, "/api/aor/travel-health": down }));
  assert.equal(result.status, "EVALUATED");
  const layer = result.layers.public_health;
  assert.equal(layer.coverage, "partial");
  const cdc = layer.sources?.find((source) => source.sourceId === "cdc-travelers-health");
  assert.equal(cdc?.status, "source_unavailable");
  assert.match(cdc?.sourceError ?? "", /HTTP 502/);
  assert.ok(result.limitations.some((line) => /CDC Travelers' Health was source unavailable.*UNKNOWN for this assignment, not absent/i.test(line)));
  assert.ok(!publicItems(result).some((entry) => entry.category === "malaria_chemoprophylaxis" && entry.authority.issuer === "CDC Travelers' Health"));
  assert.ok(publicItems(result).some((entry) => /Rift Valley/.test(entry.title)), "WHO items are still returned");
  assert.ok(result.requirements.some((entry) => entry.layer === "combatant_command" && entry.status === "REQUIRED"));
});

test("14. every public-health adapter down: coverage is 'unavailable', no public item, nothing is reported as absent", async () => {
  const down = new Error("Source returned HTTP 503");
  const result = await resolveMedicalApplicabilityWithPublicHealth(query(), deps({ "/api/aor/travel-health": down, "/api/aor/travel-notices": down, "/api/aor/health-outbreaks": down }));
  assert.equal(result.status, "EVALUATED");
  assert.equal(result.layers.public_health.coverage, "unavailable");
  assert.match(result.layers.public_health.note, /UNKNOWN/);
  assert.equal(publicItems(result).length, 0);
  assert.equal(result.layers.public_health.sources?.filter((source) => source.status === "source_unavailable").length, 3);
  assert.equal(result.requirements.filter((entry) => entry.layer === "public_health" && entry.status === "NOT_APPLICABLE").length, 0);
  assert.ok(result.requirements.some((entry) => entry.layer === "combatant_command"));
});

test("15. a failed refresh serves a labelled last-known copy that is flagged as not current", async () => {
  const store = createMemoryStore();
  await resolveMedicalApplicabilityWithPublicHealth(query(), deps(kenya, store));
  const later = new Date(NOW.getTime() + 8 * 60 * 60_000); // past the 6 h CDC guidance TTL
  const result = await resolveMedicalApplicabilityWithPublicHealth(query({ now: later }), deps({ ...kenya, "/api/aor/travel-health": new Error("Internal route returned HTTP 502") }, store, later));
  const cdc = result.layers.public_health.sources?.find((source) => source.sourceId === "cdc-travelers-health");
  assert.equal(cdc?.status, "stale_cache");
  assert.equal(cdc?.freshness, "STALE_CACHE");
  assert.ok(cdc?.lastSuccessfulFetch);
  const stale = publicItems(result).find((entry) => entry.title === "Hepatitis A") as RequirementItem;
  assert.ok(stale);
  assert.ok(stale.why.some((line) => /not current/i.test(line)));
  assert.match(stale.effective.note, /Last-known data, not current/);
  assert.ok(result.limitations.some((line) => /cached copy.*last-known data, not current/i.test(line)));
});

test("16. caller-supplied items are kept and win on id; live items are added alongside", async () => {
  const supplied = { id: "caller-note", topic: "Local clinic advice", authority: "Unit surgeon", recommendation: "Carry a spare supply of antimalarials.", url: "https://example.mil/advice", category: "malaria_chemoprophylaxis" as const };
  const result = await resolveMedicalApplicabilityWithPublicHealth(query({ publicHealth: [supplied] }), deps(kenya));
  const mine = result.requirements.find((entry) => entry.id === "public_health:caller-note") as RequirementItem;
  assert.ok(mine);
  assert.equal(mine.authority.verificationStatus, "SUPPLIED PUBLIC-HEALTH EVIDENCE");
  assert.ok(publicItems(result).some((entry) => /LIVE ADAPTER/.test(entry.authority.verificationStatus ?? "")));
});

test("17. locations without a country code of their own or that are ambiguous never trigger a country-level CDC / WHO lookup", async () => {
  calls.length = 0;
  const hawaii = await resolveMedicalApplicabilityWithPublicHealth(query({ destination: "Hawaii" }), deps(kenya));
  const ambiguous = await resolveMedicalApplicabilityWithPublicHealth(query({ destination: "United States" }), deps(kenya));
  const missing = await resolveMedicalApplicabilityWithPublicHealth(query({ destination: "Narnia" }), deps(kenya));
  assert.equal(calls.length, 0);
  assert.equal(hawaii.layers.public_health.coverage, "not_supplied");
  assert.match(hawaii.layers.public_health.note, /no ISO 3166 country code of its own/);
  assert.equal(ambiguous.status, "LOCATION_AMBIGUOUS");
  assert.equal(missing.status, "LOCATION_NOT_FOUND");
});

test("18. CDC malaria text is mapped without inventing risk: parts-of-country is conditional, a stated no-risk is NOT_APPLICABLE only for the CDC item", async () => {
  const ctx = (iso2: string): AdapterContext => ({ country: resolveCountry(iso2)!, now: () => NOW, internalJson: async () => ({}), externalJson: async () => ({}), env: () => undefined });
  const run = async (iso2: string, malaria: string) => {
    const adapterCtx = { ...ctx(iso2), internalJson: async () => ({ ...cdcKenya, malaria: { name: "Malaria", recommendation: malaria } }) };
    const result = await cdcGuidanceAdapter(adapterCtx);
    return publicHealthFromAdapterResults([result]).inputs.find((input) => input.category === "malaria_chemoprophylaxis");
  };
  const parts = await run("KE", "Risk in some areas of the country, mainly the coast. Take prophylaxis in those areas.");
  assert.match(parts?.condition ?? "", /malaria-risk areas the source names/);
  const none = await run("KE", "There is no risk of malaria transmission in this country.");
  assert.equal(none?.sourceStatesNoRisk, true);
});

test("19. the endpoint returns public-health intelligence without a frontend-assembled array, and survives adapters being unreachable", async () => {
  const { default: express } = await import("express");
  const { default: router } = await import("../../routes/aor-command-policy");
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  const server = app.listen(0);
  try {
    const port = (server.address() as { port: number }).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/aor/medical-applicability?destination=Kenya&population=dod_contractor&contractorAuthorization=caaf&stayDays=120&travelKind=official_tdy_deployment`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as MedicalApplicabilityResult & { ok: boolean };
    assert.equal(body.ok, true);
    assert.equal(body.status, "EVALUATED");
    assert.ok(body.layers.public_health.sources && body.layers.public_health.sources.length === 3, "the endpoint consulted the three existing adapters itself");
    // No internal loopback server exists in this test, so every adapter is unavailable: explicit UNKNOWN coverage, evaluation continues.
    assert.equal(body.layers.public_health.coverage, "unavailable");
    assert.ok(body.requirements.some((entry) => entry.layer === "combatant_command"));
    const off = await fetch(`http://127.0.0.1:${port}/api/aor/medical-applicability?destination=Kenya&livePublicHealth=false`);
    const offBody = (await off.json()) as MedicalApplicabilityResult;
    assert.equal(offBody.layers.public_health.coverage, "not_supplied");
  } finally {
    server.close();
  }
});
