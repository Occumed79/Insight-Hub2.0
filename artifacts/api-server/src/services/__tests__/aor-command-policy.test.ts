import assert from "node:assert/strict";
import test from "node:test";
import { buildCountryIntel } from "../aor-intel/aggregate";
import { createMemoryStore } from "../aor-intel/cache";
import { auditRegistry } from "../aor-intel/command-policy/audit";
import { gapSummary, SOURCE_GAP_LEDGER } from "../aor-intel/command-policy/source-gaps";
import { AOR_COUNTRY_PROFILES } from "../../data/aor-country-profiles";
import { CANDIDATE_ENTITIES } from "../aor-intel/command-policy/candidate-entities";
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
  assert.deepEqual(entities, ["ASM:INDOPACOM", "ESH:AFRICOM", "GRL:NORTHCOM", "GUM:INDOPACOM", "MNP:INDOPACOM", "PRI:NORTHCOM", "PSE:CENTCOM", "TWN:INDOPACOM", "VIR:NORTHCOM"], "territories are separate from the sovereign count; no SOUTHCOM entity is an assignment");
  assert.equal(assignmentStats().byCommand.EUCOM.sovereign, 50);
  // LIVE VERIFY flags exactly where the pack says the one-page enumeration was not retrieved.
  const flagged = new Set(CURRENT_ASSIGNMENTS.filter((entry) => entry.geographicClass === "sovereign_state" && /LIVE VERIFY/.test(entry.verification)).map((entry) => entry.command));
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
  assert.match(directed?.missingInputs[0] ?? "", /command or contract directs/);
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
  assert.deepEqual(COMMAND_RULES.filter((rule) => rule.status === "non-waivable").map((rule) => rule.id).sort(), ["cc:imm:anthrax", "cc:taba:osa-symptomatic"], "only the two source-stated non-waivable items");
  assert.match(byId("cc:taba:tbi").conditionOrRequirement, /24 hours symptom-free/);
  assert.match(byId("cc:taba:weight").thresholdOrRule ?? "", /136 kg/);
  assert.match(byId("cc:imm:anthrax").caveats.join(" "), /confirm exact wording against the PDF/);
  assert.ok(byId("cc:imm:anthrax").sourceGaps.length > 0, "anthrax schedule is still open");
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

