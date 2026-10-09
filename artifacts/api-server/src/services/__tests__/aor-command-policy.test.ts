import assert from "node:assert/strict";
import test from "node:test";
import { buildCountryIntel } from "../aor-intel/aggregate";
import { createMemoryStore } from "../aor-intel/cache";
import { assignmentFor, assignmentHistoryFor, assignmentStats, countriesForCommand, CURRENT_ASSIGNMENTS } from "../aor-intel/command-policy/assignments";
import { commandPolicyAdapter, createCommandSourceMonitor, monitoredCommandUrls } from "../aor-intel/command-policy/adapter";
import { describeCommandCountry, evaluateCommandTraveler, resolveCountryCommand } from "../aor-intel/command-policy/engine";
import { COMMAND_POLICIES, COMMAND_RULES } from "../aor-intel/command-policy/policies-data";
import type { CommandId } from "../aor-intel/command-policy/types";
import { resolveCountry } from "../aor-intel/geo";
import { validateStatements } from "../aor-intel/synthesis";
import type { AdapterContext, EvidenceRecord, UrlProbe } from "../aor-intel/types";
import { VACCINE_RULES } from "../aor-intel/vaccine-rules/rules-data";

const NOW = new Date("2026-10-09T12:00:00Z");
const ctxFor = (iso2: string, probe?: (url: string) => Promise<UrlProbe>, at: Date = NOW): AdapterContext => ({
  country: resolveCountry(iso2)!, now: () => at, internalJson: async () => ({}), externalJson: async () => ({}), env: () => undefined, probeUrl: probe,
});
const probe = (hash: string): UrlProbe => ({ httpStatus: 200, finalUrl: "https://x", lastModified: "Thu, 02 Oct 2026 08:00:00 GMT", etag: null, contentType: "text/html", contentHash: hash });
const evalRule = (query: Parameters<typeof evaluateCommandTraveler>[0], ruleId: string) => evaluateCommandTraveler(query).evaluations.find((e) => e.rule.id === ruleId);

test("registry: sovereign counts match each command's public count, no country is in two commands", () => {
  const expected: Record<CommandId, number> = { CENTCOM: 21, AFRICOM: 53, EUCOM: 50, INDOPACOM: 36, SOUTHCOM: 31, NORTHCOM: 4 };
  for (const [command, count] of Object.entries(expected)) assert.equal(countriesForCommand(command as CommandId).length, count, command);
  assert.equal(new Set(CURRENT_ASSIGNMENTS.map((entry) => entry.iso3)).size, CURRENT_ASSIGNMENTS.length, "each ISO3 appears once among current assignments");
  const entities = CURRENT_ASSIGNMENTS.filter((entry) => entry.entityType === "entity").map((entry) => `${entry.iso3}:${entry.command}`).sort();
  assert.deepEqual(entities, ["ESH:AFRICOM", "GRL:NORTHCOM", "PRI:NORTHCOM", "PSE:CENTCOM", "TWN:INDOPACOM", "VIR:NORTHCOM"], "territories are separate from the sovereign count");
  assert.equal(assignmentStats().byCommand.EUCOM.sovereign, 50);
  // LIVE VERIFY flags exactly where the pack says the one-page enumeration was not retrieved.
  const flagged = new Set(CURRENT_ASSIGNMENTS.filter((entry) => /LIVE VERIFY/.test(entry.verification)).map((entry) => entry.command));
  assert.deepEqual([...flagged].sort(), ["EUCOM", "INDOPACOM"]);
});

