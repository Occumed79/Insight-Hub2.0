import test from "node:test";
import assert from "node:assert/strict";
import { CROSSWALK_ROWS, DIRECTORY_ROWS } from "../aor-intel/command-policy/global-directory-rows";
import {
  COMMAND_ALIASES, classOfCategory, commandIdFromLabel, compareControl, integrateDirectory, recordIdOf, resolveClaims, SPLIT_PARENTS, WORKBOOK_COMMAND_IDS, type Claim,
} from "../aor-intel/command-policy/global-directory";
import {
  assignmentFor, assignmentHistoryFor, COMMAND_NAMES, CURRENT_ASSIGNMENTS, DIRECTORY_INTEGRATION_REPORT, LOCATION_INDEX, locationsUnderParent, resolveLocation,
} from "../aor-intel/command-policy/assignments";
import { auditRegistry } from "../aor-intel/command-policy/audit";
import { COMMAND_RULES } from "../aor-intel/command-policy/policies-data";
import { RESEARCHED_MEDICAL_RULES } from "../aor-intel/command-policy/researched-medical-rules";
import { SOUTHCOM_CLASS_DEVIATION_RULES } from "../aor-intel/command-policy/contractor-clause-rules";
import { evaluateCommandTraveler, resolveCountryCommand } from "../aor-intel/command-policy/engine";
import { commandPolicyAdapter } from "../aor-intel/command-policy/adapter";
import { resolveCountry } from "../aor-intel/geo";
import type { CommandId, CountryAorAssignment, DirectoryDetail } from "../aor-intel/command-policy/types";

const COMMANDS: CommandId[] = ["CENTCOM", "AFRICOM", "EUCOM", "INDOPACOM", "SOUTHCOM", "NORTHCOM"];
const detail = (row: CountryAorAssignment) => row.directory as DirectoryDetail;
const resolved = (query: string) => {
  const r = resolveLocation(query);
  assert.equal(r.status, "resolved", query);
  return (r as Extract<typeof r, { status: "resolved" }>).record;
};

test("1. all 285 directory records are imported and every one resolves, by id, by name and by its workbook code", () => {
  assert.equal(DIRECTORY_ROWS.length, 285);
  assert.equal(DIRECTORY_ROWS.filter((r) => r.origin === "ISO 3166-1").length, 246);
  assert.equal(DIRECTORY_ROWS.filter((r) => r.origin === "Additional GENC / constituent territory").length, 23);
  assert.equal(DIRECTORY_ROWS.filter((r) => r.origin === "ISO constituent geography (parent crosswalk)").length, 16);
  const mapped = CURRENT_ASSIGNMENTS.filter((r) => r.directory);
  assert.equal(mapped.length, 285, "every current record carries its directory detail; there is no second registry");
  assert.equal(CURRENT_ASSIGNMENTS.length, 285);
  for (const row of DIRECTORY_ROWS) {
    const id = recordIdOf(row);
    const byId = resolved(id);
    assert.equal(byId.iso3, id);
    assert.equal(resolved(row.name).iso3, id, `${row.name} resolves by name`);
    if (row.iso3) assert.equal(resolved(row.iso3).iso3, id, `${row.name} resolves by workbook code ${row.iso3}`);
    assert.equal(assignmentFor(id)?.iso3, id);
  }
  assert.equal(LOCATION_INDEX.droppedAliasCollisions.length, 0, "no ambiguous alias is silently guessed");
  assert.equal(DIRECTORY_INTEGRATION_REPORT.added.length + DIRECTORY_INTEGRATION_REPORT.enriched.length, 285);
  assert.equal(resolved("XKS").iso3, "XKX", "Kosovo: the workbook's XKS and the registry's XKX are one record");
});

test("2/3. every record has exactly one primary AOR; MULTIPLE, lists and blanks never appear", () => {
  const ids = CURRENT_ASSIGNMENTS.map((r) => r.iso3);
  assert.equal(new Set(ids).size, ids.length, "no duplicate record id, so no conflicting lookup path");
  for (const row of CURRENT_ASSIGNMENTS) {
    assert.ok(COMMANDS.includes(row.command), `${row.iso3} has one internal command id`);
    assert.equal(typeof row.command, "string");
    assert.doesNotMatch(String(row.command), /MULTIPLE|[,;/&]|\band\b/i, row.iso3);
  }
  for (const r of DIRECTORY_ROWS) {
    assert.doesNotMatch(`${r.workbookAor} ${r.appAlias}`, /MULTIPLE/i, r.name);
    assert.ok(r.workbookAor.trim().length > 0, r.name);
    const command = commandIdFromLabel(r.workbookAor);
    assert.ok(command, `${r.name}: ${r.workbookAor} maps to an internal command`);
    assert.equal(commandIdFromLabel(r.appAlias), command, `${r.name}: the workbook's own app alias agrees with its primary AOR`);
  }
  assert.equal(auditRegistry().directory.multipleOrBlankAor, 0);
  assert.deepEqual(auditRegistry().duplicateCurrent, []);
  // Workbook names → internal ids, with compatibility aliases preserved.
  assert.equal(WORKBOOK_COMMAND_IDS.USPACOM, "INDOPACOM");
  assert.ok(COMMAND_ALIASES.INDOPACOM.includes("PACOM") && COMMAND_ALIASES.INDOPACOM.includes("USPACOM"));
  assert.equal(commandIdFromLabel("INDOPACOM / PACOM"), "INDOPACOM");
});

