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

export type OshaOccupationCaseProfile = {
  matchedBy: "soc" | "occupation-title";
  requestedSocCode: string;
  matchedSocCode: string;
  occupationTitle: string;
  selectedYear: number | null;
  totalCases: number;
  codedBodyPartCases: number;
  codedNatureCases: number;
  codedEventCases: number;
  codedSourceCases: number;
  totalDaysAway: number;
  totalRestrictedDays: number;
  outcomes: Array<{ name: string; count: number }>;
  bodyParts: Array<{ name: string; code: string; count: number; share: number }>;
  natures: Array<{ name: string; code: string; count: number; share: number }>;
  events: Array<{ name: string; code: string; count: number; share: number }>;
  sources: Array<{ name: string; code: string; count: number; share: number }>;
  industries: Array<{ name: string; naics: string; count: number }>;
  trend: Array<{ year: number; cases: number; daysAway: number; restrictedDays: number }>;
};

async function getDbModule(): Promise<DbModule> {
  if (!dbModulePromise) dbModulePromise = import("@workspace/db");
  return dbModulePromise;
}

function dbConfigured(): boolean { return Boolean(process.env.DATABASE_URL); }

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
    })().catch((error) => { ensurePromise = null; throw error; });
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
  const yearPrefix = selectedYear ? "year_of_filing = $1 AND " : "";
  const yearOnly = selectedYear ? "WHERE year_of_filing = $1" : "";
  const params = selectedYear ? [selectedYear] : [];

  const [outcomes, types, natures, parts, events, sources, secondary, occupations, trend] = await Promise.all([
    pool.query<{ code: number; count: string; days_away: string; restricted_days: string }>(`
      SELECT incident_outcome::int AS code, COUNT(*)::text AS count,
        COALESCE(SUM(days_away),0)::text AS days_away,
        COALESCE(SUM(restricted_days),0)::text AS restricted_days
      FROM osha_case_details
      WHERE ${yearPrefix} incident_outcome IS NOT NULL
      GROUP BY incident_outcome ORDER BY COUNT(*) DESC
    `, params),
    pool.query<{ code: number; count: string }>(`
      SELECT type_of_incident::int AS code, COUNT(*)::text AS count
      FROM osha_case_details
      WHERE ${yearPrefix} type_of_incident IS NOT NULL
      GROUP BY type_of_incident ORDER BY COUNT(*) DESC
    `, params),
    pool.query<{ code: string; name: string; count: string }>(`
      SELECT COALESCE(nature_code,'') AS code, COALESCE(NULLIF(nature_title,''),'Unclassified / unavailable') AS name, COUNT(*)::text AS count
      FROM osha_case_details ${yearOnly}
      GROUP BY nature_code, nature_title ORDER BY COUNT(*) DESC LIMIT 20
    `, params),
    pool.query<{ code: string; name: string; count: string }>(`
      SELECT COALESCE(body_part_code,'') AS code, COALESCE(NULLIF(body_part_title,''),'Unclassified / unavailable') AS name, COUNT(*)::text AS count
      FROM osha_case_details ${yearOnly}
      GROUP BY body_part_code, body_part_title ORDER BY COUNT(*) DESC LIMIT 20
    `, params),
    pool.query<{ code: string; name: string; count: string }>(`
      SELECT COALESCE(event_code,'') AS code, COALESCE(NULLIF(event_title,''),'Unclassified / unavailable') AS name, COUNT(*)::text AS count
      FROM osha_case_details ${yearOnly}
      GROUP BY event_code, event_title ORDER BY COUNT(*) DESC LIMIT 20
    `, params),
    pool.query<{ code: string; name: string; count: string }>(`
      SELECT COALESCE(source_code,'') AS code, COALESCE(NULLIF(source_title,''),'Unclassified / unavailable') AS name, COUNT(*)::text AS count
      FROM osha_case_details ${yearOnly}
      GROUP BY source_code, source_title ORDER BY COUNT(*) DESC LIMIT 20
    `, params),
    pool.query<{ code: string; name: string; count: string }>(`
      SELECT COALESCE(secondary_source_code,'') AS code, COALESCE(NULLIF(secondary_source_title,''),'Unclassified / unavailable') AS name, COUNT(*)::text AS count
      FROM osha_case_details ${yearOnly}
      GROUP BY secondary_source_code, secondary_source_title ORDER BY COUNT(*) DESC LIMIT 20
    `, params),
    pool.query<{ code: string; name: string; count: string }>(`
      SELECT COALESCE(soc_code,'') AS code, COALESCE(NULLIF(soc_description,''), NULLIF(job_description,''), 'Occupation not classified') AS name, COUNT(*)::text AS count
      FROM osha_case_details ${yearOnly}
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

  const mapped = (rows: Array<{ code: string; name: string; count: string }>) => rows.map((row) => ({ code: row.code, name: row.name, count: Number(row.count) }));
  return {
    totalCases: imported.totalCases,
    years: imported.years,
    latestYear,
    outcomeCounts: outcomes.rows.map((row) => ({ name: outcomeLabel(Number(row.code)), count: Number(row.count), daysAway: Number(row.days_away), restrictedDays: Number(row.restricted_days) })),
    incidentTypes: types.rows.map((row) => ({ name: incidentTypeLabel(Number(row.code)), count: Number(row.count) })),
    natures: mapped(natures.rows),
    bodyParts: mapped(parts.rows),
    events: mapped(events.rows),
    sources: mapped(sources.rows),
    secondarySources: mapped(secondary.rows),
    occupations: mapped(occupations.rows),
    trend: trend.rows.map((row) => ({ year: Number(row.year), cases: Number(row.cases), daysAway: Number(row.days_away), restrictedDays: Number(row.restricted_days) })),
  };
}

function normalizeSocBase(value: string): string {
  const match = value.trim().match(/\d{2}-\d{4}/);
  return match?.[0] ?? "";
}

function normalizeOccupationSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[(),]/g, " ")
    .replace(/\b(and|the|of|workers|worker)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getOshaOccupationCaseProfile(input: {
  socCode?: string;
  occupationTitle?: string;
  year?: number;
}): Promise<OshaOccupationCaseProfile | null> {
  if (!dbConfigured()) return null;
  await ensureOshaCasePersistence();
  const { pool } = await getDbModule();
  const imported = await getOshaCaseImportInfo();
  if (imported.totalCases === 0) return null;

  const latestYear = imported.years.length ? imported.years[imported.years.length - 1] : null;
  const selectedYear = input.year && Number.isFinite(input.year) ? input.year : latestYear;
  const requestedSocCode = input.socCode?.trim() ?? "";
  const socBase = normalizeSocBase(requestedSocCode);
  const occupationTitle = input.occupationTitle?.trim() ?? "";

  let matchedBy: OshaOccupationCaseProfile["matchedBy"] = "soc";
  let matchSql = "";
  let matchParams: unknown[] = [];

  if (socBase) {
    const count = await pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM osha_case_details WHERE soc_code LIKE $1",
      [`${socBase}%`],
    );
    if (Number(count.rows[0]?.count ?? 0) > 0) {
      matchSql = "soc_code LIKE $1";
      matchParams = [`${socBase}%`];
    }
  }

  if (!matchSql && occupationTitle) {
    matchedBy = "occupation-title";
    const normalized = normalizeOccupationSearch(occupationTitle);
    const strongest = normalized.split(" ").filter((token) => token.length >= 4).sort((a, b) => b.length - a.length)[0];
    if (strongest) {
      matchSql = "(LOWER(COALESCE(soc_description,'')) LIKE $1 OR LOWER(COALESCE(job_description,'')) LIKE $1)";
      matchParams = [`%${strongest}%`];
    }
  }

  if (!matchSql) return null;

  const selectedParams = [...matchParams];
  let selectedWhere = matchSql;
  if (selectedYear) {
    selectedParams.push(selectedYear);
    selectedWhere = `(${matchSql}) AND year_of_filing = $${selectedParams.length}`;
  }

  const summary = await pool.query<{
    total_cases: string;
    coded_body: string;
    coded_nature: string;
    coded_event: string;
    coded_source: string;
    days_away: string;
    restricted_days: string;
    matched_soc: string | null;
    occupation_name: string | null;
  }>(`
    SELECT COUNT(*)::text AS total_cases,
      COUNT(*) FILTER (WHERE NULLIF(body_part_title,'') IS NOT NULL)::text AS coded_body,
      COUNT(*) FILTER (WHERE NULLIF(nature_title,'') IS NOT NULL)::text AS coded_nature,
      COUNT(*) FILTER (WHERE NULLIF(event_title,'') IS NOT NULL)::text AS coded_event,
      COUNT(*) FILTER (WHERE NULLIF(source_title,'') IS NOT NULL)::text AS coded_source,
      COALESCE(SUM(days_away),0)::text AS days_away,
      COALESCE(SUM(restricted_days),0)::text AS restricted_days,
      MODE() WITHIN GROUP (ORDER BY NULLIF(soc_code,'')) AS matched_soc,
      MODE() WITHIN GROUP (ORDER BY COALESCE(NULLIF(soc_description,''), NULLIF(job_description,''))) AS occupation_name
    FROM osha_case_details
    WHERE ${selectedWhere}
  `, selectedParams);

  const totalCases = Number(summary.rows[0]?.total_cases ?? 0);
  if (totalCases === 0) return null;
  const codedBodyPartCases = Number(summary.rows[0]?.coded_body ?? 0);
  const codedNatureCases = Number(summary.rows[0]?.coded_nature ?? 0);
  const codedEventCases = Number(summary.rows[0]?.coded_event ?? 0);
  const codedSourceCases = Number(summary.rows[0]?.coded_source ?? 0);

  const grouped = async (codeColumn: string, titleColumn: string, denominator: number) => {
    const result = await pool.query<{ code: string; name: string; count: string }>(`
      SELECT COALESCE(${codeColumn},'') AS code,
        COALESCE(NULLIF(${titleColumn},''),'Unclassified / unavailable') AS name,
        COUNT(*)::text AS count
      FROM osha_case_details
      WHERE ${selectedWhere} AND NULLIF(${titleColumn},'') IS NOT NULL
      GROUP BY ${codeColumn}, ${titleColumn}
      ORDER BY COUNT(*) DESC
      LIMIT 12
    `, selectedParams);
    return result.rows.map((row) => {
      const count = Number(row.count);
      return { code: row.code, name: row.name, count, share: denominator > 0 ? Number(((count / denominator) * 100).toFixed(1)) : 0 };
    });
  };

  const [outcomes, bodyParts, natures, events, sources, industries, trend] = await Promise.all([
    pool.query<{ code: number; count: string }>(`
      SELECT incident_outcome::int AS code, COUNT(*)::text AS count
      FROM osha_case_details
      WHERE ${selectedWhere} AND incident_outcome IS NOT NULL
      GROUP BY incident_outcome ORDER BY COUNT(*) DESC
    `, selectedParams),
    grouped("body_part_code", "body_part_title", codedBodyPartCases),
    grouped("nature_code", "nature_title", codedNatureCases),
    grouped("event_code", "event_title", codedEventCases),
    grouped("source_code", "source_title", codedSourceCases),
    pool.query<{ name: string; naics: string; count: string }>(`
      SELECT COALESCE(NULLIF(industry_description,''),'Industry not reported') AS name,
        COALESCE(naics_code,'') AS naics,
        COUNT(*)::text AS count
      FROM osha_case_details
      WHERE ${selectedWhere}
      GROUP BY industry_description, naics_code
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `, selectedParams),
    pool.query<{ year: number; cases: string; days_away: string; restricted_days: string }>(`
      SELECT year_of_filing::int AS year, COUNT(*)::text AS cases,
        COALESCE(SUM(days_away),0)::text AS days_away,
        COALESCE(SUM(restricted_days),0)::text AS restricted_days
      FROM osha_case_details
      WHERE ${matchSql} AND year_of_filing IS NOT NULL
      GROUP BY year_of_filing ORDER BY year_of_filing
    `, matchParams),
  ]);

  return {
    matchedBy,
    requestedSocCode,
    matchedSocCode: summary.rows[0]?.matched_soc ?? socBase,
    occupationTitle: summary.rows[0]?.occupation_name ?? occupationTitle,
    selectedYear,
    totalCases,
    codedBodyPartCases,
    codedNatureCases,
    codedEventCases,
    codedSourceCases,
    totalDaysAway: Number(summary.rows[0]?.days_away ?? 0),
    totalRestrictedDays: Number(summary.rows[0]?.restricted_days ?? 0),
    outcomes: outcomes.rows.map((row) => ({ name: outcomeLabel(Number(row.code)), count: Number(row.count) })),
    bodyParts,
    natures,
    events,
    sources,
    industries: industries.rows.map((row) => ({ name: row.name, naics: row.naics, count: Number(row.count) })),
    trend: trend.rows.map((row) => ({ year: Number(row.year), cases: Number(row.cases), daysAway: Number(row.days_away), restrictedDays: Number(row.restricted_days) })),
  };
}
