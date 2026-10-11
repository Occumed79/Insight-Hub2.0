import assert from "node:assert/strict";
import test from "node:test";
import { OCR_SOURCE_DOCUMENT_REGISTRY, ocrDocument } from "../aor-intel/command-policy/ocr-source-documents";
import { COMMAND_POLICIES, COMMAND_RULES } from "../aor-intel/command-policy/policies-data";
import { evaluateCommandRule } from "../aor-intel/command-policy/engine";
import { RESEARCH_EVIDENCE } from "../aor-intel/command-policy/verified-research";
import { SOURCE_GAP_LEDGER } from "../aor-intel/command-policy/source-gaps";
import type { CommandQuery } from "../aor-intel/command-policy/types";
const byId = (id: string) => { const rule = COMMAND_RULES.find(r => r.id === id); assert.ok(rule, id); return rule; };
const evaluate = (id: string, extra: Partial<CommandQuery> = {}) => evaluateCommandRule(byId(id), { iso3: "KOR", population: "us_military", travelKind: "official_tdy_deployment", stayDays: 30, ...extra });

test("OCR provenance preserves nine upload fingerprints and exact document/rule excerpts", () => {
  const registry = OCR_SOURCE_DOCUMENT_REGISTRY;
  assert.equal(registry.uploads.length, 9);
  assert.equal(registry.documents.length, 14);
  assert.equal(new Set(COMMAND_RULES.map(r => r.id)).size, COMMAND_RULES.length);
  for (const doc of registry.documents) {
    assert.equal(doc.sourceText.split("\n").length, doc.endLine-doc.startLine+1, doc.id);
    assert.ok(registry.uploads.some(u => u.filename === doc.uploadedFilename && /^[a-f0-9]{64}$/.test(u.sha256)), doc.id);
  }
  for (const rule of COMMAND_RULES.filter(r => r.sourceProvenance)) {
    const p = rule.sourceProvenance!;
    const doc = ocrDocument(p.documentId);
    assert.ok(p.startLine >= doc.startLine && p.endLine <= doc.endLine, rule.id);
    assert.equal(rule.sourceWording, doc.sourceText.split("\n").slice(p.startLine-doc.startLine,p.endLine-doc.startLine+1).join("\n"),rule.id);
    assert.ok(rule.sourceWording?.trim(), rule.id);
  }
});

test("FY26 donor screen covers 30 days and shorter high-risk/live-fire travel", () => {
  const id = "ip:fy26:blood-donor";
  assert.equal(evaluate(id).applicability,"applies");
  assert.equal(evaluate(id,{stayDays:29,highRiskOrLiveFire:false}).applicability,"does_not_apply");
  assert.equal(evaluate(id,{stayDays:2,highRiskOrLiveFire:true}).applicability,"applies");
  assert.equal(evaluate(id,{stayDays:null,highRiskOrLiveFire:true}).applicability,"applies");
  assert.equal(evaluate(id,{stayDays:2}).applicability,"unknown");
  assert.equal(evaluate(id,{iso3:"GUM",highRiskOrLiveFire:true}).applicability,"does_not_apply");
  assert.equal(evaluate(id,{travelKind:"leisure",highRiskOrLiveFire:true}).applicability,"does_not_apply");
});

test("FY26 paragraph9 keeps non-deployment45-day boundary and missing orders explicit", () => {
  const rules = COMMAND_RULES.filter(r => r.durationProfile === "indopacom_paragraph9");
  assert.ok(rules.length);
  for (const rule of rules) {
    assert.equal(evaluate(rule.id,{stayDays:44,onDeploymentOrders:false}).applicability,"does_not_apply");
    assert.notEqual(evaluate(rule.id,{stayDays:45,onDeploymentOrders:false}).applicability,"does_not_apply");
    assert.ok(evaluate(rule.id,{stayDays:30}).missingInputs.some(s => s.includes("deployment orders")));
    assert.equal(evaluate(rule.id,{stayDays:29,onDeploymentOrders:true}).applicability,"does_not_apply");
  }
});

test("FY26 civilian and contractor exceptions do not become universal mandates", () => {
  assert.equal(evaluate("ip:fy26:fitness",{population:"dod_civilian",civilianCategory:"other",travelKind:"pcs"}).applicability,"does_not_apply");
  assert.equal(evaluate("ip:fy26:fitness",{population:"dod_civilian",civilianCategory:"other",permanentAssignmentIso3:"KOR"}).applicability,"does_not_apply");
  assert.equal(evaluate("ip:fy26:fitness",{population:"dod_civilian",civilianCategory:"emergency_essential"}).applicability,"applies");
  assert.equal(evaluate("ip:fy26:fitness",{population:"dod_contractor",contractRequirementsApply:false}).applicability,"does_not_apply");
  assert.equal(evaluate("ip:fy26:fitness",{population:"dod_contractor",contractRequirementsApply:true,contractorAuthorization:"non_caaf",permanentAssignmentIso3:"KOR"}).applicability,"does_not_apply");
  assert.equal(evaluate("ip:fy26:routine-vaccines",{iso3:"THA",population:"dod_civilian",civilianCategory:"other"}).applicability,"does_not_apply");
  assert.equal(evaluate("ip:fy26:routine-vaccines",{iso3:"THA",population:"dod_contractor",contractRequirementsApply:true,contractorAuthorization:"caaf"}).applicability,"applies");
  assert.equal(evaluate("ip:fy26:fitness",{population:"dod_contractor"}).applicability,"unknown");
});

test("dated cancellations, TBE recommendation, FDA conflict and USFK amendment gap are retained", () => {
  const eu = COMMAND_POLICIES.find(p => p.policyId === "EUCOM-ECI-4202.01A")!;
  assert.equal(eu.sourceDate,"2025-07-24");
  assert.equal(eu.supersedesPolicyId,"EUCOM-ECI-4202.01-2019");
  assert.equal(byId("eu:tbe").kind,"recommendation");
  assert.equal(byId("eu:tbe").sourceDate,"2026-03-02");
  assert.ok(byId("eu:tbe").previousRuleEvidence?.length);
  assert.match(byId("ip:fy26:korea-anthrax").conditionOrRequirement,/two doses/);
  assert.match(byId("ip:usfk:vax").conditionOrRequirement,/minimumone dose/);
  assert.match(RESEARCH_EVIDENCE.find(r => r.id === "fda-ixchiq-license-suspension")!.finding,/suspended/);
  assert.equal(SOURCE_GAP_LEDGER.find(g => g.id === "usfk-change1")?.status,"OPEN_LIVE_VERIFY");
  assert.ok(!COMMAND_RULES.some(r => /primaquine.*28\s*mg/i.test(r.conditionOrRequirement)));
  assert.equal(byId("eu:ocr:osa").policyId,"EUCOM-ECI-4202.01A");
  assert.notEqual(evaluate("eu:ocr:osa",{iso3:"POL",travelKind:"pcs"}).applicability,"does_not_apply");
  assert.match(byId("af:supplement:malaria").conditionOrRequirement,/Chloroquine will not/);
  assert.match(byId("ip:usfk:malaria").conditionOrRequirement,/chloroquine first line/);
});
