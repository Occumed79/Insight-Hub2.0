import { useEffect, useMemo, useState, useRef } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
  Label,
  LabelList,
} from "recharts";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { IntelligenceSelector } from "@/components/insight/IntelligenceSelector";
import { IntelligenceStatusBadge } from "@/components/insight/IntelligenceStatusBadge";
import { DataQualityBanner } from "@/components/insight/DataQualityBanner";
import { LuminousChartTooltip } from "@/components/insight/LuminousChartTooltip";
import { useInsightData, useSelectedCompany } from "@/data/useInsightData";
import { getCompanyConfigOrDefault } from "@/company-configs";
import { resolveConfigCompanyId } from "@/company-configs/configIds";
import { getIntelligenceStatus } from "@/company-configs/intelligenceNavigation";
import { intelligenceFactsToCharts } from "@/data/intelligenceCharts";
import { IntelligenceOverview } from "@/components/insight/IntelligenceOverview";
import { IntelligenceSections } from "@/components/insight/IntelligenceSections";
import { IntelligenceInsightPanel } from "@/components/insight/IntelligenceInsightPanel";
import { IntelligenceAnswerCard } from "@/components/insight/IntelligenceAnswerCard";
import type {
  ChartDefinition,
  MetricDefinition,
  SignalDefinition,
  RiskMatrixPoint,
  OpportunityMatrixPoint,
  DossierSectionDefinition,
  TooltipFormat,
} from "@/company-configs/types";
import type { IntelligenceFact, IntelligenceCategory, CompanyIntelligence } from "@/data/types";
import {
  fetchVisualizationFeed,
  feedChartsToChartDefinitions,
  feedFactsToIntelligenceFacts,
  type DataVisualizationFeed,
} from "@/data/visualizationIntelligenceAdapter";
import { CheckCircle2, AlertTriangle, XCircle, Activity } from "lucide-react";
import { categoryLabel } from "@/data/intelligenceActions";

interface ProfileVisualizationModel {
  company: { name: string; shortName: string; summary: string; tags: string[] } | null;
  metrics: MetricDefinition[];
  charts: ChartDefinition[];
  signals: SignalDefinition[];
  dossierSections: DossierSectionDefinition[];
  sourceRecords: any[];
  riskMatrix: RiskMatrixPoint[];
  opportunityMatrix: OpportunityMatrixPoint[];
}

export interface ChartDatumSelection {
  chartId: string;
  chartTitle: string;
  chartType: string;
  category: string;
  seriesName: string;
  dataKey: string;
  value: number;
  unit?: string;
  formatter?: TooltipFormat;
  sourceId?: string;
  note?: string;
  payload?: Record<string, string | number>;
  sourceUrl?: string;
  confidence?: string;
  date?: string;
  sourceType?: string;
  intelligenceCategory?: string;
  summary?: string;
  rawSnippet?: string;
}

function buildProfileVisualizationModel({
  company,
  config,
  metrics,
  sources,
}: {
  company: { name: string; shortName: string; summary: string; tags: string[] } | null;
  config: any;
  metrics: MetricDefinition[];
  sources: any[];
}): ProfileVisualizationModel {
  const configMetrics = (config.metricDefinitions ?? []).map((metric: MetricDefinition) => ({
    ...metric,
    companyId: config.companyId,
  }));
  const mergedMetrics = [
    ...metrics,
    ...configMetrics.filter((metric: MetricDefinition) => !metrics.some((existing) => existing.id === metric.id)),
  ] as MetricDefinition[];

  return {
    company,
    metrics: mergedMetrics,
    charts: config.chartDefinitions ?? [],
    signals: config.executiveSignals ?? [],
    dossierSections: config.dossierSections ?? [],
    sourceRecords: sources,
    riskMatrix: config.riskMatrix ?? [],
    opportunityMatrix: config.opportunityMatrix ?? [],
  };
}

function formatTickByType(formatter: TooltipFormat | undefined) {
  if (formatter === "currencyM") return (v: number) => `$${v}M`;
  if (formatter === "currencyK") return (v: number) => `$${v}K`;
  if (formatter === "percent") return (v: number) => `${v}%`;
  if (formatter === "hoursM") return (v: number) => `${v}M hrs`;
  return undefined;
}

function metricUnitLabel(unit: MetricDefinition["unit"]) {
  switch (unit) {
    case "usd":
      return "$";
    case "percent":
      return "%";
    case "count":
      return "count";
    case "score":
      return "score";
    default:
      return "";
  }
}

function metricChartFromDefinitions(metrics: MetricDefinition[]): ChartDefinition[] {
  if (!metrics.length) return [];
  const categories = [...new Set(metrics.map((m) => m.category))];
  const byCategory = categories.map((category) => ({
    category,
    metrics: metrics.filter((m) => m.category === category),
  }));

  return byCategory.map((group, index) => {
    const data: Record<string, string | number>[] = group.metrics.map((m) => {
      const record: Record<string, string | number> = {
        label: m.label,
        value: m.value,
        id: m.id,
        unit: m.unit,
        category: m.category,
      };
      if (m.sourceId) record.sourceId = m.sourceId;
      if (m.trend !== undefined) record.trend = m.trend;
      return record;
    });
    return {
      id: `metric-fallback-${group.category}-${index}`,
      title: `${group.category.charAt(0).toUpperCase() + group.category.slice(1)} Metrics`,
      subtitle: `Comparison of ${group.category} metrics`,
      type: "bar" as const,
      xKey: "label",
      data,
      series: [{ dataKey: "value", name: "Value", color: "#22d3ee" }],
      formatter: "plain",
      headline: `${group.category} metric focus`,
    };
  });
}

function chartHeight(chart: ChartDefinition) {
  const rowCount = chart.data.length;
  const base = chart.fullWidth ? 340 : 300;
  const expanded = base + Math.max(0, rowCount - 6) * 18;
  return Math.min(chart.fullWidth ? 560 : 440, expanded);
}

function getSeriesColor(index: number, fallback?: string) {
  const palette = ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#fb7185", "#60a5fa", "#a3e635"];
  return fallback ?? palette[index % palette.length];
}

function getHolographicLayer(chart: ChartDefinition) {
  const title = chart.title.toLowerCase();
  if (title.includes("injury") || title.includes("trir") || title.includes("lwcr") || title.includes("safety") || title.includes("rate")) return "holo-layer-safety";
  if (title.includes("workforce") || title.includes("employee") || title.includes("exposure")) return "holo-layer-workforce";
  if (title.includes("location") || title.includes("region") || title.includes("geographic")) return "holo-layer-location";
  if (title.includes("network") || title.includes("gap") || title.includes("provider")) return "holo-layer-network";
  if (title.includes("confidence") || title.includes("source")) return "holo-layer-confidence";
  if (title.includes("risk") || title.includes("matrix")) return "holo-layer-risk";
  if (title.includes("event") || title.includes("timeline")) return "holo-layer-event";
  return "holo-layer-base";
}

function getConfidenceColor(confidence?: string): string {
  const c = (confidence ?? "").toLowerCase();
  if (c === "high") return "#34d399";
  if (c === "medium") return "#fbbf24";
  if (c === "low") return "#fb7185";
  if (c === "link-only") return "#94a3b8";
  return "#22d3ee";
}

function getColorByData(entry: Record<string, string | number>): string {
  const confidence = String(entry.confidence ?? "");
  const category = String(entry.category ?? "");
  if (confidence) return getConfidenceColor(confidence);
  if (category) return getCategoryColor(category);
  const value = Number(entry.value ?? 0);
  if (value > 75) return "#22d3ee";
  if (value > 50) return "#a78bfa";
  if (value > 25) return "#fbbf24";
  return "#fb7185";
}

function getCategoryColor(category?: string): string {
  const map: Record<string, string> = {
    safety: "#22d3ee",
    workforce: "#34d399",
    risk: "#fb7185",
    financial: "#fbbf24",
    contractAwards: "#60a5fa",
    opportunities: "#a78bfa",
    secFilings: "#fbbf24",
    jobSignals: "#34d399",
    sourceFacts: "#f472b6",
    sourceConfidence: "#60a5fa",
    timelineEvents: "#fb7185",
    locationExposure: "#a3e635",
    medicalNetworkGaps: "#fb923c",
    competitorSignals: "#c084fc",
    renewalOrExpirationEvents: "#2dd4bf",
  };
  return map[category ?? ""] ?? "#22d3ee";
}

function chartCategoryFromId(chartId: string): IntelligenceCategory | null {
  if (chartId.includes("injury") || chartId.includes("safety") || chartId.includes("trir") || chartId.includes("lwcr") || chartId.includes("rate")) return "sourceConfidence";
  if (chartId.includes("workforce") || chartId.includes("employee") || chartId.includes("exposure")) return "locationExposure";
  if (chartId.includes("award")) return "contractAwards";
  if (chartId.includes("opportunities")) return "opportunities";
  if (chartId.includes("job")) return "jobSignals";
  if (chartId.includes("confidence")) return "sourceConfidence";
  if (chartId.includes("event")) return "timelineEvents";
  if (chartId.includes("location")) return "locationExposure";
  if (chartId.includes("network")) return "medicalNetworkGaps";
  return null;
}

function factsInDateRange(facts: IntelligenceFact[], range: string): IntelligenceFact[] {
  if (range === "all") return facts;
  const now = Date.now();
  const ms = {
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
    "1y": 365 * 24 * 60 * 60 * 1000,
  } as Record<string, number>;
  const cutoff = now - (ms[range] ?? 0);
  return facts.filter((f) => {
    const d = Date.parse(f.date);
    return !isNaN(d) && d >= cutoff;
  });
}

function filterIntelligenceCharts(
  charts: ChartDefinition[],
  facts: IntelligenceFact[],
  categoryFilter: string,
  confidenceFilter: string,
  sourceTypeFilter: string,
  dateRange: string
): ChartDefinition[] {
  return charts.filter((chart) => {
    const category = chartCategoryFromId(chart.id);
    if (categoryFilter !== "all" && category !== categoryFilter) return false;
    let relevant = category ? facts.filter((f) => f.category === category) : facts;
    relevant = factsInDateRange(relevant, dateRange);
    if (confidenceFilter !== "all" && !relevant.some((f) => f.confidence === confidenceFilter)) return false;
    if (sourceTypeFilter !== "all" && !relevant.some((f) => f.sourceType === sourceTypeFilter)) return false;
    return true;
  });
}

function morphIntelligenceFacts(
  facts: IntelligenceFact[],
  mode: "category" | "sourceType" | "confidence" | "time"
): ChartDefinition {
  const keyBy = (f: IntelligenceFact) => {
    if (mode === "category") return f.category;
    if (mode === "sourceType") return f.sourceType;
    if (mode === "confidence") return f.confidence;
    const d = f.date.slice(0, 7);
    return d || "unknown";
  };
  const grouped = facts.reduce<Record<string, { count: number; value: number; category: string }>>((acc, f) => {
    const key = keyBy(f);
    if (!acc[key]) acc[key] = { count: 0, value: 0, category: f.category };
    acc[key].count += 1;
    acc[key].value += f.value ?? 0;
    return acc;
  }, {});
  const data = Object.entries(grouped)
    .map(([label, g]) => ({ label, count: g.count, value: g.value, category: g.category }))
    .sort((a, b) => b.count - a.count);
  return {
    id: `morph-${mode}`,
    title: `Morph: ${mode === "category" ? "Category" : mode === "sourceType" ? "Source" : mode === "confidence" ? "Confidence" : "Time"}`,
    subtitle: `Intelligence facts grouped by ${mode}`,
    type: "bar",
    xKey: "label",
    data,
    series: [{ dataKey: "count", name: "Facts", color: "#22d3ee" }],
    formatter: "plain",
    headline: "morphed intelligence view",
    fullWidth: true,
  };
}

function enrichStaticChartSources(charts: ChartDefinition[], sources: any[]): ChartDefinition[] {
  if (!sources.length) return charts;
  return charts.map((chart) => ({
    ...chart,
    data: chart.data.map((row) => {
      const sourceId = row.sourceId as string | undefined;
      const matched = sourceId ? sources.find((s) => s.id === sourceId || s.sourceId === sourceId) : null;
      if (!matched) return row;
      return {
        ...row,
        sourceUrl: (matched.url ?? "") as string,
        sourceName: (matched.name ?? matched.sourceName ?? "") as string,
        sourceType: (matched.type ?? "") as string,
        confidence: (matched.confidence ?? "") as string,
        date: (row.date ?? matched.date ?? "") as string,
      };
    }),
  }));
}

