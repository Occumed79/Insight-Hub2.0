import { Router, type IRouter, type Request, type Response } from "express";
import { ensureOshaPersistence } from "../services/oshaDataService";
import { ensureOshaCasePersistence } from "../services/oshaCaseDataService";

const router: IRouter = Router();

const ONET_BASE = "https://api-v2.onetcenter.org";
const BLS_DOWNLOAD_BASE = "https://download.bls.gov/pub/time.series";
const BLS_API = "https://api.bls.gov/publicAPI/v2/timeseries/data/";
const DATAGOV_CKAN = "https://catalog.data.gov/api/3/action";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; value: unknown }>();

type PlainRecord = Record<string, unknown>;
type BlsDatasetKey = "is" | "fa";
type BlsDimensionSpec = { label: string; file: string };

const BLS_DATASETS: Record<BlsDatasetKey, { title: string; description: string; officialUrl: string; dimensions: Record<string, BlsDimensionSpec> }> = {
  is: {
    title: "Survey of Occupational Injuries and Illnesses — Industry Data",
    description: "Annual nonfatal occupational injury and illness counts and incidence rates, including total recordables, DART, days-away, restricted/transfer, other recordables, injury-only, illness-only, and illness categories.",
    officialUrl: "https://download.bls.gov/pub/time.series/is/",
    dimensions: {
      industry: { label: "Industries / NAICS", file: "is.industry" },
      area: { label: "Geographic areas", file: "is.area" },
      case_type: { label: "Case types", file: "is.case.type" },
      data_type: { label: "Data types / measures", file: "is.data.type" },
      supersector: { label: "Supersectors", file: "is.supersector" },
    },
  },
  fa: {
    title: "Census of Fatal Occupational Injuries",
    description: "Annual fatal occupational injury counts with classifications for geography, case characteristics, event/exposure, source, industry, occupation, and related CFOI categories.",
    officialUrl: "https://download.bls.gov/pub/time.series/fa/",
    dimensions: {
      area: { label: "Geographic areas", file: "fa.area" },
      case: { label: "Case classifications", file: "fa.case" },
      category: { label: "Fatality categories", file: "fa.category" },
      category2: { label: "Category definitions", file: "fa.category2" },
      datatype: { label: "Data types", file: "fa.datatype" },
      event: { label: "Events / exposures", file: "fa.event" },
      industry: { label: "Industries / NAICS", file: "fa.industry" },
      occupation: { label: "Occupations / SOC", file: "fa.occupation" },
      source: { label: "Sources of injury", file: "fa.source" },
    },
  },
};

const ONET_DATA_FAMILIES: Record<string, { label: string; path: string }> = {
  abilities: { label: "Abilities", path: "/online/onet_data/abilities/" },
  interests: { label: "Interests", path: "/online/onet_data/interests/" },
  knowledge: { label: "Knowledge", path: "/online/onet_data/knowledge/" },
  skills_basic: { label: "Basic Skills", path: "/online/onet_data/skills_basic/" },
  skills_cf: { label: "Cross-Functional Skills", path: "/online/onet_data/skills_cf/" },
  work_activities: { label: "Work Activities", path: "/online/onet_data/work_activities/" },
  work_context: { label: "Work Context", path: "/online/onet_data/work_context/" },
  work_styles: { label: "Work Styles", path: "/online/onet_data/work_styles/" },
};

const OSHA_TABLES: Record<string, { table: string; label: string; yearColumn?: string; stateColumn?: string; naicsColumn?: string; companyColumn?: string }> = {
  summary: { table: "osha_establishments", label: "Form 300A establishment summary rows", yearColumn: "year", stateColumn: "state", naicsColumn: "naics", companyColumn: "company_name" },
  cases: { table: "osha_case_details", label: "Form 300/301 case-detail rows", yearColumn: "year_of_filing", stateColumn: "state", naicsColumn: "naics_code", companyColumn: "company_name" },
  summary_imports: { table: "osha_import_runs", label: "300A import runs", yearColumn: "dataset_year" },
  summary_files: { table: "osha_source_files", label: "300A source files", yearColumn: "dataset_year" },
  case_imports: { table: "osha_case_import_runs", label: "Case-detail import runs", yearColumn: "dataset_year" },
};

