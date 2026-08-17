import { Router, type IRouter, type Request, type Response } from "express";
import { fetchBlsBenchmark } from "../services/blsService";
import {
  ensureOshaPersistence,
  getOshaImportInfo,
} from "../services/oshaDataService";

const router: IRouter = Router();

const DATA_GOV_URL = "https://catalog.data.gov/api/3/action/package_search";
const ONET_BASE_URL = "https://api-v2.onetcenter.org";
const CACHE_TTL_MS = 20 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; value: unknown }>();

const BLS_SECTORS = [
  { id: "construction", naics: "23", label: "Construction", description: "Construction trades, contractors, field crews, and project workforces." },
  { id: "manufacturing", naics: "31", label: "Manufacturing", description: "Production, fabrication, maintenance, and industrial operations." },
  { id: "transportation", naics: "48", label: "Transportation & Warehousing", description: "Drivers, aviation, warehousing, transit, logistics, and material movement." },
  { id: "healthcare", naics: "62", label: "Healthcare & Social Assistance", description: "Clinical, support, patient-handling, and care-delivery workforces." },
  { id: "mining", naics: "21", label: "Mining / Oil & Gas", description: "Extraction, drilling, field service, and heavy industrial workforces." },
  { id: "utilities", naics: "22", label: "Utilities", description: "Electric, water, gas, power-generation, and field maintenance workforces." },
  { id: "administrative", naics: "56", label: "Facilities / Support Services", description: "Facilities, remediation, waste, security-support, and administrative support work." },
  { id: "accommodation", naics: "72", label: "Accommodation & Food", description: "Food service, hospitality, and large distributed service workforces." },
] as const;

const WORKFORCE_GROUPS = [
  {
    id: "skilled-trades",
    label: "Skilled Trades",
    description: "Occupations commonly seen in industrial, facilities, construction, and overseas-support workforces.",
    occupations: ["Electrician", "HVAC mechanic", "Plumber", "Welder", "Industrial machinery mechanic", "Maintenance and repair worker"],
  },
  {
    id: "transportation",
    label: "Transportation & Mobile Equipment",
    description: "Driving, aviation, transit, material movement, and mobile-equipment roles.",
    occupations: ["Heavy truck driver", "Bus driver", "Aircraft mechanic", "Mobile heavy equipment mechanic", "Industrial truck operator", "Commercial pilot"],
  },
  {
    id: "emergency-safety",
    label: "Emergency & Safety",
    description: "Emergency response and safety-sensitive public-protection roles.",
    occupations: ["Firefighter", "Emergency medical technician", "Security guard", "Police officer", "Emergency management director"],
  },
  {
    id: "facilities-logistics",
    label: "Facilities / LOGCAP-Type Workforce",
    description: "Roles common to installation support, base operations, logistics, and facilities contracts.",
    occupations: ["Facilities manager", "Food service manager", "Cook", "Warehouse worker", "Grounds maintenance worker", "Water treatment operator"],
  },
  {
    id: "construction-field",
    label: "Construction & Field Operations",
    description: "Field occupations with meaningful physical and environmental demands.",
    occupations: ["Construction laborer", "Carpenter", "Operating engineer", "Roofer", "Line installer", "Construction manager"],
  },
  {
    id: "public-works",
    label: "Public Works & Infrastructure",
    description: "High-value public-agency roles relevant to DOT, utility, municipal, and infrastructure programs.",
    occupations: ["Highway maintenance worker", "Civil engineering technician", "Traffic technician", "Refuse collector", "Water treatment operator", "Heavy equipment operator"],
  },
] as const;

