import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { motion } from "framer-motion";
import { ChartBlock } from "../insight/ChartBlock";
import { GlassCard } from "../insight/GlassCard";
import { LuminousChartTooltip } from "../insight/LuminousChartTooltip";
import type { ChartDefinition, CompanyInteractionConfig, DetailPanelDefinition, RiskMatrixPoint, TooltipFormat } from "../../company-configs/types";

type ChartDatum = Record<string, string | number>;
type ActiveSelection = { chartId: string; chartTitle: string; datum: ChartDatum } | null;
type FilterState = Record<string, Record<string, string>>;

function formatTickByType(formatter: TooltipFormat | undefined) {
  if (formatter === "currencyM") return (v: number) => `$${v}M`;
  if (formatter === "currencyK") return (v: number) => `$${v}K`;
  if (formatter === "percent") return (v: number) => `${v}%`;
  if (formatter === "hoursM") return (v: number) => `${v}M hrs`;
  return undefined;
}

function formatValue(value: string | number | undefined, formatter?: TooltipFormat) {
  if (value === undefined) return "—";
  if (typeof value === "string") return value;
  if (formatter === "currencyM") return `$${value.toLocaleString()}M`;
  if (formatter === "currencyK") return `$${value.toLocaleString()}K`;
  if (formatter === "percent") return `${value}%`;
  if (formatter === "hoursM") return `${value}M hrs`;
  return value.toLocaleString();
}

function chartHeight(chart: ChartDefinition) {
  const rowCount = chart.data.length;
  const base = chart.fullWidth ? 340 : 300;
  const expanded = base + Math.max(0, rowCount - 6) * 18;
  return Math.min(chart.fullWidth ? 560 : 440, expanded);
}

function extractClickedDatum(event: unknown): ChartDatum | undefined {
  if (!event || typeof event !== "object") return undefined;
  const candidate = event as { activePayload?: Array<{ payload?: ChartDatum }>; payload?: ChartDatum };
  return candidate.activePayload?.[0]?.payload || candidate.payload;
}

function getDetailFields(chart: ChartDefinition, detailPanel?: DetailPanelDefinition) {
  if (detailPanel?.fields?.length) return detailPanel.fields;
  return [
    { label: chart.xKey, dataKey: chart.xKey, formatter: "plain" as TooltipFormat },
    ...chart.series.map((series) => ({ label: series.name ?? series.dataKey, dataKey: series.dataKey, formatter: chart.formatter ?? "plain" as TooltipFormat })),
  ];
}

function applyChartFilters(chart: ChartDefinition, chartFilters: Record<string, string> | undefined) {
  if (!chart.interaction?.filters?.length || !chartFilters) return chart.data as ChartDatum[];
  return (chart.data as ChartDatum[]).filter((row) => {
    return chart.interaction?.filters?.every((filter) => {
      const selected = chartFilters[filter.id];
      if (!selected || selected === "__all") return true;
      return String(row[filter.dataKey] ?? "") === selected;
    });
  });
}

function ChartFilterControls({ chart, values, onChange }: { chart: ChartDefinition; values: Record<string, string>; onChange: (filterId: string, value: string) => void }) {
  const filters = chart.interaction?.filters ?? [];
  if (!filters.length) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {filters.map((filter) => {
        const options = filter.options?.length ? filter.options : Array.from(new Set(chart.data.map((row) => String(row[filter.dataKey] ?? "")).filter(Boolean)));
        return (
          <label key={filter.id} className="flex items-center gap-2 rounded-full border border-cyan-100/14 bg-cyan-100/[0.045] px-3 py-1.5 text-[11px] text-cyan-100/70">
            <span className="uppercase tracking-[0.16em] text-cyan-100/38">{filter.label}</span>
            <select value={values[filter.id] ?? "__all"} onChange={(event) => onChange(filter.id, event.target.value)} className="bg-transparent text-cyan-50 outline-none">
              <option value="__all">All</option>
              {options.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        );
      })}
    </div>
  );
}

