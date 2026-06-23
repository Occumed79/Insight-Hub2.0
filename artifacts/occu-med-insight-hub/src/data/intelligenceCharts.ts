import type { ChartDefinition } from "../company-configs/types";
import type { CompanyIntelligence, IntelligenceFact, IntelligenceCategory, IntelligenceChartReady } from "./types";
import { evaluateChartSuitability } from "./chartSuitability";

const PALETTE = ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#fb7185", "#60a5fa", "#a3e635"];

function enrichDataWithFactMeta(
  data: Record<string, string | number>[],
  facts: IntelligenceFact[],
  category: IntelligenceCategory
): Record<string, string | number>[] {
  return data.map((row) => {
    const rowDate = row.date as string | undefined;
    const rowLabel = row.stage ?? row.region ?? row.label ?? undefined;
    const match = facts.find((f) => {
      if (f.category !== category) return false;
      if (rowDate && f.date.startsWith(rowDate.slice(0, 10))) return true;
      if (rowLabel && (f.title.includes(String(rowLabel)) || f.summary.includes(String(rowLabel)))) return true;
      return false;
    });
    return {
      ...row,
      category,
      sourceUrl: match?.sourceUrl ?? "",
      confidence: match?.confidence ?? "",
      date: match?.date ?? rowDate ?? "",
      sourceType: match?.sourceType ?? "",
      summary: match?.summary ?? "",
      rawSnippet: match?.rawSnippet ?? "",
      provider: String(match?.metadata?.provider ?? match?.sourceType ?? ""),
      recordType: String(match?.metadata?.recordType ?? (match?.confidence === "link-only" ? "sourceLead" : "liveFact")),
      matchedAlias: String(match?.metadata?.matchedAlias ?? ""),
      query: String(match?.metadata?.query ?? ""),
    };
  });
}

function knownLabel(value: unknown): boolean {
  const label = String(value ?? "").trim().toLowerCase();
  return Boolean(label) && !["unknown", "n/a", "na", "null", "undefined"].includes(label);
}

function meaningfulRows(
  rows: Record<string, string | number>[],
  labelKey: string,
  valueKey: string
): Record<string, string | number>[] {
  return rows.filter((row) => {
    const value = row[valueKey];
    return knownLabel(row[labelKey] ?? row.label ?? row.region ?? row.stage) && typeof value === "number" && Number.isFinite(value);
  });
}

function addChartIfSuitable(charts: ChartDefinition[], chart: ChartDefinition) {
  const suitability = evaluateChartSuitability(chart);
  if (suitability.representationType !== "chart") return;
  charts.push({
    ...chart,
    headline: `${chart.headline ?? chart.title} · ${suitability.confidenceLabel}`,
  });
}

