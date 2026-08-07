from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.write_text(content, encoding="utf-8")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    if old not in content:
        raise RuntimeError(f"Expected text not found for {label}")
    return content.replace(old, new, 1)


# 1. Resolve react-simple-maps to the first-party React 19 workspace package.
frontend_path = "artifacts/occu-med-insight-hub/package.json"
frontend = json.loads(read(frontend_path))
frontend["devDependencies"].pop("@types/react-simple-maps", None)
frontend["devDependencies"]["react-simple-maps"] = "workspace:*"
write(frontend_path, json.dumps(frontend, indent=2) + "\n")

# 2. Declare OSHA persistence in the shared Drizzle schema so Render's normal db push provisions it.
schema_path = "lib/db/src/schema/index.ts"
schema = read(schema_path)
if "oshaImportRunsTable" not in schema:
    schema = replace_once(
        schema,
        'import { pgTable, text, serial, timestamp, jsonb, integer, boolean } from "drizzle-orm/pg-core";',
        'import { pgTable, text, serial, timestamp, jsonb, integer, boolean, real } from "drizzle-orm/pg-core";',
        "Drizzle real import",
    )
    schema += '''

// OSHA ITA database persistence. The importer is the only writer; application services query these tables.
export const oshaImportRunsTable = pgTable("osha_import_runs", {
  id: serial("id").primaryKey(),
  datasetName: text("dataset_name").notNull(),
  datasetYear: integer("dataset_year").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceFileType: text("source_file_type").notNull(),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  recordCount: integer("record_count").notNull().default(0),
  metadata: jsonb("metadata"),
});

export const oshaSourceFilesTable = pgTable("osha_source_files", {
  id: serial("id").primaryKey(),
  importRunId: integer("import_run_id").notNull().references(() => oshaImportRunsTable.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceFileType: text("source_file_type").notNull(),
  datasetYear: integer("dataset_year").notNull(),
  sha256: text("sha256"),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  metadata: jsonb("metadata"),
});

export const oshaEstablishmentsTable = pgTable("osha_establishments", {
  id: serial("id").primaryKey(),
  importRunId: integer("import_run_id").notNull().references(() => oshaImportRunsTable.id, { onDelete: "cascade" }),
  sourceFileId: integer("source_file_id").references(() => oshaSourceFilesTable.id, { onDelete: "set null" }),
  establishmentName: text("establishment_name").notNull(),
  companyName: text("company_name").notNull(),
  dbaName: text("dba_name"),
  normalizedEstablishmentName: text("normalized_establishment_name").notNull(),
  normalizedCompanyName: text("normalized_company_name").notNull(),
  normalizedDbaName: text("normalized_dba_name"),
  address: text("address").notNull().default(""),
  city: text("city").notNull().default(""),
  state: text("state").notNull().default(""),
  zip: text("zip").notNull().default(""),
  naics: text("naics").notNull().default(""),
  year: integer("year").notNull(),
  totalHoursWorked: integer("total_hours_worked"),
  totalCases: integer("total_cases"),
  dartCases: integer("dart_cases"),
  daysAwayCases: integer("days_away_cases"),
  jobTransferRestrictionCases: integer("job_transfer_restriction_cases"),
  caseCategories: jsonb("case_categories"),
  trcRate: real("trc_rate"),
  dartRate: real("dart_rate"),
  daysAwayRate: real("days_away_rate"),
  sourceUrl: text("source_url").notNull(),
  datasetName: text("dataset_name").notNull(),
  datasetYear: integer("dataset_year").notNull(),
  sourceFileType: text("source_file_type").notNull(),
  lastImportedDate: timestamp("last_imported_date").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const employerAliasesTable = pgTable("employer_aliases", {
  id: serial("id").primaryKey(),
  canonicalName: text("canonical_name").notNull(),
  normalizedCanonicalName: text("normalized_canonical_name").notNull(),
  alias: text("alias").notNull(),
  normalizedAlias: text("normalized_alias").notNull(),
  source: text("source").notNull().default("manual"),
  confidence: real("confidence").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const oshaEntityMatchesTable = pgTable("osha_entity_matches", {
  id: serial("id").primaryKey(),
  oshaEstablishmentId: integer("osha_establishment_id").notNull().references(() => oshaEstablishmentsTable.id, { onDelete: "cascade" }),
  entityId: integer("entity_id").references(() => entitiesTable.id, { onDelete: "set null" }),
  canonicalName: text("canonical_name").notNull(),
  matchedName: text("matched_name").notNull(),
  matchType: text("match_type").notNull().default("name"),
  confidence: real("confidence").notNull().default(0),
  reviewed: boolean("reviewed").notNull().default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
'''
write(schema_path, schema)

