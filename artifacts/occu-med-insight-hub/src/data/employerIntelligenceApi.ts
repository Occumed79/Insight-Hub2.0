// ─── Types ───────────────────────────────────────────────────────────────────

export type OshaEstablishment = {
  establishmentName: string;
  companyName: string;
  dbaName?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  naics: string;
  year: number;
  totalHoursWorked?: number;
  totalCases?: number;
  dartCases?: number;
  daysAwayCases?: number;
  jobTransferRestrictionCases?: number;
  caseCategories?: string[];
  sourceUrl: string;
  datasetName: string;
  datasetYear: number;
  sourceFileType: string;
  lastImportedDate: string;
  trcRate?: number;
  dartRate?: number;
  daysAwayRate?: number;
};

export type OshaImportRun = {
  datasetName: string;
  datasetYear: number;
  sourceUrl: string;
  sourceFileType: string;
  importedAt: string;
  recordCount: number;
};

export type OshaResponse = {
  ok: boolean;
  records: OshaEstablishment[];
  count: number;
  source: string;
  importEnabled: boolean;
  importRuns?: OshaImportRun[];
  dataSource: "cached-json" | "none";
  warning: string;
  sourceUrl: string;
  error?: string;
};

export type BlsBenchmark = {
  naics: string;
  industryTitle: string;
  year: number;
  trcRate?: number;
  dartRate?: number;
  daysAwayRate?: number;
  fatalityRate?: number;
  sourceUrl: string;
  sourceMetadata: string;
  attemptedSeriesIds?: string[];
};

export type BlsResponse = {
  ok: boolean;
  benchmark: BlsBenchmark | null;
  message?: string;
  configured?: boolean;
  attempted?: boolean;
  source?: string;
  error?: string;
};

export type WorkersCompSource = {
  ok: boolean;
  state: string;
  availableDatasets: { name: string; url: string; type: string }[];
  coverageNotes: string;
  dataLimitations: string;
  claimLevel: boolean;
  aggregate: boolean;
  unavailable: boolean;
  source: string;
  disclaimer: string;
  error?: string;
};

export type EntityMatch = {
  matchType: string;
  source: string;
  confidence: number;
  evidenceFields: string[];
  canonicalName: string;
  aliases: string[];
  dbaNames: string[];
  subsidiaryNames: string[];
  legacyNames: string[];
  cage?: string;
  uei?: string;
  cik?: string;
  ticker?: string;
  naicsCodes?: string[];
  address?: string;
  matchedEstablishments?: { name: string; address: string; source: string }[];
  unmatchedEstablishments?: { name: string; source: string }[];
  warnings: string[];
};

export type EntityResolveResponse = {
  ok: boolean;
  entity: EntityMatch;
  source: string;
  error?: string;
};

export type JobNormalization = {
  ok: boolean;
  inputTitle: string;
  occupationMatches: { title: string; code: string; score?: number }[];
  socCode?: string;
  occupationFamily?: string;
  physicalDemandIndicators: string[];
  environmentalIndicators: string[];
  safetySensitiveIndicators: string[];
  serviceRelevanceTags: string[];
  confidence: number;
  source?: string;
  error?: string;
};

export type OpportunityScore = {
  ok: boolean;
  score: number;
  label: string;
  topFactors: { factor: string; contribution: number }[];
  matchedServices: { service: string; reason: string; fitScore: number }[];
  sourceConfidence: number;
  missingData: string[];
  warnings: string[];
  source?: string;
  error?: string;
};

export type SourceStatus = {
  source: string;
  configured: boolean;
  enabled: boolean;
  lastSync?: string;
  lastError?: string;
  dataType: "live-api" | "cached-import" | "static-index" | "not-configured";
  nextRefresh?: string;
  notes: string;
};

export type SourcesStatusResponse = {
  ok: boolean;
  sources: SourceStatus[];
  error?: string;
};

// ─── API Functions ───────────────────────────────────────────────────────────

