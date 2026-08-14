import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const DATA_GOV_SEARCH_URLS = [
  "https://catalog.data.gov/api/3/action/package_search",
  "https://catalog.data.gov/api/action/package_search",
] as const;
const ONET_BASE_URL = "https://api-v2.onetcenter.org";
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

type OnetRecord = Record<string, unknown>;
type OnetItem = {
  name: string;
  description?: string;
  value?: unknown;
  response?: unknown;
};
type OnetMatch = {
  title: string;
  code: string;
  score?: number;
  href?: string;
};

function cleanText(value: unknown, max = 20_000): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, max)
    : typeof value === "number" || typeof value === "boolean"
      ? String(value).slice(0, max)
      : "";
}

function asRecord(value: unknown): OnetRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as OnetRecord)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/https?:\/\/[^\s]+/g, "[URL redacted]")
    .replace(/(api[_-]?key|token|authorization)=?[^&\s]*/gi, "$1=[redacted]")
    .slice(0, 420);
}

async function fetchJsonWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 18_000,
): Promise<{ response: globalThis.Response; payload: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    return { response, payload };
  } finally {
    clearTimeout(timeout);
  }
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

    const params = new URLSearchParams({
      q: query,
      rows: String(rows),
      sort: "score desc, metadata_modified desc",
    });
    const failures: string[] = [];

    for (const endpoint of DATA_GOV_SEARCH_URLS) {
      try {
        const { response, payload } = await fetchJsonWithTimeout(
          `${endpoint}?${params}`,
          {
            headers: {
              Accept: "application/json",
              "User-Agent": "Occu-Med-Insight-Hub/2.0",
            },
          },
        );
        if (!response.ok) {
          failures.push(`${new URL(endpoint).pathname}: HTTP ${response.status}`);
          continue;
        }
        const body = payload as {
          success?: boolean;
          result?: { count?: number; results?: CkanDataset[] };
        } | null;
        if (!body?.success || !body.result) {
          failures.push(`${new URL(endpoint).pathname}: invalid CKAN response`);
          continue;
        }

        const datasets = (body.result.results ?? [])
          .map((dataset) => normalizeDataset(dataset, query))
          .sort((a, b) => b.relevanceScore - a.relevanceScore);
        const result = {
          ok: true,
          query,
          topic: topic?.label ?? null,
          count: Number(body.result.count ?? datasets.length),
          datasets,
          generatedAt: new Date().toISOString(),
          source: "Data.gov CKAN catalog API",
          sourceEndpoint: new URL(endpoint).pathname,
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
        failures.push(safeError(error));
      }
    }

    return res.status(502).json({
      ok: false,
      error:
        "Data.gov catalog search is temporarily unavailable through both official CKAN action paths.",
      attempts: failures,
      sourceUrl: `https://catalog.data.gov/dataset/?q=${encodeURIComponent(query)}`,
      limitation:
        "No dataset rows are synthesized when the official catalog endpoints fail. Use the source link for manual review and retry the API search later.",
    });
  },
);

function getOnetApiKey(): string | undefined {
  return process.env.ONET_API_KEY?.trim() || undefined;
}

async function fetchOnet(path: string): Promise<unknown> {
  const apiKey = getOnetApiKey();
  if (!apiKey) throw new Error("ONET_API_KEY is not configured.");
  const cacheKey = `onet:${path}`;
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const { response, payload } = await fetchJsonWithTimeout(
    `${ONET_BASE_URL}${path}`,
    {
      headers: {
        "X-API-Key": apiKey,
        Accept: "application/json",
        "User-Agent": "Occu-Med-Insight-Hub/2.0 occupational research",
      },
    },
    20_000,
  );
  if (!response.ok) {
    const record = asRecord(payload);
    const detail =
      cleanText(record?.message, 240) ||
      cleanText(record?.detail, 240) ||
      `HTTP ${response.status}`;
    throw new Error(`O*NET request failed: ${detail}`);
  }
  if (payload === null) throw new Error("O*NET returned invalid JSON.");
  searchCache.set(cacheKey, {
    expiresAt: Date.now() + 6 * 60 * 60 * 1000,
    value: payload,
  });
  return payload;
}

function normalizeOnetSearch(payload: unknown): OnetMatch[] {
  const record = asRecord(payload);
  const raw = asArray(
    record?.career ??
      record?.occupation ??
      record?.occupations ??
      record?.results,
  );
  return raw
    .map((item) => {
      const row = asRecord(item);
      const scoreValue = Number(row?.score ?? row?.relevance);
      return {
        title: cleanText(row?.title ?? row?.name, 300),
        code: cleanText(row?.code ?? row?.onetsoc_code, 40),
        score: Number.isFinite(scoreValue) ? scoreValue : undefined,
        href: cleanText(row?.href, 1_000) || undefined,
      };
    })
    .filter((item) => item.title && item.code);
}

