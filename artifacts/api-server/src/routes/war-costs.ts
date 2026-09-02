import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const BASE_URL = "https://www.warcosts.org/data";
const DOWNLOADS_URL = "https://www.warcosts.org/downloads";
const USER_AGENT = "Occu-Med Insight Hub 2.0 WarCosts ingestion";

type CacheEntry = { expiresAt: number; fetchedAt: string; data: unknown; source: "live" | "database" };
type ManifestEntry = { name: string; category: string; refreshClass: "live" | "frequent" | "periodic" };
type DatasetResult = { data: unknown; fetchedAt: string; cached: boolean; source: "live" | "database" };
type RefreshStatus = { name: string; ok: boolean; count: number; fetchedAt?: string; source?: string; error?: string };

const cache = new Map<string, CacheEntry>();
let manifestCache: { expiresAt: number; entries: ManifestEntry[] } | null = null;
let persistenceReady: Promise<void> | null = null;
let refreshAllPromise: Promise<RefreshStatus[]> | null = null;

const CATEGORY_DATASETS: Record<string, string[]> = {
  "Conflicts & Wars": [
    "conflicts.json", "operations.json", "war-votes.json", "war-roi.json", "cost-per-life.json",
    "blowback-chains.json", "constitutional-scores.json", "revolutionary-war.json", "drone-strikes.json",
  ],
  "Military Spending": [
    "military-spending.json", "yearly-spending.json", "global-spending.json", "spending-per-capita.json",
    "opportunity-costs.json", "audit-timeline.json", "jobs-data.json",
  ],
  "Foreign Aid": ["foreign-aid.json", "aid-countries-index.json"],
  "Arms Sales": ["arms-sales.json", "arms-sales-countries.json"],
  "Bases & Deployments": [
    "base-index.json", "base-countries.json", "base-states.json", "base-components.json", "base-stats.json",
    "overseas-presence.json", "state-footprint.json", "state-military-index.json",
  ],
  "Veterans": ["veterans-stats.json", "veterans-by-war.json", "draft-analysis.json"],
  "Weapons & Defense Industry": [
    "weapons.json", "weapons-detail.json", "contractors.json", "contractor-by-war.json", "sanctions.json",
  ],
  "Presidents & Politics": ["presidents.json", "country-profiles-index.json", "stats.json"],
};

const KNOWN_DATASETS = new Set(Object.values(CATEGORY_DATASETS).flat());
const LIVE_DATASETS = new Set(["conflicts.json", "drone-strikes.json", "stats.json"]);
const FREQUENT_DATASETS = new Set([
  "contractors.json", "contractor-by-war.json", "weapons.json", "weapons-detail.json", "base-index.json",
  "base-countries.json", "overseas-presence.json", "arms-sales.json", "arms-sales-countries.json",
  "foreign-aid.json", "country-profiles-index.json", "sanctions.json",
]);

function categoryFor(name: string): string {
  for (const [category, names] of Object.entries(CATEGORY_DATASETS)) if (names.includes(name)) return category;
  return "Additional WarCosts Data";
}

function refreshClassFor(name: string): ManifestEntry["refreshClass"] {
  if (LIVE_DATASETS.has(name)) return "live";
  if (FREQUENT_DATASETS.has(name)) return "frequent";
  return "periodic";
}

function ttlFor(name: string): number {
  if (LIVE_DATASETS.has(name)) return 5 * 60 * 1000;
  if (FREQUENT_DATASETS.has(name)) return 30 * 60 * 1000;
  return 6 * 60 * 60 * 1000;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalized(value: unknown): string {
  return text(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [];
}

function itemCount(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).length;
  return value === null || value === undefined ? 0 : 1;
}

function datasetFilename(value: string): string | null {
  const clean = value.trim().split("?")[0].split("#")[0].split("/").pop() ?? "";
  return /^[a-z0-9][a-z0-9-]*\.json$/i.test(clean) ? clean.toLowerCase() : null;
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
  })().catch((error) => {
    persistenceReady = null;
    console.warn("WarCosts persistence initialization failed", error);
  });
  return persistenceReady;
}

async function persistDataset(name: string, data: unknown, fetchedAt: string): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  await ensurePersistence();
  const { pool } = await import("@workspace/db");
  await pool.query(
    `INSERT INTO warcosts_dataset_snapshots
      (dataset_name, category, refresh_class, payload, item_count, source_url, fetched_at, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::timestamptz, NOW())
     ON CONFLICT (dataset_name) DO UPDATE SET
       category = EXCLUDED.category,
       refresh_class = EXCLUDED.refresh_class,
       payload = EXCLUDED.payload,
       item_count = EXCLUDED.item_count,
       source_url = EXCLUDED.source_url,
       fetched_at = EXCLUDED.fetched_at,
       updated_at = NOW()`,
    [name, categoryFor(name), refreshClassFor(name), JSON.stringify(data), itemCount(data), `${BASE_URL}/${name}`, fetchedAt],
  );
}