# 3. Make Employer Intelligence await the database-backed OSHA service.
employer_path = "artifacts/api-server/src/routes/employer-intelligence.ts"
employer = read(employer_path)
employer = replace_once(
    employer,
    '''// OSHA ITA data layer is now in src/services/oshaDataService.ts
// It reads from cached JSON files (data/osha-ita/) populated by scripts/import-osha.ts
// If no data is imported, it returns an empty result with a clear message.

function getOshaEstablishments(company?: string, state?: string, naics?: string, year?: string): OshaEstablishment[] {
  const result = queryOshaEstablishments(company, state, naics, year);
  return result.records;
}''',
    '''// OSHA ITA data is imported into Postgres by scripts/import-osha.ts and queried from the database.
async function getOshaEstablishments(company?: string, state?: string, naics?: string, year?: string): Promise<OshaEstablishment[]> {
  const result = await queryOshaEstablishments(company, state, naics, year);
  return result.records;
}''',
    "Employer OSHA wrapper",
)
employer = replace_once(
    employer,
    "  const oshaRecords = getOshaEstablishments(companyName, state, naics);",
    "  const oshaRecords = await getOshaEstablishments(companyName, state, naics);",
    "Employer entity OSHA lookup",
)
employer = replace_once(
    employer,
    'router.get("/osha/establishments", (req: Request, res: Response) => {',
    'router.get("/osha/establishments", async (req: Request, res: Response) => {',
    "OSHA route async",
)
employer = replace_once(
    employer,
    "    const result = queryOshaEstablishments(\n      company || undefined,",
    "    const result = await queryOshaEstablishments(\n      company || undefined,",
    "OSHA route await",
)
employer = employer.replace(
    'result.dataSource === "cached-json" ? "OSHA ITA (cached/imported)" : "OSHA ITA (not imported)"',
    'result.dataSource === "database" ? "OSHA ITA (Postgres)" : "OSHA ITA (not imported)"',
)
employer = replace_once(
    employer,
    'router.get("/sources/status", (_req: Request, res: Response) => {',
    'router.get("/sources/status", async (_req: Request, res: Response) => {',
    "Source status async",
)
employer = replace_once(
    employer,
    "    const oshaImportInfo = getOshaImportInfo();\n    const oshaDataImported = isOshaDataImported();",
    "    const [oshaImportInfo, oshaDataImported] = await Promise.all([getOshaImportInfo(), isOshaDataImported()]);",
    "Source status OSHA awaits",
)
employer = employer.replace(
    'dataType: "live-api" | "cached-import" | "static-index" | "not-configured";',
    'dataType: "live-api" | "cached-import" | "database-import" | "static-index" | "not-configured";',
)
employer = employer.replace(
    'dataType: oshaDataImported ? "cached-import" : isTruthy(getEnv("OSHA_ITA_IMPORT_ENABLED")) ? "cached-import" : "not-configured"',
    'dataType: oshaDataImported ? "database-import" : isTruthy(getEnv("OSHA_ITA_IMPORT_ENABLED")) ? "database-import" : "not-configured"',
)
employer = employer.replace(
    "Cached import from data/osha-ita/.",
    "Persisted in Postgres.",
)
write(employer_path, employer)

