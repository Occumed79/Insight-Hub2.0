import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import type {
  ChartDefinition,
  MetricDefinition,
  SignalDefinition,
  RiskMatrixPoint,
  OpportunityMatrixPoint,
  DossierSectionDefinition,
  TooltipFormat,
} from "@/company-configs/types";
import type { IntelligenceFact, IntelligenceCategory } from "@/data/types";

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

interface ChartDatumSelection {
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
  if (title.includes("contract") || title.includes("award")) return "holo-layer-contract";
  if (title.includes("opportunit")) return "holo-layer-opportunity";
  if (title.includes("sec")) return "holo-layer-sec";
  if (title.includes("job")) return "holo-layer-job";
  if (title.includes("confidence")) return "holo-layer-confidence";
  if (title.includes("location")) return "holo-layer-location";
  if (title.includes("network")) return "holo-layer-network";
  if (title.includes("event")) return "holo-layer-event";
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
    contractAwards: "#22d3ee",
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

function useChartPanels(vizModel: ProfileVisualizationModel) {
  return useMemo(() => {
    const primaryCharts = vizModel.charts.length ? vizModel.charts : metricChartFromDefinitions(vizModel.metrics);
    return { primaryCharts };
  }, [vizModel.charts, vizModel.metrics]);
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

function VisualizationDetailDrawer({
  isOpen,
  onClose,
  selection,
  sourceRecords,
}: {
  isOpen: boolean;
  onClose: () => void;
  selection: ChartDatumSelection | null;
  sourceRecords: any[];
}) {
  if (!selection) return null;
  const source = selection.sourceId
    ? sourceRecords.find((s) => s.id === selection.sourceId || s.sourceId === selection.sourceId)
    : null;
  const sourceName = source?.name ?? source?.sourceName ?? selection.sourceId;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-0 right-0 z-50 w-full max-w-md border-t border-cyan-100/20 bg-[#030813]/95 p-6 backdrop-blur-xl lg:bottom-0 lg:right-8 lg:top-auto lg:rounded-t-2xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Detail View</h3>
            <button
              onClick={onClose}
              className="rounded-lg border border-cyan-100/20 bg-cyan-100/5 px-3 py-1 text-xs text-cyan-50 hover:bg-cyan-100/10"
            >
              Close
            </button>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Chart</p>
              <p className="mt-1 text-sm font-semibold text-cyan-50">{selection.chartTitle}</p>
            </div>
            <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Category / X</p>
              <p className="mt-1 text-sm font-semibold text-cyan-50">{selection.category}</p>
            </div>
            <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Series</p>
              <p className="mt-1 text-sm font-semibold text-cyan-50">{selection.seriesName}</p>
            </div>
            <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Value</p>
              <p className="mt-1 text-sm font-semibold text-cyan-50">
                {formatValue(selection.value, selection.formatter, selection.unit)}
              </p>
            </div>
            {selection.sourceId && (
              <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Source</p>
                <p className="mt-1 text-sm leading-5 text-cyan-100/70">{sourceName}</p>
              </div>
            )}
            {selection.sourceType && (
              <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Source Type</p>
                <p className="mt-1 text-sm leading-5 text-cyan-100/70">{selection.sourceType}</p>
              </div>
            )}
            {selection.sourceUrl && (
              <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Source URL</p>
                <a
                  href={selection.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block break-all text-sm leading-5 text-cyan-300/80 underline hover:text-cyan-200"
                >
                  {selection.sourceUrl}
                </a>
              </div>
            )}
            {selection.confidence && (
              <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Confidence</p>
                <p className="mt-1 text-sm leading-5 text-cyan-100/70">{selection.confidence}</p>
              </div>
            )}
            {selection.date && (
              <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Date</p>
                <p className="mt-1 text-sm leading-5 text-cyan-100/70">{selection.date}</p>
              </div>
            )}
            {selection.intelligenceCategory && (
              <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Intelligence Category</p>
                <p className="mt-1 text-sm leading-5 text-cyan-100/70">{selection.intelligenceCategory}</p>
              </div>
            )}
            {selection.summary && (
              <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Summary</p>
                <p className="mt-1 text-sm leading-5 text-cyan-100/70">{selection.summary}</p>
              </div>
            )}
            {selection.rawSnippet && (
              <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Raw Snippet</p>
                <p className="mt-1 text-sm leading-5 text-cyan-100/70">{selection.rawSnippet}</p>
              </div>
            )}
            {selection.note && (
              <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Note</p>
                <p className="mt-1 text-sm leading-5 text-cyan-100/70">{selection.note}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const METHOD_BEHAVIOR: Record<
  string,
  { label: string; description: string; affects: string; mode: string }
> = {
  "vector-displacement": {
    label: "Vector Displacement Mapping",
    description: "Selected bars/points/lines offset by value or confidence. Higher values push farther.",
    affects: "bars, points, lines, matrix",
    mode: "displacement",
  },
  "chromatic-aberration": {
    label: "Chromatic Aberration Highlighting",
    description: "Selected datum gets RGB split/glitch halo. Consistent across bars, points, lines, and matrix.",
    affects: "all chart elements",
    mode: "chromatic",
  },
  "geometric-anchor": {
    label: "Geometric Anchor Snapping",
    description: "Selected datum gets crosshair/reference lines and an anchor label showing value, source, and confidence.",
    affects: "bar, line, area, scatter, matrix",
    mode: "anchor",
  },
  "subtractive-masking": {
    label: "Subtractive Masking Overlays",
    description: "Non-selected categories fade into masked dark glass. Selected datum cuts through with illuminated focus.",
    affects: "all chart panels",
    mode: "masking",
  },
  "procedural-grid": {
    label: "Procedural Grid Resonances",
    description: "Chart grid pulses/warps around selected values. Intensity responds to value and confidence.",
    affects: "cartesian grid",
    mode: "grid",
  },
  "algorithmic-edge": {
    label: "Algorithmic Edge-Tracing",
    description: "Selected bar/line/area/matrix point gets an animated outline trace. Line paths sweep; bar borders trace.",
    affects: "bars, lines, areas, matrix points",
    mode: "edge",
  },
  "concentric-ripple": {
    label: "Concentric Ripple Metrics",
    description: "Clicking a datum emits concentric rings from the selected point in chart coordinates.",
    affects: "points, bars, matrix points",
    mode: "ripple",
  },
  "negative-space": {
    label: "Negative Space Inversion",
    description: "Selected item becomes a dark cutout; surrounding data glows. Compare selected against peers.",
    affects: "bars, points, matrix",
    mode: "invert",
  },
  "vector-lattice": {
    label: "Vector Lattice Distortion",
    description: "A visible lattice/grid overlay bends around the selected datum.",
    affects: "chart panels",
    mode: "lattice",
  },
  "color-shift": {
    label: "Color-Shift Isometry",
    description: "Series colors shift based on value band, source confidence, or intelligence category.",
    affects: "bars, points, lines",
    mode: "colorShift",
  },
  "synchronous-path": {
    label: "Synchronous Path Illumination",
    description: "Related charts illuminate together. Matching dates, sources, and confidence light up across panels.",
    affects: "lines, charts",
    mode: "synchronous",
  },
  "vector-node": {
    label: "Vector Node Expansion",
    description: "Selected datum expands into a compact mini detail card beside the chart showing source, value, confidence, and date.",
    affects: "selected datum",
    mode: "node",
  },
  "radiant-gradient": {
    label: "Radiant Gradient Focus",
    description: "Selected series/category gets strong gradient glow. Others dim.",
    affects: "all chart elements",
    mode: "radiant",
  },
  "isometric-slice": {
    label: "Isometric Slice-View",
    description: "Selected bars/segments lift into a 3D/isometric slice. Matrix points lift with shadow and label.",
    affects: "bars, points, matrix",
    mode: "isometric",
  },
  "semantic-zoom": {
    label: "Generative Semantic Zoom",
    description: "Overview shows aggregated sections; zoomed view reveals granular intelligence facts and events.",
    affects: "intelligence charts",
    mode: "zoom",
  },
  "holographic-depth": {
    label: "Holographic Depth Layers",
    description: "Panels stack by data type: contract awards, opportunities, SEC, jobs, confidence, locations.",
    affects: "panel chrome",
    mode: "holographic",
  },
  "kinetic-vector": {
    label: "Kinetic Vector Transitions",
    description: "Charts animate with directional motion when switching methods or selecting data.",
    affects: "all chart elements",
    mode: "kinetic",
  },
  "contextual-morph": {
    label: "Contextual Data Morphing",
    description: "Morph chart grouping by source type, category, confidence, or time.",
    affects: "intelligence charts",
    mode: "morph",
  },
  "interactive-filter": {
    label: "Interactive Filtering",
    description: "Compact filter controls for category, confidence, source type, and date range. Filtering changes visible charts.",
    affects: "intelligence charts",
    mode: "filter",
  },
  "zoom-pan": {
    label: "Zoom and Pan",
    description: "Full-width chart focus with scrollable/inspectable detail mode and reset.",
    affects: "chart workspace",
    mode: "pan",
  },
  "linked-visualizations": {
    label: "Linked Visualizations / Brushing",
    description: "Selecting a category/date/source/confidence in one chart highlights matching data across all charts.",
    affects: "all charts",
    mode: "linked",
  },
  "click-reveal": {
    label: "Click-to-Reveal",
    description: "Clicking any datum opens a detail drawer with chart, category, series, value, source, URL, confidence, date, and summary.",
    affects: "detail drawer",
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
    <div className="mb-5 rounded-xl border border-cyan-100/10 bg-black/24 p-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100/10 text-xs text-cyan-100/70">{methodId.charAt(0).toUpperCase()}</span>
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-100/50">{behavior.affects}</p>
          <h3 className="text-sm font-semibold text-cyan-50">{behavior.label}</h3>
        </div>
      </div>
      <p className="mt-2 text-sm leading-6 text-cyan-100/65">{behavior.description}</p>
    </div>
  );
}

function ChartPanel({
  chart,
  index,
  activeMethod,
  selectedCategory,
  activeSelection,
  focusedChartId,
  onFocusChart,
  onSelectCategory,
  onSelectDatum,
}: {
  chart: ChartDefinition;
  index: number;
  activeMethod: string;
  selectedCategory: string | null;
  activeSelection: ChartDatumSelection | null;
  focusedChartId: string | null;
  onFocusChart: (id: string | null) => void;
  onSelectCategory: (category: string | null) => void;
  onSelectDatum: (selection: ChartDatumSelection) => void;
}) {
  const isVectorDisplacement = activeMethod === "vector-displacement";
  const isLinkedBrushing = activeMethod === "linked-visualizations";
  const isRadiant = activeMethod === "radiant-gradient";
  const isDimmed = activeMethod === "negative-space";
  const isHolographic = activeMethod === "holographic-depth";
  const isIsometric = activeMethod === "isometric-slice";
  const isChromatic = activeMethod === "chromatic-aberration";
  const isPulse = activeMethod === "kinetic-vector";
  const isGeometricAnchor = activeMethod === "geometric-anchor";
  const isSubtractiveMasking = activeMethod === "subtractive-masking";
  const isProceduralGrid = activeMethod === "procedural-grid";
  const isAlgorithmicEdge = activeMethod === "algorithmic-edge";
  const isConcentricRipple = activeMethod === "concentric-ripple";
  const isVectorLattice = activeMethod === "vector-lattice";
  const isColorShift = activeMethod === "color-shift";
  const isSynchronousPath = activeMethod === "synchronous-path";
  const isVectorNode = activeMethod === "vector-node";
  const isSemanticZoom = activeMethod === "semantic-zoom";
  const isContextualMorph = activeMethod === "contextual-morph";
  const isInteractiveFilter = activeMethod === "interactive-filter";
  const isZoomPan = activeMethod === "zoom-pan";
  const isClickReveal = activeMethod === "click-reveal";
  const height = chartHeight(chart);
  const selectedEntry = selectedCategory
    ? chart.data.find((d) => String(d[chart.xKey] ?? d.label) === selectedCategory)
    : null;
  const selectedValue = selectedEntry ? Number(selectedEntry[chart.series[0]?.dataKey ?? "value"] ?? 0) : 0;

  const handleBarClick = (entry: any, seriesName: string, dataKey: string, color: string) => {
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
    if (isZoomPan) onFocusChart(chart.id);
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
    if (isZoomPan) onFocusChart(chart.id);
  };

  const panelClass = [
    "selected-chart-panel",
    "relative",
    "overflow-hidden",
    "rounded-2xl",
    "border",
    "border-cyan-100/12",
    "bg-black/24",
    "p-5",
    "transition-all",
    "duration-500",
    isChromatic ? "shadow-[0_0_24px_rgba(239,68,68,0.12),0_0_24px_rgba(6,182,212,0.12)]" : "",
    isDimmed ? "subtractive-mask-panel" : "",
    isHolographic ? `holographic-panel ${getHolographicLayer(chart)}` : "",
    isIsometric ? "isometric-panel" : "",
    isPulse ? "kinetic-panel" : "",
    isVectorLattice ? "vector-lattice-panel" : "",
    isProceduralGrid ? "procedural-grid-panel" : "",
    isSubtractiveMasking ? "subtractive-mask-panel" : "",
    isColorShift ? "color-shift-panel" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const renderCartesian = (children: React.ReactNode, extra: React.ReactNode = null) => (
    <GlassCard className={panelClass} delay={index * 0.03}>
      <div className="mb-4">
        <h3 className="font-bold text-white">{chart.title}</h3>
        {chart.subtitle ? <p className="mt-1 text-xs text-cyan-100/55">{chart.subtitle}</p> : null}
      </div>
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
      {isVectorLattice && (
        <div className="pointer-events-none absolute inset-0 vector-lattice-overlay" aria-hidden />
      )}
      {isVectorNode && selectedCategory && selectedEntry && (
        <div className="pointer-events-none absolute bottom-3 right-3 z-10 max-w-[220px] rounded-xl border border-cyan-100/20 bg-slate-950/80 p-3 text-xs shadow-xl backdrop-blur-xl">
          <p className="font-semibold text-cyan-50">{String(selectedEntry[chart.xKey] ?? "")}</p>
          <p className="mt-1 text-cyan-100/60">
            {formatValue(Number(selectedEntry[chart.series[0]?.dataKey ?? "value"] ?? 0), chart.formatter, String(selectedEntry.unit ?? ""))}
          </p>
          {selectedEntry.sourceId && <p className="mt-1 text-cyan-100/40">src: {selectedEntry.sourceId}</p>}
        </div>
      )}
      {extra}
    </GlassCard>
  );

  if (chart.type === "line") {
    return renderCartesian(
      <LineChart data={chart.data}>
        <CartesianGrid stroke="rgba(255,255,255,.08)" />
        <XAxis dataKey={chart.xKey} stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
        <YAxis
          stroke="rgba(207,250,254,.45)"
          tick={{ fontSize: 11 }}
          domain={chart.domain}
          tickFormatter={formatTickByType(chart.formatter)}
        />
        {chart.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        <Tooltip
          content={<LuminousChartTooltip formatter={chart.formatter ?? "plain"} headline={chart.headline ?? "data focus"} />}
        />
        {chart.referenceLines?.map((ref, i) => (
          <ReferenceLine key={i} y={ref.y} stroke={ref.stroke} strokeDasharray={ref.strokeDasharray} label={ref.label} />
        ))}
        {isGeometricAnchor && selectedCategory && (
          <>
            <ReferenceLine x={selectedCategory} stroke="rgba(34,211,238,0.65)" strokeDasharray="5 5" />
            <ReferenceLine y={selectedValue} stroke="rgba(34,211,238,0.4)" strokeDasharray="5 5" />
          </>
        )}
        {chart.series.map((s, i) => {
          const color = getSeriesColor(i, s.color);
          return (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name ?? s.dataKey}
              stroke={color}
              strokeWidth={3}
              dot={(props: any) => {
                const category = String(props.payload?.[chart.xKey] ?? props.payload?.label ?? "");
                const isSelected = selectedCategory === category;
                const isLinked = isLinkedBrushing && selectedCategory && isSelected;
                const isDimmed = selectedCategory && !isSelected;
                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={isSelected ? 7 : 4}
                    fill={isLinked ? "#facc15" : isColorShift ? getColorByData(props.payload) : color}
                    stroke={isSelected ? "#ffffff" : color}
                    strokeWidth={isSelected ? 3 : 2}
                    opacity={isRadiant && selectedCategory ? (isSelected ? 1 : 0.3) : isDimmed ? 0.4 : 1}
                    style={{
                      transform: isVectorDisplacement && isSelected ? `translateY(${-Math.min(18, Number(props.payload?.value ?? 0) / 10)}px)` : undefined,
                    }}
                    className={[
                      isChromatic && isSelected ? "chromatic-dot" : "",
                      isAlgorithmicEdge && isSelected ? "algorithmic-edge-dot" : "",
                      isConcentricRipple && isSelected ? "ripple-origin-cell" : "",
                      isSubtractiveMasking && isSelected ? "mask-cutout-cell" : "",
                      isPulse && isSelected ? "pulse-bar" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  />
                );
              }}
              activeDot={{
                r: 8,
                onClick: (_: any, entry: any) => handleBarClick(entry.payload, s.name ?? s.dataKey, s.dataKey, color),
              }}
              opacity={isRadiant && selectedCategory ? 0.35 : 1}
              className={[
                isSynchronousPath ? "synchronous-path-line" : "",
                isRadiant && selectedCategory ? "radiant-line" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            />
          );
        })}
      </LineChart>
    );
  }

  if (chart.type === "area") {
    return renderCartesian(
      <AreaChart data={chart.data}>
        <CartesianGrid stroke="rgba(255,255,255,.08)" />
        <XAxis dataKey={chart.xKey} stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
        <YAxis
          stroke="rgba(207,250,254,.45)"
          tick={{ fontSize: 11 }}
          domain={chart.domain}
          tickFormatter={formatTickByType(chart.formatter)}
        />
        {chart.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        <Tooltip
          content={<LuminousChartTooltip formatter={chart.formatter ?? "plain"} headline={chart.headline ?? "data focus"} />}
        />
        {isGeometricAnchor && selectedCategory && (
          <>
            <ReferenceLine x={selectedCategory} stroke="rgba(34,211,238,0.65)" strokeDasharray="5 5" />
            <ReferenceLine y={selectedValue} stroke="rgba(34,211,238,0.4)" strokeDasharray="5 5" />
          </>
        )}
        {chart.series.map((s, i) => {
          const color = getSeriesColor(i, s.color);
          return (
            <Area
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name ?? s.dataKey}
              stroke={color}
              fill={`${color}4d`}
              strokeWidth={3}
              dot={(props: any) => {
                const category = String(props.payload?.[chart.xKey] ?? props.payload?.label ?? "");
                const isSelected = selectedCategory === category;
                const isLinked = isLinkedBrushing && selectedCategory && isSelected;
                const isDimmed = selectedCategory && !isSelected;
                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={isSelected ? 6 : 3}
                    fill={isLinked ? "#facc15" : isColorShift ? getColorByData(props.payload) : color}
                    stroke={isSelected ? "#ffffff" : color}
                    strokeWidth={isSelected ? 2 : 1}
                    opacity={isRadiant && selectedCategory ? (isSelected ? 1 : 0.3) : isDimmed ? 0.4 : 1}
                    style={{
                      transform: isVectorDisplacement && isSelected ? `translateY(${-Math.min(18, Number(props.payload?.value ?? 0) / 10)}px)` : undefined,
                    }}
                    className={[
                      isChromatic && isSelected ? "chromatic-dot" : "",
                      isAlgorithmicEdge && isSelected ? "algorithmic-edge-dot" : "",
                      isConcentricRipple && isSelected ? "ripple-origin-cell" : "",
                      isSubtractiveMasking && isSelected ? "mask-cutout-cell" : "",
                      isPulse && isSelected ? "pulse-bar" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  />
                );
              }}
              activeDot={{
                r: 8,
                onClick: (_: any, entry: any) => handleBarClick(entry.payload, s.name ?? s.dataKey, s.dataKey, color),
              }}
              opacity={isRadiant && selectedCategory ? 0.35 : 1}
              className={[
                isAlgorithmicEdge ? "algorithmic-edge-area" : "",
                isRadiant && selectedCategory ? "radiant-area" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            />
          );
        })}
      </AreaChart>
    );
  }

  if (chart.type === "scatter") {
    const xDataKey = chart.series[0]?.dataKey ?? "x";
    const yDataKey = chart.series[1]?.dataKey ?? "y";
    const selectedX = activeSelection?.chartId === chart.id ? Number(activeSelection.payload?.[xDataKey] ?? 0) : null;
    const selectedY = activeSelection?.chartId === chart.id ? Number(activeSelection.payload?.[yDataKey] ?? 0) : null;
    return renderCartesian(
      <ScatterChart>
        <CartesianGrid stroke="rgba(255,255,255,.08)" />
        <XAxis
          dataKey={xDataKey}
          name={chart.series[0]?.name ?? "X"}
          stroke="rgba(207,250,254,.45)"
          tick={{ fontSize: 10 }}
          tickFormatter={formatTickByType(chart.formatter)}
        />
        <YAxis
          dataKey={yDataKey}
          name={chart.series[1]?.name ?? "Y"}
          stroke="rgba(207,250,254,.45)"
          tick={{ fontSize: 11 }}
          domain={chart.domain}
        />
        {chart.series.length > 2 && <ZAxis dataKey={chart.series[2]?.dataKey ?? "z"} range={[80, 520]} />}
        <Tooltip cursor={{ stroke: "rgba(34,211,238,.35)", strokeDasharray: "4 4" }} content={<LuminousChartTooltip headline={chart.headline ?? "data focus"} />} />
        {isGeometricAnchor && selectedX !== null && selectedY !== null && (
          <>
            <ReferenceLine x={selectedX} stroke="rgba(34,211,238,0.65)" strokeDasharray="5 5" />
            <ReferenceLine y={selectedY} stroke="rgba(34,211,238,0.4)" strokeDasharray="5 5" />
          </>
        )}
        <Scatter
          name="Data"
          data={chart.data}
          fill={chart.series[0]?.color ?? "#22d3ee"}
          onClick={handleScatterClick}
          shape={(props: any) => {
            const category = String(props.payload?.[chart.xKey] ?? props.payload?.name ?? "");
            const isSelected = selectedCategory === category;
            const isLinked = isLinkedBrushing && selectedCategory && isSelected;
            const isDimmed = selectedCategory && !isSelected;
            const r = props.size ? Math.sqrt(props.size) / 2 : isSelected ? 8 : 6;
            return (
              <circle
                cx={props.cx}
                cy={props.cy}
                r={r}
                fill={isLinked ? "#facc15" : isColorShift ? getColorByData(props.payload) : chart.series[0]?.color ?? "#22d3ee"}
                stroke={isSelected ? "#ffffff" : "rgba(255,255,255,0.2)"}
                strokeWidth={isSelected ? 3 : 1}
                opacity={isRadiant && selectedCategory ? (isSelected ? 1 : 0.3) : isDimmed ? 0.4 : 1}
                style={{
                  transform: isVectorDisplacement && isSelected ? `translateY(${-Math.min(18, Number(props.payload?.value ?? 0) / 10)}px)` : undefined,
                }}
                className={[
                  isChromatic && isSelected ? "chromatic-dot" : "",
                  isAlgorithmicEdge && isSelected ? "algorithmic-edge-dot" : "",
                  isConcentricRipple && isSelected ? "ripple-origin-cell" : "",
                  isSubtractiveMasking && isSelected ? "mask-cutout-cell" : "",
                  isPulse && isSelected ? "pulse-bar" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            );
          }}
        />
      </ScatterChart>
    );
  }

  return renderCartesian(
    <BarChart data={chart.data}>
      <CartesianGrid stroke="rgba(255,255,255,.08)" />
      <XAxis dataKey={chart.xKey} stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
      <YAxis
        stroke="rgba(207,250,254,.45)"
        tick={{ fontSize: 11 }}
        domain={chart.domain}
        tickFormatter={formatTickByType(chart.formatter)}
      />
      {chart.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
      <Tooltip
        cursor={{ fill: "rgba(34,211,238,.08)" }}
        content={<LuminousChartTooltip formatter={chart.formatter ?? "plain"} headline={chart.headline ?? "data focus"} />}
      />
      {chart.referenceLines?.map((ref, i) => (
        <ReferenceLine key={i} y={ref.y} stroke={ref.stroke} strokeDasharray={ref.strokeDasharray} label={ref.label} />
      ))}
      {isGeometricAnchor && selectedCategory && (
        <>
          <ReferenceLine x={selectedCategory} stroke="rgba(34,211,238,0.65)" strokeDasharray="5 5" />
          <ReferenceLine y={selectedValue} stroke="rgba(34,211,238,0.4)" strokeDasharray="5 5" />
        </>
      )}
      {chart.series.map((s, i) => {
        const color = getSeriesColor(i, s.color);
        return (
          <Bar
            key={s.dataKey}
            dataKey={s.dataKey}
            name={s.name ?? s.dataKey}
            fill={color}
            radius={s.radius ?? [10, 10, 0, 0]}
            stackId={s.stackId}
            onClick={(_, index) => handleBarClick(chart.data[index], s.name ?? s.dataKey, s.dataKey, color)}
          >
            {chart.data.map((entry, idx) => {
              const category = String(entry[chart.xKey] ?? entry.label ?? "");
              const isSelected = selectedCategory === category;
              const isDimmed = selectedCategory && !isSelected;
              const isLinked = isLinkedBrushing && selectedCategory && isSelected;
              return (
                <Cell
                  key={`cell-${idx}`}
                  fill={color}
                  opacity={isRadiant && selectedCategory ? (isSelected ? 1 : 0.3) : isDimmed ? 0.4 : 1}
                  radius={isSelected ? ([10, 10, 4, 4] as any) : s.radius ?? ([10, 10, 0, 0] as any)}
                  className={[
                    isSelected ? "selected-bar-cell" : "",
                    isLinked ? "linked-bar-cell" : "",
                    isChromatic && isSelected ? "chromatic-bar-cell" : "",
                    isIsometric && isSelected ? "isometric-bar-cell" : "",
                    isPulse && isSelected ? "pulse-bar" : "",
                    isVectorDisplacement && isSelected ? "vector-displace-cell" : "",
                    isAlgorithmicEdge && isSelected ? "algorithmic-edge-bar-cell" : "",
                    isSubtractiveMasking && isSelected ? "mask-cutout-cell" : "",
                    isConcentricRipple && isSelected ? "ripple-origin-cell" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
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
}

function MatrixPanel({
  title,
  subtitle,
  data,
  xKey,
  yKey,
  zKey,
  xLabel,
  yLabel,
  activeMethod,
  onSelectPoint,
}: {
  title: string;
  subtitle?: string;
  data: RiskMatrixPoint[] | OpportunityMatrixPoint[];
  xKey: keyof RiskMatrixPoint | keyof OpportunityMatrixPoint;
  yKey: keyof RiskMatrixPoint | keyof OpportunityMatrixPoint;
  zKey: keyof RiskMatrixPoint | keyof OpportunityMatrixPoint;
  xLabel: string;
  yLabel: string;
  activeMethod: string;
  onSelectPoint: (point: any) => void;
}) {
  if (!data.length) return null;
  const color = activeMethod === "negative-space" ? "#f43f5e" : "#22d3ee";
  const xValues = data.map((d) => Number((d as any)[xKey] ?? 0)).filter((v) => !isNaN(v));
  const yValues = data.map((d) => Number((d as any)[yKey] ?? 0)).filter((v) => !isNaN(v));
  const xMid = xValues.length ? (Math.max(...xValues) + Math.min(...xValues)) / 2 : 0;
  const yMid = yValues.length ? (Math.max(...yValues) + Math.min(...yValues)) / 2 : 0;
  const [selectedPoint, setSelectedPoint] = useState<any | null>(null);
  const isLinkedBrushing = activeMethod === "linked-visualizations";
  const isRadiant = activeMethod === "radiant-gradient";
  const isChromatic = activeMethod === "chromatic-aberration";
  const isIsometric = activeMethod === "isometric-slice";
  const isVectorDisplacement = activeMethod === "vector-displacement";
  const isColorShift = activeMethod === "color-shift";
  const isAlgorithmicEdge = activeMethod === "algorithmic-edge";
  const isConcentricRipple = activeMethod === "concentric-ripple";
  const isSubtractiveMasking = activeMethod === "subtractive-masking";
  const isPulse = activeMethod === "kinetic-vector";
  const isVectorLattice = activeMethod === "vector-lattice";
  const isHolographic = activeMethod === "holographic-depth";
  const isProceduralGrid = activeMethod === "procedural-grid";
  const isDimmed = activeMethod === "negative-space";
  const panelClass = [
    "p-5",
    isVectorLattice ? "vector-lattice-panel" : "",
    isProceduralGrid ? "procedural-grid-panel" : "",
    isSubtractiveMasking ? "subtractive-mask-panel" : "",
    isHolographic ? "holographic-panel" : "",
    isIsometric ? "isometric-panel" : "",
    isPulse ? "kinetic-panel" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <GlassCard className={panelClass}>
      <div className="mb-4">
        <h3 className="font-bold text-white">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-cyan-100/55">{subtitle}</p> : null}
      </div>
      <div className="w-full" style={{ height: 380 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            <CartesianGrid stroke={isProceduralGrid ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,.08)"} />
            <XAxis
              dataKey={xKey as string}
              name={xLabel}
              stroke="rgba(207,250,254,.45)"
              tick={{ fontSize: 10 }}
              type="number"
              domain={[0, "auto"]}
            >
              <Label value={xLabel} position="insideBottom" offset={-4} fill="rgba(207,250,254,0.65)" fontSize={11} />
            </XAxis>
            <YAxis
              dataKey={yKey as string}
              name={yLabel}
              stroke="rgba(207,250,254,.45)"
              tick={{ fontSize: 11 }}
              type="number"
              domain={[0, "auto"]}
            >
              <Label value={yLabel} angle={-90} position="insideLeft" fill="rgba(207,250,254,0.65)" fontSize={11} />
            </YAxis>
            <ZAxis dataKey={zKey as string} range={[80, 520]} />
            <Tooltip cursor={{ stroke: "rgba(34,211,238,.35)", strokeDasharray: "4 4" }} content={<LuminousChartTooltip formatter="plain" headline={title} />} />
            {xMid > 0 && (
              <ReferenceLine x={xMid} stroke="rgba(207,250,254,0.25)" strokeDasharray="4 4" label={{ value: "Mid", position: "top", className: "matrix-quadrant-label" }} />
            )}
            {yMid > 0 && (
              <ReferenceLine y={yMid} stroke="rgba(207,250,254,0.25)" strokeDasharray="4 4" label={{ value: "Mid", position: "right", className: "matrix-quadrant-label" }} />
            )}
            <Scatter
              name="Data"
              data={data}
              fill={color}
              onClick={(entry: any, index: number) => {
                setSelectedPoint(data[index]);
                onSelectPoint(data[index]);
              }}
              shape={(props: any) => {
                const point = props.payload;
                const isSelected = selectedPoint && point === selectedPoint;
                const isLinked = isLinkedBrushing && selectedPoint && point === selectedPoint;
                const isDimmed = selectedPoint && point !== selectedPoint;
                return (
                  <g>
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={isSelected ? 9 : 7}
                      fill={isLinked ? "#facc15" : isColorShift ? getColorByData(point) : color}
                      stroke={isSelected ? "#ffffff" : "rgba(255,255,255,0.25)"}
                      strokeWidth={isSelected ? 3 : 1}
                      opacity={isRadiant && selectedPoint ? (isSelected ? 1 : 0.3) : isDimmed ? 0.4 : 1}
                      style={{
                        transform: isVectorDisplacement && isSelected ? `translateY(${-Math.min(18, Number(point?.value ?? 0) / 10)}px)` : undefined,
                      }}
                      className={[
                        isChromatic && isSelected ? "chromatic-dot" : "",
                        isAlgorithmicEdge && isSelected ? "algorithmic-edge-dot" : "",
                        isConcentricRipple && isSelected ? "ripple-origin-cell" : "",
                        isSubtractiveMasking && isSelected ? "mask-cutout-cell" : "",
                        isPulse && isSelected ? "pulse-bar" : "",
                        isIsometric && isSelected ? "isometric-matrix-point" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    />
                    {point?.name && (
                      <text
                        x={props.cx}
                        y={props.cy - (isSelected ? 12 : 10)}
                        textAnchor="middle"
                        fill="rgba(207,250,254,0.85)"
                        fontSize={isSelected ? 11 : 10}
                        className="matrix-point-label"
                      >
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
    </GlassCard>
  );
}

function SignalSourceStrip({
  signals,
  sources,
  activeMethod,
  onSelectSignal,
}: {
  signals: SignalDefinition[];
  sources: any[];
  activeMethod: string;
  onSelectSignal: (signal: SignalDefinition) => void;
}) {
  if (!signals.length && !sources.length) return null;
  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      {signals.length > 0 && (
        <GlassCard className="p-5">
          <p className="mb-3 text-xs uppercase tracking-[0.24em] text-cyan-100/45">Executive Signals</p>
          <div className="space-y-2">
            {signals.map((signal, i) => (
              <button
                key={i}
                onClick={() => onSelectSignal(signal)}
                className="flex w-full items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-left transition hover:bg-emerald-400/10"
              >
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-cyan-50">{signal.label}</p>
                  <p className="mt-0.5 text-xs text-cyan-100/60">{signal.value}</p>
                  {signal.note ? <p className="mt-1 text-[11px] text-cyan-100/50">{signal.note}</p> : null}
                </div>
              </button>
            ))}
          </div>
        </GlassCard>
      )}
      {sources.length > 0 && (
        <GlassCard className="p-5">
          <p className="mb-3 text-xs uppercase tracking-[0.24em] text-cyan-100/45">Source Evidence</p>
          <div className="space-y-2">
            {sources.slice(0, 8).map((source, i) => {
              const sourceName = source.name ?? source.sourceName ?? source.title ?? source.type ?? source.id ?? "Source";
              const sourceMeta = [source.type, source.category, source.url ? "URL" : null].filter(Boolean).join(" · ");
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3"
                >
                  <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-cyan-50">{sourceName}</p>
                    {sourceMeta ? <p className="truncate text-[10px] uppercase tracking-[0.2em] text-cyan-100/50">{sourceMeta}</p> : null}
                    {source.url ? (
                      <p className="mt-1 truncate text-[10px] text-cyan-100/40">
                        {String(source.url).replace(/^https?:\/\//, "").split("/")[0]}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

function StyleInjector() {
  return (
    <style>{`
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
      .crosshair-overlay {
        background: linear-gradient(90deg, transparent 49.5%, rgba(34, 211, 238, 0.25) 49.5%, rgba(34, 211, 238, 0.25) 50.5%, transparent 50.5%),
                    linear-gradient(0deg, transparent 49.5%, rgba(34, 211, 238, 0.25) 49.5%, rgba(34, 211, 238, 0.25) 50.5%, transparent 50.5%);
        opacity: 0.6;
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
      .radiant-line path.recharts-line-curve {
        filter: drop-shadow(0 0 12px currentColor);
      }
      .radiant-area path.recharts-area-area {
        filter: drop-shadow(0 0 12px currentColor);
      }
      .chromatic-dot {
        filter: drop-shadow(2px 0 0 rgba(239, 68, 68, 0.9)) drop-shadow(-2px 0 0 rgba(6, 182, 212, 0.9));
      }
      .matrix-quadrant-label {
        font-size: 10px;
        fill: rgba(207, 250, 254, 0.55);
      }
      .subtractive-mask-panel {
        position: relative;
      }
      .subtractive-mask-panel::after {
        content: "";
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at var(--focus-x, 50%) var(--focus-y, 50%), transparent 0%, rgba(0, 0, 0, 0.55) 60%);
        pointer-events: none;
        border-radius: 1rem;
      }
      .vector-lattice-panel {
        position: relative;
      }
      .vector-lattice-overlay {
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(90deg, rgba(34, 211, 238, 0.08) 1px, transparent 1px),
          linear-gradient(0deg, rgba(34, 211, 238, 0.08) 1px, transparent 1px);
        background-size: 28px 28px;
        mask-image: radial-gradient(circle at var(--focus-x, 50%) var(--focus-y, 50%), rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%);
        -webkit-mask-image: radial-gradient(circle at var(--focus-x, 50%) var(--focus-y, 50%), rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%);
        animation: lattice-warp 3s ease-in-out infinite;
      }
      @keyframes lattice-warp {
        0%, 100% { transform: scale(1); opacity: 0.5; }
        50% { transform: scale(1.02); opacity: 0.85; }
      }
      .procedural-grid-panel .recharts-cartesian-grid-horizontal line,
      .procedural-grid-panel .recharts-cartesian-grid-vertical line {
        animation: grid-pulse 2s ease-in-out infinite;
      }
      @keyframes grid-pulse {
        0%, 100% { stroke-opacity: 0.08; }
        50% { stroke-opacity: 0.35; }
      }
      .kinetic-panel {
        animation: kinetic-snap 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      @keyframes kinetic-snap {
        0% { transform: translateY(12px) scale(0.98); opacity: 0.7; }
        100% { transform: translateY(0) scale(1); opacity: 1; }
      }
      .isometric-panel {
        transform: translateY(-4px) rotateX(2deg);
        box-shadow: 8px 8px 0 rgba(34, 211, 238, 0.15);
      }
      .isometric-bar-cell {
        transform: translateY(-5px);
        filter: drop-shadow(5px 5px 0 rgba(34, 211, 238, 0.35)) drop-shadow(0 0 8px rgba(34, 211, 238, 0.5));
      }
      .holographic-panel {
        border-style: solid;
        border-width: 1px;
      }
      .holo-layer-contract { border-color: rgba(34, 211, 238, 0.35); background: linear-gradient(135deg, rgba(34, 211, 238, 0.06), transparent 60%); }
      .holo-layer-opportunity { border-color: rgba(167, 139, 250, 0.35); background: linear-gradient(135deg, rgba(167, 139, 250, 0.06), transparent 60%); }
      .holo-layer-sec { border-color: rgba(251, 191, 36, 0.35); background: linear-gradient(135deg, rgba(251, 191, 36, 0.06), transparent 60%); }
      .holo-layer-job { border-color: rgba(52, 211, 153, 0.35); background: linear-gradient(135deg, rgba(52, 211, 153, 0.06), transparent 60%); }
      .holo-layer-confidence { border-color: rgba(96, 165, 250, 0.35); background: linear-gradient(135deg, rgba(96, 165, 250, 0.06), transparent 60%); }
      .holo-layer-location { border-color: rgba(163, 230, 53, 0.35); background: linear-gradient(135deg, rgba(163, 230, 53, 0.06), transparent 60%); }
      .holo-layer-network { border-color: rgba(251, 146, 60, 0.35); background: linear-gradient(135deg, rgba(251, 146, 60, 0.06), transparent 60%); }
      .holo-layer-event { border-color: rgba(251, 113, 133, 0.35); background: linear-gradient(135deg, rgba(251, 113, 133, 0.06), transparent 60%); }
      .holo-layer-base { border-color: rgba(207, 250, 254, 0.12); }
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
      .concentric-ring {
        fill: none;
        stroke: rgba(34, 211, 238, 0.65);
        stroke-width: 2;
        animation: ripple-expand 1.2s ease-out forwards;
      }
      @keyframes ripple-expand {
        0% { r: 0; opacity: 1; }
        100% { r: 45; opacity: 0; }
      }
      .color-shift-panel .recharts-bar-rectangle path {
        transition: fill 0.5s ease;
      }
      .vector-displace-cell {
        transform-box: fill-box;
        transform-origin: center;
      }
      .selected-chart-panel {
        transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.5s ease;
      }
      .selected-chart-panel:hover {
        transform: translateY(-2px);
      }
      .anchor-label {
        font-size: 10px;
        fill: rgba(34, 211, 238, 0.9);
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
      .method-filter-bar {
        animation: filter-bar-slide 0.4s ease-out both;
      }
      @keyframes filter-bar-slide {
        0% { transform: translateY(-8px); opacity: 0; }
        100% { transform: translateY(0); opacity: 1; }
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
  const profile = dataset.profiles.find((item) => resolveConfigCompanyId(item.companyId) === resolvedCompanyId);
  const sources = dataset.sources.filter((source) => resolveConfigCompanyId(source.companyId) === resolvedCompanyId);
  const intelligence = dataset.intelligence.find((item) => resolveConfigCompanyId(item.companyId) === resolvedCompanyId);
  const intelligenceCharts = useMemo(() => intelligenceFactsToCharts(intelligence), [intelligence]);

  const [activeMethod, setActiveMethod] = useState<string>("vector-displacement");
  const [activeSelection, setActiveSelection] = useState<ChartDatumSelection | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [focusedChartId, setFocusedChartId] = useState<string | null>(null);
  const [morphMode, setMorphMode] = useState<"category" | "sourceType" | "confidence" | "time">("category");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterConfidence, setFilterConfidence] = useState<string>("all");
  const [filterSourceType, setFilterSourceType] = useState<string>("all");
  const [filterDateRange, setFilterDateRange] = useState<string>("all");

  const vizModel = buildProfileVisualizationModel({
    company,
    config,
    metrics: dataset.metrics.filter((metric) => resolveConfigCompanyId(metric.companyId) === resolvedCompanyId),
    sources,
  });

  const { primaryCharts } = useChartPanels(vizModel);
  const filteredIntelligenceCharts = useMemo(() => {
    if (activeMethod === "interactive-filter") {
      return filterIntelligenceCharts(
        intelligenceCharts,
        intelligence?.facts ?? [],
        filterCategory,
        filterConfidence,
        filterSourceType,
        filterDateRange
      );
    }
    return intelligenceCharts;
  }, [activeMethod, intelligenceCharts, intelligence, filterCategory, filterConfidence, filterSourceType, filterDateRange]);

  const morphedChart = useMemo(() => {
    if (activeMethod === "contextual-morph" && intelligence && intelligence.facts.length > 0) {
      return morphIntelligenceFacts(intelligence.facts, morphMode);
    }
    return null;
  }, [activeMethod, intelligence, morphMode]);

  const allCharts = useMemo(() => {
    if (activeMethod === "contextual-morph" && morphedChart) {
      return [morphedChart];
    }
    return [...primaryCharts, ...filteredIntelligenceCharts];
  }, [primaryCharts, filteredIntelligenceCharts, activeMethod, morphedChart]);

  const handleSelectDatum = (selection: ChartDatumSelection) => {
    setActiveSelection(selection);
    setDetailDrawerOpen(true);
  };

  const handleSelectCategory = (category: string | null) => {
    setSelectedCategory((prev) => (prev === category ? null : category));
  };

  const handleSelectSignal = (signal: SignalDefinition) => {
    setActiveSelection({
      chartId: "signal",
      chartTitle: "Executive Signal",
      chartType: "signal",
      category: signal.label,
      seriesName: "Signal",
      dataKey: "value",
      value: 0,
      note: signal.note,
      payload: signal as unknown as Record<string, string | number>,
    });
    setDetailDrawerOpen(true);
  };

  const handleMatrixPoint = (point: any) => {
    setActiveSelection({
      chartId: "matrix",
      chartTitle: "Risk / Opportunity Matrix",
      chartType: "scatter",
      category: point.name,
      seriesName: "Matrix point",
      dataKey: "name",
      value: point.revenue ?? point.revenuePotential ?? 0,
      note: `Risk: ${point.risk ?? "N/A"}, Workers: ${point.workers ?? "N/A"}`,
      payload: point,
    });
    setDetailDrawerOpen(true);
  };

  const visualizationMethods = [
    "vector-displacement",
    "chromatic-aberration",
    "geometric-anchor",
    "subtractive-masking",
    "procedural-grid",
    "algorithmic-edge",
    "concentric-ripple",
    "negative-space",
    "vector-lattice",
    "color-shift",
    "synchronous-path",
    "vector-node",
    "radiant-gradient",
    "isometric-slice",
    "semantic-zoom",
    "holographic-depth",
    "kinetic-vector",
    "contextual-morph",
    "interactive-filter",
    "zoom-pan",
    "linked-visualizations",
    "click-reveal",
  ];

  const getMethodDataCount = (methodId: string) => {
    if (methodId === "click-reveal") return activeSelection ? 1 : 0;
    if (methodId === "semantic-zoom") return vizModel.metrics.length + vizModel.signals.length;
    return primaryCharts.length + vizModel.riskMatrix.length + vizModel.opportunityMatrix.length;
  };

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar
          eyebrow="Portal 02"
          title="Data Visualization"
          subtitle="Advanced visualization lab for profile-level intelligence, using the same source data as Data Profiles."
          actions={<IntelligenceSelector companies={dataset.companies} value={companyId} onChange={setCompanyId} />}
          status={<IntelligenceStatusBadge status={status.sourceStatus} lastUpdated={status.lastUpdated} />}
        />
        <DataQualityBanner warnings={status.dataQualityWarnings} />

        {/* Profile Summary Strip */}
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-cyan-100/12 bg-black/18 px-4 py-3">
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/60">Metrics:</p>
            <span className="text-sm font-bold text-cyan-50">{vizModel.metrics.length}</span>
          </div>
          <div className="h-4 w-px bg-cyan-100/20" />
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/60">Charts:</p>
            <span className="text-sm font-bold text-cyan-50">{vizModel.charts.length}</span>
          </div>
          <div className="h-4 w-px bg-cyan-100/20" />
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/60">Signals:</p>
            <span className="text-sm font-bold text-cyan-50">{vizModel.signals.length}</span>
          </div>
          <div className="h-4 w-px bg-cyan-100/20" />
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/60">Sources:</p>
            <span className="text-sm font-bold text-cyan-50">{vizModel.sourceRecords.length}</span>
          </div>
          <div className="h-4 w-px bg-cyan-100/20" />
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/60">Dossier:</p>
            <span className="text-sm font-bold text-cyan-50">{vizModel.dossierSections.length}</span>
          </div>
          <div className="h-4 w-px bg-cyan-100/20" />
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/60">Risk:</p>
            <span className="text-sm font-bold text-cyan-50">{vizModel.riskMatrix.length > 0 ? "✓" : "—"}</span>
          </div>
          <div className="h-4 w-px bg-cyan-100/20" />
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/60">Opp:</p>
            <span className="text-sm font-bold text-cyan-50">{vizModel.opportunityMatrix.length > 0 ? "✓" : "—"}</span>
          </div>
          {intelligenceCharts.length > 0 && (
            <>
              <div className="h-4 w-px bg-cyan-100/20" />
              <div className="flex items-center gap-2">
                <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-200/60">Intel:</p>
                <span className="text-sm font-bold text-emerald-100">{intelligenceCharts.length}</span>
              </div>
            </>
          )}
        </div>

        {/* Method Rail */}
        <div className="mb-5">
          <p className="mb-3 text-xs uppercase tracking-[0.25em] text-cyan-100/35">Visualization method</p>
          <div className="flex flex-wrap gap-2">
            {visualizationMethods.map((methodId) => (
              <button
                key={methodId}
                onClick={() => {
                  setActiveMethod(methodId);
                  setFocusedChartId(null);
                }}
                className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                  activeMethod === methodId
                    ? "border-cyan-100/30 bg-cyan-100/10 text-cyan-50"
                    : "border-cyan-100/10 bg-white/[0.02] text-cyan-100/50 hover:border-cyan-100/20"
                }`}
              >
                {methodName(methodId)}
                <span className="ml-1.5 inline-block rounded-full bg-cyan-100/10 px-1.5 py-0.5 text-[9px] text-cyan-100/70">
                  {getMethodDataCount(methodId)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Active Method Header */}
        {activeMethod && (
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-100/35">Active method canvas</p>
              <h3 className="mt-1 text-xl font-bold text-white">{methodName(activeMethod)}</h3>
            </div>
            <div className="flex gap-2">
              {activeMethod === "zoom-pan" && focusedChartId && (
                <button
                  onClick={() => setFocusedChartId(null)}
                  className="rounded-lg border border-cyan-100/20 bg-cyan-100/5 px-3 py-1.5 text-xs text-cyan-50 transition hover:bg-cyan-100/10"
                >
                  Reset focus
                </button>
              )}
              {activeMethod === "zoom-pan" && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="rounded-lg border border-cyan-100/20 bg-cyan-100/5 px-3 py-1.5 text-xs text-cyan-50 transition hover:bg-cyan-100/10"
                >
                  {isExpanded ? "Collapse" : "Expand"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Method explanation panel */}
        <MethodExplanationPanel methodId={activeMethod} />

        {/* Interactive filter controls */}
        {activeMethod === "interactive-filter" && intelligence && intelligence.facts.length > 0 && (
          <div className="method-filter-bar mb-5 flex flex-wrap gap-3 rounded-xl border border-cyan-100/10 bg-black/24 p-3">
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
                  {f.options.map((o) => (
                    <option key={o} value={o} className="bg-slate-950 text-cyan-50">
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        {/* Contextual morph controls */}
        {activeMethod === "contextual-morph" && intelligence && intelligence.facts.length > 0 && (
          <div className="method-filter-bar mb-5 flex flex-wrap gap-3 rounded-xl border border-cyan-100/10 bg-black/24 p-3">
            {([
              { key: "category", label: "Category" },
              { key: "sourceType", label: "Source type" },
              { key: "confidence", label: "Confidence" },
              { key: "time", label: "Time" },
            ] as { key: typeof morphMode; label: string }[]).map((m) => (
              <button
                key={m.key}
                onClick={() => setMorphMode(m.key)}
                className={`rounded-lg border px-3 py-1 text-xs transition ${
                  morphMode === m.key
                    ? "border-cyan-100/30 bg-cyan-100/10 text-cyan-50"
                    : "border-cyan-100/10 bg-white/[0.02] text-cyan-100/50 hover:border-cyan-100/20"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        {/* A. Primary Chart Workspace */}
        {allCharts.length > 0 ? (
          <div className={`grid gap-5 ${isExpanded || (activeMethod === "zoom-pan" && focusedChartId) ? "xl:grid-cols-1" : "xl:grid-cols-2"}`}>
            {allCharts
              .filter((chart) => activeMethod !== "zoom-pan" || !focusedChartId || chart.id === focusedChartId)
              .map((chart, index) => {
                const isLoneChart = allCharts.length === 1;
                const isLastOdd = index === allCharts.length - 1 && allCharts.length % 2 === 1;
                const spanFull = isExpanded || chart.fullWidth || isLoneChart || isLastOdd || (activeMethod === "zoom-pan" && focusedChartId === chart.id);
                return (
                  <div key={chart.id} className={spanFull ? "xl:col-span-2" : ""}>
                    <ChartPanel
                      chart={chart}
                      index={index}
                      activeMethod={activeMethod}
                      selectedCategory={selectedCategory}
                      activeSelection={activeSelection}
                      focusedChartId={focusedChartId}
                      onFocusChart={setFocusedChartId}
                      onSelectCategory={handleSelectCategory}
                      onSelectDatum={handleSelectDatum}
                    />
                  </div>
                );
              })}
          </div>
        ) : (
          <GlassCard className="p-8 text-center">
            <p className="text-sm text-cyan-100/50">No chart definitions or metric data available for visualization.</p>
          </GlassCard>
        )}

        {/* B. Risk / Opportunity Matrix */}
        {(vizModel.riskMatrix.length > 0 || vizModel.opportunityMatrix.length > 0) && (
          <div className={`mt-5 grid gap-5 ${vizModel.riskMatrix.length && vizModel.opportunityMatrix.length ? "xl:grid-cols-2" : ""}`}>
            {vizModel.riskMatrix.length > 0 && (
              <MatrixPanel
                title="Risk Matrix"
                subtitle="Revenue exposure plotted against worker risk"
                data={vizModel.riskMatrix}
                xKey="revenue"
                yKey="risk"
                zKey="workers"
                xLabel="Revenue ($M)"
                yLabel="Risk score"
                activeMethod={activeMethod}
                onSelectPoint={handleMatrixPoint}
              />
            )}
            {vizModel.opportunityMatrix.length > 0 && (
              <MatrixPanel
                title="Opportunity Matrix"
                subtitle="Strategic value plotted against implementation complexity"
                data={vizModel.opportunityMatrix}
                xKey="revenuePotential"
                yKey="implementationComplexity"
                zKey="strategicValue"
                xLabel="Revenue potential"
                yLabel="Complexity"
                activeMethod={activeMethod}
                onSelectPoint={handleMatrixPoint}
              />
            )}
          </div>
        )}

        {/* C. Signal / Source Evidence Strip */}
        <SignalSourceStrip
          signals={vizModel.signals}
          sources={vizModel.sourceRecords}
          activeMethod={activeMethod}
          onSelectSignal={handleSelectSignal}
        />

        {/* D. Detail Drawer */}
        <VisualizationDetailDrawer
          isOpen={detailDrawerOpen}
          onClose={() => setDetailDrawerOpen(false)}
          selection={activeSelection}
          sourceRecords={vizModel.sourceRecords}
        />
        <StyleInjector />
      </section>
    </main>
  );
}
