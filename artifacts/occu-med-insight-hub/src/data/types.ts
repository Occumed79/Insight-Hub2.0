export type Company = {
  id: string;
  name: string;
  shortName: string;
  sector: string;
  headquarters: string;
  employees: number;
  employeesAsOf: string;
  summary: string;
  tags: string[];
};

export type SourceRecord = {
  id: string;
  companyId: string;
  label: string;
  type: "SEC" | "Benchmark" | "Workbook" | "Manual" | "URL";
  url?: string;
  note: string;
};

export type Metric = {
  id: string;
  companyId: string;
  label: string;
  value: number;
  unit: "usd" | "count" | "percent" | "score";
  category: "workforce" | "safety" | "financial" | "risk";
  trend?: number;
  sourceId?: string;
};

export type ProfileSection = {
  id: string;
  title: string;
  narrative: string;
  bullets: string[];
  metrics: string[];
};

export type CompanyProfile = {
  companyId: string;
  sections: ProfileSection[];
};

export type LocationRecord = {
  id: string;
  companyId: string;
  company: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  region: string;
  facilityType: string;
  activity: string;
  notes: string;
  coordinates: [number, number];
  addressLine1?: string;
  addressLine2?: string;
  formattedAddress?: string;
  placeName?: string;
  geocodeSource?: "manual" | "uploaded" | "osm" | "photon" | "google" | "mapbox" | "estimated";
  geocodeConfidence?: "exact" | "place" | "city" | "country" | "unknown";
};

export type Assumption = {
  id: string;
  label: string;
  value: number;
  unit: string;
  description: string;
};

export type ReportRecord = {
  id: string;
  companyId: string;
  title: string;
  createdAt: string;
  summary: string;
  signals: string[];
};

export type WorkbookStatus = {
  proxyRows: number;
  methodologyRows: number;
  geographyRows: number;
  loaded: boolean;
  error?: string;
};

export type IntelligenceCategory =
  | "contractAwards"
  | "opportunities"
  | "secFilings"
  | "jobSignals"
  | "sourceFacts"
  | "sourceConfidence"
  | "timelineEvents"
  | "locationExposure"
  | "medicalNetworkGaps"
  | "competitorSignals"
  | "renewalOrExpirationEvents";

export type IntelligenceSourceType =
  | "usaspending"
  | "sec"
  | "sam"
  | "official"
  | "careers"
  | "manual"
  | "news"
  | "web";

export type IntelligenceConfidence = "high" | "medium" | "low" | "link-only";

export type IntelligenceFact = {
  id: string;
  companyId: string;
  title: string;
  category: IntelligenceCategory;
  date: string;
  discoveredAt: string;
  value?: number;
  valueUnit?: "usd" | "count" | "percent" | "score";
  sourceUrl?: string;
  sourceName: string;
  sourceType: IntelligenceSourceType;
  confidence: IntelligenceConfidence;
  rawSnippet?: string;
  summary: string;
  metadata: Record<string, unknown>;
};

export type IntelligenceRun = {
  id: string;
  companyId: string;
  startedAt: string;
  completedAt: string;
  sourcesQueried: string[];
  factsCollected: number;
  status: "completed" | "partial" | "failed";
  error?: string;
};

export type IntelligenceChartReady = {
  awardValueTimeline: Record<string, string | number>[];
  opportunitiesByStage: Record<string, string | number>[];
  sourceConfidenceOverTime: Record<string, string | number>[];
  jobSignalTrend: Record<string, string | number>[];
  eventTimeline: Record<string, string | number>[];
  locationExposureByRegion: Record<string, string | number>[];
  networkGapScoreByRegion: Record<string, string | number>[];
};

export type SourceDiagnostic = {
  source: string;
  status: "success" | "no-results" | "error" | "not-applicable" | "needs-key";
  factsFound: number;
  aliasesQueried: string[];
  message: string;
  error?: string;
};

export type IngestDiagnostics = {
  sources: SourceDiagnostic[];
  liveFactsInserted: number;
  sourceLeadsInserted: number;
  totalInserted: number;
  aliasesUsed: string[];
};

export type CompanyIntelligence = {
  companyId: string;
  facts: IntelligenceFact[];
  runs: IntelligenceRun[];
  chartReady: IntelligenceChartReady;
  diagnostics?: {
    liveFacts: number;
    sourceLeads: number;
    total: number;
  };
};

export type InsightDataset = {
  companies: Company[];
  profiles: CompanyProfile[];
  metrics: Metric[];
  locations: LocationRecord[];
  sources: SourceRecord[];
  reports: ReportRecord[];
  assumptions: Assumption[];
  intelligence: CompanyIntelligence[];
  status: WorkbookStatus;
};
