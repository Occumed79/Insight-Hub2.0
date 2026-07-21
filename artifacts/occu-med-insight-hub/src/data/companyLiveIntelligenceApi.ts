export type LiveSourceName = "SAM.gov" | "SEC EDGAR" | "CourtListener" | "USAspending";
export type LiveSignalCategory = "entity" | "filing" | "litigation" | "federal-award";
export type LiveSourceState = "success" | "empty" | "disabled" | "error";

export type CompanyLiveSignal = {
  id: string;
  source: LiveSourceName;
  category: LiveSignalCategory;
  title: string;
  summary: string;
  occurredAt?: string;
  geography?: string;
  identifiers: Record<string, string>;
  metrics: Record<string, string | number>;
  evidenceFields: string[];
  confidence: number;
  sourceUrl: string;
};

export type CompanyLiveSourceStatus = {
  source: LiveSourceName;
  configured: boolean;
  enabled: boolean;
  state: LiveSourceState;
  latencyMs: number;
  resultCount: number;
  sourceUrl: string;
  freshness: string;
  limitation: string;
  error?: string;
};

export type CompanyLiveResponse = {
  ok: boolean;
  manualRun: boolean;
  companyName: string;
  state?: string;
  executedAt: string;
  runId: string;
  summary: {
    signalCount: number;
    successfulSources: number;
    attemptedSources: number;
    failedSources: number;
    disabledSources: number;
  };
  sources: CompanyLiveSourceStatus[];
  signals: CompanyLiveSignal[];
  warnings: string[];
  limitation: string;
  error?: string;
};

export async function runCompanyLiveIntelligence(input: {
  companyName: string;
  state?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<CompanyLiveResponse> {
  const response = await fetch("/api/company/live-intelligence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = await response.json() as CompanyLiveResponse;
  if (!response.ok) {
    throw new Error(payload.error || `Company live-intelligence request failed with HTTP ${response.status}`);
  }
  return payload;
}
