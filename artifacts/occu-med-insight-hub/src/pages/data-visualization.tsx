import { useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
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
import { AlertTriangle, CheckCircle2, FileSearch, Link2, ShieldCheck, Sparkles } from "lucide-react";
import { Sidebar } from "@/components/insight/Sidebar";
import { IntelligenceSelector } from "@/components/insight/IntelligenceSelector";
import { IntelligenceOverview } from "@/components/insight/IntelligenceOverview";
import { IntelligenceInsightPanel } from "@/components/insight/IntelligenceInsightPanel";
import { LuminousChartTooltip } from "@/components/insight/LuminousChartTooltip";
import { useInsightData, useSelectedCompany } from "@/data/useInsightData";
import { getCompanyConfigOrDefault } from "@/company-configs";
import { resolveConfigCompanyId } from "@/company-configs/configIds";
import { intelligenceFactsToCharts } from "@/data/intelligenceCharts";
import { evaluateChartSuitability, type ChartSuitabilityResult } from "@/data/chartSuitability";
import { buildMetricCharts, finiteChartNumber, formatChartTick, formatChartValue, prepareChartForRendering } from "@/data/visualizationValidity";
import { categoryLabel } from "@/data/intelligenceActions";
import type {
  ChartDefinition,
  MetricDefinition,
  SignalDefinition,
  RiskMatrixPoint,
  OpportunityMatrixPoint,
  DossierSectionDefinition,
  TooltipFormat,
} from "@/company-configs/types";
import type { CompanyIntelligence, IntelligenceFact } from "@/data/types";

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

type EvidenceLabel = "verified" | "strong" | "search-derived" | "weak" | "lead" | "static";

type EvidenceBucket = {
  id: string;
  title: string;
  label: EvidenceLabel;
  icon: ReactNode;
  facts: IntelligenceFact[];
  empty: string;
};

const PALETTE = ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#fb7185", "#60a5fa", "#a3e635"];

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

function metricChartFromDefinitions(metrics: MetricDefinition[]): ChartDefinition[] {
  return buildMetricCharts(metrics, "metric-proof");
}

function enrichStaticChartSources(charts: ChartDefinition[], sources: any[]): ChartDefinition[] {
  if (!sources.length) return charts;
  return charts.map((chart) => ({
    ...chart,
    data: chart.data.map((row) => {
      const sourceId = row.sourceId as string | undefined;
      const matched = sourceId ? sources.find((s) => s.id === sourceId || s.sourceId === sourceId) : null;
      if (!matched) return { ...row, confidence: row.confidence ?? "static", sourceType: row.sourceType ?? "static" };
      return {
        ...row,
        sourceUrl: (matched.url ?? "") as string,
        sourceName: (matched.name ?? matched.label ?? matched.sourceName ?? "") as string,
        sourceType: (matched.type ?? "static") as string,
        confidence: (matched.confidence ?? "static") as string,
        date: (row.date ?? matched.date ?? "") as string,
      };
    }),
  }));
}

function useChartPanels(vizModel: ProfileVisualizationModel) {
  return useMemo(() => {
    const baseCharts = vizModel.charts.length ? vizModel.charts : metricChartFromDefinitions(vizModel.metrics);
    const primaryCharts = enrichStaticChartSources(baseCharts, vizModel.sourceRecords).map((chart) => prepareChartForRendering(chart).chart);
    return { primaryCharts };
  }, [vizModel.charts, vizModel.metrics, vizModel.sourceRecords]);
}

function formatTickByType(formatter: TooltipFormat | undefined) {
  return formatChartTick(formatter);
}

function formatValue(value: unknown, formatter?: TooltipFormat, unit?: string) {
  return formatChartValue(value, formatter, unit);
}

function sourceDomain(url?: string) {
  if (!url) return "No source URL";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] || "Source URL";
  }
}

function getSeriesColor(index: number, fallback?: string) {
  return fallback ?? PALETTE[index % PALETTE.length];
}