function normalizeOnetItems(payload: unknown, keys: string[]): OnetItem[] {
  const record = asRecord(payload);
  let raw: unknown[] = [];
  for (const key of keys) {
    raw = asArray(record?.[key]);
    if (raw.length) break;
  }
  if (!raw.length && Array.isArray(payload)) raw = payload;

  return raw
    .map((item) => {
      if (typeof item === "string") return { name: item };
      const row = asRecord(item);
      return {
        name: cleanText(
          row?.name ?? row?.title ?? row?.element_name ?? row?.statement,
          1_000,
        ),
        description: cleanText(row?.description, 2_000) || undefined,
        value: row?.value ?? row?.importance ?? row?.context,
        response: row?.response,
      };
    })
    .filter((item) => item.name || item.description);
}

async function loadOnetOccupation(code: string) {
  const paths = {
    overview: `/online/occupations/${encodeURIComponent(code)}/`,
    tasks: `/online/occupations/${encodeURIComponent(code)}/details/tasks?end=50`,
    workContext: `/online/occupations/${encodeURIComponent(code)}/details/work_context?end=50`,
    abilities: `/online/occupations/${encodeURIComponent(code)}/details/abilities?end=50`,
    workActivities: `/online/occupations/${encodeURIComponent(code)}/details/work_activities?end=50`,
    detailedWorkActivities: `/online/occupations/${encodeURIComponent(code)}/details/detailed_work_activities?end=50`,
    skills: `/online/occupations/${encodeURIComponent(code)}/details/skills?end=50`,
    knowledge: `/online/occupations/${encodeURIComponent(code)}/details/knowledge?end=50`,
    relatedOccupations: `/online/occupations/${encodeURIComponent(code)}/related_occupations?end=50`,
    technologySkills: `/online/occupations/${encodeURIComponent(code)}/details/technology_skills?end=50`,
  };
  const names = Object.keys(paths) as Array<keyof typeof paths>;
  const entries = await Promise.allSettled(
    names.map((name) => fetchOnet(paths[name])),
  );
  const fulfilledCount = entries.filter((entry) => entry.status === "fulfilled").length;
  if (!fulfilledCount) {
    const firstFailure = entries.find(
      (entry): entry is PromiseRejectedResult => entry.status === "rejected",
    );
    throw firstFailure?.reason ?? new Error("O*NET occupation detail requests failed.");
  }
  const value = (index: number): unknown =>
    entries[index]?.status === "fulfilled" ? entries[index].value : {};

  return {
    overview: asRecord(value(0)) ?? {},
    tasks: normalizeOnetItems(value(1), ["task", "tasks", "element", "items"]),
    workContext: normalizeOnetItems(value(2), ["element", "work_context", "items"]),
    abilities: normalizeOnetItems(value(3), ["element", "ability", "abilities", "items"]),
    workActivities: normalizeOnetItems(value(4), ["element", "work_activity", "work_activities", "items"]),
    detailedWorkActivities: normalizeOnetItems(value(5), ["element", "detailed_work_activity", "detailed_work_activities", "items"]),
    skills: normalizeOnetItems(value(6), ["element", "skill", "skills", "items"]),
    knowledge: normalizeOnetItems(value(7), ["element", "knowledge", "items"]),
    relatedOccupations: normalizeOnetItems(value(8), ["occupation", "career", "related_occupation", "items"]),
    technologySkills: normalizeOnetItems(value(9), ["technology_skill", "technology_skills", "item", "items"]),
    partialErrors: entries.flatMap((entry, index) =>
      entry.status === "rejected"
        ? [{ section: names[index], error: safeError(entry.reason) }]
        : [],
    ),
  };
}

function itemText(item: OnetItem): string {
  return `${item.name} ${item.description || ""}`.toLowerCase();
}

function phraseMatch(text: string, phrase: string): boolean {
  const escaped = phrase
    .toLowerCase()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}

function matchesAny(item: OnetItem, phrases: string[]): boolean {
  const text = itemText(item);
  return phrases.some((phrase) => phraseMatch(text, phrase));
}