test("4. the three split ISO parents have no AOR of their own and resolve through all 16 crosswalk constituents", () => {
  assert.equal(CROSSWALK_ROWS.length, 16);
  for (const code of ["USA", "UMI", "ATF"]) {
    assert.equal(assignmentFor(code), null, `${code} has no inherited AOR`);
    assert.equal(CURRENT_ASSIGNMENTS.some((r) => r.iso3 === code), false);
    const r = resolveLocation(code);
    assert.equal(r.status, "ambiguous_parent", code);
    const eng = resolveCountryCommand(code);
    assert.equal(eng.assigned, false);
    assert.equal(eng.command, null);
    assert.equal(eng.commandMedicalPolicyStatus, "LOCATION_AMBIGUOUS");
    assert.equal(eng.rules.length, 0, "no command rules are applied to an ambiguous parent");
    assert.ok(eng.ambiguousParent && eng.ambiguousParent.constituents.length > 1);
  }
  assert.equal(locationsUnderParent("USA").length, 3);
  assert.equal(locationsUnderParent("UMI").length, 9);
  assert.equal(locationsUnderParent("ATF").length, 4);
  // The crosswalk and the roster agree one-to-one on command and constituent.
  for (const cw of CROSSWALK_ROWS) {
    const row = locationsUnderParent(cw.parentIso3).find((r) => r.name === cw.segment);
    assert.ok(row, `${cw.segment} is a constituent of ${cw.parentIso3}`);
    assert.equal(row!.command, commandIdFromLabel(cw.workbookAor), cw.segment);
    assert.equal(detail(row!).parentIso3, cw.parentIso3);
    assert.equal(detail(row!).parentIso2, cw.parentIso2);
    assert.equal(detail(row!).workbookEvidence, cw.evidence, "the crosswalk's evidence label is retained");
    assert.equal(detail(row!).workbookSourceUrl, cw.sourceUrl);
    assert.equal(detail(row!).splitParent, true);
  }
  for (const code of ["USA", "UMI", "ATF"]) assert.equal(SPLIT_PARENTS[code].iso3, code);
  // Generic parent names, ISO2 and ISO3 never inherit a command.
  for (const q of ["United States", "United States of America", "US", "UM", "TF", "French Southern Territories", "U.S. Minor Outlying Islands"]) assert.equal(resolveLocation(q).status, "ambiguous_parent", q);
  // The adapter says so plainly instead of returning one command's policy.
  const ctx = (iso3: string) => ({ country: { ...resolveCountry("KW")!, iso3, name: "United States" }, now: () => new Date("2026-10-11T00:00:00Z") }) as unknown as Parameters<typeof commandPolicyAdapter>[0];
  return commandPolicyAdapter(ctx("USA")).then((result) => {
    assert.equal(result.records.length, 0);
    assert.match(result.note ?? "", /not assigned to one geographic combatant command/);
  });
});

test("5. Hawaii resolves separately from the contiguous United States and Alaska", () => {
  assert.equal(resolved("Hawaii").command, "INDOPACOM");
  assert.equal(resolved("Alaska").command, "NORTHCOM");
  assert.equal(resolved("Washington, DC").command, "NORTHCOM");
  assert.equal(resolved("Texas").command, "NORTHCOM");
  assert.equal(resolved("Contiguous United States").command, "NORTHCOM");
  assert.notEqual(resolved("Hawaii").iso3, resolved("Texas").iso3);
  assert.equal(resolved("Hawaii").geographicClass, "sovereign_component");
  assert.match(resolved("Hawaii").directory!.workbookNote ?? "", /not NORTHCOM/);
  assert.equal(resolved("Georgia").iso3, "GEO", "Georgia the country is not swallowed by a US-state alias");
  assert.equal(resolved("Guam").command, "INDOPACOM");
  // Alaska-based PACOM forces are an operational note, not a second AOR.
  assert.ok(detail(resolved("Alaska")).conflictHistory.some((c) => /Alaska-based forces/.test(c.claim) && /not the geographic AOR/.test(c.reason)));
  // The United States is counted once, as a composite sovereign state.
  const audit = auditRegistry();
  assert.deepEqual(audit.compositeSovereignParents, [{ iso3: "USA", name: "United States", commands: ["INDOPACOM", "NORTHCOM"] }]);
});

test("6. Navassa Island is its own provisional NORTHCOM record, distinct from the Pacific U.S. Minor Outlying Islands", () => {
  const navassa = resolved("Navassa Island");
  assert.equal(navassa.command, "NORTHCOM");
  assert.equal(detail(navassa).evidenceClass, "provisional");
  assert.equal(detail(navassa).provisional, true);
  assert.equal(detail(navassa).parentIso3, "UMI");
  assert.match(detail(navassa).workbookNote ?? "", /confirm with FCG/);
  assert.equal(detail(navassa).disputedSovereignty, true);
  const pacific = locationsUnderParent("UMI").filter((r) => r.iso3 !== navassa.iso3);
  assert.deepEqual(pacific.map((r) => r.name).sort(), ["Baker Island", "Howland Island", "Jarvis Island", "Johnston Atoll", "Kingman Reef", "Midway Atoll", "Palmyra Atoll", "Wake Island"]);
  for (const r of pacific) {
    assert.equal(r.command, "INDOPACOM", r.name);
    assert.equal(detail(r).provisional, false, r.name);
    assert.equal(detail(r).evidenceClass, "regional_inference", `${r.name}: geographic mapping, not an individually named assignment`);
  }
  assert.equal(resolved("Wake").command, "INDOPACOM");
});

