/**
 * OSHA ITA Establishment-Specific Injury & Illness Data Layer
 *
 * OSHA publishes establishment-level ITA data as downloadable files rather than
 * a key-based API. Hub 2 imports those files into Postgres and queries Postgres
 * at runtime. JSON files are no longer a runtime persistence layer.
 */

type DbModule = typeof import("@workspace/db");

let dbModulePromise: Promise<DbModule> | null = null;
let ensurePromise: Promise<void> | null = null;

export type OshaEstablishmentRecord = {
  id?: number;
  establishmentName: string;
  companyName: string;
  dbaName?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  naics: string;
  year: number;
  totalHoursWorked?: number;
  totalCases?: number;
  dartCases?: number;
  daysAwayCases?: number;
  jobTransferRestrictionCases?: number;
  caseCategories?: string[];
  sourceUrl: string;
  datasetName: string;
  datasetYear: number;
  sourceFileType: string;
  lastImportedDate: string;
  trcRate?: number;
  dartRate?: number;
  daysAwayRate?: number;
};

export type OshaImportRun = {
  id?: number;
  datasetName: string;
  datasetYear: number;
  sourceUrl: string;
  sourceFileType: string;
  importedAt: string;
  recordCount: number;
};

export type OshaQueryResult = {
  records: OshaEstablishmentRecord[];
  count: number;
  importRuns: OshaImportRun[];
  dataSource: "database" | "none";
  warning: string;
};

type OshaDbRow = {
  id: number;
  establishment_name: string;
  company_name: string;
  dba_name: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  naics: string;
  year: number;
  total_hours_worked: number | null;
  total_cases: number | null;
  dart_cases: number | null;
  days_away_cases: number | null;
  job_transfer_restriction_cases: number | null;
  case_categories: unknown;
  source_url: string;
  dataset_name: string;
  dataset_year: number;
  source_file_type: string;
  last_imported_date: Date | string;
  trc_rate: number | null;
  dart_rate: number | null;
  days_away_rate: number | null;
};

type ImportRunDbRow = {
  id: number;
  dataset_name: string;
  dataset_year: number;
  source_url: string;
  source_file_type: string;
  imported_at: Date | string;
  record_count: number;
};

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  return ["true", "1", "yes", "on"].includes(value.toLowerCase());
}

function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

async function getDbModule(): Promise<DbModule> {
  if (!dbModulePromise) dbModulePromise = import("@workspace/db");
  return dbModulePromise;
}