const PHYSICAL_TERMS = [
  "static strength",
  "dynamic strength",
  "trunk strength",
  "stamina",
  "manual dexterity",
  "finger dexterity",
  "gross body coordination",
  "gross body equilibrium",
  "lifting",
  "carrying",
  "climbing",
  "bending",
  "kneeling",
  "crouching",
  "crawling",
  "reaching",
  "standing",
  "walking",
  "running",
  "repetitive motions",
  "handling and moving objects",
];

const COGNITIVE_TERMS = [
  "oral comprehension",
  "written comprehension",
  "oral expression",
  "written expression",
  "deductive reasoning",
  "inductive reasoning",
  "information ordering",
  "memorization",
  "problem sensitivity",
  "selective attention",
  "time sharing",
  "making decisions",
  "judgment and decision making",
  "analyzing data",
  "planning",
  "scheduling",
  "interpreting information",
];

const ENVIRONMENT_TERMS = [
  "outdoors",
  "weather",
  "extreme heat",
  "extreme cold",
  "very hot",
  "very cold",
  "noise levels",
  "vibration",
  "contaminants",
  "hazardous conditions",
  "radiation",
  "disease or infections",
  "cramped work space",
  "high places",
];

const SAFETY_TERMS = [
  "hazardous equipment",
  "hazardous conditions",
  "protective equipment",
  "responsible for others' health and safety",
  "responsible for others health and safety",
  "disease or infections",
  "radiation",
  "high places",
  "contaminants",
  "emergency",
  "operating vehicles",
  "operating equipment",
  "inspect equipment",
  "safety procedures",
  "public safety",
];

function demandSummary(items: OnetItem[], label: string): string {
  if (!items.length)
    return `No ${label} indicators were identified by the bounded O*NET taxonomy used in this view.`;
  return `${items.length} source-backed ${label} indicator${items.length === 1 ? "" : "s"} identified, including ${items
    .slice(0, 3)
    .map((item) => item.name)
    .join(", ")}.`;
}

function buildOnetContext(
  keyword: string,
  matches: OnetMatch[],
  bundle: Awaited<ReturnType<typeof loadOnetOccupation>>,
) {
  const physicalAbilities = bundle.abilities.filter((item) =>
    matchesAny(item, PHYSICAL_TERMS),
  );
  const physicalActivities = bundle.workActivities.filter((item) =>
    matchesAny(item, PHYSICAL_TERMS),
  );
  const physicalDetailed = bundle.detailedWorkActivities.filter((item) =>
    matchesAny(item, PHYSICAL_TERMS),
  );
  const physicalContext = bundle.workContext.filter((item) =>
    matchesAny(item, PHYSICAL_TERMS),
  );
  const cognitiveAbilities = bundle.abilities.filter((item) =>
    matchesAny(item, COGNITIVE_TERMS),
  );
  const cognitiveActivities = bundle.workActivities.filter((item) =>
    matchesAny(item, COGNITIVE_TERMS),
  );
  const cognitiveContext = bundle.workContext.filter((item) =>
    matchesAny(item, COGNITIVE_TERMS),
  );
  const environmentalContext = bundle.workContext.filter((item) =>
    matchesAny(item, ENVIRONMENT_TERMS),
  );
  const safetyContext = bundle.workContext.filter((item) =>
    matchesAny(item, SAFETY_TERMS),
  );
  const safetyActivities = bundle.workActivities.filter((item) =>
    matchesAny(item, SAFETY_TERMS),
  );
  const safetyTasks = bundle.tasks.filter((item) => matchesAny(item, SAFETY_TERMS));

  const safetyIndicators = [
    safetyContext.length
      ? `${safetyContext.length} O*NET work-context item(s) matched the bounded hazard/protection taxonomy.`
      : "",
    safetyActivities.length
      ? `${safetyActivities.length} O*NET work-activity item(s) matched explicit safety, equipment, vehicle, or emergency terms.`
      : "",
    safetyTasks.length
      ? `${safetyTasks.length} O*NET task statement(s) matched explicit safety, inspection, equipment, or emergency terms.`
      : "",
  ].filter(Boolean);

  return {
    occupation: {
      code: cleanText(bundle.overview.code, 40) || matches[0]?.code || "",
      title:
        cleanText(bundle.overview.title, 300) || matches[0]?.title || keyword,
      score: matches[0]?.score,
      description: cleanText(bundle.overview.description, 4_000),
    },
    matches,
    physical_demands: {
      summary: demandSummary(
        [...physicalAbilities, ...physicalActivities, ...physicalContext],
        "physical-demand",
      ),
      abilities: physicalAbilities.slice(0, 16),
      work_activities: physicalActivities.slice(0, 16),
      detailed_work_activities: physicalDetailed.slice(0, 16),
      work_context: physicalContext.slice(0, 16),
    },
    cognitive_demands: {
      summary: demandSummary(
        [...cognitiveAbilities, ...cognitiveActivities, ...cognitiveContext],
        "cognitive-demand",
      ),
      abilities: cognitiveAbilities.slice(0, 16),
      work_activities: cognitiveActivities.slice(0, 16),
      work_context: cognitiveContext.slice(0, 16),
    },
    safety_sensitive_indicators: {
      safety_sensitive:
        safetyContext.length + safetyActivities.length + safetyTasks.length > 0,
      indicators:
        safetyIndicators.length > 0
          ? safetyIndicators
          : [
              "No explicit hazard/protection/safety indicator matched the bounded O*NET taxonomy in the returned sections.",
            ],
      work_context: safetyContext.slice(0, 16),
      work_activities: safetyActivities.slice(0, 16),
      tasks: safetyTasks.slice(0, 16),
    },
    environmental_indicators: {
      summary: demandSummary(environmentalContext, "environmental-exposure"),
      work_context: environmentalContext.slice(0, 20),
    },
    essential_function_suggestions: bundle.tasks
      .slice(0, 12)
      .map((item) => item.name),
    partialErrors: bundle.partialErrors,
    raw: {
      tasks: bundle.tasks,
      work_context: bundle.workContext,
      abilities: bundle.abilities,
      work_activities: bundle.workActivities,
    },
  };
}

