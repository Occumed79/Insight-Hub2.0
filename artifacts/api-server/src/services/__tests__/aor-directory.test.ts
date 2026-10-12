import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import router from "../../routes/aor-command-policy";
import { buildAorDirectory, searchAorDirectory } from "../aor-intel/directory";
import { CURRENT_ASSIGNMENTS, resolveLocation } from "../aor-intel/command-policy/assignments";
import { countryBoundaries } from "../aor-intel/geo";

const directory = buildAorDirectory();
const byId = new Map(directory.locations.map((entry) => [entry.id, entry]));

test("directory exposes every one of the 285 registry locations with the registry's own command", () => {
  assert.equal(directory.total, 285);
  assert.equal(directory.locations.length, CURRENT_ASSIGNMENTS.length);
  for (const record of CURRENT_ASSIGNMENTS) {
    const entry = byId.get(record.iso3);
    assert.ok(entry, `${record.iso3} present`);
    assert.equal(entry.command, record.command, `${record.iso3} command comes from the resolver, not from the directory`);
    const resolved = resolveLocation(record.iso3);
    assert.equal(resolved.status, "resolved");
  }
  assert.equal(directory.commands.reduce((sum, command) => sum + command.total, 0), 285);
});

test("polygons are only claimed where the boundary file has one; every other location keeps a point and no outline", () => {
  const isoWithPolygon = new Set(countryBoundaries.features.map((feature) => feature.properties.iso2));
  assert.equal(directory.polygonCount + directory.withoutPolygonCount, 285);
  assert.ok(directory.withoutPolygonCount > 0);
  for (const entry of directory.locations) {
    if (entry.boundaryIso2) assert.ok(isoWithPolygon.has(entry.boundaryIso2), `${entry.id} points at a real polygon`);
    else assert.ok(entry.referencePoint, `${entry.id} has no polygon so it must have a reference point to stay selectable`);
  }
  const boundaryKeys = directory.locations.map((entry) => entry.boundaryIso2).filter(Boolean);
  assert.equal(boundaryKeys.length, new Set(boundaryKeys).size, "no polygon is attached to two records");
  // Composite-parent children never borrow the parent's polygon.
  for (const id of ["GEO:GAZA_STRIP", "GEO:WEST_BANK", "GEO:BONAIRE", "GEO:SABA", "GEO:SINT_EUSTATIUS", "XSV", "XJM", "GEO:SAINT_HELENA_ISLAND"]) assert.equal(byId.get(id)?.boundaryIso2, null, id);
  // The United States outline belongs to the split parent, never to a constituent.
  for (const id of ["GEO:UNITED_STATES_ALASKA", "GEO:UNITED_STATES_HAWAII", "GEO:UNITED_STATES_CONTIGUOUS_48_STATES_AND_WASHINGTON_DC"]) assert.equal(byId.get(id)?.boundaryIso2, null, id);
});

test("split ISO parents are listed with their constituents and are not assigned to one command", () => {
  const usa = directory.splitParents.find((entry) => entry.iso3 === "USA");
  assert.ok(usa);
  assert.equal(usa.boundaryIso2, "US");
  assert.deepEqual(usa.commands, ["INDOPACOM", "NORTHCOM"]);
  assert.equal(usa.constituentIds.length, 3);
  assert.deepEqual(directory.splitParents.map((entry) => entry.iso3).sort(), ["ATF", "UMI", "USA"]);
  assert.equal(byId.get("USA"), undefined, "the parent is not a location with an AOR");
});

test("search covers split entities, constituents, territories, aliases and ISO codes", () => {
  const ids = (query: string) => searchAorDirectory(query).locations.map((entry) => entry.id);
  assert.ok(searchAorDirectory("us").splitParents.some((entry) => entry.iso3 === "USA"));
  assert.ok(searchAorDirectory("minor outlying").splitParents.some((entry) => entry.iso3 === "UMI"));
  assert.ok(searchAorDirectory("tf").splitParents.some((entry) => entry.iso3 === "ATF"));
  assert.equal(ids("hawaii")[0], "GEO:UNITED_STATES_HAWAII");
  assert.equal(ids("ceuta")[0], "GEO:CEUTA");
  assert.equal(ids("svalbard")[0], "XSV");
  assert.equal(ids("guam")[0], "GUM");
  assert.equal(ids("uk")[0], "GBR");
  assert.equal(ids("burma")[0], "MMR");
  assert.equal(ids("XKS")[0] ?? ids("kosovo")[0], "XKX");
  assert.deepEqual(searchAorDirectory("").locations, []);
});

test("the separate 197-country baseline profiles are preserved and intel availability is stated per location", () => {
  assert.ok(directory.baselineProfileCount >= 190 && directory.baselineProfileCount <= 197);
  const kenya = byId.get("KEN");
  assert.ok(kenya);
  assert.equal(kenya.baselineProfile, true);
  assert.equal(kenya.countryIntelIso2, "KE");
  const ceuta = byId.get("GEO:CEUTA");
  assert.equal(ceuta?.countryIntelIso2, null);
  assert.equal(ceuta?.baselineProfile, false);
});

test("GET /api/aor/directory serves the directory and ?q= searches it", async () => {
  const app = express();
  app.use("/api", router);
  const server = app.listen(0);
  try {
    const port = (server.address() as { port: number }).port;
    const full = await (await fetch(`http://127.0.0.1:${port}/api/aor/directory`)).json() as { ok: boolean; total: number; locations: unknown[]; splitParents: unknown[] };
    assert.equal(full.ok, true);
    assert.equal(full.total, 285);
    assert.equal(full.locations.length, 285);
    assert.equal(full.splitParents.length, 3);
    const found = await (await fetch(`http://127.0.0.1:${port}/api/aor/directory?q=alaska`)).json() as { locations: Array<{ id: string }> };
    assert.equal(found.locations[0].id, "GEO:UNITED_STATES_ALASKA");
  } finally {
    server.close();
  }
});

test("support components come from the integrated command policies and match what the resolver accepts", () => {
  const ids = directory.supportComponents.map((entry) => entry.id);
  for (const expected of ["USFK", "USARPAC", "PACAF", "PACFLT", "MARFORPAC", "SOCPAC", "USAREUR-AF", "USAFE", "NAVEUR-AF", "MARFOREUR-AF", "SOCEUR", "SOCAFRICA", "CJTF-HOA"]) assert.ok(ids.includes(expected), expected);
  assert.equal(directory.supportComponents.find((entry) => entry.id === "USFK")?.command, "INDOPACOM");
  assert.equal(directory.supportComponents.find((entry) => entry.id === "SOCEUR")?.command, "EUCOM");
});
