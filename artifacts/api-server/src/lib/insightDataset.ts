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
  country: string;
  region: string;
  facilityType: string;
  activity: string;
  notes: string;
  coordinates: [number, number];
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

export type InsightDataset = {
  companies: Company[];
  profiles: CompanyProfile[];
  metrics: Metric[];
  locations: LocationRecord[];
  sources: SourceRecord[];
  reports: ReportRecord[];
  assumptions: Assumption[];
  status: WorkbookStatus;
};

export type SearchRun = {
  id: string;
  query: string;
  target: "company" | "opportunity" | "provider" | "agency" | "competitor";
  status: "queued" | "completed";
  createdAt: string;
  resultCount: number;
  notes: string;
};

const companies: Company[] = [
  {
    id: "v2x",
    name: "V2X, Inc.",
    shortName: "V2X",
    sector: "Defense services, logistics, training, and mission support",
    headquarters: "McLean, Virginia",
    employees: 16000,
    employeesAsOf: "Initial backend seed",
    summary:
      "Primary strategic account view for global defense support operations, overseas readiness, occupational health screening needs, and distributed workforce exposure.",
    tags: ["Federal contractor", "Global operations", "Deployment readiness", "Medical screening fit"],
  },
  {
    id: "kbr",
    name: "KBR, Inc.",
    shortName: "KBR",
    sector: "Government services, engineering, science, and mission support",
    headquarters: "Houston, Texas",
    employees: 37000,
    employeesAsOf: "Initial backend seed",
    summary:
      "Large mission-support and engineering organization with distributed workforce exposure and recurring occupational medical readiness needs.",
    tags: ["Benchmark peer", "Government services", "Large workforce"],
  },
  {
    id: "amentum",
    name: "Amentum",
    shortName: "Amentum",
    sector: "Engineering, logistics, environmental, and mission operations",
    headquarters: "Chantilly, Virginia",
    employees: 53000,
    employeesAsOf: "Initial backend seed",
    summary:
      "Benchmark mission-support organization with broad federal footprint, high-complexity operational settings, and occupational health relevance.",
    tags: ["Benchmark peer", "Mission support", "Global footprint"],
  },
];

const sources: SourceRecord[] = [
  {
    id: "v2x-initial-profile",
    companyId: "v2x",
    label: "V2X initial strategic profile",
    type: "Manual",
    note:
      "Backend seed record. Replace with source-backed filings, contract records, and verified operating data as ingestion workflows are added.",
  },
  {
    id: "kbr-initial-profile",
    companyId: "kbr",
    label: "KBR benchmark profile",
    type: "Manual",
    note:
      "Benchmark record for peer comparison and cost-model testing. Replace with validated source library entries.",
  },
  {
    id: "amentum-initial-profile",
    companyId: "amentum",
    label: "Amentum benchmark profile",
    type: "Manual",
    note:
      "Benchmark record for peer comparison and cost-model testing. Replace with validated source library entries.",
  },
  {
    id: "geo-seed",
    companyId: "v2x",
    label: "Backend global footprint seed",
    type: "Manual",
    note:
      "Initial location seed used by the API until workbook upload and persistent geographic ingestion are implemented.",
  },
];

const metrics: Metric[] = [
  { id: "v2x-employees", companyId: "v2x", label: "Employees", value: 16000, unit: "count", category: "workforce", trend: 2.2, sourceId: "v2x-initial-profile" },
  { id: "v2x-wc-proxy", companyId: "v2x", label: "Estimated annual WC proxy", value: 13760000, unit: "usd", category: "financial", trend: 4.6, sourceId: "v2x-initial-profile" },
  { id: "v2x-readiness-score", companyId: "v2x", label: "Readiness complexity score", value: 87, unit: "score", category: "risk", trend: 8.1, sourceId: "v2x-initial-profile" },
  { id: "v2x-global-locations", companyId: "v2x", label: "Mapped locations", value: 7, unit: "count", category: "risk", trend: 8.2, sourceId: "geo-seed" },
  { id: "kbr-employees", companyId: "kbr", label: "Employees", value: 37000, unit: "count", category: "workforce", trend: 2.9, sourceId: "kbr-initial-profile" },
  { id: "kbr-wc-proxy", companyId: "kbr", label: "Estimated annual WC proxy", value: 31820000, unit: "usd", category: "financial", trend: 5.2, sourceId: "kbr-initial-profile" },
  { id: "amentum-employees", companyId: "amentum", label: "Employees", value: 53000, unit: "count", category: "workforce", trend: 3.4, sourceId: "amentum-initial-profile" },
  { id: "amentum-wc-proxy", companyId: "amentum", label: "Estimated annual WC proxy", value: 45580000, unit: "usd", category: "financial", trend: 5.8, sourceId: "amentum-initial-profile" },
];