test("registry audit: 195 sovereign + 9 non-sovereign records by class, no duplicate current assignment, Israel's EUCOM record is history only", () => {
  const audit = auditRegistry(AOR_COUNTRY_PROFILES.map((entry) => ({ iso3: entry.iso3, country: entry.country })));
  assert.equal(audit.sovereignStates, 195);
  assert.equal(audit.territoriesDependenciesEntities, 9);
  assert.equal(audit.totalCurrentRecords, 204);
  assert.equal(audit.currentRows, 204, "one current row per place: no row is repeated");
  assert.deepEqual(audit.byClass, { sovereign_state: 195, territory: 5, dependency: 1, overseas_department: 0, autonomous_country: 0, collectivity: 0, area_of_special_sovereignty: 0, disputed_entity: 0, other_entity: 3, candidate_unverified: 0 });
  assert.equal(21 + 53 + 50 + 36 + 31 + 4, 195, "the per-command public counts sum to the sovereign total");
  assert.deepEqual(audit.duplicateCurrent, []);
  assert.deepEqual(audit.historicalOverlappingCurrent, []);
  assert.deepEqual(audit.unmappedSelectable, [], "every entry of the 197-row AOR country table resolves to a command");
  assert.equal(AOR_COUNTRY_PROFILES.length, 197);
  assert.deepEqual(audit.mappedMissingFromSelector.map((entry) => entry.iso3).sort(), ["ASM", "ESH", "GRL", "GUM", "MNP", "PRI", "VIR"], "mapped, but not selectable in the AOR country table");
  assert.deepEqual(audit.mappedMissingFromSelector.map((entry) => `${entry.iso3}:${entry.geographicClass}`).sort(), ["ASM:territory", "ESH:other_entity", "GRL:dependency", "GUM:territory", "MNP:territory", "PRI:territory", "VIR:territory"]);
  const expected: Record<CommandId, [number, number]> = { CENTCOM: [21, 1], AFRICOM: [53, 1], EUCOM: [50, 0], INDOPACOM: [36, 4], SOUTHCOM: [31, 0], NORTHCOM: [4, 3] };
  for (const [command, [sovereign, entities]] of Object.entries(expected)) {
    const row = audit.perCommand[command as CommandId];
    assert.equal(row.sovereign, sovereign, command);
    assert.equal(row.entities, entities, command);
    assert.equal(row.total, sovereign + entities, command);
    assert.equal(row.byClass.sovereign_state, sovereign, command);
    assert.equal(row.matchesPublicSovereignCount, true, command);
  }
  assert.deepEqual(audit.perCommand.NORTHCOM.byClass, { sovereign_state: 4, territory: 2, dependency: 1, overseas_department: 0, autonomous_country: 0, collectivity: 0, area_of_special_sovereignty: 0, disputed_entity: 0, other_entity: 0, candidate_unverified: 0 });
  assert.equal(audit.perCommand.INDOPACOM.byClass.other_entity, 1);
  assert.equal(audit.perCommand.INDOPACOM.byClass.territory, 3);
  assert.equal(audit.perCommand.SOUTHCOM.entities, 0);
  assert.equal(Object.values(audit.perCommand).reduce((total, row) => total + row.sovereign, 0), 195);
  assert.deepEqual(audit.liveVerifyCommands, ["EUCOM", "INDOPACOM"], "sovereign country-list LIVE VERIFY is unchanged");
  assert.deepEqual(audit.historical, [{ iso3: "ISR", name: "Israel", command: "EUCOM", effectiveTo: "2021-01-15", supersededBy: "CENTCOM" }]);
  assert.equal(CURRENT_ASSIGNMENTS.filter((row) => row.iso3 === "ISR").length, 1, "Israel has exactly one current assignment");
  assert.equal(CURRENT_ASSIGNMENTS.filter((row) => row.command === "EUCOM").some((row) => row.iso3 === "ISR"), false);

  // The audit really detects a second current assignment (guards against a vacuous pass).
  const egypt = CURRENT_ASSIGNMENTS.find((row) => row.iso3 === "EGY")!;
  const broken = auditRegistry([], [...CURRENT_ASSIGNMENTS, { ...egypt, command: "AFRICOM" }]);
  assert.deepEqual(broken.duplicateCurrent, [{ iso3: "EGY", commands: ["CENTCOM", "AFRICOM"] }]);
  const repeated = auditRegistry([], [...CURRENT_ASSIGNMENTS, egypt]);
  assert.deepEqual(repeated.duplicateCurrent.map((entry) => entry.iso3), ["EGY"], "the same place listed twice is also a duplicate");
});

