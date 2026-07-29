import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const ENDPOINT = "https://api.langsearch.com/v1/web-search";
const MAX_RESPONSE_BYTES = 2_500_000;
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

type Workspace = "competitors" | "federal" | "state";
type Freshness = "oneDay" | "oneWeek" | "oneMonth" | "oneYear" | "noLimit";
type SearchItem = {
  id: string;
  title: string;
  url: string;
  displayUrl: string;
  siteName: string;
  snippet: string;
  summary: string;
  publishedAt: string | null;
  lastCrawledAt: string | null;
};

type CacheEntry = {
  results: SearchItem[];
  queryUsed: string;
  expiresAt: number;
  staleUntil: number;
};

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<{ results: SearchItem[]; queryUsed: string }>>();

function keys(): string[] {
  const values = [
    process.env.LANGSEARCH_API_KEY,
    process.env.LANGSEARCH_API_KEY_2,
    process.env.LANGSEARCH_API_KEY_3,
    process.env.LANGSEARCH_API_KEY_4,
  ].map((value) => value?.trim()).filter((value): value is string => Boolean(value));
  return [...new Set(values)];
}

function clean(value: unknown, max = 3_000): string {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function safeUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value || ""));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase();
    if (!hostname || hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/abort|timed out/i.test(message)) return "The LangSearch request timed out. Please retry.";
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/https?:\/\/[^\s]+/g, "[URL redacted]")
    .slice(0, 320);
}

function buildQuery(workspace: Workspace, query: string, state: string, category: string): string {
  const categoryText = category ? ` ${category}` : "";
  if (workspace === "competitors") {
    return `${query}${categoryText} competitor market intelligence services coverage contracts leadership news occupational health`;
  }
  if (workspace === "federal") {
    return `${query}${categoryText} federal agency procurement contract program policy official government`;
  }
  const stateText = state ? ` ${state}` : " United States";
  return `${query}${stateText}${categoryText} state government agency official public source`;
}

async function readLimitedJson(response: globalThis.Response): Promise<any> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    throw new Error("LangSearch response exceeded the safety limit.");
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_RESPONSE_BYTES) {
    throw new Error("LangSearch response exceeded the safety limit.");
  }
  try {
    return JSON.parse(new TextDecoder().decode(buffer));
  } catch {
    throw new Error("LangSearch returned invalid JSON.");
  }
}

function normalizeResults(payload: any): SearchItem[] {
  const rows: any[] = payload?.data?.webPages?.value ?? [];
  const seen = new Set<string>();
  const results: SearchItem[] = [];
  for (const row of rows) {
    const url = safeUrl(row?.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const parsed = new URL(url);
    results.push({
      id: clean(row?.id || url, 500),
      title: clean(row?.name || row?.title || parsed.hostname, 500),
      url,
      displayUrl: clean(row?.displayUrl || url, 700),
      siteName: clean(row?.siteName || parsed.hostname.replace(/^www\./, ""), 160),
      snippet: clean(row?.snippet, 1_200),
      summary: clean(row?.summary || row?.snippet, 3_000),
      publishedAt: clean(row?.datePublished, 100) || null,
      lastCrawledAt: clean(row?.dateLastCrawled, 100) || null,
    });
  }
  return results;
}

async function searchLangSearch(queryUsed: string, freshness: Freshness): Promise<SearchItem[]> {
  const availableKeys = keys();
  if (!availableKeys.length) throw new Error("LANGSEARCH_API_KEY is not configured on the server.");

  let lastError: unknown = null;
  for (let index = 0; index < availableKeys.length; index += 1) {
    const key = availableKeys[index];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 22_000);
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "Occu-Med Insight Hub/2.0 live intelligence search",
        },
        body: JSON.stringify({ query: queryUsed, freshness, summary: true, count: 10 }),
      });
      const payload = await readLimitedJson(response);
      if (!response.ok || (payload?.code && payload.code !== 200)) {
        const detail = clean(payload?.msg || payload?.message || payload?.error, 240);
        const error = new Error(detail || `LangSearch returned HTTP ${response.status}.`);
        lastError = error;
        if (TRANSIENT_STATUSES.has(response.status) && index < availableKeys.length - 1) continue;
        if (response.status === 401 || response.status === 403 || response.status === 429) continue;
        throw error;
      }
      return normalizeResults(payload);
    } catch (error) {
      lastError = error;
      if (index >= availableKeys.length - 1) throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("LangSearch request failed.");
}

