export type SharedSearchProvider = "keenable" | "tinyfish" | "langsearch" | "exa" | "tavily";

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
const APP_PROVIDERS: SharedSearchProvider[] = ["keenable", "tinyfish", "langsearch"];
const LOCATION_ONLY_PROVIDERS: SharedSearchProvider[] = ["exa", "tavily"];

let nextExaKeyIndex = 0;
let nextTavilyKeyIndex = 0;

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
  const snippet = clean(row?.snippet || row?.description || row?.summary || row?.text || row?.content, 2_000);
  const summary = clean(row?.summary || row?.description || row?.snippet || row?.content || row?.text, 3_000) || snippet;
  const publishedAt = clean(row?.publishedAt || row?.datePublished || row?.published_date || row?.publishedDate, 100) || null;
  return {
    id: clean(row?.id, 500) || hashId(provider, url, title),
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

function uniqueKeys(values: Array<string | undefined>): string[] {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .filter((value, index, all) => all.indexOf(value) === index);
}

function langSearchKeys(): string[] {
  return uniqueKeys([
    process.env.LANGSEARCH_API_KEY,
    process.env.LANGSEARCH_API_KEY_2,
    process.env.LANGSEARCH_API_KEY_3,
    process.env.LANGSEARCH_API_KEY_4,
  ]);
}

function exaKeys(): string[] {
  return uniqueKeys([
    process.env.LOCATION_EXA_API_KEY,
    process.env.LOCATION_EXA_API_KEY_2,
    process.env.LOCATION_EXA_API_KEY_3,
    process.env.LOCATION_EXA_API_KEY_4,
  ]);
}

function tavilyKeys(): string[] {
  return uniqueKeys([
    process.env.LOCATION_TAVILY_API_KEY,
    process.env.LOCATION_TAVILY_API_KEY_2,
    process.env.LOCATION_TAVILY_API_KEY_3,
    process.env.LOCATION_TAVILY_API_KEY_4,
  ]);
}

function appConfigured(provider: SharedSearchProvider): boolean {
  if (provider === "keenable") return Boolean(process.env.KEENABLE_API_KEY?.trim());
  if (provider === "tinyfish") return Boolean(process.env.TINYFISH_API_KEY?.trim());
  if (provider === "langsearch") return langSearchKeys().length > 0;
  return false;
}

function locationConfigured(provider: SharedSearchProvider): boolean {
  if (provider === "exa") return exaKeys().length > 0;
  if (provider === "tavily") return tavilyKeys().length > 0;
  return appConfigured(provider);
}

function isCompanyLocationQuery(query: string): boolean {
  const normalized = query.toLowerCase();
  const markers = ["locations", "offices", "branches", "facilities", "plants", "warehouses", "campuses", "service centers", "operating sites"];
  return markers.filter((marker) => normalized.includes(marker)).length >= 4;
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

async function searchTinyFish(query: string, limit: number): Promise<SharedSearchItem[]> {
  const key = process.env.TINYFISH_API_KEY?.trim();
  if (!key) return [];

  const searchUrl = new URL("https://api.search.tinyfish.ai");
  searchUrl.searchParams.set("query", query);
  const searchResponse = await fetch(searchUrl, {
    headers: { "X-API-Key": key, Accept: "application/json" },
  });
  const searchPayload = await readJson(searchResponse);
  if (!searchResponse.ok) {
    throw new Error(clean(searchPayload?.message || searchPayload?.error || searchPayload?.detail, 240) || `Search HTTP ${searchResponse.status}`);
  }

  const searchRows = (Array.isArray(searchPayload?.results) ? searchPayload.results : [])
    .slice(0, Math.max(1, Math.min(10, limit)));
  const baseItems: SharedSearchItem[] = searchRows
    .map((row: any) => toItem("tinyfish", row))
    .filter((item: SharedSearchItem | null): item is SharedSearchItem => Boolean(item));
  if (!baseItems.length) return [];

  const fetchLimit = Math.max(1, Math.min(10, Number(process.env.TINYFISH_FETCH_MAX_URLS || 8)));
  const urls = baseItems.slice(0, fetchLimit).map((item: SharedSearchItem) => item.url);
  try {
    const fetchResponse = await fetch("https://api.fetch.tinyfish.ai", {
      method: "POST",
      headers: {
        "X-API-Key": key,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ urls, format: "markdown" }),
    });
    const fetchPayload = await readJson(fetchResponse);
    if (!fetchResponse.ok) return baseItems;

    const fetchedRows = Array.isArray(fetchPayload?.results) ? fetchPayload.results : [];
    const fetchedByUrl = new Map<string, any>();
    for (const row of fetchedRows) {
      const url = safeUrl(row?.url);
      if (url) fetchedByUrl.set(url.replace(/\/$/, "").toLowerCase(), row);
    }

    return baseItems.map((item: SharedSearchItem) => {
      const fetched = fetchedByUrl.get(item.url.replace(/\/$/, "").toLowerCase());
      if (!fetched) return item;
      const text = clean(fetched?.text || fetched?.markdown || fetched?.content, 3_000);
      return {
        ...item,
        title: clean(fetched?.title, 500) || item.title,
        snippet: text ? text.slice(0, 2_000) : item.snippet,
        summary: text || item.summary,
      };
    });
  } catch {
    return baseItems;
  }
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
  const keys = exaKeys();
  if (!keys.length) return [];
  const start = nextExaKeyIndex % keys.length;
  const errors: string[] = [];
  for (let offset = 0; offset < keys.length; offset += 1) {
    const keyIndex = (start + offset) % keys.length;
    try {
      const response = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: { "x-api-key": keys[keyIndex], "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          query,
          numResults: Math.max(1, Math.min(10, limit)),
          type: "auto",
          contents: { text: { maxCharacters: 1_200 } },
        }),
      });
      const payload = await readJson(response);
      if (!response.ok) {
        errors.push(`key ${keyIndex + 1}: ${clean(payload?.message || payload?.error, 180) || `HTTP ${response.status}`}`);
        continue;
      }
      nextExaKeyIndex = (keyIndex + 1) % keys.length;
      return (Array.isArray(payload?.results) ? payload.results : [])
        .map((row: any) => toItem("exa", row))
        .filter((item: SharedSearchItem | null): item is SharedSearchItem => Boolean(item));
    } catch (error) {
      errors.push(`key ${keyIndex + 1}: ${error instanceof Error ? error.message : "request failed"}`);
    }
  }
  throw new Error(errors.join("; ") || "All configured Exa location keys failed");
}

