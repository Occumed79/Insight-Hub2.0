import { Router, type IRouter, type Request, type Response } from "express";
import {
  searchSharedWeb,
  sharedSearchConfiguration,
  sharedSearchKeyCounts,
  type SharedSearchDiagnostic,
  type SharedSearchProvider,
} from "../lib/sharedWebSearch";

const router: IRouter = Router();

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
  provider: SharedSearchProvider;
};

type SearchPayload = {
  results: SearchItem[];
  queryUsed: string;
  diagnostics: SharedSearchDiagnostic[];
  providersUsed: SharedSearchProvider[];
  fallbackUsed: boolean;
};

type CacheEntry = SearchPayload & {
  expiresAt: number;
  staleUntil: number;
};

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<SearchPayload>>();

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

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/abort|timed out/i.test(message)) return "The search request timed out. Please retry.";
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
  if (/FMCSA DOT medical examination/i.test(category)) {
    return `${query}${stateText}${categoryText} official FMCSA National Registry Federal Register state driver licensing agency medical certification source`;
  }
  return `${query}${stateText}${categoryText} state government agency official public source`;
}

function isConfigured(): boolean {
  return Object.values(sharedSearchConfiguration()).some(Boolean);
}

async function runSearch(queryUsed: string): Promise<SearchPayload> {
  const response = await searchSharedWeb(queryUsed, { limit: 12 });
  const results: SearchItem[] = response.results.map((item) => {
    const parsed = new URL(item.url);
    return {
      id: item.id,
      title: item.title,
      url: item.url,
      displayUrl: item.url,
      siteName: parsed.hostname.replace(/^www\./, ""),
      snippet: item.snippet,
      summary: item.summary,
      publishedAt: item.publishedAt || null,
      lastCrawledAt: null,
      provider: item.provider,
    };
  });
  return {
    results,
    queryUsed,
    diagnostics: response.diagnostics,
    providersUsed: response.providersUsed,
    fallbackUsed: response.fallbackUsed,
  };
}

async function loadSearch(
  cacheKey: string,
  queryUsed: string,
): Promise<SearchPayload & { cacheState: "fresh" | "refreshed" | "stale" }> {
  const now = Date.now();
  const existing = cache.get(cacheKey);
  if (existing && existing.expiresAt > now) {
    return { ...existing, cacheState: "fresh" };
  }

  let promise = inFlight.get(cacheKey);
  if (!promise) {
    promise = runSearch(queryUsed);
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
      return { ...existing, cacheState: "stale" };
    }
    throw error;
  } finally {
    inFlight.delete(cacheKey);
    while (cache.size > 250) cache.delete(cache.keys().next().value as string);
  }
}

router.get("/core-intelligence/live-search/status", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const providers = sharedSearchConfiguration();
  const keyCounts = sharedSearchKeyCounts();
  return res.json({
    ok: true,
    configured: Object.values(providers).some(Boolean),
    providers,
    activeProviders: ["Keenable", "Algolia", "LangSearch", "Exa", "Tavily"],
    keyCounts,
    environmentVariables: [
      "KEENABLE_API_KEY",
      "ALGOLIA_API_KEY",
      "ALGOLIA_APP_ID",
      "ALGOLIA_INDEXES",
      "LANGSEARCH_API_KEY",
      "LANGSEARCH_API_KEY_2",
      "LANGSEARCH_API_KEY_3",
      "LANGSEARCH_API_KEY_4",
      "EXA_API_KEY",
      "EXA_API_KEY_2",
      "EXA_API_KEY_3",
      "EXA_API_KEY_4",
      "TAVILY_API_KEY",
      "TAVILY_API_KEY_2",
      "TAVILY_API_KEY_3",
      "TAVILY_API_KEY_4",
    ],
  });
});

router.get("/core-intelligence/live-search", async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const workspace = clean(req.query.workspace, 40) as Workspace;
  const query = clean(req.query.query, 240);
  const state = clean(req.query.state, 80);
  const category = clean(req.query.category, 600);
  const freshnessCandidate = clean(req.query.freshness, 20) as Freshness;
  const freshness: Freshness = ["oneDay", "oneWeek", "oneMonth", "oneYear", "noLimit"].includes(freshnessCandidate)
    ? freshnessCandidate
    : "noLimit";

  if (!(["competitors", "federal", "state"] as string[]).includes(workspace)) {
    return res.status(400).json({ ok: false, error: "workspace must be competitors, federal, or state" });
  }
  if (query.length < 2) return res.status(400).json({ ok: false, error: "Enter at least two characters to search." });
  if (!isConfigured()) {
    return res.status(503).json({ ok: false, configured: false, error: "No shared web-search provider is configured on the server." });
  }

  const queryUsed = buildQuery(workspace, query, state, category);
  const cacheKey = [workspace, query.toLowerCase(), state.toLowerCase(), category.toLowerCase(), freshness].join("|");
  try {
    const loaded = await loadSearch(cacheKey, queryUsed);
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
      providersUsed: loaded.providersUsed,
      providerDiagnostics: loaded.diagnostics,
      fallbackUsed: false,
      source: "Keenable + Algolia + LangSearch + Exa + Tavily",
      searchedAt: new Date().toISOString(),
      limitation: "Results are live search leads. Algolia searches configured Insight Hub indexes; web-provider results should be verified against linked primary sources before operational use.",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, configured: true, error: safeError(error) });
  }
});

export default router;
