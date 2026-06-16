export type TooltipFormat = "currencyM" | "currencyK" | "percent" | "hoursM" | "plain";

export type ChartSeriesDefinition = {
  dataKey: string;
  name?: string;
  color?: string;
  stackId?: string;
  radius?: [number, number, number, number];
};

export type ReferenceLineDefinition = {
  y: number;
  stroke: string;
  strokeDasharray?: string;
  label?: { value: string; fill: string; fontSize: number };
};

export type ChartDefinition = {
  id: string;
  title: string;
  subtitle: string;
  type: "bar" | "area" | "line" | "scatter" | "stacked" | "grouped";
  data: Record<string, string | number>[];
  xKey: string;
  series: ChartSeriesDefinition[];
  formatter?: TooltipFormat;
  headline?: string;
  domain?: [number, number];
  referenceLines?: ReferenceLineDefinition[];
  fullWidth?: boolean;
};

export type SignalDefinition = {
  label: string;
  value: string;
  note: string;
};

export type RiskMatrixPoint = {
  name: string;
  revenue: number;
  risk: number;
  workers: number;
};

export type OpportunityMatrixPoint = {
  name: string;
  revenuePotential: number;
  implementationComplexity: number;
  strategicValue: number;
};

export type MetricDefinition = {
  id: string;
  label: string;
  value: number;
  unit: "usd" | "count" | "percent" | "score";
  category: "workforce" | "safety" | "financial" | "risk";
  trend?: number;
  sourceId?: string;
};

export type SourceFilterDefinition = {
  sec?: { cik?: string; ticker?: string; legalEntities?: string[]; formerNames?: string[] };
  sam?: { uei?: string; legalNames?: string[]; dbas?: string[] };
  usaSpending?: { recipientNames?: string[]; parentOrgs?: string[] };
  jobSources?: { linkedin?: string; indeed?: string; careerSite?: string; clearanceJobs?: string };
  newsSources?: { aliases?: string[]; acquisitionAliases?: string[]; subsidiaries?: string[] };
};

export type DossierSectionType =
  | "overview"
  | "contracts"
  | "locations"
  | "competitors"
  | "acquisitions"
  | "hiring"
  | "workforce"
  | "safety"
  | "esg"
  | "procurement"
  | "medical-opportunities";

export type DossierSectionDefinition = {
  type: DossierSectionType;
  title: string;
  narrative: string;
  bullets: string[];
  metricIds: string[];
};

export type CompanyConfig = {
  companyId: string;
  displayName: string;
  shortName: string;
  sector: string;
  headquarters: string;
  employees: number;
  employeesAsOf: string;
  summary: string;
  tags: string[];
  aliases?: string[];
  sourceFilters?: SourceFilterDefinition;
  executiveSignals: SignalDefinition[];
  chartDefinitions: ChartDefinition[];
  metricDefinitions?: MetricDefinition[];
  riskMatrix?: RiskMatrixPoint[];
  opportunityMatrix?: OpportunityMatrixPoint[];
  dossierSections?: DossierSectionDefinition[];
  curveTitle?: string;
  curveSubtitle?: string;
};
