/**
 * HHS / HealthData.gov Public Catalog Discovery Service
 *
 * HealthData.gov is powered by a Socrata-based data catalog. The public
 * catalog/discovery API allows searching for datasets without authentication.
 *
 * If HHS_SOCRATA_APP_TOKEN is configured, it is sent as X-App-Token for
 * higher rate limits. Without a token, public unauthenticated requests
 * are still allowed (with lower rate limits).
 *
 * This service never:
 *   - Scrapes HTML pages
 *   - Requires login
 *   - Logs token values or full URLs containing tokens
 *   - Uses API key/secret auth
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type HhsDataset = {
  id: string;
  title: string;
  description: string;
  domain: string;
  agency?: string;
  publisher?: string;
  category?: string;
  tags: string[];
  updatedAt?: string;
  createdAt?: string;
  rowCount?: number;
  datasetUrl?: string;
  apiEndpoint?: string;
  exportLinks?: { format: string; url: string }[];
};

export type HhsCatalogSearchResult = {
  datasets: HhsDataset[];
  total: number;
  page: number;
  pageSize: number;
  authMode: "app-token" | "public";
  domain: string;
  raw?: unknown;
};

export type HhsCatalogDatasetResult = {
  dataset: HhsDataset | null;
  authMode: "app-token" | "public";
  message?: string;
  raw?: unknown;
};

export type HhsCatalogStatus = {
  configured: boolean;
  enabled: boolean;
  authMode: "app-token" | "public";
  domain: string;
  notes: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getEnv(key: string): string | undefined {
  return process.env[key];
}

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  return value.toLowerCase() === "true" || value === "1" || value === "yes";
}

function getDomain(): string {
  return getEnv("HHS_CATALOG_DOMAIN") || "healthdata.gov";
}

function isCatalogEnabled(): boolean {
  const enabled = getEnv("HHS_CATALOG_ENABLED");
  if (enabled === undefined) return true;
  return isTruthy(enabled);
}

function getAppToken(): string | undefined {
  return getEnv("HHS_SOCRATA_APP_TOKEN");
}

function getAuthMode(): "app-token" | "public" {
  return getAppToken() ? "app-token" : "public";
}

function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/https?:\/\/[^\s]+/g, "[URL redacted]");
  }
  return "HHS catalog request failed";
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const token = getAppToken();
  if (token) {
    headers["X-App-Token"] = token;
  }
  return headers;
}

// ─── Socrata Catalog API ─────────────────────────────────────────────────────

/**
 * Socrata Discovery API endpoint for catalog search.
 * The discovery API is at: https://{domain}/api/catalog/v1
 *
 * Query params:
 *   - q: search text
 *   - limit: page size (default 20)
 *   - offset: pagination offset
 *   - sort: sort order (e.g. "last_updated_date DESC", "relevance")
 */
function buildCatalogUrl(params: {
  query?: string;
  page: number;
  pageSize: number;
  sortBy: string;
}): string {
  const domain = getDomain();
  const sp = new URLSearchParams();

  if (params.query) {
    sp.set("q", params.query);
  }

  sp.set("limit", String(params.pageSize));
  sp.set("offset", String((params.page - 1) * params.pageSize));

  const sortMap: Record<string, string> = {
    newest: "last_updated_date DESC",
    updated: "last_updated_date DESC",
    relevance: "relevance",
    alpha: "name ASC",
  };
  sp.set("sort", sortMap[params.sortBy] || sortMap["newest"]);

  return `https://${domain}/api/catalog/v1?${sp}`;
}

