import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [app, sidebar, companyLibrary, contextualEntities, apiRoute, entityDiscovery, apiIndex] = await Promise.all([
  read("artifacts/occu-med-insight-hub/src/App.tsx"),
  read("artifacts/occu-med-insight-hub/src/components/insight/Sidebar.tsx"),
  read("artifacts/occu-med-insight-hub/src/pages/public-company-library.tsx"),
  read("artifacts/occu-med-insight-hub/src/pages/entities-contextual.tsx"),
  read("artifacts/api-server/src/routes/core-intelligence.ts"),
  read("artifacts/api-server/src/routes/entityDiscovery.ts"),
  read("artifacts/api-server/src/routes/index.ts"),
]);

for (const route of [
  "/entities",
  "/prospects",
  "/clients",
  "/competitors",
  "/injuries-medical-conditions",
  "/aor-factors",
  "/onet-master-tool",
  "/occupational-data-explorer",
  "/fec-filings",
]) {
  assert.ok(app.includes(`path=\"${route}\"`), `Hub 2 is missing route ${route}`);
}

const hasContextualEntitiesImport =
  app.includes('import("@/pages/entities-contextual")') &&
  app.includes("default: module.ContextualEntitiesPage");
const contextualWrapperOwnsLibrary =
  contextualEntities.includes('import { PublicCompanyLibraryPage } from "@/pages/public-company-library"') &&
  contextualEntities.includes("<PublicCompanyLibraryPage />");

assert.ok(
  hasContextualEntitiesImport && contextualWrapperOwnsLibrary,
  "Hub 2 entity compatibility routes must resolve through the neutral public Company Library",
);

for (const expected of [
  '{ href: "/injuries-medical-conditions", label: "Injuries & Medical Conditions"',
  '{ href: "/aor-factors", label: "AOR Factors"',
  '{ href: "/onet-master-tool", label: "O*NET Master Tool"',
  '{ href: "/occupational-data-explorer", label: "Occupational Data Explorer"',
]) {
  assert.ok(sidebar.includes(expected), `Retained navigation destination missing ${expected}`);
}
assert.equal((sidebar.match(/\{ href: "\//g) || []).length, 4, "Only four tools may appear in sidebar navigation");
assert.ok(sidebar.includes('aria-label="Back to landing page"'), "Sidebar must have a Back button");

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
  !app.includes('component={JobIntelligenceRoute}') && !apiIndex.includes('jobIntelligenceRouter') && !apiIndex.includes('standardsIntelligenceRouter'),
  "Retired Job Intelligence and case-evaluator API routes must not be resurrected",
);
assert.ok(
  !sidebar.includes('{ href: "/job-intelligence"'),
  "Retired Job Intelligence must not appear in navigation",
);
assert.ok(
  !app.includes('path="/clinical-calculators"') && !app.includes('ReviewerClinicalCalculatorsPage'),
  "Retired Clinical Calculators route and component must not be reintroduced",
);
assert.ok(
  !sidebar.includes('{ href: "/clinical-calculators"'),
  "Retired Clinical Calculators must not reappear in navigation",
);

for (const expected of [
  "getSavedGeographicEntities",
  'title="Company Library"',
  "Saved public-source company intelligence",
  "Public research target",
  "Opening this library never triggers an external scan.",
]) {
  assert.ok(companyLibrary.includes(expected), `Public Company Library is missing ${expected}`);
}

for (const forbidden of [
  "Prospect Profiles",
  "Client Records",
  'fetchJson<{ prospects: Prospect[] }>("prospects")',
  'fetchJson<{ clients: Client[] }>("clients")',
  "procurement hub",
]) {
  assert.ok(!companyLibrary.includes(forbidden), `Public Company Library must not expose relationship classification: ${forbidden}`);
}

for (const expected of [
  "useEmployerWorkflow",
  'href="/fec-filings"',
  "Selected Company",
]) {
  assert.ok(contextualEntities.includes(expected), `Contextual Company Library wrapper is missing ${expected}`);
}

assert.ok(
  entityDiscovery.includes('router.get("/entities/saved"'),
  "Public Company Library requires the neutral saved-entities endpoint",
);

// Legacy transferred APIs may remain for internal compatibility, but public entity routes must not consume them.
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
    frontendRoutes: 11,
    publicCompanyLibrary: "neutral-saved-entities",
    relationshipLabelsPublished: false,
    visibleSidebarDomains: ["injuries-medical-conditions", "aor-factors", "onet-master-tool", "occupational-data-explorer"],
    retainedCompatibilityRoutes: ["entities", "prospects", "clients", "competitors", "fec-filings", "industry-injury-benchmarks"],
    routeLoading: "contextual-company-library-wrapper",
  }),
);
