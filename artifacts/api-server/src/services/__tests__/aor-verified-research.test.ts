import assert from "node:assert/strict";
import test from "node:test";
import { assignmentFor, countriesForCommand } from "../aor-intel/command-policy/assignments";
import { auditRegistry } from "../aor-intel/command-policy/audit";
import { evaluateCommandTraveler } from "../aor-intel/command-policy/engine";
import { COMMAND_POLICIES, COMMAND_RULES } from "../aor-intel/command-policy/policies-data";
import { EUCOM_ENUMERATED_GROUPS, RESEARCH_EVIDENCE, DSCA_SECURITY_COOPERATION } from "../aor-intel/command-policy/verified-research";
import { RESEARCHED_MEDICAL_RULES } from "../aor-intel/command-policy/researched-medical-rules";
import { commandPolicyAdapter } from "../aor-intel/command-policy/adapter";
import { resolveCountry } from "../aor-intel/geo";
import type { CommandQuery } from "../aor-intel/command-policy/types";
const evaluate = (id: string, overrides: Partial<CommandQuery> = {}) => evaluateCommandTraveler({ iso3: "KOR", population: "us_military", stayDays: 31, component: "USARPAC", travelKind: "official_tdy_deployment", ...overrides }).evaluations.find(e => e.rule.id === `ip:usarpac:${id}`)!;

test("primary enumeration and dated entity evidence preserve former baseline without inferring counts", () => {
  const enumerated = Object.values(EUCOM_ENUMERATED_GROUPS).flat();
  assert.equal(new Set(enumerated).size, 50);
  assert.deepEqual([...enumerated].sort(), countriesForCommand("EUCOM").map(r => r.iso3).sort());
  assert.equal(assignmentFor("POL")?.previousEvidence?.[0].verification, "PUBLIC-SOURCE BASELINE — LIVE VERIFY");
  for (const iso3 of ["TWN", "PSE"]) {
    assert.equal(assignmentFor(iso3)?.entityEvidence, "primary_us_government_names_it");
    assert.ok(assignmentFor(iso3)?.previousEvidence?.length);
    assert.equal(assignmentFor(iso3)?.effectiveFrom, null);
  }
  assert.deepEqual(auditRegistry().entityEvidence.primaryUsGovernmentNamesIt.sort(), ["PSE", "TWN"]);
  assert.equal(assignmentFor("ESH")?.verification, "PUBLIC-SOURCE BASELINE — LIVE VERIFY");
});

test("security-cooperation codes cannot replace geographic AOR evidence or enumerate SOUTHCOM's 12", () => {
  const code = (name: string) => DSCA_SECURITY_COOPERATION.rows.find(r => r.sourceName === name)?.command;
  assert.equal(code("Western Sahara"), "AFRICOM");
  assert.equal(code("Cuba"), "NORTHCOM");
  assert.equal(assignmentFor("CUB")?.command, "SOUTHCOM");
  assert.equal(assignmentFor("GRL")?.command, "NORTHCOM");
  assert.equal(assignmentFor("AIA"), null);
  assert.equal(RESEARCH_EVIDENCE.find(r => r.id === "western-sahara-dsca")?.scope, "security_cooperation");
});

test("component guidance respects duration, population, official travel, exemptions and unknown risk", () => {
  assert.equal(evaluate("korea-jev", { stayDays: 30 }).applicability, "does_not_apply");
  assert.equal(evaluate("korea-jev").applicability, "applies");
  assert.equal(evaluate("g6pd", { component: "Navy" }).applicability, "does_not_apply");
  assert.equal(evaluate("g6pd", { component: null }).applicability, "unknown");
  assert.equal(evaluate("g6pd", { population: "dod_civilian" }).applicability, "does_not_apply");
  assert.equal(evaluate("waiver-process", { population: "dod_contractor" }).applicability, "unknown");
  assert.equal(evaluate("g6pd", { travelKind: "pcs" }).applicability, "does_not_apply");
  assert.equal(evaluate("g6pd", { iso3: "GUM", layoverInYfEndemicCountry: true }).applicability, "does_not_apply");
  assert.equal(evaluate("malaria-selection").applicability, "unknown");
  assert.equal(evaluate("korea-cbrn", { stayDays: 29 }).applicability, "does_not_apply");
  assert.equal(evaluate("korea-cbrn", { stayDays: 30 }).applicability, "applies");
  assert.equal(evaluate("korea-cbrn", { iso3: "JPN" }), undefined, "country-specific rule is excluded before evaluation");
  assert.equal(evaluate("osa-cpap").applicability, "unknown");
  assert.equal(evaluate("malaria-selection").rule.sourceSection, "USARPAC FHP handbook section 5-1(c)");
  assert.equal(evaluate("whole-blood", { stayDays: 30 }).applicability, "does_not_apply");
  assert.equal(evaluate("applicability", { stayDays: 30 }).applicability, "applies");
  assert.equal(evaluate("short-visit", { stayDays: 30 }).applicability, "unknown");
});

test("source dates, advisory authority and source error stay distinct from FY26 requirements", async () => {
  const current = COMMAND_POLICIES.find(p => p.command === "INDOPACOM")!;
  assert.equal(current.sourceDate, "2025-11-07");
  assert.equal(current.effectiveFrom, null);
  assert.equal(RESEARCHED_MEDICAL_RULES.length, 18);
  assert.ok(RESEARCHED_MEDICAL_RULES.every(r => r.sourceDate === "2025-03-01" && r.lastRetrievedAt === "2026-10-10" && r.sourceDocumentId === "USARPAC-FHP-2025-03-01" && r.caveats.some(c => /not an order/.test(c))));
  assert.ok(!RESEARCHED_MEDICAL_RULES.some(r => /anthrax/i.test(r.title)));
  assert.ok(RESEARCH_EVIDENCE.find(r => r.id === "usarpac-fhp-2025")?.conflicts.some(c => /Jynneos/.test(c)));
  assert.ok(COMMAND_RULES.some(r => r.id === "af:forms-routing"));
  const records = (await commandPolicyAdapter({ country: resolveCountry("KR")!, now: () => new Date("2026-10-10"), internalJson: async () => ({}), externalJson: async () => ({}), env: () => undefined })).records;
  const book = records.find(r => r.id.includes("ip:usarpac:g6pd"))!;
  assert.equal(book.publishedAt, "2025-03-01T00:00:00.000Z");
  assert.equal(book.retrievedAt, "2026-10-10T00:00:00.000Z");
  assert.match(book.sourceName, /USARPAC/);
});
