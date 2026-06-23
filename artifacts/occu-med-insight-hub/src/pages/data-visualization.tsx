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
  if (!metrics.length) return [];
  const categories = [...new Set(metrics.map((m) => m.category))];
  return categories.map((category, index) => ({
    id: `metric-proof-${category}-${index}`,
    title: `${category.charAt(0).toUpperCase() + category.slice(1)} Metrics`,
    subtitle: `Static profile metrics for ${category}. Single values render as proof objects instead of misleading charts.`,
    type: "bar" as const,
    xKey: "label",
    data: metrics
      .filter((m) => m.category === category)
      .map((m) => ({
        label: m.label,
        value: m.value,
        id: m.id,
        unit: m.unit,
        category: m.category,
        sourceId: m.sourceId ?? "",
        confidence: "static",
        sourceType: "static",
      })),
    series: [{ dataKey: "value", name: "Value", color: PALETTE[index % PALETTE.length] }],
    formatter: "plain",
    headline: `${category} metric focus`,
  }));
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
    const primaryCharts = enrichStaticChartSources(baseCharts, vizModel.sourceRecords);
    return { primaryCharts };
  }, [vizModel.charts, vizModel.metrics, vizModel.sourceRecords]);
}

function formatTickByType(formatter: TooltipFormat | undefined) {
  if (formatter === "currencyM") return (v: number) => `$${v}M`;
  if (formatter === "currencyK") return (v: number) => `$${v}K`;
  if (formatter === "percent") return (v: number) => `${v}%`;
  if (formatter === "hoursM") return (v: number) => `${v}M hrs`;
  return undefined;
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
    value: Number(entry[dataKey] ?? entry.value ?? entry.count ?? 0),
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
  const sorted = [...chart.data].sort((a, b) => Number(b[seriesKey] ?? 0) - Number(a[seriesKey] ?? 0));
  const first = sorted[0] ?? chart.data[0];
  const firstValue = Number(first?.[seriesKey] ?? first?.value ?? first?.count ?? 0);
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

function MatrixScene({ riskMatrix, opportunityMatrix, onSelectPoint }: { riskMatrix: RiskMatrixPoint[]; opportunityMatrix: OpportunityMatrixPoint[]; onSelectPoint: (point: any) => void }) {
  const points = [...riskMatrix.map((p) => ({ ...p, kind: "Risk", x: p.risk ?? 0, y: p.workers ?? 0 })), ...opportunityMatrix.map((p) => ({ ...p, kind: "Opportunity", x: p.revenuePotential ?? 0, y: p.strategicValue ?? 0 }))];
  if (!points.length) return <EmptyScene message="No risk/opportunity matrix points available." />;
  return (
    <div className="cinematic-matrix-stage">
      {points.slice(0, 14).map((point, index) => (
        <button key={`${point.name}-${index}`} className="cinematic-matrix-orb" style={{ left: `${12 + (index % 7) * 12}%`, top: `${24 + Math.floor(index / 7) * 24}%`, borderColor: point.kind === "Risk" ? "rgba(251,113,133,.45)" : "rgba(52,211,153,.45)" }} onClick={() => onSelectPoint(point)}>
          <span>{point.kind}</span>
          <b>{point.name}</b>
          <small>{point.kind === "Risk" ? `Risk ${point.risk ?? "N/A"}` : `Value ${point.revenuePotential ?? "N/A"}`}</small>
        </button>
      ))}
    </div>
  );
}

function StyleInjector() {
  return (
    <style>{`
      .cinematic-page { color: white; }
      .cinematic-topbar { position: sticky; top: 0; z-index: 30; display:flex; align-items:center; gap:.8rem; padding:.8rem 3rem; border-bottom:1px solid rgba(103,232,249,.14); background:rgba(3,8,19,.72); backdrop-filter: blur(22px); }
      .cinematic-topbar-label { font-size:.68rem; letter-spacing:.22em; text-transform:uppercase; color:rgba(207,250,254,.55); }
      .cinematic-overview-wrap { padding:1rem 3rem 0; }
      .cinematic-hero-section { position:relative; min-height:92vh; display:grid; place-items:center; overflow:hidden; }
      .cinematic-hero-section::before { content:""; position:absolute; inset:-20%; background:radial-gradient(circle at 50% 48%, rgba(34,211,238,.18), transparent 24rem), radial-gradient(circle at 28% 72%, rgba(167,139,250,.12), transparent 22rem); filter:blur(12px); }
      .cinematic-hero-content { position:relative; max-width:1050px; padding:0 2rem; text-align:center; }
      .cinematic-hero-eyebrow, .cinematic-scene-eyebrow, .cinematic-proof-kicker { font-size:.68rem; letter-spacing:.25em; text-transform:uppercase; color:rgba(103,232,249,.62); }
      .cinematic-hero-title { margin-top:1.2rem; font-size:clamp(3.2rem, 8vw, 7rem); line-height:.95; letter-spacing:-.06em; font-weight:900; background:linear-gradient(135deg,#fff,#67e8f9 48%,#a78bfa); -webkit-background-clip:text; background-clip:text; color:transparent; }
      .cinematic-hero-subtitle { max-width:860px; margin:1.4rem auto 0; color:rgba(207,250,254,.7); font-size:1.08rem; line-height:1.8; }
      .cinematic-hero-selector { margin:2rem auto 0; display:flex; justify-content:center; }
      .cinematic-hero-metrics { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:.8rem; margin-top:2.5rem; }
      .cinematic-hero-metric { border:1px solid rgba(103,232,249,.14); border-radius:22px; padding:1rem; background:rgba(7,17,29,.58); backdrop-filter:blur(22px); }
      .cinematic-hero-metric-value { display:block; font-size:1.8rem; font-weight:900; color:#67e8f9; }
      .cinematic-hero-metric-label { display:block; margin-top:.3rem; color:rgba(207,250,254,.45); font-size:.68rem; text-transform:uppercase; letter-spacing:.16em; }
      .cinematic-evidence-statement { margin:2rem auto 0; max-width:850px; border:1px solid rgba(251,191,36,.2); background:rgba(251,191,36,.055); border-radius:22px; padding:1rem 1.2rem; color:rgba(254,243,199,.78); line-height:1.7; }
      .cinematic-scene-section { min-height:100vh; padding:5rem 3rem; position:relative; overflow:hidden; }
      .cinematic-scene-alt { background:linear-gradient(180deg, rgba(5,13,26,.55), rgba(3,8,19,.9)); }
      .cinematic-scene-sticky.relaxed { max-width:1280px; margin:0 auto; }
      .cinematic-scene-title { margin-top:.8rem; font-size:clamp(2.6rem, 5vw, 5rem); line-height:1; letter-spacing:-.055em; font-weight:900; }
      .cinematic-scene-subtitle { max-width:820px; margin:1rem 0 2.2rem; color:rgba(207,250,254,.64); line-height:1.75; }
      .cinematic-chart-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(330px,1fr)); gap:1rem; }
      .cinematic-chart-panel, .cinematic-proof-card, .cinematic-ledger-bucket { border:1px solid rgba(103,232,249,.14); border-radius:28px; background:rgba(7,17,29,.62); padding:1.1rem; backdrop-filter:blur(22px); box-shadow:0 24px 80px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.06); }
      .cinematic-panel-header { display:flex; justify-content:space-between; gap:1rem; margin-bottom:1rem; }
      .cinematic-panel-header h3, .cinematic-proof-card h3, .cinematic-ledger-bucket h3 { font-size:1.1rem; font-weight:850; color:rgba(236,254,255,.94); }
      .cinematic-panel-header p, .cinematic-proof-card p { color:rgba(207,250,254,.58); font-size:.86rem; line-height:1.6; }
      .cinematic-confidence-badge { align-self:flex-start; border:1px solid; border-radius:999px; padding:.25rem .55rem; font-size:.68rem; text-transform:uppercase; letter-spacing:.12em; }
      .cinematic-chart-stage { min-height:260px; }
      .cinematic-validity-reason { margin-top:.8rem; color:rgba(207,250,254,.42); font-size:.78rem; line-height:1.55; }
      .cinematic-proof-card { display:block; width:100%; text-align:left; min-height:260px; }
      .cinematic-warning-card { border-color:rgba(251,191,36,.24); background:rgba(251,191,36,.055); }
      .cinematic-proof-icon { color:#fbbf24; margin-bottom:.8rem; }
      .cinematic-proof-value { margin:.9rem 0 .35rem; font-size:clamp(2.5rem,6vw,5rem); font-weight:900; line-height:1; color:#67e8f9; }
      .cinematic-proof-label, .cinematic-proof-source { color:rgba(207,250,254,.62); font-size:.85rem; }
      .cinematic-warning-list { display:flex; flex-wrap:wrap; gap:.45rem; margin-top:1rem; }
      .cinematic-warning-list span, .cinematic-ledger-meta span { border:1px solid rgba(255,255,255,.12); border-radius:999px; padding:.25rem .55rem; color:rgba(207,250,254,.58); font-size:.68rem; }
      .cinematic-timeline-strip, .cinematic-ranked-list { display:grid; gap:.65rem; margin-top:1.1rem; }
      .cinematic-timeline-strip button, .cinematic-ranked-list button { display:grid; grid-template-columns:auto 1fr auto; gap:.7rem; align-items:center; border:1px solid rgba(103,232,249,.12); border-radius:16px; padding:.7rem; background:rgba(255,255,255,.03); color:rgba(236,254,255,.9); text-align:left; }
      .cinematic-timeline-strip span { width:10px; height:10px; border-radius:50%; background:#67e8f9; box-shadow:0 0 18px rgba(103,232,249,.7); }
      .cinematic-ranked-list span { color:rgba(103,232,249,.7); font-weight:800; }
      .cinematic-ledger-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(310px,1fr)); gap:1rem; }
      .cinematic-ledger-bucket-header, .cinematic-ledger-item-top { display:flex; align-items:center; gap:.6rem; justify-content:space-between; }
      .cinematic-ledger-bucket-header h3 { flex:1; }
      .cinematic-ledger-items { display:grid; gap:.7rem; margin-top:1rem; }
      .cinematic-ledger-item { border:1px solid rgba(255,255,255,.1); border-radius:18px; padding:.85rem; background:rgba(255,255,255,.035); }
      .cinematic-ledger-item-top span { border:1px solid; border-radius:999px; padding:.18rem .45rem; font-size:.62rem; text-transform:uppercase; letter-spacing:.1em; }
      .cinematic-ledger-item h4 { margin-top:.65rem; color:white; font-weight:750; font-size:.92rem; }
      .cinematic-ledger-item p { margin-top:.45rem; color:rgba(207,250,254,.58); font-size:.78rem; line-height:1.55; }
      .cinematic-ledger-meta { display:flex; flex-wrap:wrap; gap:.35rem; margin-top:.65rem; }
      .cinematic-ledger-query { color:rgba(251,191,36,.68)!important; }
      .cinematic-ledger-item a { margin-top:.6rem; display:inline-flex; align-items:center; gap:.35rem; color:rgba(103,232,249,.8); font-size:.76rem; }
      .cinematic-ledger-empty { color:rgba(207,250,254,.42); font-size:.82rem; }
      .cinematic-matrix-stage { position:relative; min-height:520px; border:1px solid rgba(103,232,249,.14); border-radius:32px; background:radial-gradient(circle at 50% 50%,rgba(34,211,238,.1),transparent 26rem),rgba(7,17,29,.54); overflow:hidden; }
      .cinematic-matrix-stage::before { content:""; position:absolute; inset:0; background-image:linear-gradient(rgba(103,232,249,.08) 1px, transparent 1px),linear-gradient(90deg,rgba(103,232,249,.08) 1px,transparent 1px); background-size:56px 56px; mask-image:radial-gradient(circle,black,transparent 78%); }
      .cinematic-matrix-orb { position:absolute; z-index:1; width:150px; min-height:110px; border:1px solid; border-radius:24px; padding:.9rem; background:rgba(3,8,19,.74); backdrop-filter:blur(18px); color:white; text-align:left; box-shadow:0 18px 60px rgba(0,0,0,.28); }
      .cinematic-matrix-orb span { display:block; color:rgba(103,232,249,.7); font-size:.65rem; letter-spacing:.16em; text-transform:uppercase; }
      .cinematic-matrix-orb b { display:block; margin-top:.45rem; font-size:.9rem; }
      .cinematic-matrix-orb small { display:block; margin-top:.45rem; color:rgba(207,250,254,.55); }
      @media (max-width: 900px) { .cinematic-hero-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); } .cinematic-scene-section { padding:4rem 1rem; } .cinematic-topbar { padding:.8rem 1rem; } }
    `}</style>
  );
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
    setActiveSelection({ chartId: "matrix", chartTitle: "Risk / Opportunity Matrix", chartType: "scatter", category: point.name, seriesName: point.kind ?? "Matrix point", dataKey: "name", value: Number(point.revenue ?? point.revenuePotential ?? point.risk ?? 0), note: `Risk: ${point.risk ?? "N/A"}, Workers: ${point.workers ?? "N/A"}`, payload: point });
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
      <StyleInjector />
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