const SERVICE_OPPORTUNITIES = [
  {
    id: "hearing",
    label: "Hearing Conservation / Audiometry",
    description: "Surface occupations with explicit noise, hearing, auditory-attention, or warning-signal evidence.",
    occupations: ["Aircraft mechanic", "Construction laborer", "Machinist", "Welder", "Firefighter", "Heavy equipment operator"],
    terms: ["noise", "hearing sensitivity", "auditory attention", "sound localization", "warning signal"],
  },
  {
    id: "respirator",
    label: "Respirator / Respiratory Programs",
    description: "Surface occupations with contaminant, dust, fume, hazardous-atmosphere, PPE, or respiratory evidence.",
    occupations: ["Welder", "Painter", "Construction laborer", "Hazardous materials removal worker", "Firefighter", "Industrial machinery mechanic"],
    terms: ["contaminant", "dust", "fume", "chemical", "hazardous", "protective equipment", "respiratory"],
  },
  {
    id: "physical",
    label: "Physical Ability / Functional Testing",
    description: "Surface occupations with lifting, carrying, climbing, strength, material-handling, posture, or mobility demands.",
    occupations: ["Warehouse worker", "Construction laborer", "Firefighter", "Aircraft mechanic", "Electrician", "Heavy truck driver"],
    terms: ["lifting", "carrying", "climbing", "static strength", "dynamic strength", "handling and moving objects", "standing", "walking", "crawling", "kneeling", "crouching"],
  },
  {
    id: "driver",
    label: "Driver / Safety-Sensitive Exams",
    description: "Surface occupations involving vehicle operation, mobile equipment, vigilance, reaction, or public-safety duties.",
    occupations: ["Heavy truck driver", "Bus driver", "Ambulance driver", "Industrial truck operator", "Police officer", "Mobile heavy equipment mechanic"],
    terms: ["operating vehicles", "driving", "vehicle", "reaction time", "control precision", "selective attention", "time sharing"],
  },
  {
    id: "heat",
    label: "Heat & Environmental Exposure",
    description: "Surface occupations with outdoor work, heat, weather, PPE, or strenuous environmental demands.",
    occupations: ["Construction laborer", "Roofer", "Firefighter", "Grounds maintenance worker", "Line installer", "Highway maintenance worker"],
    terms: ["extreme heat", "very hot", "outdoors", "weather", "protective equipment", "stamina"],
  },
  {
    id: "vision",
    label: "Vision-Demand Review",
    description: "Surface occupations with visual-acuity, depth-perception, peripheral-vision, inspection, or mobile-equipment demands.",
    occupations: ["Commercial pilot", "Heavy truck driver", "Electrician", "Aircraft mechanic", "Crane operator", "Police officer"],
    terms: ["near vision", "far vision", "depth perception", "peripheral vision", "night vision", "glare sensitivity", "visual color discrimination"],
  },
  {
    id: "fatigue",
    label: "Fatigue / Shift-Work Exposure",
    description: "Surface occupations where vigilance, emergency response, driving, time pressure, or around-the-clock operations matter.",
    occupations: ["Firefighter", "Emergency medical technician", "Heavy truck driver", "Bus driver", "Security guard", "Power plant operator"],
    terms: ["time pressure", "emergency", "driving", "operating vehicles", "selective attention", "time sharing", "night"],
  },
  {
    id: "surveillance",
    label: "Medical Surveillance Review",
    description: "Surface jobs with occupational evidence that may justify a closer look at exposure-specific surveillance requirements.",
    occupations: ["Hazardous materials removal worker", "Welder", "Painter", "Firefighter", "Construction laborer", "Water treatment operator"],
    terms: ["contaminant", "hazardous", "radiation", "infection", "noise", "chemical", "protective equipment", "fume", "dust"],
  },
] as const;

const DATAGOV_COLLECTIONS = [
  {
    id: "injury-illness",
    label: "Employee Injury & Illness",
    query: "occupational injury illness workplace employee",
    why: "Find public injury, illness, recordkeeping, and workforce-safety datasets.",
    analyses: ["Trend", "Geography", "Employer/agency", "Industry", "Severity"],
  },
  {
    id: "workers-comp",
    label: "Workers’ Compensation",
    query: "workers compensation claims benefits return to work occupational",
    why: "Find state and federal claims, benefits, disability, and return-to-work data.",
    analyses: ["Claims trend", "Benefit trend", "State comparison", "Lost time"],
  },
  {
    id: "federal-workforce",
    label: "Federal Workforce / FECA",
    query: "federal employee injury FECA workers compensation workforce",
    why: "Surface federal employee injury, compensation, and workforce datasets.",
    analyses: ["Agency ranking", "Trend", "Case volume", "Geography"],
  },
  {
    id: "overseas-contractors",
    label: "Overseas Contractors / DBA",
    query: "Defense Base Act overseas contractor injury claims",
    why: "Surface overseas-contractor injury and DBA-related public data.",
    analyses: ["Employer", "Nation", "Year", "Claim type"],
  },
  {
    id: "hearing-noise",
    label: "Hearing / Noise",
    query: "occupational noise hearing loss worker exposure",
    why: "Find hearing-loss, noise-exposure, and occupational surveillance datasets.",
    analyses: ["Industry", "Occupation", "Trend", "Exposure"],
  },
  {
    id: "respiratory",
    label: "Respiratory / Silica / Asbestos",
    query: "occupational respiratory silica asbestos exposure worker",
    why: "Find occupational respiratory disease and exposure datasets.",
    analyses: ["Exposure", "Industry", "Geography", "Disease trend"],
  },
  {
    id: "heat",
    label: "Heat Stress",
    query: "occupational heat stress worker heat illness",
    why: "Find heat-related worker illness, environmental, and occupational datasets.",
    analyses: ["Season", "Geography", "Industry", "Weather linkage"],
  },
  {
    id: "transportation",
    label: "Transportation Worker Safety",
    query: "transportation worker safety injury DOT employee",
    why: "Surface transportation, DOT, transit, fleet, and worker-safety data.",
    analyses: ["Agency", "State", "Injury trend", "Workforce"],
  },
  {
    id: "aging-chronic",
    label: "Aging Workforce / Chronic Conditions",
    query: "aging workforce chronic disease employee occupational health",
    why: "Find demographic and chronic-condition context useful for aggregate workforce planning.",
    analyses: ["Age band", "Condition", "Geography", "Trend"],
  },
  {
    id: "fatalities-severe",
    label: "Fatalities / Severe Events",
    query: "occupational fatality severe injury workplace hospitalization",
    why: "Find fatality and high-consequence workplace event datasets.",
    analyses: ["Industry", "Occupation", "Event", "Geography", "Trend"],
  },
] as const;