async function searchTavily(query: string, limit: number): Promise<SharedSearchItem[]> {
  const keys = tavilyKeys();
  if (!keys.length) return [];
  const start = nextTavilyKeyIndex % keys.length;
  const errors: string[] = [];
  for (let offset = 0; offset < keys.length; offset += 1) {
    const keyIndex = (start + offset) % keys.length;
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${keys[keyIndex]}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          query,
          max_results: Math.max(1, Math.min(10, limit)),
          include_answer: false,
          search_depth: "basic",
        }),
      });
      const payload = await readJson(response);
      if (!response.ok) {
        errors.push(`key ${keyIndex + 1}: ${clean(payload?.message || payload?.error, 180) || `HTTP ${response.status}`}`);
        continue;
      }
      nextTavilyKeyIndex = (keyIndex + 1) % keys.length;
      return (Array.isArray(payload?.results) ? payload.results : [])
        .map((row: any) => toItem("tavily", row))
        .filter((item: SharedSearchItem | null): item is SharedSearchItem => Boolean(item));
    } catch (error) {
      errors.push(`key ${keyIndex + 1}: ${error instanceof Error ? error.message : "request failed"}`);
    }
  }
  throw new Error(errors.join("; ") || "All configured Tavily location keys failed");
}

async function runProvider(provider: SharedSearchProvider, query: string, limit: number): Promise<SharedSearchItem[]> {
  if (provider === "keenable") return searchKeenable(query, limit);
  if (provider === "tinyfish") return searchTinyFish(query, limit);
  if (provider === "langsearch") return searchLangSearch(query, limit);
  if (provider === "exa") return searchExa(query, limit);
  return searchTavily(query, limit);
}

export function sharedSearchConfiguration(): Record<SharedSearchProvider, boolean> {
  return {
    keenable: appConfigured("keenable"),
    tinyfish: appConfigured("tinyfish"),
    langsearch: appConfigured("langsearch"),
    exa: false,
    tavily: false,
  };
}

export function sharedSearchKeyCounts(): Partial<Record<SharedSearchProvider, number>> {
  return {
    tinyfish: process.env.TINYFISH_API_KEY?.trim() ? 1 : 0,
    langsearch: langSearchKeys().length,
    exa: exaKeys().length,
    tavily: tavilyKeys().length,
  };
}

export async function searchSharedWeb(
  query: string,
  options?: { limit?: number; scope?: "app" | "company-location" },
): Promise<SharedSearchResponse> {
  const limit = Math.max(1, Math.min(30, Number(options?.limit || 12)));
  const locationScope = options?.scope === "company-location" || isCompanyLocationQuery(query);
  const providers = locationScope ? [...APP_PROVIDERS, ...LOCATION_ONLY_PROVIDERS] : APP_PROVIDERS;
  const diagnostics: SharedSearchDiagnostic[] = [];
  const collected: SharedSearchItem[] = [];
  const providersUsed: SharedSearchProvider[] = [];

  const outcomes = await Promise.all(providers.map(async (provider) => {
    const configured = locationScope ? locationConfigured(provider) : appConfigured(provider);
    if (!configured) {
      return {
        provider,
        results: [] as SharedSearchItem[],
        diagnostic: {
          provider,
          configured: false,
          status: "not-configured" as const,
          resultsFound: 0,
          message: `${provider} is not configured for ${locationScope ? "company-location" : "app-wide"} search.`,
        },
      };
    }

    try {
      const results = await runProvider(provider, query, limit);
      return {
        provider,
        results,
        diagnostic: {
          provider,
          configured: true,
          status: results.length ? "success" as const : "no-results" as const,
          resultsFound: results.length,
          message: provider === "tinyfish"
            ? `tinyfish returned ${results.length} search result(s) with Fetch enrichment when available.`
            : `${provider} returned ${results.length} result(s).`,
        },
      };
    } catch (error) {
      return {
        provider,
        results: [] as SharedSearchItem[],
        diagnostic: {
          provider,
          configured: true,
          status: "error" as const,
          resultsFound: 0,
          message: `${provider} search failed.`,
          error: error instanceof Error ? error.message : "request failed",
        },
      };
    }
  }));

  for (const outcome of outcomes) {
    diagnostics.push(outcome.diagnostic);
    if (outcome.diagnostic.configured) providersUsed.push(outcome.provider);
    collected.push(...outcome.results);
  }

  return {
    results: unique(collected, limit),
    diagnostics,
    providersUsed,
    fallbackUsed: false,
  };
}