test("7. French Southern Territories resolve at constituent level, never as one parent AOR", () => {
  const expected: Record<string, CommandId> = {
    "French Southern Territories — Amsterdam and Saint Paul Islands": "INDOPACOM",
    "French Southern Territories — Crozet Islands": "AFRICOM",
    "French Southern Territories — Kerguelen Islands": "INDOPACOM",
    "French Southern Territories — Îles Éparses": "AFRICOM",
  };
  const kids = locationsUnderParent("ATF");
  assert.deepEqual(Object.fromEntries(kids.map((r) => [r.name, r.command])), expected);
  assert.equal(resolved("Crozet").command, "AFRICOM");
  assert.equal(resolved("Kerguelen Islands").command, "INDOPACOM");
  assert.equal(resolved("Tromelin").command, "AFRICOM", "Îles Éparses members named in the directory note resolve to the Éparses record");
  assert.equal(resolved("Iles Eparses").iso3, resolved("Europa").iso3);
  assert.equal(resolved("Amsterdam and Saint Paul Islands").command, "INDOPACOM");
  assert.ok(kids.every((r) => detail(r).idKind === "synthetic" && r.iso3.startsWith("GEO:")), "no ISO code is invented for a constituent that has none");
  assert.equal(resolveLocation("ATF").status, "ambiguous_parent");
});

test("8. territorial assignments are not inherited from the governing country", () => {
  const differs: Array<[string, CommandId, string, CommandId]> = [
    ["GRL", "NORTHCOM", "DNK", "EUCOM"], ["FRO", "EUCOM", "DNK", "EUCOM"],
    ["GUF", "SOUTHCOM", "FRA", "EUCOM"], ["REU", "AFRICOM", "FRA", "EUCOM"], ["MYT", "AFRICOM", "FRA", "EUCOM"], ["PYF", "INDOPACOM", "FRA", "EUCOM"], ["NCL", "INDOPACOM", "FRA", "EUCOM"],
    ["AIA", "SOUTHCOM", "GBR", "EUCOM"], ["IOT", "AFRICOM", "GBR", "EUCOM"], ["BMU", "NORTHCOM", "GBR", "EUCOM"], ["PCN", "INDOPACOM", "GBR", "EUCOM"],
    ["ABW", "SOUTHCOM", "NLD", "EUCOM"], ["PRI", "NORTHCOM", "CAN", "NORTHCOM"], ["GUM", "INDOPACOM", "AUS", "INDOPACOM"],
    ["BVT", "AFRICOM", "NOR", "EUCOM"], ["HMD", "INDOPACOM", "AUS", "INDOPACOM"],
  ];
  for (const [territory, tc, sovereign, sc] of differs) {
    assert.equal(assignmentFor(territory)?.command, tc, territory);
    assert.equal(assignmentFor(sovereign)?.command, sc, sovereign);
  }
  assert.equal(assignmentFor("GUM")?.command, "INDOPACOM");
  // The mapping is by location: the same sovereign's territories sit in several AORs.
  const france = ["GUF", "GLP", "MTQ", "REU", "MYT", "PYF", "NCL", "WLF", "SPM"].map((c) => assignmentFor(c)!.command);
  assert.ok(new Set(france).size >= 4, "French territories span several AORs");
  const outside = CURRENT_ASSIGNMENTS.filter((r) => r.entityType === "entity" && /France|United Kingdom|Netherlands|Denmark|Norway|Australia/.test(detail(r).administering ?? ""));
  assert.ok(outside.some((r) => r.command !== "EUCOM"), "not every European-administered territory is EUCOM");
  // Disputed sovereignty is recorded, never a second AOR.
  assert.equal(detail(assignmentFor("FLK")!).disputedSovereignty, true);
  assert.equal(assignmentFor("FLK")?.command, "SOUTHCOM");
  assert.equal(detail(assignmentFor("XPR")!).disputedSovereignty, true);
  assert.equal(CURRENT_ASSIGNMENTS.filter((r) => r.iso3 === "FLK").length, 1);
  // Parent / child searchability for composite ISO records.
  assert.deepEqual(locationsUnderParent("PSE").map((r) => r.name).sort(), ["Gaza Strip", "West Bank"]);
  assert.deepEqual(locationsUnderParent("SHN").map((r) => r.name).sort(), ["Ascension Island", "Saint Helena (island)", "Tristan da Cunha"]);
  assert.deepEqual(locationsUnderParent("BES").map((r) => r.name).sort(), ["Bonaire", "Saba", "Sint Eustatius"]);
  assert.deepEqual(locationsUnderParent("SJM").map((r) => r.name).sort(), ["Jan Mayen", "Svalbard"]);
  for (const parent of ["PSE", "SHN", "BES", "SJM"]) for (const child of locationsUnderParent(parent)) assert.equal(child.command, assignmentFor(parent)!.command, `${child.name} agrees with its composite parent`);
});