const BUSINESS_QUESTIONS = [
  { id: "where-hurt", title: "Where are workers getting hurt?", description: "Open OSHA injury burden, location, industry, and trend views.", source: "osha" },
  { id: "high-burden", title: "Which employers show the largest reported injury burden?", description: "Open prepared OSHA employer and establishment rankings.", source: "osha" },
  { id: "industry-opportunity", title: "Which industries create the greatest occupational-health opportunity?", description: "Open live BLS SOII benchmark rankings across priority industries.", source: "bls" },
  { id: "job-services", title: "What services might a job require us to evaluate?", description: "Browse O*NET by Occu-Med service opportunity instead of guessing a job-title search.", source: "onet" },
  { id: "physical-jobs", title: "Which jobs have meaningful physical demands?", description: "Open the O*NET physical-demand occupation library.", source: "onet", serviceId: "physical" },
  { id: "noise-jobs", title: "Which jobs have noise / hearing evidence?", description: "Open the O*NET hearing-conservation library.", source: "onet", serviceId: "hearing" },
  { id: "respirator-jobs", title: "Which jobs may involve respiratory / PPE evidence?", description: "Open the O*NET respirator and respiratory-program library.", source: "onet", serviceId: "respirator" },
  { id: "public-data", title: "What public datasets exist that we have not exploited yet?", description: "Open the curated Occu-Med Data.gov collections with live previews.", source: "datagov" },
] as const;

function cleanText(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function cached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit || hit.expiresAt <= Date.now()) return null;
  return hit.value as T;
}

function remember(key: string, value: unknown, ttl = CACHE_TTL_MS): void {
  cache.set(key, { expiresAt: Date.now() + ttl, value });
}

async function fetchJson(url: string, options: RequestInit = {}, timeoutMs = 18_000): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function sourceInventory(oshaInfo: Awaited<ReturnType<typeof getOshaImportInfo>>) {
  return [
    {
      id: "osha",
      source: "OSHA ITA",
      status: oshaInfo.totalRecords > 0 ? "integrated" : "available-not-imported",
      dataFamilies: [
        { name: "Form 300A establishment summaries", coverage: "2016–current published years", status: oshaInfo.totalRecords > 0 ? "Query-ready imported rows" : "Official source available; database currently empty" },
        { name: "Form 300/301 case detail", coverage: "2023–current published years", status: "Official source available; case-detail importer not yet wired into this workspace" },
        { name: "OIICS-coded injury characteristics", coverage: "Available in recent case-detail releases", status: "Source identified; not yet persisted by the current summary importer" },
      ],
      officialUrl: "https://www.osha.gov/Establishment-Specific-Injury-and-Illness-Data",
    },
    {
      id: "bls",
      source: "BLS SOII / IIF",
      status: "live",
      dataFamilies: [
        { name: "Industry incidence rates", coverage: "Current and historical SOII series", status: "Live BLS API" },
        { name: "TRC / DART / days-away rates", coverage: "Priority private-industry sectors", status: "Live BLS API" },
      ],
      officialUrl: "https://www.bls.gov/iif/",
    },
    {
      id: "onet",
      source: "O*NET Web Services",
      status: process.env.ONET_API_KEY ? "live" : "configuration-required",
      dataFamilies: [
        { name: "Tasks", coverage: "Occupation-specific", status: "Live O*NET v2 when configured" },
        { name: "Work context", coverage: "Standardized context + respondent percentages where available", status: "Live O*NET v2 when configured" },
        { name: "Abilities / work activities / detailed activities", coverage: "Occupation-specific", status: "Live O*NET v2 when configured" },
      ],
      officialUrl: "https://services.onetcenter.org/reference/online",
    },
    {
      id: "datagov",
      source: "Data.gov",
      status: "live-catalog",
      dataFamilies: DATAGOV_COLLECTIONS.map((collection) => ({ name: collection.label, coverage: "Government-wide catalog discovery", status: "Live metadata search; underlying data remains agency-owned" })),
      officialUrl: "https://catalog.data.gov/",
    },
    {
      id: "owcp-dba",
      source: "OWCP / Defense Base Act",
      status: "available-in-insight-hub",
      dataFamilies: [{ name: "DBA employer and nation reports", coverage: "Historical OWCP reports", status: "Handled by the separate DBA intelligence workspace" }],
      officialUrl: "https://www.dol.gov/agencies/owcp/dlhwc",
    },
    {
      id: "hhs-cms",
      source: "HHS / CMS public catalogs",
      status: "available-in-insight-hub",
      dataFamilies: [{ name: "Health and provider public-data catalogs", coverage: "Catalog-dependent", status: "Existing separate HHS/CMS connectors remain available" }],
      officialUrl: "https://healthdata.gov/",
    },
  ];
}