test("geographic classes: non-sovereign places never inflate the sovereign count; SOUTHCOM's declared 12 are declared, not named, and candidates are never assignments", async () => {
  const audit = auditRegistry(AOR_COUNTRY_PROFILES.map((entry) => ({ iso3: entry.iso3, country: entry.country })));
  const classOf = (iso3: string) => assignmentFor(iso3)?.geographicClass;
  for (const iso3 of ["PRI", "VIR", "GUM", "ASM", "MNP"]) assert.equal(classOf(iso3), "territory", iso3);
  assert.equal(classOf("GRL"), "dependency");
  for (const iso3 of ["TWN", "PSE", "ESH"]) assert.equal(classOf(iso3), "other_entity", iso3);
  assert.equal(classOf("KWT"), "sovereign_state");
  for (const row of CURRENT_ASSIGNMENTS) {
    assert.equal(row.entityType === "sovereign", row.geographicClass === "sovereign_state", row.iso3);
    assert.notEqual(row.geographicClass, "candidate_unverified", `${row.iso3}: a candidate is never a current assignment`);
    if (row.geographicClass === "sovereign_state") assert.ok(row.classBasis === null && row.entityEvidence === null, row.iso3);
    else assert.ok(row.classBasis && row.entityEvidence, `${row.iso3} records why it is not a sovereign state`);
  }
  assert.equal(countriesForCommand("NORTHCOM").length, 4, "Greenland, Puerto Rico and USVI are not counted as NORTHCOM countries");
  assert.equal(countriesForCommand("INDOPACOM").length, 36, "Guam, American Samoa and CNMI are not counted as INDOPACOM countries");
  assert.equal(countriesForCommand("SOUTHCOM").length, 31);

  // INDOPACOM territories: named by command material, with the source age stated rather than hidden.
  for (const iso3 of ["GUM", "ASM", "MNP"]) {
    const row = assignmentFor(iso3)!;
    assert.equal(row.command, "INDOPACOM");
    assert.equal(row.entityEvidence, "command_page_names_it");
    assert.equal(row.sourceDate, null, "the fact sheet is undated; no date is invented");
    assert.match(row.sourceCurrencyNote ?? "", /no publication date/);
    assert.match(row.sourceCurrencyNote ?? "", /not treated as current/);
  }

  // SOUTHCOM: the official counts are preserved, but nothing is named, so nothing is assigned.
  assert.equal(CURRENT_ASSIGNMENTS.filter((row) => row.command === "SOUTHCOM" && row.geographicClass !== "sovereign_state").length, 0, "no SOUTHCOM entity is an assignment");
  const south = audit.perCommand.SOUTHCOM;
  assert.equal(south.officialCurrentCountryCount, 31);
  assert.equal(south.officialCurrentDependencyOrSpecialAreaCount, 12);
  assert.equal(south.verifiedNamedDependencyCount, 0);
  assert.deepEqual(audit.declaredButUnenumerated, [{ command: "SOUTHCOM", officialDeclared: 12, verifiedNamed: 0, shortfall: 12, wording: "31 countries and 12 dependencies and areas of special sovereignty" }]);
  assert.equal(south.entityCoverageStatus, "INCOMPLETE_LIVE_VERIFY");
  assert.deepEqual(audit.entityLiveVerifyCommands, ["EUCOM", "INDOPACOM", "SOUTHCOM"]);
  assert.deepEqual([...audit.entityEvidence.commandPageNamesIt].sort(), ["ASM", "GRL", "GUM", "MNP", "PRI", "VIR"]);
  assert.deepEqual([...audit.entityEvidence.packOnly].sort(), ["ESH", "PSE", "TWN"]);
  assert.equal(audit.perCommand.INDOPACOM.verifiedNamedEntities, 3);
  assert.equal(audit.perCommand.NORTHCOM.verifiedNamedDependencyCount, 1);

  // Official counts: EUCOM 50 and INDOPACOM 36 are resolved; membership lists remain LIVE VERIFY.
  assert.equal(audit.perCommand.EUCOM.officialCurrentCountryCount, 50);
  assert.equal(audit.perCommand.INDOPACOM.officialCurrentCountryCount, 36);
  assert.deepEqual(audit.liveVerifyCommands, ["EUCOM", "INDOPACOM"]);
  assert.deepEqual(audit.sourceConflicts.map((c) => `${c.command}:${c.value}:${c.resolution}`).sort(), ["INDOPACOM:38:RESOLVED_TOWARD_CURRENT_COUNT", "SOUTHCOM:16:RETAINED_AS_HISTORICAL_EVIDENCE"]);
  assert.equal(audit.sourceConflicts.find((c) => c.command === "SOUTHCOM")?.sourceDate, "2016-03-10", "the older SOUTHCOM figure keeps its date");

  // Candidates: held apart, never counted, never resolvable as an assignment.
  assert.equal(audit.candidates.count, 12);
  assert.equal(audit.candidates.isOfficialAssignment, false);
  assert.ok(CANDIDATE_ENTITIES.every((c) => c.geographicClass === "candidate_unverified" && c.status === "LIVE_VERIFY" && c.isOfficialAssignment === false));
  for (const c of CANDIDATE_ENTITIES) {
    assert.equal(assignmentFor(c.iso3), null, `${c.iso3} must not resolve to an assignment`);
    assert.equal(CURRENT_ASSIGNMENTS.some((row) => row.iso3 === c.iso3), false, c.iso3);
  }
  const candidate = (iso3: string) => CANDIDATE_ENTITIES.find((c) => c.iso3 === iso3)!;
  assert.equal(candidate("GUF").referenceClass, "overseas_department", "French Guiana is not flattened to dependency");
  assert.match(candidate("GUF").referenceClassBasis, /first-order administrative division of overseas France/);
  assert.notEqual(candidate("GUF").referenceClass, "dependency");
  assert.ok(CANDIDATE_ENTITIES.every((c) => c.referenceClass !== "dependency"), "no candidate is asserted to be a dependency");
  const asPlace = (iso3: string, name: string) => ({ ...ctxFor("KW"), country: { ...resolveCountry("KW")!, iso3, name } });
  const unassigned = await commandPolicyAdapter(asPlace("GUF", "French Guiana"));
  assert.equal(unassigned.status, "no_current_matching_finding");
  assert.equal(unassigned.records.length, 0, "a candidate yields no command evidence");
  assert.equal(resolveCountryCommand("AIA").assigned, false);

  // Assignment evidence says "not a sovereign state" for a non-sovereign place, and nothing for a sovereign one.
  const pri = (await commandPolicyAdapter(asPlace("PRI", "Puerto Rico"))).records.find((r) => r.category === "command_assignment");
  assert.match(pri?.title ?? "", /Puerto Rico \(territory, not a sovereign state\)/);
  assert.equal(pri?.extra?.geographicClass, "territory");
  const grl = (await commandPolicyAdapter(asPlace("GRL", "Greenland"))).records.find((r) => r.category === "command_assignment");
  assert.match(grl?.title ?? "", /Greenland \(dependency, not a sovereign state\)/);
  const gum = (await commandPolicyAdapter(asPlace("GUM", "Guam"))).records.find((r) => r.category === "command_assignment");
  assert.match(gum?.title ?? "", /Guam \(territory, not a sovereign state\).*Indo-Pacific Command/);
  assert.match(gum?.summary ?? "", /Source age:.*not treated as current/);
  const kwt = (await commandPolicyAdapter(ctxFor("KW"))).records.find((r) => r.category === "command_assignment");
  assert.doesNotMatch(kwt?.title ?? "", /not a sovereign state/);
  assert.equal(kwt?.extra?.geographicClass, "sovereign_state");
});

