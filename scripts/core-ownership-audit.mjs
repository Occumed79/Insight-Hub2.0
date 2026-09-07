import fs from "node:fs";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(path, "utf8");
const app = read("artifacts/occu-med-insight-hub/src/App.tsx");
const sidebar = read("artifacts/occu-med-insight-hub/src/components/insight/Sidebar.tsx");
const entities = read("artifacts/occu-med-insight-hub/src/pages/entities-contextual.tsx");
const landing = read("artifacts/occu-med-insight-hub/src/pages/landing.tsx");
const occupationalDataExplorer = read("artifacts/occu-med-insight-hub/src/pages/occupational-data-explorer.tsx");
const onetMaster = read("artifacts/occu-med-insight-hub/src/pages/onet-master-tool.tsx");
const industryImpact = read("artifacts/occu-med-insight-hub/src/pages/industry-impact-calculator-v2.tsx");
const occupationalCalculators = read("artifacts/occu-med-insight-hub/src/pages/occupational-calculators-v2.tsx");

for (const route of [
  "/entities",
  "/prospects",
  "/clients",
  "/competitors",
  "/federal-agencies",
  "/state-agencies",
  "/sec-filings",
  "/leadership-map",
  "/dba-intelligence",
  "/injuries-medical-conditions",
  "/job-intelligence",
  "/aor-factors",
  "/drug-checker",
  "/clinical-calculators",
  "/standards-intelligence",
  "/onet-master-tool",
  "/occupational-data-explorer",
  "/industry-impact-calculator",
  "/occupational-calculators",
  "/war-costs-intelligence",
  "/war-costs-map",
  "/war-costs-tools",
  "/war-costs-special-tools",
  "/war-costs-visualizations",
  "/war-costs-site-evidence",
  "/federal-awards",
  "/public-legal-references",
]) {
  assert.ok(app.includes(`path="${route}"`), `App router must retain active route ${route}`);
}

for (const forbidden of [
  '{ href: "/entities", label: "Entities"',
  '{ href: "/competitors", label: "Competitors"',
  '{ href: "/fec-filings", label: "FEC Filings"',
  '{ href: "/industry-injury-benchmarks", label: "Industry Injury Benchmarks"',
  '{ href: "/occupational-demands", label: "Occupational Demands"',
]) {
  assert.ok(!sidebar.includes(forbidden), `Reviewed hierarchy forbids primary navigation entry ${forbidden}`);
}

assert.ok(
  app.includes('<Route path="/industry-injury-benchmarks" component={IndustryImpactCalculatorRoute} />'),
  "Legacy Industry Injury Benchmarks URL must resolve to Industry Impact",
);
assert.ok(
  app.includes('<Route path="/occupational-demands" component={JobIntelligenceRoute} />'),
  "Legacy Occupational Demands URL must resolve to the cinematic Job Intelligence route",
);
assert.ok(
  app.includes('function JobIntelligenceRoute()') && app.includes('<ReviewerJobIntelligencePage />'),
  "Cinematic Job Intelligence route must still own the reviewed Job Intelligence page",
);

for (const expected of [
  'fetchJson<{ prospects: Prospect[] }>("prospects")',
  'fetchJson<{ clients: Client[] }>("clients")',
  'title="Entities"',
  'Prospect Profiles',
  'Client Records',
]) {
  assert.ok(entities.includes(expected), `Entities compatibility workspace is missing ${expected}`);
}

for (const expected of [
  'href="/injuries-medical-conditions"',
  'href="/job-intelligence"',
  'href="/aor-factors"',
  'href="/drug-checker"',
  'href="/clinical-calculators"',
  'href="/standards-intelligence"',
]) {
  assert.ok(sidebar.includes(expected), `Sidebar must retain reviewer tool ${expected}`);
}

for (const expected of [
  'href="/onet-master-tool"',
  'href="/occupational-data-explorer"',
  'href="/industry-impact-calculator"',
  'href="/occupational-calculators"',
]) {
  assert.ok(sidebar.includes(expected), `Sidebar must retain occupational tool ${expected}`);
}

assert.ok(sidebar.includes('href="/war-costs-intelligence"'), "Sidebar must retain one top-level WarCosts Intelligence entry");
assert.ok(!sidebar.includes('href="/war-costs-accountability"'), "Removed WarCosts Accountability must not return to primary navigation");

for (const expected of [
  'href="/onet-master-tool"',
  'href="/occupational-data-explorer"',
  'href="/industry-impact-calculator"',
  'href="/occupational-calculators"',
]) {
  assert.ok(landing.includes(expected), `Landing page must retain occupational destination ${expected}`);
}

for (const [name, source, expected] of [
  ["Occupational Data Explorer", occupationalDataExplorer, "/api/occupational/"],
  ["O*NET Master Tool", onetMaster, "/api/occupational/"],
  ["Industry Impact Calculator", industryImpact, "/api/occupational/"],
  ["Occupational Calculators", occupationalCalculators, "Occupational"],
]) {
  assert.ok(source.includes(expected), `${name} must retain reviewed occupational ownership marker ${expected}`);
}

console.log("Core ownership audit passed.");