async function readPersistedDataset(name: string): Promise<DatasetResult | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    await ensurePersistence();
    const { pool } = await import("@workspace/db");
    const result = await pool.query<{ payload: unknown; fetched_at: Date | string }>(
      `SELECT payload, fetched_at FROM warcosts_dataset_snapshots WHERE dataset_name = $1 LIMIT 1`,
      [name],
    );
    const row = result.rows[0];
    if (!row) return null;
    const fetchedAt = row.fetched_at instanceof Date ? row.fetched_at.toISOString() : new Date(row.fetched_at).toISOString();
    cache.set(name, { data: row.payload, fetchedAt, expiresAt: Date.now() + Math.min(ttlFor(name), 5 * 60 * 1000), source: "database" });
    return { data: row.payload, fetchedAt, cached: true, source: "database" };
  } catch (error) {
    console.warn(`WarCosts database fallback failed for ${name}`, error);
    return null;
  }
}

async function discoverManifest(force = false): Promise<ManifestEntry[]> {
  const now = Date.now();
  if (!force && manifestCache && manifestCache.expiresAt > now) return manifestCache.entries;

  const names = new Set(KNOWN_DATASETS);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(DOWNLOADS_URL, { headers: { Accept: "text/html", "User-Agent": USER_AGENT }, signal: controller.signal, cache: "no-store" });
      if (response.ok) {
        const html = await response.text();
        const patterns = [/\/data\/([a-z0-9-]+\.json)/gi, /`([a-z0-9-]+\.json)`/gi];
        for (const pattern of patterns) {
          for (const match of html.matchAll(pattern)) {
            const filename = datasetFilename(match[1] ?? "");
            if (filename) names.add(filename);
          }
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    console.warn("WarCosts manifest discovery failed; using known dataset manifest", error);
  }

  const entries = [...names]
    .sort((a, b) => categoryFor(a).localeCompare(categoryFor(b)) || a.localeCompare(b))
    .map((name) => ({ name, category: categoryFor(name), refreshClass: refreshClassFor(name) }));
  manifestCache = { entries, expiresAt: now + 30 * 60 * 1000 };
  return entries;
}

async function isAllowedDataset(name: string): Promise<boolean> {
  const filename = datasetFilename(name);
  if (!filename) return false;
  const manifest = await discoverManifest();
  return manifest.some((entry) => entry.name === filename);
}

async function fetchLiveDataset(name: string): Promise<DatasetResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(`${BASE_URL}/${name}`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`WarCosts returned HTTP ${response.status}`);
    const data = await response.json() as unknown;
    const fetchedAt = new Date().toISOString();
    cache.set(name, { data, fetchedAt, expiresAt: Date.now() + ttlFor(name), source: "live" });
    void persistDataset(name, data, fetchedAt).catch((error) => console.warn(`WarCosts persistence failed for ${name}`, error));
    return { data, fetchedAt, cached: false, source: "live" };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchDataset(inputName: string, force = false): Promise<DatasetResult> {
  const name = datasetFilename(inputName);
  if (!name || !(await isAllowedDataset(name))) throw new Error("Dataset is not allowlisted by the WarCosts manifest");
  const existing = cache.get(name);
  if (!force && existing && existing.expiresAt > Date.now()) {
    return { data: existing.data, fetchedAt: existing.fetchedAt, cached: true, source: existing.source };
  }

  try {
    return await fetchLiveDataset(name);
  } catch (error) {
    const persisted = await readPersistedDataset(name);
    if (persisted) return persisted;
    throw error;
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

async function refreshAll(force = false): Promise<RefreshStatus[]> {
  if (refreshAllPromise && !force) return refreshAllPromise;
  const task = (async () => {
    const manifest = await discoverManifest(force);
    return mapWithConcurrency(manifest, 6, async (entry): Promise<RefreshStatus> => {
      try {
        const result = await fetchDataset(entry.name, force);
        return { name: entry.name, ok: true, count: itemCount(result.data), fetchedAt: result.fetchedAt, source: result.source };
      } catch (error) {
        return { name: entry.name, ok: false, count: 0, error: error instanceof Error ? error.message : "Fetch failed" };
      }
    });
  })();
  refreshAllPromise = task;
  try {
    return await task;
  } finally {
    if (refreshAllPromise === task) refreshAllPromise = null;
  }
}

function contractorMatches(contractorName: string, candidate: unknown): boolean {
  const left = normalized(contractorName);
  const right = normalized(candidate);
  return Boolean(left && right && (left === right || left.includes(right) || right.includes(left)));
}

function countryMatches(country: string, row: Record<string, unknown>): boolean {
  const target = normalized(country);
  const candidates = [row.country, row.countryName, row.name, row.location, row.region, row.slug];
  return candidates.some((value) => {
    const candidate = normalized(value);
    return Boolean(target && candidate && (target === candidate || candidate.includes(target) || target.includes(candidate)));
  });
}

function searchableRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") return Object.entries(data as Record<string, unknown>).map(([key, value]) => ({ key, value }));
  return [data];
}

router.get("/war-costs/datasets", async (_req: Request, res: Response) => {
  const manifest = await discoverManifest();
  res.json({
    ok: true,
    source: "WarCosts.org",
    attribution: "Source: warcosts.org",
    advertisedDatasetCount: 40,
    discoveredDatasetCount: manifest.length,
    datasets: manifest,
  });
});

router.get("/war-costs/overview", async (req: Request, res: Response) => {
  const force = req.query.refresh === "1";
  const statuses = await refreshAll(force);
  const manifest = await discoverManifest();
  const successful = statuses.filter((item) => item.ok);
  const failed = statuses.filter((item) => !item.ok);

  const getCached = (name: string): unknown => cache.get(name)?.data;
  const contractors = asArray(getCached("contractors.json"));
  const weapons = asArray(getCached("weapons-detail.json"));
  const conflicts = asArray(getCached("conflicts.json"));
  const strikes = asArray(getCached("drone-strikes.json"));
  const bases = asArray(getCached("base-index.json"));
  const countries = asArray(getCached("country-profiles-index.json"));
  const activeConflicts = conflicts.filter((row) => {
    const status = text(row.status).toLowerCase();
    return status.includes("ongoing") || status.includes("active") || row.endYear === null || row.endYear === undefined;
  });

  const categoryCounts = manifest.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});

  return res.json({
    ok: failed.length === 0,
    source: "WarCosts.org",
    attribution: "Source: warcosts.org",
    sourceUrl: DOWNLOADS_URL,
    fetchedAt: successful.map((item) => item.fetchedAt).filter(Boolean).sort().pop() ?? new Date().toISOString(),
    refreshPolicy: { liveMinutes: 5, frequentMinutes: 30, periodicHours: 6, manifestMinutes: 30 },
    summary: {
      advertisedDatasets: 40,
      discoveredDatasets: manifest.length,
      mirroredDatasets: successful.length,
      failedDatasets: failed.length,
      contractors: contractors.length,
      weaponSystems: weapons.length,
      conflicts: conflicts.length,
      activeConflicts: activeConflicts.length,
      strikeRecords: strikes.length,
      militaryBases: bases.length,
      countryProfiles: countries.length,
    },
    categoryCounts,
    datasets: statuses.map((status) => ({ ...manifest.find((entry) => entry.name === status.name), ...status })),
    highlights: {
      contractors: contractors.slice(0, 25),
      weapons: weapons.slice(0, 20),
      activeConflicts,
      recentStrikes: strikes.slice(-50).reverse(),
      stats: getCached("stats.json") ?? null,
    },
  });
});