function useChartPanels(vizModel: ProfileVisualizationModel) {
  return useMemo(() => {
    const baseCharts = vizModel.charts.length ? vizModel.charts : metricChartFromDefinitions(vizModel.metrics);
    const primaryCharts = enrichStaticChartSources(baseCharts, vizModel.sourceRecords);
    return { primaryCharts };
  }, [vizModel.charts, vizModel.metrics, vizModel.sourceRecords]);
}

function formatValue(value: number, formatter?: TooltipFormat, unit?: string) {
  const formatted =
    formatter === "currencyM"
      ? `$${value.toLocaleString()}M`
      : formatter === "currencyK"
        ? `$${value.toLocaleString()}K`
        : formatter === "percent"
          ? `${value}%`
          : formatter === "hoursM"
            ? `${value.toLocaleString()}M hrs`
            : value.toLocaleString();
  return unit ? `${formatted} ${unit}` : formatted;
}

const METHOD_BEHAVIOR: Record<
  string,
  { label: string; description: string; affects: string; mode: string }
> = {
  "vector-displacement": {
    label: "Vector Displacement Mapping",
    description: "Chart layers shift through 3D depth based on injury/safety/risk magnitude. Higher risk values push farther into the scene.",
    affects: "scene depth, layer parallax",
    mode: "displacement",
  },
  "chromatic-aberration": {
    label: "Chromatic Aberration Highlighting",
    description: "Selected safety/risk metric gets cinematic RGB edge split. The stage object fractures into spectral layers.",
    affects: "stage object, focus element",
    mode: "chromatic",
  },
  "geometric-anchor": {
    label: "Geometric Anchor Snapping",
    description: "Large callout lines pin exact injury/safety values. Anchor lines snap across the full scene like tech-spec callouts.",
    affects: "full scene, value callouts",
    mode: "anchor",
  },
  "subtractive-masking": {
    label: "Subtractive Masking Overlays",
    description: "Spotlight reveal isolates the selected risk signal. Background dims and the safety metric cuts through with luminous focus.",
    affects: "full stage, spotlight",
    mode: "masking",
  },
  "procedural-grid": {
    label: "Procedural Grid Resonances",
    description: "Full-stage grid resonance behind the safety/risk trend. Grid reacts to injury rate magnitude with pulsing waves.",
    affects: "stage background, grid",
    mode: "grid",
  },
  "algorithmic-edge": {
    label: "Algorithmic Edge-Tracing",
    description: "Animated outlines trace injury trend lines and rate bars. Feels like a product-page technical reveal.",
    affects: "chart shapes, panel borders",
    mode: "edge",
  },
  "concentric-ripple": {
    label: "Concentric Ripple Metrics",
    description: "Selected high-risk value emits impact ripples. Expanding luminous waves affect nearby scene elements.",
    affects: "selected point, nearby elements",
    mode: "ripple",
  },
  "negative-space": {
    label: "Negative Space Inversion",
    description: "Surrounding data glows while selected risk becomes a clean cutout. Scene inverts emphasis to isolate the safety signal.",
    affects: "full scene, emphasis inversion",
    mode: "invert",
  },
  "vector-lattice": {
    label: "Vector Lattice Distortion",
    description: "Luminous lattice bends around the active safety/workforce/risk category with cinematic distortion.",
    affects: "background lattice, scene",
    mode: "lattice",
  },
  "color-shift": {
    label: "Color-Shift Isometry",
    description: "Palette changes by metric type: safety, workforce, location, source, risk. Each data domain gets a distinct visual identity.",
    affects: "full scene palette",
    mode: "colorShift",
  },
  "synchronous-path": {
    label: "Synchronous Path Illumination",
    description: "Related safety, workforce, and location data lights up together across scenes. Matching categories illuminate in synchrony.",
    affects: "cross-scene paths",
    mode: "synchronous",
  },
  "vector-node": {
    label: "Vector Node Expansion",
    description: "Selected metric expands into a cinematic insight object with depth, shadow, and luminous detail.",
    affects: "selected datum, info object",
    mode: "node",
  },
  "radiant-gradient": {
    label: "Radiant Gradient Focus",
    description: "Full scene gradient focus follows selected safety/risk category. Unrelated elements recede into soft blur.",
    affects: "full scene, gradient focus",
    mode: "radiant",
  },
  "isometric-slice": {
    label: "Isometric Slice-View",
    description: "Injury/risk/workforce layers lift into 3D slabs with depth, shadow, and dimensional perspective.",
    affects: "bars, matrix, slabs",
    mode: "isometric",
  },
  "semantic-zoom": {
    label: "Generative Semantic Zoom",
    description: "Zoom from company-level risk to granular safety metric/source detail. Smooth cinematic zoom, not a drawer.",
    affects: "scene zoom, detail level",
    mode: "zoom",
  },
  "holographic-depth": {
    label: "Holographic Depth Layers",
    description: "Safety, workforce, location, source, and risk data sit on layered glass planes at different depths.",
    affects: "layered glass planes",
    mode: "holographic",
  },
  "kinetic-vector": {
    label: "Kinetic Vector Transitions",
    description: "Scene transitions move with directional momentum. Elements travel with purpose, not just fade.",
    affects: "scene transitions, motion",
    mode: "kinetic",
  },
  "contextual-morph": {
    label: "Contextual Data Morphing",
    description: "Morph between safety, workforce, location, source, and risk groupings with visible animated transformation.",
    affects: "chart transformation",
    mode: "morph",
  },
  "interactive-filter": {
    label: "Interactive Filtering",
    description: "Apple-style segmented controls filter by data category, source, and confidence. Changes the entire scene.",
    affects: "scene composition, filters",
    mode: "filter",
  },
  "zoom-pan": {
    label: "Zoom and Pan",
    description: "Focus on one large safety/risk scene with smooth zoom. The scene breathes as you focus.",
    affects: "stage focus, zoom",
    mode: "pan",
  },
  "linked-visualizations": {
    label: "Linked Visualizations / Brushing",
    description: "Selecting a value highlights related safety/workforce/risk metrics across all visible scenes with synchronized glow.",
    affects: "cross-layer illumination",
    mode: "linked",
  },
  "click-reveal": {
    label: "Click-to-Reveal",
    description: "Click reveals a cinematic insight callout attached to the scene. Not a generic drawer.",
    affects: "insight callout, scene panel",
    mode: "reveal",
  },
};

function methodName(methodId: string) {
  return METHOD_BEHAVIOR[methodId]?.label ?? methodId;
}

function methodDescription(methodId: string) {
  return METHOD_BEHAVIOR[methodId]?.description ?? "";
}

function MethodExplanationPanel({ methodId }: { methodId: string }) {
  const behavior = METHOD_BEHAVIOR[methodId];
  if (!behavior) return null;
  return (
    <div className="cinematic-method-callout">
      <p className="cinematic-method-affects">{behavior.affects}</p>
      <h3 className="cinematic-method-title">{behavior.label}</h3>
      <p className="cinematic-method-desc">{behavior.description}</p>
    </div>
  );
}

const SCENE_METHOD_CLASS: Record<string, string> = {
  "vector-displacement": "scene-fx-displacement",
  "chromatic-aberration": "scene-fx-chromatic",
  "geometric-anchor": "scene-fx-anchor",
  "subtractive-masking": "scene-fx-masking",
  "procedural-grid": "scene-fx-grid",
  "algorithmic-edge": "scene-fx-edge",
  "concentric-ripple": "scene-fx-ripple",
  "negative-space": "scene-fx-invert",
  "vector-lattice": "scene-fx-lattice",
  "color-shift": "scene-fx-colorshift",
  "synchronous-path": "scene-fx-synchronous",
  "vector-node": "scene-fx-node",
  "radiant-gradient": "scene-fx-radiant",
  "isometric-slice": "scene-fx-isometric",
  "semantic-zoom": "scene-fx-zoom",
  "holographic-depth": "scene-fx-holographic",
  "kinetic-vector": "scene-fx-kinetic",
  "contextual-morph": "scene-fx-morph",
  "interactive-filter": "scene-fx-filter",
  "zoom-pan": "scene-fx-pan",
  "linked-visualizations": "scene-fx-linked",
  "click-reveal": "scene-fx-reveal",
};

function sceneFxClass(method: string): string {
  return SCENE_METHOD_CLASS[method] ?? "";
}

