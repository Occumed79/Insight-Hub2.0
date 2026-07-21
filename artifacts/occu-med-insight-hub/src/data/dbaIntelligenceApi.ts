export type DbaCaseCounts = {
  nlt: number | null;
  lt03: number | null;
  lt4: number | null;
  dea: number | null;
  cop: number | null;
  oth: number | null;
  total: number | null;
};

export type DbaCaseRecord = {
  id: string;
  category: "employer" | "carrier" | "country";
  name: string;
  normalizedName: string;
  counts: DbaCaseCounts;
  suppressed: boolean;
  reportPeriod: string;
  sourceUrl: string;
  matchScore?: number;
};

export type DbaPerformanceRecord = {
  id: string;
  fiscalYear: number;
  metric: "first-report" | "first-payment";
  carrier: string;
  firstThresholdDays: number;
  firstThresholdPercent: number;
  sixtyDayPercent: number;
  ninetyDayPercent: number;
  sourceUrl: string;
};

export type DbaWaiverRecord = {
  id: string;
  status: "active" | "archived";
  location: string;
  waiverType: string;
  waiverNumber: string;
  issuedDate?: string;
  expirationDate?: string;
  renewalNote?: string;
  sourceUrl: string;
};

export type DbaSourceStatus = {
  source: string;
  state: "success" | "empty" | "partial" | "disabled" | "error";
  attempted: boolean;
  latencyMs: number;
  recordCount: number;
  sourceUrl: string;
  freshness: string;
  limitation: string;
  error?: string;
};

export type DbaJurisdiction = {
  office: string;
  boundary: string;
  location: string;
  phone: string;
  sourceUrl: string;
};

export type DbaLegalReference = {
  title: string;
  type: string;
  source: string;
  sourceUrl: string;
  note: string;
};

export type DbaIntelligenceResponse = {
  ok: boolean;
  enabled: boolean;
  manualRun: boolean;
  executedAt: string;
  durationMs: number;
  runId: string;
  query: string;
  reportPeriod: string;
  summary: {
    employerRecords: number;
    carrierRecords: number;
    countryRecords: number;
    employerCaseCount: number;
    carrierCaseCount: number;
    countryCaseCount: number;
    countryDeathCaseCount: number;
    activeWaivers: number;
    archivedWaivers: number;
    performanceRecords: number;
    successfulSources: number;
    failedSources: number;
  };
  caseReports: {
    employers: DbaCaseRecord[];
    carriers: DbaCaseRecord[];
    countries: DbaCaseRecord[];
    queryMatches: DbaCaseRecord[];
    sourcePage: string;
    methodologyPage: string;
  };
  performance: DbaPerformanceRecord[];
  waivers: DbaWaiverRecord[];
  jurisdictions: DbaJurisdiction[];
  legalReferences: DbaLegalReference[];
  sources: DbaSourceStatus[];
  warnings: string[];
  limitation: string;
  message?: string;
  error?: string;
};

export async function runDbaIntelligence(query?: string): Promise<DbaIntelligenceResponse> {
  const response = await fetch("/api/dba/intelligence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: query?.trim() || undefined }),
  });
  const payload = await response.json() as DbaIntelligenceResponse;
  if (!response.ok) throw new Error(payload.error || `DBA intelligence request failed with HTTP ${response.status}`);
  return payload;
}
