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
import type {
  ChartDefinition,
  MetricDefinition,
  SignalDefinition,
  RiskMatrixPoint,
  OpportunityMatrixPoint,
  DossierSectionDefinition,
  TooltipFormat,
} from "@/company-configs/types";

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

function methodName(methodId: string) {
  return (
    {
      "vector-displacement": "Vector Displacement Mapping",
      "chromatic-aberration": "Chromatic Aberration Highlighting",
      "geometric-anchor": "Geometric Anchor Snapping",
      "subtractive-masking": "Subtractive Masking Overlays",
      "procedural-grid": "Procedural Grid Resonances",
      "algorithmic-edge": "Algorithmic Edge-Tracing",
      "concentric-ripple": "Concentric Ripple Metrics",
      "negative-space": "Negative Space Inversion",
      "vector-lattice": "Vector Lattice Distortion",
      "color-shift": "Color-Shift Isometry",
      "synchronous-path": "Synchronous Path Illumination",
      "vector-node": "Vector Node Expansion",
      "radiant-gradient": "Radiant Gradient Focus",
      "isometric-slice": "Isometric Slice-View",
      "semantic-zoom": "Generative Semantic Zoom",
      "holographic-depth": "Holographic Depth Layers",
      "kinetic-vector": "Kinetic Vector Transitions",
      "contextual-morph": "Contextual Data Morphing",
      "interactive-filter": "Interactive Filtering",
      "zoom-pan": "Zoom and Pan",
      "linked-visualizations": "Linked Visualizations / Brushing",
      "click-reveal": "Click-to-Reveal",
    } as Record<string, string>
  )[methodId];
}

function ChartPanel({
  chart,
  index,
  activeMethod,
  selectedCategory,
  onSelectCategory,
  onSelectDatum,
}: {
  chart: ChartDefinition;
  index: number;
  activeMethod: string;
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  onSelectDatum: (selection: ChartDatumSelection) => void;
}) {
  const isLinkedBrushing = activeMethod === "linked-visualizations";
  const isRadiant = activeMethod === "radiant-gradient";
  const isDimmed = activeMethod === "negative-space";
  const isHolographic = activeMethod === "holographic-depth";
  const isIsometric = activeMethod === "isometric-slice";
  const isChromatic = activeMethod === "chromatic-aberration";
  const isPulse = activeMethod === "kinetic-vector";
  const height = chartHeight(chart);

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
      note: entry.note as string | undefined,
      payload: entry as Record<string, string | number>,
    });
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
    isChromatic ? "shadow-[0_0_24px_rgba(239,68,68,0.12),0_0_24px_rgba(6,182,212,0.12)]" : "",
    isDimmed ? "shadow-[inset_0_0_40px_rgba(0,0,0,0.6)]" : "",
    isHolographic ? "holographic-panel" : "",
    isIsometric ? "hover:translate-y-[-4px] hover:shadow-[8px_8px_0_rgba(34,211,238,0.15)]" : "",
    isPulse ? "animate-pulse-once" : "",
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
        {chart.series.map((s, i) => {
          const color = getSeriesColor(i, s.color);
          return (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name ?? s.dataKey}
              stroke={color}
              strokeWidth={isLinkedBrushing && selectedCategory ? 2 : 3}
              dot={
                isLinkedBrushing && selectedCategory
                  ? { r: 4 }
                  : isChromatic
                    ? { r: 6, stroke: "rgba(239,68,68,0.8)", strokeWidth: 2, fill: color }
                    : { r: 5 }
              }
              activeDot={{
                r: 8,
                onClick: (_: any, entry: any) => handleBarClick(entry.payload, s.name ?? s.dataKey, s.dataKey, color),
              }}
              opacity={isRadiant && selectedCategory ? 0.35 : 1}
              className={isSynchronousPath(activeMethod) ? "synchronous-path-line" : ""}
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
              activeDot={{
                r: 8,
                onClick: (_: any, entry: any) => handleBarClick(entry.payload, s.name ?? s.dataKey, s.dataKey, color),
              }}
              opacity={isRadiant && selectedCategory ? 0.35 : 1}
              className={isAlgorithmicEdge(activeMethod) ? "algorithmic-edge-area" : ""}
            />
          );
        })}
      </AreaChart>
    );
  }

  if (chart.type === "scatter") {
    return renderCartesian(
      <ScatterChart>
        <CartesianGrid stroke="rgba(255,255,255,.08)" />
        <XAxis
          dataKey={chart.series[0]?.dataKey ?? "x"}
          name={chart.series[0]?.name ?? "X"}
          stroke="rgba(207,250,254,.45)"
          tick={{ fontSize: 10 }}
          tickFormatter={formatTickByType(chart.formatter)}
        />
        <YAxis
          dataKey={chart.series[1]?.dataKey ?? "y"}
          name={chart.series[1]?.name ?? "Y"}
          stroke="rgba(207,250,254,.45)"
          tick={{ fontSize: 11 }}
          domain={chart.domain}
        />
        {chart.series.length > 2 && <ZAxis dataKey={chart.series[2]?.dataKey ?? "z"} range={[80, 520]} />}
        <Tooltip cursor={{ stroke: "rgba(34,211,238,.35)", strokeDasharray: "4 4" }} content={<LuminousChartTooltip headline={chart.headline ?? "data focus"} />} />
        <Scatter
          name="Data"
          data={chart.data}
          fill={chart.series[0]?.color ?? "#22d3ee"}
          onClick={handleScatterClick}
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
                  fill={isLinked ? "#facc15" : isSelected ? "#ffffff" : color}
                  opacity={isRadiant && selectedCategory ? (isSelected ? 1 : 0.3) : isDimmed ? 0.4 : 1}
                  className={[
                    isChromatic ? "chromatic-cell" : "",
                    isIsometric && isSelected ? "isometric-lift" : "",
                    isPulse && isSelected ? "pulse-bar" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              );
            })}
          </Bar>
        );
      })}
    </BarChart>,
    activeMethod === "geometric-anchor" ? (
      <div className="pointer-events-none absolute inset-0 crosshair-overlay" aria-hidden />
    ) : null
  );
}