function CinematicChart({
  chart,
  activeMethod,
  selectedCategory,
  activeSelection,
  onSelectCategory,
  onSelectDatum,
  height = 420,
}: {
  chart: ChartDefinition;
  activeMethod: string;
  selectedCategory: string | null;
  activeSelection: ChartDatumSelection | null;
  onSelectCategory: (category: string | null) => void;
  onSelectDatum: (selection: ChartDatumSelection) => void;
  height?: number;
}) {
  const isColorShift = activeMethod === "color-shift";
  const isLinkedBrushing = activeMethod === "linked-visualizations";
  const isRadiant = activeMethod === "radiant-gradient";
  const isChromatic = activeMethod === "chromatic-aberration";
  const isGeometricAnchor = activeMethod === "geometric-anchor";
  const isProceduralGrid = activeMethod === "procedural-grid";
  const isAlgorithmicEdge = activeMethod === "algorithmic-edge";
  const isConcentricRipple = activeMethod === "concentric-ripple";
  const isSubtractiveMasking = activeMethod === "subtractive-masking";
  const isPulse = activeMethod === "kinetic-vector";
  const isVectorDisplacement = activeMethod === "vector-displacement";
  const isSynchronousPath = activeMethod === "synchronous-path";
  const isDimmed = activeMethod === "negative-space";
  const isIsometric = activeMethod === "isometric-slice";

  const handleBarClick = (entry: any, seriesName: string, dataKey: string) => {
    const category = String(entry[chart.xKey] ?? entry.label ?? "");
    onSelectCategory(category);
    onSelectDatum({
      chartId: chart.id,
      chartTitle: chart.title,
      chartType: chart.type,
      category,
      seriesName,
      dataKey,
      value: Number(entry[dataKey] ?? 0),
      unit: entry.unit as string | undefined,
      formatter: chart.formatter,
      sourceId: entry.sourceId as string | undefined,
      note: entry.note as string | undefined,
      payload: entry as Record<string, string | number>,
      sourceUrl: (entry.sourceUrl as string | undefined) || undefined,
      confidence: (entry.confidence as string | undefined) || undefined,
      date: (entry.date as string | undefined) || undefined,
      sourceType: (entry.sourceType as string | undefined) || undefined,
      intelligenceCategory: (entry.category as string | undefined) || undefined,
      summary: (entry.summary as string | undefined) || undefined,
      rawSnippet: (entry.rawSnippet as string | undefined) || undefined,
    });
  };

  const handleScatterClick = (entry: any) => {
    const category = String(entry.name ?? entry[chart.xKey] ?? "");
    onSelectCategory(category);
    onSelectDatum({
      chartId: chart.id,
      chartTitle: chart.title,
      chartType: chart.type,
      category,
      seriesName: chart.series[0]?.name ?? "Data",
      dataKey: chart.series[0]?.dataKey ?? "x",
      value: Number(entry[chart.series[0]?.dataKey ?? "x"] ?? 0),
      unit: entry.unit as string | undefined,
      formatter: chart.formatter,
      sourceId: entry.sourceId as string | undefined,
      payload: entry as Record<string, string | number>,
      sourceUrl: (entry.sourceUrl as string | undefined) || undefined,
      confidence: (entry.confidence as string | undefined) || undefined,
      date: (entry.date as string | undefined) || undefined,
      sourceType: (entry.sourceType as string | undefined) || undefined,
      intelligenceCategory: (entry.category as string | undefined) || undefined,
      summary: (entry.summary as string | undefined) || undefined,
    });
  };

  const renderChart = () => {
    if (chart.type === "line") {
      return (
        <LineChart data={chart.data}>
          <CartesianGrid stroke={isProceduralGrid ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,.06)"} />
          <XAxis dataKey={chart.xKey} stroke="rgba(207,250,254,.35)" tick={{ fontSize: 10 }} />
          <YAxis stroke="rgba(207,250,254,.35)" tick={{ fontSize: 11 }} domain={chart.domain} tickFormatter={formatTickByType(chart.formatter)} />
          {chart.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          <Tooltip content={<LuminousChartTooltip formatter={chart.formatter ?? "plain"} headline={chart.headline ?? "data focus"} />} />
          {chart.referenceLines?.map((ref, i) => (
            <ReferenceLine key={i} y={ref.y} stroke={ref.stroke} strokeDasharray={ref.strokeDasharray} label={ref.label} />
          ))}
          {chart.series.map((s, i) => {
            const color = getSeriesColor(i, s.color);
            return (
              <Line key={s.dataKey} type="monotone" dataKey={s.dataKey} name={s.name ?? s.dataKey} stroke={color} strokeWidth={3}
                dot={(props: any) => {
                  const category = String(props.payload?.[chart.xKey] ?? props.payload?.label ?? "");
                  const isSelected = selectedCategory === category;
                  return (
                    <circle cx={props.cx} cy={props.cy} r={isSelected ? 7 : 4}
                      fill={isColorShift ? getColorByData(props.payload) : color}
                      stroke={isSelected ? "#ffffff" : color} strokeWidth={isSelected ? 3 : 2}
                      opacity={isRadiant && selectedCategory ? (isSelected ? 1 : 0.3) : selectedCategory && !isSelected ? 0.4 : 1}
                      className={[
                        isChromatic && isSelected ? "chromatic-dot" : "",
                        isAlgorithmicEdge && isSelected ? "algorithmic-edge-dot" : "",
                        isConcentricRipple && isSelected ? "ripple-origin-cell" : "",
                        isSubtractiveMasking && isSelected ? "mask-cutout-cell" : "",
                        isPulse && isSelected ? "pulse-bar" : "",
                      ].filter(Boolean).join(" ")}
                    />
                  );
                }}
                activeDot={{ r: 8, onClick: (_: any, entry: any) => handleBarClick(entry.payload, s.name ?? s.dataKey, s.dataKey) }}
                className={isSynchronousPath ? "synchronous-path-line" : ""}
              />
            );
          })}
        </LineChart>
      );
    }
    if (chart.type === "area") {
      return (
        <AreaChart data={chart.data}>
          <CartesianGrid stroke={isProceduralGrid ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,.06)"} />
          <XAxis dataKey={chart.xKey} stroke="rgba(207,250,254,.35)" tick={{ fontSize: 10 }} />
          <YAxis stroke="rgba(207,250,254,.35)" tick={{ fontSize: 11 }} domain={chart.domain} tickFormatter={formatTickByType(chart.formatter)} />
          {chart.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          <Tooltip content={<LuminousChartTooltip formatter={chart.formatter ?? "plain"} headline={chart.headline ?? "data focus"} />} />
          {chart.series.map((s, i) => {
            const color = getSeriesColor(i, s.color);
            return (
              <Area key={s.dataKey} type="monotone" dataKey={s.dataKey} name={s.name ?? s.dataKey} stroke={color} fill={`${color}3d`} strokeWidth={3}
                dot={(props: any) => {
                  const category = String(props.payload?.[chart.xKey] ?? props.payload?.label ?? "");
                  const isSelected = selectedCategory === category;
                  return (
                    <circle cx={props.cx} cy={props.cy} r={isSelected ? 6 : 3}
                      fill={isColorShift ? getColorByData(props.payload) : color}
                      stroke={isSelected ? "#ffffff" : color} strokeWidth={isSelected ? 2 : 1}
                      opacity={isRadiant && selectedCategory ? (isSelected ? 1 : 0.3) : selectedCategory && !isSelected ? 0.4 : 1}
                      className={[
                        isChromatic && isSelected ? "chromatic-dot" : "",
                        isAlgorithmicEdge && isSelected ? "algorithmic-edge-dot" : "",
                        isConcentricRipple && isSelected ? "ripple-origin-cell" : "",
                        isSubtractiveMasking && isSelected ? "mask-cutout-cell" : "",
                        isPulse && isSelected ? "pulse-bar" : "",
                      ].filter(Boolean).join(" ")}
                    />
                  );
                }}
                activeDot={{ r: 8, onClick: (_: any, entry: any) => handleBarClick(entry.payload, s.name ?? s.dataKey, s.dataKey) }}
                className={isAlgorithmicEdge ? "algorithmic-edge-area" : ""}
              />
            );
          })}
        </AreaChart>
      );
    }
    if (chart.type === "scatter") {
      const xDataKey = chart.series[0]?.dataKey ?? "x";
      const yDataKey = chart.series[1]?.dataKey ?? "y";
      return (
        <ScatterChart>
          <CartesianGrid stroke={isProceduralGrid ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,.06)"} />
          <XAxis dataKey={xDataKey} name={chart.series[0]?.name ?? "X"} stroke="rgba(207,250,254,.35)" tick={{ fontSize: 10 }} type="number" domain={[0, "auto"]} />
          <YAxis dataKey={yDataKey} name={chart.series[1]?.name ?? "Y"} stroke="rgba(207,250,254,.35)" tick={{ fontSize: 11 }} domain={chart.domain} type="number" />
          {chart.series.length > 2 && <ZAxis dataKey={chart.series[2]?.dataKey ?? "z"} range={[80, 520]} />}
          <Tooltip cursor={{ stroke: "rgba(34,211,238,.35)", strokeDasharray: "4 4" }} content={<LuminousChartTooltip headline={chart.headline ?? "data focus"} />} />
          <Scatter name="Data" data={chart.data} fill={chart.series[0]?.color ?? "#22d3ee"} onClick={handleScatterClick}
            shape={(props: any) => {
              const category = String(props.payload?.[chart.xKey] ?? props.payload?.name ?? "");
              const isSelected = selectedCategory === category;
              return (
                <circle cx={props.cx} cy={props.cy} r={isSelected ? 8 : 6}
                  fill={isColorShift ? getColorByData(props.payload) : chart.series[0]?.color ?? "#22d3ee"}
                  stroke={isSelected ? "#ffffff" : "rgba(255,255,255,0.2)"} strokeWidth={isSelected ? 3 : 1}
                  opacity={isRadiant && selectedCategory ? (isSelected ? 1 : 0.3) : selectedCategory && !isSelected ? 0.4 : 1}
                  className={[
                    isChromatic && isSelected ? "chromatic-dot" : "",
                    isAlgorithmicEdge && isSelected ? "algorithmic-edge-dot" : "",
                    isConcentricRipple && isSelected ? "ripple-origin-cell" : "",
                    isSubtractiveMasking && isSelected ? "mask-cutout-cell" : "",
                    isPulse && isSelected ? "pulse-bar" : "",
                  ].filter(Boolean).join(" ")}
                />
              );
            }}
          />
        </ScatterChart>
      );
    }
    return (
      <BarChart data={chart.data}>
        <CartesianGrid stroke={isProceduralGrid ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,.06)"} />
        <XAxis dataKey={chart.xKey} stroke="rgba(207,250,254,.35)" tick={{ fontSize: 10 }} />
        <YAxis stroke="rgba(207,250,254,.35)" tick={{ fontSize: 11 }} domain={chart.domain} tickFormatter={formatTickByType(chart.formatter)} />
        {chart.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        <Tooltip cursor={{ fill: "rgba(34,211,238,.06)" }} content={<LuminousChartTooltip formatter={chart.formatter ?? "plain"} headline={chart.headline ?? "data focus"} />} />
        {chart.referenceLines?.map((ref, i) => (
          <ReferenceLine key={i} y={ref.y} stroke={ref.stroke} strokeDasharray={ref.strokeDasharray} label={ref.label} />
        ))}
        {isGeometricAnchor && selectedCategory && (
          <>
            <ReferenceLine x={selectedCategory} stroke="rgba(34,211,238,0.65)" strokeDasharray="5 5" />
          </>
        )}
        {chart.series.map((s, i) => {
          const color = getSeriesColor(i, s.color);
          return (
            <Bar key={s.dataKey} dataKey={s.dataKey} name={s.name ?? s.dataKey} fill={color}
              radius={s.radius ?? [10, 10, 0, 0]} stackId={s.stackId}
              onClick={(_, index) => handleBarClick(chart.data[index], s.name ?? s.dataKey, s.dataKey)}>
              {chart.data.map((entry, idx) => {
                const category = String(entry[chart.xKey] ?? entry.label ?? "");
                const isSelected = selectedCategory === category;
                return (
                  <Cell key={`cell-${idx}`} fill={color}
                    opacity={isRadiant && selectedCategory ? (isSelected ? 1 : 0.3) : selectedCategory && !isSelected ? 0.4 : 1}
                    className={[
                      isSelected ? "selected-bar-cell" : "",
                      isLinkedBrushing && isSelected ? "linked-bar-cell" : "",
                      isChromatic && isSelected ? "chromatic-bar-cell" : "",
                      isIsometric && isSelected ? "isometric-bar-cell" : "",
                      isPulse && isSelected ? "pulse-bar" : "",
                      isVectorDisplacement && isSelected ? "vector-displace-cell" : "",
                      isAlgorithmicEdge && isSelected ? "algorithmic-edge-bar-cell" : "",
                      isSubtractiveMasking && isSelected ? "mask-cutout-cell" : "",
                      isConcentricRipple && isSelected ? "ripple-origin-cell" : "",
                    ].filter(Boolean).join(" ")}
                    style={{
                      transform: isVectorDisplacement && isSelected ? `translateX(${Math.min(24, Math.max(-24, (Number(entry.value ?? 0) / 50)))}px)` : undefined,
                      fill: isColorShift ? getColorByData(entry) : undefined,
                    }}
                  />
                );
              })}
            </Bar>
          );
        })}
      </BarChart>
    );
  };

  return (
    <div className="cinematic-chart-stage" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {renderChart() as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

function SceneHero({
  companyName,
  metricsCount,
  chartsCount,
  signalsCount,
  sourcesCount,
  intelligenceCount,
  feedLoading,
  primaryMetricLabel,
  primaryMetricValue,
  primaryMetricUnit,
  isStaticFallback,
  children,
}: {
  companyName: string;
  metricsCount: number;
  chartsCount: number;
  signalsCount: number;
  sourcesCount: number;
  intelligenceCount: number;
  feedLoading: boolean;
  primaryMetricLabel: string;
  primaryMetricValue: string;
  primaryMetricUnit: string;
  isStaticFallback: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const titleY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const bgBlur = useTransform(scrollYProgress, [0, 0.5, 1], [0, 4, 12]);
  const orbScale = useTransform(scrollYProgress, [0, 0.5, 1], [1, 1.3, 0.6]);
  const orbOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 0.5, 0]);

  return (
    <section ref={ref} className="cinematic-hero-section">
      <motion.div className="cinematic-hero-bg" style={{ scale: bgScale, filter: useTransform(bgBlur, (b) => `blur(${b}px)`) }} />
      <motion.div className="cinematic-hero-orb" style={{ scale: orbScale, opacity: orbOpacity }} />
      <motion.div className="cinematic-hero-content" style={{ y: titleY, opacity: titleOpacity }}>
        <motion.p
          className="cinematic-hero-eyebrow"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          Occupational Health & Safety Intelligence
        </motion.p>
        <motion.h1
          className="cinematic-hero-title"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.0, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {companyName}
        </motion.h1>
        <motion.div
          className="cinematic-hero-selector"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.7 }}
        >
          {children}
        </motion.div>
        <motion.div
          className="cinematic-hero-metrics"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
        >
          <motion.div
            className="cinematic-hero-primary-metric"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.85, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="cinematic-hero-primary-label">{primaryMetricLabel}</span>
            <span className="cinematic-hero-primary-value">{primaryMetricValue}<span className="cinematic-hero-primary-unit">{primaryMetricUnit}</span></span>
            {isStaticFallback && <span className="cinematic-hero-fallback-badge">Static profile data</span>}
          </motion.div>
          {[
            { label: "Safety Metrics", value: metricsCount },
            { label: "Charts", value: chartsCount },
            { label: "Signals", value: signalsCount },
            { label: "Sources", value: sourcesCount },
            { label: "Intelligence", value: intelligenceCount },
          ].map((m, i) => (
            <motion.div
              key={m.label}
              className="cinematic-hero-metric"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 1.0 + i * 0.1, ease: "easeOut" }}
            >
              <span className="cinematic-hero-metric-value">{m.value}</span>
              <span className="cinematic-hero-metric-label">{m.label}</span>
            </motion.div>
          ))}
        </motion.div>
        {feedLoading && (
          <motion.div
            className="cinematic-hero-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Activity size={14} className="animate-pulse" />
            <span>Loading live intelligence feed…</span>
          </motion.div>
        )}
      </motion.div>
      <motion.div
        className="cinematic-hero-scroll-hint"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8, duration: 0.8 }}
        style={{ opacity: useTransform(scrollYProgress, [0, 0.1], [1, 0]) }}
      >
        <span>Scroll to explore</span>
        <div className="cinematic-scroll-line" />
      </motion.div>
    </section>
  );
}

