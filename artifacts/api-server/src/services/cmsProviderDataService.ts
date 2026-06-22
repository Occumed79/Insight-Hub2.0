/**
 * CMS Provider Data Catalog Service
 *
 * Integrates the public CMS Provider Data Catalog DKAN API.
 * Base URL: https://data.cms.gov/provider-data/api/1
 *
 * This service provides:
 *   - Catalog search (datasets, providers, facilities)
 *   - Dataset metadata lookup by identifier
 *   - Datastore import stats
 *   - Datastore query (POST/GET) with conditions, limit, offset, sorts
 *
 * Public access does not require CMS_DATA_API_KEY.
 * If CMS_DATA_API_KEY is set, it is NOT used unless future CMS docs require it.
 *
 * This service never:
 *   - Scrapes HTML pages
 *   - Logs full URLs with query params that could contain sensitive values
 *   - Uses API key/secret auth for public catalog endpoints
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type CmsDistribution = {
  identifier?: string;
  title?: string;
  format?: string;
  downloadUrl?: string;
  mediaType?: string;
  apiEndpoint?: string;
};

export type CmsDataset = {
  identifier: string;
  title: string;
  description: string;
  publisher?: string;
  bureauCode?: string[];
  programCode?: string[];
  theme?: string[];
  keywords?: string[];
  modified?: string;
  released?: string;
  accessLevel?: string;
  distributions: CmsDistribution[];
  apiEndpoint?: string;
  downloadLinks?: { format: string; url: string }[];
  sourceUrl?: string;
};

export type CmsSearchResult = {
  datasets: CmsDataset[];
  total: number;
  page: number;
  pageSize: number;
  authMode: "public";
  baseUrl: string;
  raw?: unknown;
};

export type CmsDatasetResult = {
  dataset: CmsDataset | null;
  authMode: "public";
  message?: string;
  raw?: unknown;
};

export type CmsDatastoreStats = {
  identifier: string;
  totalRows?: number;
  columns?: string[];
  message?: string;
  raw?: unknown;
};

export type CmsDatastoreQueryResult = {
  results: Record<string, unknown>[];
  total?: number;
  limit: number;
  offset: number;
  message?: string;
  raw?: unknown;
};

export type CmsProviderDataStatus = {
  configured: boolean;
  enabled: boolean;
  authMode: "public";
  baseUrl: string;
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

function getBaseUrl(): string {
  return getEnv("CMS_PROVIDER_DATA_BASE_URL") || "https://data.cms.gov/provider-data/api/1";
}

function isCmsEnabled(): boolean {
  const enabled = getEnv("CMS_PROVIDER_DATA_ENABLED");
  if (enabled === undefined) return true;
  return isTruthy(enabled);
}

function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/https?:\/\/[^\s]+/g, "[URL redacted]");
  }
  return "CMS provider data request failed";
}

function buildHeaders(): Record<string, string> {
  return { Accept: "application/json", "Content-Type": "application/json" };
}

// ─── Normalization ───────────────────────────────────────────────────────────

function normalizeDataset(raw: Record<string, unknown>): CmsDataset {
  const id = String(raw.identifier || raw.id || "");
  const title = String(raw.title || raw.name || "Untitled");
  const description = String(raw.description || "");
  const baseUrl = getBaseUrl();

  const distributionsRaw = Array.isArray(raw.distribution) ? raw.distribution : [];
  const distributions: CmsDistribution[] = distributionsRaw.map((d) => {
    const dist = d as Record<string, unknown>;
    return {
      identifier: typeof dist.identifier === "string" ? dist.identifier : undefined,
      title: typeof dist.title === "string" ? dist.title : undefined,
      format: typeof dist.format === "string" ? dist.format : undefined,
      downloadUrl: typeof dist.downloadURL === "string" ? dist.downloadURL : (typeof dist.downloadUrl === "string" ? dist.downloadUrl : undefined),
      mediaType: typeof dist.mediaType === "string" ? dist.mediaType : undefined,
      apiEndpoint: typeof dist.apiEndpoint === "string" ? dist.apiEndpoint : undefined,
    };
  });

  const downloadLinks: { format: string; url: string }[] = [];
  for (const dist of distributions) {
    if (dist.downloadUrl) {
      downloadLinks.push({ format: dist.format || "file", url: dist.downloadUrl });
    }
  }

  const apiEndpoint = distributions.find((d) => d.apiEndpoint)?.apiEndpoint;
  const sourceUrl = id ? `https://data.cms.gov/provider-data/dataset/${id}` : undefined;

  const themeRaw = raw.theme;
  const theme = Array.isArray(themeRaw) ? themeRaw.map(String) : (typeof themeRaw === "string" ? [themeRaw] : undefined);

  const keywordsRaw = raw.keyword || raw.tags;
  const keywords = Array.isArray(keywordsRaw) ? keywordsRaw.map(String) : (typeof keywordsRaw === "string" ? keywordsRaw.split(",").map((k) => k.trim()).filter(Boolean) : undefined);

  const bureauCodeRaw = raw.bureauCode;
  const bureauCode = Array.isArray(bureauCodeRaw) ? bureauCodeRaw.map(String) : undefined;

  const programCodeRaw = raw.programCode;
  const programCode = Array.isArray(programCodeRaw) ? programCodeRaw.map(String) : undefined;

  const publisherRaw = raw.publisher;
  const publisher = typeof publisherRaw === "string" ? publisherRaw : (publisherRaw && typeof publisherRaw === "object" ? String((publisherRaw as Record<string, unknown>).name || "") : undefined);

  return {
    identifier: id,
    title,
    description,
    publisher: publisher || undefined,
    bureauCode,
    programCode,
    theme,
    keywords,
    modified: typeof raw.modified === "string" ? raw.modified : undefined,
    released: typeof raw.issued === "string" ? raw.issued : (typeof raw.released === "string" ? raw.released : undefined),
    accessLevel: typeof raw.accessLevel === "string" ? raw.accessLevel : undefined,
    distributions,
    apiEndpoint,
    downloadLinks: downloadLinks.length > 0 ? downloadLinks : undefined,
    sourceUrl,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function searchCmsProviderCatalog(params: {
  query?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
}): Promise<CmsSearchResult> {
  const baseUrl = getBaseUrl();
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));

  const sp = new URLSearchParams();
  if (params.query) sp.set("q", params.query);
  sp.set("page", String(page));
  sp.set("page-size", String(pageSize));
  if (params.sort) sp.set("sort", params.sort);

  const url = `${baseUrl}/search?${sp}`;
  const response = await fetch(url, { headers: buildHeaders() });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`CMS catalog search failed (${response.status}): ${body || response.statusText}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const resultsRaw = Array.isArray(data.results) ? data.results as Record<string, unknown>[] : [];
  const total = Number(data.total || data.count || resultsRaw.length);

  const datasets = resultsRaw.map(normalizeDataset);

  return {
    datasets,
    total,
    page,
    pageSize,
    authMode: "public",
    baseUrl,
    raw: data,
  };
}

export async function getCmsProviderDataset(identifier: string): Promise<CmsDatasetResult> {
  const baseUrl = getBaseUrl();

  const url = `${baseUrl}/metastore/schemas/dataset/items/${encodeURIComponent(identifier)}`;
  const response = await fetch(url, { headers: buildHeaders() });

  if (!response.ok) {
    if (response.status === 404) {
      return {
        dataset: null,
        authMode: "public",
        message: `Dataset ${identifier} not found. It may have been removed or the identifier is incorrect.`,
      };
    }
    const body = await response.text().catch(() => "");
    throw new Error(`CMS dataset lookup failed (${response.status}): ${body || response.statusText}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const dataset = normalizeDataset(data);

  return {
    dataset,
    authMode: "public",
    message: dataset.apiEndpoint
      ? undefined
      : "Only metadata is available for this dataset. Datastore query may be available via distribution IDs.",
    raw: data,
  };
}

export async function getCmsProviderDatastoreStats(identifier: string): Promise<CmsDatastoreStats> {
  const baseUrl = getBaseUrl();

  const url = `${baseUrl}/datastore/imports/${encodeURIComponent(identifier)}`;
  const response = await fetch(url, { headers: buildHeaders() });

  if (!response.ok) {
    if (response.status === 404) {
      return {
        identifier,
        message: `No datastore import found for ${identifier}. This dataset may not have a datastore-backed distribution.`,
      };
    }
    const body = await response.text().catch(() => "");
    throw new Error(`CMS datastore stats failed (${response.status}): ${body || response.statusText}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const totalRows = typeof data.totalRows === "number" ? data.totalRows : (typeof data.count === "number" ? data.count : undefined);
  const columnsRaw = data.columns || data.fields;
  const columns = Array.isArray(columnsRaw) ? columnsRaw.map((c) => {
    if (typeof c === "string") return c;
    if (typeof c === "object" && c !== null) return String((c as Record<string, unknown>).name || (c as Record<string, unknown>).id || "");
    return String(c);
  }) : undefined;

  return {
    identifier,
    totalRows,
    columns,
    raw: data,
  };
}

export async function queryCmsProviderDatastore(params: {
  distributionId?: string;
  datasetId?: string;
  index?: string;
  conditions?: Record<string, unknown>[];
  limit?: number;
  offset?: number;
  sorts?: string[];
}): Promise<CmsDatastoreQueryResult> {
  const baseUrl = getBaseUrl();
  const limit = Math.min(5000, Math.max(1, params.limit || 100));
  const offset = Math.max(0, params.offset || 0);

  const target = params.distributionId
    ? `query/${encodeURIComponent(params.distributionId)}`
    : "query";

  const url = `${baseUrl}/datastore/${target}`;
  const body: Record<string, unknown> = {
    limit,
    offset,
  };

  if (params.datasetId) body.datasetId = params.datasetId;
  if (params.index) body.index = params.index;
  if (params.conditions) body.conditions = params.conditions;
  if (params.sorts) body.sorts = params.sorts;

  const response = await fetch(url, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const respBody = await response.text().catch(() => "");
    throw new Error(`CMS datastore query failed (${response.status}): ${respBody || response.statusText}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const results = Array.isArray(data.results) ? data.results as Record<string, unknown>[] : [];
  const total = typeof data.total === "number" ? data.total : undefined;

  return {
    results,
    total,
    limit,
    offset,
    raw: data,
  };
}

export function getCmsProviderDataStatus(): CmsProviderDataStatus {
  return {
    configured: isCmsEnabled(),
    enabled: isCmsEnabled(),
    authMode: "public",
    baseUrl: getBaseUrl(),
    notes: "CMS Provider Data Catalog public DKAN API; used for provider/facility/service-feasibility context.",
  };
}

export { sanitizeError, isCmsEnabled };
