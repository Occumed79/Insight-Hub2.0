type DbModule = typeof import("@workspace/db");

let dbModulePromise: Promise<DbModule> | null = null;
let ensurePromise: Promise<void> | null = null;

export type OshaCaseImportInfo = {
  totalCases: number;
  years: number[];
  latestImport?: string;
  storage: "postgres" | "unconfigured";
};

export type OshaCaseOverview = {
  totalCases: number;
  years: number[];
  latestYear: number | null;
  outcomeCounts: Array<{ name: string; count: number; daysAway: number; restrictedDays: number }>;
  incidentTypes: Array<{ name: string; count: number }>;
  natures: Array<{ name: string; code: string; count: number }>;
  bodyParts: Array<{ name: string; code: string; count: number }>;
  events: Array<{ name: string; code: string; count: number }>;
  sources: Array<{ name: string; code: string; count: number }>;
  secondarySources: Array<{ name: string; code: string; count: number }>;
  occupations: Array<{ name: string; code: string; count: number }>;
  trend: Array<{ year: number; cases: number; daysAway: number; restrictedDays: number }>;
};

async function getDbModule(): Promise<DbModule> {
  if (!dbModulePromise) dbModulePromise = import("@workspace/db");
  return dbModulePromise;
}

function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function ensureOshaCasePersistence(): Promise<void> {
  if (!dbConfigured()) throw new Error("DATABASE_URL is required for OSHA case-detail persistence.");
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const { pool } = await getDbModule();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS osha_case_import_runs (
          id serial PRIMARY KEY,
          dataset_name text NOT NULL,
          dataset_year integer NOT NULL,
          source_url text NOT NULL,
          imported_at timestamp NOT NULL DEFAULT now(),
          record_count integer NOT NULL DEFAULT 0,
          sha256 text,
          metadata jsonb
        );

        CREATE TABLE IF NOT EXISTS osha_case_details (
          id serial PRIMARY KEY,
          import_run_id integer NOT NULL REFERENCES osha_case_import_runs(id) ON DELETE CASCADE,
          source_record_id text,
          source_establishment_id text,
          establishment_name text NOT NULL DEFAULT '',
          company_name text NOT NULL DEFAULT '',
          ein text,
          street_address text,
          city text,
          state text,
          zip_code text,
          naics_code text,
          naics_year integer,
          industry_description text,
          establishment_type integer,
          establishment_size integer,
          annual_average_employees integer,
          total_hours_worked bigint,
          case_number text,
          date_of_incident text,
          incident_outcome integer,
          days_away integer,
          restricted_days integer,
          type_of_incident integer,
          time_started_work text,
          time_of_incident text,
          time_unknown integer,
          date_of_death text,
          created_timestamp text,
          year_of_filing integer,
          job_description text,
          soc_code text,
          soc_description text,
          soc_probability real,
          soc_reviewed integer,
          unexpected_naics_soc_combo text,
          incident_location text,
          incident_description text,
          narrative_before_incident text,
          narrative_what_happened text,
          narrative_injury_illness text,
          narrative_object_substance text,
          nature_code text,
          nature_title text,
          body_part_code text,
          body_part_title text,
          event_code text,
          event_title text,
          source_code text,
          source_title text,
          secondary_source_code text,
          secondary_source_title text,
          dataset_name text NOT NULL,
          dataset_year integer NOT NULL,
          source_url text NOT NULL,
          imported_at timestamp NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS osha_case_details_year_idx ON osha_case_details(year_of_filing);
        CREATE INDEX IF NOT EXISTS osha_case_details_state_idx ON osha_case_details(state);
        CREATE INDEX IF NOT EXISTS osha_case_details_naics_idx ON osha_case_details(naics_code);
        CREATE INDEX IF NOT EXISTS osha_case_details_company_idx ON osha_case_details(company_name);
        CREATE INDEX IF NOT EXISTS osha_case_details_establishment_idx ON osha_case_details(source_establishment_id);
        CREATE INDEX IF NOT EXISTS osha_case_details_soc_idx ON osha_case_details(soc_code);
        CREATE INDEX IF NOT EXISTS osha_case_details_nature_idx ON osha_case_details(nature_code);
        CREATE INDEX IF NOT EXISTS osha_case_details_part_idx ON osha_case_details(body_part_code);
        CREATE INDEX IF NOT EXISTS osha_case_details_event_idx ON osha_case_details(event_code);
        CREATE INDEX IF NOT EXISTS osha_case_details_source_idx ON osha_case_details(source_code);
        CREATE UNIQUE INDEX IF NOT EXISTS osha_case_details_dataset_record_unique_idx
          ON osha_case_details(dataset_name, dataset_year, source_record_id)
          WHERE source_record_id IS NOT NULL AND source_record_id <> '';
      `);
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  await ensurePromise;
}

export async function getOshaCaseImportInfo(): Promise<OshaCaseImportInfo> {
  if (!dbConfigured()) return { totalCases: 0, years: [], storage: "unconfigured" };
  await ensureOshaCasePersistence();
  const { pool } = await getDbModule();
  const [countResult, yearsResult, importResult] = await Promise.all([
    pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM osha_case_details"),
    pool.query<{ year: number }>("SELECT DISTINCT year_of_filing::int AS year FROM osha_case_details WHERE year_of_filing IS NOT NULL ORDER BY year_of_filing"),
    pool.query<{ imported_at: Date | string }>("SELECT imported_at FROM osha_case_import_runs ORDER BY imported_at DESC LIMIT 1"),
  ]);
  const latest = importResult.rows[0]?.imported_at;
  return {
    totalCases: Number(countResult.rows[0]?.count ?? 0),
    years: yearsResult.rows.map((row) => Number(row.year)).filter(Number.isFinite),
    latestImport: latest ? new Date(latest).toISOString() : undefined,
    storage: "postgres",
  };
}

function outcomeLabel(value: number): string {
  if (value === 1) return "Death";
  if (value === 2) return "Days away from work";
  if (value === 3) return "Job transfer / restriction";
  if (value === 4) return "Other recordable case";
  return `Outcome ${value}`;
}

function incidentTypeLabel(value: number): string {
  if (value === 1) return "Injury";
  if (value === 2) return "Skin disorder";
  if (value === 3) return "Respiratory condition";
  if (value === 4) return "Poisoning";
  if (value === 5) return "Hearing loss";
  if (value === 6) return "All other illness";
  return `Type ${value}`;
}

export async function getOshaCaseOverview(year?: number): Promise<OshaCaseOverview | null> {
  if (!dbConfigured()) return null;
  await ensureOshaCasePersistence();
  const { pool } = await getDbModule();
  const imported = await getOshaCaseImportInfo();
  if (imported.totalCases === 0) return null;

  const latestYear = imported.years.length ? imported.years[imported.years.length - 1] : null;
  const selectedYear = year && Number.isFinite(year) ? year : latestYear;
  const where = selectedYear ? "WHERE year_of_filing = $1" : "";
  const params = selectedYear ? [selectedYear] : [];

  const [outcomes, types, natures, parts, events, sources, secondary, occupations, trend] = await Promise.all([
    pool.query<{ code: number; count: string; days_away: string; restricted_days: string }>(`
      SELECT incident_outcome::int AS code, COUNT(*)::text AS count,
        COALESCE(SUM(days_away),0)::text AS days_away,
        COALESCE(SUM(restricted_days),0)::text AS restricted_days
      FROM osha_case_details ${where}
      WHERE incident_outcome IS NOT NULL ${where ? "AND year_of_filing = $1" : ""}
      GROUP BY incident_outcome ORDER BY COUNT(*) DESC
    `.replace(`${where}\n      WHERE`, "WHERE"), params),
    pool.query<{ code: number; count: string }>(`
      SELECT type_of_incident::int AS code, COUNT(*)::text AS count
      FROM osha_case_details
      ${selectedYear ? "WHERE year_of_filing = $1 AND" : "WHERE"} type_of_incident IS NOT NULL
      GROUP BY type_of_incident ORDER BY COUNT(*) DESC
    `, params),
    pool.query<{ code: string; name: string; count: string }>(`
      SELECT COALESCE(nature_code,'') AS code, COALESCE(NULLIF(nature_title,''),'Unclassified / unavailable') AS name, COUNT(*)::text AS count
      FROM osha_case_details
      ${selectedYear ? "WHERE year_of_filing = $1" : ""}
      GROUP BY nature_code, nature_title ORDER BY COUNT(*) DESC LIMIT 20
    `, params),
    pool.query<{ code: string; name: string; count: string }>(`
      SELECT COALESCE(body_part_code,'') AS code, COALESCE(NULLIF(body_part_title,''),'Unclassified / unavailable') AS name, COUNT(*)::text AS count
      FROM osha_case_details
      ${selectedYear ? "WHERE year_of_filing = $1" : ""}
      GROUP BY body_part_code, body_part_title ORDER BY COUNT(*) DESC LIMIT 20
    `, params),
    pool.query<{ code: string; name: string; count: string }>(`
      SELECT COALESCE(event_code,'') AS code, COALESCE(NULLIF(event_title,''),'Unclassified / unavailable') AS name, COUNT(*)::text AS count
      FROM osha_case_details
      ${selectedYear ? "WHERE year_of_filing = $1" : ""}
      GROUP BY event_code, event_title ORDER BY COUNT(*) DESC LIMIT 20
    `, params),
    pool.query<{ code: string; name: string; count: string }>(`
      SELECT COALESCE(source_code,'') AS code, COALESCE(NULLIF(source_title,''),'Unclassified / unavailable') AS name, COUNT(*)::text AS count
      FROM osha_case_details
      ${selectedYear ? "WHERE year_of_filing = $1" : ""}
      GROUP BY source_code, source_title ORDER BY COUNT(*) DESC LIMIT 20
    `, params),
    pool.query<{ code: string; name: string; count: string }>(`
      SELECT COALESCE(secondary_source_code,'') AS code, COALESCE(NULLIF(secondary_source_title,''),'Unclassified / unavailable') AS name, COUNT(*)::text AS count
      FROM osha_case_details
      ${selectedYear ? "WHERE year_of_filing = $1" : ""}
      GROUP BY secondary_source_code, secondary_source_title ORDER BY COUNT(*) DESC LIMIT 20
    `, params),
    pool.query<{ code: string; name: string; count: string }>(`
      SELECT COALESCE(soc_code,'') AS code, COALESCE(NULLIF(soc_description,''), NULLIF(job_description,''), 'Occupation not classified') AS name, COUNT(*)::text AS count
      FROM osha_case_details
      ${selectedYear ? "WHERE year_of_filing = $1" : ""}
      GROUP BY soc_code, soc_description, job_description ORDER BY COUNT(*) DESC LIMIT 25
    `, params),
    pool.query<{ year: number; cases: string; days_away: string; restricted_days: string }>(`
      SELECT year_of_filing::int AS year, COUNT(*)::text AS cases,
        COALESCE(SUM(days_away),0)::text AS days_away,
        COALESCE(SUM(restricted_days),0)::text AS restricted_days
      FROM osha_case_details WHERE year_of_filing IS NOT NULL
      GROUP BY year_of_filing ORDER BY year_of_filing
    `),
  ]);

  const mappedClassifications = (rows: Array<{ code: string; name: string; count: string }>) => rows.map((row) => ({ code: row.code, name: row.name, count: Number(row.count) }));

  return {
    totalCases: imported.totalCases,
    years: imported.years,
    latestYear,
    outcomeCounts: outcomes.rows.map((row) => ({ name: outcomeLabel(Number(row.code)), count: Number(row.count), daysAway: Number(row.days_away), restrictedDays: Number(row.restricted_days) })),
    incidentTypes: types.rows.map((row) => ({ name: incidentTypeLabel(Number(row.code)), count: Number(row.count) })),
    natures: mappedClassifications(natures.rows),
    bodyParts: mappedClassifications(parts.rows),
    events: mappedClassifications(events.rows),
    sources: mappedClassifications(sources.rows),
    secondarySources: mappedClassifications(secondary.rows),
    occupations: mappedClassifications(occupations.rows),
    trend: trend.rows.map((row) => ({ year: Number(row.year), cases: Number(row.cases), daysAway: Number(row.days_away), restrictedDays: Number(row.restricted_days) })),
  };
}
