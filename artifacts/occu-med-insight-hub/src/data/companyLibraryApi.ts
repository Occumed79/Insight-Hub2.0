export type CompanyModuleKey =
  | "locations"
  | "jobs"
  | "bls"
  | "organizationalChart"
  | "corporateStructure"
  | "sec"
  | "corporateSignals"
  | "fec"
  | "injuryExposure"
  | "evidence";

export type CompanyModuleState = {
  status: "available" | "not-researched";
  updatedAt?: string;
  count?: number;
};

export type CompanyLibraryCard = {
  slug: string;
  name: string;
  shortName: string;
  aliases: string[];
  entityId?: number;
  canonicalName: string;
  officialWebsite?: string;
  lastUpdatedAt?: string;
  availableModules: number;
  totalModules: number;
  modules: Record<CompanyModuleKey, CompanyModuleState>;
};

export type CompanyLibraryResponse = {
  ok: true;
  generatedAt: string;
  publicRepositoryNotice: string;
  companies: CompanyLibraryCard[];
};

export type CompanyFileAnnualMetric = {
  key: string;
  label: string;
  cy2023: number;
  cy2024: number;
  changePercent: number;
  direction: "up" | "down" | "flat";
  interpretation: string;
};

export type CompanyFileMonthlyMetric = {
  month: string;
  dart2023: number;
  trir2023: number;
  nearMiss2023: number;
  dart2024: number;
  trir2024: number;
  nearMiss2024: number;
};

export type CompanyFileTrendPoint = {
  year: number;
  value: number;
};

export type CompanyFileNarrativeItem = {
  title: string;
  body: string;
  status?: "observed" | "interpretive" | "unverified-source-claim" | "normalized";
};

export type CompanySafetyFile = {
  version: number;
  title: string;
  subtitle: string;
  period: {
    start: string;
    end: string;
  };
  source: {
    fileName: string;
    title: string;
    pageCount: number;
    sourceType: string;
    ingestedAt: string;
    attribution: string;
  };
  headline: string;
  annualMetrics: CompanyFileAnnualMetric[];
  monthlyMetrics: CompanyFileMonthlyMetric[];
  nearMissTrend: CompanyFileTrendPoint[];
  findings: CompanyFileNarrativeItem[];
  operationalImplications: CompanyFileNarrativeItem[];
  sourceClaims: CompanyFileNarrativeItem[];
  methodologyNotes: CompanyFileNarrativeItem[];
};

export type CompanyFileResponse = {
  ok: true;
  generatedAt: string;
  company: {
    entityId: number;
    name: string;
    displayName: string;
    updatedAt: string;
  };
  file: CompanySafetyFile | null;
};

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as T | { error?: string } | null;
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : `Request failed with HTTP ${response.status}.`;
    throw new Error(message);
  }
  return payload as T;
}

export async function loadCompanyLibrary(): Promise<CompanyLibraryResponse> {
  const response = await fetch("/api/company-library/catalog");
  return readJson<CompanyLibraryResponse>(response);
}

export async function loadCompanyFile(entityId: number): Promise<CompanyFileResponse> {
  const response = await fetch(`/api/company-library/file/${encodeURIComponent(String(entityId))}`);
  return readJson<CompanyFileResponse>(response);
}