router.get("/war-costs/dataset/:name", async (req: Request, res: Response) => {
  const name = datasetFilename(req.params.name);
  if (!name || !(await isAllowedDataset(name))) return res.status(404).json({ ok: false, error: "Unknown WarCosts dataset" });
  try {
    const result = await fetchDataset(name, req.query.refresh === "1");
    res.setHeader("Cache-Control", LIVE_DATASETS.has(name) ? "public, max-age=120" : "public, max-age=900");
    return res.json({
      ok: true,
      source: "WarCosts.org",
      attribution: "Source: warcosts.org",
      dataset: name,
      category: categoryFor(name),
      refreshClass: refreshClassFor(name),
      itemCount: itemCount(result.data),
      ...result,
      data: result.data,
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "WarCosts request failed" });
  }
});

router.post("/war-costs/refresh-all", async (_req: Request, res: Response) => {
  const statuses = await refreshAll(true);
  return res.json({
    ok: statuses.every((item) => item.ok),
    refreshedAt: new Date().toISOString(),
    succeeded: statuses.filter((item) => item.ok).length,
    failed: statuses.filter((item) => !item.ok),
    datasets: statuses,
  });
});

router.get("/war-costs/search", async (req: Request, res: Response) => {
  const query = text(req.query.q);
  if (query.length < 2) return res.status(400).json({ ok: false, error: "q must be at least 2 characters" });
  await refreshAll(false);
  const needle = query.toLowerCase();
  const results: Array<{ dataset: string; category: string; row: unknown }> = [];
  const manifest = await discoverManifest();
  for (const entry of manifest) {
    const data = cache.get(entry.name)?.data;
    if (data === undefined) continue;
    for (const row of searchableRows(data)) {
      let haystack = "";
      try { haystack = JSON.stringify(row).toLowerCase(); } catch { continue; }
      if (haystack.includes(needle)) results.push({ dataset: entry.name, category: entry.category, row });
      if (results.length >= 250) break;
    }
    if (results.length >= 250) break;
  }
  return res.json({ ok: true, query, total: results.length, truncated: results.length >= 250, results });
});

