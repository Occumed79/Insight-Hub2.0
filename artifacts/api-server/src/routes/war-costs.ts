import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const BASE_URL = "https://www.warcosts.org/data";

type CacheEntry = { expiresAt: number; fetchedAt: string; data: unknown };
const cache = new Map<string, CacheEntry>();

const DATASETS = new Set([
  "conflicts.json", "operations.json", "war-votes.json", "war-roi.json", "cost-per-life.json",
  "blowback-chains.json", "constitutional-scores.json", "revolutionary-war.json",
  "military-spending.json", "yearly-spending.json", "global-spending.json", "spending-per-capita.json",
  "opportunity-costs.json", "audit-timeline.json", "foreign-aid.json", "aid-countries-index.json",
  "arms-sales.json", "arms-sales-countries.json", "base-index.json", "base-countries.json", "base-states.json",
  "base-components.json", "base-stats.json", "overseas-presence.json", "state-footprint.json",
  "state-military-index.json", "veterans-stats.json", "veterans-by-war.json", "draft-analysis.json",
  "weapons.json", "weapons-detail.json", "contractors.json", "contractor-by-war.json", "sanctions.json",
  "drone-strikes.json", "presidents.json", "country-profiles-index.json", "stats.json", "jobs-data.json",
]);

const LIVE_DATASETS = new Set(["conflicts.json", "drone-strikes.json", "stats.json"]);

function ttlFor(name: string): number {
  if (LIVE_DATASETS.has(name)) return 5 * 60 * 1000;
  if (["contractors.json", "contractor-by-war.json", "weapons.json", "weapons-detail.json"].includes(name)) return 6 * 60 * 60 * 1000;
  return 60 * 60 * 1000;
}

async function fetchDataset(name: string, force = false): Promise<{ data: unknown; fetchedAt: string; cached: boolean }> {
  if (!DATASETS.has(name)) throw new Error("Dataset is not allowlisted");
  const now = Date.now();
  const existing = cache.get(name);
  if (!force && existing && existing.expiresAt > now) {
    return { data: existing.data, fetchedAt: existing.fetchedAt, cached: true };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${BASE_URL}/${name}`, {
      headers: { Accept: "application/json", "User-Agent": "Occu-Med Insight Hub 2.0" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`WarCosts returned HTTP ${response.status}`);
    const data = await response.json() as unknown;
    const fetchedAt = new Date().toISOString();
    cache.set(name, { data, fetchedAt, expiresAt: now + ttlFor(name) });
    return { data, fetchedAt, cached: false };
  } finally {
    clearTimeout(timer);
  }
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalized(value: unknown): string {
  return text(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function contractorMatches(contractorName: string, candidate: unknown): boolean {
  const left = normalized(contractorName);
  const right = normalized(candidate);
  return Boolean(left && right && (left === right || left.includes(right) || right.includes(left)));
}

router.get("/war-costs/datasets", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    source: "WarCosts.org",
    attribution: "Source: warcosts.org",
    count: DATASETS.size,
    datasets: [...DATASETS].map((name) => ({ name, refreshClass: LIVE_DATASETS.has(name) ? "live" : "periodic" })),
  });
});

router.get("/war-costs/dataset/:name", async (req: Request, res: Response) => {
  const name = req.params.name;
  if (!DATASETS.has(name)) return res.status(404).json({ ok: false, error: "Unknown WarCosts dataset" });
  try {
    const result = await fetchDataset(name, req.query.refresh === "1");
    res.setHeader("Cache-Control", LIVE_DATASETS.has(name) ? "public, max-age=120" : "public, max-age=900");
    return res.json({ ok: true, source: "WarCosts.org", dataset: name, ...result, data: result.data });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "WarCosts request failed" });
  }
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
      const wars = contractorWars.filter((row) => contractorMatches(name, row.contractor));
      const weaponSystems = weapons.filter((weapon) => contractorMatches(name, weapon.contractor));
      return { ...contractor, wars: wars.flatMap((row) => Array.isArray(row.wars) ? row.wars : []), weaponSystems };
    });

    const filtered = company ? enriched.filter((contractor) => contractorMatches(company, contractor.name)) : enriched;
    const activeConflicts = conflicts.filter((conflict) => {
      const status = text(conflict.status).toLowerCase();
      const endYear = conflict.endYear;
      return status.includes("ongoing") || status.includes("active") || endYear === null || endYear === undefined;
    });

    const fetchedAt = [contractorsResult, warsResult, weaponsResult, conflictsResult, strikesResult, statsResult]
      .map((item) => item.fetchedAt).sort().at(-1) ?? new Date().toISOString();

    return res.json({
      ok: true,
      source: "WarCosts.org",
      attribution: "Source: warcosts.org",
      sourceUrl: "https://www.warcosts.org/downloads",
      fetchedAt,
      refreshPolicy: { liveFeedsMinutes: 5, contractorDirectoryHours: 6, otherDatasetsHours: 1 },
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

export default router;