test("country → command regression cases from the pack, including Israel's 2021 reassignment history", () => {
  const expected: Array<[string, string, CommandId]> = [
    ["KW", "KWT", "CENTCOM"], ["IL", "ISR", "CENTCOM"], ["EG", "EGY", "CENTCOM"], ["KE", "KEN", "AFRICOM"], ["PL", "POL", "EUCOM"],
    ["JP", "JPN", "INDOPACOM"], ["CO", "COL", "SOUTHCOM"], ["CA", "CAN", "NORTHCOM"],
  ];
  for (const [iso2, iso3, command] of expected) {
    assert.equal(resolveCountry(iso2)?.iso3, iso3, `${iso2} resolves to ${iso3}`);
    assert.equal(resolveCountryCommand(iso3).command, command, iso3);
  }
  const israel = resolveCountryCommand("ISR");
  assert.equal(israel.command, "CENTCOM", "Israel must not resolve to EUCOM");
  assert.equal(israel.assignment?.supersedesCommand, "EUCOM");
  assert.equal(israel.assignment?.effectiveFrom, "2021-01-15");
  assert.equal(israel.history.length, 1);
  assert.equal(israel.history[0].command, "EUCOM");
  assert.equal(israel.history[0].effectiveTo, "2021-01-15", "history is a record, not an overwrite");
  assert.equal(assignmentHistoryFor("KWT").length, 0);
  assert.equal(assignmentFor("EGY")?.command, "CENTCOM", "Egypt is the one African state outside AFRICOM");
  assert.equal(resolveCountryCommand("XKS").command, "EUCOM", "the AOR country table codes Kosovo as XKS");
  assert.equal(resolveCountryCommand("ZZZ").commandMedicalPolicyStatus, "COMMAND_NOT_ASSIGNED");
  assert.equal(resolveCountryCommand("ZZZ").rules.length, 0, "an unassigned country borrows nothing");
});

test("each command resolves to its own policy; NORTHCOM stays NOT PUBLICLY VERIFIED and borrows nothing", () => {
  const expectedPolicy: Record<string, string> = {
    KWT: "CENTCOM-MOD18", KEN: "AFRICOM-ACI-4200.09C", POL: "EUCOM-ECI-4202.01A", JPN: "INDOPACOM-FY26-FHP-P-25-0295", COL: "SOUTHCOM-REG-40-501",
  };
  for (const [iso3, policyId] of Object.entries(expectedPolicy)) {
    const resolution = resolveCountryCommand(iso3);
    assert.equal(resolution.policy?.policyId, policyId, iso3);
    assert.ok(resolution.rules.length > 0, iso3);
    assert.ok(resolution.rules.every((rule) => rule.policyId === policyId), `${iso3}: no rule from another command's policy`);
    assert.equal(resolution.commandMedicalPolicyStatus, "PUBLISHED");
  }
  const canada = resolveCountryCommand("CAN");
  assert.equal(canada.commandMedicalPolicyStatus, "NOT_PUBLICLY_VERIFIED");
  assert.equal(canada.policy?.verificationStatus, "NOT PUBLICLY VERIFIED");
  assert.equal(canada.rules.length, 0, "no thresholds copied from another command");
  assert.match(String(canada.note), /NOT PUBLICLY VERIFIED/);
  assert.equal(COMMAND_RULES.filter((rule) => rule.policyId === "NORTHCOM-NONE").length, 0);
});

test("source supersession: MOD 18 supersedes MOD 17, which is kept as history with no invented content", () => {
  const kuwait = resolveCountryCommand("KWT");
  assert.equal(kuwait.policy?.supersedesPolicyId, "CENTCOM-MOD17");
  assert.equal(kuwait.supersededPolicies.map((policy) => policy.policyId).join(), "CENTCOM-MOD17");
  const mod17 = COMMAND_POLICIES.find((policy) => policy.policyId === "CENTCOM-MOD17");
  assert.equal(mod17?.verificationStatus, "COMMAND PUBLICATION — SUPERSEDED");
  assert.equal(mod17?.supersededByPolicyId, "CENTCOM-MOD18");
  assert.equal(COMMAND_RULES.filter((rule) => rule.policyId === "CENTCOM-MOD17").length, 0, "no MOD 17 rule text is shown");
  assert.equal(kuwait.rules.some((rule) => rule.policyId === "CENTCOM-MOD17"), false);
  // EUCOM: still applicable, under rewrite — and the document is over three years old.
  const poland = describeCommandCountry("POL", NOW);
  assert.ok(poland.qualifiers.some((q) => /under rewrite/i.test(q)));
  assert.ok(poland.qualifiers.some((q) => /over 3 years old/.test(q)));
});

