import { useEffect, useMemo, useState } from "react";
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
  Cell,
} from "recharts";
import { Activity, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { IntelligenceSelector } from "@/components/insight/IntelligenceSelector";
import { DataQualityBanner } from "@/components/insight/DataQualityBanner";
import { LuminousChartTooltip } from "@/components/insight/LuminousChartTooltip";
import { useInsightData, useSelectedCompany } from "@/data/useInsightData";
import { getCompanyConfigOrDefault } from "@/company-configs";
import { resolveConfigCompanyId } from "@/company-configs/configIds";
import { getIntelligenceStatus } from "@/company-configs/intelligenceNavigation";
import { intelligenceFactsToCharts } from "@/data/intelligenceCharts";
import type { ChartDefinition, MetricDefinition, TooltipFormat } from "@/company-configs/types";
import type { CompanyIntelligence, IntelligenceFact } from "@/data/types";
import {
  fetchVisualizationFeed,
  feedChartsToChartDefinitions,
  feedFactsToIntelligenceFacts,
  type DataVisualizationFeed,
} from "@/data/visualizationIntelligenceAdapter";

type FeedMode = "combined" | "static" | "live";

type ChartSelection = {
  chartTitle: string;
  category: string;
  seriesName: string;
  value: number;
  sourceUrl?: string;
  sourceName?: string;
  confidence?: string;
  summary?: string;
};

const METHOD_BEHAVIOR: Record<string, { label: string; description: string }> = {
  "vector-displacement": { label: "Vector Displacement Mapping", description: "Offset selected chart elements by value for quick outlier review." },
  "chromatic-aberration": { label: "Chromatic Aberration Highlighting", description: "Add a focused RGB halo to the selected datum." },
  "geometric-anchor": { label: "Geometric Anchor Snapping", description: "Use anchor points and grid focus for selected values." },
  "subtractive-masking": { label: "Subtractive Masking Overlays", description: "Dim surrounding elements so the selected data point is easier to read." },
  "procedural-grid": { label: "Procedural Grid Resonances", description: "Make chart grids more visible while inspecting data." },
  "algorithmic-edge": { label: "Algorithmic Edge-Tracing", description: "Trace selected bar and point outlines." },
  "concentric-ripple": { label: "Concentric Ripple Metrics", description: "Mark clicked points with a ripple focus." },
  "negative-space": { label: "Negative Space Inversion", description: "Invert emphasis so the selection reads as a cutout against the chart." },
  "vector-lattice": { label: "Vector Lattice Distortion", description: "Overlay a subtle lattice for visual comparison." },
  "color-shift": { label: "Color-Shift Isometry", description: "Shift chart colors by confidence, category, or value band." },
  "synchronous-path": { label: "Synchronous Path Illumination", description: "Highlight related chart paths together." },
  "vector-node": { label: "Vector Node Expansion", description: "Show compact detail for a selected datum." },
  "radiant-gradient": { label: "Radiant Gradient Focus", description: "Glow the selected series while dimming surrounding context." },
  "isometric-slice": { label: "Isometric Slice-View", description: "Lift selected chart segments for depth." },
  "semantic-zoom": { label: "Generative Semantic Zoom", description: "Summarize at a high level before drilling into supporting evidence." },
  "holographic-depth": { label: "Holographic Depth Layers", description: "Layer panels by contract, source, job, location, and network evidence." },
  "kinetic-vector": { label: "Kinetic Vector Transitions", description: "Apply controlled motion during chart mode changes." },
  "contextual-morph": { label: "Contextual Data Morphing", description: "Group intelligence facts by category, source type, confidence, or time." },
  "interactive-filter": { label: "Interactive Filtering", description: "Filter charts by source type, confidence, category, and date range." },
  "zoom-pan": { label: "Zoom and Pan", description: "Focus on one chart at a time." },
  "linked-visualizations": { label: "Linked Visualizations / Brushing", description: "Click one element and highlight related points across charts." },
  "click-reveal": { label: "Click-to-Reveal", description: "Inspect the source, value, and meaning behind a clicked data point." },
};

const EFFECT_IDS = Object.keys(METHOD_BEHAVIOR);
const DEFAULT_CHART_LIMIT = 4;
const PALETTE = ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#fb7185", "#60a5fa", "#a3e635"];

function getSeriesColor(index: number, fallback?: string) {
  return fallback ?? PALETTE[index % PALETTE.length];
}

function formatTick(formatter?: TooltipFormat) {
  if (formatter === "currencyM") return (v: number) => `$${v}M`;
  if (formatter === "currencyK") return (v: number) => `$${v}K`;
  if (formatter === "percent") return (v: number) => `${v}%`;
  if (formatter === "hoursM") return (v: number) => `${v}M hrs`;
  return undefined;
}

function metricChartFromDefinitions(metrics: MetricDefinition[]): ChartDefinition[] {
  if (!metrics.length) return [];
  const topMetrics = metrics.slice(0, 10).map((metric) => ({
    label: metric.label,
    value: metric.value,
    category: metric.category,
    sourceId: metric.sourceId ?? "static-profile",
  }));
  return [
    {
      id: "clean-static-metrics",
      title: "Profile Metrics",
      subtitle: "Key static metrics for the selected company",
      type: "bar",
      xKey: "label",
      data: topMetrics,
      series: [{ dataKey: "value", name: "Value", color: PALETTE[0] }],
      formatter: "plain",
      headline: "profile metrics",
      fullWidth: true,
    },
  ];
}

function numericTotal(chart: ChartDefinition) {
  return chart.data.reduce((total, row) => {
    const seriesTotal = chart.series.reduce((sum, series) => {
      const n = Number(row[series.dataKey] ?? row.value ?? 0);
      return sum + (Number.isFinite(n) ? Math.abs(n) : 0);
    }, 0);
    return total + seriesTotal;
  }, 0);
}

function hasUsefulChartData(chart: ChartDefinition) {
  if (!chart.data?.length) return false;
  const labels = chart.data.map((row) => String(row[chart.xKey] ?? row.label ?? "").trim().toLowerCase());
  const allUnknown = labels.length > 0 && labels.every((label) => !label || label === "unknown" || label === "n/a");
  if (allUnknown) return false;
  if (numericTotal(chart) === 0) return false;
  return true;
}

function compactCharts(charts: ChartDefinition[]) {
  const seen = new Set<string>();
  return charts.filter((chart) => {
    if (seen.has(chart.id)) return false;
    seen.add(chart.id);
    return hasUsefulChartData(chart);
  });
}

function buildStaticCharts(configCharts: ChartDefinition[], metrics: MetricDefinition[], sources: any[]) {
  const charts = configCharts.length ? configCharts : metricChartFromDefinitions(metrics);
  return charts.map((chart) => ({
    ...chart,
    data: chart.data.map((row) => {
      const sourceId = row.sourceId as string | undefined;
      const matched = sourceId ? sources.find((source) => source.id === sourceId || source.sourceId === sourceId) : null;
      return matched
        ? {
            ...row,
            sourceUrl: matched.url ?? row.sourceUrl,
            sourceName: matched.name ?? matched.sourceName ?? row.sourceName,
            sourceType: matched.type ?? row.sourceType,
            confidence: matched.confidence ?? row.confidence,
            date: row.date ?? matched.date,
          }
        : row;
    }),
  }));
}

function mergeIntelligence(base: CompanyIntelligence | undefined, feedFacts: IntelligenceFact[]): CompanyIntelligence | undefined {
  if (!base && feedFacts.length === 0) return undefined;
  return {
    companyId: base?.companyId ?? "live-feed",
    facts: [...(base?.facts ?? []), ...feedFacts],
    runs: base?.runs ?? [],
    chartReady: base?.chartReady ?? {
      awardValueTimeline: [],
      opportunitiesByStage: [],
      sourceConfidenceOverTime: [],
      jobSignalTrend: [],
      eventTimeline: [],
      locationExposureByRegion: [],
      networkGapScoreByRegion: [],
    },
  };
}

function sourceCounts(feed: DataVisualizationFeed | null) {
  const enabled = feed?.sourceStatus.filter((source) => source.enabled).length ?? 0;
  const missing = feed?.missingData.length ?? 0;
  const warnings = feed?.warnings.length ?? 0;
  return { enabled, missing, warnings };
}

function buildSummaryBullets(params: {
  companyName: string;
  facts: IntelligenceFact[];
  charts: ChartDefinition[];
  feed: DataVisualizationFeed | null;
  fallbackSummary?: string;
}) {
  const bullets: string[] = [];
  const { facts, charts, feed, fallbackSummary, companyName } = params;
  if (feed?.facts?.length) bullets.push(`${feed.facts.length} live fact(s) are available for ${companyName}.`);
  if (feed?.sourceRecords?.length) bullets.push(`${feed.sourceRecords.length} source record(s) are attached to the live feed.`);
  if (charts.length) bullets.push(`${charts.length} clean chart(s) passed the default quality screen.`);
  const highConfidence = facts.filter((fact) => fact.confidence === "high").length;
  if (highConfidence) bullets.push(`${highConfidence} high-confidence evidence item(s) are available.`);
  const firstFact = facts.find((fact) => fact.summary || fact.title);
  if (firstFact) bullets.push(firstFact.summary || firstFact.title);
  if (!bullets.length && fallbackSummary) bullets.push(fallbackSummary);
  if (!bullets.length) bullets.push("Select a company and run the live feed only when you need source-backed intelligence.");
  return bullets.slice(0, 5);
}

function ModeButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-cyan-200/35 bg-cyan-200/12 text-cyan-50"
          : "border-cyan-100/10 bg-white/[0.03] text-cyan-100/55 hover:border-cyan-100/25 hover:text-cyan-50"
      }`}
    >
      {children}
    </button>
  );
}

function CollapsibleSection({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-cyan-100/10 bg-black/16">
      <button onClick={onToggle} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/55">{title}</p>
          {subtitle ? <p className="mt-1 text-xs text-cyan-100/40">{subtitle}</p> : null}
        </div>
        {open ? <ChevronDown size={16} className="text-cyan-100/50" /> : <ChevronRight size={16} className="text-cyan-100/50" />}
      </button>
      {open ? <div className="border-t border-cyan-100/10 p-4">{children}</div> : null}
    </div>
  );
}

function ChartPanel({
  chart,
  index,
  activeEffect,
  onSelect,
}: {
  chart: ChartDefinition;
  index: number;
  activeEffect: string;
  onSelect: (selection: ChartSelection) => void;
}) {
  const height = chart.fullWidth ? 340 : 300;
  const effect = METHOD_BEHAVIOR[activeEffect];
  const panelEffectClass = activeEffect === "holographic-depth" ? "ring-1 ring-cyan-300/20" : activeEffect === "radiant-gradient" ? "shadow-[0_0_36px_rgba(34,211,238,.12)]" : "";

  const selectDatum = (row: Record<string, string | number>, seriesName: string, dataKey: string) => {
    const value = Number(row[dataKey] ?? row.value ?? 0);
    onSelect({
      chartTitle: chart.title,
      category: String(row[chart.xKey] ?? row.label ?? "Data point"),
      seriesName,
      value: Number.isFinite(value) ? value : 0,
      sourceUrl: row.sourceUrl as string | undefined,
      sourceName: row.sourceName as string | undefined,
      confidence: row.confidence as string | undefined,
      summary: row.summary as string | undefined,
    });
  };

  const cartesian = (children: React.ReactElement) => (
    <GlassCard className={`p-5 ${panelEffectClass}`} delay={index * 0.02}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-white">{chart.title}</h3>
          {chart.subtitle ? <p className="mt-1 text-xs text-cyan-100/55">{chart.subtitle}</p> : null}
        </div>
        {effect ? <span className="rounded-full bg-cyan-100/8 px-2 py-1 text-[10px] text-cyan-100/45">{effect.label}</span> : null}
      </div>
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );

  if (chart.type === "line") {
    return cartesian(
      <LineChart data={chart.data}>
        <CartesianGrid stroke="rgba(255,255,255,.08)" />
        <XAxis dataKey={chart.xKey} stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
        <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} tickFormatter={formatTick(chart.formatter)} />
        {chart.series.length > 1 ? <Legend wrapperStyle={{ fontSize: 11 }} /> : null}
        <Tooltip content={<LuminousChartTooltip formatter={chart.formatter ?? "plain"} headline={chart.headline ?? chart.title} />} />
        {chart.series.map((series, i) => (
          <Line
            key={series.dataKey}
            type="monotone"
            dataKey={series.dataKey}
            name={series.name ?? series.dataKey}
            stroke={getSeriesColor(i, series.color)}
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 7, onClick: (_: unknown, entry: any) => selectDatum(entry.payload, series.name ?? series.dataKey, series.dataKey) }}
          />
        ))}
      </LineChart>
    );
  }

  if (chart.type === "area") {
    return cartesian(
      <AreaChart data={chart.data}>
        <CartesianGrid stroke="rgba(255,255,255,.08)" />
        <XAxis dataKey={chart.xKey} stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
        <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} tickFormatter={formatTick(chart.formatter)} />
        {chart.series.length > 1 ? <Legend wrapperStyle={{ fontSize: 11 }} /> : null}
        <Tooltip content={<LuminousChartTooltip formatter={chart.formatter ?? "plain"} headline={chart.headline ?? chart.title} />} />
        {chart.series.map((series, i) => {
          const color = getSeriesColor(i, series.color);
          return <Area key={series.dataKey} type="monotone" dataKey={series.dataKey} name={series.name ?? series.dataKey} stroke={color} fill={`${color}40`} strokeWidth={3} />;
        })}
      </AreaChart>
    );
  }

  if (chart.type === "scatter") {
    const xKey = chart.series[0]?.dataKey ?? "x";
    const yKey = chart.series[1]?.dataKey ?? "y";
    return cartesian(
      <ScatterChart>
        <CartesianGrid stroke="rgba(255,255,255,.08)" />
        <XAxis dataKey={xKey} type="number" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
        <YAxis dataKey={yKey} type="number" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} />
        <ZAxis dataKey={chart.series[2]?.dataKey ?? "value"} range={[60, 320]} />
        <Tooltip content={<LuminousChartTooltip formatter={chart.formatter ?? "plain"} headline={chart.headline ?? chart.title} />} />
        <Scatter
          data={chart.data}
          fill={chart.series[0]?.color ?? PALETTE[0]}
          onClick={(entry: any) => selectDatum(entry, chart.series[0]?.name ?? "Data", xKey)}
        />
      </ScatterChart>
    );
  }

  return cartesian(
    <BarChart data={chart.data}>
      <CartesianGrid stroke="rgba(255,255,255,.08)" />
      <XAxis dataKey={chart.xKey} stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
      <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} tickFormatter={formatTick(chart.formatter)} />
      {chart.series.length > 1 ? <Legend wrapperStyle={{ fontSize: 11 }} /> : null}
      <Tooltip cursor={{ fill: "rgba(34,211,238,.08)" }} content={<LuminousChartTooltip formatter={chart.formatter ?? "plain"} headline={chart.headline ?? chart.title} />} />
      {chart.series.map((series, i) => (
        <Bar
          key={series.dataKey}
          dataKey={series.dataKey}
          name={series.name ?? series.dataKey}
          radius={[9, 9, 0, 0]}
          onClick={(_, rowIndex) => selectDatum(chart.data[rowIndex], series.name ?? series.dataKey, series.dataKey)}
        >
          {chart.data.map((row, rowIndex) => (
            <Cell key={`${series.dataKey}-${rowIndex}`} fill={(row.confidence && activeEffect === "color-shift") ? (row.confidence === "high" ? PALETTE[2] : row.confidence === "low" ? PALETTE[5] : PALETTE[3]) : getSeriesColor(i, series.color)} />
          ))}
        </Bar>
      ))}
    </BarChart>
  );
}

function DetailCard({ selection, onClear }: { selection: ChartSelection | null; onClear: () => void }) {
  if (!selection) return null;
  return (
    <GlassCard className="mt-5 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/40">Selected evidence</p>
          <h3 className="mt-2 text-lg font-bold text-white">{selection.category}</h3>
          <p className="mt-1 text-sm text-cyan-100/60">{selection.chartTitle} · {selection.seriesName} · {selection.value.toLocaleString()}</p>
          {selection.summary ? <p className="mt-3 text-sm leading-6 text-cyan-100/70">{selection.summary}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-cyan-100/45">
            {selection.sourceName ? <span>Source: {selection.sourceName}</span> : null}
            {selection.confidence ? <span>Confidence: {selection.confidence}</span> : null}
            {selection.sourceUrl ? <a href={selection.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-100/70 hover:text-cyan-50">Open source <ExternalLink size={11} /></a> : null}
          </div>
        </div>
        <button onClick={onClear} className="rounded-full border border-cyan-100/15 px-3 py-1 text-xs text-cyan-100/60 hover:text-cyan-50">Clear</button>
      </div>
    </GlassCard>
  );
}

export default function DataVisualization() {
  const { dataset } = useInsightData();
  const { companyId, setCompanyId, company } = useSelectedCompany(dataset.companies);
  const resolvedCompanyId = resolveConfigCompanyId(companyId);
  const config = getCompanyConfigOrDefault(resolvedCompanyId);
  const status = getIntelligenceStatus(config);
  const sources = dataset.sources.filter((source) => resolveConfigCompanyId(source.companyId) === resolvedCompanyId);
  const staticIntelligence = dataset.intelligence.find((item) => resolveConfigCompanyId(item.companyId) === resolvedCompanyId);
  const metrics = dataset.metrics.filter((metric) => resolveConfigCompanyId(metric.companyId) === resolvedCompanyId);

  const [feedMode, setFeedMode] = useState<FeedMode>("combined");
  const [feed, setFeed] = useState<DataVisualizationFeed | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [showSourceDetails, setShowSourceDetails] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [showMoreCharts, setShowMoreCharts] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [activeEffect, setActiveEffect] = useState("click-reveal");
  const [selection, setSelection] = useState<ChartSelection | null>(null);

  useEffect(() => {
    if (feedMode === "static" || !company?.name) {
      setFeed(null);
      setFeedError(null);
      return;
    }
    const hq = company.headquarters ?? "";
    const stateMatch = hq.match(/,\s*([A-Za-z ]+)$/);
    const state = stateMatch ? stateMatch[1].trim() : undefined;
    let cancelled = false;
    setFeedLoading(true);
    setFeedError(null);
    fetchVisualizationFeed({ company: company.name, state })
      .then((result) => {
        if (!cancelled) setFeed(result);
      })
      .catch((error) => {
        if (!cancelled) setFeedError(error instanceof Error ? error.message : "Live feed failed");
      })
      .finally(() => {
        if (!cancelled) setFeedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [feedMode, company?.name, company?.headquarters]);

  const feedCharts = useMemo(() => (feed ? feedChartsToChartDefinitions(feed.charts) : []), [feed]);
  const feedFacts = useMemo(() => (feed ? feedFactsToIntelligenceFacts(feed.facts) : []), [feed]);
  const mergedIntelligence = useMemo(() => mergeIntelligence(staticIntelligence, feedMode === "static" ? [] : feedFacts), [staticIntelligence, feedFacts, feedMode]);
  const intelligenceCharts = useMemo(() => intelligenceFactsToCharts(mergedIntelligence), [mergedIntelligence]);
  const staticCharts = useMemo(() => buildStaticCharts(config.chartDefinitions ?? [], metrics, sources), [config.chartDefinitions, metrics, sources]);

  const rawCharts = useMemo(() => {
    if (feedMode === "static") return [...staticCharts, ...intelligenceCharts];
    if (feedMode === "live") return [...feedCharts, ...intelligenceCharts];
    return [...staticCharts, ...intelligenceCharts, ...feedCharts];
  }, [feedMode, staticCharts, intelligenceCharts, feedCharts]);

  const cleanCharts = useMemo(() => compactCharts(rawCharts), [rawCharts]);
  const hiddenChartCount = Math.max(0, rawCharts.length - cleanCharts.length);
  const visibleCharts = showMoreCharts ? cleanCharts : cleanCharts.slice(0, DEFAULT_CHART_LIMIT);
  const counts = sourceCounts(feed);
  const summaryBullets = buildSummaryBullets({
    companyName: company?.name ?? resolvedCompanyId,
    facts: mergedIntelligence?.facts ?? [],
    charts: cleanCharts,
    feed,
    fallbackSummary: company?.summary,
  });

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar
          eyebrow="Portal 02"
          title="Data Visualization"
          subtitle="Clean profile and live intelligence views. Live data is folded into this page only."
          actions={<IntelligenceSelector companies={dataset.companies} value={companyId} onChange={setCompanyId} />}
        />
        <DataQualityBanner warnings={status.dataQualityWarnings} />

        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-cyan-100/10 bg-black/20 px-4 py-3">
          <span className="text-xs uppercase tracking-[0.22em] text-cyan-100/50">Source mode</span>
          <ModeButton active={feedMode === "combined"} onClick={() => setFeedMode("combined")}>Combined</ModeButton>
          <ModeButton active={feedMode === "static"} onClick={() => setFeedMode("static")}>Static</ModeButton>
          <ModeButton active={feedMode === "live"} onClick={() => setFeedMode("live")}>Live</ModeButton>
          <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-cyan-100/50">
            {feedLoading ? <span className="inline-flex items-center gap-1"><Activity size={12} className="animate-pulse" /> loading</span> : null}
            {feedError ? <span className="text-amber-200/80">{feedError}</span> : null}
          </div>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-4">
          <GlassCard className="p-4"><p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/40">Metrics</p><p className="mt-2 text-2xl font-bold text-white">{metrics.length}</p></GlassCard>
          <GlassCard className="p-4"><p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/40">Clean charts</p><p className="mt-2 text-2xl font-bold text-white">{cleanCharts.length}</p></GlassCard>
          <GlassCard className="p-4"><p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/40">Live facts</p><p className="mt-2 text-2xl font-bold text-white">{feed?.facts.length ?? 0}</p></GlassCard>
          <GlassCard className="p-4"><p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/40">Sources</p><p className="mt-2 text-sm font-semibold text-cyan-50">{counts.enabled} enabled · {counts.missing} missing · {counts.warnings} warnings</p></GlassCard>
        </div>

        <GlassCard className="mb-5 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/55">What matters now</p>
          <h2 className="mt-2 text-2xl font-bold text-white">{company?.name ?? resolvedCompanyId}</h2>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-cyan-100/70">
            {summaryBullets.map((bullet, index) => <li key={index} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />{bullet}</li>)}
          </ul>
        </GlassCard>

        <div className="mb-5 grid gap-3">
          <CollapsibleSection title="Visual Effects" subtitle={`22 modes preserved · active: ${METHOD_BEHAVIOR[activeEffect]?.label ?? activeEffect}`} open={showEffects} onToggle={() => setShowEffects((value) => !value)}>
            <div className="flex flex-wrap gap-2">
              {EFFECT_IDS.map((effectId) => (
                <button key={effectId} onClick={() => setActiveEffect(effectId)} className={`rounded-full border px-3 py-1.5 text-xs transition ${activeEffect === effectId ? "border-cyan-200/35 bg-cyan-200/12 text-cyan-50" : "border-cyan-100/10 bg-white/[0.03] text-cyan-100/55 hover:text-cyan-50"}`}>
                  {METHOD_BEHAVIOR[effectId].label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-cyan-100/50">{METHOD_BEHAVIOR[activeEffect]?.description}</p>
          </CollapsibleSection>

          <CollapsibleSection title="Source Details" subtitle={`${counts.enabled} enabled · ${counts.missing} missing · ${counts.warnings} warnings`} open={showSourceDetails} onToggle={() => setShowSourceDetails((value) => !value)}>
            {feed ? (
              <div className="space-y-4">
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {feed.sourceStatus.map((source) => (
                    <div key={source.source} className="rounded-xl border border-cyan-100/10 bg-white/[0.03] p-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-cyan-50">{source.enabled ? <CheckCircle2 size={14} className="text-emerald-300" /> : <AlertTriangle size={14} className="text-amber-300" />}{source.source}</div>
                      <p className="mt-1 text-xs text-cyan-100/45">{source.authMode ? `${source.authMode} · ` : ""}{source.notes}</p>
                    </div>
                  ))}
                </div>
                {feed.missingData.length ? <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3 text-xs text-amber-100/70">{feed.missingData.map((item) => <p key={`${item.source}-${item.field}`}>{item.source}: {item.reason}</p>)}</div> : null}
                {feed.warnings.length ? <div className="rounded-xl border border-red-300/15 bg-red-300/[0.04] p-3 text-xs text-red-100/70">{feed.warnings.map((item) => <p key={`${item.source}-${item.message}`}>{item.source}: {item.message}</p>)}</div> : null}
              </div>
            ) : <p className="text-sm text-cyan-100/50">Switch to Combined or Live to load source details.</p>}
          </CollapsibleSection>
        </div>

        {visibleCharts.length ? (
          <div className="grid gap-5 xl:grid-cols-2">
            {visibleCharts.map((chart, index) => (
              <div key={chart.id} className={chart.fullWidth || visibleCharts.length === 1 ? "xl:col-span-2" : ""}>
                <ChartPanel chart={chart} index={index} activeEffect={activeEffect} onSelect={setSelection} />
              </div>
            ))}
          </div>
        ) : (
          <GlassCard className="p-8 text-center"><p className="text-sm text-cyan-100/55">No clean chart data is available for this view. Hidden empty/unknown charts are kept out of the main workspace.</p></GlassCard>
        )}

        <DetailCard selection={selection} onClear={() => setSelection(null)} />

        {cleanCharts.length > DEFAULT_CHART_LIMIT || hiddenChartCount > 0 ? (
          <div className="mt-5 flex flex-wrap gap-3">
            {cleanCharts.length > DEFAULT_CHART_LIMIT ? <button onClick={() => setShowMoreCharts((value) => !value)} className="rounded-full border border-cyan-100/15 bg-cyan-100/5 px-4 py-2 text-sm font-semibold text-cyan-50 hover:bg-cyan-100/10">{showMoreCharts ? "Show fewer charts" : `Show ${cleanCharts.length - DEFAULT_CHART_LIMIT} more chart(s)`}</button> : null}
            {hiddenChartCount > 0 ? <span className="rounded-full border border-amber-300/15 bg-amber-300/[0.04] px-4 py-2 text-sm text-amber-100/70">{hiddenChartCount} empty / low-value chart(s) hidden</span> : null}
          </div>
        ) : null}

        <div className="mt-5">
          <CollapsibleSection title="Raw Evidence / Facts" subtitle={`${mergedIntelligence?.facts.length ?? 0} evidence item(s)`} open={showEvidence} onToggle={() => setShowEvidence((value) => !value)}>
            <div className="grid gap-3 md:grid-cols-2">
              {(mergedIntelligence?.facts ?? []).slice(0, 24).map((fact) => (
                <div key={fact.id} className="rounded-xl border border-cyan-100/10 bg-white/[0.03] p-3">
                  <p className="text-sm font-semibold text-cyan-50">{fact.title}</p>
                  <p className="mt-1 text-xs leading-5 text-cyan-100/55">{fact.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em] text-cyan-100/35">
                    <span>{fact.category}</span><span>{fact.confidence}</span><span>{fact.sourceType}</span>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        </div>
      </section>
    </main>
  );
}