const profiles: CompanyProfile[] = [
  {
    companyId: "v2x",
    sections: [
      {
        id: "v2x-account-fit",
        title: "Account fit",
        narrative:
          "V2X is the priority account because the operating model depends on distributed staffing, deployment readiness, medical screening consistency, and rapid documentation workflows.",
        bullets: [
          "High-volume workforce creates repeatable screening and renewal demand.",
          "Global support footprint creates country-specific medical readiness complexity.",
          "Audit-proof documentation and faster exception handling are strong value levers.",
        ],
        metrics: ["v2x-employees", "v2x-global-locations", "v2x-readiness-score"],
      },
      {
        id: "v2x-risk-signals",
        title: "Risk signals",
        narrative:
          "The strongest strategic angle is reducing delay, inconsistency, and medical-documentation friction before deployment or assignment deadlines.",
        bullets: [
          "Deployability depends on timely exam completion, provider documentation, and guideline-aware review.",
          "Geographic spread increases the value of a reliable provider network and standardized packets.",
          "Cost modeling can frame occupational health support as risk prevention instead of administrative overhead.",
        ],
        metrics: ["v2x-wc-proxy", "v2x-readiness-score"],
      },
    ],
  },
  {
    companyId: "kbr",
    sections: [
      {
        id: "kbr-benchmark",
        title: "Benchmark profile",
        narrative:
          "KBR is included as a peer comparator for workforce scale, government-services exposure, and occupational health program benchmarking.",
        bullets: ["Large workforce scale supports peer comparison.", "Federal services footprint creates screening relevance.", "Use as a cost and opportunity benchmark until deeper source ingestion is added."],
        metrics: ["kbr-employees", "kbr-wc-proxy"],
      },
    ],
  },
  {
    companyId: "amentum",
    sections: [
      {
        id: "amentum-benchmark",
        title: "Benchmark profile",
        narrative:
          "Amentum is included as a high-scale mission-support comparator for geographic and occupational medical opportunity modeling.",
        bullets: ["Very large employee base creates measurable occupational health exposure.", "Mission-support footprint is relevant to readiness and deployment screening.", "Useful as a peer benchmark for executive cost-model views."],
        metrics: ["amentum-employees", "amentum-wc-proxy"],
      },
    ],
  },
];

const locations: LocationRecord[] = [
  { id: "v2x-mclean", companyId: "v2x", company: "V2X", city: "McLean", state: "VA", country: "USA", region: "North America", facilityType: "Corporate / program support", activity: "Program management and mission support", notes: "Seed headquarters and program-support location.", coordinates: [-77.1773, 38.9339] },
  { id: "v2x-kuwait", companyId: "v2x", company: "V2X", city: "Kuwait City", country: "Kuwait", region: "Middle East / Central Asia", facilityType: "AOR support", activity: "Logistics and deployment support", notes: "Seed AOR location for overseas readiness modeling.", coordinates: [47.9774, 29.3759] },
  { id: "v2x-qatar", companyId: "v2x", company: "V2X", city: "Doha", country: "Qatar", region: "Middle East / Central Asia", facilityType: "AOR support", activity: "Mission support and logistics", notes: "Seed AOR location for overseas readiness modeling.", coordinates: [51.531, 25.2854] },
  { id: "v2x-germany", companyId: "v2x", company: "V2X", city: "Kaiserslautern", country: "Germany", region: "Europe", facilityType: "Regional support", activity: "Defense support services", notes: "Seed Europe location for geographic filter testing.", coordinates: [7.7689, 49.4401] },
  { id: "v2x-guam", companyId: "v2x", company: "V2X", city: "Tamuning", country: "Guam", region: "Indo-Pacific", facilityType: "Regional support", activity: "Indo-Pacific mission support", notes: "Seed Indo-Pacific location for map testing.", coordinates: [144.7937, 13.4877] },
  { id: "v2x-japan", companyId: "v2x", company: "V2X", city: "Okinawa", country: "Japan", region: "Indo-Pacific", facilityType: "Regional support", activity: "Mission support and readiness", notes: "Seed Indo-Pacific location for map testing.", coordinates: [127.7615, 26.3344] },
  { id: "v2x-albania", companyId: "v2x", company: "V2X", city: "Tirana", country: "Albania", region: "Europe", facilityType: "Regional support", activity: "Operational support", notes: "Seed Europe location for geographic filter testing.", coordinates: [19.8187, 41.3275] },
];

