import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const BASE_URL = "https://www.warcosts.org/data";
const SOURCE_URL = "https://www.warcosts.org/downloads";
const USER_AGENT = "Occu-Med Insight Hub 2.0 defense medical-support ingestion";

type DatasetName = "base-index.json" | "contractors.json";
type DatasetResult = { data: unknown; fetchedAt: string; cached: boolean; source: "live" | "database" };
type CacheEntry = { data: unknown; fetchedAt: string; expiresAt: number; source: "live" | "database" };
type DatasetStatus = { name: DatasetName; ok: boolean; count: number; fetchedAt?: string; source?: "live" | "database"; error?: string };

const DATASETS: Record<DatasetName, { category: string; refreshClass: "frequent" | "periodic"; ttlMs: number }> = {
  "base-index.json": { category: "Defense Installations", refreshClass: "frequent", ttlMs: 30 * 60 * 1000 },
  "contractors.json": { category: "Defense Contractors", refreshClass: "frequent", ttlMs: 30 * 60 * 1000 },
};
const ALLOWED = new Set<DatasetName>(Object.keys(DATASETS) as DatasetName[]);
const cache = new Map<DatasetName, CacheEntry>();
let persistenceReady: Promise<void> | null = null;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function number(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[$,%+,]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function objectRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)));
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  for (const key of ["records", "data", "results", "items", "bases", "installations", "contractors", "topRecipients"]) {
    const rows = record[key];
    if (Array.isArray(rows)) return rows.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)));
  }
  return [];
}

function firstText(row: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = text(row[key]);
    if (value) return value;
  }
  return undefined;
}

