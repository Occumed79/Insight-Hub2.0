import type { ChartDefinition } from "../company-configs/types";

export type RepresentationType =
  | "chart"
  | "metric-proof"
  | "evidence-card"
  | "timeline-strip"
  | "ranked-list"
  | "data-quality-warning"
  | "suppressed";

export type ConfidenceLabel = "verified" | "strong" | "medium" | "weak" | "lead" | "static";

export type ChartSuitabilityResult = {
  representationType: RepresentationType;
  reason: string;
  confidenceLabel: ConfidenceLabel;
  warnings: string[];
};

function normalizeLabel(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isUnknownLabel(value: unknown): boolean {
  const label = normalizeLabel(value);
  return !label || label === "unknown" || label === "n/a" || label === "na" || label === "null" || label === "undefined";
}

function firstSeriesKey(chart: ChartDefinition): string | undefined {
  return chart.series[0]?.dataKey;
}

function numericValues(chart: ChartDefinition): number[] {
  const key = firstSeriesKey(chart);
  if (!key) return [];
  return chart.data
    .map((row) => row[key])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function mostlyUnknownLabels(chart: ChartDefinition): boolean {
  if (!chart.data.length) return false;
  const unknownCount = chart.data.filter((row) => isUnknownLabel(row[chart.xKey] ?? row.label ?? row.region ?? row.stage)).length;
  return unknownCount / chart.data.length >= 0.5;
}

function uniqueMeaningfulLabels(chart: ChartDefinition): string[] {
  return [...new Set(
    chart.data
      .map((row) => String(row[chart.xKey] ?? row.label ?? row.region ?? row.stage ?? "").trim())
      .filter((label) => label && !isUnknownLabel(label))
  )];
}

function missingValueCount(chart: ChartDefinition): number {
  const key = firstSeriesKey(chart);
  if (!key) return chart.data.length;
  return chart.data.filter((row) => row[key] === null || row[key] === undefined || row[key] === "").length;
}

function inferConfidence(chart: ChartDefinition): ConfidenceLabel {
  const allConfidence = chart.data.map((row) => normalizeLabel(row.confidence)).filter(Boolean);
  const sourceTypes = chart.data.map((row) => normalizeLabel(row.sourceType)).filter(Boolean);
  const urls = chart.data.map((row) => normalizeLabel(row.sourceUrl)).filter(Boolean);

  if (allConfidence.includes("link-only")) return "lead";
  if (sourceTypes.some((type) => type === "usaspending" || type === "sec")) return "verified";
  if (urls.some((url) => url.includes(".gov") || url.includes(".mil") || url.includes("sec.gov") || url.includes("usaspending.gov"))) return "strong";
  if (sourceTypes.some((type) => type === "web" || type === "news")) return "medium";
  if (chart.id.includes("metric-fallback") || chart.id.includes("static")) return "static";
  return "weak";
}

export function evaluateChartSuitability(chart: ChartDefinition): ChartSuitabilityResult {
  const warnings: string[] = [];
  const values = numericValues(chart);
  const labels = uniqueMeaningfulLabels(chart);
  const confidenceLabel = inferConfidence(chart);
  const lowerTitle = `${chart.title} ${chart.subtitle} ${chart.id}`.toLowerCase();

  if (!chart.data.length) {
    return {
      representationType: "suppressed",
      reason: "No data rows are available for this visualization.",
      confidenceLabel,
      warnings: ["No data rows."],
    };
  }

  if (mostlyUnknownLabels(chart)) {
    return {
      representationType: "data-quality-warning",
      reason: "Most labels are unresolved or Unknown; charting them would imply geographic/category precision that the source does not support.",
      confidenceLabel,
      warnings: ["Mostly unknown labels.", "Use a provenance warning instead of a chart."],
    };
  }

  if (missingValueCount(chart) > 0) {
    warnings.push("Some values are missing and were not coerced to zero.");
  }

  if (chart.data.length === 1 || labels.length <= 1) {
    return {
      representationType: lowerTitle.includes("timeline") || chart.type === "line" || chart.type === "area" ? "timeline-strip" : "metric-proof",
      reason: "Only one meaningful value/category is available; a full chart would exaggerate scale and certainty.",
      confidenceLabel,
      warnings: ["Single-value chart suppressed.", ...warnings],
    };
  }

  if ((chart.type === "line" || chart.type === "area") && labels.length < 3) {
    return {
      representationType: "timeline-strip",
      reason: "Fewer than three time points are available; rendering a trend line would be misleading.",
      confidenceLabel,
      warnings: ["Insufficient time points for trend chart.", ...warnings],
    };
  }

  if (values.length > 1 && new Set(values.map((value) => Number(value.toFixed(6)))).size === 1) {
    return {
      representationType: "ranked-list",
      reason: "All values are identical; a chart would create false visual variation.",
      confidenceLabel,
      warnings: ["Flat repeated values.", ...warnings],
    };
  }

  if (confidenceLabel === "lead") {
    warnings.push("This is a source lead/manual review item, not verified intelligence.");
  }

  return {
    representationType: "chart",
    reason: "Data has enough meaningful categories/time points for chart rendering.",
    confidenceLabel,
    warnings,
  };
}

export function shouldRenderAsChart(chart: ChartDefinition): boolean {
  return evaluateChartSuitability(chart).representationType === "chart";
}