test("9. a controlling authority overrides an older conflicting source and the displaced evidence is kept", () => {
  // Greenland: the 2025 UCP reassignment controls; the EUCOM assignment is history, not current.
  const grl = assignmentFor("GRL")!;
  assert.equal(grl.command, "NORTHCOM");
  assert.equal(grl.effectiveFrom, "2025-06-17");
  assert.equal(grl.supersedesCommand, "EUCOM");
  assert.equal(detail(grl).authorityTier, 2, "a later authorized reassignment");
  assert.match(grl.sourceUrl, /greenland-now-in-us-northern-command-area-of-responsibility/);
  assert.ok(grl.previousEvidence?.some((e) => /About/.test(e.sourceUrl) || /northcom\.mil\/About/.test(e.sourceUrl)), "the older NORTHCOM page evidence is kept");
  assert.deepEqual(assignmentHistoryFor("GRL").map((h) => `${h.command}:${h.effectiveTo}`), ["EUCOM:2025-06-17"]);
  assert.deepEqual(assignmentHistoryFor("ISR").map((h) => `${h.command}:${h.effectiveTo}`), ["EUCOM:2021-01-15"]);
  assert.equal(assignmentFor("ISR")?.command, "CENTCOM");

  // West Bank & Gaza: CRS names them in the CENTCOM AOR; the directory's "provisional" label does not control.
  for (const id of ["PSE", "GEO:GAZA_STRIP", "GEO:WEST_BANK"]) {
    const row = assignmentFor(id)!;
    assert.equal(detail(row).evidenceClass, "individually_verified", id);
    assert.equal(detail(row).provisional, false, id);
    assert.ok(detail(row).corrections.some((c) => /provisional|Geographic mapping/.test(c.from) && /individually_verified/.test(c.to)), `${id}: the correction is recorded`);
    assert.ok(row.previousEvidence?.some((e) => /Directory/.test(e.sourceAuthority)), `${id}: the directory's own evidence is retained`);
    assert.match(row.sourceUrl, /IF11428/);
  }
  // Mayotte: the displaced SOUTHCOM clause is provenance, not an assignment.
  const myt = assignmentFor("MYT")!;
  assert.equal(myt.command, "AFRICOM");
  assert.ok(detail(myt).conflictHistory.some((c) => /2014 SOUTHCOM contract clause listed Mayotte/.test(c.claim) && /not a geographic UCP assignment/.test(c.reason)));
  // Western Sahara: DSCA security-cooperation coding is not a UCP boundary assignment.
  assert.ok(detail(assignmentFor("ESH")!).conflictHistory.some((c) => /DSCA/.test(c.claim) && /not a formal GCC boundary assignment/.test(c.reason)));

  // The conflict rule itself: a stronger directory claim replaces a weaker registry claim; a weaker one never does.
  const base = (command: CommandId, evidence: CountryAorAssignment["entityEvidence"], basis: CountryAorAssignment["basis"]): CountryAorAssignment => ({
    iso3: "ZZA", name: "Testland", command, entityType: "entity", geographicClass: "territory", classBasis: "test", entityEvidence: evidence, basis,
    verification: "PUBLIC-SOURCE BASELINE", sourceAuthority: "registry test source", sourceUrl: "https://example.test/registry", effectiveFrom: null, effectiveTo: null, supersedesCommand: null, note: null,
  });
  const dir = (workbookAor: string, evidence: string) => [{ name: "Testland", iso2: "ZA", iso3: "ZZA", category: "U.S. territory / possession", administering: "United States", workbookAor, appAlias: workbookAor.replace(/^US/, ""), basis: "t", evidence, sourceDate: "2026-01-01", sourceUrl: "https://example.test/directory", note: null, origin: "ISO 3166-1", parentIso2: null, parentIso3: null }];
  const weakRegistry = integrateDirectory([base("EUCOM", "pack_only_not_named_by_command_page", "official_count_normalized_list")], { commandNames: COMMAND_NAMES, rows: dir("USNORTHCOM", "Direct command confirmation") });
  assert.equal(weakRegistry.records[0].command, "NORTHCOM", "direct command confirmation (tier 4) beats a pack-only provisional registry mapping");
  assert.equal(weakRegistry.report.commandConflicts.length, 1);
  assert.ok(detail(weakRegistry.records[0]).conflictHistory.some((c) => /EUCOM/.test(c.claim)), "the displaced EUCOM claim stays in the conflict history");
  const strongRegistry = integrateDirectory([base("EUCOM", "command_page_names_it", "official_boundary_statement")], { commandNames: COMMAND_NAMES, rows: dir("USNORTHCOM", "Regional mapping") });
  assert.equal(strongRegistry.records[0].command, "EUCOM", "a regional mapping never overrides a command-named assignment");
  assert.ok(detail(strongRegistry.records[0]).conflictHistory.some((c) => /NORTHCOM/.test(c.claim)));
  const tie = integrateDirectory([base("EUCOM", "command_page_names_it", "official_boundary_statement")], { commandNames: COMMAND_NAMES, rows: dir("USNORTHCOM", "Direct command confirmation") });
  assert.equal(tie.records[0].command, "EUCOM", "an equal-authority directory claim does not displace the existing assignment");
  assert.throws(() => integrateDirectory([], { commandNames: COMMAND_NAMES, rows: dir("USMADEUP", "Regional mapping") }), /Unknown workbook command/);
});