function firstNumber(row: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = number(row[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function coordinate(value: unknown): number | undefined {
  const parsed = number(value);
  return parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined;
}

function sanitizeInstallation(row: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => { if (value !== undefined && value !== null && value !== "") output[key] = value; };
  set("name", firstText(row, "name", "baseName", "installation", "site", "facility"));
  set("country", firstText(row, "country", "countryName", "hostCountry"));
  set("city", firstText(row, "city"));
  set("state", firstText(row, "state", "province", "region"));
  set("location", firstText(row, "location"));
  set("type", firstText(row, "type", "baseType", "category"));
  set("status", firstText(row, "status"));
  set("branch", firstText(row, "branch", "service", "component"));
  set("operator", firstText(row, "operator", "command", "organization"));
  set("personnel", firstNumber(row, "personnel", "troops", "assignedPersonnel", "personnelCount", "totalPersonnel"));
  const lat = coordinate(row.latitude ?? row.lat);
  const lon = coordinate(row.longitude ?? row.lon ?? row.lng ?? row.long);
  if (lat !== undefined && Math.abs(lat) <= 90) set("latitude", lat);
  if (lon !== undefined && Math.abs(lon) <= 180) set("longitude", lon);
  const coordinates = row.coordinates;
  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    const first = coordinate(coordinates[0]);
    const second = coordinate(coordinates[1]);
    if (first !== undefined && second !== undefined) set("coordinates", [first, second]);
  }
  return output;
}

function sanitizeContractor(row: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => { if (value !== undefined && value !== null && value !== "") output[key] = value; };
  set("name", firstText(row, "name", "contractor", "company", "recipient"));
  set("slug", firstText(row, "slug"));
  set("rank", firstNumber(row, "rank"));
  set("awards", firstNumber(row, "awards", "awardCount"));
  set("amount", firstNumber(row, "amount", "totalAmount", "contractValue"));
  set("country", firstText(row, "country", "countryName"));
  set("location", firstText(row, "location"));
  set("headquarters", firstText(row, "headquarters", "hq"));
  set("sector", firstText(row, "sector", "industry", "category"));
  const subsidiaries = Array.isArray(row.subsidiaries)
    ? row.subsidiaries.flatMap((value) => {
        if (typeof value === "string" && value.trim()) return [{ name: value.trim() }];
        if (!value || typeof value !== "object" || Array.isArray(value)) return [];
        const child = value as Record<string, unknown>;
        const name = firstText(child, "name", "company", "subsidiary");
        return name ? [{ name }] : [];
      })
    : [];
  if (subsidiaries.length) set("subsidiaries", subsidiaries);
  return output;
}

function sanitizeDataset(name: DatasetName, data: unknown): Record<string, unknown>[] {
  const rows = objectRows(data);
  return name === "base-index.json" ? rows.map(sanitizeInstallation).filter((row) => Object.keys(row).length > 0) : rows.map(sanitizeContractor).filter((row) => Boolean(row.name));
}

function parseDatasetName(value: unknown): DatasetName | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().split("?")[0].split("#")[0].split("/").pop()?.toLowerCase() || "";
  return ALLOWED.has(clean as DatasetName) ? clean as DatasetName : null;
}

async function ensurePersistence(): Promise<void> {
  if (persistenceReady) return persistenceReady;
  persistenceReady = (async () => {
    if (!process.env.DATABASE_URL) return;
    const { pool } = await import("@workspace/db");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS warcosts_dataset_snapshots (
        dataset_name TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        refresh_class TEXT NOT NULL,
        payload JSONB NOT NULL,
        item_count INTEGER NOT NULL DEFAULT 0,
        source_url TEXT NOT NULL,
        fetched_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS warcosts_dataset_snapshots_fetched_idx ON warcosts_dataset_snapshots (fetched_at DESC)`);
    // Universal military datasets are no longer part of this product. Purge stale
    // mirrored rows so database fallback cannot resurrect them later.
    await pool.query(`DELETE FROM warcosts_dataset_snapshots WHERE dataset_name <> ALL($1::text[])`, [[...ALLOWED]]);
  })().catch((error) => {
    persistenceReady = null;
    console.warn("Defense-source persistence initialization failed", error);
  });
  return persistenceReady;
}

async function persistDataset(name: DatasetName, data: unknown, fetchedAt: string): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  await ensurePersistence();
  const { pool } = await import("@workspace/db");
  const meta = DATASETS[name];
  await pool.query(
    `INSERT INTO warcosts_dataset_snapshots
      (dataset_name, category, refresh_class, payload, item_count, source_url, fetched_at, updated_at)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7::timestamptz,NOW())
     ON CONFLICT (dataset_name) DO UPDATE SET
       category=EXCLUDED.category, refresh_class=EXCLUDED.refresh_class, payload=EXCLUDED.payload,
       item_count=EXCLUDED.item_count, source_url=EXCLUDED.source_url, fetched_at=EXCLUDED.fetched_at, updated_at=NOW()`,
    [name, meta.category, meta.refreshClass, JSON.stringify(data), Array.isArray(data) ? data.length : 0, `${BASE_URL}/${name}`, fetchedAt],
  );
}

async function readPersistedDataset(name: DatasetName): Promise<DatasetResult | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    await ensurePersistence();
    const { pool } = await import("@workspace/db");
    const result = await pool.query<{ payload: unknown; fetched_at: Date | string }>(`SELECT payload,fetched_at FROM warcosts_dataset_snapshots WHERE dataset_name=$1 LIMIT 1`, [name]);
    const row = result.rows[0];
    if (!row) return null;
    const data = sanitizeDataset(name, row.payload);
    const fetchedAt = row.fetched_at instanceof Date ? row.fetched_at.toISOString() : new Date(row.fetched_at).toISOString();
    cache.set(name, { data, fetchedAt, expiresAt: Date.now() + Math.min(DATASETS[name].ttlMs, 5 * 60 * 1000), source: "database" });
    return { data, fetchedAt, cached: true, source: "database" };
  } catch (error) {
    console.warn(`Defense-source database fallback failed for ${name}`, error);
    return null;
  }
}

async function fetchLiveDataset(name: DatasetName): Promise<DatasetResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(`${BASE_URL}/${name}`, { headers: { Accept: "application/json", "User-Agent": USER_AGENT }, signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`Defense source returned HTTP ${response.status}`);
    const raw = await response.json() as unknown;
    const data = sanitizeDataset(name, raw);
    const fetchedAt = new Date().toISOString();
    cache.set(name, { data, fetchedAt, expiresAt: Date.now() + DATASETS[name].ttlMs, source: "live" });
    void persistDataset(name, data, fetchedAt).catch((error) => console.warn(`Defense-source persistence failed for ${name}`, error));
    return { data, fetchedAt, cached: false, source: "live" };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchDataset(name: DatasetName, force = false): Promise<DatasetResult> {
  const hit = cache.get(name);
  if (!force && hit && hit.expiresAt > Date.now()) return { data: hit.data, fetchedAt: hit.fetchedAt, cached: true, source: hit.source };
  if (!force) {
    const persisted = await readPersistedDataset(name);
    if (persisted) {
      void fetchLiveDataset(name).catch((error) => console.warn(`Defense-source background refresh failed for ${name}`, error));
      return persisted;
    }
  }
  try { return await fetchLiveDataset(name); }
  catch (error) {
    const persisted = await readPersistedDataset(name);
    if (persisted) return persisted;
    throw error;
  }
}

async function refreshAll(force: boolean): Promise<DatasetStatus[]> {
  return Promise.all(([...ALLOWED] as DatasetName[]).map(async (name) => {
    try {
      const result = await fetchDataset(name, force);
      return { name, ok: true, count: Array.isArray(result.data) ? result.data.length : 0, fetchedAt: result.fetchedAt, source: result.source } as DatasetStatus;
    } catch (error) {
      return { name, ok: false, count: 0, error: error instanceof Error ? error.message : "Source request failed" } as DatasetStatus;
    }
  }));
}

function searchableRows(data: unknown): Record<string, unknown>[] {
  return Array.isArray(data) ? data.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))) : [];
}

router.get("/war-costs/datasets", (_req: Request, res: Response) => {
  return res.json({
    ok: true,
    source: "WarCosts.org",
    attribution: "Source: warcosts.org",
    scope: "Occu-Med defense medical-support relevance only",
    discoveredDatasetCount: ALLOWED.size,
    datasets: ([...ALLOWED] as DatasetName[]).map((name) => ({ name, ...DATASETS[name] })),
  });
});

router.get("/war-costs/overview", async (req: Request, res: Response) => {
  const statuses = await refreshAll(req.query.refresh === "1");
  const installations = searchableRows(cache.get("base-index.json")?.data);
  const contractors = searchableRows(cache.get("contractors.json")?.data);
  return res.json({
    ok: statuses.every((item) => item.ok),
    source: "WarCosts.org",
    attribution: "Source: warcosts.org",
    sourceUrl: SOURCE_URL,
    scope: "Occu-Med defense medical-support relevance only",
    fetchedAt: statuses.map((item) => item.fetchedAt).filter(Boolean).sort().pop() || new Date().toISOString(),
    summary: { datasets: ALLOWED.size, installations: installations.length, contractors: contractors.length },
    datasets: statuses.map((status) => ({ ...DATASETS[status.name], ...status })),
  });
});

router.get("/war-costs/dataset/:name", async (req: Request, res: Response) => {
  const rawName = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
  const name = parseDatasetName(rawName);
  if (!name) return res.status(404).json({ ok: false, error: "Dataset is outside the Occu-Med defense medical-support allowlist." });
  try {
    const result = await fetchDataset(name, req.query.refresh === "1");
    res.setHeader("Cache-Control", "public, max-age=900");
    return res.json({
      ok: true,
      source: "WarCosts.org",
      attribution: "Source: warcosts.org",
      dataset: name,
      category: DATASETS[name].category,
      refreshClass: DATASETS[name].refreshClass,
      itemCount: Array.isArray(result.data) ? result.data.length : 0,
      fetchedAt: result.fetchedAt,
      cached: result.cached,
      mirrorSource: result.source,
      data: result.data,
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "Defense-source request failed" });
  }
});

router.post("/war-costs/refresh-all", async (_req: Request, res: Response) => {
  const statuses = await refreshAll(true);
  return res.json({ ok: statuses.every((item) => item.ok), refreshedAt: new Date().toISOString(), succeeded: statuses.filter((item) => item.ok).length, failed: statuses.filter((item) => !item.ok), datasets: statuses });
});

router.get("/war-costs/search", async (req: Request, res: Response) => {
  const query = text(req.query.q);
  if (query.length < 2) return res.status(400).json({ ok: false, error: "q must be at least 2 characters" });
  await refreshAll(false);
  const needle = query.toLowerCase();
  const results: Array<{ dataset: DatasetName; category: string; row: Record<string, unknown> }> = [];
  for (const name of [...ALLOWED] as DatasetName[]) {
    for (const row of searchableRows(cache.get(name)?.data)) {
      if (JSON.stringify(row).toLowerCase().includes(needle)) results.push({ dataset: name, category: DATASETS[name].category, row });
      if (results.length >= 250) break;
    }
    if (results.length >= 250) break;
  }
  return res.json({ ok: true, query, datasetsSearched: ALLOWED.size, total: results.length, truncated: results.length >= 250, results });
});

router.get("/war-costs/country-intelligence", async (req: Request, res: Response) => {
  const query = text(req.query.country).toLowerCase();
  if (!query) return res.status(400).json({ ok: false, error: "country is required" });
  await refreshAll(false);
  const matched: Record<string, Record<string, unknown>[]> = {};
  for (const name of [...ALLOWED] as DatasetName[]) {
    const rows = searchableRows(cache.get(name)?.data).filter((row) => JSON.stringify(row).toLowerCase().includes(query));
    if (rows.length) matched[name] = rows;
  }
  return res.json({ ok: true, source: "WarCosts.org", attribution: "Source: warcosts.org", country: text(req.query.country), datasetsSearched: ALLOWED.size, datasetsMatched: Object.keys(matched).length, data: matched });
});

router.get("/war-costs/contractor-intelligence", async (req: Request, res: Response) => {
  try {
    const result = await fetchDataset("contractors.json", req.query.refresh === "1");
    const query = text(req.query.company).toLowerCase();
    const contractors = searchableRows(result.data).filter((row) => !query || JSON.stringify(row).toLowerCase().includes(query));
    return res.json({
      ok: true,
      source: "WarCosts.org",
      attribution: "Source: warcosts.org",
      sourceUrl: SOURCE_URL,
      fetchedAt: result.fetchedAt,
      scope: "Sanitized contractor/entity context only; war, weapon, strike, and casualty associations are excluded.",
      summary: { contractors: contractors.length },
      contractors,
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "Defense contractor source failed" });
  }
});

if (process.env.NODE_ENV !== "test") {
  const timer = setInterval(() => { void refreshAll(true).catch((error) => console.warn("Defense-source refresh failed", error)); }, 30 * 60 * 1000);
  timer.unref?.();
}

export default router;