router.get("/occupational-discovery/manifest", async (_req: Request, res: Response) => {
  let oshaInfo: Awaited<ReturnType<typeof getOshaImportInfo>> = { importRuns: [], totalRecords: 0, storage: "unconfigured" };
  try {
    oshaInfo = await getOshaImportInfo();
  } catch {
    // Manifest must still render when the database is unavailable.
  }
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    principle: "Curated intelligence first; browsing and prepared analyses before free-text search.",
    businessQuestions: BUSINESS_QUESTIONS,
    blsSectors: BLS_SECTORS,
    workforceGroups: WORKFORCE_GROUPS,
    serviceOpportunities: SERVICE_OPPORTUNITIES.map(({ terms: _terms, ...item }) => item),
    dataGovCollections: DATAGOV_COLLECTIONS,
    sources: sourceInventory(oshaInfo),
  });
});

router.get("/occupational-discovery/bls-overview", async (_req: Request, res: Response) => {
  const cacheKey = "bls-overview";
  const hit = cached<unknown>(cacheKey);
  if (hit) return res.json(hit);

  const settled = await Promise.allSettled(
    BLS_SECTORS.map(async (sector) => ({
      sector,
      result: await fetchBlsBenchmark(sector.naics),
    })),
  );

  const sectors = settled.map((entry, index) => {
    const sector = BLS_SECTORS[index];
    if (entry.status === "rejected") return { ...sector, benchmark: null, message: "BLS request failed for this sector." };
    return {
      ...sector,
      benchmark: entry.value.result.benchmark,
      message: entry.value.result.reason,
    };
  });

  const ranked = sectors
    .filter((sector) => typeof sector.benchmark?.trcRate === "number")
    .sort((a, b) => (b.benchmark?.trcRate ?? 0) - (a.benchmark?.trcRate ?? 0));

  const payload = {
    ok: true,
    generatedAt: new Date().toISOString(),
    sectors,
    ranked,
    source: "BLS SOII live API",
    limitation: "These are aggregate industry benchmarks, not employer findings. Rankings compare only the curated priority sectors returned successfully in this request.",
  };
  remember(cacheKey, payload, 15 * 60 * 1000);
  return res.json(payload);
});

