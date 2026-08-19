type DbModule = typeof import("@workspace/db");

let dbModulePromise: Promise<DbModule> | null = null;
let ensurePromise: Promise<void> | null = null;

type OiicsItem = { code: string; name: string; count: number };
type OiicsProfileRow = {
  dataset_year: number;
  soc_code: string;
  soc_description: string;
  case_count: number;
  coded_body_part_cases: number;
  coded_nature_cases: number;
  coded_event_cases: number;
  coded_source_cases: number;
  coded_secondary_source_cases: number;
  body_parts: unknown;
  natures: unknown;
  events: unknown;
  sources: unknown;
  secondary_sources: unknown;
};

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
  oiicsYear: number | null;
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
  oiicsYear: number | null;
  oiicsCaseCount: number;
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

        CREATE TABLE IF NOT EXISTS osha_oiics_occupation_profiles (
          dataset_year integer NOT NULL,
          soc_code text NOT NULL,
          soc_description text NOT NULL DEFAULT '',
          case_count integer NOT NULL DEFAULT 0,
          coded_body_part_cases integer NOT NULL DEFAULT 0,
          coded_nature_cases integer NOT NULL DEFAULT 0,
          coded_event_cases integer NOT NULL DEFAULT 0,
          coded_source_cases integer NOT NULL DEFAULT 0,
          coded_secondary_source_cases integer NOT NULL DEFAULT 0,
          body_parts jsonb NOT NULL DEFAULT '[]'::jsonb,
          natures jsonb NOT NULL DEFAULT '[]'::jsonb,
          events jsonb NOT NULL DEFAULT '[]'::jsonb,
          sources jsonb NOT NULL DEFAULT '[]'::jsonb,
          secondary_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
          source_url text NOT NULL,
          imported_at timestamp NOT NULL DEFAULT now(),
          PRIMARY KEY (dataset_year, soc_code)
        );

        CREATE INDEX IF NOT EXISTS osha_case_details_year_idx ON osha_case_details(year_of_filing);
        CREATE INDEX IF NOT EXISTS osha_case_details_state_idx ON osha_case_details(state);
        CREATE INDEX IF NOT EXISTS osha_case_details_naics_idx ON osha_case_details(naics_code);
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

function parseOiicsItems(value: unknown): OiicsItem[] {
  let parsed = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { parsed = []; }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const code = String(row.code ?? "").trim();
      const name = String(row.name ?? row.title ?? "").trim();
      const count = Number(row.count ?? 0);
      if ((!code && !name) || !Number.isFinite(count) || count <= 0) return null;
      return { code, name: name || "Unclassified / unavailable", count };
    })
    .filter((item): item is OiicsItem => Boolean(item));
}

function withShares(items: OiicsItem[], denominator: number) {
  return items.map((item) => ({
    ...item,
    share: denominator > 0 ? Number(((item.count / denominator) * 100).toFixed(1)) : 0,
  }));
}