test("10. evidence classifications are retained and never inflated to 285 verified assignments", () => {
  const counts = auditRegistry().directory;
  assert.equal(counts.geographicRecordsMapped, 285);
  assert.equal(counts.individuallyVerified + counts.officialAggregateCount + counts.regionalInference + counts.provisional, 285);
  assert.equal(counts.individuallyVerified, 118);
  assert.equal(counts.officialAggregateCount, 89);
  assert.equal(counts.regionalInference, 74);
  assert.equal(counts.provisional, 4);
  assert.ok(counts.individuallyVerified < 285);
  assert.deepEqual(counts.unresolvedAuthoritative.map((u) => u.id).sort(), ["ESH", "GEO:CEUTA", "GEO:MELILLA", "XNV"]);
  // Every record keeps the directory's own label, date text and URL next to the normalized class.
  for (const row of DIRECTORY_ROWS) {
    const rec = assignmentFor(recordIdOf(row))!;
    assert.equal(detail(rec).workbookEvidence, row.evidence, row.name);
    assert.equal(detail(rec).workbookSourceDate, row.sourceDate, row.name);
    assert.equal(detail(rec).workbookSourceUrl, row.sourceUrl, row.name);
    assert.equal(detail(rec).workbookAor, row.workbookAor, row.name);
    assert.equal(detail(rec).categoryLabel, row.category, row.name);
    assert.equal(detail(rec).administering, row.administering, row.name);
    assert.equal(detail(rec).rosterOrigin, row.origin, row.name);
    assert.ok(["individually_verified", "official_aggregate_count", "regional_inference", "provisional"].includes(detail(rec).evidenceClass));
  }
  // Class by source: command lists, the 53/36 counts, and the regional territories.
  assert.equal(detail(assignmentFor("KWT")!).evidenceClass, "individually_verified");
  assert.equal(detail(assignmentFor("COL")!).evidenceClass, "individually_verified");
  assert.equal(detail(assignmentFor("KEN")!).evidenceClass, "official_aggregate_count", "AFRICOM states 53; membership is normalized from the count");
  assert.equal(detail(assignmentFor("JPN")!).evidenceClass, "official_aggregate_count", "INDOPACOM states 36; membership stays LIVE VERIFY");
  assert.equal(detail(assignmentFor("POL")!).evidenceClass, "individually_verified", "EUCOM's The Region names all 50");
  assert.equal(detail(assignmentFor("CYM")!).evidenceClass, "regional_inference");
  assert.equal(detail(assignmentFor("BMU")!).evidenceClass, "regional_inference");
  assert.equal(detail(assignmentFor("GEO:UNITED_STATES_HAWAII")!).evidenceClass, "regional_inference");
  for (const id of ["GEO:UNITED_STATES_CONTIGUOUS_48_STATES_AND_WASHINGTON_DC", "GEO:UNITED_STATES_ALASKA"]) assert.equal(detail(assignmentFor(id)!).evidenceClass, "individually_verified", id);
  assert.equal(detail(assignmentFor("ESH")!).evidenceClass, "provisional");
  // Evidence upgrades are corrections with a controlling source; the workbook's weaker label is kept.
  const eucomCorrections = DIRECTORY_INTEGRATION_REPORT.corrections.filter((c) => /The Region/.test(c.authority));
  assert.equal(eucomCorrections.length, 50);
  assert.ok(eucomCorrections.every((c) => /Regional mapping|Geographic mapping/.test(c.from) && /individually_verified/.test(c.to)));
  assert.equal(DIRECTORY_INTEGRATION_REPORT.commandConflicts.length, 0, "no workbook command assignment contradicts the registry's evidence");
  // Verified, aggregate and regional records stay apart in the audit, per command.
  const southcom = counts.byEvidenceClassPerCommand.SOUTHCOM;
  assert.deepEqual(southcom, { individually_verified: 31, official_aggregate_count: 0, regional_inference: 19, provisional: 0 });
  assert.equal(auditRegistry().perCommand.SOUTHCOM.verifiedNamedDependencyCount, 0, "SOUTHCOM's declared 12 are still not named by the command");
  assert.equal(counts.splitParents.length, 3);
  // Source date text is preserved verbatim; only a real date becomes a sourceDate.
  assert.equal(assignmentFor("GRL")!.sourceDate, "2025-06-17");
  assert.equal(assignmentFor("CYM")!.sourceDate ?? null, null);
  assert.match(assignmentFor("CYM")!.sourceCurrencyNote ?? "", /Undated current command page/);
  assert.equal(classOfCategory("Sovereign state"), "sovereign_state");
});

test("11. provisional geographic assignments carry their uncertainty into medical-rule evaluation", () => {
  const africaRulesFor = (iso3: string) => evaluateCommandTraveler({ iso3, population: "us_military", travelKind: "official_tdy_deployment", stayDays: 60, component: null });
  const esh = africaRulesFor("ESH");
  const ken = africaRulesFor("KEN");
  assert.equal(esh.resolution.command, "AFRICOM");
  assert.equal(esh.resolution.assignmentQualifier?.provisional, true);
  assert.ok(esh.evaluations.length > 0);
  assert.ok(ken.evaluations.some((e) => e.applicability === "applies"), "an ordinary AFRICOM country has rules that apply");
  assert.equal(esh.evaluations.filter((e) => e.applicability === "applies").length, 0, "a provisional assignment never presents a rule as settled");
  assert.ok(esh.evaluations.every((e) => e.applicability === "does_not_apply" || e.reasons.some((r) => /PROVISIONAL/.test(r))), "uncertainty is stated on each surviving rule");
  assert.ok(esh.evaluations.some((e) => e.missingInputs.some((m) => /confirmation of the geographic command assignment/.test(m))));
  // Rules already excluded stay excluded; the qualifier does not resurrect them.
  for (const [a, b] of esh.evaluations.map((e, i) => [e, ken.evaluations[i]] as const)) if (b && b.applicability === "does_not_apply") assert.notEqual(a.applicability, "applies");
  // A regional (non-provisional) mapping keeps the rule status and says it is regional.
  const cym = africaRulesFor("CYM");
  assert.equal(cym.resolution.assignmentQualifier?.provisional, false);
  assert.match(cym.resolution.assignmentQualifier?.text ?? "", /regional mapping/);
  assert.ok(cym.evaluations.every((e) => e.reasons.some((r) => /regional mapping/.test(r)) || e.applicability === "does_not_apply" || e.rule.scope.level === "country"));
  // A named assignment carries no qualifier.
  assert.equal(africaRulesFor("KWT").resolution.assignmentQualifier ?? null, null);
  // Geography alone never makes a rule universal: population and duration gates still apply inside a mapped territory.
  const gum = evaluateCommandTraveler({ iso3: "GUM", population: "us_military", travelKind: "leisure", stayDays: 5 });
  assert.ok(gum.evaluations.every((e) => e.applicability !== "applies" || !e.rule.indopacomFY26Scope), "FY26 leisure / Guam exemptions still apply");
});