test("short vs long duration: CENTCOM >30 days (transit excluded), Tab D ≥15 days, SOUTHCOM <30 vs ≥30, AFRICOM any duration", () => {
  const contractor = { iso3: "KWT", population: "dod_contractor" as const };
  assert.equal(evalRule({ ...contractor, stayDays: 20 }, "cc:medication-supply")?.applicability, "does_not_apply");
  assert.equal(evalRule({ ...contractor, stayDays: 30 }, "cc:medication-supply")?.applicability, "does_not_apply", "'over 30 days' excludes exactly 30");
  assert.equal(evalRule({ ...contractor, stayDays: 31 }, "cc:medication-supply")?.applicability, "applies");
  assert.equal(evalRule({ iso3: "KWT", population: "dod_civilian", stayDays: 15 }, "cc:cbrn-tab-d")?.applicability, "applies", "Tab D is at least 15 days");
  const directed = evalRule({ ...contractor, stayDays: 15 }, "cc:cbrn-tab-d");
  assert.equal(directed?.applicability, "unknown", "contractors only when directed");
  assert.match(directed?.missingInputs[0] ?? "", /as directed/);
  assert.equal(evalRule({ iso3: "KWT", population: "dod_civilian", stayDays: 14 }, "cc:cbrn-tab-d")?.applicability, "does_not_apply");
  assert.equal(evalRule({ ...contractor }, "cc:medication-supply")?.applicability, "unknown", "no stay entered → unknown, never 'applies'");
  assert.deepEqual(evalRule({ ...contractor }, "cc:medication-supply")?.missingInputs, ["planned in-country days"]);
  const short = evaluateCommandTraveler({ ...contractor, stayDays: 10 });
  assert.match(String(short.shortStayNote), /does not establish that the command has no short-stay requirement/);

  const sc = { iso3: "COL", population: "dod_contractor" as const };
  assert.equal(evalRule({ ...sc, stayDays: 20 }, "sc:short-visit")?.applicability, "applies");
  assert.equal(evalRule({ ...sc, stayDays: 20 }, "sc:mod3-fitness")?.applicability, "does_not_apply");
  assert.equal(evalRule({ ...sc, stayDays: 45 }, "sc:mod3-fitness")?.applicability, "applies");
  assert.equal(evalRule({ ...sc, stayDays: 45 }, "sc:short-visit")?.applicability, "does_not_apply");
  assert.equal(evalRule({ ...sc, stayDays: 30 }, "sc:mod3-fitness")?.applicability, "applies", "MOD 3 is 30 or more consecutive days");
  assert.equal(evalRule({ ...sc, stayDays: 45 }, "sc:clearance")?.rule.domain, "clearance", "theater clearance stays a separate domain");

  assert.equal(evalRule({ iso3: "KEN", population: "dod_civilian", stayDays: 3 }, "af:applicability")?.applicability, "applies", "AFRICOM: any duration");
  assert.equal(evalRule({ iso3: "POL", population: "us_military", stayDays: 3 }, "eu:applicability")?.applicability, "applies", "EUCOM: any duration");
  // INDOPACOM: duration triggers were not extracted — none may be invented.
  const indopacom = resolveCountryCommand("JPN").rules;
  assert.ok(indopacom.every((rule) => rule.minimumStay === null && rule.maximumStayDaysExclusive === null));
  assert.ok(indopacom.find((rule) => rule.id === "ip:order")?.sourceGaps.includes("stay-duration triggers"));
});