function getCategoryColor(category?: string) {
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

function evidenceLabelColor(label: string) {
  if (label === "verified") return "#34d399";
  if (label === "strong") return "#22d3ee";
  if (label === "search-derived" || label === "medium") return "#fbbf24";
  if (label === "lead") return "#94a3b8";
  if (label === "static") return "#a78bfa";
  return "#fb7185";
}

function getEvidenceConfidenceLabel(fact: IntelligenceFact | undefined): EvidenceLabel {
  if (!fact) return "static";
  const url = (fact.sourceUrl ?? "").toLowerCase();
  const sourceType = (fact.sourceType ?? "").toLowerCase();
  const provider = String(fact.metadata?.provider ?? "").toLowerCase();
  const recordType = String(fact.metadata?.recordType ?? "").toLowerCase();
  const extracted = fact.metadata?.extracted === true;

  if (fact.confidence === "link-only" || recordType.includes("lead")) return "lead";
  if (sourceType === "usaspending" || sourceType === "sec" || url.includes("usaspending.gov") || url.includes("sec.gov")) return "verified";
  if (sourceType === "official" || extracted || url.includes(".gov") || url.includes(".mil")) return "strong";
  if (sourceType === "web" || sourceType === "news" || provider === "serper" || provider === "exa" || provider === "tavily") return "search-derived";
  if (recordType.includes("static")) return "static";
  return "weak";
}

function chartGroup(chart: ChartDefinition): "contract" | "workforce" | "location" | "risk" | "source" | "other" {
  const text = `${chart.id} ${chart.title} ${chart.subtitle}`.toLowerCase();
  if (/award|contract|opportunit|sam|procurement/.test(text)) return "contract";
  if (/workforce|employee|job|hiring|safety|injury|trir|lwcr|rate/.test(text)) return "workforce";
  if (/location|region|geographic|network|gap|provider/.test(text)) return "location";
  if (/risk|matrix|opportunity/.test(text)) return "risk";
  if (/source|confidence|event|timeline|evidence/.test(text)) return "source";
  return "other";
}

function selectionFromDatum(chart: ChartDefinition, entry: Record<string, string | number>, seriesName: string, dataKey: string): ChartDatumSelection {
  const category = String(entry[chart.xKey] ?? entry.label ?? entry.region ?? entry.stage ?? entry.name ?? "Selected datum");
  return {
    chartId: chart.id,
    chartTitle: chart.title,
    chartType: chart.type,
    category,
    seriesName,
    dataKey,
    value: finiteChartNumber(entry[dataKey] ?? entry.value ?? entry.count) ?? Number.NaN,
    unit: entry.unit as string | undefined,
    formatter: chart.formatter,
    sourceId: entry.sourceId as string | undefined,
    payload: entry,
    sourceUrl: (entry.sourceUrl as string | undefined) || undefined,
    confidence: (entry.confidence as string | undefined) || undefined,
    date: (entry.date as string | undefined) || undefined,
    sourceType: (entry.sourceType as string | undefined) || undefined,
    intelligenceCategory: (entry.category as string | undefined) || undefined,
    summary: (entry.summary as string | undefined) || undefined,
    rawSnippet: (entry.rawSnippet as string | undefined) || undefined,
  };
}

function ReplacementVisualization({
  chart,
  suitability,
  onSelectDatum,
}: {
  chart: ChartDefinition;
  suitability: ChartSuitabilityResult;
  onSelectDatum: (selection: ChartDatumSelection) => void;
}) {
  const seriesKey = chart.series[0]?.dataKey ?? "value";
  const sorted = [...chart.data].sort((a, b) => (finiteChartNumber(b[seriesKey]) ?? Number.NEGATIVE_INFINITY) - (finiteChartNumber(a[seriesKey]) ?? Number.NEGATIVE_INFINITY));
  const first = sorted[0] ?? chart.data[0];
  const firstValue = finiteChartNumber(first?.[seriesKey] ?? first?.value ?? first?.count);
  const firstLabel = String(first?.[chart.xKey] ?? first?.label ?? first?.region ?? first?.stage ?? chart.title);

  if (suitability.representationType === "data-quality-warning" || suitability.representationType === "suppressed") {
    return (
      <div className="cinematic-proof-card cinematic-warning-card">
        <div className="cinematic-proof-icon"><AlertTriangle size={22} /></div>
        <p className="cinematic-proof-kicker">Data Quality Guardrail</p>
        <h3>{chart.title}</h3>
        <p>{suitability.reason}</p>
        <div className="cinematic-warning-list">
          {suitability.warnings.map((warning) => <span key={warning}>{warning}</span>)}
        </div>
      </div>
    );
  }

  if (suitability.representationType === "timeline-strip") {
    return (
      <div className="cinematic-proof-card">
        <p className="cinematic-proof-kicker">Timeline Evidence · {suitability.confidenceLabel}</p>
        <h3>{chart.title}</h3>
        <p>{suitability.reason}</p>
        <div className="cinematic-timeline-strip">
          {chart.data.slice(0, 6).map((row, index) => {
            const label = String(row[chart.xKey] ?? row.date ?? row.label ?? `Item ${index + 1}`);
            return (
              <button key={`${label}-${index}`} onClick={() => onSelectDatum(selectionFromDatum(chart, row, chart.series[0]?.name ?? "Evidence", seriesKey))}>
                <span />
                <b>{label}</b>
                <small>{formatValue(Number(row[seriesKey] ?? row.value ?? 0), chart.formatter, row.unit as string | undefined)}</small>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (suitability.representationType === "ranked-list") {
    return (
      <div className="cinematic-proof-card">
        <p className="cinematic-proof-kicker">Ranked Evidence · {suitability.confidenceLabel}</p>
        <h3>{chart.title}</h3>
        <p>{suitability.reason}</p>
        <div className="cinematic-ranked-list">
          {sorted.slice(0, 6).map((row, index) => {
            const label = String(row[chart.xKey] ?? row.label ?? row.region ?? `Item ${index + 1}`);
            return (
              <button key={`${label}-${index}`} onClick={() => onSelectDatum(selectionFromDatum(chart, row, chart.series[0]?.name ?? "Evidence", seriesKey))}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <b>{label}</b>
                <small>{formatValue(Number(row[seriesKey] ?? row.value ?? 0), chart.formatter, row.unit as string | undefined)}</small>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <button className="cinematic-proof-card cinematic-metric-proof" onClick={() => first && onSelectDatum(selectionFromDatum(chart, first, chart.series[0]?.name ?? "Evidence", seriesKey))}>
      <p className="cinematic-proof-kicker">Metric Proof · {suitability.confidenceLabel}</p>
      <h3>{chart.title}</h3>
      <div className="cinematic-proof-value">{formatValue(firstValue, chart.formatter, first?.unit as string | undefined)}</div>
      <p className="cinematic-proof-label">{firstLabel}</p>
      <p>{suitability.reason}</p>
      <span className="cinematic-proof-source">{sourceDomain(first?.sourceUrl as string | undefined)}</span>
    </button>
  );
}

function CinematicChart({
  chart,
  selectedCategory,
  onSelectCategory,
  onSelectDatum,
  height = 380,
}: {
  chart: ChartDefinition;
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  onSelectDatum: (selection: ChartDatumSelection) => void;
  height?: number;
}) {
  const suitability = evaluateChartSuitability(chart);
  chart = suitability.chart;

  if (suitability.representationType !== "chart") {
    return <ReplacementVisualization chart={chart} suitability={suitability} onSelectDatum={onSelectDatum} />;
  }

  const handleDatumClick = (entry: Record<string, string | number>, seriesName: string, dataKey: string) => {
    const category = String(entry[chart.xKey] ?? entry.label ?? entry.region ?? entry.stage ?? entry.name ?? "Selected datum");
    onSelectCategory(category);
    onSelectDatum(selectionFromDatum(chart, entry, seriesName, dataKey));
  };

  const renderChart = () => {
    if (chart.type === "line") {
      return (
        <LineChart data={chart.data}>
          <CartesianGrid stroke="rgba(255,255,255,.06)" />
          <XAxis dataKey={chart.xKey} stroke="rgba(207,250,254,.35)" tick={{ fontSize: 10 }} />
          <YAxis stroke="rgba(207,250,254,.35)" tick={{ fontSize: 11 }} domain={chart.domain} tickFormatter={formatTickByType(chart.formatter)} />
          {chart.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          <Tooltip content={<LuminousChartTooltip formatter={chart.formatter ?? "plain"} headline={chart.headline ?? "data focus"} />} />
          {chart.referenceLines?.map((ref, i) => <ReferenceLine key={i} y={ref.y} stroke={ref.stroke} strokeDasharray={ref.strokeDasharray} label={ref.label} />)}
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
                activeDot={{ r: 8, onClick: (_: any, entry: any) => handleDatumClick(entry.payload, s.name ?? s.dataKey, s.dataKey) }}
              />
            );
          })}
        </LineChart>
      );
    }

    if (chart.type === "area") {
      return (
        <AreaChart data={chart.data}>
          <CartesianGrid stroke="rgba(255,255,255,.06)" />
          <XAxis dataKey={chart.xKey} stroke="rgba(207,250,254,.35)" tick={{ fontSize: 10 }} />
          <YAxis stroke="rgba(207,250,254,.35)" tick={{ fontSize: 11 }} domain={chart.domain} tickFormatter={formatTickByType(chart.formatter)} />
          {chart.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          <Tooltip content={<LuminousChartTooltip formatter={chart.formatter ?? "plain"} headline={chart.headline ?? "data focus"} />} />
          {chart.series.map((s, i) => {
            const color = getSeriesColor(i, s.color);
            return (
              <Area
                key={s.dataKey}
                type="monotone"
                dataKey={s.dataKey}
                name={s.name ?? s.dataKey}
                stroke={color}
                fill={`${color}3d`}
                strokeWidth={3}
                activeDot={{ r: 8, onClick: (_: any, entry: any) => handleDatumClick(entry.payload, s.name ?? s.dataKey, s.dataKey) }}
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
          <CartesianGrid stroke="rgba(255,255,255,.06)" />
          <XAxis dataKey={xDataKey} stroke="rgba(207,250,254,.35)" tick={{ fontSize: 10 }} type="number" domain={[0, "auto"]} />
          <YAxis dataKey={yDataKey} stroke="rgba(207,250,254,.35)" tick={{ fontSize: 11 }} domain={chart.domain} type="number" />
          {chart.series.length > 2 && <ZAxis dataKey={chart.series[2]?.dataKey ?? "z"} range={[80, 520]} />}
          <Tooltip cursor={{ stroke: "rgba(34,211,238,.35)", strokeDasharray: "4 4" }} content={<LuminousChartTooltip headline={chart.headline ?? "data focus"} />} />
          <Scatter name="Data" data={chart.data} fill={chart.series[0]?.color ?? "#22d3ee"} onClick={(entry: any) => handleDatumClick(entry, "Data", xDataKey)} />
        </ScatterChart>
      );
    }

    return (
      <BarChart data={chart.data}>
        <CartesianGrid stroke="rgba(255,255,255,.06)" />
        <XAxis dataKey={chart.xKey} stroke="rgba(207,250,254,.35)" tick={{ fontSize: 10 }} />
        <YAxis stroke="rgba(207,250,254,.35)" tick={{ fontSize: 11 }} domain={chart.domain} tickFormatter={formatTickByType(chart.formatter)} />
        {chart.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        <Tooltip cursor={{ fill: "rgba(34,211,238,.06)" }} content={<LuminousChartTooltip formatter={chart.formatter ?? "plain"} headline={chart.headline ?? "data focus"} />} />
        {chart.referenceLines?.map((ref, i) => <ReferenceLine key={i} y={ref.y} stroke={ref.stroke} strokeDasharray={ref.strokeDasharray} label={ref.label} />)}
        {chart.series.map((s, i) => {
          const color = getSeriesColor(i, s.color);
          return (
            <Bar key={s.dataKey} dataKey={s.dataKey} name={s.name ?? s.dataKey} fill={color} radius={s.radius ?? [10, 10, 0, 0]} stackId={s.stackId} onClick={(_, index) => handleDatumClick(chart.data[index], s.name ?? s.dataKey, s.dataKey)}>
              {chart.data.map((entry, idx) => {
                const category = String(entry[chart.xKey] ?? entry.label ?? "");
                const isSelected = selectedCategory === category;
                return <Cell key={`cell-${idx}`} fill={getCategoryColor(String(entry.category ?? "")) || color} opacity={selectedCategory ? (isSelected ? 1 : 0.35) : 1} />;
              })}
            </Bar>
          );
        })}
      </BarChart>
    );
  };

  return (
    <div className="cinematic-chart-stage" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">{renderChart() as any}</ResponsiveContainer>
    </div>
  );
}

function CinematicPanel({ chart, selectedCategory, onSelectCategory, onSelectDatum }: { chart: ChartDefinition; selectedCategory: string | null; onSelectCategory: (category: string | null) => void; onSelectDatum: (selection: ChartDatumSelection) => void }) {
  const suitability = evaluateChartSuitability(chart);
  return (
    <motion.div className={`cinematic-chart-panel validity-${suitability.representationType}`} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
      <div className="cinematic-panel-header">
        <div>
          <p className="cinematic-scene-eyebrow">{suitability.representationType === "chart" ? "Validated Chart" : "Chart Guardrail"}</p>
          <h3>{chart.title}</h3>
          <p>{chart.subtitle}</p>
        </div>
        <span className="cinematic-confidence-badge" style={{ color: evidenceLabelColor(suitability.confidenceLabel), borderColor: `${evidenceLabelColor(suitability.confidenceLabel)}55` }}>{suitability.confidenceLabel}</span>
      </div>
      <CinematicChart chart={chart} selectedCategory={selectedCategory} onSelectCategory={onSelectCategory} onSelectDatum={onSelectDatum} />
      {suitability.reason && <p className="cinematic-validity-reason">{suitability.reason}</p>}
    </motion.div>
  );
}

function SceneSection({ eyebrow, title, subtitle, children, alt = false }: { eyebrow: string; title: string; subtitle: string; children: ReactNode; alt?: boolean }) {
  return (
    <section className={`cinematic-scene-section ${alt ? "cinematic-scene-alt" : ""}`}>
      <div className="cinematic-scene-sticky relaxed">
        <motion.div initial={{ opacity: 0, y: 38 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
          <p className="cinematic-scene-eyebrow">{eyebrow}</p>
          <h2 className="cinematic-scene-title">{title}</h2>
          <p className="cinematic-scene-subtitle">{subtitle}</p>
        </motion.div>
        {children}
      </div>
    </section>
  );
}

function EmptyScene({ message }: { message: string }) {
  return <div className="cinematic-proof-card cinematic-warning-card"><p className="cinematic-proof-kicker">No chart rendered</p><h3>{message}</h3><p>Evidence remains available in the Source Ledger below. The page does not create charts when the available data would be misleading.</p></div>;
}

function ChartScene({ charts, selectedCategory, onSelectCategory, onSelectDatum }: { charts: ChartDefinition[]; selectedCategory: string | null; onSelectCategory: (category: string | null) => void; onSelectDatum: (selection: ChartDatumSelection) => void }) {
  if (!charts.length) return <EmptyScene message="No analytically valid charts for this scene." />;
  return (
    <div className="cinematic-chart-grid">
      {charts.slice(0, 3).map((chart) => <CinematicPanel key={chart.id} chart={chart} selectedCategory={selectedCategory} onSelectCategory={onSelectCategory} onSelectDatum={onSelectDatum} />)}
    </div>
  );
}

function EvidenceItem({ fact }: { fact: IntelligenceFact }) {
  const label = getEvidenceConfidenceLabel(fact);
  const provider = String(fact.metadata?.provider ?? fact.sourceType ?? "unknown");
  const alias = String(fact.metadata?.matchedAlias ?? "");
  const query = String(fact.metadata?.query ?? "");
  const extracted = fact.metadata?.extracted === true;

  return (
    <article className="cinematic-ledger-item">
      <div className="cinematic-ledger-item-top">
        <span style={{ color: evidenceLabelColor(label), borderColor: `${evidenceLabelColor(label)}55` }}>{label}</span>
        <small>{provider}</small>
      </div>
      <h4>{fact.title}</h4>
      <p>{fact.summary}</p>
      <div className="cinematic-ledger-meta">
        <span>{categoryLabel(fact.category)}</span>
        <span>{sourceDomain(fact.sourceUrl)}</span>
        {alias && <span>alias: {alias}</span>}
        {extracted && <span>extracted page</span>}
      </div>
      {query && <p className="cinematic-ledger-query">query: {query}</p>}
      {fact.sourceUrl && <a href={fact.sourceUrl} target="_blank" rel="noopener noreferrer">Open source <Link2 size={12} /></a>}
    </article>
  );
}

function EvidenceLedger({ facts, sourceRecords }: { facts: IntelligenceFact[]; sourceRecords: any[] }) {
  const buckets: EvidenceBucket[] = [
    { id: "verified", title: "Verified structured facts", label: "verified", icon: <ShieldCheck size={18} />, facts: facts.filter((f) => getEvidenceConfidenceLabel(f) === "verified"), empty: "No verified USASpending/SEC records yet." },
    { id: "strong", title: "Strong primary-source facts", label: "strong", icon: <CheckCircle2 size={18} />, facts: facts.filter((f) => getEvidenceConfidenceLabel(f) === "strong"), empty: "No extracted/official primary source facts yet." },
    { id: "search", title: "Search-derived facts", label: "search-derived", icon: <FileSearch size={18} />, facts: facts.filter((f) => getEvidenceConfidenceLabel(f) === "search-derived" || getEvidenceConfidenceLabel(f) === "weak"), empty: "No search-derived facts yet." },
    { id: "lead", title: "Source leads", label: "lead", icon: <Link2 size={18} />, facts: facts.filter((f) => getEvidenceConfidenceLabel(f) === "lead"), empty: "No manual-review leads." },
  ];

  return (
    <div className="cinematic-ledger-grid">
      {buckets.map((bucket) => (
        <motion.div key={bucket.id} className="cinematic-ledger-bucket" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.55 }}>
          <div className="cinematic-ledger-bucket-header">
            <span style={{ color: evidenceLabelColor(bucket.label) }}>{bucket.icon}</span>
            <h3>{bucket.title}</h3>
            <b>{bucket.facts.length}</b>
          </div>
          <div className="cinematic-ledger-items">
            {bucket.facts.slice(0, 5).map((fact) => <EvidenceItem key={fact.id} fact={fact} />)}
            {bucket.facts.length === 0 && <p className="cinematic-ledger-empty">{bucket.empty}</p>}
          </div>
        </motion.div>
      ))}
      <motion.div className="cinematic-ledger-bucket" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.55 }}>
        <div className="cinematic-ledger-bucket-header">
          <span style={{ color: evidenceLabelColor("static") }}><Sparkles size={18} /></span>
          <h3>Static fallback sources</h3>
          <b>{sourceRecords.length}</b>
        </div>
        <div className="cinematic-ledger-items">
          {sourceRecords.slice(0, 5).map((source, index) => (
            <article key={source.id ?? index} className="cinematic-ledger-item">
              <div className="cinematic-ledger-item-top"><span style={{ color: evidenceLabelColor("static"), borderColor: `${evidenceLabelColor("static")}55` }}>static</span><small>{source.type ?? "source"}</small></div>
              <h4>{source.label ?? source.name ?? source.sourceName ?? "Static source"}</h4>
              <p>{source.note ?? source.summary ?? "Workbook/config/dossier source used as fallback context."}</p>
              {source.url && <a href={source.url} target="_blank" rel="noopener noreferrer">Open source <Link2 size={12} /></a>}
            </article>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function MatrixPlane({ title, points, xKey, yKey, borderColor, onSelectPoint }: { title: string; points: any[]; xKey: string; yKey: string; borderColor: string; onSelectPoint: (point: any) => void }) {
  const valid = points.filter((point) => finiteChartNumber(point[xKey]) !== undefined && finiteChartNumber(point[yKey]) !== undefined);
  const xs = valid.map((point) => finiteChartNumber(point[xKey]) as number);
  const ys = valid.map((point) => finiteChartNumber(point[yKey]) as number);
  const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const position = (value: number, min: number, max: number) => max === min ? 50 : 8 + ((value - min) / (max - min)) * 76;
  return (
    <div className="cinematic-matrix-plane">
      <p className="cinematic-proof-kicker">{title}</p>
      <span className="cinematic-matrix-axis cinematic-matrix-axis-x">Revenue / opportunity value →</span>
      <span className="cinematic-matrix-axis cinematic-matrix-axis-y">Strength / risk →</span>
      {valid.slice(0, 10).map((point) => {
        const x = finiteChartNumber(point[xKey]) as number;
        const y = finiteChartNumber(point[yKey]) as number;
        return <button key={`${title}-${point.name}`} className="cinematic-matrix-orb" style={{ left: `${position(x, minX, maxX)}%`, bottom: `${position(y, minY, maxY)}%`, borderColor }} onClick={() => onSelectPoint(point)}><span>{title}</span><b>{point.name}</b><small>X {x.toLocaleString()} · Y {y.toLocaleString()}</small></button>;
      })}
    </div>
  );
}

function MatrixScene({ riskMatrix, opportunityMatrix, onSelectPoint }: { riskMatrix: RiskMatrixPoint[]; opportunityMatrix: OpportunityMatrixPoint[]; onSelectPoint: (point: any) => void }) {
  if (!riskMatrix.length && !opportunityMatrix.length) return <EmptyScene message="No risk/opportunity matrix points available." />;
  return <div className="cinematic-matrix-grid"><MatrixPlane title="Risk" points={riskMatrix.map((point) => ({ ...point, kind: "Risk" }))} xKey="revenue" yKey="risk" borderColor="rgba(251,113,133,.45)" onSelectPoint={onSelectPoint} /><MatrixPlane title="Opportunity" points={opportunityMatrix.map((point) => ({ ...point, kind: "Opportunity" }))} xKey="revenuePotential" yKey="strategicValue" borderColor="rgba(52,211,153,.45)" onSelectPoint={onSelectPoint} /></div>;
}

export default function DataVisualization() {
  const { dataset } = useInsightData();
  const { companyId, setCompanyId, company } = useSelectedCompany(dataset.companies);
  const resolvedCompanyId = resolveConfigCompanyId(companyId);
  const config = getCompanyConfigOrDefault(resolvedCompanyId);
  const sources = dataset.sources.filter((source) => resolveConfigCompanyId(source.companyId) === resolvedCompanyId);
  const storedIntelligence = dataset.intelligence.find((item) => resolveConfigCompanyId(item.companyId) === resolvedCompanyId);

  const [activeSelection, setActiveSelection] = useState<ChartDatumSelection | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [localIntelligence, setLocalIntelligence] = useState<CompanyIntelligence | undefined>(undefined);

  const intelligence = localIntelligence ?? storedIntelligence;
  const facts = intelligence?.facts ?? [];
  const vizModel = buildProfileVisualizationModel({
    company,
    config,
    metrics: dataset.metrics.filter((metric) => resolveConfigCompanyId(metric.companyId) === resolvedCompanyId),
    sources,
  });
  const { primaryCharts } = useChartPanels(vizModel);
  const intelligenceCharts = useMemo(() => intelligenceFactsToCharts(intelligence), [intelligence]);
  const allCharts = useMemo(() => [...primaryCharts, ...intelligenceCharts], [primaryCharts, intelligenceCharts]);
  const invalidCharts = allCharts.filter((chart) => evaluateChartSuitability(chart).representationType !== "chart");

  const contractCharts = allCharts.filter((chart) => chartGroup(chart) === "contract");
  const workforceCharts = allCharts.filter((chart) => chartGroup(chart) === "workforce" || chartGroup(chart) === "other");
  const locationCharts = allCharts.filter((chart) => chartGroup(chart) === "location");
  const evidenceCharts = allCharts.filter((chart) => chartGroup(chart) === "source");

  const liveFacts = facts.filter((fact) => fact.confidence !== "link-only");
  const verifiedFacts = facts.filter((fact) => getEvidenceConfidenceLabel(fact) === "verified");
  const searchDerivedFacts = facts.filter((fact) => getEvidenceConfidenceLabel(fact) === "search-derived" || getEvidenceConfidenceLabel(fact) === "weak");
  const sourceLeads = facts.filter((fact) => getEvidenceConfidenceLabel(fact) === "lead");
  const providerCount = new Set(facts.map((fact) => String(fact.metadata?.provider ?? fact.sourceType)).filter(Boolean)).size;

  const handleSelectDatum = (selection: ChartDatumSelection) => { setActiveSelection(selection); setDetailDrawerOpen(true); };
  const handleSelectCategory = (category: string | null) => { setSelectedCategory((prev) => (prev === category ? null : category)); };
  const handleMatrixPoint = (point: any) => {
    setActiveSelection({ chartId: "matrix", chartTitle: "Risk / Opportunity Matrix", chartType: "scatter", category: point.name, seriesName: point.kind ?? "Matrix point", dataKey: "name", value: finiteChartNumber(point.revenue ?? point.revenuePotential ?? point.risk) ?? Number.NaN, note: `Risk: ${point.risk ?? "N/A"}, Workers: ${point.workers ?? "N/A"}`, payload: point });
    setDetailDrawerOpen(true);
  };

  const insightContext = {
    companyName: company?.name ?? resolvedCompanyId,
    intelligence,
    sourceRecords: vizModel.sourceRecords,
    signals: vizModel.signals,
    dossierSections: vizModel.dossierSections,
    metrics: vizModel.metrics,
    riskMatrix: vizModel.riskMatrix,
    opportunityMatrix: vizModel.opportunityMatrix,
  };

  return (
    <main className="aurora-bg cinematic-page min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 lg:ml-[210px]">
        <div className="cinematic-topbar">
          <span className="cinematic-topbar-label">Data Visualization</span>
          <IntelligenceSelector companies={dataset.companies} value={companyId} onChange={setCompanyId} />
        </div>

        <div className="cinematic-overview-wrap">
          <IntelligenceOverview companyName={company?.name ?? resolvedCompanyId} companyId={resolvedCompanyId} intelligence={intelligence} onIngestComplete={(intel) => setLocalIntelligence(intel)} />
        </div>

        <section className="cinematic-hero-section">
          <motion.div className="cinematic-hero-content" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
            <p className="cinematic-hero-eyebrow">Source-aware visualization engine</p>
            <h1 className="cinematic-hero-title">Cinematic intelligence without fake charts.</h1>
            <p className="cinematic-hero-subtitle">
              {company?.name ?? resolvedCompanyId} is shown through validated charts, proof objects, source ledgers, and data-quality guardrails. Single-value bars, unknown-region bars, and fake trends are suppressed.
            </p>
            <div className="cinematic-hero-metrics">
              {[
                [liveFacts.length, "live facts"],
                [verifiedFacts.length, "verified"],
                [searchDerivedFacts.length, "search-derived"],
                [sourceLeads.length, "source leads"],
                [sources.length, "static sources"],
                [invalidCharts.length, "chart guardrails"],
              ].map(([value, label]) => (
                <div key={label as string} className="cinematic-hero-metric"><span className="cinematic-hero-metric-value">{value}</span><span className="cinematic-hero-metric-label">{label}</span></div>
              ))}
            </div>
            <div className="cinematic-evidence-statement">
              Live ingestion found {liveFacts.length} source-backed facts from {providerCount} provider/source type{providerCount === 1 ? "" : "s"}. {sourceLeads.length} item{sourceLeads.length === 1 ? "" : "s"} require manual review. {verifiedFacts.length === 0 && searchDerivedFacts.length > 0 ? "Data is source-led, not fully verified." : "Verified records are separated from search-derived evidence."}
            </div>
          </motion.div>
        </section>

        <SceneSection eyebrow="Scene 01" title="Contracts and opportunities" subtitle="Contract and opportunity visuals only render when the data has meaningful categories or time points. One-off signals become evidence capsules.">
          <ChartScene charts={contractCharts} selectedCategory={selectedCategory} onSelectCategory={handleSelectCategory} onSelectDatum={handleSelectDatum} />
        </SceneSection>

        <SceneSection eyebrow="Scene 02" title="Workforce and safety" subtitle="Static and live workforce/safety signals are checked before charting. A single metric becomes a proof object, not a fake bar graph." alt>
          <ChartScene charts={workforceCharts} selectedCategory={selectedCategory} onSelectCategory={handleSelectCategory} onSelectDatum={handleSelectDatum} />
        </SceneSection>

        <SceneSection eyebrow="Scene 03" title="Location and network exposure" subtitle="Unknown geography is not charted as a region. Resolved locations can chart; unresolved locations move to data-quality warnings and the evidence ledger.">
          <ChartScene charts={locationCharts} selectedCategory={selectedCategory} onSelectCategory={handleSelectCategory} onSelectDatum={handleSelectDatum} />
        </SceneSection>

        <SceneSection eyebrow="Scene 04" title="Risk and opportunity matrix" subtitle="Matrix points remain interactive, but they are no longer mixed into the evidence ledger as fake chart categories." alt>
          <MatrixScene riskMatrix={vizModel.riskMatrix} opportunityMatrix={vizModel.opportunityMatrix} onSelectPoint={handleMatrixPoint} />
        </SceneSection>

        <SceneSection eyebrow="Scene 05" title="Evidence ledger" subtitle="Verified facts, strong primary-source facts, search-derived facts, source leads, and static fallback are separated so the user can judge validity.">
          <EvidenceLedger facts={facts} sourceRecords={vizModel.sourceRecords} />
        </SceneSection>

        {evidenceCharts.length > 0 && (
          <SceneSection eyebrow="Scene 06" title="Source confidence charts" subtitle="Only valid source-confidence charts render here. Weak or one-point source data remains in the ledger." alt>
            <ChartScene charts={evidenceCharts} selectedCategory={selectedCategory} onSelectCategory={handleSelectCategory} onSelectDatum={handleSelectDatum} />
          </SceneSection>
        )}

        <IntelligenceInsightPanel isOpen={detailDrawerOpen} onClose={() => setDetailDrawerOpen(false)} selection={activeSelection} context={insightContext} />
      </section>
    </main>
  );
}
