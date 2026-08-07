import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const frontend = JSON.parse(read("artifacts/occu-med-insight-hub/package.json"));
const mapPackage = JSON.parse(read("lib/react-simple-maps/package.json"));
const osha = read("artifacts/api-server/src/services/oshaDataService.ts");
const importer = read("artifacts/api-server/scripts/import-osha.ts");
const schema = read("lib/db/src/schema/index.ts");
const render = read("render.yaml");
const governance = read("artifacts/api-server/src/routes/source-governance.ts");

const checks = [
  [frontend.devDependencies?.["react-simple-maps"] === "workspace:*", "frontend must use the first-party React 19 map workspace"],
  [!frontend.devDependencies?.["@types/react-simple-maps"], "legacy react-simple-maps typings must be removed"],
  [String(mapPackage.peerDependencies?.react || "").startsWith("^19"), "map workspace must explicitly support React 19"],
  [String(mapPackage.peerDependencies?.["react-dom"] || "").startsWith("^19"), "map workspace must explicitly support React DOM 19"],
  [!osha.includes("readFileSync") && !osha.includes("OSHA_DATA_DIR"), "OSHA runtime must not read JSON/file caches"],
  [osha.includes('dataSource: "database"') || osha.includes('dataSource: "database" | "none"'), "OSHA service must report database persistence"],
  [osha.includes("ensureOshaPersistence"), "OSHA persistence bootstrap must exist"],
  [importer.includes('client.query("BEGIN")') && importer.includes('client.query("COMMIT")') && importer.includes('client.query("ROLLBACK")'), "OSHA imports must be transactional"],
  [importer.includes('extension === ".json"'), "legacy JSON cache migration path must remain supported"],
  [!render.includes("OSHA_DATA_DIR"), "Render must not expose obsolete OSHA_DATA_DIR"],
  [governance.includes('mode: "database-import"'), "Source Governance must identify OSHA as database-import"],
  [governance.includes('environmentKeys: ["OSHA_ITA_IMPORT_ENABLED", "DATABASE_URL"]'), "Source Governance must expose DATABASE_URL, not a file-cache path"],
];

for (const table of ["osha_import_runs", "osha_source_files", "osha_establishments", "employer_aliases", "osha_entity_matches"]) {
  checks.push([schema.includes(`pgTable("${table}"`) && osha.includes(table), `${table} must exist in schema and runtime bootstrap`]);
}

const failures = checks.filter(([passed]) => !passed);
if (failures.length) {
  for (const [, message] of failures) console.error(`FAIL ${message}`);
  process.exit(1);
}

console.log(`React 19 map + OSHA database persistence audit passed (${checks.length} checks).`);