function validateOnetCode(value: unknown): string {
  const code = cleanText(value, 40);
  if (!/^\d{2}-\d{4}(?:\.\d{2})?$/.test(code))
    throw new Error("A valid O*NET-SOC code is required.");
  return code;
}

router.get("/occupational-onet/search", async (req: Request, res: Response) => {
  const keyword = cleanText(req.query.keyword, 120);
  if (!keyword)
    return res.status(400).json({ ok: false, error: "keyword is required" });
  try {
    const payload = await fetchOnet(
      `/mnm/search?${new URLSearchParams({ keyword, end: "20" })}`,
    );
    const matches = normalizeOnetSearch(payload);
    return res.json({
      ok: true,
      keyword,
      matches,
      count: matches.length,
      source: "O*NET Web Services API v2",
      sourceEndpoint: "/mnm/search",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: safeError(error) });
  }
});

router.get(
  "/occupational-onet/occupation/:code",
  async (req: Request, res: Response) => {
    let code: string;
    try {
      code = validateOnetCode(req.params.code);
    } catch (error) {
      return res.status(400).json({ ok: false, error: safeError(error) });
    }
    try {
      const bundle = await loadOnetOccupation(code);
      return res.json({
        ok: true,
        occupation: {
          code,
          title: cleanText(bundle.overview.title, 300),
          description: cleanText(bundle.overview.description, 4_000),
          tasks: bundle.tasks,
          work_activities: bundle.workActivities,
          detailed_work_activities: bundle.detailedWorkActivities,
          abilities: bundle.abilities,
          work_context: bundle.workContext,
          skills: bundle.skills,
          knowledge: bundle.knowledge,
          related_occupations: bundle.relatedOccupations,
          technology_skills: bundle.technologySkills,
          rawSummary: bundle.overview,
        },
        partialErrors: bundle.partialErrors,
        source: "O*NET Web Services API v2",
      });
    } catch (error) {
      return res.status(502).json({ ok: false, error: safeError(error) });
    }
  },
);

router.get(
  "/occupational-onet/job-context",
  async (req: Request, res: Response) => {
    const keyword = cleanText(req.query.keyword, 120);
    if (!keyword)
      return res.status(400).json({ ok: false, error: "keyword is required" });
    try {
      const searchPayload = await fetchOnet(
        `/mnm/search?${new URLSearchParams({ keyword, end: "20" })}`,
      );
      const matches = normalizeOnetSearch(searchPayload);
      if (!matches.length) {
        return res.json({
          ok: true,
          keyword,
          matches: [],
          context: null,
          message: "No matching O*NET occupations found.",
          source: "O*NET Web Services API v2",
        });
      }
      const bundle = await loadOnetOccupation(matches[0].code);
      return res.json({
        ok: true,
        keyword,
        context: buildOnetContext(keyword, matches, bundle),
        source: "O*NET Web Services API v2",
        classification:
          "Bounded phrase taxonomy over O*NET source fields; no substring matching is used for demand/safety categories.",
      });
    } catch (error) {
      return res.status(502).json({ ok: false, error: safeError(error) });
    }
  },
);

export default router;
