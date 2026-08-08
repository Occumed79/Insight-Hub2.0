import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [app, sidebar, entities, apiRoute, apiIndex] = await Promise.all([
  read("artifacts/occu-med-insight-hub/src/App.tsx"),
  read("artifacts/occu-med-insight-hub/src/components/insight/Sidebar.tsx"),
  read("artifacts/occu-med-insight-hub/src/pages/entities.tsx"),
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

const hasStaticEntitiesImport = app.includes(
  'import { EntitiesPage } from "@/pages/entities"',
);
const hasLazyEntitiesImport =
  app.includes('import("@/pages/entities")') &&
  app.includes("default: module.EntitiesPage");
assert.ok(
  hasStaticEntitiesImport || hasLazyEntitiesImport,
  "Hub 2 App must own and load the transferred Entities workspace",
);
assert.ok(
  sidebar.includes('{ href: "/entities", label: "Entities"'),
  "Hub 2 sidebar must expose Entities",
);
assert.ok(
  !sidebar.includes('{ href: "/competitors", label: "Competitors"'),
  "Competitors must remain hidden from the Intelligence Tools navigation",
);
assert.ok(
  sidebar.includes("Entities, Federal Agencies, and State Agencies are owned by Insight Hub 2"),
  "Hub 2 sidebar must state visible core intelligence ownership",
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
    retainedDeepLinkDomains: ["competitors"],
    routeLoading: hasLazyEntitiesImport ? "lazy" : "static",
  }),
);