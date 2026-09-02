export type WarCostsDatasetStatus = {
  name: string;
  category: string;
  refreshClass: "live" | "frequent" | "periodic";
  ok: boolean;
  count: number;
  fetchedAt?: string;
  source?: "live" | "database";
  error?: string;
};

export type WarCostsContractor = {
  name: string;
  slug?: string;
  amount?: number;
  rank?: number;
  awards?: number;
  subsidiaries?: Array<{ name: string; amount?: number }>;
  yearly?: Record<string, number>;
  wars?: Array<{ conflictId?: string; role?: string; estimatedValue?: number; notes?: string }>;
  weaponSystems?: Array<{
    slug?: string;
    name?: string;
    contractor?: string;
    category?: string;
    service?: string;
    currentCostBillions?: number;
    costOverrunPct?: number | null;
    unitCostMillions?: number | null;
    status?: string;
    keyIssues?: string[];
  }>;
};

export type WarCostsOverview = {
  ok: boolean;
  source: string;
  attribution: string;
  sourceUrl: string;
  fetchedAt: string;
  refreshPolicy: {
    liveMinutes: number;
    frequentMinutes: number;
    periodicHours: number;
    manifestMinutes: number;
  };
  summary: {
    advertisedDatasets: number;
    discoveredDatasets: number;
    mirroredDatasets: number;
    failedDatasets: number;
    contractors: number;
    weaponSystems: number;
    weaponDetailRecords?: number;
    enrichedWeaponSystems?: number;
    conflicts: number;
    activeConflicts: number;
    strikeRecords: number;
    militaryBases: number;
    countryProfiles: number;
  };
  categoryCounts: Record<string, number>;
  datasets: WarCostsDatasetStatus[];
  highlights: {
    contractors: WarCostsContractor[];
    weapons: Record<string, unknown>[];
    activeConflicts: Record<string, unknown>[];
    recentStrikes: Record<string, unknown>[];
    stats: unknown;
  };
  error?: string;
};

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

export type WarCostsSearchResponse = {
  ok: boolean;
  query: string;
  total: number;
  truncated: boolean;
  results: Array<{ dataset: string; category: string; row: unknown }>;
  error?: string;
};

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `WarCosts request failed with HTTP ${response.status}`);
  return payload;
}

export async function getWarCostsOverview(refresh = false): Promise<WarCostsOverview> {
  const response = await fetch(`/api/war-costs/overview${refresh ? "?refresh=1" : ""}`, { headers: { Accept: "application/json" } });
  return readJson<WarCostsOverview>(response);
}

export async function getWarCostsDataset(name: string, refresh = false): Promise<WarCostsDatasetResponse> {
  const suffix = refresh ? "?refresh=1" : "";
  const response = await fetch(`/api/war-costs/dataset/${encodeURIComponent(name)}${suffix}`, { headers: { Accept: "application/json" } });
  return readJson<WarCostsDatasetResponse>(response);
}

export async function searchWarCosts(query: string): Promise<WarCostsSearchResponse> {
  const response = await fetch(`/api/war-costs/search?q=${encodeURIComponent(query)}`, { headers: { Accept: "application/json" } });
  return readJson<WarCostsSearchResponse>(response);
}

export async function refreshAllWarCosts(): Promise<{
  ok: boolean;
  succeeded: number;
  failed: Array<{ name: string; ok: false; count: number; error?: string }>;
}> {
  const response = await fetch("/api/war-costs/refresh-all", { method: "POST", headers: { Accept: "application/json" } });
  return readJson(response);
}

export async function getWarCostsContractorIntelligence(company?: string): Promise<{
  ok: boolean;
  contractors: WarCostsContractor[];
  summary: { contractors: number; totalFy2024: number; weaponSystems: number; activeConflicts: number; strikeRecords: number };
  live: { activeConflicts: Record<string, unknown>[]; strikes: Record<string, unknown>[]; stats: unknown };
}> {
  const query = company ? `?company=${encodeURIComponent(company)}` : "";
  const response = await fetch(`/api/war-costs/contractor-intelligence${query}`, { headers: { Accept: "application/json" } });
  return readJson(response);
}