async function latestOiicsProfile(socCode: string): Promise<OiicsProfileRow | null> {
  const { pool } = await getDbModule();
  const normalized = normalizeSocBase(socCode);
  if (!normalized) return null;
  const result = await pool.query<OiicsProfileRow>(`
    SELECT dataset_year, soc_code, soc_description, case_count,
      coded_body_part_cases, coded_nature_cases, coded_event_cases,
      coded_source_cases, coded_secondary_source_cases,
      body_parts, natures, events, sources, secondary_sources
    FROM osha_oiics_occupation_profiles
    WHERE soc_code = $1
    ORDER BY dataset_year DESC
    LIMIT 1
  `, [normalized]);
  return result.rows[0] ?? null;
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

  const [outcomes, types, occupations, trend, oiicsResult] = await Promise.all([
    pool.query<{ code: number; count: string; days_away: string; restricted_days: string }>(`
      SELECT incident_outcome::int AS code, COUNT(*)::text AS count,
        COALESCE(SUM(GREATEST(COALESCE(days_away,0),0)),0)::text AS days_away,
        COALESCE(SUM(GREATEST(COALESCE(restricted_days,0),0)),0)::text AS restricted_days
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
      SELECT COALESCE(soc_code,'') AS code, COALESCE(NULLIF(soc_description,''), NULLIF(job_description,''), 'Occupation not classified') AS name, COUNT(*)::text AS count
      FROM osha_case_details ${yearOnly}
      GROUP BY soc_code, soc_description, job_description ORDER BY COUNT(*) DESC LIMIT 25
    `, params),
    pool.query<{ year: number; cases: string; days_away: string; restricted_days: string }>(`
      SELECT year_of_filing::int AS year, COUNT(*)::text AS cases,
        COALESCE(SUM(GREATEST(COALESCE(days_away,0),0)),0)::text AS days_away,
        COALESCE(SUM(GREATEST(COALESCE(restricted_days,0),0)),0)::text AS restricted_days
      FROM osha_case_details WHERE year_of_filing IS NOT NULL
      GROUP BY year_of_filing ORDER BY year_of_filing
    `),
    pool.query<OiicsProfileRow>(`
      SELECT dataset_year, soc_code, soc_description, case_count,
        coded_body_part_cases, coded_nature_cases, coded_event_cases,
        coded_source_cases, coded_secondary_source_cases,
        body_parts, natures, events, sources, secondary_sources
      FROM osha_oiics_occupation_profiles
      WHERE soc_code = '*'
      ORDER BY dataset_year DESC
      LIMIT 1
    `),
  ]);

  const oiics = oiicsResult.rows[0] ?? null;
  const mappedOccupations = occupations.rows.map((row) => ({ code: row.code, name: row.name, count: Number(row.count) }));
  return {
    totalCases: imported.totalCases,
    years: imported.years,
    latestYear,
    oiicsYear: oiics ? Number(oiics.dataset_year) : null,
    outcomeCounts: outcomes.rows.map((row) => ({ name: outcomeLabel(Number(row.code)), count: Number(row.count), daysAway: Number(row.days_away), restrictedDays: Number(row.restricted_days) })),
    incidentTypes: types.rows.map((row) => ({ name: incidentTypeLabel(Number(row.code)), count: Number(row.count) })),
    natures: oiics ? parseOiicsItems(oiics.natures) : [],
    bodyParts: oiics ? parseOiicsItems(oiics.body_parts) : [],
    events: oiics ? parseOiicsItems(oiics.events) : [],
    sources: oiics ? parseOiicsItems(oiics.sources) : [],
    secondarySources: oiics ? parseOiicsItems(oiics.secondary_sources) : [],
    occupations: mappedOccupations,
    trend: trend.rows.map((row) => ({ year: Number(row.year), cases: Number(row.cases), daysAway: Number(row.days_away), restrictedDays: Number(row.restricted_days) })),
  };
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
    days_away: string;
    restricted_days: string;
    matched_soc: string | null;
    occupation_name: string | null;
  }>(`
    SELECT COUNT(*)::text AS total_cases,
      COALESCE(SUM(GREATEST(COALESCE(days_away,0),0)),0)::text AS days_away,
      COALESCE(SUM(GREATEST(COALESCE(restricted_days,0),0)),0)::text AS restricted_days,
      MODE() WITHIN GROUP (ORDER BY NULLIF(soc_code,'')) AS matched_soc,
      MODE() WITHIN GROUP (ORDER BY COALESCE(NULLIF(soc_description,''), NULLIF(job_description,''))) AS occupation_name
    FROM osha_case_details
    WHERE ${selectedWhere}
  `, selectedParams);

  const totalCases = Number(summary.rows[0]?.total_cases ?? 0);
  if (totalCases === 0) return null;

  const resolvedSoc = normalizeSocBase(summary.rows[0]?.matched_soc ?? socBase);
  let oiics = resolvedSoc ? await latestOiicsProfile(resolvedSoc) : null;
  if (!oiics && occupationTitle) {
    const normalized = normalizeOccupationSearch(occupationTitle);
    const strongest = normalized.split(" ").filter((token) => token.length >= 4).sort((a, b) => b.length - a.length)[0];
    if (strongest) {
      const fallback = await pool.query<OiicsProfileRow>(`
        SELECT dataset_year, soc_code, soc_description, case_count,
          coded_body_part_cases, coded_nature_cases, coded_event_cases,
          coded_source_cases, coded_secondary_source_cases,
          body_parts, natures, events, sources, secondary_sources
        FROM osha_oiics_occupation_profiles
        WHERE LOWER(soc_description) LIKE $1
        ORDER BY dataset_year DESC, case_count DESC
        LIMIT 1
      `, [`%${strongest}%`]);
      oiics = fallback.rows[0] ?? null;
    }
  }

  const codedBodyPartCases = Number(oiics?.coded_body_part_cases ?? 0);
  const codedNatureCases = Number(oiics?.coded_nature_cases ?? 0);
  const codedEventCases = Number(oiics?.coded_event_cases ?? 0);
  const codedSourceCases = Number(oiics?.coded_source_cases ?? 0);

  const [outcomes, industries, trend] = await Promise.all([
    pool.query<{ code: number; count: string }>(`
      SELECT incident_outcome::int AS code, COUNT(*)::text AS count
      FROM osha_case_details
      WHERE ${selectedWhere} AND incident_outcome IS NOT NULL
      GROUP BY incident_outcome ORDER BY COUNT(*) DESC
    `, selectedParams),
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
        COALESCE(SUM(GREATEST(COALESCE(days_away,0),0)),0)::text AS days_away,
        COALESCE(SUM(GREATEST(COALESCE(restricted_days,0),0)),0)::text AS restricted_days
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
    oiicsYear: oiics ? Number(oiics.dataset_year) : null,
    oiicsCaseCount: Number(oiics?.case_count ?? 0),
    totalCases,
    codedBodyPartCases,
    codedNatureCases,
    codedEventCases,
    codedSourceCases,
    totalDaysAway: Number(summary.rows[0]?.days_away ?? 0),
    totalRestrictedDays: Number(summary.rows[0]?.restricted_days ?? 0),
    outcomes: outcomes.rows.map((row) => ({ name: outcomeLabel(Number(row.code)), count: Number(row.count) })),
    bodyParts: oiics ? withShares(parseOiicsItems(oiics.body_parts), codedBodyPartCases) : [],
    natures: oiics ? withShares(parseOiicsItems(oiics.natures), codedNatureCases) : [],
    events: oiics ? withShares(parseOiicsItems(oiics.events), codedEventCases) : [],
    sources: oiics ? withShares(parseOiicsItems(oiics.sources), codedSourceCases) : [],
    industries: industries.rows.map((row) => ({ name: row.name, naics: row.naics, count: Number(row.count) })),
    trend: trend.rows.map((row) => ({ year: Number(row.year), cases: Number(row.cases), daysAway: Number(row.days_away), restrictedDays: Number(row.restricted_days) })),
  };
}
