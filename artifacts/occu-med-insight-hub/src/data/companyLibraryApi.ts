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