function ChartInteractionBadges({ chart, companyInteraction }: { chart: ChartDefinition; companyInteraction?: CompanyInteractionConfig }) {
  const badges = [
    chart.interaction?.filters?.length ? `${chart.interaction.filters.length} live filters` : null,
    chart.interaction?.drillDown ? "Click chart to drill down" : null,
    chart.interaction?.detailPanel ? "Detail panel live" : null,
    chart.interaction?.linkedCharts ? "Linked highlight ready" : null,
    companyInteraction?.enableFilters ? "Profile filters enabled" : null,
    companyInteraction?.enableDrillDown ? "Profile drill-down enabled" : null,
  ].filter(Boolean);
  if (!badges.length) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {badges.map((badge) => (
        <span key={badge} className="rounded-full border border-cyan-100/15 bg-cyan-100/5 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-50/65">{badge}</span>
      ))}
    </div>
  );
}

function ChartDetailPanel({ chart, selection, onClear }: { chart: ChartDefinition; selection: ActiveSelection; onClear: () => void }) {
  if (!selection || selection.chartId !== chart.id) return null;
  const detailPanel = chart.interaction?.detailPanel;
  const fields = getDetailFields(chart, detailPanel);
  const label = String(selection.datum[chart.xKey] ?? selection.chartTitle);

  return (
    <GlassCard className="mt-3 border-cyan-200/20 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-emerald-200/58">Drill-down selection</p>
          <h4 className="mt-1 text-lg font-black text-white">{detailPanel?.title || chart.title}: {label}</h4>
          {detailPanel?.narrative ? <p className="mt-2 text-sm leading-6 text-cyan-100/58">{detailPanel.narrative}</p> : null}
          {chart.interaction?.drillDown?.label ? <p className="mt-1 text-xs text-cyan-100/45">{chart.interaction.drillDown.label}</p> : null}
        </div>
        <button onClick={onClear} className="rounded-full border border-cyan-100/15 px-3 py-1 text-xs text-cyan-100/60 transition hover:border-cyan-200/30 hover:text-cyan-50">Clear</button>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {fields.map((field) => (
          <div key={`${field.label}-${field.dataKey}`} className="rounded-2xl border border-cyan-100/10 bg-white/[0.035] p-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/38">{field.label}</p>
            <p className="mt-1 text-sm font-semibold text-cyan-50">{formatValue(selection.datum[field.dataKey], field.formatter ?? chart.formatter)}</p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function RenderBarChart({ chart, data, onSelect }: { chart: ChartDefinition; data: ChartDatum[]; onSelect: (datum: ChartDatum) => void }) {
  return (
    <ChartBlock title={chart.title} subtitle={chart.subtitle} height={chartHeight(chart)}>
      <BarChart data={data} onClick={(event) => { const datum = extractClickedDatum(event); if (datum) onSelect(datum); }}>
        <CartesianGrid stroke="rgba(255,255,255,.08)" />
        <XAxis dataKey={chart.xKey} stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
        <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} domain={chart.domain} tickFormatter={formatTickByType(chart.formatter)} />
        {chart.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        <Tooltip cursor={{ fill: "rgba(34,211,238,.08)" }} content={<LuminousChartTooltip formatter={chart.formatter ?? "plain"} headline={chart.headline ?? "data focus"} />} />
        {chart.referenceLines?.map((ref, i) => <ReferenceLine key={i} y={ref.y} stroke={ref.stroke} strokeDasharray={ref.strokeDasharray} label={ref.label} />)}
        {chart.series.map((s) => <Bar key={s.dataKey} dataKey={s.dataKey} name={s.name ?? s.dataKey} fill={s.color ?? "#22d3ee"} radius={s.radius ?? [10, 10, 0, 0]} stackId={s.stackId} />)}
      </BarChart>
    </ChartBlock>
  );
}

function RenderAreaChart({ chart, data, onSelect }: { chart: ChartDefinition; data: ChartDatum[]; onSelect: (datum: ChartDatum) => void }) {
  return (
    <ChartBlock title={chart.title} subtitle={chart.subtitle} height={chartHeight(chart)}>
      <AreaChart data={data} onClick={(event) => { const datum = extractClickedDatum(event); if (datum) onSelect(datum); }}>
        <CartesianGrid stroke="rgba(255,255,255,.08)" />
        <XAxis dataKey={chart.xKey} stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
        <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} domain={chart.domain} tickFormatter={formatTickByType(chart.formatter)} />
        {chart.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        <Tooltip content={<LuminousChartTooltip formatter={chart.formatter ?? "plain"} headline={chart.headline ?? "data focus"} />} />
        {chart.series.map((s) => <Area key={s.dataKey} type="monotone" dataKey={s.dataKey} name={s.name ?? s.dataKey} stroke={s.color ?? "#22d3ee"} fill={`${s.color ?? "#22d3ee"}4d`} strokeWidth={3} />)}
      </AreaChart>
    </ChartBlock>
  );
}

function RenderLineChart({ chart, data, onSelect }: { chart: ChartDefinition; data: ChartDatum[]; onSelect: (datum: ChartDatum) => void }) {
  return (
    <ChartBlock title={chart.title} subtitle={chart.subtitle} height={chartHeight(chart)}>
      <LineChart data={data} onClick={(event) => { const datum = extractClickedDatum(event); if (datum) onSelect(datum); }}>
        <CartesianGrid stroke="rgba(255,255,255,.08)" />
        <XAxis dataKey={chart.xKey} stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
        <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} domain={chart.domain} tickFormatter={formatTickByType(chart.formatter)} />
        {chart.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        <Tooltip content={<LuminousChartTooltip formatter={chart.formatter ?? "plain"} headline={chart.headline ?? "data focus"} />} />
        {chart.referenceLines?.map((ref, i) => <ReferenceLine key={i} y={ref.y} stroke={ref.stroke} strokeDasharray={ref.strokeDasharray} label={ref.label} />)}
        {chart.series.map((s) => <Line key={s.dataKey} type="monotone" dataKey={s.dataKey} name={s.name ?? s.dataKey} stroke={s.color ?? "#22d3ee"} strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7, onClick: (event, payload) => { const datum = extractClickedDatum(payload); if (datum) onSelect(datum); } }} />)}
      </LineChart>
    </ChartBlock>
  );
}

function RenderScatterChart({ chart, data, onSelect }: { chart: ChartDefinition; data: ChartDatum[]; onSelect: (datum: ChartDatum) => void }) {
  return (
    <ChartBlock title={chart.title} subtitle={chart.subtitle} height={chartHeight(chart)}>
      <ScatterChart onClick={(event) => { const datum = extractClickedDatum(event); if (datum) onSelect(datum); }}>
        <CartesianGrid stroke="rgba(255,255,255,.08)" />
        <XAxis dataKey={chart.series[0]?.dataKey ?? "x"} name={chart.series[0]?.name ?? "X"} stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} tickFormatter={formatTickByType(chart.formatter)} />
        <YAxis dataKey={chart.series[1]?.dataKey ?? "y"} name={chart.series[1]?.name ?? "Y"} stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} domain={chart.domain} />
        {chart.series.length > 2 && <ZAxis dataKey={chart.series[2]?.dataKey ?? "z"} range={[80, 520]} />}
        <Tooltip cursor={{ stroke: "rgba(34,211,238,.35)", strokeDasharray: "4 4" }} content={<LuminousChartTooltip headline={chart.headline ?? "data focus"} />} />
        <Scatter name="Data" data={data} fill={chart.series[0]?.color ?? "#22d3ee"} onClick={(event) => { const datum = extractClickedDatum(event); if (datum) onSelect(datum); }} />
      </ScatterChart>
    </ChartBlock>
  );
}

function ChartRouter({ chart, data, onSelect }: { chart: ChartDefinition; data: ChartDatum[]; onSelect: (datum: ChartDatum) => void }) {
  if (chart.type === "area") return <RenderAreaChart chart={chart} data={data} onSelect={onSelect} />;
  if (chart.type === "line") return <RenderLineChart chart={chart} data={data} onSelect={onSelect} />;
  if (chart.type === "scatter") return <RenderScatterChart chart={chart} data={data} onSelect={onSelect} />;
  return <RenderBarChart chart={chart} data={data} onSelect={onSelect} />;
}

export function CompanyChartRenderer({ charts, companyInteraction }: { charts: ChartDefinition[]; companyInteraction?: CompanyInteractionConfig }) {
  const [activeSelection, setActiveSelection] = useState<ActiveSelection>(null);
  const [filterState, setFilterState] = useState<FilterState>({});

  const hasRealInteractions = useMemo(() => charts.some((chart) => chart.interaction?.filters?.length || chart.interaction?.drillDown || chart.interaction?.detailPanel || chart.interaction?.linkedCharts) || Boolean(companyInteraction?.enableFilters || companyInteraction?.enableDrillDown), [charts, companyInteraction]);

  if (!charts.length) return null;
  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      {hasRealInteractions && (
        <GlassCard className="xl:col-span-2 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/45">Live chart interactions</p>
          <p className="mt-2 text-sm text-cyan-100/60">Click bars, points, lines, or regions to open a drill-down panel. Chart filters narrow the rendered data instead of only describing the schema.</p>
        </GlassCard>
      )}
      {charts.map((chart, index) => {
        const chartFilters = filterState[chart.id] ?? {};
        const filteredData = applyChartFilters(chart, chartFilters);
        return (
          <motion.div key={chart.id} className={chart.fullWidth ? "xl:col-span-2" : ""} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: index * 0.025 }}>
            <ChartInteractionBadges chart={chart} companyInteraction={companyInteraction} />
            <ChartFilterControls chart={chart} values={chartFilters} onChange={(filterId, value) => setFilterState((current) => ({ ...current, [chart.id]: { ...(current[chart.id] ?? {}), [filterId]: value } }))} />
            <ChartRouter chart={chart} data={filteredData} onSelect={(datum) => setActiveSelection({ chartId: chart.id, chartTitle: chart.title, datum })} />
            <ChartDetailPanel chart={chart} selection={activeSelection} onClear={() => setActiveSelection(null)} />
          </motion.div>
        );
      })}
    </div>
  );
}

