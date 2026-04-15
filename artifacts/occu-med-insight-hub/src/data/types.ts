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