function normalizeDataset(raw: Record<string, unknown>): HhsDataset {
  const resource = (raw.resource || {}) as Record<string, unknown>;
  const classification = (raw.classification || {}) as Record<string, unknown>;
  const metadata = (raw.metadata || {}) as Record<string, unknown>;

  const id = String(resource.id || raw.id || "");
  const name = String(resource.name || raw.name || "Untitled");
  const description = String(resource.description || metadata.description || "");
  const domain = getDomain();

  const updatedAt = resource.updatedAt ?? resource.updated_at ?? raw.updatedAt;
  const createdAt = resource.createdAt ?? resource.created_at ?? raw.createdAt;

  const tagsRaw = classification.tags || metadata.tags || [];
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw.map(String)
    : String(tagsRaw).split(",").map((t) => t.trim()).filter(Boolean);

  const categoryRaw = classification.domain_category ?? classification.category;
  const category = typeof categoryRaw === "string" ? categoryRaw : undefined;

  const apiEndpoint = typeof resource.api_endpoint === "string" ? resource.api_endpoint : undefined;
  const datasetUrl = typeof resource.link === "string" ? resource.link : (id ? `https://${domain}/d/${id}` : undefined);

  const exportLinks: { format: string; url: string }[] = [];
  const exports = resource.exports || {};
  if (typeof exports === "object" && exports !== null) {
    for (const [fmt, url] of Object.entries(exports as Record<string, unknown>)) {
      if (typeof url === "string") {
        exportLinks.push({ format: fmt, url });
      }
    }
  }

  const rowCountRaw = resource.rowCount ?? resource.row_count;
  const rowCount = typeof rowCountRaw === "number" ? rowCountRaw : (typeof rowCountRaw === "string" ? Number(rowCountRaw) : undefined);

  return {
    id,
    title: name,
    description,
    domain,
    agency: String(metadata.agency || raw.agency || "") || undefined,
    publisher: String(metadata.publisher || "") || undefined,
    category: category ? String(category) : undefined,
    tags,
    updatedAt: updatedAt ? String(updatedAt) : undefined,
    createdAt: createdAt ? String(createdAt) : undefined,
    rowCount: rowCount ? Number(rowCount) : undefined,
    datasetUrl,
    apiEndpoint: apiEndpoint ? String(apiEndpoint) : undefined,
    exportLinks: exportLinks.length > 0 ? exportLinks : undefined,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function searchHhsCatalog(params: {
  query?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
}): Promise<HhsCatalogSearchResult> {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const sortBy = params.sortBy || "newest";
  const domain = getDomain();
  const authMode = getAuthMode();

  const url = buildCatalogUrl({ query: params.query, page, pageSize, sortBy });
  const response = await fetch(url, { headers: buildHeaders() });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`HHS catalog search failed (${response.status}): ${body || response.statusText}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const results = Array.isArray(data.results) ? data.results as Record<string, unknown>[] : [];
  const total = Number(data.totalResults || data.total || results.length);

  const datasets = results.map(normalizeDataset);

  return {
    datasets,
    total,
    page,
    pageSize,
    authMode,
    domain,
    raw: data,
  };
}

export async function getHhsDataset(id: string): Promise<HhsCatalogDatasetResult> {
  const domain = getDomain();
  const authMode = getAuthMode();

  const sp = new URLSearchParams();
  sp.set("ids", id);
  sp.set("limit", "1");

  const url = `https://${domain}/api/catalog/v1?${sp}`;
  const response = await fetch(url, { headers: buildHeaders() });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`HHS dataset lookup failed (${response.status}): ${body || response.statusText}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const results = Array.isArray(data.results) ? data.results as Record<string, unknown>[] : [];

  if (results.length === 0) {
    return {
      dataset: null,
      authMode,
      message: `No dataset found with id ${id}. The dataset may have been removed or the id may be incorrect.`,
      raw: data,
    };
  }

  const dataset = normalizeDataset(results[0]);

  return {
    dataset,
    authMode,
    message: dataset.apiEndpoint
      ? undefined
      : "Only metadata is available for this dataset. Row-level API access may require an app token.",
    raw: data,
  };
}

export function getHhsCatalogStatus(): HhsCatalogStatus {
  const token = getAppToken();
  return {
    configured: !!token,
    enabled: isCatalogEnabled(),
    authMode: getAuthMode(),
    domain: getDomain(),
    notes: "Public HealthData.gov catalog discovery; app token optional for higher rate limits.",
  };
}

export { sanitizeError, isCatalogEnabled };