export function RiskMatrixRenderer({ data, title }: { data: RiskMatrixPoint[]; title?: string }) {
  const [selection, setSelection] = useState<RiskMatrixPoint | null>(null);
  if (!data.length) return null;
  return (
    <div className="xl:col-span-2">
      <ChartBlock title={title ?? "Opportunity / risk matrix"} subtitle="Revenue opportunity plotted against worker risk with worker count bubble size. Click a bubble to inspect the region." height={360}>
        <ScatterChart onClick={(event) => { const datum = extractClickedDatum(event) as RiskMatrixPoint | undefined; if (datum) setSelection(datum); }}>
          <CartesianGrid stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="revenue" name="Revenue" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${v}M`} />
          <YAxis dataKey="risk" name="Risk score" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} domain={[0, 10]} />
          <ZAxis dataKey="workers" range={[80, 520]} />
          <Tooltip cursor={{ stroke: "rgba(34,211,238,.35)", strokeDasharray: "4 4" }} content={<LuminousChartTooltip headline="risk matrix" />} />
          <Scatter name="Region" data={data} fill="#22d3ee" onClick={(event) => { const datum = extractClickedDatum(event) as RiskMatrixPoint | undefined; if (datum) setSelection(datum); }} />
        </ScatterChart>
      </ChartBlock>
      {selection ? (
        <GlassCard className="mt-3 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-emerald-200/58">Risk matrix drill-down</p>
              <h4 className="mt-1 text-lg font-black text-white">{selection.name}</h4>
            </div>
            <button onClick={() => setSelection(null)} className="rounded-full border border-cyan-100/15 px-3 py-1 text-xs text-cyan-100/60 transition hover:border-cyan-200/30 hover:text-cyan-50">Clear</button>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-cyan-100/10 bg-white/[0.035] p-3"><p className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/38">Revenue</p><p className="mt-1 text-sm font-semibold text-cyan-50">${selection.revenue}M</p></div>
            <div className="rounded-2xl border border-cyan-100/10 bg-white/[0.035] p-3"><p className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/38">Risk</p><p className="mt-1 text-sm font-semibold text-cyan-50">{selection.risk}/10</p></div>
            <div className="rounded-2xl border border-cyan-100/10 bg-white/[0.035] p-3"><p className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/38">Workers</p><p className="mt-1 text-sm font-semibold text-cyan-50">{selection.workers.toLocaleString()}</p></div>
          </div>
        </GlassCard>
      ) : null}
    </div>
  );
}