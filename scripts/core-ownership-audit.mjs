import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [app, sidebar, entities, competitiveAwards, apiRoute, competitiveApi, apiIndex] = await Promise.all([
  read("artifacts/occu-med-insight-hub/src/App.tsx"),
  read("artifacts/occu-med-insight-hub/src/components/insight/Sidebar.tsx"),
  read("artifacts/occu-med-insight-hub/src/pages/entities.tsx"),
  read("artifacts/occu-med-insight-hub/src/pages/competitive-awards.tsx"),
  read("artifacts/api-server/src/routes/core-intelligence.ts"),
  read("artifacts/api-server/src/routes/competitive-awards.ts"),
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
  app.includes('React.lazy(() => import("@/pages/competitive-awards"))'),
  "Competitors route must load the Competitive Awards workspace",
);
assert.ok(
  sidebar.includes('{ href: "/entities", label: "Entities"'),
  "Hub 2 sidebar must expose Entities",
);
assert.ok(
  sidebar.includes('{ href: "/competitors", label: "Competitors"'),
  "Hub 2 sidebar must expose Competitive Awards through the Competitors tab",
);
assert.ok(
  sidebar.includes("Entities, Competitors, Federal Agencies, and State Agencies are owned by Insight Hub 2"),
  "Hub 2 sidebar must state core intelligence ownership",
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

for (const expected of [
  'title="Competitive Awards"',
  'Refresh awards',
  'Candidate competitors',
  'Competitor watchlist',
  'Search competitive awards',
]) {
  assert.ok(competitiveAwards.includes(expected), `Competitive Awards workspace is missing ${expected}`);
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

for (const endpoint of [
  'router.get("/competitive-awards/overview"',
  'router.post("/competitive-awards/refresh"',
  'router.post("/competitive-awards/candidates/:id/approve"',
  'router.post("/competitive-awards/candidates/:id/reject"',
]) {
  assert.ok(competitiveApi.includes(endpoint), `Competitive Awards API is missing ${endpoint}`);
}

assert.ok(
  /router\.use\(\s*coreIntelligenceRouter\s*\)/.test(apiIndex),
  "Hub 2 API index must mount the transferred core-intelligence router",
);
assert.ok(
  /router\.use\(\s*competitiveAwardsRouter\s*\)/.test(apiIndex),
  "Hub 2 API index must mount Competitive Awards intelligence",
);

console.log(
  JSON.stringify({
    event: "core_intelligence_ownership_audit_passed",
    owner: "Insight-Hub2.0",
    frontendRoutes: 6,
    visibleSidebarDomains: ["entities", "competitors", "federal", "state"],
    competitiveAwards: "first-class",
    routeLoading: hasLazyEntitiesImport ? "lazy" : "static",
  }),
);