# 4. Make Source Governance async and report database persistence accurately.
governance_path = "artifacts/api-server/src/routes/source-governance.ts"
governance = read(governance_path)
governance = governance.replace('"cached-import"', '"database-import"')
governance = replace_once(governance, "function getRegistry(): GovernedSource[] {", "async function getRegistry(): Promise<GovernedSource[]> {", "Registry async")
governance = replace_once(
    governance,
    "  const oshaImported = isOshaDataImported();\n  const oshaInfo = getOshaImportInfo();",
    "  const [oshaImported, oshaInfo] = await Promise.all([isOshaDataImported(), getOshaImportInfo()]);",
    "Governance OSHA awaits",
)
governance = governance.replace(
    'environmentKeys: ["OSHA_ITA_IMPORT_ENABLED", "OSHA_DATA_DIR"]',
    'environmentKeys: ["OSHA_ITA_IMPORT_ENABLED", "DATABASE_URL"]',
)
governance = governance.replace("Manual cached import only", "Transactional database import")
governance = replace_once(
    governance,
    'router.get("/source-governance/overview", (_req: Request, res: Response) => {',
    'router.get("/source-governance/overview", async (_req: Request, res: Response) => {',
    "Governance route async",
)
governance = replace_once(governance, "    const sources = getRegistry();", "    const sources = await getRegistry();", "Governance registry await")
write(governance_path, governance)

# 5. Make Data Visualization use the async database service and remove JSON-cache language.
visual_path = "artifacts/api-server/src/services/dataVisualizationFeedService.ts"
visual = read(visual_path)
visual = replace_once(visual, "  const dataImported = isOshaDataImported();", "  const dataImported = await isOshaDataImported();", "Visualization imported await")
visual = replace_once(visual, "    const result = queryOshaEstablishments(", "    const result = await queryOshaEstablishments(", "Visualization query await")
visual = visual.replace("cached JSON import", "database-backed import")
visual = visual.replace("OSHA ITA cached data", "OSHA ITA database persistence")
visual = visual.replace("cached OSHA ITA import", "database-backed OSHA ITA import")
write(visual_path, visual)

# 6. Remove obsolete file-cache configuration from deployment and docs.
render_path = "render.yaml"
render = read(render_path)
render = render.replace("      - key: OSHA_DATA_DIR\n        sync: false\n", "")
write(render_path, render)

readme_path = "README.md"
readme = read(readme_path)
readme = readme.replace("OSHA_DATA_DIR", "DATABASE_URL")
readme = readme.replace("cached JSON", "Postgres")
readme = readme.replace("JSON cache", "database persistence")
readme = readme.replace("cached import", "database import")
write(readme_path, readme)

# 7. Add a permanent audit so neither regression can silently return.
audit_path = "scripts/osha-persistence-audit.mjs"
write(
    audit_path,
    '''import fs from "node:fs";

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
''',
)

# 8. Wire the permanent audit into root build and CI.
root_package_path = "package.json"
root_package = json.loads(read(root_package_path))
root_package["scripts"]["audit:osha-persistence"] = "node scripts/osha-persistence-audit.mjs"
root_package["scripts"]["build"] = root_package["scripts"]["build"].replace(
    "pnpm run audit:ui-hardening &&",
    "pnpm run audit:ui-hardening && pnpm run audit:osha-persistence &&",
)
write(root_package_path, json.dumps(root_package, indent=2) + "\n")

workflow_path = ".github/workflows/build-check.yml"
workflow = read(workflow_path)
workflow = replace_once(
    workflow,
    "      - name: Typecheck\n        run: pnpm run typecheck\n\n      - name: Production build",
    "      - name: Typecheck\n        run: pnpm run typecheck\n\n      - name: React 19 map and OSHA persistence audit\n        run: pnpm run audit:osha-persistence\n\n      - name: Production build",
    "Build Check persistence audit",
)
write(workflow_path, workflow)

print("Applied React 19 map and OSHA database persistence integration patches.")