async function loadSearch(cacheKey: string, queryUsed: string, freshness: Freshness): Promise<{ results: SearchItem[]; queryUsed: string; cacheState: "fresh" | "refreshed" | "stale" }> {
  const now = Date.now();
  const existing = cache.get(cacheKey);
  if (existing && existing.expiresAt > now) {
    return { results: existing.results, queryUsed: existing.queryUsed, cacheState: "fresh" };
  }

  let promise = inFlight.get(cacheKey);
  if (!promise) {
    promise = searchLangSearch(queryUsed, freshness).then((results) => ({ results, queryUsed }));
    inFlight.set(cacheKey, promise);
  }

  try {
    const loaded = await promise;
    cache.set(cacheKey, {
      ...loaded,
      expiresAt: Date.now() + 10 * 60_000,
      staleUntil: Date.now() + 12 * 60 * 60_000,
    });
    return { ...loaded, cacheState: "refreshed" };
  } catch (error) {
    if (existing && existing.staleUntil > now) {
      return { results: existing.results, queryUsed: existing.queryUsed, cacheState: "stale" };
    }
    throw error;
  } finally {
    inFlight.delete(cacheKey);
    while (cache.size > 250) cache.delete(cache.keys().next().value as string);
  }
}

router.get("/core-intelligence/live-search/status", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  return res.json({
    ok: true,
    configured: keys().length > 0,
    provider: "LangSearch Web Search API",
    environmentVariables: ["LANGSEARCH_API_KEY", "LANGSEARCH_API_KEY_2", "LANGSEARCH_API_KEY_3", "LANGSEARCH_API_KEY_4"],
  });
});

router.get("/core-intelligence/live-search", async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const workspace = clean(req.query.workspace, 40) as Workspace;
  const query = clean(req.query.query, 240);
  const state = clean(req.query.state, 80);
  const category = clean(req.query.category, 120);
  const freshnessCandidate = clean(req.query.freshness, 20) as Freshness;
  const freshness: Freshness = ["oneDay", "oneWeek", "oneMonth", "oneYear", "noLimit"].includes(freshnessCandidate)
    ? freshnessCandidate
    : "noLimit";

  if (!(["competitors", "federal", "state"] as string[]).includes(workspace)) {
    return res.status(400).json({ ok: false, error: "workspace must be competitors, federal, or state" });
  }
  if (query.length < 2) return res.status(400).json({ ok: false, error: "Enter at least two characters to search." });
  if (!keys().length) {
    return res.status(503).json({ ok: false, configured: false, error: "LANGSEARCH_API_KEY is not configured on the server." });
  }

  const queryUsed = buildQuery(workspace, query, state, category);
  const cacheKey = [workspace, query.toLowerCase(), state.toLowerCase(), category.toLowerCase(), freshness].join("|");
  try {
    const loaded = await loadSearch(cacheKey, queryUsed, freshness);
    return res.json({
      ok: true,
      configured: true,
      workspace,
      query,
      state: state || null,
      category: category || null,
      freshness,
      queryUsed: loaded.queryUsed,
      results: loaded.results,
      returned: loaded.results.length,
      cacheState: loaded.cacheState,
      source: "LangSearch Web Search API",
      searchedAt: new Date().toISOString(),
      limitation: "Results are live public-web search leads. Verify material claims against the linked primary source before using them operationally.",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, configured: true, error: safeError(error) });
  }
});

export default router;