router.get("/occupational-discovery/osha-overview", async (_req: Request, res: Response) => {
  if (!process.env.DATABASE_URL) {
    return res.json({ ok: true, configured: false, imported: false, summary: null, warning: "DATABASE_URL is not configured for OSHA persistence." });
  }

  try {
    await ensureOshaPersistence();
    const { pool } = await import("@workspace/db");
    const importInfo = await getOshaImportInfo();
    if (importInfo.totalRecords === 0) {
      return res.json({ ok: true, configured: true, imported: false, importInfo, summary: null, warning: "No OSHA ITA summary rows are currently imported." });
    }

    const latestYearResult = await pool.query<{ year: number | null }>("SELECT MAX(year)::int AS year FROM osha_establishments");
    const latestYear = Number(latestYearResult.rows[0]?.year ?? 0);

    const [trend, employers, states, industries, establishments] = await Promise.all([
      pool.query(`
        SELECT year::int AS year,
          COUNT(*)::int AS establishments,
          COALESCE(SUM(total_cases),0)::bigint AS total_cases,
          COALESCE(SUM(dart_cases),0)::bigint AS dart_cases,
          COALESCE(SUM(days_away_cases),0)::bigint AS days_away_cases,
          COALESCE(SUM(job_transfer_restriction_cases),0)::bigint AS restriction_cases,
          COALESCE(SUM(total_hours_worked),0)::bigint AS hours,
          CASE WHEN COALESCE(SUM(total_hours_worked),0) > 0 THEN ROUND((COALESCE(SUM(total_cases),0)::numeric * 200000 / SUM(total_hours_worked))::numeric, 2) ELSE NULL END AS trc_rate,
          CASE WHEN COALESCE(SUM(total_hours_worked),0) > 0 THEN ROUND((COALESCE(SUM(dart_cases),0)::numeric * 200000 / SUM(total_hours_worked))::numeric, 2) ELSE NULL END AS dart_rate
        FROM osha_establishments
        GROUP BY year
        ORDER BY year ASC
      `),
      pool.query(`
        SELECT company_name AS name,
          COUNT(*)::int AS establishments,
          COALESCE(SUM(total_cases),0)::bigint AS total_cases,
          COALESCE(SUM(dart_cases),0)::bigint AS dart_cases,
          COALESCE(SUM(total_hours_worked),0)::bigint AS hours,
          CASE WHEN COALESCE(SUM(total_hours_worked),0) > 0 THEN ROUND((COALESCE(SUM(total_cases),0)::numeric * 200000 / SUM(total_hours_worked))::numeric, 2) ELSE NULL END AS trc_rate
        FROM osha_establishments
        WHERE year = $1
        GROUP BY company_name
        HAVING COALESCE(SUM(total_hours_worked),0) > 0
        ORDER BY total_cases DESC, trc_rate DESC NULLS LAST
        LIMIT 15
      `, [latestYear]),
      pool.query(`
        SELECT state AS name,
          COUNT(*)::int AS establishments,
          COALESCE(SUM(total_cases),0)::bigint AS total_cases,
          COALESCE(SUM(dart_cases),0)::bigint AS dart_cases,
          COALESCE(SUM(total_hours_worked),0)::bigint AS hours,
          CASE WHEN COALESCE(SUM(total_hours_worked),0) > 0 THEN ROUND((COALESCE(SUM(total_cases),0)::numeric * 200000 / SUM(total_hours_worked))::numeric, 2) ELSE NULL END AS trc_rate
        FROM osha_establishments
        WHERE year = $1 AND state <> ''
        GROUP BY state
        HAVING COALESCE(SUM(total_hours_worked),0) > 0
        ORDER BY total_cases DESC
        LIMIT 15
      `, [latestYear]),
      pool.query(`
        SELECT SUBSTRING(naics FROM 1 FOR 2) AS name,
          COUNT(*)::int AS establishments,
          COALESCE(SUM(total_cases),0)::bigint AS total_cases,
          COALESCE(SUM(dart_cases),0)::bigint AS dart_cases,
          COALESCE(SUM(total_hours_worked),0)::bigint AS hours,
          CASE WHEN COALESCE(SUM(total_hours_worked),0) > 0 THEN ROUND((COALESCE(SUM(total_cases),0)::numeric * 200000 / SUM(total_hours_worked))::numeric, 2) ELSE NULL END AS trc_rate
        FROM osha_establishments
        WHERE year = $1 AND LENGTH(naics) >= 2
        GROUP BY SUBSTRING(naics FROM 1 FOR 2)
        HAVING COALESCE(SUM(total_hours_worked),0) > 0
        ORDER BY total_cases DESC
        LIMIT 20
      `, [latestYear]),
      pool.query(`
        SELECT establishment_name AS name, company_name, city, state, naics, year,
          total_cases, dart_cases, days_away_cases, total_hours_worked,
          COALESCE(trc_rate, CASE WHEN COALESCE(total_hours_worked,0) > 0 THEN total_cases::numeric * 200000 / total_hours_worked ELSE NULL END) AS trc_rate
        FROM osha_establishments
        WHERE year = $1 AND COALESCE(total_hours_worked,0) >= 2000 AND COALESCE(total_cases,0) > 0
        ORDER BY trc_rate DESC NULLS LAST, total_cases DESC
        LIMIT 25
      `, [latestYear]),
    ]);

    const numericRows = (rows: Record<string, unknown>[]) => rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => {
      if (["establishments", "total_cases", "dart_cases", "days_away_cases", "restriction_cases", "hours", "trc_rate", "dart_rate", "year", "total_hours_worked"].includes(key) && value !== null) {
        const number = Number(value);
        return [key, Number.isFinite(number) ? number : value];
      }
      return [key, value];
    })));

    return res.json({
      ok: true,
      configured: true,
      imported: true,
      latestYear,
      importInfo,
      trend: numericRows(trend.rows),
      topEmployers: numericRows(employers.rows),
      topStates: numericRows(states.rows),
      topIndustries: numericRows(industries.rows),
      highRateEstablishments: numericRows(establishments.rows),
      source: "OSHA ITA summary rows persisted in Insight Hub Postgres",
      limitation: "OSHA ITA reporting covers establishments subject to reporting requirements and is not representative of every U.S. employer. A reported injury does not establish fault, negligence, noncompliance, or workers’ compensation eligibility.",
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message.slice(0, 300) : "OSHA overview failed." });
  }
});

