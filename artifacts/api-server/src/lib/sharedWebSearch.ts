export type SharedSearchProvider = "keenable" | "algolia" | "langsearch" | "exa" | "tavily";

export type SharedSearchItem = {
  id: string;
  title: string;
  url: string;
  snippet: string;
  summary: string;
  provider: SharedSearchProvider;
  publishedAt?: string | null;
};

export type SharedSearchDiagnostic = {
  provider: SharedSearchProvider;
  configured: boolean;
  status: "success" | "no-results" | "not-configured" | "error";
  resultsFound: number;
  message: string;
  error?: string;
};

export type SharedSearchResponse = {
  results: SharedSearchItem[];
  diagnostics: SharedSearchDiagnostic[];
  providersUsed: SharedSearchProvider[];
  fallbackUsed: boolean;
};

const MAX_RESPONSE_BYTES = 2_500_000;
const PRIMARY_PROVIDERS: SharedSearchProvider[] = ["keenable", "algolia", "langsearch"];
const FALLBACK_PROVIDERS: SharedSearchProvider[] = ["exa", "tavily"];

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
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase();
    if (!hostname || hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function hashId(provider: SharedSearchProvider, url: string, title: string): string {
  let hash = 2166136261;
  const value = `${provider}|${url}|${title}`;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${provider}-${(hash >>> 0).toString(16)}`;
}

async function readJson(response: globalThis.Response): Promise<any> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) throw new Error("Search response exceeded the safety limit.");
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_RESPONSE_BYTES) throw new Error("Search response exceeded the safety limit.");
  return JSON.parse(new TextDecoder().decode(buffer));
}

function toItem(provider: SharedSearchProvider, row: any): SharedSearchItem | null {
  const url = safeUrl(row?.url || row?.link || row?.sourceUrl || row?.website);
  if (!url) return null;
  const title = clean(row?.title || row?.name || row?.heading || new URL(url).hostname, 500);
  const snippet = clean(
    row?.snippet || row?.description || row?.summary || row?.text || row?.content || row?._snippetResult?.content?.value,
    2_000,
  );
  const summary = clean(row?.summary || row?.description || row?.snippet || row?.content || row?.text, 3_000) || snippet;
  const publishedAt = clean(row?.publishedAt || row?.datePublished || row?.published_date || row?.publishedDate, 100) || null;
  return {
    id: clean(row?.id || row?.objectID, 500) || hashId(provider, url, title),
    title,
    url,
    snippet,
    summary,
    provider,
    publishedAt,
  };
}

function unique(items: SharedSearchItem[], limit: number): SharedSearchItem[] {
  const seen = new Set<string>();
  const output: SharedSearchItem[] = [];
  for (const item of items) {
    const key = item.url.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
    if (output.length >= limit) break;
  }
  return output;
}

function langSearchKeys(): string[] {
  return [
    process.env.LANGSEARCH_API_KEY,
    process.env.LANGSEARCH_API_KEY_2,
    process.env.LANGSEARCH_API_KEY_3,
    process.env.LANGSEARCH_API_KEY_4,
  ].map((value) => value?.trim()).filter((value): value is string => Boolean(value))
    .filter((value, index, all) => all.indexOf(value) === index);
}

function algoliaIndexes(): string[] {
  const raw = process.env.ALGOLIA_INDEXES || process.env.ALGOLIA_INDEX_NAME || "";
  return raw.split(",").map((value) => value.trim()).filter(Boolean).slice(0, 12);
}

function configured(provider: SharedSearchProvider): boolean {
  if (provider === "keenable") return Boolean(process.env.KEENABLE_API_KEY?.trim());
  if (provider === "algolia") return Boolean(process.env.ALGOLIA_API_KEY?.trim() && process.env.ALGOLIA_APP_ID?.trim() && algoliaIndexes().length);
  if (provider === "langsearch") return langSearchKeys().length > 0;
  if (provider === "exa") return Boolean(process.env.EXA_API_KEY?.trim());
  return Boolean(process.env.TAVILY_API_KEY?.trim());
}

async function searchKeenable(query: string, limit: number): Promise<SharedSearchItem[]> {
  const key = process.env.KEENABLE_API_KEY?.trim();
  if (!key) return [];
  const response = await fetch("https://api.keenable.ai/v1/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "X-Keenable-Title": "Occu-Med Insight Hub 2.0",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, max_results: Math.max(1, Math.min(20, limit)) }),
  });
  const payload = await readJson(response);
  if (!response.ok) throw new Error(clean(payload?.detail || payload?.message || payload?.error, 240) || `HTTP ${response.status}`);
  return (Array.isArray(payload?.results) ? payload.results : [])
    .map((row: any) => toItem("keenable", row))
    .filter((item: SharedSearchItem | null): item is SharedSearchItem => Boolean(item));
}

async function searchAlgolia(query: string, limit: number): Promise<SharedSearchItem[]> {
  const apiKey = process.env.ALGOLIA_API_KEY?.trim();
  const appId = process.env.ALGOLIA_APP_ID?.trim();
  const indexes = algoliaIndexes();
  if (!apiKey || !appId || !indexes.length) return [];

  const response = await fetch(`https://${encodeURIComponent(appId)}-dsn.algolia.net/1/indexes/*/queries`, {
    method: "POST",
    headers: {
      "X-Algolia-Application-Id": appId,
      "X-Algolia-API-Key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      requests: indexes.map((indexName) => ({
        indexName,
        params: `query=${encodeURIComponent(query)}&hitsPerPage=${Math.max(1, Math.min(20, limit))}`,
      })),
    }),
  });
  const payload = await readJson(response);
  if (!response.ok) throw new Error(clean(payload?.message || payload?.error, 240) || `HTTP ${response.status}`);
  const rows = (Array.isArray(payload?.results) ? payload.results : []).flatMap((result: any) => Array.isArray(result?.hits) ? result.hits : []);
  return rows
    .map((row: any) => toItem("algolia", row))
    .filter((item: SharedSearchItem | null): item is SharedSearchItem => Boolean(item));
}

