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
assert.ok(
  sidebar.includes('{ href: "/entities", label: "Entities"'),
  "Hub 2 sidebar must expose Entities",
);
assert.ok(
  !sidebar.includes('{ href: "/competitors", label: "Competitors"'),
  "Competitors must remain outside the Intelligence Tools sidebar",
);
assert.ok(
  sidebar.includes('{ href: "/federal-agencies", label: "Federal Agencies"'),
  "Hub 2 sidebar must expose Federal Agencies",
);
assert.ok(
  sidebar.includes('{ href: "/state-agencies", label: "State Agencies"'),
  "Hub 2 sidebar must expose State Agencies",
);
assert.ok(
  !sidebar.includes('{ href: "/fec-filings", label: "FEC Filings"'),
  "FEC relationship intelligence must remain entity-linked rather than a primary navigation destination",
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
    frontendRoutes: 6,
    visibleSidebarDomains: ["entities", "federal", "state"],
    retainedNonSidebarRoutes: ["competitors", "fec-filings"],
    routeLoading: hasContextualEntitiesImport ? "contextual-wrapper" : hasDirectEntitiesImport ? "direct" : "unknown",
  }),
);
