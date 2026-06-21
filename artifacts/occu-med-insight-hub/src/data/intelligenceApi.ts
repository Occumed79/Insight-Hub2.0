import type { CompanyIntelligence, IntelligenceFact, IntelligenceRun, IntelligenceChartReady } from "./types";

type IntelligenceApiResponse = {
  ok: boolean;
  companyId?: string;
  facts?: IntelligenceFact[];
  runs?: IntelligenceRun[];
  chartReady?: IntelligenceChartReady;
  error?: string;
};

type IngestResponse = {
  ok: boolean;
  runId?: number;
  companyId?: string;
  companyName?: string;
  sourcesQueried?: string[];
  factsCollected?: number;
  status?: string;
  errors?: string[];
  facts?: IntelligenceFact[];
  chartReady?: IntelligenceChartReady;
  error?: string;
};

export async function fetchCompanyIntelligence(companyId: string): Promise<CompanyIntelligence | null> {
  try {
    const response = await fetch(`/api/intelligence/company/${encodeURIComponent(companyId)}`);
    if (!response.ok) return null;
    const data = (await response.json()) as IntelligenceApiResponse;
    if (!data.ok || !data.companyId) return null;
    return {
      companyId: data.companyId,
      facts: data.facts ?? [],
      runs: data.runs ?? [],
      chartReady: data.chartReady ?? {
        awardValueTimeline: [],
        opportunitiesByStage: [],
        sourceConfidenceOverTime: [],
        jobSignalTrend: [],
        eventTimeline: [],
        locationExposureByRegion: [],
        networkGapScoreByRegion: [],
      },
    };
  } catch {
    return null;
  }
}

export async function ingestCompanyIntelligence(companyId: string, companyName: string): Promise<IngestResponse> {
  try {
    const response = await fetch("/api/intelligence/ingest/company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, companyName }),
    });
    const data = (await response.json()) as IngestResponse;
    return data;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Ingestion request failed" };
  }
}

export async function checkIntelligenceHealth(): Promise<boolean> {
  try {
    const response = await fetch("/api/intelligence/health");
    if (!response.ok) return false;
    const data = await response.json() as { ok: boolean };
    return data.ok;
  } catch {
    return false;
  }
}
