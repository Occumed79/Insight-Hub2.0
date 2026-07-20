import type { ChartDefinition, MetricDefinition, TooltipFormat } from "../company-configs/types";

export type PreparedChart = {
  chart: ChartDefinition;
  warnings: string[];
  units: string[];
  missingValues: number;
  invalidValues: number;
  scaledValues: number;
  mixedUnits: boolean;
};

type MetricLike = MetricDefinition & {
  companyId?: string;
  sourceIds?: string[];
  status?: string;
  effectiveDate?: string;
};

const FORMAT_UNIT: Partial<Record<TooltipFormat, string>> = {
  currencyM: "usd",
  currencyK: "usd",
  percent: "percent",
  hoursM: "hours",
};

export function finiteChartNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/[$,%]/g, "").replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function displayScale(value: number, formatter?: TooltipFormat) {
  const absolute = Math.abs(value);
  if (formatter === "currencyM" && absolute >= 100_000) return { value: value / 1_000_000, scaled: true };
  if (formatter === "currencyK" && absolute >= 10_000) return { value: value / 1_000, scaled: true };
  if (formatter === "hoursM" && absolute >= 100_000) return { value: value / 1_000_000, scaled: true };
  return { value, scaled: false };
}

export function formatChartTick(formatter?: TooltipFormat) {
  if (formatter === "currencyM") return (value: number) => `$${Number(value).toLocaleString()}M`;
  if (formatter === "currencyK") return (value: number) => `$${Number(value).toLocaleString()}K`;
  if (formatter === "percent") return (value: number) => `${Number(value).toLocaleString()}%`;
  if (formatter === "hoursM") return (value: number) => `${Number(value).toLocaleString()}M hrs`;
  return undefined;
}

export function formatChartValue(value: unknown, formatter?: TooltipFormat, unit?: string) {
  const numeric = finiteChartNumber(value);
  if (numeric === undefined) return "Missing";
  const formatted = formatter === "currencyM"
    ? `$${numeric.toLocaleString()}M`
    : formatter === "currencyK"
      ? `$${numeric.toLocaleString()}K`
      : formatter === "percent"
        ? `${numeric.toLocaleString()}%`
        : formatter === "hoursM"
          ? `${numeric.toLocaleString()}M hrs`
          : Number.isInteger(numeric)
            ? numeric.toLocaleString()
            : numeric.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return unit && unit !== FORMAT_UNIT[formatter ?? "plain"] ? `${formatted} ${unit}` : formatted;
}

function scaledBound(value: number, formatter?: TooltipFormat) {
  return displayScale(value, formatter).value;
}

export function prepareChartForRendering(input: ChartDefinition): PreparedChart {
  const warnings: string[] = [];
  const units = new Set<string>();
  let missingValues = 0;
  let invalidValues = 0;
  let scaledValues = 0;

  const data = input.data.map((row) => {
    const normalized: Record<string, string | number> = { ...row };
    for (const series of input.series) {
      const raw = row[series.dataKey];
      const numeric = finiteChartNumber(raw);
      const explicitUnit = row[`${series.dataKey}Unit`] ?? row.unit ?? FORMAT_UNIT[input.formatter ?? "plain"];
      if (explicitUnit) units.add(String(explicitUnit).toLowerCase());
      if (raw === undefined || raw === null || raw === "") {
        delete normalized[series.dataKey];
        missingValues += 1;
        continue;
      }
      if (numeric === undefined) {
        delete normalized[series.dataKey];
        invalidValues += 1;
        continue;
      }
      const scaled = displayScale(numeric, input.formatter);
      normalized[series.dataKey] = scaled.value;
      if (scaled.scaled) scaledValues += 1;
    }
    return normalized;
  });

  if (missingValues) warnings.push(`${missingValues} missing value${missingValues === 1 ? "" : "s"} preserved as missing.`);
  if (invalidValues) warnings.push(`${invalidValues} non-numeric value${invalidValues === 1 ? "" : "s"} excluded from plotting.`);
  if (scaledValues) warnings.push(`${scaledValues} raw value${scaledValues === 1 ? "" : "s"} converted to the formatter's display scale.`);

  const mixedUnits = units.size > 1;
  if (mixedUnits) warnings.push(`Incompatible units detected: ${Array.from(units).join(", ")}.`);

  const referenceLines = input.referenceLines?.map((line) => ({ ...line, y: scaledBound(line.y, input.formatter) }));
  const domain = input.domain ? [scaledBound(input.domain[0], input.formatter), scaledBound(input.domain[1], input.formatter)] as [number, number] : undefined;

  return {
    chart: { ...input, data, referenceLines, domain },
    warnings,
    units: Array.from(units),
    missingValues,
    invalidValues,
    scaledValues,
    mixedUnits,
  };
}

function metricDisplayValue(metric: MetricLike) {
  if (metric.unit !== "usd") return metric.value;
  return Math.abs(metric.value) >= 100_000 ? metric.value / 1_000_000 : metric.value;
}

export function buildMetricCharts(metrics: MetricLike[], idPrefix = "metric-proof"): ChartDefinition[] {
  const groups = new Map<string, MetricLike[]>();
  for (const metric of metrics) {
    const key = metric.unit;
    const current = groups.get(key) ?? [];
    current.push(metric);
    groups.set(key, current);
  }

  return Array.from(groups.entries()).map(([unit, group], index) => {
    const formatter: TooltipFormat = unit === "usd" ? "currencyM" : unit === "percent" ? "percent" : "plain";
    const unitLabel = unit === "usd" ? "USD millions" : unit === "percent" ? "Percent" : unit === "count" ? "Count" : "Score";
    return {
      id: `${idPrefix}-${unit}-${index}`,
      title: `${unitLabel} metrics`,
      subtitle: `Comparable ${unitLabel.toLowerCase()} values only. Metrics with different units are rendered separately.`,
      type: "bar",
      xKey: "label",
      data: group.map((metric) => ({
        label: metric.label,
        value: metricDisplayValue(metric),
        unit: metric.unit,
        category: metric.category,
        sourceId: metric.sourceId ?? metric.sourceIds?.[0] ?? "",
        confidence: metric.status ?? "static",
        sourceType: metric.status ?? "static",
        date: metric.effectiveDate ?? "",
      })),
      series: [{ dataKey: "value", name: unitLabel }],
      formatter,
      headline: `${unitLabel.toLowerCase()} metric focus`,
      fullWidth: group.length > 5,
    };
  });
}
