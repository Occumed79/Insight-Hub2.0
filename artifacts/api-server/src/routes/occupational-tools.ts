import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const DATA_GOV_SEARCH_URL =
  "https://catalog.data.gov/api/3/action/package_search";
const CACHE_TTL_MS = 15 * 60 * 1000;
const searchCache = new Map<string, { expiresAt: number; value: unknown }>();

const TOPICS = [
  {
    id: "injury-illness",
    label: "Injuries & Illnesses",
    query: "occupational injury illness workplace",
    description:
      "Recordable events, illness, surveillance, and occupational health datasets.",
  },
  {
    id: "workers-comp",
    label: "Workers’ Compensation",
    query: "workers compensation claims occupational",
    description:
      "Claims, benefits, return-to-work, and state administrative sources.",
  },
  {
    id: "chronic-health",
    label: "Chronic Conditions",
    query: "worker chronic disease cardiovascular diabetes occupational",
    description:
      "Workforce health, chronic disease, disability, and functional limitation context.",
  },
  {
    id: "readiness",
    label: "Workforce Readiness",
    query: "workforce readiness absenteeism fatigue shift work",
    description:
      "Absence, fatigue, workforce capacity, and operational-readiness evidence.",
  },
  {
    id: "exposures",
    label: "Occupational Exposures",
    query: "occupational exposure noise respiratory ergonomic heat",
    description:
      "Noise, respiratory, ergonomic, heat, chemical, and environmental exposure data.",
  },
  {
    id: "transportation",
    label: "Transportation Workers",
    query: "transportation worker safety injury DOT workforce",
    description:
      "Public transportation workforces, safety, injury, and agency datasets.",
  },
  {
    id: "government",
    label: "Public-Sector Workforces",
    query: "government employee workplace injury occupational health",
    description: "Federal, state, local, and public-agency workforce evidence.",
  },
  {
    id: "fatality",
    label: "Severe & Fatal Events",
    query: "occupational fatality severe injury workplace",
    description:
      "Fatality, hospitalization, severe-event, and high-consequence datasets.",
  },
] as const;

type CkanResource = {
  id?: string;
  name?: string;
  description?: string;
  format?: string;
  url?: string;
  datastore_active?: boolean;
  last_modified?: string;
};

type CkanDataset = {
  id?: string;
  name?: string;
  title?: string;
  notes?: string;
  metadata_modified?: string;
  metadata_created?: string;
  organization?: { title?: string; name?: string };
  tags?: Array<{ name?: string; display_name?: string }>;
  resources?: CkanResource[];
};

function cleanText(value: unknown, max = 20_000): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

function relevanceScore(dataset: CkanDataset, query: string): number {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 3);
  const title = cleanText(dataset.title).toLowerCase();
  const notes = cleanText(dataset.notes).toLowerCase();
  const tags = (dataset.tags ?? [])
    .map((tag) => cleanText(tag.display_name || tag.name).toLowerCase())
    .join(" ");
  const resources = dataset.resources ?? [];
  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += 8;
    if (tags.includes(term)) score += 4;
    if (notes.includes(term)) score += 2;
  }
  if (resources.some((resource) => resource.datastore_active)) score += 8;
  if (
    resources.some((resource) =>
      /api|json|csv|xlsx|geojson/i.test(cleanText(resource.format)),
    )
  )
    score += 5;
  return score;
}

function normalizeDataset(dataset: CkanDataset, query: string) {
  const resources = (dataset.resources ?? [])
    .slice(0, 12)
    .map((resource) => ({
      id: cleanText(resource.id, 200),
      name: cleanText(resource.name, 500) || "Dataset resource",
      description: cleanText(resource.description, 1_500),
      format: cleanText(resource.format, 60) || "Unknown",
      url: cleanText(resource.url, 2_000),
      apiReady:
        Boolean(resource.datastore_active) ||
        /api|json|csv|geojson/i.test(cleanText(resource.format)),
      lastModified: cleanText(resource.last_modified, 100),
    }))
    .filter((resource) => resource.url);

  return {
    id: cleanText(dataset.id, 200) || cleanText(dataset.name, 200),
    name: cleanText(dataset.name, 300),
    title:
      cleanText(dataset.title, 1_000) ||
      cleanText(dataset.name, 1_000) ||
      "Untitled dataset",
    description: cleanText(dataset.notes, 4_000),
    agency:
      cleanText(
        dataset.organization?.title || dataset.organization?.name,
        500,
      ) || "Agency not reported",
    updatedAt: cleanText(dataset.metadata_modified, 100),
    createdAt: cleanText(dataset.metadata_created, 100),
    tags: (dataset.tags ?? [])
      .map((tag) => cleanText(tag.display_name || tag.name, 120))
      .filter(Boolean)
      .slice(0, 20),
    resources,
    apiReady: resources.some((resource) => resource.apiReady),
    relevanceScore: relevanceScore(dataset, query),
    catalogUrl: dataset.name
      ? `https://catalog.data.gov/dataset/${encodeURIComponent(dataset.name)}`
      : "https://catalog.data.gov/dataset",
  };
}

router.get("/occupational-data/catalog", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.json({
    ok: true,
    topics: TOPICS,
    source: "Curated occupational-health discovery taxonomy",
    limitation:
      "Topic collections organize public-source discovery. Inclusion is a research signal, not a clinical, legal, safety, or compensability determination.",
  });
});

router.get(
  "/occupational-data/datagov",
  async (req: Request, res: Response) => {
    const requested = cleanText(req.query.query, 160);
    const topicId = cleanText(req.query.topic, 80);
    const topic = TOPICS.find((entry) => entry.id === topicId);
    const query =
      requested || topic?.query || "occupational health workplace safety";
    const rows = Math.min(Math.max(Number(req.query.rows) || 24, 1), 50);
    const cacheKey = `${query.toLowerCase()}::${rows}`;
    const cached = searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return res.json(cached.value);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18_000);
    try {
      const params = new URLSearchParams({
        q: query,
        rows: String(rows),
        sort: "score desc, metadata_modified desc",
      });
      const response = await fetch(`${DATA_GOV_SEARCH_URL}?${params}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Occu-Med-Insight-Hub/2.0",
        },
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(`Data.gov catalog returned HTTP ${response.status}`);
      const payload = (await response.json()) as {
        success?: boolean;
        result?: { count?: number; results?: CkanDataset[] };
        error?: unknown;
      };
      if (!payload.success || !payload.result)
        throw new Error("Data.gov catalog returned an invalid response");
      const datasets = (payload.result.results ?? [])
        .map((dataset) => normalizeDataset(dataset, query))
        .sort((a, b) => b.relevanceScore - a.relevanceScore);
      const result = {
        ok: true,
        query,
        topic: topic?.label ?? null,
        count: Number(payload.result.count ?? datasets.length),
        datasets,
        generatedAt: new Date().toISOString(),
        source: "Data.gov CKAN catalog API",
        sourceUrl: `https://catalog.data.gov/dataset/?q=${encodeURIComponent(query)}`,
        limitation:
          "Data.gov is a catalog. Dataset resources remain owned by their publishing agencies; API availability, coverage, definitions, and update schedules vary.",
      };
      searchCache.set(cacheKey, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        value: result,
      });
      return res.json(result);
    } catch (error) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? "Data.gov catalog request timed out"
          : error instanceof Error
            ? error.message
            : "Data.gov catalog search failed";
      return res.status(502).json({ ok: false, error: message });
    } finally {
      clearTimeout(timeout);
    }
  },
);

export default router;
