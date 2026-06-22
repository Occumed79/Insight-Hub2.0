/**
 * Visualization Intelligence Adapter
 *
 * Converts the /api/data-visualization/feed response into the existing
 * Data Visualization model shapes so the 22 METHOD_BEHAVIOR effects
 * and all existing chart rendering work seamlessly with the new data.
 */

import type { ChartDefinition } from "../company-configs/types";
import type {
  IntelligenceFact,
  IntelligenceCategory,
  IntelligenceConfidence,
  IntelligenceSourceType,
} from "./types";

// ─── Feed Types (mirrors backend) ────────────────────────────────────────────

export type FeedChartDefinition = {
  id: string;
  title: string;
  subtitle: string;
  type: "bar" | "area" | "line" | "scatter" | "stacked" | "grouped";
  data: Record<string, string | number>[];
  xKey: string;
  series: { dataKey: string; name?: string; color?: string }[];
  formatter?: "currencyM" | "currencyK" | "percent" | "hoursM" | "plain";
  headline?: string;
  fullWidth?: boolean;
  sourceId?: string;
  sourceUrl?: string;
  sourceName?: string;
  sourceType?: string;
  intelligenceCategory?: string;
};

export type FeedMetricDefinition = {
  id: string;
  label: string;
  value: number;
  unit: "usd" | "count" | "percent" | "score";
  category: "workforce" | "safety" | "financial" | "risk";
  trend?: number;
  sourceId?: string;
};

export type FeedSignalDefinition = {
  label: string;
  value: string;
  note: string;
};

export type FeedSourceRecord = {
  id: string;
  label: string;
  type: string;
  url?: string;
  note: string;
  sourceName?: string;
  sourceType?: string;
  confidence?: string;
  date?: string;
};

export type FeedRiskMatrixPoint = {
  name: string;
  revenue: number;
  risk: number;
  workers: number;
};

export type FeedOpportunityMatrixPoint = {
  name: string;
  revenuePotential: number;
  implementationComplexity: number;
  strategicValue: number;
};

export type FeedIntelligenceFact = {
  id: string;
  title: string;
  category: string;
  date: string;
  value?: number;
  valueUnit?: string;
  sourceUrl?: string;
  sourceName: string;
  sourceType: string;
  confidence: string;
  summary: string;
  rawSnippet?: string;
  intelligenceCategory?: string;
};

export type FeedSourceStatus = {
  source: string;
  configured: boolean;
  enabled: boolean;
  authMode?: string;
  notes: string;
};

export type FeedMissingData = {
  source: string;
  reason: string;
  field: string;
};

export type FeedWarning = {
  source: string;
  message: string;
};

export type DataVisualizationFeed = {
  ok: boolean;
  company: string;
  metrics: FeedMetricDefinition[];
  charts: FeedChartDefinition[];
  signals: FeedSignalDefinition[];
  dossierSections: { type: string; title: string; narrative: string; bullets: string[]; metricIds: string[] }[];
  sourceRecords: FeedSourceRecord[];
  riskMatrix: FeedRiskMatrixPoint[];
  opportunityMatrix: FeedOpportunityMatrixPoint[];
  facts: FeedIntelligenceFact[];
  sourceStatus: FeedSourceStatus[];
  missingData: FeedMissingData[];
  warnings: FeedWarning[];
};

// ─── Conversion Functions ────────────────────────────────────────────────────

function mapCategory(cat: string): IntelligenceCategory {
  const map: Record<string, IntelligenceCategory> = {
    locationExposure: "locationExposure",
    sourceFacts: "sourceFacts",
    jobSignals: "jobSignals",
    sourceConfidence: "sourceConfidence",
    medicalNetworkGaps: "medicalNetworkGaps",
    contractAwards: "contractAwards",
    opportunities: "opportunities",
    secFilings: "secFilings",
    timelineEvents: "timelineEvents",
    competitorSignals: "competitorSignals",
    renewalOrExpirationEvents: "renewalOrExpirationEvents",
  };
  return map[cat] ?? "sourceFacts";
}

function mapConfidence(conf: string): IntelligenceConfidence {
  const c = conf.toLowerCase();
  if (c === "high" || c === "medium" || c === "low" || c === "link-only") return c;
  return "medium";
}

function mapSourceType(src: string): IntelligenceSourceType {
  const map: Record<string, IntelligenceSourceType> = {
    osha: "official",
    bls: "official",
    onet: "official",
    sam: "sam",
    sec: "sec",
    usaspending: "usaspending",
    official: "official",
    careers: "careers",
    manual: "manual",
    news: "news",
    web: "web",
  };
  return map[src.toLowerCase()] ?? "web";
}

export function feedChartsToChartDefinitions(feedCharts: FeedChartDefinition[]): ChartDefinition[] {
  return feedCharts.map((fc) => ({
    id: fc.id,
    title: fc.title,
    subtitle: fc.subtitle,
    type: fc.type,
    data: fc.data,
    xKey: fc.xKey,
    series: fc.series,
    formatter: fc.formatter,
    headline: fc.headline,
    fullWidth: fc.fullWidth,
  }));
}

export function feedFactsToIntelligenceFacts(feedFacts: FeedIntelligenceFact[]): IntelligenceFact[] {
  return feedFacts.map((ff) => ({
    id: ff.id,
    companyId: "feed",
    title: ff.title,
    category: mapCategory(ff.intelligenceCategory ?? ff.category),
    date: ff.date,
    discoveredAt: ff.date,
    value: ff.value,
    valueUnit: ff.valueUnit as IntelligenceFact["valueUnit"],
    sourceUrl: ff.sourceUrl,
    sourceName: ff.sourceName,
    sourceType: mapSourceType(ff.sourceType),
    confidence: mapConfidence(ff.confidence),
    rawSnippet: ff.rawSnippet,
    summary: ff.summary,
    metadata: {},
  }));
}

export function feedToMetrics(feed: DataVisualizationFeed): FeedMetricDefinition[] {
  return feed.metrics;
}

export function feedToSignals(feed: DataVisualizationFeed): FeedSignalDefinition[] {
  return feed.signals;
}

export function feedToSourceRecords(feed: DataVisualizationFeed): FeedSourceRecord[] {
  return feed.sourceRecords;
}

export function feedToRiskMatrix(feed: DataVisualizationFeed): FeedRiskMatrixPoint[] {
  return feed.riskMatrix;
}

export function feedToOpportunityMatrix(feed: DataVisualizationFeed): FeedOpportunityMatrixPoint[] {
  return feed.opportunityMatrix;
}

// ─── Fetch Function ──────────────────────────────────────────────────────────

export async function fetchVisualizationFeed(params: {
  company?: string;
  state?: string;
  naics?: string;
  year?: string;
  include?: string[];
}): Promise<DataVisualizationFeed> {
  const searchParams = new URLSearchParams();
  if (params.company) searchParams.set("company", params.company);
  if (params.state) searchParams.set("state", params.state);
  if (params.naics) searchParams.set("naics", params.naics);
  if (params.year) searchParams.set("year", params.year);
  if (params.include && params.include.length > 0) {
    searchParams.set("include", params.include.join(","));
  }

  const response = await fetch(`/api/data-visualization/feed?${searchParams}`);
  if (!response.ok) {
    throw new Error(`Feed request failed: HTTP ${response.status}`);
  }
  return (await response.json()) as DataVisualizationFeed;
}
