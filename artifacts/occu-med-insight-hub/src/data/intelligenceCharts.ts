import type { ChartDefinition } from "../company-configs/types";
import type { CompanyIntelligence, IntelligenceFact, IntelligenceChartReady } from "./types";

const PALETTE = ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#fb7185", "#60a5fa", "#a3e635"];

export function intelligenceFactsToCharts(intelligence: CompanyIntelligence | undefined): ChartDefinition[] {
  if (!intelligence || intelligence.facts.length === 0) return [];
  const charts: ChartDefinition[] = [];
  const cr = intelligence.chartReady;

  if (cr.awardValueTimeline.length > 0) {
    charts.push({
      id: "intel-award-value-timeline",
      title: "Contract Award Value Timeline",
      subtitle: "Federal contract awards from USASpending.gov",
      type: "bar",
      data: cr.awardValueTimeline,
      xKey: "date",
      series: [{ dataKey: "value", name: "Award Value", color: PALETTE[0] }],
      formatter: "currencyM",
      headline: "Contract award values over time",
      fullWidth: true,
    });
  }

  if (cr.opportunitiesByStage.length > 0) {
    charts.push({
      id: "intel-opportunities-by-stage",
      title: "Opportunities by Stage",
      subtitle: "SAM.gov and federal opportunity signals",
      type: "bar",
      data: cr.opportunitiesByStage,
      xKey: "stage",
      series: [{ dataKey: "count", name: "Count", color: PALETTE[1] }],
      formatter: "plain",
      headline: "Opportunity pipeline by stage",
    });
  }

  if (cr.sourceConfidenceOverTime.length > 0) {
    charts.push({
      id: "intel-source-confidence",
      title: "Source Confidence Over Time",
      subtitle: "Confidence score (3=high, 2=medium, 1=low) by source",
      type: "line",
      data: cr.sourceConfidenceOverTime,
      xKey: "date",
      series: [{ dataKey: "confidence", name: "Confidence", color: PALETTE[2] }],
      formatter: "plain",
      headline: "Source confidence trend",
    });
  }

  if (cr.jobSignalTrend.length > 0) {
    charts.push({
      id: "intel-job-signal-trend",
      title: "Job Signal Trend",
      subtitle: "Hiring signals from career portals and job boards",
      type: "area",
      data: cr.jobSignalTrend,
      xKey: "date",
      series: [{ dataKey: "value", name: "Signal Strength", color: PALETTE[3] }],
      formatter: "plain",
      headline: "Job market signal trend",
    });
  }

  if (cr.eventTimeline.length > 0) {
    charts.push({
      id: "intel-event-timeline",
      title: "Intelligence Event Timeline",
      subtitle: "All ingested intelligence events chronologically",
      type: "bar",
      data: cr.eventTimeline,
      xKey: "date",
      series: [{ dataKey: "value", name: "Value", color: PALETTE[4] }],
      formatter: "plain",
      headline: "Intelligence event timeline",
      fullWidth: true,
    });
  }

  if (cr.locationExposureByRegion.length > 0) {
    charts.push({
      id: "intel-location-exposure",
      title: "Location Exposure by Region",
      subtitle: "Geographic concentration of intelligence signals",
      type: "bar",
      data: cr.locationExposureByRegion,
      xKey: "region",
      series: [{ dataKey: "count", name: "Signal Count", color: PALETTE[5] }],
      formatter: "plain",
      headline: "Location exposure by region",
    });
  }

  if (cr.networkGapScoreByRegion.length > 0) {
    charts.push({
      id: "intel-network-gap-score",
      title: "Medical Network Gap Score by Region",
      subtitle: "Occupational health network coverage gaps",
      type: "bar",
      data: cr.networkGapScoreByRegion,
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
  sourcesQueried: string[];
  lastRun?: string;
} {
  if (!intelligence) {
    return { totalFacts: 0, liveFacts: 0, linkOnlyFacts: 0, sourcesQueried: [] };
  }
  const totalFacts = intelligence.facts.length;
  const linkOnlyFacts = intelligence.facts.filter((f) => f.confidence === "link-only").length;
  const liveFacts = totalFacts - linkOnlyFacts;
  const sourcesQueried = [...new Set(intelligence.facts.map((f) => f.sourceType))];
  const lastRun = intelligence.runs[0]?.completedAt || undefined;
  return { totalFacts, liveFacts, linkOnlyFacts, sourcesQueried, lastRun };
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