router.get("/occupational-discovery/osha-rankings", async (req: Request, res: Response) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ ok: false, error: "DATABASE_URL is not configured." });
  const dimension = cleanText(req.query.dimension, 40) || "employer";
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const allowed = new Set(["employer", "state", "industry", "establishment"]);
  if (!allowed.has(dimension)) return res.status(400).json({ ok: false, error: "Unsupported ranking dimension." });

  try {
    await ensureOshaPersistence();
    const { pool } = await import("@workspace/db");
    const requestedYear = Number(req.query.year);
    const latest = await pool.query<{ year: number | null }>("SELECT MAX(year)::int AS year FROM osha_establishments");
    const year = Number.isFinite(requestedYear) && requestedYear > 2000 ? requestedYear : Number(latest.rows[0]?.year ?? 0);

    const dimensions: Record<string, { select: string; group: string; where?: string }> = {
      employer: { select: "company_name AS name", group: "company_name" },
      state: { select: "state AS name", group: "state", where: "AND state <> ''" },
      industry: { select: "SUBSTRING(naics FROM 1 FOR 2) AS name", group: "SUBSTRING(naics FROM 1 FOR 2)", where: "AND LENGTH(naics) >= 2" },
      establishment: { select: "establishment_name AS name", group: "establishment_name" },
    };
    const spec = dimensions[dimension];
    const result = await pool.query(`
      SELECT ${spec.select},
        COUNT(*)::int AS establishments,
        COALESCE(SUM(total_cases),0)::bigint AS total_cases,
        COALESCE(SUM(dart_cases),0)::bigint AS dart_cases,
        COALESCE(SUM(days_away_cases),0)::bigint AS days_away_cases,
        COALESCE(SUM(total_hours_worked),0)::bigint AS hours,
        CASE WHEN COALESCE(SUM(total_hours_worked),0) > 0 THEN ROUND((COALESCE(SUM(total_cases),0)::numeric * 200000 / SUM(total_hours_worked))::numeric, 2) ELSE NULL END AS trc_rate,
        CASE WHEN COALESCE(SUM(total_hours_worked),0) > 0 THEN ROUND((COALESCE(SUM(dart_cases),0)::numeric * 200000 / SUM(total_hours_worked))::numeric, 2) ELSE NULL END AS dart_rate
      FROM osha_establishments
      WHERE year = $1 ${spec.where ?? ""}
      GROUP BY ${spec.group}
      HAVING COALESCE(SUM(total_hours_worked),0) > 0
      ORDER BY total_cases DESC, trc_rate DESC NULLS LAST
      LIMIT $2
    `, [year, limit]);

    return res.json({ ok: true, dimension, year, rows: result.rows.map((row: Record<string, unknown>) => ({ ...row, establishments: Number(row.establishments), total_cases: Number(row.total_cases), dart_cases: Number(row.dart_cases), days_away_cases: Number(row.days_away_cases), hours: Number(row.hours), trc_rate: row.trc_rate === null ? null : Number(row.trc_rate), dart_rate: row.dart_rate === null ? null : Number(row.dart_rate) })) });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message.slice(0, 300) : "OSHA ranking failed." });
  }
});

type CkanDataset = {
  id?: string;
  name?: string;
  title?: string;
  notes?: string;
  metadata_modified?: string;
  organization?: { title?: string; name?: string };
  resources?: Array<{ id?: string; name?: string; format?: string; url?: string; datastore_active?: boolean }>;
};