router.get("/war-costs/country-intelligence", async (req: Request, res: Response) => {
  const country = text(req.query.country);
  if (!country) return res.status(400).json({ ok: false, error: "country is required" });
  const names = [
    "country-profiles-index.json", "base-countries.json", "overseas-presence.json", "arms-sales.json",
    "arms-sales-countries.json", "foreign-aid.json", "aid-countries-index.json", "global-spending.json",
    "sanctions.json", "conflicts.json", "operations.json",
  ];
  const loaded = await Promise.all(names.map((name) => fetchDataset(name).then((result) => [name, result.data] as const).catch(() => [name, []] as const)));
  const matched: Record<string, unknown[]> = {};
  for (const [name, data] of loaded) matched[name] = asArray(data).filter((row) => countryMatches(country, row));
  return res.json({
    ok: true,
    source: "WarCosts.org",
    attribution: "Source: warcosts.org",
    country,
    datasetsMatched: Object.values(matched).filter((rows) => rows.length > 0).length,
    data: matched,
  });
});

router.get("/war-costs/contractor-intelligence", async (req: Request, res: Response) => {
  try {
    const [contractorsResult, warsResult, weaponsResult, conflictsResult, strikesResult, statsResult] = await Promise.all([
      fetchDataset("contractors.json"),
      fetchDataset("contractor-by-war.json"),
      fetchDataset("weapons-detail.json"),
      fetchDataset("conflicts.json"),
      fetchDataset("drone-strikes.json"),
      fetchDataset("stats.json"),
    ]);

    const contractors = asArray(contractorsResult.data);
    const contractorWars = asArray(warsResult.data);
    const weapons = asArray(weaponsResult.data);
    const conflicts = asArray(conflictsResult.data);
    const strikes = asArray(strikesResult.data);
    const company = text(req.query.company);

    const enriched = contractors.map((contractor) => {
      const name = text(contractor.name);
      const aliases = [name, ...asArray(contractor.subsidiaries).map((row) => text(row.name)).filter(Boolean)];
      const wars = contractorWars.filter((row) => aliases.some((alias) => contractorMatches(alias, row.contractor)));
      const weaponSystems = weapons.filter((weapon) => aliases.some((alias) => contractorMatches(alias, weapon.contractor)));
      return { ...contractor, wars: wars.flatMap((row) => Array.isArray(row.wars) ? row.wars : []), weaponSystems };
    });

    const filtered = company ? enriched.filter((contractor) => {
      const aliases = [contractor.name, ...asArray(contractor.subsidiaries).map((row) => row.name)];
      return aliases.some((alias) => contractorMatches(company, alias));
    }) : enriched;
    const activeConflicts = conflicts.filter((conflict) => {
      const status = text(conflict.status).toLowerCase();
      return status.includes("ongoing") || status.includes("active") || conflict.endYear === null || conflict.endYear === undefined;
    });

    return res.json({
      ok: true,
      source: "WarCosts.org",
      attribution: "Source: warcosts.org",
      sourceUrl: DOWNLOADS_URL,
      fetchedAt: [contractorsResult, warsResult, weaponsResult, conflictsResult, strikesResult, statsResult].map((item) => item.fetchedAt).sort().pop(),
      refreshPolicy: { liveMinutes: 5, contractorMinutes: 30 },
      summary: {
        contractors: enriched.length,
        totalFy2024: enriched.reduce((sum, row) => sum + (typeof row.amount === "number" ? row.amount : 0), 0),
        weaponSystems: weapons.length,
        activeConflicts: activeConflicts.length,
        strikeRecords: strikes.length,
      },
      contractors: filtered,
      live: { activeConflicts, strikes, stats: statsResult.data },
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "WarCosts ingestion failed" });
  }
});

// Keep the truly time-sensitive WarCosts feeds warm while the API service is awake.
const liveTimer = setInterval(() => {
  for (const name of LIVE_DATASETS) void fetchDataset(name, true).catch((error) => console.warn(`WarCosts live refresh failed for ${name}`, error));
}, 5 * 60 * 1000);
liveTimer.unref?.();

// Refresh the entire mirror periodically so every exposed dataset is retained in Neon, not only the visible dashboard slices.
const mirrorTimer = setInterval(() => void refreshAll(true).catch((error) => console.warn("WarCosts full mirror refresh failed", error)), 6 * 60 * 60 * 1000);
mirrorTimer.unref?.();

export default router;