export async function normalizeJob(input: {
  jobTitle: string;
  jobDescription?: string;
  company?: string;
  location?: string;
}): Promise<JobNormalization> {
  const response = await fetch("/api/jobs/normalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return await response.json();
}

export async function resolveEmployer(input: {
  companyName: string;
  dbaNames?: string[];
  location?: string;
  state?: string;
  naics?: string;
}): Promise<EntityResolveResponse> {
  const response = await fetch("/api/employers/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return await response.json();
}

export async function fetchOshaEstablishments(params: {
  company?: string;
  state?: string;
  naics?: string;
  year?: string;
}): Promise<OshaResponse> {
  const qs = new URLSearchParams();
  if (params.company) qs.set("company", params.company);
  if (params.state) qs.set("state", params.state);
  if (params.naics) qs.set("naics", params.naics);
  if (params.year) qs.set("year", params.year);
  const response = await fetch(`/api/osha/establishments?${qs}`);
  return await response.json();
}

export async function fetchBlsBenchmark(params: {
  naics: string;
  year?: string;
}): Promise<BlsResponse> {
  const qs = new URLSearchParams({ naics: params.naics });
  if (params.year) qs.set("year", params.year);
  const response = await fetch(`/api/bls/industry-benchmark?${qs}`);
  return await response.json();
}

export async function fetchWorkersCompSources(state: string): Promise<WorkersCompSource> {
  const response = await fetch(`/api/workers-comp/sources?state=${encodeURIComponent(state)}`);
  return await response.json();
}

export async function scoreOpportunity(input: {
  companyName: string;
  oshaEstablishments?: OshaEstablishment[];
  blsBenchmark?: BlsBenchmark | null;
  onetMapping?: JobNormalization | null;
  workersCompNotes?: WorkersCompSource | null;
  locationContext?: string;
  entityConfidence?: number;
}): Promise<OpportunityScore> {
  const response = await fetch("/api/opportunity/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return await response.json();
}

export async function fetchSourcesStatus(): Promise<SourcesStatusResponse> {
  const response = await fetch("/api/sources/status");
  return await response.json();
}

// ─── HHS / HealthData.gov Catalog ────────────────────────────────────────────

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

export type HhsCatalogSearchResponse = {
  ok: boolean;
  datasets: HhsDataset[];
  total: number;
  page: number;
  pageSize: number;
  authMode: "app-token" | "public";
  domain: string;
  message?: string;
  error?: string;
};

export type HhsCatalogDatasetResponse = {
  ok: boolean;
  dataset: HhsDataset | null;
  authMode: "app-token" | "public";
  message?: string;
  error?: string;
};

export type HhsCatalogStatusResponse = {
  ok: boolean;
  configured: boolean;
  enabled: boolean;
  authMode: "app-token" | "public";
  domain: string;
  notes: string;
  error?: string;
};

export async function searchHhsCatalog(params: {
  query?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
}): Promise<HhsCatalogSearchResponse> {
  const qs = new URLSearchParams();
  if (params.query) qs.set("query", params.query);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.sortBy) qs.set("sortBy", params.sortBy);
  const response = await fetch(`/api/hhs/catalog/search?${qs}`);
  return await response.json();
}

export async function fetchHhsDataset(id: string): Promise<HhsCatalogDatasetResponse> {
  const response = await fetch(`/api/hhs/catalog/datasets/${encodeURIComponent(id)}`);
  return await response.json();
}

export async function fetchHhsCatalogStatus(): Promise<HhsCatalogStatusResponse> {
  const response = await fetch("/api/hhs/catalog/status");
  return await response.json();
}

// ─── CMS Provider Data Catalog ───────────────────────────────────────────────

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

export type CmsSearchResponse = {
  ok: boolean;
  datasets: CmsDataset[];
  total: number;
  page: number;
  pageSize: number;
  authMode: "public";
  baseUrl: string;
  message?: string;
  error?: string;
};

export type CmsDatasetResponse = {
  ok: boolean;
  dataset: CmsDataset | null;
  authMode: "public";
  message?: string;
  error?: string;
};

export type CmsProviderDataStatusResponse = {
  ok: boolean;
  configured: boolean;
  enabled: boolean;
  authMode: "public";
  baseUrl: string;
  notes: string;
  error?: string;
};

export async function searchCmsProviderData(params: {
  query?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
}): Promise<CmsSearchResponse> {
  const qs = new URLSearchParams();
  if (params.query) qs.set("query", params.query);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.sort) qs.set("sort", params.sort);
  const response = await fetch(`/api/cms/provider-data/search?${qs}`);
  return await response.json();
}

export async function fetchCmsDataset(identifier: string): Promise<CmsDatasetResponse> {
  const response = await fetch(`/api/cms/provider-data/datasets/${encodeURIComponent(identifier)}`);
  return await response.json();
}

export async function fetchCmsProviderDataStatus(): Promise<CmsProviderDataStatusResponse> {
  const response = await fetch("/api/cms/provider-data/status");
  return await response.json();
}