function normalizeDataGov(dataset: CkanDataset) {
  const resources = (dataset.resources ?? [])
    .map((resource) => ({
      id: cleanText(resource.id, 200),
      name: cleanText(resource.name, 500) || "Resource",
      format: cleanText(resource.format, 80) || "Unknown",
      url: cleanText(resource.url, 2000),
      apiReady: Boolean(resource.datastore_active) || /api|csv|json|geojson/i.test(cleanText(resource.format, 80)),
    }))
    .filter((resource) => resource.url)
    .slice(0, 12);
  return {
    id: cleanText(dataset.id, 200) || cleanText(dataset.name, 200),
    name: cleanText(dataset.name, 300),
    title: cleanText(dataset.title, 1000) || cleanText(dataset.name, 1000) || "Untitled dataset",
    description: cleanText(dataset.notes, 2500),
    agency: cleanText(dataset.organization?.title || dataset.organization?.name, 500) || "Agency not reported",
    updatedAt: cleanText(dataset.metadata_modified, 100),
    resources,
    apiReady: resources.some((resource) => resource.apiReady),
    catalogUrl: dataset.name ? `https://catalog.data.gov/dataset/${encodeURIComponent(dataset.name)}` : "https://catalog.data.gov/dataset",
  };
}

async function fetchDataGovCollection(query: string, rows = 5) {
  const key = `datagov:${query}:${rows}`;
  const hit = cached<unknown>(key);
  if (hit) return hit;
  const params = new URLSearchParams({ q: query, rows: String(rows), sort: "score desc, metadata_modified desc" });
  const payload = asRecord(await fetchJson(`${DATA_GOV_URL}?${params}`, { headers: { Accept: "application/json", "User-Agent": "Occu-Med-Insight-Hub/2.0" } }));
  const result = asRecord(payload?.result);
  const normalized = {
    count: Number(result?.count ?? 0),
    datasets: asArray(result?.results).map((item) => normalizeDataGov((asRecord(item) ?? {}) as CkanDataset)),
  };
  remember(key, normalized, 30 * 60 * 1000);
  return normalized;
}

router.get("/occupational-discovery/datagov-overview", async (_req: Request, res: Response) => {
  const settled = await Promise.allSettled(DATAGOV_COLLECTIONS.map(async (collection) => ({ collection, result: await fetchDataGovCollection(collection.query, 3) })));
  const collections = settled.map((entry, index) => {
    const collection = DATAGOV_COLLECTIONS[index];
    if (entry.status === "rejected") return { ...collection, count: null, datasets: [], error: "Catalog preview unavailable." };
    return { ...collection, ...entry.value.result };
  });
  return res.json({ ok: true, collections, source: "Data.gov CKAN catalog metadata", limitation: "Data.gov catalog results are metadata. Actual dataset structures and update schedules are controlled by the publishing agencies." });
});

router.get("/occupational-discovery/datagov-collection/:id", async (req: Request, res: Response) => {
  const collection = DATAGOV_COLLECTIONS.find((item) => item.id === req.params.id);
  if (!collection) return res.status(404).json({ ok: false, error: "Unknown curated collection." });
  try {
    const rows = Math.min(Math.max(Number(req.query.rows) || 24, 1), 50);
    const result = await fetchDataGovCollection(collection.query, rows);
    return res.json({ ok: true, collection, ...result, source: "Data.gov CKAN catalog metadata" });
  } catch (error) {
    return res.status(502).json({ ok: false, collection, error: error instanceof Error ? error.message.slice(0, 250) : "Data.gov collection failed." });
  }
});

function getOnetKey(): string | undefined {
  return process.env.ONET_API_KEY?.trim() || undefined;
}

async function fetchOnet(path: string): Promise<unknown> {
  const key = getOnetKey();
  if (!key) throw new Error("ONET_API_KEY is not configured.");
  return fetchJson(`${ONET_BASE_URL}${path}`, {
    headers: { "X-API-Key": key, Accept: "application/json", "User-Agent": "Occu-Med-Insight-Hub/2.0 occupational discovery" },
  }, 20_000);
}

type OnetEvidence = {
  id?: string;
  name: string;
  description?: string;
  value?: number;
  category?: string;
  response?: Array<{ percentage?: number; description?: string }>;
};