function cached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit || hit.expiresAt <= Date.now()) return null;
  return hit.value as T;
}
function remember(key: string, value: unknown, ttl = CACHE_TTL_MS): void { cache.set(key, { expiresAt: Date.now() + ttl, value }); }
function clean(value: unknown, max = 1000): string { return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : ""; }
function clampInt(value: unknown, fallback: number, min: number, max: number): number { const parsed = Number(value); if (!Number.isFinite(parsed)) return fallback; return Math.min(max, Math.max(min, Math.trunc(parsed))); }

async function fetchText(url: string, timeoutMs = 25_000): Promise<string> {
  const key = `text:${url}`;
  const hit = cached<string>(key);
  if (hit) return hit;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "Occu-Med-Insight-Hub/2.0 source browser" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    remember(key, text);
    return text;
  } finally { clearTimeout(timeout); }
}

async function fetchJson(url: string, options: RequestInit = {}, timeoutMs = 25_000): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timeout); }
}

function parseTsv(text: string): PlainRecord[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) return [];
  const headers = lines[0].split("\t").map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = line.split("\t");
    return Object.fromEntries(headers.map((header, index) => [header, (values[index] ?? "").trim()]));
  });
}

function getOnetKey(): string | undefined { return process.env.ONET_API_KEY?.trim() || undefined; }
async function fetchOnetPath(path: string): Promise<unknown> {
  const key = getOnetKey();
  if (!key) throw new Error("ONET_API_KEY is not configured.");
  return fetchJson(`${ONET_BASE}${path}`, { headers: { "X-API-Key": key, Accept: "application/json", "User-Agent": "Occu-Med-Insight-Hub/2.0 complete O*NET browser" } });
}

router.get("/occupational-source-browser/onet/occupations", async (req: Request, res: Response) => {
  if (!getOnetKey()) return res.status(503).json({ ok: false, error: "ONET_API_KEY is not configured." });
  const start = clampInt(req.query.start, 1, 1, 5000);
  const end = Math.min(start + 99, clampInt(req.query.end, start + 49, start, 5000));
  const sort = ["title", "code", "zone"].includes(clean(req.query.sort, 20)) ? clean(req.query.sort, 20) : "title";
  try {
    const payload = await fetchOnetPath(`/online/occupations/?start=${start}&end=${end}&sort=${encodeURIComponent(sort)}`);
    return res.json({ ok: true, source: "O*NET Web Services API v2", payload });
  } catch (error) { return res.status(502).json({ ok: false, error: error instanceof Error ? error.message.slice(0, 400) : "O*NET occupation catalog failed." }); }
});

router.get("/occupational-source-browser/onet/content-model/:family", async (req: Request, res: Response) => {
  const familyId = clean(req.params.family, 100);
  const family = ONET_DATA_FAMILIES[familyId];
  if (!family) return res.status(404).json({ ok: false, error: "Unknown O*NET content-model family." });
  if (!getOnetKey()) return res.status(503).json({ ok: false, error: "ONET_API_KEY is not configured." });
  try {
    const payload = await fetchOnetPath(family.path);
    return res.json({ ok: true, family: familyId, label: family.label, source: "O*NET Web Services API v2", payload });
  } catch (error) { return res.status(502).json({ ok: false, error: error instanceof Error ? error.message.slice(0, 400) : "O*NET content model failed." }); }
});

router.get("/occupational-source-browser/onet/occupation/:code", async (req: Request, res: Response) => {
  const code = clean(req.params.code, 32);
  if (!/^\d{2}-\d{4}\.\d{2}$/.test(code)) return res.status(400).json({ ok: false, error: "Invalid O*NET-SOC code." });
  if (!getOnetKey()) return res.status(503).json({ ok: false, error: "ONET_API_KEY is not configured." });
  try {
    const payload = await fetchOnetPath(`/online/occupations/${encodeURIComponent(code)}/`);
    return res.json({ ok: true, source: "O*NET Web Services API v2", payload });
  } catch (error) { return res.status(502).json({ ok: false, error: error instanceof Error ? error.message.slice(0, 400) : "O*NET occupation overview failed." }); }
});

