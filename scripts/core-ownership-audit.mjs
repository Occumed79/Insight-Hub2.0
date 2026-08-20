import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [app, sidebar, entities, contextualEntities, apiRoute, apiIndex] = await Promise.all([
  read("artifacts/occu-med-insight-hub/src/App.tsx"),
  read("artifacts/occu-med-insight-hub/src/components/insight/Sidebar.tsx"),
  read("artifacts/occu-med-insight-hub/src/pages/entities.tsx"),
  read("artifacts/occu-med-insight-hub/src/pages/entities-contextual.tsx"),
  read("artifacts/api-server/src/routes/core-intelligence.ts"),
  read("artifacts/api-server/src/routes/index.ts"),
]);

for (const route of [
  "/entities",
  "/prospects",
  "/clients",
  "/competitors",
  "/federal-agencies",
  "/state-agencies",
  "/fec-filings",
  "/federal-awards",
  "/public-legal-references",
  "/industry-impact-calculator",
  "/industry-injury-benchmarks",
  "/job-intelligence",
  "/occupational-demands",
]) {
  assert.ok(app.includes(`path=\"${route}\"`), `Hub 2 is missing route ${route}`);
}

const hasDirectEntitiesImport =
  app.includes('import { EntitiesPage } from "@/pages/entities"') ||
  (app.includes('import("@/pages/entities")') && app.includes("default: module.EntitiesPage"));
const hasContextualEntitiesImport =
  app.includes('import("@/pages/entities-contextual")') &&
  app.includes("default: module.ContextualEntitiesPage");
const contextualWrapperOwnsEntities =
  contextualEntities.includes('import { EntitiesPage } from "@/pages/entities"') &&
  contextualEntities.includes("<EntitiesPage");

assert.ok(
  hasDirectEntitiesImport || (hasContextualEntitiesImport && contextualWrapperOwnsEntities),
  "Hub 2 App must own and load the transferred Entities workspace directly or through the reviewed contextual wrapper",
);

for (const expected of [
  '{ href: "/entities", label: "Entities"',
  '{ href: "/federal-agencies", label: "Federal Agencies"',
  '{ href: "/state-agencies", label: "State Agencies"',
  '{ href: "/industry-impact-calculator", label: "Industry Impact Calculator"',
  '{ href: "/job-intelligence", label: "Job Intelligence"',
]) {
  assert.ok(sidebar.includes(expected), `Hub 2 sidebar is missing reviewed destination ${expected}`);
}

for (const forbidden of [
  '{ href: "/competitors", label: "Competitors"',
  '{ href: "/fec-filings", label: "FEC Filings"',
  '{ href: "/industry-injury-benchmarks", label: "Industry Injury Benchmarks"',
  '{ href: "/occupational-demands", label: "Occupational Demands"',
]) {
  assert.ok(!sidebar.includes(forbidden), `Reviewed hierarchy forbids duplicate primary navigation entry ${forbidden}`);
}

assert.ok(
  app.includes('<Route path="/industry-injury-benchmarks" component={IndustryImpactCalculatorRoute} />'),
  "Legacy Industry Injury Benchmarks URL must resolve to Industry Impact",
);
assert.ok(
  app.includes('<Route path="/occupational-demands" component={ReviewerJobIntelligencePage} />'),
  "Legacy Occupational Demands URL must resolve to Job Intelligence",
);

for (const expected of [
  'fetchJson<{ prospects: Prospect[] }>("prospects")',
  'fetchJson<{ clients: Client[] }>("clients")',
  'title="Entities"',
  'Prospect Profiles',
  'Client Records',
]) {
  assert.ok(entities.includes(expected), `Entities workspace is missing ${expected}`);
}

if (hasContextualEntitiesImport) {
  for (const expected of [
    "useEmployerWorkflow",
    'href="/federal-awards"',
    'href="/public-legal-references"',
    'href="/fec-filings"',
  ]) {
    assert.ok(contextualEntities.includes(expected), `Contextual Entities wrapper is missing ${expected}`);
  }
}

for (const endpoint of [
  'router.get("/prospects"',
  'router.get("/clients"',
  'router.get("/competitors"',
  'router.get("/federal-intel/:bucket"',
  'router.get("/state-agencies/states"',
]) {
  assert.ok(apiRoute.includes(endpoint), `Hub 2 transferred API is missing ${endpoint}`);
}

assert.ok(
  /router\.use\(\s*coreIntelligenceRouter\s*\)/.test(apiIndex),
  "Hub 2 API index must mount the transferred core-intelligence router",
);

console.log(
  JSON.stringify({
    event: "core_intelligence_ownership_audit_passed",
    owner: "Insight-Hub2.0",
    frontendRoutes: 13,
    visibleSidebarDomains: ["entities", "federal", "state", "industry-impact", "job-intelligence"],
    retainedNonSidebarRoutes: ["competitors", "fec-filings", "industry-injury-benchmarks", "occupational-demands"],
    routeLoading: hasContextualEntitiesImport ? "contextual-wrapper" : hasDirectEntitiesImport ? "direct" : "unknown",
  }),
);