export function calculateRate(cases: number, hours: number): number | undefined {
  if (!hours || hours === 0) return undefined;
  return Number(((cases * 200000) / hours).toFixed(2));
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[,.]/g, " ")
    .replace(/\b(inc|llc|corp|corporation|co|company|ltd|limited|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;

  const wordsA = na.split(" ").filter(Boolean);
  const wordsB = nb.split(" ").filter(Boolean);
  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  const common = wordsA.filter((word) => wordsB.includes(word));
  return Math.min(common.length / Math.max(wordsA.length, wordsB.length), 0.8);
}

export async function ensureOshaPersistence(): Promise<void> {
  if (!dbConfigured()) throw new Error("DATABASE_URL is required for OSHA persistence.");

  if (!ensurePromise) {
    ensurePromise = (async () => {
      const { pool } = await getDbModule();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS osha_import_runs (
          id serial PRIMARY KEY,
          dataset_name text NOT NULL,
          dataset_year integer NOT NULL,
          source_url text NOT NULL,
          source_file_type text NOT NULL,
          imported_at timestamp NOT NULL DEFAULT now(),
          record_count integer NOT NULL DEFAULT 0,
          metadata jsonb
        );

        CREATE TABLE IF NOT EXISTS osha_source_files (
          id serial PRIMARY KEY,
          import_run_id integer NOT NULL REFERENCES osha_import_runs(id) ON DELETE CASCADE,
          file_name text NOT NULL,
          source_url text NOT NULL,
          source_file_type text NOT NULL,
          dataset_year integer NOT NULL,
          sha256 text,
          imported_at timestamp NOT NULL DEFAULT now(),
          metadata jsonb
        );

        CREATE TABLE IF NOT EXISTS osha_establishments (
          id serial PRIMARY KEY,
          import_run_id integer NOT NULL REFERENCES osha_import_runs(id) ON DELETE CASCADE,
          source_file_id integer REFERENCES osha_source_files(id) ON DELETE SET NULL,
          establishment_name text NOT NULL,
          company_name text NOT NULL,
          dba_name text,
          normalized_establishment_name text NOT NULL,
          normalized_company_name text NOT NULL,
          normalized_dba_name text,
          address text NOT NULL DEFAULT '',
          city text NOT NULL DEFAULT '',
          state text NOT NULL DEFAULT '',
          zip text NOT NULL DEFAULT '',
          naics text NOT NULL DEFAULT '',
          year integer NOT NULL,
          total_hours_worked integer,
          total_cases integer,
          dart_cases integer,
          days_away_cases integer,
          job_transfer_restriction_cases integer,
          case_categories jsonb,
          trc_rate real,
          dart_rate real,
          days_away_rate real,
          source_url text NOT NULL,
          dataset_name text NOT NULL,
          dataset_year integer NOT NULL,
          source_file_type text NOT NULL,
          last_imported_date timestamp NOT NULL DEFAULT now(),
          created_at timestamp NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS employer_aliases (
          id serial PRIMARY KEY,
          canonical_name text NOT NULL,
          normalized_canonical_name text NOT NULL,
          alias text NOT NULL,
          normalized_alias text NOT NULL,
          source text NOT NULL DEFAULT 'manual',
          confidence real NOT NULL DEFAULT 1,
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS osha_entity_matches (
          id serial PRIMARY KEY,
          osha_establishment_id integer NOT NULL REFERENCES osha_establishments(id) ON DELETE CASCADE,
          entity_id integer,
          canonical_name text NOT NULL,
          matched_name text NOT NULL,
          match_type text NOT NULL DEFAULT 'name',
          confidence real NOT NULL DEFAULT 0,
          reviewed boolean NOT NULL DEFAULT false,
          metadata jsonb,
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS osha_establishments_state_idx ON osha_establishments(state);
        CREATE INDEX IF NOT EXISTS osha_establishments_year_idx ON osha_establishments(year);
        CREATE INDEX IF NOT EXISTS osha_establishments_naics_idx ON osha_establishments(naics);
        CREATE INDEX IF NOT EXISTS osha_establishments_company_norm_idx ON osha_establishments(normalized_company_name);
        CREATE INDEX IF NOT EXISTS osha_establishments_establishment_norm_idx ON osha_establishments(normalized_establishment_name);
        CREATE INDEX IF NOT EXISTS osha_establishments_dba_norm_idx ON osha_establishments(normalized_dba_name);
        CREATE INDEX IF NOT EXISTS osha_import_runs_dataset_idx ON osha_import_runs(dataset_name, dataset_year);
        CREATE UNIQUE INDEX IF NOT EXISTS employer_aliases_unique_idx
          ON employer_aliases(normalized_canonical_name, normalized_alias);
        CREATE INDEX IF NOT EXISTS employer_aliases_alias_idx ON employer_aliases(normalized_alias);
        CREATE INDEX IF NOT EXISTS osha_entity_matches_establishment_idx ON osha_entity_matches(osha_establishment_id);
        CREATE INDEX IF NOT EXISTS osha_entity_matches_entity_idx ON osha_entity_matches(entity_id);
      `);
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }

  await ensurePromise;
}

function asIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function optionalNumber(value: number | null): number | undefined {
  return value === null || value === undefined ? undefined : Number(value);
}

function mapImportRun(row: ImportRunDbRow): OshaImportRun {
  return {
    id: row.id,
    datasetName: row.dataset_name,
    datasetYear: Number(row.dataset_year),
    sourceUrl: row.source_url,
    sourceFileType: row.source_file_type,
    importedAt: asIso(row.imported_at),
    recordCount: Number(row.record_count),
  };
}

function mapEstablishment(row: OshaDbRow): OshaEstablishmentRecord {
  const categories = Array.isArray(row.case_categories)
    ? row.case_categories.filter((value): value is string => typeof value === "string")
    : [];

  const record: OshaEstablishmentRecord = {
    id: row.id,
    establishmentName: row.establishment_name,
    companyName: row.company_name,
    dbaName: row.dba_name || undefined,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    naics: row.naics,
    year: Number(row.year),
    totalHoursWorked: optionalNumber(row.total_hours_worked),
    totalCases: optionalNumber(row.total_cases),
    dartCases: optionalNumber(row.dart_cases),
    daysAwayCases: optionalNumber(row.days_away_cases),
    jobTransferRestrictionCases: optionalNumber(row.job_transfer_restriction_cases),
    caseCategories: categories.length ? categories : undefined,
    sourceUrl: row.source_url,
    datasetName: row.dataset_name,
    datasetYear: Number(row.dataset_year),
    sourceFileType: row.source_file_type,
    lastImportedDate: asIso(row.last_imported_date),
    trcRate: optionalNumber(row.trc_rate),
    dartRate: optionalNumber(row.dart_rate),
    daysAwayRate: optionalNumber(row.days_away_rate),
  };

  if (record.trcRate === undefined && record.totalCases !== undefined && record.totalHoursWorked !== undefined) {
    record.trcRate = calculateRate(record.totalCases, record.totalHoursWorked);
  }
  if (record.dartRate === undefined && record.dartCases !== undefined && record.totalHoursWorked !== undefined) {
    record.dartRate = calculateRate(record.dartCases, record.totalHoursWorked);
  }
  if (record.daysAwayRate === undefined && record.daysAwayCases !== undefined && record.totalHoursWorked !== undefined) {
    record.daysAwayRate = calculateRate(record.daysAwayCases, record.totalHoursWorked);
  }

  return record;
}

async function readImportRuns(): Promise<OshaImportRun[]> {
  if (!dbConfigured()) return [];
  await ensureOshaPersistence();
  const { pool } = await getDbModule();
  const result = await pool.query<ImportRunDbRow>(`
    SELECT id, dataset_name, dataset_year, source_url, source_file_type, imported_at, record_count
    FROM osha_import_runs
    ORDER BY imported_at ASC, id ASC
  `);
  return result.rows.map(mapImportRun);
}

export async function queryOshaEstablishments(
  company?: string,
  state?: string,
  naics?: string,
  year?: string,
): Promise<OshaQueryResult> {
  if (!dbConfigured()) {
    return {
      records: [],
      count: 0,
      importRuns: [],
      dataSource: "none",
      warning: "OSHA ITA persistence requires DATABASE_URL.",
    };
  }

  await ensureOshaPersistence();
  const { pool } = await getDbModule();
  const importRuns = await readImportRuns();
  const imported = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM osha_establishments");
  const totalImported = Number(imported.rows[0]?.count ?? 0);

  if (totalImported === 0) {
    return {
      records: [],
      count: 0,
      importRuns,
      dataSource: "none",
      warning: isTruthy(process.env.OSHA_ITA_IMPORT_ENABLED)
        ? "OSHA ITA database persistence is enabled, but no dataset has been imported yet. Run pnpm --filter @workspace/api-server import:osha -- --input <file.csv>."
        : "No OSHA ITA dataset is stored yet. Enable OSHA_ITA_IMPORT_ENABLED and run the database importer.",
    };
  }

  const filters: string[] = [];
  const params: unknown[] = [];
  const addParam = (value: unknown): string => {
    params.push(value);
    return `$${params.length}`;
  };

  if (year) {
    const parsedYear = Number(year);
    if (Number.isFinite(parsedYear)) {
      const ref = addParam(parsedYear);
      filters.push(`(year = ${ref} OR dataset_year = ${ref})`);
    }
  }
  if (state?.trim()) filters.push(`UPPER(state) = UPPER(${addParam(state.trim())})`);
  if (naics?.trim()) filters.push(`naics LIKE ${addParam(`${naics.trim()}%`)}`);

  let matchNames: string[] = [];
  if (company?.trim()) {
    const companyName = company.trim();
    const companyNorm = normalizeName(companyName);
    matchNames = [companyName];

    const aliasRows = await pool.query<{ canonical_name: string; alias: string }>(
      `
        SELECT canonical_name, alias
        FROM employer_aliases
        WHERE normalized_alias LIKE $1 OR normalized_canonical_name LIKE $1
        ORDER BY confidence DESC, updated_at DESC
        LIMIT 100
      `,
      [`%${companyNorm}%`],
    );
    for (const row of aliasRows.rows) matchNames.push(row.canonical_name, row.alias);

    const searchTokens = [
      ...new Set(
        matchNames
          .flatMap((name) => normalizeName(name).split(" "))
          .filter((token) => token.length >= 3)
          .sort((a, b) => b.length - a.length),
      ),
    ].slice(0, 12);

    if (searchTokens.length > 0) {
      const tokenClauses = searchTokens.map((token) => {
        const ref = addParam(`%${token}%`);
        return `(normalized_establishment_name LIKE ${ref} OR normalized_company_name LIKE ${ref} OR COALESCE(normalized_dba_name, '') LIKE ${ref})`;
      });
      filters.push(`(${tokenClauses.join(" OR ")})`);
    }
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const result = await pool.query<OshaDbRow>(
    `
      SELECT id, establishment_name, company_name, dba_name, address, city, state, zip, naics, year,
        total_hours_worked, total_cases, dart_cases, days_away_cases, job_transfer_restriction_cases,
        case_categories, source_url, dataset_name, dataset_year, source_file_type, last_imported_date,
        trc_rate, dart_rate, days_away_rate
      FROM osha_establishments
      ${where}
      ORDER BY year DESC, establishment_name ASC
      LIMIT 5000
    `,
    params,
  );

  let records = result.rows.map(mapEstablishment);
  if (company?.trim()) {
    const candidates = matchNames.length ? matchNames : [company.trim()];
    records = records.filter((record) =>
      candidates.some((candidate) => {
        const establishment = nameSimilarity(candidate, record.establishmentName);
        const companyScore = nameSimilarity(candidate, record.companyName);
        const dbaScore = record.dbaName ? nameSimilarity(candidate, record.dbaName) : 0;
        return Math.max(establishment, companyScore, dbaScore) >= 0.5;
      }),
    );
  }

  return {
    records,
    count: records.length,
    importRuns,
    dataSource: "database",
    warning: "OSHA/public injury data is persisted as source evidence for human review. It must not be used to declare a company unsafe, negligent, dangerous, or noncompliant.",
  };
}

export async function getOshaImportInfo(): Promise<{ importRuns: OshaImportRun[]; totalRecords: number; storage: "postgres" | "unconfigured" }> {
  if (!dbConfigured()) return { importRuns: [], totalRecords: 0, storage: "unconfigured" };

  await ensureOshaPersistence();
  const { pool } = await getDbModule();
  const [importRuns, total] = await Promise.all([
    readImportRuns(),
    pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM osha_establishments"),
  ]);
  return { importRuns, totalRecords: Number(total.rows[0]?.count ?? 0), storage: "postgres" };
}

export async function isOshaDataImported(): Promise<boolean> {
  if (!dbConfigured()) return false;
  await ensureOshaPersistence();
  const { pool } = await getDbModule();
  const result = await pool.query<{ imported: boolean }>("SELECT EXISTS (SELECT 1 FROM osha_establishments LIMIT 1) AS imported");
  return Boolean(result.rows[0]?.imported);
}

export async function reloadOshaCache(): Promise<void> {
  await ensureOshaPersistence();
}

export async function upsertEmployerAlias(canonicalName: string, alias: string, source = "manual", confidence = 1): Promise<void> {
  await ensureOshaPersistence();
  const { pool } = await getDbModule();
  const canonical = canonicalName.trim();
  const aliasName = alias.trim();
  if (!canonical || !aliasName) return;

  await pool.query(
    `
      INSERT INTO employer_aliases (canonical_name, normalized_canonical_name, alias, normalized_alias, source, confidence, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, now())
      ON CONFLICT (normalized_canonical_name, normalized_alias)
      DO UPDATE SET canonical_name = EXCLUDED.canonical_name, alias = EXCLUDED.alias, source = EXCLUDED.source,
        confidence = EXCLUDED.confidence, updated_at = now()
    `,
    [canonical, normalizeName(canonical), aliasName, normalizeName(aliasName), source, confidence],
  );
}

export async function recordOshaEntityMatch(input: {
  oshaEstablishmentId: number;
  entityId?: number;
  canonicalName: string;
  matchedName: string;
  matchType?: string;
  confidence: number;
  reviewed?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<number> {
  await ensureOshaPersistence();
  const { pool } = await getDbModule();
  const result = await pool.query<{ id: number }>(
    `
      INSERT INTO osha_entity_matches (osha_establishment_id, entity_id, canonical_name, matched_name, match_type, confidence, reviewed, metadata, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, now())
      RETURNING id
    `,
    [input.oshaEstablishmentId, input.entityId ?? null, input.canonicalName, input.matchedName, input.matchType ?? "name", input.confidence, input.reviewed ?? false, JSON.stringify(input.metadata ?? {})],
  );
  return result.rows[0].id;
}