router.get("/occupational-source-browser/onet/occupation/:code/content", async (req: Request, res: Response) => {
  const code = clean(req.params.code, 32);
  const rawUrl = clean(req.query.url, 2000);
  if (!/^\d{2}-\d{4}\.\d{2}$/.test(code)) return res.status(400).json({ ok: false, error: "Invalid O*NET-SOC code." });
  if (!getOnetKey()) return res.status(503).json({ ok: false, error: "ONET_API_KEY is not configured." });
  try {
    const target = new URL(rawUrl);
    const prefix = `/online/occupations/${code}/`;
    if (target.origin !== ONET_BASE || !decodeURIComponent(target.pathname).startsWith(prefix)) return res.status(400).json({ ok: false, error: "Content URL must be an O*NET URL listed for the selected occupation." });
    if (!target.searchParams.has("start")) target.searchParams.set("start", "1");
    if (!target.searchParams.has("end")) target.searchParams.set("end", "500");
    const payload = await fetchJson(target.toString(), { headers: { "X-API-Key": getOnetKey() as string, Accept: "application/json", "User-Agent": "Occu-Med-Insight-Hub/2.0 complete O*NET browser" } });
    return res.json({ ok: true, source: "O*NET Web Services API v2", url: target.toString(), payload });
  } catch (error) { return res.status(502).json({ ok: false, error: error instanceof Error ? error.message.slice(0, 400) : "O*NET content request failed." }); }
});

async function loadBlsCatalog(dataset: BlsDatasetKey) {
  const key = `bls-catalog:${dataset}`;
  const hit = cached<unknown>(key);
  if (hit) return hit;
  const spec = BLS_DATASETS[dataset];
  const entries = await Promise.all(Object.entries(spec.dimensions).map(async ([id, dimension]) => {
    const rows = parseTsv(await fetchText(`${BLS_DOWNLOAD_BASE}/${dataset}/${dimension.file}`));
    return [id, { id, label: dimension.label, file: dimension.file, count: rows.length, rows }] as const;
  }));
  const result = { dataset, title: spec.title, description: spec.description, officialUrl: spec.officialUrl, dimensions: Object.fromEntries(entries) };
  remember(key, result);
  return result;
}

router.get("/occupational-source-browser/bls/catalog", async (req: Request, res: Response) => {
  const dataset = clean(req.query.dataset, 10).toLowerCase() as BlsDatasetKey;
  if (!BLS_DATASETS[dataset]) return res.status(400).json({ ok: false, error: "dataset must be is or fa." });
  try { return res.json({ ok: true, source: "BLS public time-series mapping files", catalog: await loadBlsCatalog(dataset) }); }
  catch (error) { return res.status(502).json({ ok: false, error: error instanceof Error ? error.message.slice(0, 400) : "BLS catalog failed." }); }
});

async function fetchBlsSeries(seriesId: string, startYear: number, endYear: number): Promise<unknown> {
  const body: PlainRecord = { seriesid: [seriesId], startyear: String(startYear), endyear: String(endYear), calculations: true, annualaverage: true };
  const registrationKey = process.env.BLS_API_KEY?.trim();
  if (registrationKey) body.registrationkey = registrationKey;
  return fetchJson(BLS_API, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "Occu-Med-Insight-Hub/2.0 BLS browser" }, body: JSON.stringify(body) });
}

router.get("/occupational-source-browser/bls/is-series", async (req: Request, res: Response) => {
  const supersector = clean(req.query.supersector, 3).toUpperCase();
  const industry = clean(req.query.industry, 6).toUpperCase();
  const dataType = clean(req.query.dataType, 1).toUpperCase();
  const caseType = clean(req.query.caseType, 1).toUpperCase();
  const area = clean(req.query.area, 3).toUpperCase();
  if (![supersector.length === 3, industry.length === 6, dataType.length === 1, caseType.length === 1, area.length === 3].every(Boolean)) return res.status(400).json({ ok: false, error: "Complete BLS IS dimension codes are required." });
  const seriesId = `ISU${supersector}${industry}${dataType}${caseType}${area}`;
  const endYear = clampInt(req.query.endYear, new Date().getUTCFullYear(), 1990, 2100);
  const startYear = clampInt(req.query.startYear, Math.max(1990, endYear - 9), 1990, endYear);
  try { return res.json({ ok: true, seriesId, startYear, endYear, source: "BLS Public Data API v2", payload: await fetchBlsSeries(seriesId, startYear, endYear) }); }
  catch (error) { return res.status(502).json({ ok: false, seriesId, error: error instanceof Error ? error.message.slice(0, 400) : "BLS IS series request failed." }); }
});