test("source-gap ledger: CENTCOM immunizations, AFRICOM Yellow Fever and the NORTHCOM/CENTCOM/AFRICOM entity reviews resolved; unreadable items stay LIVE VERIFY with nothing invented", () => {
  const summary = gapSummary();
  assert.deepEqual(summary.resolved.sort(), ["africom-yellow-fever-scope", "centcom-africom-entities", "centcom-immunization-detail", "northcom-entities"]);
  assert.deepEqual(summary.openLiveVerify.sort(), ["eucom-country-list", "eucom-indopacom-entities", "indopacom-country-list", "indopacom-message-date", "southcom-dependencies"]);
  assert.ok(SOURCE_GAP_LEDGER.every((entry) => ["2026-10-08", "2026-10-10"].includes(String(entry.attemptedAt)) && entry.sources.every((url) => url.startsWith("https://"))));
  for (const entry of SOURCE_GAP_LEDGER.filter((e) => e.status === "OPEN_LIVE_VERIFY")) assert.ok(entry.remaining.length > 0, entry.id);
  assert.equal(COMMAND_POLICIES.find((p) => p.policyId === "INDOPACOM-FY26-FHP-P-25-0295")?.sourceDate, null, "the Dec 2023 page footer is not used as the message date");
  assert.ok(CURRENT_ASSIGNMENTS.filter((row) => row.geographicClass === "sovereign_state" && (row.command === "EUCOM" || row.command === "INDOPACOM")).every((row) => /LIVE VERIFY/.test(row.verification)));
  for (const id of SOURCE_GAP_LEDGER.find((e) => e.id === "centcom-immunization-detail")!.ruleIds) assert.ok(COMMAND_RULES.some((rule) => rule.id === id), id);
  assert.ok(summary.deferred.fields > 0 && summary.deferred.byCommand.AFRICOM, "other rule-level SOURCE_GAP fields remain and are counted, not hidden");
});

