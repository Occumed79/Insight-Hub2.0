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

export type WarCostsResponse = {
  ok: boolean;
  source: string;
  attribution: string;
  sourceUrl: string;
  fetchedAt: string;
  refreshPolicy: {
    liveFeedsMinutes: number;
    contractorDirectoryHours: number;
    otherDatasetsHours: number;
  };
  summary: {
    contractors: number;
    totalFy2024: number;
    weaponSystems: number;
    activeConflicts: number;
    strikeRecords: number;
  };
  contractors: WarCostsContractor[];
  live: {
    activeConflicts: Record<string, unknown>[];
    strikes: Record<string, unknown>[];
    stats: unknown;
  };
  error?: string;
};

export async function getWarCostsContractorIntelligence(): Promise<WarCostsResponse> {
  const response = await fetch("/api/war-costs/contractor-intelligence", { headers: { Accept: "application/json" } });
  const payload = await response.json() as WarCostsResponse;
  if (!response.ok) throw new Error(payload.error || `WarCosts request failed with HTTP ${response.status}`);
  return payload;
}
