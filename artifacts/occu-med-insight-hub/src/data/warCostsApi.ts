export type WarCostsDatasetResponse = {
  ok: boolean;
  source: "WarCosts.org";
  attribution: string;
  dataset: string;
  category: string;
  refreshClass: "live" | "frequent" | "periodic";
  itemCount: number;
  fetchedAt: string;
  cached: boolean;
  mirrorSource?: "live" | "database";
  data: unknown;
  error?: string;
};

export type WarCostsPageCrawlStatus = {
  running: boolean;
  startedAt?: string;
  completedAt?: string;
  pagesVisited: number;
  pagesStored: number;
  pagesFailed: number;
  queueSize: number;
  lastError?: string;
};

export type WarCostsPageOverview = {
  ok: boolean;
  source: string;
  attribution: string;
  mirrorPurpose: string;
  summary: { total: number; byType: Record<string, number>; latestFetchedAt?: string };
  crawl: WarCostsPageCrawlStatus;
  maxPages: number;
};

export type WarCostsPageCatalogItem = {
  path: string;
  url: string;
  page_type: string;
  title: string;
  description: string;
  char_count: number;
  fetched_at: string;
};

export type WarCostsPageEvidence = {
  path: string;
  url: string;
  page_type: string;
  title: string;
  description: string;
  headings: string[];
  evidence_text: string;
  char_count: number;
  link_count: number;
  content_hash: string;
  fetched_at: string;
};

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Defense-source request failed with HTTP ${response.status}`);
  return payload;
}

export async function getWarCostsDataset(name: string, refresh = false): Promise<WarCostsDatasetResponse> {
  const suffix = refresh ? "?refresh=1" : "";
  const response = await fetch(`/api/war-costs/dataset/${encodeURIComponent(name)}${suffix}`, { headers: { Accept: "application/json" } });
  return readJson<WarCostsDatasetResponse>(response);
}

export async function getWarCostsPageOverview(): Promise<WarCostsPageOverview> {
  const response = await fetch("/api/war-costs/pages/overview", { headers: { Accept: "application/json" } });
  return readJson<WarCostsPageOverview>(response);
}

async function getWarCostsPageCatalogSlice(type: string, limit: number): Promise<{ ok: boolean; total: number; pages: WarCostsPageCatalogItem[] }> {
  const params = new URLSearchParams({ type, limit: String(limit) });
  const response = await fetch(`/api/war-costs/pages/catalog?${params.toString()}`, { headers: { Accept: "application/json" } });
  return readJson(response);
}

export async function getWarCostsPageCatalog(type?: string, limit = 2_000): Promise<{ ok: boolean; total: number; pages: WarCostsPageCatalogItem[] }> {
  if (type) return getWarCostsPageCatalogSlice(type, limit);
  const overview = await getWarCostsPageOverview();
  const types = Object.keys(overview.summary.byType);
  if (!types.length) return { ok: true, total: 0, pages: [] };
  const responses = await Promise.all(types.map((pageType) => getWarCostsPageCatalogSlice(pageType, limit)));
  const byPath = new Map<string, WarCostsPageCatalogItem>();
  for (const response of responses) {
    for (const page of response.pages) byPath.set(page.path, page);
  }
  const pages = [...byPath.values()].sort((a, b) => a.page_type.localeCompare(b.page_type) || a.title.localeCompare(b.title));
  return { ok: responses.every((response) => response.ok), total: pages.length, pages };
}

export async function getWarCostsPageEvidence(path: string): Promise<{ ok: boolean; page: WarCostsPageEvidence }> {
  const response = await fetch(`/api/war-costs/pages/evidence?path=${encodeURIComponent(path)}`, { headers: { Accept: "application/json" } });
  return readJson(response);
}

export async function searchWarCostsPages(query: string): Promise<{ ok: boolean; query: string; total: number; results: Array<WarCostsPageCatalogItem & { evidence_excerpt?: string }> }> {
  const response = await fetch(`/api/war-costs/pages/search?q=${encodeURIComponent(query)}`, { headers: { Accept: "application/json" } });
  return readJson(response);
}

export async function refreshWarCostsPages(): Promise<{ ok: boolean; started?: boolean; alreadyRunning?: boolean; crawl: WarCostsPageCrawlStatus }> {
  const response = await fetch("/api/war-costs/pages/refresh", { method: "POST", headers: { Accept: "application/json" } });
  return readJson(response);
}