async function searchLangSearch(query: string, limit: number): Promise<SharedSearchItem[]> {
  const keys = langSearchKeys();
  const errors: string[] = [];
  for (const key of keys) {
    try {
      const response = await fetch("https://api.langsearch.com/v1/web-search", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, freshness: "noLimit", summary: true, count: Math.max(1, Math.min(10, limit)) }),
      });
      const payload = await readJson(response);
      if (!response.ok || (payload?.code && payload.code !== 200)) {
        throw new Error(clean(payload?.msg || payload?.message || payload?.error, 240) || `HTTP ${response.status}`);
      }
      const rows = payload?.data?.webPages?.value || [];
      return rows
        .map((row: any) => toItem("langsearch", row))
        .filter((item: SharedSearchItem | null): item is SharedSearchItem => Boolean(item));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "request failed");
    }
  }
  if (errors.length) throw new Error(errors.join("; "));
  return [];
}

async function searchExa(query: string, limit: number): Promise<SharedSearchItem[]> {
  const key = process.env.EXA_API_KEY?.trim();
  if (!key) return [];
  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query,
      numResults: Math.max(1, Math.min(10, limit)),
      type: "auto",
      contents: { text: { maxCharacters: 1_200 } },
    }),
  });
  const payload = await readJson(response);
  if (!response.ok) throw new Error(clean(payload?.message || payload?.error, 240) || `HTTP ${response.status}`);
  return (Array.isArray(payload?.results) ? payload.results : [])
    .map((row: any) => toItem("exa", row))
    .filter((item: SharedSearchItem | null): item is SharedSearchItem => Boolean(item));
}