export function intelligenceFactsToCharts(intelligence: CompanyIntelligence | undefined): ChartDefinition[] {
  if (!intelligence || intelligence.facts.length === 0) return [];
  const charts: ChartDefinition[] = [];
  const cr = intelligence.chartReady;
  const { facts } = intelligence;

  const awardRows = meaningfulRows(cr.awardValueTimeline, "date", "value");
  if (awardRows.length >= 2) {
    addChartIfSuitable(charts, {
      id: "intel-award-value-timeline",
      title: "Contract Award Value Timeline",
      subtitle: "Verified federal award values only; one-off awards are shown in the Evidence Ledger instead of a misleading chart.",
      type: "bar",
      data: enrichDataWithFactMeta(awardRows, facts, "contractAwards"),
      xKey: "date",
      series: [{ dataKey: "value", name: "Award Value", color: PALETTE[0] }],
      formatter: "currencyM",
      headline: "Contract award values over time",
      fullWidth: true,
    });
  }

  const opportunityRows = meaningfulRows(cr.opportunitiesByStage, "stage", "count");
  if (opportunityRows.length >= 2) {
    addChartIfSuitable(charts, {
      id: "intel-opportunities-by-stage",
      title: "Opportunities by Stage",
      subtitle: "Opportunity distribution only when multiple meaningful stages exist.",
      type: "bar",
      data: enrichDataWithFactMeta(opportunityRows, facts, "opportunities"),
      xKey: "stage",
      series: [{ dataKey: "count", name: "Count", color: PALETTE[1] }],
      formatter: "plain",
      headline: "Opportunity pipeline by stage",
    });
  }

  const confidenceRows = meaningfulRows(cr.sourceConfidenceOverTime, "date", "confidence");
  const uniqueConfidenceDates = new Set(confidenceRows.map((row) => String(row.date))).size;
  if (uniqueConfidenceDates >= 3) {
    addChartIfSuitable(charts, {
      id: "intel-source-confidence",
      title: "Source Confidence Over Time",
      subtitle: "Confidence score trend only when enough time points exist.",
      type: "line",
      data: enrichDataWithFactMeta(confidenceRows, facts, "sourceConfidence"),
      xKey: "date",
      series: [{ dataKey: "confidence", name: "Confidence", color: PALETTE[2] }],
      formatter: "plain",
      headline: "Source confidence trend",
    });
  }

  const jobRows = meaningfulRows(cr.jobSignalTrend, "date", "value");
  const uniqueJobDates = new Set(jobRows.map((row) => String(row.date))).size;
  if (uniqueJobDates >= 3) {
    addChartIfSuitable(charts, {
      id: "intel-job-signal-trend",
      title: "Job Signal Trend",
      subtitle: "Hiring signal trend only when multiple time points are available.",
      type: "area",
      data: enrichDataWithFactMeta(jobRows, facts, "jobSignals"),
      xKey: "date",
      series: [{ dataKey: "value", name: "Signal Strength", color: PALETTE[3] }],
      formatter: "plain",
      headline: "Job market signal trend",
    });
  }

  const eventRows = meaningfulRows(cr.eventTimeline, "date", "value");
  const uniqueEventDates = new Set(eventRows.map((row) => String(row.date))).size;
  if (eventRows.length >= 3 && uniqueEventDates >= 2) {
    addChartIfSuitable(charts, {
      id: "intel-event-timeline",
      title: "Intelligence Event Timeline",
      subtitle: "Ingested intelligence events with enough chronological spread to chart.",
      type: "bar",
      data: enrichDataWithFactMeta(eventRows, facts, "timelineEvents"),
      xKey: "date",
      series: [{ dataKey: "value", name: "Value", color: PALETTE[4] }],
      formatter: "plain",
      headline: "Intelligence event timeline",
      fullWidth: true,
    });
  }

  const locationRows = meaningfulRows(cr.locationExposureByRegion, "region", "count");
  if (locationRows.length >= 2) {
    addChartIfSuitable(charts, {
      id: "intel-location-exposure",
      title: "Location Exposure by Region",
      subtitle: "Resolved geographic intelligence only; Unknown locations are kept in provenance warnings.",
      type: "bar",
      data: enrichDataWithFactMeta(locationRows, facts, "locationExposure"),
      xKey: "region",
      series: [{ dataKey: "count", name: "Signal Count", color: PALETTE[5] }],
      formatter: "plain",
      headline: "Location exposure by region",
    });
  }

  const gapRows = meaningfulRows(cr.networkGapScoreByRegion, "region", "gapScore");
  if (gapRows.length >= 2) {
    addChartIfSuitable(charts, {
      id: "intel-network-gap-score",
      title: "Medical Network Gap Score by Region",
      subtitle: "Resolved occupational health network coverage gaps only.",
      type: "bar",
      data: enrichDataWithFactMeta(gapRows, facts, "medicalNetworkGaps"),
      xKey: "region",
      series: [{ dataKey: "gapScore", name: "Gap Score", color: PALETTE[6] }],
      formatter: "plain",
      headline: "Network gap score by region",
    });
  }

  return charts;
}

export function intelligenceFactsByCategory(facts: IntelligenceFact[]): Record<string, IntelligenceFact[]> {
  const grouped: Record<string, IntelligenceFact[]> = {};
  for (const fact of facts) {
    if (!grouped[fact.category]) grouped[fact.category] = [];
    grouped[fact.category].push(fact);
  }
  return grouped;
}

export function intelligenceSummary(intelligence: CompanyIntelligence | undefined): {
  totalFacts: number;
  liveFacts: number;
  linkOnlyFacts: number;
  verifiedFacts: number;
  searchDerivedFacts: number;
  staticFallbackFacts: number;
  sourcesQueried: string[];
  lastRun?: string;
} {
  if (!intelligence) {
    return { totalFacts: 0, liveFacts: 0, linkOnlyFacts: 0, verifiedFacts: 0, searchDerivedFacts: 0, staticFallbackFacts: 0, sourcesQueried: [] };
  }
  const totalFacts = intelligence.facts.length;
  const linkOnlyFacts = intelligence.facts.filter((f) => f.confidence === "link-only").length;
  const verifiedFacts = intelligence.facts.filter((f) => f.sourceType === "usaspending" || f.sourceType === "sec").length;
  const searchDerivedFacts = intelligence.facts.filter((f) => f.sourceType === "web" || f.sourceType === "news").length;
  const staticFallbackFacts = intelligence.facts.filter((f) => String(f.metadata?.recordType ?? "").toLowerCase().includes("static")).length;
  const liveFacts = totalFacts - linkOnlyFacts;
  const sourcesQueried = [...new Set(intelligence.facts.map((f) => f.sourceType))];
  const lastRun = intelligence.runs[0]?.completedAt || undefined;
  return { totalFacts, liveFacts, linkOnlyFacts, verifiedFacts, searchDerivedFacts, staticFallbackFacts, sourcesQueried, lastRun };
}

export function emptyChartReady(): IntelligenceChartReady {
  return {
    awardValueTimeline: [],
    opportunitiesByStage: [],
    sourceConfidenceOverTime: [],
    jobSignalTrend: [],
    eventTimeline: [],
    locationExposureByRegion: [],
    networkGapScoreByRegion: [],
  };
}
