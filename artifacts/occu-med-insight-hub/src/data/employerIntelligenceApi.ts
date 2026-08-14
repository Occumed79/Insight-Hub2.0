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
  dataSource: "cached-json" | "database-import" | "none";
  warning: string;
  sourceUrl: string;
  error?: string;
};

export type BlsAuthMode = "registered-v2" | "public-v2";

export type BlsBenchmark = {
  naics: string;
  industryTitle: string;
  year: number;
  trcRate?: number;
  dartRate?: number;
  daysAwayRate?: number;
  fatalityRate?: number;
  source: string;
  sourceUrl: string;
  apiDocsUrl: string;
  developerDocsUrl: string;
  sourceMetadata: string;
  limitation: string;
  authMode: BlsAuthMode;
  attemptedSeriesIds: string[];
};

export type BlsResponse = {
  ok: boolean;
  benchmark: BlsBenchmark | null;
  message?: string;
  configured?: boolean;
  enabled?: boolean;
  authMode?: BlsAuthMode;
  attempted?: boolean;
  attemptedSeriesIds?: string[];
  source?: string;
  sourceUrl?: string;
  apiDocsUrl?: string;
  developerDocsUrl?: string;
  limitation?: string;
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
  dataType: "live-api" | "cached-import" | "database-import" | "static-index" | "not-configured";
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

export async function fetchWorkersCompSources(
  state: string,
): Promise<WorkersCompSource> {
  const response = await fetch(
    `/api/workers-comp/sources?state=${encodeURIComponent(state)}`,
  );
  return await response.json();
}

export async function fetchSourceStatus(): Promise<SourcesStatusResponse> {
  const response = await fetch("/api/sources/status");
  return await response.json();
}

export async function scoreOpportunity(input: {
  companyName?: string;
  state?: string;
  naics?: string;
  jobTitles?: string[];
  workforceSize?: number;
}): Promise<OpportunityScore> {
  const response = await fetch("/api/opportunities/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return await response.json();
}