async function searchTavily(query: string, limit: number): Promise<SharedSearchItem[]> {
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) return [];
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query,
      max_results: Math.max(1, Math.min(10, limit)),
      include_answer: false,
      search_depth: "basic",
    }),
  });
  const payload = await readJson(response);
  if (!response.ok) throw new Error(clean(payload?.message || payload?.error, 240) || `HTTP ${response.status}`);
  return (Array.isArray(payload?.results) ? payload.results : [])
    .map((row: any) => toItem("tavily", row))
    .filter((item: SharedSearchItem | null): item is SharedSearchItem => Boolean(item));
}

async function runProvider(provider: SharedSearchProvider, query: string, limit: number): Promise<SharedSearchItem[]> {
  if (provider === "keenable") return searchKeenable(query, limit);
  if (provider === "algolia") return searchAlgolia(query, limit);
  if (provider === "langsearch") return searchLangSearch(query, limit);
  if (provider === "exa") return searchExa(query, limit);
  return searchTavily(query, limit);
}

export function sharedSearchConfiguration(): Record<SharedSearchProvider, boolean> {
  return {
    keenable: configured("keenable"),
    algolia: configured("algolia"),
    langsearch: configured("langsearch"),
    exa: configured("exa"),
    tavily: configured("tavily"),
  };
}

export async function searchSharedWeb(query: string, options?: { limit?: number }): Promise<SharedSearchResponse> {
  const limit = Math.max(1, Math.min(30, Number(options?.limit || 12)));
  const diagnostics: SharedSearchDiagnostic[] = [];
  const collected: SharedSearchItem[] = [];
  const providersUsed: SharedSearchProvider[] = [];

  for (const provider of PRIMARY_PROVIDERS) {
    if (!configured(provider)) {
      const extra = provider === "algolia" && process.env.ALGOLIA_API_KEY?.trim()
        ? " ALGOLIA_APP_ID and ALGOLIA_INDEXES are also required."
        : "";
      diagnostics.push({ provider, configured: false, status: "not-configured", resultsFound: 0, message: `${provider} is not fully configured.${extra}` });
      continue;
    }
    try {
      const results = await runProvider(provider, query, limit);
      providersUsed.push(provider);
      collected.push(...results);
      diagnostics.push({
        provider,
        configured: true,
        status: results.length ? "success" : "no-results",
        resultsFound: results.length,
        message: results.length ? `${provider} returned ${results.length} result(s).` : `${provider} returned no results.`,
      });
    } catch (error) {
      diagnostics.push({
        provider,
        configured: true,
        status: "error",
        resultsFound: 0,
        message: `${provider} search failed.`,
        error: error instanceof Error ? error.message : "request failed",
      });
    }
  }

  const primaryResults = unique(collected, limit);
  if (primaryResults.length > 0) {
    return { results: primaryResults, diagnostics, providersUsed, fallbackUsed: false };
  }

  for (const provider of FALLBACK_PROVIDERS) {
    if (!configured(provider)) {
      diagnostics.push({ provider, configured: false, status: "not-configured", resultsFound: 0, message: `${provider} is not configured.` });
      continue;
    }
    try {
      const results = await runProvider(provider, query, limit);
      providersUsed.push(provider);
      diagnostics.push({
        provider,
        configured: true,
        status: results.length ? "success" : "no-results",
        resultsFound: results.length,
        message: results.length ? `${provider} fallback returned ${results.length} result(s).` : `${provider} fallback returned no results.`,
      });
      if (results.length) {
        return { results: unique(results, limit), diagnostics, providersUsed, fallbackUsed: true };
      }
    } catch (error) {
      diagnostics.push({
        provider,
        configured: true,
        status: "error",
        resultsFound: 0,
        message: `${provider} fallback search failed.`,
        error: error instanceof Error ? error.message : "request failed",
      });
    }
  }

  return { results: [], diagnostics, providersUsed, fallbackUsed: providersUsed.some((provider) => FALLBACK_PROVIDERS.includes(provider)) };
}