function SceneInjurySafety({
  charts,
  activeMethod,
  selectedCategory,
  activeSelection,
  onSelectCategory,
  onSelectDatum,
  fxClass,
}: {
  charts: ChartDefinition[];
  activeMethod: string;
  selectedCategory: string | null;
  activeSelection: ChartDatumSelection | null;
  onSelectCategory: (category: string | null) => void;
  onSelectDatum: (selection: ChartDatumSelection) => void;
  fxClass: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const headerY = useTransform(scrollYProgress, [0, 0.3], [60, 0]);
  const headerOpacity = useTransform(scrollYProgress, [0, 0.15, 0.3], [0, 1, 1]);

  const safetyKeywords = ["injury", "safety", "trir", "lwcr", "rate", "trend", "goal", "award", "nsc", "reserve", "claim", "dart", "emr"];
  const safetyCharts = charts.filter((c) =>
    safetyKeywords.some((kw) => c.title.toLowerCase().includes(kw))
  );
  const displayCharts = safetyCharts.length > 0 ? safetyCharts : charts.slice(0, 2);

  return (
    <section ref={ref} className={`cinematic-scene-section ${fxClass}`}>
      <div className="cinematic-scene-sticky">
        <motion.div style={{ y: headerY, opacity: headerOpacity }}>
          <p className="cinematic-scene-eyebrow">Scene 02</p>
          <h2 className="cinematic-scene-title">Injury & Safety Rate Stage</h2>
          <p className="cinematic-scene-subtitle">TRIR, LWCR, and safety award trends as large cinematic rate comparisons with masked reveal and depth.</p>
        </motion.div>
        <div className="cinematic-scene-stage">
          {displayCharts.length > 0 ? (
            displayCharts.map((chart, i) => (
              <motion.div
                key={chart.id}
                className="cinematic-chart-panel"
                initial={{ opacity: 0, y: 80 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="cinematic-chart-header">
                  <h3 className="cinematic-chart-title">{chart.title}</h3>
                  {chart.subtitle && <p className="cinematic-chart-subtitle">{chart.subtitle}</p>}
                </div>
                <CinematicChart
                  chart={chart}
                  activeMethod={activeMethod}
                  selectedCategory={selectedCategory}
                  activeSelection={activeSelection}
                  onSelectCategory={onSelectCategory}
                  onSelectDatum={onSelectDatum}
                  height={380}
                />
              </motion.div>
            ))
          ) : (
            <div className="cinematic-empty-stage">
              <p>No injury or safety rate data available for this company.</p>
              <p className="cinematic-empty-hint">Static profile metrics may still contain safety data — check the Workforce Exposure scene below.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function SceneWorkforceExposure({
  charts,
  metrics,
  activeMethod,
  selectedCategory,
  activeSelection,
  onSelectCategory,
  onSelectDatum,
  fxClass,
}: {
  charts: ChartDefinition[];
  metrics: MetricDefinition[];
  activeMethod: string;
  selectedCategory: string | null;
  activeSelection: ChartDatumSelection | null;
  onSelectCategory: (category: string | null) => void;
  onSelectDatum: (selection: ChartDatumSelection) => void;
  fxClass: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const headerY = useTransform(scrollYProgress, [0, 0.3], [60, 0]);
  const headerOpacity = useTransform(scrollYProgress, [0, 0.15, 0.3], [0, 1, 1]);

  const workforceKeywords = ["workforce", "employee", "exposure", "job", "signal", "claim", "workflow", "documentation", "return", "ime"];
  const workforceCharts = charts.filter((c) =>
    workforceKeywords.some((kw) => c.title.toLowerCase().includes(kw))
  );
  const exposureMetrics = metrics.filter((m) =>
    m.category === "workforce" || m.category === "safety" || m.category === "risk" || m.category === "financial"
  );
  const displayCharts = workforceCharts.length > 0 ? workforceCharts : charts.slice(0, 2);

  return (
    <section ref={ref} className={`cinematic-scene-section cinematic-scene-alt ${fxClass}`}>
      <div className="cinematic-scene-sticky">
        <motion.div style={{ y: headerY, opacity: headerOpacity }}>
          <p className="cinematic-scene-eyebrow">Scene 03</p>
          <h2 className="cinematic-scene-title">Workforce Exposure Stage</h2>
          <p className="cinematic-scene-subtitle">Workforce scale, exposure measures, and safety-to-workforce relationships as cinematic ribbons and depth layers.</p>
        </motion.div>
        {exposureMetrics.length > 0 && (
          <motion.div
            className="cinematic-metric-ribbons"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            {exposureMetrics.slice(0, 6).map((m, i) => (
              <motion.div
                key={m.id}
                className="cinematic-metric-ribbon"
                initial={{ opacity: 0, x: -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 + i * 0.1 }}
              >
                <span className="cinematic-ribbon-label">{m.label}</span>
                <span className="cinematic-ribbon-value">{formatValue(m.value, undefined, m.unit)}</span>
              </motion.div>
            ))}
          </motion.div>
        )}
        <div className="cinematic-scene-stage">
          {displayCharts.map((chart, i) => (
            <motion.div
              key={chart.id}
              className="cinematic-chart-panel"
              initial={{ opacity: 0, y: 80 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="cinematic-chart-header">
                <h3 className="cinematic-chart-title">{chart.title}</h3>
                {chart.subtitle && <p className="cinematic-chart-subtitle">{chart.subtitle}</p>}
              </div>
              <CinematicChart
                chart={chart}
                activeMethod={activeMethod}
                selectedCategory={selectedCategory}
                activeSelection={activeSelection}
                onSelectCategory={onSelectCategory}
                onSelectDatum={onSelectDatum}
                height={360}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SceneLocationNetwork({
  charts,
  activeMethod,
  selectedCategory,
  activeSelection,
  onSelectCategory,
  onSelectDatum,
  fxClass,
}: {
  charts: ChartDefinition[];
  activeMethod: string;
  selectedCategory: string | null;
  activeSelection: ChartDatumSelection | null;
  onSelectCategory: (category: string | null) => void;
  onSelectDatum: (selection: ChartDatumSelection) => void;
  fxClass: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const headerY = useTransform(scrollYProgress, [0, 0.3], [60, 0]);
  const headerOpacity = useTransform(scrollYProgress, [0, 0.15, 0.3], [0, 1, 1]);

  const locationCharts = charts.filter((c) =>
    c.title.toLowerCase().includes("location") || c.title.toLowerCase().includes("network") || c.title.toLowerCase().includes("region") || c.title.toLowerCase().includes("exposure") || c.title.toLowerCase().includes("gap")
  );
  const displayCharts = locationCharts.length > 0 ? locationCharts : charts.slice(0, 2);

  return (
    <section ref={ref} className={`cinematic-scene-section ${fxClass}`}>
      <div className="cinematic-scene-sticky">
        <motion.div style={{ y: headerY, opacity: headerOpacity }}>
          <p className="cinematic-scene-eyebrow">Scene 04</p>
          <h2 className="cinematic-scene-title">Geographic & Network Gap Stage</h2>
          <p className="cinematic-scene-subtitle">Provider network coverage gaps and geographic risk concentration as a luminous spatial field.</p>
        </motion.div>
        <div className="cinematic-scene-stage cinematic-spatial-grid">
          {displayCharts.length > 0 ? (
            displayCharts.map((chart, i) => (
              <motion.div
                key={chart.id}
                className="cinematic-chart-panel cinematic-spatial-panel"
                initial={{ opacity: 0, scale: 0.92 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.9, delay: i * 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="cinematic-chart-header">
                  <h3 className="cinematic-chart-title">{chart.title}</h3>
                  {chart.subtitle && <p className="cinematic-chart-subtitle">{chart.subtitle}</p>}
                </div>
                <CinematicChart
                  chart={chart}
                  activeMethod={activeMethod}
                  selectedCategory={selectedCategory}
                  activeSelection={activeSelection}
                  onSelectCategory={onSelectCategory}
                  onSelectDatum={onSelectDatum}
                  height={340}
                />
              </motion.div>
            ))
          ) : (
            <div className="cinematic-empty-stage">
              <p>No geographic or network gap data available for this company.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function SceneRiskMatrix({
  riskMatrix,
  opportunityMatrix,
  activeMethod,
  onSelectPoint,
  fxClass,
}: {
  riskMatrix: RiskMatrixPoint[];
  opportunityMatrix: OpportunityMatrixPoint[];
  activeMethod: string;
  onSelectPoint: (point: any) => void;
  fxClass: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const headerY = useTransform(scrollYProgress, [0, 0.3], [60, 0]);
  const headerOpacity = useTransform(scrollYProgress, [0, 0.15, 0.3], [0, 1, 1]);
  const [selectedPoint, setSelectedPoint] = useState<any | null>(null);
  const isColorShift = activeMethod === "color-shift";
  const isChromatic = activeMethod === "chromatic-aberration";
  const isIsometric = activeMethod === "isometric-slice";
  const isConcentricRipple = activeMethod === "concentric-ripple";
  const isSubtractiveMasking = activeMethod === "subtractive-masking";
  const isPulse = activeMethod === "kinetic-vector";
  const isAlgorithmicEdge = activeMethod === "algorithmic-edge";
  const isRadiant = activeMethod === "radiant-gradient";

  const renderMatrix = (data: any[], xKey: string, yKey: string, zKey: string, xLabel: string, yLabel: string, color: string) => {
    if (!data.length) return null;
    return (
      <div className="cinematic-matrix-stage">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            <CartesianGrid stroke="rgba(255,255,255,.06)" />
            <XAxis dataKey={xKey} name={xLabel} stroke="rgba(207,250,254,.35)" tick={{ fontSize: 10 }} type="number" domain={[0, "auto"]}>
              <Label value={xLabel} position="insideBottom" offset={-4} fill="rgba(207,250,254,0.55)" fontSize={11} />
            </XAxis>
            <YAxis dataKey={yKey} name={yLabel} stroke="rgba(207,250,254,.35)" tick={{ fontSize: 11 }} type="number" domain={[0, "auto"]}>
              <Label value={yLabel} angle={-90} position="insideLeft" fill="rgba(207,250,254,0.55)" fontSize={11} />
            </YAxis>
            <ZAxis dataKey={zKey} range={[100, 600]} />
            <Tooltip cursor={{ stroke: "rgba(34,211,238,.35)", strokeDasharray: "4 4" }} content={<LuminousChartTooltip formatter="plain" headline="Matrix" />} />
            <Scatter name="Data" data={data} fill={color}
              onClick={(entry: any, index: number) => { setSelectedPoint(data[index]); onSelectPoint(data[index]); }}
              shape={(props: any) => {
                const point = props.payload;
                const isSelected = selectedPoint && point === selectedPoint;
                return (
                  <g>
                    <circle cx={props.cx} cy={props.cy} r={isSelected ? 10 : 7}
                      fill={isColorShift ? getColorByData(point) : color}
                      stroke={isSelected ? "#ffffff" : "rgba(255,255,255,0.2)"} strokeWidth={isSelected ? 3 : 1}
                      opacity={isRadiant && selectedPoint ? (isSelected ? 1 : 0.3) : selectedPoint && !isSelected ? 0.4 : 1}
                      className={[
                        isChromatic && isSelected ? "chromatic-dot" : "",
                        isAlgorithmicEdge && isSelected ? "algorithmic-edge-dot" : "",
                        isConcentricRipple && isSelected ? "ripple-origin-cell" : "",
                        isSubtractiveMasking && isSelected ? "mask-cutout-cell" : "",
                        isPulse && isSelected ? "pulse-bar" : "",
                        isIsometric && isSelected ? "isometric-matrix-point" : "",
                      ].filter(Boolean).join(" ")}
                    />
                    {point?.name && (
                      <text x={props.cx} y={props.cy - (isSelected ? 14 : 11)} textAnchor="middle"
                        fill="rgba(207,250,254,0.8)" fontSize={isSelected ? 12 : 10} className="matrix-point-label">
                        {point.name}
                      </text>
                    )}
                  </g>
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <section ref={ref} className={`cinematic-scene-section cinematic-scene-alt ${fxClass}`}>
      <div className="cinematic-scene-sticky">
        <motion.div style={{ y: headerY, opacity: headerOpacity }}>
          <p className="cinematic-scene-eyebrow">Scene 05</p>
          <h2 className="cinematic-scene-title">Risk Matrix Stage</h2>
          <p className="cinematic-scene-subtitle">Occupational health risk and strategic opportunity plotted as floating points in a cinematic stage. Click to expand.</p>
        </motion.div>
        <div className="cinematic-matrix-grid">
          {riskMatrix.length > 0 && (
            <motion.div
              className="cinematic-chart-panel cinematic-matrix-panel"
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="cinematic-chart-header">
                <h3 className="cinematic-chart-title">Risk Matrix</h3>
                <p className="cinematic-chart-subtitle">Revenue exposure plotted against worker risk</p>
              </div>
              {renderMatrix(riskMatrix, "revenue", "risk", "workers", "Revenue ($M)", "Risk score", "#22d3ee")}
            </motion.div>
          )}
          {opportunityMatrix.length > 0 && (
            <motion.div
              className="cinematic-chart-panel cinematic-matrix-panel"
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="cinematic-chart-header">
                <h3 className="cinematic-chart-title">Opportunity Matrix</h3>
                <p className="cinematic-chart-subtitle">Strategic value plotted against implementation complexity</p>
              </div>
              {renderMatrix(opportunityMatrix, "revenuePotential", "implementationComplexity", "strategicValue", "Revenue potential", "Complexity", "#a78bfa")}
            </motion.div>
          )}
          {riskMatrix.length === 0 && opportunityMatrix.length === 0 && (
            <div className="cinematic-empty-stage">
              <p>No risk or opportunity matrix data available.</p>
            </div>
          )}
        </div>
        {selectedPoint && (
          <motion.div
            className="cinematic-matrix-narrative"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="cinematic-narrative-header">
              <h4>{selectedPoint.name ?? "Selected point"}</h4>
              <button onClick={() => setSelectedPoint(null)}>Close</button>
            </div>
            <div className="cinematic-narrative-body">
              {selectedPoint.revenue != null && <p><span>Revenue</span> {selectedPoint.revenue}</p>}
              {selectedPoint.risk != null && <p><span>Risk</span> {selectedPoint.risk}</p>}
              {selectedPoint.workers != null && <p><span>Workers</span> {selectedPoint.workers}</p>}
              {selectedPoint.revenuePotential != null && <p><span>Revenue Potential</span> {selectedPoint.revenuePotential}</p>}
              {selectedPoint.strategicValue != null && <p><span>Strategic Value</span> {selectedPoint.strategicValue}</p>}
              {selectedPoint.implementationComplexity != null && <p><span>Complexity</span> {selectedPoint.implementationComplexity}</p>}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}

function SceneEvidence({
  sources,
  facts,
  signals,
  fxClass,
  onSelectSignal,
}: {
  sources: any[];
  facts: IntelligenceFact[];
  signals: SignalDefinition[];
  fxClass: string;
  onSelectSignal: (signal: SignalDefinition) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const headerY = useTransform(scrollYProgress, [0, 0.3], [60, 0]);
  const headerOpacity = useTransform(scrollYProgress, [0, 0.15, 0.3], [0, 1, 1]);

  const liveFacts = facts.filter((f) => f.confidence !== "link-only");
  const linkOnlyFacts = facts.filter((f) => f.confidence === "link-only");
  const highConfidence = liveFacts.filter((f) => f.confidence === "high");
  const mediumConfidence = liveFacts.filter((f) => f.confidence === "medium");
  const lowConfidence = liveFacts.filter((f) => f.confidence === "low");

  return (
    <section ref={ref} className={`cinematic-scene-section ${fxClass}`}>
      <div className="cinematic-scene-sticky">
        <motion.div style={{ y: headerY, opacity: headerOpacity }}>
          <p className="cinematic-scene-eyebrow">Scene 06</p>
          <h2 className="cinematic-scene-title">Source Evidence Stage</h2>
          <p className="cinematic-scene-subtitle">Verified safety intelligence, source leads, and static profile references as layered glass panels supporting the risk story.</p>
        </motion.div>
        <div className="cinematic-evidence-layers">
          <motion.div
            className="cinematic-evidence-layer cinematic-evidence-verified"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="cinematic-evidence-header">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <h3>Verified Intelligence</h3>
              <span className="cinematic-evidence-count">{highConfidence.length}</span>
            </div>
            <div className="cinematic-evidence-items">
              {highConfidence.slice(0, 5).map((fact) => (
                <div key={fact.id} className="cinematic-evidence-item">
                  <p className="cinematic-evidence-title">{fact.title}</p>
                  <p className="cinematic-evidence-meta">{categoryLabel(fact.category)} — {fact.date}</p>
                </div>
              ))}
              {highConfidence.length === 0 && <p className="cinematic-evidence-empty">No verified facts yet. Run intelligence ingestion.</p>}
            </div>
          </motion.div>
          <motion.div
            className="cinematic-evidence-layer cinematic-evidence-medium"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="cinematic-evidence-header">
              <AlertTriangle size={16} className="text-amber-400" />
              <h3>Needs Review</h3>
              <span className="cinematic-evidence-count">{mediumConfidence.length + lowConfidence.length}</span>
            </div>
            <div className="cinematic-evidence-items">
              {[...mediumConfidence, ...lowConfidence].slice(0, 5).map((fact) => (
                <div key={fact.id} className="cinematic-evidence-item">
                  <p className="cinematic-evidence-title">{fact.title}</p>
                  <p className="cinematic-evidence-meta">{fact.confidence} — {fact.sourceType}</p>
                </div>
              ))}
              {mediumConfidence.length + lowConfidence.length === 0 && <p className="cinematic-evidence-empty">No items need review.</p>}
            </div>
          </motion.div>
          <motion.div
            className="cinematic-evidence-layer cinematic-evidence-leads"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="cinematic-evidence-header">
              <XCircle size={16} className="text-slate-400" />
              <h3>Source Leads</h3>
              <span className="cinematic-evidence-count">{linkOnlyFacts.length}</span>
            </div>
            <div className="cinematic-evidence-items">
              {linkOnlyFacts.slice(0, 5).map((fact) => (
                <div key={fact.id} className="cinematic-evidence-item">
                  <p className="cinematic-evidence-title">{fact.title}</p>
                  <p className="cinematic-evidence-meta">link-only — {fact.sourceType}</p>
                </div>
              ))}
              {linkOnlyFacts.length === 0 && <p className="cinematic-evidence-empty">No source leads.</p>}
            </div>
          </motion.div>
        </div>
        {signals.length > 0 && (
          <motion.div
            className="cinematic-signals-strip"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <p className="cinematic-scene-eyebrow">Executive Signals</p>
            <div className="cinematic-signals-row">
              {signals.slice(0, 4).map((signal, i) => (
                <button key={i} className="cinematic-signal-pill" onClick={() => onSelectSignal(signal)}>
                  <span className="cinematic-signal-dot" />
                  <span className="cinematic-signal-label">{signal.label}</span>
                  <span className="cinematic-signal-value">{signal.value}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}

function SceneVisualModes({
  activeMethod,
  onSelectMethod,
  dataCount,
  fxClass,
}: {
  activeMethod: string;
  onSelectMethod: (method: string) => void;
  dataCount: (methodId: string) => number;
  fxClass: string;
}) {
  const methods = [
    "vector-displacement", "chromatic-aberration", "geometric-anchor", "subtractive-masking",
    "procedural-grid", "algorithmic-edge", "concentric-ripple", "negative-space",
    "vector-lattice", "color-shift", "synchronous-path", "vector-node",
    "radiant-gradient", "isometric-slice", "semantic-zoom", "holographic-depth",
    "kinetic-vector", "contextual-morph", "interactive-filter", "zoom-pan",
    "linked-visualizations", "click-reveal",
  ];
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const headerY = useTransform(scrollYProgress, [0, 0.3], [60, 0]);
  const headerOpacity = useTransform(scrollYProgress, [0, 0.15, 0.3], [0, 1, 1]);

  return (
    <section ref={ref} className={`cinematic-scene-section cinematic-scene-alt ${fxClass}`}>
      <div className="cinematic-scene-sticky">
        <motion.div style={{ y: headerY, opacity: headerOpacity }}>
          <p className="cinematic-scene-eyebrow">Scene 07</p>
          <h2 className="cinematic-scene-title">Visual Modes</h2>
          <p className="cinematic-scene-subtitle">Twenty-two cinematic methods that transform the safety, workforce, and risk stage treatment.</p>
        </motion.div>
        <div className="cinematic-modes-grid">
          {methods.map((methodId, i) => (
            <motion.button
              key={methodId}
              className={`cinematic-mode-card ${activeMethod === methodId ? "cinematic-mode-active" : ""}`}
              onClick={() => onSelectMethod(methodId)}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: (i % 6) * 0.05 }}
              whileHover={{ scale: 1.03, y: -2 }}
            >
              <span className="cinematic-mode-number">{String(i + 1).padStart(2, "0")}</span>
              <span className="cinematic-mode-label">{methodName(methodId)}</span>
              <span className="cinematic-mode-count">{dataCount(methodId)}</span>
            </motion.button>
          ))}
        </div>
        {activeMethod !== "click-reveal" && (
          <MethodExplanationPanel methodId={activeMethod} />
        )}
      </div>
    </section>
  );
}

function StyleInjector() {
  return (
    <style>{`
      /* ===== CINEMATIC BASE ===== */
      .cinematic-hero-section {
        position: relative;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .cinematic-hero-bg {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(ellipse 80% 60% at 50% 40%, rgba(34,211,238,0.12), transparent 70%),
          radial-gradient(ellipse 60% 40% at 30% 70%, rgba(167,139,250,0.08), transparent 60%),
          radial-gradient(ellipse 50% 50% at 70% 30%, rgba(52,211,153,0.06), transparent 60%),
          linear-gradient(180deg, #030813 0%, #050d1a 50%, #030813 100%);
        z-index: 0;
      }
      .cinematic-hero-orb {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 600px;
        height: 600px;
        margin: -300px 0 0 -300px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(34,211,238,0.15), rgba(34,211,238,0.05) 40%, transparent 70%);
        filter: blur(40px);
        z-index: 1;
      }
      .cinematic-hero-content {
        position: relative;
        z-index: 2;
        text-align: center;
        max-width: 900px;
        padding: 0 2rem;
      }
      .cinematic-hero-eyebrow {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.3em;
        color: rgba(34,211,238,0.6);
        margin-bottom: 1.5rem;
      }
      .cinematic-hero-title {
        font-size: clamp(2.5rem, 8vw, 5.5rem);
        font-weight: 800;
        line-height: 1.05;
        letter-spacing: -0.03em;
        background: linear-gradient(135deg, #ffffff 0%, #22d3ee 50%, #a78bfa 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        margin-bottom: 2rem;
      }
      .cinematic-hero-selector {
        margin-bottom: 3rem;
      }
      .cinematic-hero-selector select {
        background: rgba(7,17,29,0.8);
        border: 1px solid rgba(34,211,238,0.2);
        border-radius: 9999px;
        padding: 0.75rem 2rem;
        color: rgba(207,250,254,0.9);
        font-size: 0.875rem;
        backdrop-filter: blur(20px);
        outline: none;
      }
      .cinematic-hero-metrics {
        display: flex;
        gap: 2rem;
        justify-content: center;
        flex-wrap: wrap;
      }
      .cinematic-hero-metric {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25rem;
      }
      .cinematic-hero-metric-value {
        font-size: 2rem;
        font-weight: 700;
        color: #22d3ee;
      }
      .cinematic-hero-metric-label {
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        color: rgba(207,250,254,0.4);
      }
      .cinematic-hero-primary-metric {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25rem;
        margin-bottom: 1.5rem;
        padding: 1.25rem 2rem;
        background: rgba(7,17,29,0.5);
        border: 1px solid rgba(34,211,238,0.15);
        border-radius: 20px;
        backdrop-filter: blur(20px);
      }
      .cinematic-hero-primary-label {
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 0.25em;
        color: rgba(207,250,254,0.5);
      }
      .cinematic-hero-primary-value {
        font-size: clamp(2rem, 5vw, 3.5rem);
        font-weight: 800;
        line-height: 1;
        background: linear-gradient(135deg, #22d3ee 0%, #34d399 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      .cinematic-hero-primary-unit {
        font-size: 0.875rem;
        font-weight: 400;
        color: rgba(207,250,254,0.4);
        -webkit-text-fill-color: rgba(207,250,254,0.4);
        margin-left: 0.35rem;
      }
      .cinematic-hero-fallback-badge {
        font-size: 0.6rem;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        color: rgba(251,191,36,0.6);
        border: 1px solid rgba(251,191,36,0.2);
        border-radius: 9999px;
        padding: 0.2rem 0.6rem;
        margin-top: 0.35rem;
      }
      .cinematic-hero-loading {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 1.5rem;
        font-size: 0.75rem;
        color: rgba(34,211,238,0.5);
        justify-content: center;
      }
      .cinematic-hero-scroll-hint {
        position: absolute;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);
        z-index: 3;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        color: rgba(207,250,254,0.35);
      }
      .cinematic-scroll-line {
        width: 1px;
        height: 40px;
        background: linear-gradient(180deg, rgba(34,211,238,0.5), transparent);
        animation: scroll-line-pulse 2s ease-in-out infinite;
      }
      @keyframes scroll-line-pulse {
        0%, 100% { opacity: 0.3; transform: scaleY(1); }
        50% { opacity: 1; transform: scaleY(1.3); }
      }

      /* ===== SCENE SECTIONS ===== */
      .cinematic-scene-section {
        position: relative;
        min-height: 100vh;
        padding: 4rem 0;
        overflow: hidden;
      }
      .cinematic-scene-alt {
        background: linear-gradient(180deg, rgba(5,13,26,0.6) 0%, rgba(3,8,19,0.9) 100%);
      }
      .cinematic-scene-sticky {
        position: sticky;
        top: 0;
        height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 2rem 3rem;
        max-width: 1400px;
        margin: 0 auto;
      }
      .cinematic-scene-eyebrow {
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 0.3em;
        color: rgba(34,211,238,0.4);
        margin-bottom: 0.75rem;
      }
      .cinematic-scene-title {
        font-size: clamp(1.75rem, 4vw, 3rem);
        font-weight: 700;
        line-height: 1.1;
        letter-spacing: -0.02em;
        color: #ffffff;
        margin-bottom: 0.75rem;
      }
      .cinematic-scene-subtitle {
        font-size: 0.875rem;
        color: rgba(207,250,254,0.5);
        max-width: 600px;
        line-height: 1.6;
        margin-bottom: 2rem;
      }

      /* ===== CHART PANELS ===== */
      .cinematic-scene-stage {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: 1.5rem;
      }
      .cinematic-chart-panel {
        background: rgba(7,17,29,0.6);
        border: 1px solid rgba(34,211,238,0.1);
        border-radius: 24px;
        padding: 1.5rem;
        backdrop-filter: blur(20px);
        transition: border-color 0.4s ease, box-shadow 0.4s ease;
      }
      .cinematic-chart-panel:hover {
        border-color: rgba(34,211,238,0.25);
        box-shadow: 0 0 40px rgba(34,211,238,0.08);
      }
      .cinematic-chart-header {
        margin-bottom: 1rem;
      }
      .cinematic-chart-title {
        font-size: 1.125rem;
        font-weight: 600;
        color: #ffffff;
      }
      .cinematic-chart-subtitle {
        font-size: 0.75rem;
        color: rgba(207,250,254,0.4);
        margin-top: 0.25rem;
      }
      .cinematic-chart-stage {
        width: 100%;
      }
      .cinematic-empty-stage {
        grid-column: 1 / -1;
        text-align: center;
        padding: 3rem;
        color: rgba(207,250,254,0.35);
      }
      .cinematic-empty-hint {
        font-size: 0.75rem;
        color: rgba(207,250,254,0.25);
        margin-top: 0.5rem;
      }

      /* ===== METRIC RIBBONS ===== */
      .cinematic-metric-ribbons {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 1.5rem;
      }
      .cinematic-metric-ribbon {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1.5rem;
        background: linear-gradient(90deg, rgba(34,211,238,0.08), transparent);
        border-left: 2px solid rgba(34,211,238,0.4);
        border-radius: 0 12px 12px 0;
      }
      .cinematic-ribbon-label {
        font-size: 0.8rem;
        color: rgba(207,250,254,0.7);
      }
      .cinematic-ribbon-value {
        font-size: 1.25rem;
        font-weight: 700;
        color: #22d3ee;
      }

      /* ===== SPATIAL GRID ===== */
      .cinematic-spatial-grid {
        grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      }
      .cinematic-spatial-panel {
        background: linear-gradient(135deg, rgba(163,230,53,0.04), rgba(7,17,29,0.6));
      }

      /* ===== MATRIX ===== */
      .cinematic-matrix-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: 1.5rem;
      }
      .cinematic-matrix-panel {
        background: linear-gradient(135deg, rgba(34,211,238,0.04), rgba(7,17,29,0.6));
      }
      .cinematic-matrix-stage {
        width: 100%;
        height: 380px;
      }
      .cinematic-matrix-narrative {
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        width: 320px;
        background: rgba(3,8,19,0.95);
        border: 1px solid rgba(34,211,238,0.2);
        border-radius: 20px;
        padding: 1.5rem;
        backdrop-filter: blur(24px);
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        z-index: 40;
      }
      .cinematic-narrative-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
      }
      .cinematic-narrative-header h4 {
        font-size: 1rem;
        font-weight: 600;
        color: #fff;
      }
      .cinematic-narrative-header button {
        font-size: 0.7rem;
        color: rgba(207,250,254,0.5);
        background: none;
        border: none;
        cursor: pointer;
      }
      .cinematic-narrative-body p {
        font-size: 0.8rem;
        color: rgba(207,250,254,0.7);
        margin-bottom: 0.5rem;
      }
      .cinematic-narrative-body p span {
        color: rgba(207,250,254,0.4);
        margin-right: 0.5rem;
      }

      /* ===== EVIDENCE ===== */
      .cinematic-evidence-layers {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1rem;
      }
      .cinematic-evidence-layer {
        border-radius: 20px;
        padding: 1.25rem;
        backdrop-filter: blur(16px);
        border: 1px solid rgba(255,255,255,0.06);
      }
      .cinematic-evidence-verified {
        background: linear-gradient(135deg, rgba(52,211,153,0.08), rgba(7,17,29,0.6));
        border-color: rgba(52,211,153,0.15);
      }
      .cinematic-evidence-medium {
        background: linear-gradient(135deg, rgba(251,191,36,0.08), rgba(7,17,29,0.6));
        border-color: rgba(251,191,36,0.15);
      }
      .cinematic-evidence-leads {
        background: linear-gradient(135deg, rgba(148,163,184,0.08), rgba(7,17,29,0.6));
        border-color: rgba(148,163,184,0.12);
      }
      .cinematic-evidence-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1rem;
      }
      .cinematic-evidence-header h3 {
        font-size: 0.875rem;
        font-weight: 600;
        color: #fff;
        flex: 1;
      }
      .cinematic-evidence-count {
        font-size: 0.75rem;
        font-weight: 700;
        color: rgba(34,211,238,0.6);
        background: rgba(34,211,238,0.08);
        padding: 0.15rem 0.5rem;
        border-radius: 9999px;
      }
      .cinematic-evidence-items {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .cinematic-evidence-item {
        padding: 0.5rem 0;
        border-bottom: 1px solid rgba(255,255,255,0.04);
      }
      .cinematic-evidence-title {
        font-size: 0.75rem;
        font-weight: 500;
        color: rgba(207,250,254,0.8);
      }
      .cinematic-evidence-meta {
        font-size: 0.65rem;
        color: rgba(207,250,254,0.35);
        margin-top: 0.15rem;
      }
      .cinematic-evidence-empty {
        font-size: 0.7rem;
        color: rgba(207,250,254,0.3);
        padding: 0.5rem 0;
      }

      /* ===== SIGNALS ===== */
      .cinematic-signals-strip {
        margin-top: 2rem;
      }
      .cinematic-signals-row {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }
      .cinematic-signal-pill {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        background: rgba(34,211,238,0.06);
        border: 1px solid rgba(34,211,238,0.12);
        border-radius: 9999px;
        cursor: pointer;
        transition: all 0.3s ease;
      }
      .cinematic-signal-pill:hover {
        background: rgba(34,211,238,0.12);
        border-color: rgba(34,211,238,0.25);
      }
      .cinematic-signal-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #34d399;
      }
      .cinematic-signal-label {
        font-size: 0.7rem;
        color: rgba(207,250,254,0.7);
      }
      .cinematic-signal-value {
        font-size: 0.7rem;
        font-weight: 600;
        color: rgba(34,211,238,0.7);
      }

      /* ===== VISUAL MODES ===== */
      .cinematic-modes-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 0.75rem;
      }
      .cinematic-mode-card {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.25rem;
        padding: 1rem;
        background: rgba(7,17,29,0.6);
        border: 1px solid rgba(34,211,238,0.08);
        border-radius: 16px;
        cursor: pointer;
        transition: all 0.3s ease;
        text-align: left;
      }
      .cinematic-mode-card:hover {
        border-color: rgba(34,211,238,0.2);
        background: rgba(34,211,238,0.04);
      }
      .cinematic-mode-active {
        border-color: rgba(34,211,238,0.4) !important;
        background: rgba(34,211,238,0.08) !important;
        box-shadow: 0 0 24px rgba(34,211,238,0.12);
      }
      .cinematic-mode-number {
        font-size: 0.6rem;
        font-weight: 700;
        color: rgba(34,211,238,0.4);
        letter-spacing: 0.1em;
      }
      .cinematic-mode-label {
        font-size: 0.75rem;
        font-weight: 500;
        color: rgba(207,250,254,0.8);
        line-height: 1.3;
      }
      .cinematic-mode-count {
        font-size: 0.6rem;
        color: rgba(207,250,254,0.3);
      }

      /* ===== METHOD CALLOUT ===== */
      .cinematic-method-callout {
        margin-top: 1.5rem;
        padding: 1.25rem;
        background: rgba(34,211,238,0.04);
        border: 1px solid rgba(34,211,238,0.12);
        border-radius: 16px;
      }
      .cinematic-method-affects {
        font-size: 0.6rem;
        text-transform: uppercase;
        letter-spacing: 0.25em;
        color: rgba(34,211,238,0.4);
      }
      .cinematic-method-title {
        font-size: 0.875rem;
        font-weight: 600;
        color: #fff;
        margin-top: 0.25rem;
      }
      .cinematic-method-desc {
        font-size: 0.75rem;
        color: rgba(207,250,254,0.55);
        line-height: 1.6;
        margin-top: 0.5rem;
      }

      /* ===== DATA SOURCE BAR ===== */
      .cinematic-data-source-bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        background: rgba(7,17,29,0.5);
        border: 1px solid rgba(34,211,238,0.08);
        border-radius: 12px;
        margin-bottom: 1rem;
        backdrop-filter: blur(12px);
      }
      .cinematic-source-btn {
        padding: 0.4rem 0.75rem;
        border-radius: 8px;
        font-size: 0.7rem;
        font-weight: 600;
        border: 1px solid transparent;
        cursor: pointer;
        transition: all 0.3s ease;
        background: transparent;
        color: rgba(207,250,254,0.4);
      }
      .cinematic-source-btn:hover {
        color: rgba(207,250,254,0.7);
        border-color: rgba(34,211,238,0.15);
      }
      .cinematic-source-btn-active {
        background: rgba(34,211,238,0.1);
        border-color: rgba(34,211,238,0.3);
        color: rgba(207,250,254,0.9);
      }

      /* ===== SCENE FX CLASSES ===== */
      .scene-fx-displacement .cinematic-chart-panel { perspective: 800px; }
      .scene-fx-displacement .cinematic-chart-stage { transform-style: preserve-3d; transition: transform 0.6s cubic-bezier(0.22,1,0.36,1); }
      .scene-fx-chromatic .cinematic-chart-panel { box-shadow: 0 0 24px rgba(239,68,68,0.08), 0 0 24px rgba(6,182,212,0.08); }
      .scene-fx-anchor .cinematic-chart-stage::before {
        content: ''; position: absolute; inset: 0;
        background: linear-gradient(90deg, transparent 49.5%, rgba(34,211,238,0.15) 49.5%, rgba(34,211,238,0.15) 50.5%, transparent 50.5%),
                    linear-gradient(0deg, transparent 49.5%, rgba(34,211,238,0.15) 49.5%, rgba(34,211,238,0.15) 50.5%, transparent 50.5%);
        opacity: 0.4; pointer-events: none;
      }
      .scene-fx-masking .cinematic-chart-panel { position: relative; }
      .scene-fx-masking .cinematic-chart-panel::after {
        content: ''; position: absolute; inset: 0;
        background: radial-gradient(circle at 50% 50%, transparent 0%, rgba(0,0,0,0.4) 70%);
        pointer-events: none; border-radius: 24px;
      }
      .scene-fx-grid .cinematic-chart-panel { background-image: linear-gradient(rgba(34,211,238,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.03) 1px, transparent 1px); background-size: 30px 30px; }
      .scene-fx-edge .cinematic-chart-panel { animation: edge-glow 3s ease-in-out infinite; }
      @keyframes edge-glow { 0%,100% { box-shadow: 0 0 0 rgba(34,211,238,0); } 50% { box-shadow: 0 0 20px rgba(34,211,238,0.15); } }
      .scene-fx-ripple .cinematic-chart-panel { animation: ripple-bg 2s ease-out infinite; }
      @keyframes ripple-bg { 0% { box-shadow: 0 0 0 rgba(34,211,238,0); } 50% { box-shadow: 0 0 30px rgba(34,211,238,0.1); } 100% { box-shadow: 0 0 0 rgba(34,211,238,0); } }
      .scene-fx-invert .cinematic-chart-panel { filter: invert(0.05) hue-rotate(10deg); }
      .scene-fx-lattice .cinematic-chart-panel { background-image: linear-gradient(rgba(34,211,238,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.04) 1px, transparent 1px); background-size: 20px 20px; animation: lattice-warp 4s ease-in-out infinite; }
      @keyframes lattice-warp { 0%,100% { transform: scale(1); } 50% { transform: scale(1.01); } }
      .scene-fx-colorshift .cinematic-chart-panel { transition: background 0.6s ease; }
      .scene-fx-synchronous .cinematic-chart-panel { box-shadow: 0 0 16px rgba(34,211,238,0.06); }
      .scene-fx-node .cinematic-chart-panel { transition: transform 0.5s cubic-bezier(0.22,1,0.36,1); }
      .scene-fx-radiant .cinematic-chart-panel { background: radial-gradient(circle at 50% 50%, rgba(34,211,238,0.04), rgba(7,17,29,0.6) 70%); }
      .scene-fx-isometric .cinematic-chart-panel { transform: translateY(-4px) rotateX(1deg); box-shadow: 6px 6px 0 rgba(34,211,238,0.1); }
      .scene-fx-zoom .cinematic-chart-panel { transition: transform 0.6s cubic-bezier(0.22,1,0.36,1); }
      .scene-fx-holographic .cinematic-chart-panel { border-style: solid; border-width: 1px; }
      .scene-fx-kinetic .cinematic-chart-panel { animation: kinetic-snap 0.6s cubic-bezier(0.22,1,0.36,1) both; }
      @keyframes kinetic-snap { 0% { transform: translateY(12px) scale(0.98); opacity: 0.7; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
      .scene-fx-morph .cinematic-chart-stage { transition: opacity 0.5s ease; }
      .scene-fx-filter .cinematic-chart-panel { transition: opacity 0.4s ease, transform 0.4s ease; }
      .scene-fx-pan .cinematic-chart-panel { transition: transform 0.5s cubic-bezier(0.22,1,0.36,1); }
      .scene-fx-linked .cinematic-chart-panel { box-shadow: 0 0 12px rgba(250,204,21,0.04); }
      .scene-fx-reveal .cinematic-chart-panel { transition: all 0.4s ease; }

      /* ===== LEGACY CHART FX (preserved for chart elements) ===== */
      .selected-bar-cell {
        stroke: rgba(255, 255, 255, 0.95) !important;
        stroke-width: 3px !important;
        filter: drop-shadow(0 0 8px rgba(34, 211, 238, 0.85)) drop-shadow(0 0 16px rgba(34, 211, 238, 0.45));
        opacity: 1 !important;
      }
      .linked-bar-cell {
        stroke: rgba(250, 204, 21, 1) !important;
        stroke-width: 3px !important;
        filter: drop-shadow(0 0 10px rgba(250, 204, 21, 0.8));
        opacity: 1 !important;
      }
      .chromatic-bar-cell {
        filter: drop-shadow(2px 0 0 rgba(239, 68, 68, 0.9)) drop-shadow(-2px 0 0 rgba(6, 182, 212, 0.9)) drop-shadow(0 0 6px rgba(34, 211, 238, 0.6));
      }
      .isometric-bar-cell {
        transform: translateY(-5px);
        filter: drop-shadow(5px 5px 0 rgba(34, 211, 238, 0.35)) drop-shadow(0 0 8px rgba(34, 211, 238, 0.5));
      }
      .isometric-matrix-point {
        transform: translateY(-6px);
        filter: drop-shadow(4px 4px 0 rgba(34, 211, 238, 0.3)) drop-shadow(0 0 6px rgba(34, 211, 238, 0.4));
      }
      .pulse-bar {
        animation: pulse-bar-anim 1.2s ease-in-out 2;
      }
      @keyframes pulse-bar-anim {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.55; }
      }
      .synchronous-path-line path.recharts-line-curve {
        filter: drop-shadow(0 0 8px rgba(34, 211, 238, 0.85));
        stroke-dasharray: 12 1000;
        animation: path-sweep 2.5s linear infinite;
      }
      @keyframes path-sweep {
        0% { stroke-dashoffset: 1000; }
        100% { stroke-dashoffset: 0; }
      }
      .chromatic-dot {
        filter: drop-shadow(2px 0 0 rgba(239, 68, 68, 0.9)) drop-shadow(-2px 0 0 rgba(6, 182, 212, 0.9));
      }
      .matrix-quadrant-label {
        font-size: 10px;
        fill: rgba(207, 250, 254, 0.55);
      }
      .algorithmic-edge-bar-cell {
        stroke: rgba(255, 255, 255, 0.9);
        stroke-width: 2px;
        stroke-dasharray: 200;
        stroke-dashoffset: 0;
        animation: edge-trace 1.5s ease-in-out infinite;
      }
      .algorithmic-edge-dot {
        stroke: rgba(255, 255, 255, 0.95);
        stroke-width: 2px;
        animation: edge-dot-pulse 1.2s ease-in-out infinite;
      }
      @keyframes edge-dot-pulse {
        0%, 100% { stroke-width: 2px; }
        50% { stroke-width: 4px; }
      }
      @keyframes edge-trace {
        0% { stroke-dashoffset: 200; }
        100% { stroke-dashoffset: 0; }
      }
      .algorithmic-edge-area path.recharts-area-area {
        animation: edge-trace 2s ease-in-out infinite;
      }
      .color-shift-panel .recharts-bar-rectangle path {
        transition: fill 0.5s ease;
      }
      .vector-displace-cell {
        transform-box: fill-box;
        transform-origin: center;
      }
      .ripple-origin-cell {
        animation: ripple-origin-pulse 1.4s ease-out infinite;
      }
      @keyframes ripple-origin-pulse {
        0% { filter: drop-shadow(0 0 0 rgba(34, 211, 238, 0.9)); }
        70% { filter: drop-shadow(0 0 18px rgba(34, 211, 238, 0.3)); }
        100% { filter: drop-shadow(0 0 0 rgba(34, 211, 238, 0)); }
      }
      .mask-cutout-cell {
        fill: rgba(15, 23, 42, 0.85) !important;
        stroke: rgba(34, 211, 238, 0.8) !important;
        stroke-width: 2px !important;
        stroke-dasharray: 6 4;
      }
      .matrix-point-label {
        font-size: 10px;
        fill: rgba(207, 250, 254, 0.65);
      }
    `}</style>
  );
}

export default function DataVisualization() {
  const { dataset } = useInsightData();
  const { companyId, setCompanyId, company } = useSelectedCompany(dataset.companies);
  const resolvedCompanyId = resolveConfigCompanyId(companyId);
  const config = getCompanyConfigOrDefault(resolvedCompanyId);
  const status = getIntelligenceStatus(config);
  const sources = dataset.sources.filter((source) => resolveConfigCompanyId(source.companyId) === resolvedCompanyId);
  const intelligence = dataset.intelligence.find((item) => resolveConfigCompanyId(item.companyId) === resolvedCompanyId);

  const [activeMethod, setActiveMethod] = useState<string>("click-reveal");
  const [activeSelection, setActiveSelection] = useState<ChartDatumSelection | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [localIntelligence, setLocalIntelligence] = useState<CompanyIntelligence | undefined>(undefined);
  const [feedMode, setFeedMode] = useState<"combined" | "static" | "live">("combined");
  const [feed, setFeed] = useState<DataVisualizationFeed | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterConfidence, setFilterConfidence] = useState<string>("all");
  const [filterSourceType, setFilterSourceType] = useState<string>("all");
  const [filterDateRange, setFilterDateRange] = useState<string>("all");
  const [morphMode, setMorphMode] = useState<"category" | "sourceType" | "confidence" | "time">("category");

  useEffect(() => {
    if (feedMode === "static") { setFeed(null); return; }
    if (!company?.name) { setFeed(null); return; }
    const hq = company.headquarters ?? "";
    const stateMatch = hq.match(/,\s*([A-Za-z ]+)$/);
    const state = stateMatch ? stateMatch[1].trim() : undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      setFeedLoading(true); setFeedError(null);
      fetchVisualizationFeed({ company: company.name, state })
        .then((result) => { if (!cancelled) setFeed(result); })
        .catch((err) => { if (!cancelled) setFeedError(err instanceof Error ? err.message : "Feed fetch failed"); })
        .finally(() => { if (!cancelled) setFeedLoading(false); });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [feedMode, company?.name, company?.headquarters]);

  const feedCharts = useMemo(() => feed ? feedChartsToChartDefinitions(feed.charts) : [], [feed]);
  const feedFacts = useMemo(() => feed ? feedFactsToIntelligenceFacts(feed.facts) : [], [feed]);
  const feedIntelligence: CompanyIntelligence | undefined = useMemo(() => {
    if (!feed || feedFacts.length === 0) return undefined;
    return { companyId: "feed", facts: feedFacts, runs: [], chartReady: { awardValueTimeline: [], opportunitiesByStage: [], sourceConfidenceOverTime: [], jobSignalTrend: [], eventTimeline: [], locationExposureByRegion: [], networkGapScoreByRegion: [] } };
  }, [feed, feedFacts]);

  const effectiveIntelligence = localIntelligence ?? intelligence;
  const mergedFacts = useMemo(() => [...(effectiveIntelligence?.facts ?? []), ...feedFacts], [effectiveIntelligence, feedFacts]);
  const mergedIntelligence: CompanyIntelligence | undefined = useMemo(() => {
    if (mergedFacts.length === 0) return effectiveIntelligence;
    return { companyId: effectiveIntelligence?.companyId ?? "merged", facts: mergedFacts, runs: effectiveIntelligence?.runs ?? [], chartReady: effectiveIntelligence?.chartReady ?? { awardValueTimeline: [], opportunitiesByStage: [], sourceConfidenceOverTime: [], jobSignalTrend: [], eventTimeline: [], locationExposureByRegion: [], networkGapScoreByRegion: [] } };
  }, [mergedFacts, effectiveIntelligence]);

  const intelligenceCharts = useMemo(() => {
    const base = intelligenceFactsToCharts(mergedIntelligence);
    if (feedMode === "live") return [...feedCharts];
    if (feedMode === "combined") return [...base, ...feedCharts];
    return base;
  }, [mergedIntelligence, feedCharts, feedMode]);

  const vizModel = buildProfileVisualizationModel({
    company,
    config,
    metrics: dataset.metrics.filter((metric) => resolveConfigCompanyId(metric.companyId) === resolvedCompanyId),
    sources,
  });

  const { primaryCharts } = useChartPanels(vizModel);

  const filteredIntelligenceCharts = useMemo(() => {
    if (activeMethod === "interactive-filter") {
      return filterIntelligenceCharts(intelligenceCharts, mergedIntelligence?.facts ?? [], filterCategory, filterConfidence, filterSourceType, filterDateRange);
    }
    return intelligenceCharts;
  }, [activeMethod, intelligenceCharts, mergedIntelligence, filterCategory, filterConfidence, filterSourceType, filterDateRange]);

  const morphedChart = useMemo(() => {
    if (activeMethod === "contextual-morph" && mergedIntelligence && mergedIntelligence.facts.length > 0) {
      return morphIntelligenceFacts(mergedIntelligence.facts, morphMode);
    }
    return null;
  }, [activeMethod, mergedIntelligence, morphMode]);

  const allCharts = useMemo(() => {
    if (activeMethod === "contextual-morph" && morphedChart) return [morphedChart];
    if (feedMode === "live") return filteredIntelligenceCharts;
    return [...primaryCharts, ...filteredIntelligenceCharts];
  }, [primaryCharts, filteredIntelligenceCharts, activeMethod, morphedChart, feedMode]);

  const handleSelectDatum = (selection: ChartDatumSelection) => { setActiveSelection(selection); setDetailDrawerOpen(true); };
  const handleSelectCategory = (category: string | null) => { setSelectedCategory((prev) => (prev === category ? null : category)); };
  const handleSelectSignal = (signal: SignalDefinition) => {
    setActiveSelection({ chartId: "signal", chartTitle: "Executive Signal", chartType: "signal", category: signal.label, seriesName: "Signal", dataKey: "value", value: 0, note: signal.note, payload: signal as unknown as Record<string, string | number> });
    setDetailDrawerOpen(true);
  };
  const handleMatrixPoint = (point: any) => {
    setActiveSelection({ chartId: "matrix", chartTitle: "Risk / Opportunity Matrix", chartType: "scatter", category: point.name, seriesName: "Matrix point", dataKey: "name", value: point.revenue ?? point.revenuePotential ?? 0, note: `Risk: ${point.risk ?? "N/A"}, Workers: ${point.workers ?? "N/A"}`, payload: point });
    setDetailDrawerOpen(true);
  };

  const visualizationMethods = [
    "vector-displacement", "chromatic-aberration", "geometric-anchor", "subtractive-masking",
    "procedural-grid", "algorithmic-edge", "concentric-ripple", "negative-space",
    "vector-lattice", "color-shift", "synchronous-path", "vector-node",
    "radiant-gradient", "isometric-slice", "semantic-zoom", "holographic-depth",
    "kinetic-vector", "contextual-morph", "interactive-filter", "zoom-pan",
    "linked-visualizations", "click-reveal",
  ];

  const getMethodDataCount = (methodId: string) => {
    if (methodId === "click-reveal") return activeSelection ? 1 : 0;
    if (methodId === "semantic-zoom") return vizModel.metrics.length + vizModel.signals.length;
    return primaryCharts.length + vizModel.riskMatrix.length + vizModel.opportunityMatrix.length;
  };

  const safetyMetrics = vizModel.metrics.filter((m) => m.category === "safety");
  const riskMetrics = vizModel.metrics.filter((m) => m.category === "risk");
  const workforceMetrics = vizModel.metrics.filter((m) => m.category === "workforce");
  const primaryMetric = safetyMetrics[0] ?? riskMetrics[0] ?? workforceMetrics[0] ?? vizModel.metrics[0];
  const isStaticFallback = !mergedIntelligence || mergedIntelligence.facts.length === 0;
  const primaryMetricLabel = primaryMetric ? primaryMetric.label : "No metrics available";
  const primaryMetricValue = primaryMetric ? formatValue(primaryMetric.value, undefined, primaryMetric.unit) : "—";
  const primaryMetricUnit = primaryMetric && primaryMetric.unit ? metricUnitLabel(primaryMetric.unit) : "";

  const insightContext = {
    companyName: company?.name ?? resolvedCompanyId,
    intelligence: mergedIntelligence,
    sourceRecords: vizModel.sourceRecords,
    signals: vizModel.signals,
    dossierSections: vizModel.dossierSections,
    metrics: vizModel.metrics,
    riskMatrix: vizModel.riskMatrix,
    opportunityMatrix: vizModel.opportunityMatrix,
  };

  const fxClass = sceneFxClass(activeMethod);

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 lg:ml-[210px]">
        {/* Data Source Selector — floating bar */}
        <div className="cinematic-data-source-bar" style={{ position: "sticky", top: 0, zIndex: 30, margin: 0, borderRadius: 0, borderLeft: "none", borderRight: "none" }}>
          <span className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/60">Data Source:</span>
          {([
            { id: "combined" as const, label: "Combined View" },
            { id: "static" as const, label: "Static Profile Data" },
            { id: "live" as const, label: "Live Intelligence Feed" },
          ]).map((mode) => (
            <button
              key={mode.id}
              onClick={() => setFeedMode(mode.id)}
              className={`cinematic-source-btn ${feedMode === mode.id ? "cinematic-source-btn-active" : ""}`}
            >
              {mode.label}
            </button>
          ))}
          {feedLoading && (
            <span className="inline-flex items-center gap-1.5 text-xs text-cyan-100/50">
              <Activity size={12} className="animate-pulse" /> Loading feed...
            </span>
          )}
          {feedError && <span className="text-xs text-amber-100/70">Feed error: {feedError}</span>}
          {feed && (
            <span className="ml-auto text-[10px] text-cyan-100/40">
              {feed.charts.length} feed charts · {feed.facts.length} facts · {feed.sourceRecords.length} sources
            </span>
          )}
        </div>

        {/* Intelligence Overview — compact, above scenes */}
        <div style={{ padding: "1rem 3rem" }}>
          <IntelligenceOverview
            companyName={company?.name ?? resolvedCompanyId}
            companyId={resolvedCompanyId}
            intelligence={mergedIntelligence}
            onIngestComplete={(intel) => setLocalIntelligence(intel)}
          />
        </div>

        {/* ===== CINEMATIC SCENES ===== */}

        {/* Scene 1 — Safety Intelligence Hero */}
        <SceneHero
          companyName={company?.name ?? resolvedCompanyId}
          metricsCount={vizModel.metrics.length}
          chartsCount={vizModel.charts.length}
          signalsCount={vizModel.signals.length}
          sourcesCount={vizModel.sourceRecords.length}
          intelligenceCount={intelligenceCharts.length}
          feedLoading={feedLoading}
          primaryMetricLabel={primaryMetricLabel}
          primaryMetricValue={primaryMetricValue}
          primaryMetricUnit={primaryMetricUnit}
          isStaticFallback={isStaticFallback}
        >
          <IntelligenceSelector companies={dataset.companies} value={companyId} onChange={setCompanyId} />
        </SceneHero>

        {/* Scene 2 — Injury / Safety Rate Stage */}
        <SceneInjurySafety
          charts={allCharts}
          activeMethod={activeMethod}
          selectedCategory={selectedCategory}
          activeSelection={activeSelection}
          onSelectCategory={handleSelectCategory}
          onSelectDatum={handleSelectDatum}
          fxClass={fxClass}
        />

        {/* Scene 3 — Workforce Exposure Stage */}
        <SceneWorkforceExposure
          charts={allCharts}
          metrics={vizModel.metrics}
          activeMethod={activeMethod}
          selectedCategory={selectedCategory}
          activeSelection={activeSelection}
          onSelectCategory={handleSelectCategory}
          onSelectDatum={handleSelectDatum}
          fxClass={fxClass}
        />

        {/* Scene 4 — Geographic / Network Gap Stage */}
        <SceneLocationNetwork
          charts={allCharts}
          activeMethod={activeMethod}
          selectedCategory={selectedCategory}
          activeSelection={activeSelection}
          onSelectCategory={handleSelectCategory}
          onSelectDatum={handleSelectDatum}
          fxClass={fxClass}
        />

        {/* Scene 5 — Risk Matrix Stage */}
        <SceneRiskMatrix
          riskMatrix={vizModel.riskMatrix}
          opportunityMatrix={vizModel.opportunityMatrix}
          activeMethod={activeMethod}
          onSelectPoint={handleMatrixPoint}
          fxClass={fxClass}
        />

        {/* Scene 6 — Source Evidence Stage */}
        <SceneEvidence
          sources={vizModel.sourceRecords}
          facts={mergedIntelligence?.facts ?? []}
          signals={vizModel.signals}
          fxClass={fxClass}
          onSelectSignal={handleSelectSignal}
        />

        {/* Scene 7 — Visual Modes */}
        <SceneVisualModes
          activeMethod={activeMethod}
          onSelectMethod={(m) => { setActiveMethod(m); }}
          dataCount={getMethodDataCount}
          fxClass={fxClass}
        />

        {/* Interactive filter controls (when active) */}
        {activeMethod === "interactive-filter" && mergedIntelligence && mergedIntelligence.facts.length > 0 && (
          <div style={{ padding: "1rem 3rem" }} className="cinematic-data-source-bar" >
            {[
              { label: "Category", value: filterCategory, options: ["all", "contractAwards", "opportunities", "secFilings", "jobSignals", "sourceConfidence", "timelineEvents", "locationExposure", "medicalNetworkGaps"], onChange: setFilterCategory },
              { label: "Confidence", value: filterConfidence, options: ["all", "high", "medium", "low", "link-only"], onChange: setFilterConfidence },
              { label: "Source type", value: filterSourceType, options: ["all", "usaspending", "sec", "sam", "official", "careers", "manual", "news", "web"], onChange: setFilterSourceType },
              { label: "Date range", value: filterDateRange, options: ["all", "7d", "30d", "90d", "1y"], onChange: setFilterDateRange },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-2">
                <label className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/50">{f.label}</label>
                <select
                  value={f.value}
                  onChange={(e) => f.onChange(e.target.value)}
                  className="rounded-lg border border-cyan-100/20 bg-cyan-100/5 px-2 py-1 text-xs text-cyan-50 outline-none focus:border-cyan-100/40"
                >
                  {f.options.map((o) => <option key={o} value={o} className="bg-slate-950 text-cyan-50">{o}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}

        {/* Contextual morph controls (when active) */}
        {activeMethod === "contextual-morph" && mergedIntelligence && mergedIntelligence.facts.length > 0 && (
          <div style={{ padding: "1rem 3rem" }} className="cinematic-data-source-bar">
            {([
              { key: "category", label: "Category" },
              { key: "sourceType", label: "Source type" },
              { key: "confidence", label: "Confidence" },
              { key: "time", label: "Time" },
            ] as { key: typeof morphMode; label: string }[]).map((m) => (
              <button
                key={m.key}
                onClick={() => setMorphMode(m.key)}
                className={`cinematic-source-btn ${morphMode === m.key ? "cinematic-source-btn-active" : ""}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        {/* Intelligence Answer Card */}
        <div style={{ padding: "2rem 3rem" }}>
          <IntelligenceAnswerCard
            companyName={company?.name ?? resolvedCompanyId}
            intelligence={mergedIntelligence}
            metrics={vizModel.metrics}
            signals={vizModel.signals}
            dossierSections={vizModel.dossierSections}
            riskMatrix={vizModel.riskMatrix}
            opportunityMatrix={vizModel.opportunityMatrix}
          />
        </div>

        {/* Intelligence Insight Panel */}
        <IntelligenceInsightPanel
          isOpen={detailDrawerOpen}
          onClose={() => setDetailDrawerOpen(false)}
          selection={activeSelection}
          context={insightContext}
        />
        <StyleInjector />
      </section>
    </main>
  );
}