const assumptions: Assumption[] = [
  { id: "hours", label: "Annual hours per employee", value: 2000, unit: "hours", description: "Standard full-time annualized work-hours assumption used for proxy cost modeling." },
  { id: "wcRate", label: "Workers compensation cost per hour", value: 0.43, unit: "USD/hour", description: "Editable proxy assumption until employer-specific loss data is available." },
  { id: "burden", label: "Economic burden multiplier", value: 1.25, unit: "multiplier", description: "Adds administrative, productivity, and program-management burden above direct proxy cost." },
  { id: "indirect", label: "Indirect cost multiplier", value: 2.1, unit: "multiplier", description: "Models broader operational disruption, delay, and replacement-cost exposure." },
];

const reports: ReportRecord[] = [
  {
    id: "v2x-readout",
    companyId: "v2x",
    title: "V2X executive signal report",
    createdAt: new Date("2026-05-12T00:00:00.000Z").toISOString(),
    summary:
      "V2X shows strong fit for an occupational-health intelligence workflow because workforce scale, geographic exposure, and deployment requirements create recurring documentation and readiness risk.",
    signals: [
      "Prioritize provider-network coverage in AOR-heavy regions.",
      "Position audit-proof outputs and faster waiver/documentation routing as operational risk reduction.",
      "Use cost-proxy modeling to frame screening delays as measurable exposure.",
    ],
  },
  {
    id: "kbr-readout",
    companyId: "kbr",
    title: "KBR benchmark signal report",
    createdAt: new Date("2026-05-12T00:00:00.000Z").toISOString(),
    summary: "KBR provides a useful peer benchmark for workforce scale and federal-services medical-readiness opportunity modeling.",
    signals: ["Use as a benchmark against V2X scale.", "Compare workforce-size-driven screening exposure.", "Add sourced contract and program records during enrichment."],
  },
  {
    id: "amentum-readout",
    companyId: "amentum",
    title: "Amentum benchmark signal report",
    createdAt: new Date("2026-05-12T00:00:00.000Z").toISOString(),
    summary: "Amentum provides a high-scale mission-support peer profile for cost-model and footprint comparison.",
    signals: ["Use as a high-scale comparator.", "Add program and procurement source records.", "Compare geography and readiness complexity."],
  },
];

const status: WorkbookStatus = {
  proxyRows: companies.length,
  methodologyRows: assumptions.length,
  geographyRows: locations.length,
  loaded: true,
};

const searchRuns: SearchRun[] = [
  {
    id: "seed-v2x-opportunity-scan",
    query: "V2X occupational health medical screening deployment readiness",
    target: "company",
    status: "completed",
    createdAt: new Date("2026-05-12T00:00:00.000Z").toISOString(),
    resultCount: sources.length,
    notes: "Seed run placeholder. Replace with live Serper/Tavily/Exa/Apify workflows after provider keys are configured.",
  },
];

export const insightDataset: InsightDataset = {
  companies,
  profiles,
  metrics,
  locations,
  sources,
  reports,
  assumptions,
  status,
};

export function findCompany(companyId: string): Company | undefined {
  return insightDataset.companies.find((company) => company.id === companyId);
}

export function filterByCompany<T extends { companyId: string }>(records: T[], companyId: string | undefined): T[] {
  if (!companyId) return records;
  return records.filter((record) => record.companyId === companyId);
}

export function getSearchRuns(): SearchRun[] {
  return searchRuns;
}

export function createMockSearchRun(query: string, target: SearchRun["target"]): SearchRun {
  const trimmedQuery = query.trim();
  const run: SearchRun = {
    id: `run-${Date.now()}`,
    query: trimmedQuery,
    target,
    status: "completed",
    createdAt: new Date().toISOString(),
    resultCount: insightDataset.sources.length,
    notes:
      "Mock run recorded by the backend. Wire this to the selected external discovery provider once API keys are configured.",
  };
  searchRuns.unshift(run);
  return run;
}
