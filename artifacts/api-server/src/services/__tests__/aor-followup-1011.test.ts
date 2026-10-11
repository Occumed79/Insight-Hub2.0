import assert from "node:assert/strict";
import test from "node:test";
import { assignmentFor, CURRENT_ASSIGNMENTS } from "../aor-intel/command-policy/assignments";
import { auditRegistry } from "../aor-intel/command-policy/audit";
import { evaluateCommandTraveler } from "../aor-intel/command-policy/engine";
import { COMMAND_POLICIES, COMMAND_RULES } from "../aor-intel/command-policy/policies-data";
import { SOUTHCOM_CLASS_DEVIATION_RULES } from "../aor-intel/command-policy/contractor-clause-rules";
import { gapSummary, SOURCE_GAP_LEDGER } from "../aor-intel/command-policy/source-gaps";
import { RESEARCH_EVIDENCE } from "../aor-intel/command-policy/verified-research";

const ev = (query: Parameters<typeof evaluateCommandTraveler>[0], id: string) => evaluateCommandTraveler(query).evaluations.find((e) => e.rule.id === id);

test("SOUTHCOM contractor class-deviation rules are conditional, dated, and kept apart from SC Reg 40-501 rules", () => {
  assert.equal(SOUTHCOM_CLASS_DEVIATION_RULES.length, 3);
  for (const rule of SOUTHCOM_CLASS_DEVIATION_RULES) {
    assert.ok(COMMAND_RULES.some((r) => r.id === rule.id), rule.id);
    assert.equal(rule.sourceDate, "2014-10-06");
    assert.deepEqual(rule.applicabilityPopulation, ["dod_contractor", "tcn"]);
    assert.ok(rule.applicabilityConditions?.some((c) => /class deviation 2014-00016/.test(c)), "applies only where the clause is in the contract");
    assert.ok(rule.caveats.some((c) => /not a SOUTHCOM instruction/.test(c) && /Whether it has since been incorporated or rescinded was not checked/.test(c)));
    assert.ok(rule.sourceGaps.some((g) => /incorporated.*rescinded/.test(g)));
    assert.match(rule.issuingAuthority ?? "", /Defense Procurement and Acquisition Policy/);
  }
  const contractor = { iso3: "COL", population: "dod_contractor" as const, stayDays: 10, travelKind: "official_tdy_deployment" as const };
  assert.equal(ev(contractor, "sc:dpap:fitness-screening")?.applicability, "unknown", "contract clause not confirmed: stays conditional, not universal");
  assert.equal(ev({ ...contractor, population: "us_military" }, "sc:dpap:fitness-screening")?.applicability, "does_not_apply", "no requirement for military personnel");
  assert.equal(ev({ ...contractor, population: "dod_civilian" }, "sc:dpap:immunization-and-icv")?.applicability, "does_not_apply");
  assert.equal(ev({ ...contractor, iso3: "KWT" }, "sc:dpap:fitness-screening"), undefined, "a SOUTHCOM rule never reaches another command's country");
  // The class deviation does not replace or overwrite the SC Reg 40-501 rules it points to.
  assert.ok(COMMAND_RULES.some((r) => r.id === "sc:mod3-fitness") && COMMAND_RULES.some((r) => r.id === "sc:waiver-process"));
  assert.ok(RESEARCH_EVIDENCE.some((r) => r.id === "southcom-class-deviation" && r.publicationDate === "2014-10-06" && r.conflicts.some((c) => /2014/.test(c))));
});

test("AFRICOM parent-instruction listing conflict and the Ascension Island exception are evidence, not executed rules", () => {
  const listing = RESEARCH_EVIDENCE.find((r) => r.id === "africom-aci-version-listing")!;
  assert.match(listing.sourceWording, /4200\.09B/);
  assert.ok(listing.conflicts.some((c) => /4200\.09C/.test(c)));
  assert.equal(COMMAND_POLICIES.find((p) => p.policyId === "AFRICOM-ACI-4200.09C")?.sourceDate, "2026-06-01", "the registry label is not silently rewritten");
  const ascension = RESEARCH_EVIDENCE.find((r) => r.id === "africom-yf-ascension")!;
  assert.equal(ascension.publicationDate, "2018-07-27");
  assert.ok(ascension.conflicts.some((c) => /not executed|Historical evidence only/.test(c)));
  assert.equal(COMMAND_RULES.some((r) => /ascension/i.test(`${r.id} ${r.title}`)), false);
  const open = new Set(gapSummary().openLiveVerify);
  assert.ok(open.has("africom-aci-version") && open.has("africom-yf-ascension"));
});

test("geographic gaps stay open with attempts recorded: INDOPACOM roster, SOUTHCOM 12, Western Sahara", () => {
  const entry = (id: string) => SOURCE_GAP_LEDGER.find((e) => e.id === id)!;
  for (const id of ["indopacom-country-list", "southcom-dependencies", "centcom-africom-entities"]) {
    assert.equal(entry(id).status, "OPEN_LIVE_VERIFY", id);
    assert.equal(entry(id).attemptedAt, "2026-10-11", id);
    assert.match(entry(id).outcome, /2026-10-11 follow-up/, id);
    assert.ok(entry(id).remaining.length > 0, id);
  }
  assert.match(entry("indopacom-country-list").outcome, /built from proximity/);
  assert.match(entry("southcom-dependencies").outcome, /remain unnamed and unverified/);
  assert.match(entry("centcom-africom-entities").outcome, /geographic command responsibility \(unverified, pack-only\)/);
  const audit = auditRegistry();
  assert.equal(audit.sovereignStates, 195);
  assert.equal(audit.perCommand.INDOPACOM.sovereign, 36);
  assert.equal(audit.perCommand.INDOPACOM.officialCurrentCountryCount, 36);
  assert.equal(audit.perCommand.SOUTHCOM.verifiedNamedDependencyCount, 0);
  assert.equal(audit.perCommand.SOUTHCOM.officialCurrentDependencyOrSpecialAreaCount, 12);
  assert.equal(CURRENT_ASSIGNMENTS.filter((r) => r.command === "SOUTHCOM").length, 31);
  assert.equal(assignmentFor("ESH")?.geographicClass, "disputed_entity");
  assert.equal(audit.sovereignStates + audit.territoriesDependenciesEntities, audit.totalCurrentRecords, "non-sovereign records are counted apart from sovereign states");
});