test("waiver routing: CJTF-HOA geography, component-specific EUCOM routing, contractor routing", () => {
  const kenya = { iso3: "KEN", population: "dod_civilian" as const, stayDays: 20 };
  assert.equal(evalRule({ ...kenya, component: "CJTF-HOA" }, "af:waiver-cjtf-hoa")?.applicability, "applies");
  assert.equal(evalRule({ ...kenya, component: "SOCAFRICA" }, "af:waiver-cjtf-hoa")?.applicability, "does_not_apply");
  const unknown = evalRule(kenya, "af:waiver-cjtf-hoa");
  assert.equal(unknown?.applicability, "unknown", "depends on the supported command");
  assert.match(unknown?.missingInputs[0] ?? "", /supported component/);
  assert.equal(evalRule({ ...kenya, component: "SOCAFRICA" }, "af:waiver-socafrica")?.applicability, "applies");
  // Ghana is not in the CJTF-HOA geography: the rule is not even part of its resolution.
  assert.equal(resolveCountryCommand("GHA").rules.some((rule) => rule.id === "af:waiver-cjtf-hoa"), false);
  for (const iso3 of ["BDI", "DJI", "ERI", "ETH", "KEN", "RWA", "SYC", "SOM", "SSD", "SDN", "TZA", "UGA"]) {
    assert.ok(resolveCountryCommand(iso3).rules.some((rule) => rule.id === "af:waiver-cjtf-hoa"), iso3);
  }
  const poland = { iso3: "POL", population: "us_military" as const };
  assert.equal(evalRule({ ...poland, component: "USAFE" }, "eu:waiver:usafe")?.applicability, "applies");
  assert.equal(evalRule({ ...poland, component: "USAFE" }, "eu:waiver:usareur-af")?.applicability, "does_not_apply");
  assert.equal(evalRule({ iso3: "POL", population: "dod_contractor", component: "USAREUR-AF" }, "eu:contractor")?.applicability, "applies");
  assert.equal(evalRule({ iso3: "POL", population: "us_military", component: "USAREUR-AF" }, "eu:contractor")?.applicability, "does_not_apply");
  // CENTCOM: the clinic or local commander is not the final authority.
  assert.match(String(COMMAND_RULES.find((rule) => rule.id === "cc:waiver-authority")?.waiverAuthority), /CENTCOM Surgeon/);
});

test("population, PCS and condition rules: pack-stated statuses only, unstated waiver availability stays SOURCE_GAP", () => {
  assert.equal(evalRule({ iso3: "KWT", population: "us_military", stayDays: 60 }, "cc:taba:gender-dysphoria")?.applicability, "does_not_apply", "civilian/contractor rule");
  assert.equal(evalRule({ iso3: "KWT", population: "dod_contractor", stayDays: 60 }, "cc:taba:gender-dysphoria")?.applicability, "applies");
  assert.equal(evalRule({ iso3: "KWT", stayDays: 60 }, "cc:taba:gender-dysphoria")?.applicability, "unknown");
  assert.equal(evalRule({ iso3: "KWT", population: "dependent", travelKind: "pcs" }, "cc:tabb:family")?.applicability, "applies");
  assert.equal(evalRule({ iso3: "KWT", population: "dependent", travelKind: "official_tdy_deployment" }, "cc:tabb:family")?.applicability, "does_not_apply", "Tab B is PCS only");
  const byId = (id: string) => COMMAND_RULES.find((rule) => rule.id === id)!;
  assert.equal(byId("cc:taba:osa-mild").status, "deployable");
  assert.equal(byId("cc:taba:osa-moderate").status, "conditional");
  assert.equal(byId("cc:taba:osa-severe").status, "waiver-required");
  assert.equal(byId("cc:taba:osa-symptomatic").status, "non-waivable");
  assert.equal(byId("cc:taba:osa-advanced").status, "conditional", "'non-deployable' is not turned into 'non-waivable'");
  assert.ok(byId("cc:taba:osa-advanced").sourceGaps.some((gap) => /waiver/.test(gap)));
  assert.deepEqual(COMMAND_RULES.filter((rule) => rule.status === "non-waivable").map((rule) => rule.id), ["cc:taba:osa-symptomatic"], "only the pack-stated non-waivable condition");
  assert.match(byId("cc:taba:tbi").conditionOrRequirement, /24 hours symptom-free/);
  assert.match(byId("cc:taba:weight").thresholdOrRule ?? "", /136 kg/);
  assert.match(byId("cc:immunization-prophylaxis").caveats.join(" "), /LIVE VERIFY/);
  assert.ok(byId("cc:immunization-prophylaxis").sourceGaps.length > 0);
  assert.equal(byId("eu:tbe").kind, "recommendation", "EUCOM TBE memo is guidance, not a requirement");
  assert.equal(byId("af:supplement:yellow-fever").kind, "requirement");
  assert.equal(byId("af:supplement:yellow-fever").sourceUrl, "https://www.africom.mil/document/36281/yellow-fever-vaccination-requirements-for-the-usafricom-theater");
});