test("12. no previously integrated command medical rule is lost", () => {
  assert.equal(COMMAND_RULES.length, 161);
  const byPolicy: Record<string, number> = {};
  for (const r of COMMAND_RULES) byPolicy[r.policyId] = (byPolicy[r.policyId] ?? 0) + 1;
  assert.deepEqual(byPolicy, { "CENTCOM-MOD18": 48, "AFRICOM-ACI-4200.09C": 13, "EUCOM-ECI-4202.01A": 21, "INDOPACOM-FY26-FHP-P-25-0295": 65, "SOUTHCOM-REG-40-501": 14 });
  assert.equal(RESEARCHED_MEDICAL_RULES.length, 18);
  assert.equal(SOUTHCOM_CLASS_DEVIATION_RULES.length, 3);
  // Every command still resolves to its own policy; nothing is borrowed across commands.
  for (const [iso3, command, policy] of [["KWT", "CENTCOM", "CENTCOM-MOD18"], ["KEN", "AFRICOM", "AFRICOM-ACI-4200.09C"], ["POL", "EUCOM", "EUCOM-ECI-4202.01A"], ["JPN", "INDOPACOM", "INDOPACOM-FY26-FHP-P-25-0295"], ["COL", "SOUTHCOM", "SOUTHCOM-REG-40-501"]] as const) {
    const r = resolveCountryCommand(iso3);
    assert.equal(r.command, command);
    assert.equal(r.policy?.policyId, policy);
    assert.ok(r.rules.length > 0, iso3);
  }
  // Newly mapped territories pick up their command's command-wide policy, with no rule created or removed.
  assert.equal(resolveCountryCommand("GUM").policy?.policyId, "INDOPACOM-FY26-FHP-P-25-0295");
  assert.equal(resolveCountryCommand("MYT").command, "AFRICOM");
  assert.equal(resolveCountryCommand("CAN").commandMedicalPolicyStatus, "NOT_PUBLICLY_VERIFIED", "NORTHCOM still has no public command-wide policy; none is borrowed");
  assert.equal(resolveCountryCommand("GRL").commandMedicalPolicyStatus, "NOT_PUBLICLY_VERIFIED");
  assert.equal(resolveCountryCommand("XKS").command, "EUCOM");
});

/* ------------------------------------------------------------------ */
/* Control order: authority and effective date first, evidence class never                */
/* ------------------------------------------------------------------ */

const claim = (command: CommandId, tier: Claim["tier"], evidenceClass: Claim["evidenceClass"], effectiveDate: string | null = null, origin: Claim["origin"] = "directory"): Claim => ({
  command, tier, evidenceClass, effectiveDate, origin, label: `${origin} ${command} t${tier}`, source: { authority: `${origin} authority`, url: `https://example.test/${origin}/${command}/${tier}`, date: effectiveDate, tier },
});
const baseRow = (over: Partial<CountryAorAssignment> = {}): CountryAorAssignment => ({
  iso3: "ZZA", name: "Testland", command: "EUCOM", entityType: "entity", geographicClass: "territory", classBasis: "test", entityEvidence: "command_page_names_it", basis: "official_boundary_statement",
  verification: "PUBLIC-SOURCE BASELINE", sourceAuthority: "registry source", sourceUrl: "https://example.test/registry", effectiveFrom: null, effectiveTo: null, supersedesCommand: null, note: null, ...over,
});
const dirRow = (workbookAor: string, evidence: string, sourceDate: string) => [{
  name: "Testland", iso2: "ZA", iso3: "ZZA", category: "U.S. territory / possession", administering: "United States", workbookAor, appAlias: workbookAor.replace(/^US/, ""), basis: "test basis",
  evidence, sourceDate, sourceUrl: "https://example.test/directory", note: null, origin: "ISO 3166-1", parentIso2: null, parentIso3: null,
}];
const integrate = (base: CountryAorAssignment, workbookAor: string, evidence: string, sourceDate: string) => integrateDirectory([base], { commandNames: COMMAND_NAMES, rows: dirRow(workbookAor, evidence, sourceDate) });