router.get("/occupational-source-browser/bls/fa-series", async (req: Request, res: Response) => {
  const category = clean(req.query.category, 3).toUpperCase();
  const detail = clean(req.query.detail, 6).toUpperCase();
  const datatype = clean(req.query.datatype, 1).toUpperCase();
  const caseCode = clean(req.query.caseCode, 1).toUpperCase();
  const area = clean(req.query.area, 3).toUpperCase();
  if (![category.length === 3, detail.length === 6, datatype.length === 1, caseCode.length === 1, area.length === 3].every(Boolean)) return res.status(400).json({ ok: false, error: "Complete BLS CFOI dimension codes are required." });
  const seriesId = `FAU${category}${detail}${datatype}${caseCode}${area}`;
  const endYear = clampInt(req.query.endYear, new Date().getUTCFullYear(), 1992, 2100);
  const startYear = clampInt(req.query.startYear, Math.max(1992, endYear - 9), 1992, endYear);
  try { return res.json({ ok: true, seriesId, startYear, endYear, source: "BLS Public Data API v2", payload: await fetchBlsSeries(seriesId, startYear, endYear) }); }
  catch (error) { return res.status(502).json({ ok: false, seriesId, error: error instanceof Error ? error.message.slice(0, 400) : "BLS CFOI series request failed." }); }
});