test("data integrity: every rule belongs to a policy, cites an https command/DoD source, and no field is invented where the pack is silent", () => {
  const policyIds = new Set(COMMAND_POLICIES.map((policy) => policy.policyId));
  const ids = new Set<string>();
  for (const rule of COMMAND_RULES) {
    assert.ok(policyIds.has(rule.policyId), rule.id);
    assert.ok(!ids.has(rule.id), `duplicate ${rule.id}`);
    ids.add(rule.id);
    assert.match(rule.sourceUrl, /^https:\/\/www\.(centcom|africom|eucom|pacom|southcom)\.mil\//, rule.id);
    assert.ok(rule.sourceSection.length > 3, rule.id);
    assert.ok(["COMMAND PUBLICATION (PACK-EXTRACTED)", "COMMAND PUBLICATION — UNDER REWRITE"].includes(rule.verificationStatus), rule.id);
    if (rule.scope.level === "country") assert.ok(rule.scope.countries.length > 0, rule.id);
  }
  for (const policy of COMMAND_POLICIES) {
    assert.ok(policy.lastRetrievedAt);
    if (policy.commandMedicalPolicyStatus === "NOT_PUBLICLY_VERIFIED") assert.equal(policy.verificationStatus, "NOT PUBLICLY VERIFIED");
  }
  // The pack gives no INDOPACOM GENADMIN issue date or SOUTHCOM effective date: none may be fabricated.
  assert.equal(COMMAND_POLICIES.find((p) => p.policyId === "INDOPACOM-FY26-FHP-P-25-0295")?.sourceDate, null);
  assert.equal(COMMAND_POLICIES.find((p) => p.policyId === "SOUTHCOM-REG-40-501")?.effectiveFrom, null);
});

test("rule-class separation: command evidence never carries host-nation requirementType or CDC/WHO recommendationType", async () => {
  const kuwait = await commandPolicyAdapter(ctxFor("KW"));
  assert.equal(kuwait.status, "ok");
  assert.ok(kuwait.records.length > 20);
  for (const record of kuwait.records) {
    assert.equal(record.dimension, "command_policy");
    assert.equal(record.requirementType, null, record.id);
    assert.equal(record.recommendationType, null, record.id);
    assert.equal(record.extra?.ruleClass, "combatant_command");
    assert.match(String(record.geographyNote), /not host-nation entry law and not a CDC\/WHO recommendation/);
  }
  assert.ok(kuwait.records.some((r) => r.category === "command_assignment"));
  assert.ok(kuwait.records.some((r) => r.category === "command_policy_superseded"));
  // The host-nation engine holds no command rule and the command engine holds no host-nation rule.
  assert.ok(VACCINE_RULES.every((rule) => !/mod 18|aci 4200|eci 4202|reg 40-501|p-25-0295/i.test(`${rule.id} ${rule.sourceAuthority} ${rule.normalizedRule}`)));
  assert.ok(COMMAND_RULES.every((rule) => !/^(entry|exit|transit|event-specific)$/.test(rule.domain)));

  const canada = await commandPolicyAdapter(ctxFor("CA"));
  assert.equal(canada.records.filter((r) => r.category === "command_rule").length, 0);
  const policy = canada.records.find((r) => r.category === "command_policy");
  assert.equal(policy?.subtype, "not_publicly_verified");
  assert.match(policy?.title ?? "", /NOT PUBLICLY VERIFIED/);
  assert.match(canada.note ?? "", /NOT PUBLICLY VERIFIED/);

  const unassigned = await commandPolicyAdapter({ ...ctxFor("KW"), country: { ...resolveCountry("KW")!, iso3: "ZZZ" } });
  assert.equal(unassigned.status, "no_current_matching_finding");
  assert.equal(unassigned.records.length, 0);
});

test("source monitor: fingerprints command pages, flags change for review without rewriting rules, keeps last-known on failure", async () => {
  const store = createMemoryStore();
  const monitor = createCommandSourceMonitor();
  assert.ok(monitoredCommandUrls("KWT").some((target) => target.url.endsWith("MOD18FINALV2.pdf")));
  assert.ok(monitoredCommandUrls("KWT").some((target) => target.url === "https://www.centcom.mil/OPERATIONS-AND-EXERCISES/"), "the AOR list page is watched for reassignment");
  assert.equal((await monitor(ctxFor("KW"), store)).status, "not_configured", "no probe → not configured, never 'unchanged'");
  assert.equal((await monitor(ctxFor("CA", async () => probe("a")), store)).status, "ok", "NORTHCOM AOR page is watched");

  const first = await monitor(ctxFor("KW", async () => probe("aaa")), store);
  assert.equal(first.status, "ok");
  assert.ok(first.records.every((r) => r.subtype === "reachable"));
  const policyBefore = JSON.stringify(resolveCountryCommand("KWT").rules);

  const t2 = new Date(NOW.getTime() + 86_400_000);
  const changed = await monitor(ctxFor("KW", async () => probe("bbb"), t2), store);
  assert.ok(changed.records.every((r) => r.subtype === "content_changed"));
  assert.match(changed.records[0].summary, /NOT rewritten automatically/);
  assert.equal(JSON.stringify(resolveCountryCommand("KWT").rules), policyBefore, "rules are untouched by a detected change");

  const t3 = new Date(NOW.getTime() + 2 * 86_400_000);
  const down = await monitor(ctxFor("KW", async () => { throw new Error("fetch failed: certificate mismatch"); }, t3), store);
  assert.equal(down.status, "source_unavailable");
  const state = down.records[0].extra?.sourceCheck as { lastAttemptedFetch: string; lastSuccessfulFetch: string; sourceStatus: string; sourceError: string };
  assert.equal(state.lastAttemptedFetch, t3.toISOString());
  assert.equal(state.lastSuccessfulFetch, t2.toISOString(), "last good fetch retained");
  assert.match(state.sourceError, /certificate mismatch/);
  assert.equal(down.records[0].freshness, "STALE_CACHE");
});

test("pipeline: command policy is its own dimension and observation group, separate from host-nation vaccine evidence", async () => {
  const run = (iso2: string) => buildCountryIntel(iso2, {
    store: createMemoryStore(), now: () => NOW, env: () => undefined,
    internalJson: async (path: string) => { throw new Error(`Internal route returned HTTP 502 (${path})`); },
    externalJson: async () => { throw new Error("Source returned HTTP 503"); },
    probeUrl: async () => probe("h1"),
  });
  const kuwait = await run("KW");
  assert.ok(kuwait);
  const source = kuwait.sources.find((s) => s.sourceId === "command-medical-policy");
  assert.equal(source?.status, "ok");
  assert.equal(source?.dimension, "command_policy");
  assert.equal(kuwait.sources.find((s) => s.sourceId === "command-policy-source-monitor")?.status, "ok");
  const commandEvidence = kuwait.evidence.filter((r) => r.dimension === "command_policy");
  assert.ok(commandEvidence.length > 20);
  assert.ok(kuwait.evidence.filter((r) => r.dimension !== "command_policy").every((r) => r.extra?.ruleClass !== "combatant_command"), "no command record leaks into another dimension");
  const group = kuwait.whatMattersNow.observations.filter((o) => o.dimension === "command_policy");
  assert.ok(group.some((o) => /Kuwait is in the CENTCOM area of responsibility/.test(o.headline) && /separate from host-nation entry law and CDC\/WHO guidance/.test(o.detail)));
  assert.ok(group.some((o) => /waiver routing/i.test(o.headline)));
  assert.ok(group.some((o) => /SOURCE_GAP/.test(o.headline)));
  assert.ok(group.every((o) => o.evidenceIds.every((id) => kuwait.evidence.some((r) => r.id === id))), "observations cite real evidence");
  assert.ok(!group.some((o) => o.dimension !== "command_policy"));

  const israel = await run("IL");
  assert.ok(israel?.whatMattersNow.observations.some((o) => /previously in EUCOM until 2021-01-15/.test(o.headline)));

  const canada = await run("CA");
  assert.ok(canada?.whatMattersNow.observations.some((o) => o.dimension === "command_policy" && /NOT PUBLICLY VERIFIED/.test(o.headline)));
  assert.equal(canada?.evidence.filter((r) => r.category === "command_rule").length, 0);

  const poland = await run("PL");
  assert.ok(poland?.whatMattersNow.observations.some((o) => o.dimension === "command_policy" && /under rewrite/i.test(o.headline)));
  assert.ok(poland?.whatMattersNow.observations.some((o) => /country list is a normalized baseline \(LIVE VERIFY\)/.test(o.headline)));
});

test("AI validator: command policy is a third class that cannot be blended or turned into absence", async () => {
  const kuwait = (await commandPolicyAdapter(ctxFor("KW"))).records;
  const poland = (await commandPolicyAdapter(ctxFor("PL"))).records;
  const canada = (await commandPolicyAdapter(ctxFor("CA"))).records;
  const host: EvidenceRecord = { ...kuwait[0], id: "host-1", dimension: "health_vaccines", category: "entry_requirement", requirementType: "entry_required", recommendationType: null, extra: { verificationStatus: "DESTINATION-GOVERNMENT VERIFIED" } };
  const cdc: EvidenceRecord = { ...kuwait[0], id: "cdc-1", dimension: "health_vaccines", category: "travel_vaccine", requirementType: null, recommendationType: "recommended", extra: {} };
  const all = [...kuwait, ...poland, ...canada, host, cdc];
  const check = (text: string, ...ids: string[]) => validateStatements({ statements: [{ text, evidenceIds: ids }] }, all).statements.length === 1;
  const med = "command-rule:KWT:cc:medication-supply";
  const tbe = "command-rule:POL:eu:tbe";
  const noPolicy = "command-policy:CAN:NORTHCOM-NONE";

  assert.equal(check("A 90-day medication supply is required for deployments over 30 days under MOD 18.", med), true, "command requirement cited as a command requirement");
  assert.equal(check("A 90-day medication supply is required for deployments over 30 days under MOD 18.", med, host.id), false, "command + host-nation cannot share a statement");
  assert.equal(check("Command policy recommends the 90-day supply.", med), false, "command requirement restated as a recommendation");
  assert.equal(check("EUCOM publishes a tick-borne encephalitis vaccine recommendation memo.", tbe), true);
  assert.equal(check("Tick-borne encephalitis vaccination is required by EUCOM.", tbe), false, "command recommendation restated as a requirement");
  assert.equal(check("EUCOM recommends tick-borne encephalitis vaccination, and CDC recommends it too.", tbe, cdc.id), false, "command + CDC blended");
  assert.equal(check("USNORTHCOM command medical policy is NOT PUBLICLY VERIFIED.", noPolicy), true);
  assert.equal(check("USNORTHCOM has no medical policy.", noPolicy), false, "absence from missing data");
  assert.equal(check("There are no theater medical requirements for Canada.", noPolicy), false);
  assert.equal(check("Kuwait travel is safe for contractors under MOD 18.", med), false, "reassurance");
  assert.equal(check("The 99-day supply is required under MOD 18.", med), false, "ungrounded number");
});