test("control order: a more controlling authority wins even when its evidence class is weaker", () => {
  // Tier 4 (official command material, aggregate count) controls over tier 5 (other official U.S. government document that names the place).
  assert.ok(compareControl(claim("NORTHCOM", 4, "official_aggregate_count"), claim("EUCOM", 5, "individually_verified")) < 0);
  assert.ok(compareControl(claim("EUCOM", 5, "individually_verified"), claim("NORTHCOM", 4, "official_aggregate_count")) > 0);
  // Tier 1 (Presidential UCP / boundary directive) controls over everything below it, including a "verified" tier 4 claim.
  assert.ok(compareControl(claim("CENTCOM", 1, "provisional"), claim("AFRICOM", 4, "individually_verified")) < 0);
  const decision = resolveClaims([claim("EUCOM", 5, "individually_verified"), claim("NORTHCOM", 4, "official_aggregate_count")], "EUCOM");
  assert.equal(decision.winner.command, "NORTHCOM");
  assert.equal(decision.evidence.command, "NORTHCOM");
  assert.equal(decision.evidence.evidenceClass, "official_aggregate_count", "the class comes from the winning claim, not from the better-classified loser");
  assert.equal(decision.contested, false);
  // Within one command, the more controlling supporter supplies the evidence; class only breaks an exact tie.
  const same = resolveClaims([claim("EUCOM", 5, "individually_verified"), claim("EUCOM", 4, "official_aggregate_count")], null);
  assert.equal(same.evidence.tier, 4);
  assert.equal(resolveClaims([claim("EUCOM", 4, "regional_inference"), claim("EUCOM", 4, "individually_verified")], null).evidence.evidenceClass, "individually_verified");
});

test("control order: at the same authority tier the later effective date controls; partial or missing dates never order", () => {
  assert.ok(compareControl(claim("NORTHCOM", 4, "individually_verified", "2025-06-17"), claim("EUCOM", 4, "individually_verified", "2024-03-01")) < 0);
  assert.ok(compareControl(claim("EUCOM", 4, "individually_verified", "2024-03-01"), claim("NORTHCOM", 4, "individually_verified", "2025-06-17")) > 0);
  assert.equal(compareControl(claim("EUCOM", 4, "individually_verified", "2025-06-17"), claim("NORTHCOM", 4, "individually_verified", "2025-06-17")), 0);
  assert.equal(compareControl(claim("EUCOM", 4, "individually_verified", null), claim("NORTHCOM", 4, "individually_verified", "2025-06-17")), 0);
  assert.equal(compareControl(claim("EUCOM", 4, "individually_verified", "2025-08"), claim("NORTHCOM", 4, "individually_verified", "2025-08-19")), 0, "a year-month does not order against a full date in the same month");
  assert.ok(compareControl(claim("EUCOM", 4, "individually_verified", "2025-07"), claim("NORTHCOM", 4, "individually_verified", "2025-08-19")) > 0);
});

test("integration: a higher-tier directory claim replaces a better-classified registry claim and brings its own evidence class", () => {
  // Registry: tier 5, individually verified, EUCOM. Directory: tier 4 "Regional command confirmation" (aggregate count), NORTHCOM.
  const { records, report } = integrate(baseRow({ entityEvidence: "primary_us_government_names_it", sourceDate: "2024-01-01" }), "USNORTHCOM", "Regional command confirmation", "Undated current command page");
  const row = records[0];
  assert.equal(row.command, "NORTHCOM", "the more controlling authority decides the AOR");
  assert.equal(detail(row).evidenceClass, "official_aggregate_count", "not the loser's individually_verified");
  assert.equal(detail(row).authorityTier, 4);
  assert.equal(detail(row).evidenceBasis.command, "NORTHCOM");
  assert.equal(detail(row).evidenceBasis.origin, "directory");
  assert.notEqual(row.entityEvidence, "primary_us_government_names_it", "the displaced source's evidence tag is not attached to the new AOR");
  assert.equal(row.sourceUrl, "https://example.test/directory");
  assert.equal(row.basis, "official_count_normalized_list");
  assert.ok(row.previousEvidence?.some((e) => e.sourceUrl === "https://example.test/registry"), "the displaced registry source is retained");
  assert.ok(detail(row).conflictHistory.some((c) => /^EUCOM/.test(c.claim) && /tier 4 over tier 5/.test(c.reason) && /whatever the evidence classes/.test(c.reason)));
  assert.equal(report.commandConflicts.length, 1);
  assert.deepEqual(report.corrections.filter((c) => c.field === "command").map((c) => c.to), ["NORTHCOM"]);
});

test("integration: a better-classified but lower-authority directory claim never replaces the controlling registry claim", () => {
  // Registry: tier 5 EUCOM. Directory: tier 6 regional mapping, NORTHCOM → the directory (workbook) assignment is corrected.
  const { records, report } = integrate(baseRow({ entityEvidence: "primary_us_government_names_it" }), "USNORTHCOM", "Regional mapping", "Updated 2026 (command page)");
  const row = records[0];
  assert.equal(row.command, "EUCOM");
  assert.equal(detail(row).evidenceClass, "individually_verified");
  assert.equal(detail(row).evidenceBasis.command, "EUCOM");
  assert.equal(detail(row).evidenceBasis.origin, "registry");
  assert.equal(row.entityEvidence, "primary_us_government_names_it");
  assert.equal(row.sourceUrl, "https://example.test/registry");
  assert.ok(detail(row).conflictHistory.some((c) => /^NORTHCOM/.test(c.claim)), "the displaced workbook claim stays in the history");
  const correction = report.corrections.find((c) => c.field === "command");
  assert.ok(correction && /NORTHCOM \(directory\)/.test(correction.from) && correction.to === "EUCOM", "the workbook assignment correction is reported");
});