router.get("/occupational-source-browser/osha/catalog", async (_req: Request, res: Response) => {
  if (!process.env.DATABASE_URL) return res.json({ ok: true, configured: false, tables: [], warning: "DATABASE_URL is not configured." });
  try {
    await Promise.all([ensureOshaPersistence(), ensureOshaCasePersistence()]);
    const { pool } = await import("@workspace/db");
    const tables = await Promise.all(Object.entries(OSHA_TABLES).map(async ([id, spec]) => {
      const [columns, count] = await Promise.all([
        pool.query<{ column_name: string; data_type: string; ordinal_position: number }>(`SELECT column_name, data_type, ordinal_position::int FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`, [spec.table]),
        pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${spec.table}`),
      ]);
      return { id, label: spec.label, table: spec.table, count: Number(count.rows[0]?.count ?? 0), columns: columns.rows };
    }));
    return res.json({ ok: true, configured: true, tables, source: "Insight Hub Postgres copies of OSHA ITA datasets" });
  } catch (error) { return res.status(500).json({ ok: false, error: error instanceof Error ? error.message.slice(0, 400) : "OSHA database catalog failed." }); }
});

router.get("/occupational-source-browser/osha/rows", async (req: Request, res: Response) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ ok: false, error: "DATABASE_URL is not configured." });
  const tableKey = clean(req.query.table, 30) || "summary";
  const spec = OSHA_TABLES[tableKey];
  if (!spec) return res.status(400).json({ ok: false, error: "Unknown OSHA table." });
  const page = clampInt(req.query.page, 1, 1, 1_000_000);
  const limit = clampInt(req.query.limit, 50, 1, 100);
  const offset = (page - 1) * limit;
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => { params.push(value); where.push(sql.replace("?", `$${params.length}`)); };
  const year = Number(req.query.year);
  if (spec.yearColumn && Number.isFinite(year) && year > 1900) add(`${spec.yearColumn} = ?`, Math.trunc(year));
  const state = clean(req.query.state, 10).toUpperCase();
  if (spec.stateColumn && state) add(`UPPER(${spec.stateColumn}) = ?`, state);
  const naics = clean(req.query.naics, 12);
  if (spec.naicsColumn && naics) add(`${spec.naicsColumn} LIKE ?`, `${naics}%`);
  const company = clean(req.query.company, 200);
  if (spec.companyColumn && company) add(`${spec.companyColumn} ILIKE ?`, `%${company}%`);
  try {
    await Promise.all([ensureOshaPersistence(), ensureOshaCasePersistence()]);
    const { pool } = await import("@workspace/db");
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countResult = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${spec.table} ${whereSql}`, params);
    params.push(limit, offset);
    const rows = await pool.query(`SELECT * FROM ${spec.table} ${whereSql} ORDER BY id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    const total = Number(countResult.rows[0]?.count ?? 0);
    return res.json({ ok: true, table: tableKey, label: spec.label, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)), rows: rows.rows });
  } catch (error) { return res.status(500).json({ ok: false, error: error instanceof Error ? error.message.slice(0, 400) : "OSHA row browser failed." }); }
});

router.get("/occupational-source-browser/datagov/catalog", async (req: Request, res: Response) => {
  const q = clean(req.query.q, 300);
  const page = clampInt(req.query.page, 1, 1, 100_000);
  const rows = clampInt(req.query.rows, 20, 1, 50);
  const start = (page - 1) * rows;
  try {
    const params = new URLSearchParams({ rows: String(rows), start: String(start), sort: "metadata_modified desc" });
    if (q) params.set("q", q);
    const payload = await fetchJson(`${DATAGOV_CKAN}/package_search?${params}`, { headers: { Accept: "application/json", "User-Agent": "Occu-Med-Insight-Hub/2.0 complete Data.gov browser" } });
    const record = payload && typeof payload === "object" ? payload as PlainRecord : {};
    const result = record.result && typeof record.result === "object" ? record.result as PlainRecord : {};
    const total = Number(result.count ?? 0);
    return res.json({ ok: true, q, page, rows, total, pages: Math.max(1, Math.ceil(total / rows)), datasets: Array.isArray(result.results) ? result.results : [], source: "Data.gov CKAN catalog metadata", limitation: "Data.gov catalog records are metadata. Underlying data remains with the publishing agency; datastore-backed resources can be previewed separately." });
  } catch (error) { return res.status(502).json({ ok: false, error: error instanceof Error ? error.message.slice(0, 400) : "Data.gov catalog browser failed." }); }
});

router.get("/occupational-source-browser/datagov/dataset/:id", async (req: Request, res: Response) => {
  const id = clean(req.params.id, 300);
  if (!id) return res.status(400).json({ ok: false, error: "Dataset ID is required." });
  try {
    const params = new URLSearchParams({ id });
    const payload = await fetchJson(`${DATAGOV_CKAN}/package_show?${params}`, { headers: { Accept: "application/json", "User-Agent": "Occu-Med-Insight-Hub/2.0 complete Data.gov browser" } });
    const record = payload && typeof payload === "object" ? payload as PlainRecord : {};
    return res.json({ ok: true, dataset: record.result ?? null, source: "Data.gov CKAN catalog metadata" });
  } catch (error) { return res.status(502).json({ ok: false, error: error instanceof Error ? error.message.slice(0, 400) : "Data.gov dataset metadata failed." }); }
});

router.get("/occupational-source-browser/manifest", (_req: Request, res: Response) => res.json({
  ok: true,
  principle: "Complete source visibility: every available source family is browseable without requiring the user to know a search term or internal code.",
  sources: [
    { id: "onet", label: "O*NET", coverage: "All occupations plus all occupation-reported sections and the full O*NET content-model families exposed by Web Services.", configured: Boolean(getOnetKey()), dataFamilies: Object.entries(ONET_DATA_FAMILIES).map(([id, item]) => ({ id, label: item.label })) },
    { id: "bls-is", label: "BLS SOII Industry Data", coverage: "All BLS-published IS industries, areas, case types, data types, supersectors, and any valid time series built from those dimensions." },
    { id: "bls-fa", label: "BLS CFOI", coverage: "All BLS-published CFOI areas, cases, categories, events, industries, occupations, sources, data types, and any valid time series built from those dimensions." },
    { id: "osha", label: "OSHA ITA", coverage: "Every column and every imported row in the 300A summary, 300/301 case-detail, import-run, and source-file tables, paginated." },
    { id: "datagov", label: "Data.gov", coverage: "The full Data.gov metadata catalog, paginated, with complete dataset metadata and datastore previews where available." },
  ],
}));

export default router;