function normalizeOnetItems(payload: unknown, key: string): OnetEvidence[] {
  const record = asRecord(payload);
  const raw = asArray(record?.[key]);
  return raw.map((item) => {
    const row = asRecord(item) ?? {};
    const rawValue = row.importance ?? row.context ?? row.value;
    const numericValue = Number(rawValue);
    const response = asArray(row.response).map((entry) => {
      const responseRow = asRecord(entry) ?? {};
      const pct = Number(responseRow.percentage_of_respondents ?? responseRow.percentage);
      return { percentage: Number.isFinite(pct) ? pct : undefined, description: cleanText(responseRow.description, 500) || undefined };
    });
    return {
      id: cleanText(row.id, 100) || undefined,
      name: cleanText(row.name ?? row.title ?? row.statement, 1000),
      description: cleanText(row.description, 2000) || undefined,
      value: Number.isFinite(numericValue) ? numericValue : undefined,
      category: cleanText(row.category, 100) || undefined,
      response: response.length ? response : undefined,
    };
  }).filter((item) => item.name);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function phraseMatch(text: string, term: string): boolean {
  const pattern = escapeRegExp(term.toLowerCase()).replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${pattern}([^a-z0-9]|$)`, "i").test(text.toLowerCase());
}

router.get("/occupational-discovery/onet/profile", async (req: Request, res: Response) => {
  const keyword = cleanText(req.query.keyword, 160);
  if (!keyword) return res.status(400).json({ ok: false, error: "keyword is required." });
  if (!getOnetKey()) return res.status(503).json({ ok: false, error: "ONET_API_KEY is not configured." });

  try {
    const search = asRecord(await fetchOnet(`/mnm/search?keyword=${encodeURIComponent(keyword)}&end=10`));
    const matches = asArray(search?.career).map((item) => {
      const row = asRecord(item) ?? {};
      return { code: cleanText(row.code, 40), title: cleanText(row.title ?? row.name, 400), score: Number.isFinite(Number(row.score)) ? Number(row.score) : undefined };
    }).filter((item) => item.code && item.title);
    if (!matches.length) return res.json({ ok: true, keyword, profile: null, matches: [], message: "No O*NET occupation matched this title." });

    const selected = matches[0];
    const code = encodeURIComponent(selected.code);
    const [overviewResult, tasksResult, contextResult, abilitiesResult, activitiesResult, detailedResult] = await Promise.allSettled([
      fetchOnet(`/online/occupations/${code}/`),
      fetchOnet(`/online/occupations/${code}/details/tasks?end=100&sort=importance`),
      fetchOnet(`/online/occupations/${code}/details/work_context?end=100&sort=context`),
      fetchOnet(`/online/occupations/${code}/details/abilities?end=100&sort=importance`),
      fetchOnet(`/online/occupations/${code}/details/work_activities?end=100&sort=importance`),
      fetchOnet(`/online/occupations/${code}/details/detailed_work_activities?end=100`),
    ]);

    const overview = overviewResult.status === "fulfilled" ? asRecord(overviewResult.value) : null;
    const tasks = tasksResult.status === "fulfilled" ? normalizeOnetItems(tasksResult.value, "task") : [];
    const workContext = contextResult.status === "fulfilled" ? normalizeOnetItems(contextResult.value, "element") : [];
    const abilities = abilitiesResult.status === "fulfilled" ? normalizeOnetItems(abilitiesResult.value, "element") : [];
    const workActivities = activitiesResult.status === "fulfilled" ? normalizeOnetItems(activitiesResult.value, "element") : [];
    const detailedWorkActivities = detailedResult.status === "fulfilled" ? normalizeOnetItems(detailedResult.value, "activity") : [];

    const evidence = [...tasks, ...workContext, ...abilities, ...workActivities, ...detailedWorkActivities];
    const serviceMatches = SERVICE_OPPORTUNITIES.map((service) => {
      const matched = evidence.filter((item) => {
        const text = [item.name, item.description].filter(Boolean).join(" — ");
        return service.terms.some((term) => phraseMatch(text, term));
      });
      return {
        id: service.id,
        label: service.label,
        description: service.description,
        evidence: matched.slice(0, 30),
        count: matched.length,
      };
    }).filter((service) => service.count > 0);

    const partialErrors = [
      ["overview", overviewResult], ["tasks", tasksResult], ["work_context", contextResult], ["abilities", abilitiesResult], ["work_activities", activitiesResult], ["detailed_work_activities", detailedResult],
    ].filter(([, result]) => (result as PromiseSettledResult<unknown>).status === "rejected").map(([section]) => String(section));

    return res.json({
      ok: true,
      keyword,
      matches,
      profile: {
        occupation: {
          code: selected.code,
          title: cleanText(overview?.title ?? overview?.occupation ?? selected.title, 500) || selected.title,
          description: cleanText(overview?.description, 2000),
        },
        tasks,
        workContext,
        abilities,
        workActivities,
        detailedWorkActivities,
        serviceMatches,
        counts: { tasks: tasks.length, workContext: workContext.length, abilities: abilities.length, workActivities: workActivities.length, detailedWorkActivities: detailedWorkActivities.length },
        partialErrors,
      },
      source: "O*NET Web Services API v2",
      limitation: "Service matches are transparent term-to-source-evidence filters. They are not medical necessity, fitness-for-duty, disability, compensability, or individual risk determinations.",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message.slice(0, 300) : "O*NET profile request failed." });
  }
});

export default router;