test("CENTCOM MOD 18 immunizations: apply for any period in theater, with source-stated triggers only", () => {
  const mil = { iso3: "KWT", population: "us_military" as const };
  assert.equal(evalRule({ ...mil, stayDays: 5 }, "cc:imm:tdap")?.applicability, "applies", "MOD 18 9.b: any period of time in theater");
  assert.equal(evalRule({ ...mil, stayDays: 5 }, "cc:medication-supply")?.applicability, "does_not_apply", "while the >30-day rules stay gated");
  assert.equal(evalRule({ ...mil, stayDays: 14 }, "cc:imm:anthrax")?.applicability, "does_not_apply");
  assert.equal(evalRule({ ...mil, stayDays: 15 }, "cc:imm:anthrax")?.applicability, "applies", "15 consecutive days or longer");
  assert.equal(evalRule({ iso3: "KWT", population: "dod_contractor", stayDays: 40 }, "cc:imm:anthrax")?.applicability, "unknown", "contractors only as directed in the contract");
  assert.equal(evalRule({ iso3: "KWT", population: "volunteer", stayDays: 40 }, "cc:imm:anthrax")?.applicability, "does_not_apply", "volunteers: voluntary");
  const anthrax = COMMAND_RULES.find((rule) => rule.id === "cc:imm:anthrax")!;
  assert.equal(anthrax.status, "non-waivable");
  assert.match(anthrax.waiverAuthority ?? "", /cannot waive/);
  // Country-scoped rules appear only where the source names the country.
  const rulesFor = (iso3: string) => resolveCountryCommand(iso3).rules.map((rule) => rule.id);
  assert.ok(rulesFor("AFG").includes("cc:imm:polio-afg-pak") && rulesFor("PAK").includes("cc:imm:polio-afg-pak"));
  assert.ok(!rulesFor("KWT").includes("cc:imm:polio-afg-pak") && !rulesFor("KWT").includes("cc:imm:rabies-pakistan"));
  assert.ok(rulesFor("PAK").includes("cc:imm:rabies-pakistan") && !rulesFor("AFG").includes("cc:imm:rabies-pakistan"));
  for (const iso3 of ["AFG", "PAK", "YEM"]) assert.ok(rulesFor(iso3).includes("cc:imm:malaria-year-round"), iso3);
  assert.ok(!rulesFor("IRQ").includes("cc:imm:malaria-year-round"));
  assert.equal(evalRule({ iso3: "AFG", population: "us_military", stayDays: 27 }, "cc:imm:polio-afg-pak")?.applicability, "does_not_apply");
  assert.equal(evalRule({ iso3: "AFG", population: "us_military", stayDays: 28 }, "cc:imm:polio-afg-pak")?.applicability, "applies", "4 weeks or more");
  assert.match(COMMAND_RULES.find((rule) => rule.id === "cc:imm:smallpox")!.conditionOrRequirement, /16 May 2014.*no longer required/);
  assert.match(COMMAND_RULES.find((rule) => rule.id === "cc:imm:covid19")!.caveats.join(" "), /host-nation requirements, which are a separate rule class/);
  assert.match(COMMAND_RULES.find((rule) => rule.id === "cc:waiver-religious")!.conditionOrRequirement, /denied/);
  assert.match(COMMAND_RULES.find((rule) => rule.id === "cc:waiver-process")!.thresholdOrRule ?? "", /60 days/);
  assert.ok(COMMAND_RULES.filter((rule) => rule.id.startsWith("cc:imm:")).every((rule) => rule.policyId === "CENTCOM-MOD18" && rule.sourceSection.startsWith("MOD 18 para")));
  assert.equal(COMMAND_RULES.some((rule) => rule.id === "cc:immunization-prophylaxis"), false, "the placeholder SOURCE_GAP rule is gone");
});