test("integration: same authority tier, different effective dates — the later source supersedes and the earlier becomes history", () => {
  const later = integrate(baseRow({ sourceDate: "2024-03-01" }), "USNORTHCOM", "Direct command confirmation", "2025-06-17");
  const row = later.records[0];
  assert.equal(detail(row).authorityTier, 4);
  assert.equal(row.command, "NORTHCOM", "the 2025 source supersedes the 2024 source at the same tier");
  assert.equal(detail(row).contested, false);
  assert.equal(row.effectiveFrom, "2025-06-17");
  assert.equal(row.supersedesCommand, "EUCOM");
  assert.equal(detail(row).evidenceBasis.command, "NORTHCOM");
  assert.equal(detail(row).evidenceBasis.effectiveDate, "2025-06-17");
  assert.equal(row.sourceDate, "2025-06-17");
  assert.equal(later.report.history.length, 1);
  assert.equal(later.report.history[0].command, "EUCOM");
  assert.equal(later.report.history[0].effectiveTo, "2025-06-17");
  assert.ok(detail(row).conflictHistory.some((c) => /later effective date \(2025-06-17 over 2024-03-01\)/.test(c.reason)));
  assert.ok(row.previousEvidence?.some((e) => e.sourceUrl === "https://example.test/registry"));

  const earlier = integrate(baseRow({ sourceDate: "2026-01-10" }), "USNORTHCOM", "Direct command confirmation", "2025-06-17");
  const kept = earlier.records[0];
  assert.equal(kept.command, "EUCOM", "an older directory source does not supersede a later registry source at the same tier");
  assert.equal(detail(kept).contested, false);
  assert.equal(detail(kept).evidenceBasis.origin, "registry");
  assert.equal(earlier.report.history.length, 0, "nothing is superseded, so no history is invented");
  assert.ok(detail(kept).conflictHistory.some((c) => /^NORTHCOM/.test(c.claim) && /later effective date \(2026-01-10 over 2025-06-17\)/.test(c.reason)));
});

test("integration: same tier with no orderable dates is contested — incumbent kept, flagged provisional, nothing picked arbitrarily", () => {
  for (const [registryDate, directoryDate] of [[undefined, "2025-06-17"], ["2025-06-17", "2025-06-17"], ["2025-08", "2025-08-19"], [undefined, "Undated current command page"]] as const) {
    const { records, report } = integrate(baseRow(registryDate ? { sourceDate: registryDate } : {}), "USNORTHCOM", "Direct command confirmation", directoryDate);
    const row = records[0];
    assert.equal(row.command, "EUCOM", `${registryDate}/${directoryDate}: the incumbent AOR is kept`);
    assert.equal(detail(row).contested, true, `${registryDate}/${directoryDate}`);
    assert.equal(detail(row).provisional, true);
    assert.equal(detail(row).evidenceClass, "provisional", "a contested assignment is never presented as verified");
    assert.match(row.verification, /LIVE VERIFY/);
    assert.equal(detail(row).evidenceBasis.command, "EUCOM");
    assert.ok(detail(row).conflictHistory.some((c) => /^NORTHCOM/.test(c.claim) && /cannot be established/.test(c.reason)));
    assert.equal(report.commandConflicts[0].reason.startsWith("contested"), true);
    assert.equal(report.corrections.filter((c) => c.field === "command").length, 0);
  }
  // A contested record carries the uncertainty into medical-rule evaluation like any other provisional assignment.
  const decision = resolveClaims([claim("EUCOM", 4, "individually_verified", null, "registry"), claim("NORTHCOM", 4, "individually_verified", "2025-06-17")], "EUCOM");
  assert.equal(decision.contested, true);
  assert.equal(decision.winner.command, "EUCOM");
});

test("no record carries an evidence class taken from a claim for a different command", () => {
  for (const row of CURRENT_ASSIGNMENTS) {
    assert.equal(detail(row).evidenceBasis.command, row.command, `${row.iso3}: evidence basis belongs to the assigned command`);
    assert.equal(detail(row).contested, false, `${row.iso3}: no real record is contested`);
    assert.equal(detail(row).authorityTier, detail(row).evidenceBasis.source.tier, row.iso3);
  }
  assert.equal(DIRECTORY_INTEGRATION_REPORT.commandConflicts.length, 0);
  // The authority-first order leaves the real classification unchanged.
  const counts = auditRegistry().directory;
  assert.deepEqual([counts.individuallyVerified, counts.officialAggregateCount, counts.regionalInference, counts.provisional], [118, 89, 74, 4]);
  assert.equal(detail(assignmentFor("GRL")!).authorityTier, 2);
  assert.equal(detail(assignmentFor("GRL")!).evidenceBasis.origin, "directory");
});

test("reporting: 118 individually verified versus 167 not yet individually verified; the 4 provisional are only the contested subset", () => {
  const counts = auditRegistry().directory;
  assert.equal(counts.individuallyVerified, 118);
  assert.equal(counts.notIndividuallyVerified, 167);
  assert.deepEqual(counts.outstandingIndividualVerification, { total: 167, official_aggregate_count: 89, regional_inference: 74, provisional: 4 });
  assert.equal(counts.individuallyVerified + counts.notIndividuallyVerified, 285);
  assert.equal(counts.unresolvedAuthoritative.length, 4, "only the contested / provisional subset is listed as unresolved");
  assert.ok(counts.unresolvedAuthoritative.length < counts.notIndividuallyVerified, "the provisional records are not the whole verification gap");
  assert.ok(counts.officialAggregateCount + counts.regionalInference > counts.provisional);
});