function isSynchronousPath(method: string) {
  return method === "synchronous-path";
}

function isAlgorithmicEdge(method: string) {
  return method === "algorithmic-edge";
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
  return (
    <GlassCard className="p-5">
      <div className="mb-4">
        <h3 className="font-bold text-white">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-cyan-100/55">{subtitle}</p> : null}
      </div>
      <div className="w-full" style={{ height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            <CartesianGrid stroke="rgba(255,255,255,.08)" />
            <XAxis dataKey={xKey as string} name={xLabel} stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
            <YAxis dataKey={yKey as string} name={yLabel} stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} domain={[0, "auto"]} />
            <ZAxis dataKey={zKey as string} range={[80, 520]} />
            <Tooltip cursor={{ stroke: "rgba(34,211,238,.35)", strokeDasharray: "4 4" }} content={<LuminousChartTooltip headline={title} />} />
            <Scatter name="Data" data={data} fill={color} onClick={(_, index) => onSelectPoint(data[index])} />
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
            {sources.slice(0, 8).map((source, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3"
              >
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                <div>
                  <p className="text-sm font-semibold text-cyan-50">{source.name ?? source.sourceName ?? "Source"}</p>
                  {source.type ? <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/50">{source.type}</p> : null}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
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

  const [activeMethod, setActiveMethod] = useState<string>("vector-displacement");
  const [activeSelection, setActiveSelection] = useState<ChartDatumSelection | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const vizModel = buildProfileVisualizationModel({
    company,
    config,
    metrics: dataset.metrics.filter((metric) => resolveConfigCompanyId(metric.companyId) === resolvedCompanyId),
    sources,
  });

  const { primaryCharts } = useChartPanels(vizModel);

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
        </div>

        {/* Method Rail */}
        <div className="mb-5">
          <p className="mb-3 text-xs uppercase tracking-[0.25em] text-cyan-100/35">Visualization method</p>
          <div className="flex flex-wrap gap-2">
            {visualizationMethods.map((methodId) => (
              <button
                key={methodId}
                onClick={() => setActiveMethod(methodId)}
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

        {/* A. Primary Chart Workspace */}
        {primaryCharts.length > 0 ? (
          <div className={`grid gap-5 ${isExpanded ? "xl:grid-cols-1" : "xl:grid-cols-2"}`}>
            {primaryCharts.map((chart, index) => (
              <div key={chart.id} className={chart.fullWidth || isExpanded ? "xl:col-span-2" : ""}>
                <ChartPanel
                  chart={chart}
                  index={index}
                  activeMethod={activeMethod}
                  selectedCategory={selectedCategory}
                  onSelectCategory={handleSelectCategory}
                  onSelectDatum={handleSelectDatum}
                />
              </div>
            ))}
          </div>
        ) : (
          <GlassCard className="p-8 text-center">
            <p className="text-sm text-cyan-100/50">No chart definitions or metric data available for visualization.</p>
          </GlassCard>
        )}

        {/* B. Risk / Opportunity Matrix */}
        {(vizModel.riskMatrix.length > 0 || vizModel.opportunityMatrix.length > 0) && (
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
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
      </section>
    </main>
  );
}