test("AFRICOM Yellow Fever: single lifetime dose for all AOR countries except Comoros, Morocco, Tunisia (no YF-endemic layover)", () => {
  const rule = COMMAND_RULES.find((r) => r.id === "af:supplement:yellow-fever")!;
  assert.equal(rule.sourceDate, "2024-06-14");
  assert.deepEqual(rule.exemptCountries, ["COM", "MAR", "TUN"]);
  assert.match(rule.thresholdOrRule ?? "", /10 days/);
  assert.match(rule.requiredDocumentation ?? "", /CDC 731/);
  assert.match(rule.caveats.join(" "), /July 2017/);
  assert.match(rule.caveats.join(" "), /Dependents, retirees/);
  const mil = { population: "us_military" as const };
  assert.equal(evalRule({ iso3: "KEN", ...mil }, "af:supplement:yellow-fever")?.applicability, "applies");
  assert.equal(evalRule({ iso3: "GHA", ...mil, layoverInYfEndemicCountry: false }, "af:supplement:yellow-fever")?.applicability, "applies", "not an exempt country");
  for (const iso3 of ["COM", "MAR", "TUN"]) {
    const noInput = evalRule({ iso3, ...mil }, "af:supplement:yellow-fever");
    assert.equal(noInput?.applicability, "unknown", iso3);
    assert.match(noInput?.missingInputs[0] ?? "", /layover/);
    assert.equal(evalRule({ iso3, ...mil, layoverInYfEndemicCountry: false }, "af:supplement:yellow-fever")?.applicability, "does_not_apply", iso3);
    assert.equal(evalRule({ iso3, ...mil, layoverInYfEndemicCountry: true }, "af:supplement:yellow-fever")?.applicability, "applies", `${iso3} with an endemic layover`);
  }
  assert.equal(evalRule({ iso3: "KEN", population: "interagency" }, "af:supplement:yellow-fever")?.applicability, "does_not_apply", "the message names DoD personnel");
  assert.equal(resolveCountryCommand("EGY").rules.some((r) => r.id === "af:supplement:yellow-fever"), false, "Egypt is CENTCOM, not AFRICOM");
});

test("validator: the AFRICOM Yellow Fever command rule can be called required, but not blended with CDC or host-nation records", async () => {
  const kenya = (await commandPolicyAdapter(ctxFor("KE"))).records;
  const cdc: EvidenceRecord = { ...kenya[0], id: "cdc-yf", dimension: "health_vaccines", category: "travel_vaccine", requirementType: null, recommendationType: "recommended", extra: {} };
  const all = [...kenya, cdc];
  const id = "command-rule:KEN:af:supplement:yellow-fever";
  const check = (text: string, ...ids: string[]) => validateStatements({ statements: [{ text, evidenceIds: ids }] }, all).statements.length === 1;
  assert.equal(check("A single lifetime yellow fever vaccine dose is required for entry to the AFRICOM theater.", id), true);
  assert.equal(check("A single lifetime yellow fever vaccine dose is required for entry to the AFRICOM theater, and CDC recommends it.", id, cdc.id), false);
  assert.equal(check("AFRICOM recommends yellow fever vaccination.", id), false, "command requirement restated as a recommendation");
});
