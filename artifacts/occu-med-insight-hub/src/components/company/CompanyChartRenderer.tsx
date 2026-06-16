import { useState, useCallback, createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { ChartBlock } from "../insight/ChartBlock";
import { LuminousChartTooltip } from "../insight/LuminousChartTooltip";
import type { ChartDefinition, CompanyInteractionConfig, DetailPanelDefinition, ChartFilterDefinition, RiskMatrixPoint, TooltipFormat, TransitionConfig } from "../../company-configs/types";

type ChartDatum = Record<string, string | number>;
type FilterValue = string | string[] | [number, number] | boolean;

/* ─── Transition helpers ─── */

function getMotionProps(transition?: TransitionConfig, companyTransition?: TransitionConfig) {
  const t = transition ?? companyTransition;
  if (!t || t.enter === "none") return {};
  const duration = (t.duration ?? 400) / 1000;
  switch (t.enter) {
    case "slide": return { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration } };
    case "scale": return { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.95 }, transition: { duration } };
    case "kinetic": return { initial: { opacity: 0, x: -12, filter: "blur(4px)" }, animate: { opacity: 1, x: 0, filter: "blur(0px)" }, exit: { opacity: 0, x: 12 }, transition: { duration } };
    case "morph": return { initial: { opacity: 0, scaleX: 0.96, scaleY: 1.02 }, animate: { opacity: 1, scaleX: 1, scaleY: 1 }, exit: { opacity: 0, scale: 0.98 }, transition: { duration } };
    case "fade":
    default: return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration } };
  }
}

function getVisualFrameClass(chart: ChartDefinition) {
  const visual = chart.interaction?.visualization;
  const classes = ["relative"];
  if (visual?.depthLayers) classes.push("before:pointer-events-none before:absolute before:-inset-1 before:rounded-[1.6rem] before:border before:border-cyan-200/10 before:bg-cyan-200/[0.015] before:blur-[1px]");
  if (visual?.focusEffect?.type === "radiant-gradient") classes.push("after:pointer-events-none after:absolute after:-inset-2 after:rounded-[1.75rem] after:bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,.14),transparent_55%)]");
  if (visual?.gridEffect?.type === "procedural-resonance" || visual?.gridEffect?.type === "concentric-ripple") classes.push("shadow-[0_0_38px_rgba(34,211,238,.08)]");
  return classes.join(" ");
}

/* ─── Linked chart context ─── */

type LinkedChartState = { highlightedKey: string | null; activeChartId: string | null };
const LinkedChartContext = createContext<{
  state: LinkedChartState;
  setHighlight: (chartId: string, key: string | null) => void;
}>({ state: { highlightedKey: null, activeChartId: null }, setHighlight: () => {} });

/* ─── Filtering and activation helpers ─── */

function toDatum(input: unknown): ChartDatum | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const payload = record.payload;
  if (payload && typeof payload === "object") return toDatum(payload);
  const activePayload = record.activePayload;
  if (Array.isArray(activePayload) && activePayload.length > 0) {
    const firstPayload = (activePayload[0] as Record<string, unknown> | undefined)?.payload;
    if (firstPayload && typeof firstPayload === "object") return toDatum(firstPayload);
  }

  const datum: ChartDatum = {};
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string" || typeof value === "number") datum[key] = value;
  }
  return Object.keys(datum).length ? datum : null;
}

function rowMatchesFilter(row: ChartDatum, filter: ChartFilterDefinition, value: FilterValue | undefined) {
  if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return true;
  const raw = row[filter.dataKey];

  if (filter.type === "toggle") {
    if (!value) return true;
    return raw === true || raw === "true" || raw === 1 || raw === "1";
  }

  if (filter.type === "range" && Array.isArray(value) && value.length === 2) {
    const numeric = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(numeric)) return false;
    const [min, max] = value as [number, number];
    return numeric >= min && numeric <= max;
  }

  if (filter.type === "multi-select" && Array.isArray(value)) {
    return value.map(String).includes(String(raw));
  }

  return String(raw) === String(value);
}

function applyFilters(chart: ChartDefinition, values: Record<string, FilterValue>): ChartDefinition {
  const filters = chart.interaction?.filters;
  if (!filters?.length) return chart;
  const filteredData = chart.data.filter((row) => filters.every((filter) => rowMatchesFilter(row, filter, values[filter.id])));
  return { ...chart, data: filteredData };
}

/* ─── Filter UI ─── */

function ChartFilterBar({ filters, values, onChange }: {
  filters: ChartFilterDefinition[];
  values: Record<string, FilterValue>;
  onChange: (filterId: string, value: FilterValue) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {filters.map((f) => {
        if (f.type === "toggle") {
          const checked = Boolean(values[f.id]);
          return (
            <button key={f.id} type="button" onClick={() => onChange(f.id, !checked)}
              className={`rounded-full px-3 py-1 text-[10px] font-medium backdrop-blur-md border transition-all ${
                checked ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-100" : "border-white/10 bg-white/5 text-white/50"
              }`}>
              {f.label}
            </button>
          );
        }

        if (f.type === "range") {
          const current = Array.isArray(values[f.id]) ? values[f.id] as [number, number] : [0, 100];
          return (
            <div key={f.id} className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] text-cyan-100 backdrop-blur-md">
              <span className="text-cyan-100/55">{f.label}</span>
              <input aria-label={`${f.label} minimum`} type="number" value={current[0]} onChange={(event) => onChange(f.id, [Number(event.target.value), current[1]])} className="w-14 bg-transparent text-right text-cyan-50 outline-none" />
              <span className="text-cyan-100/35">–</span>
              <input aria-label={`${f.label} maximum`} type="number" value={current[1]} onChange={(event) => onChange(f.id, [current[0], Number(event.target.value)])} className="w-14 bg-transparent text-right text-cyan-50 outline-none" />
            </div>
          );
        }

        if (f.type === "multi-select") {
          const selected = Array.isArray(values[f.id]) ? values[f.id].map(String) : [];
          return (
            <select key={f.id} multiple value={selected}
              onChange={(event) => onChange(f.id, Array.from(event.target.selectedOptions).map((option) => option.value))}
              className="rounded-lg bg-[#07111d] border border-white/10 px-2 py-1 text-[10px] text-cyan-100 backdrop-blur-md focus:border-cyan-400/50 focus:outline-none">
              {f.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          );
        }

        return (
          <select key={f.id} value={(values[f.id] as string) ?? ""}
            onChange={(event) => onChange(f.id, event.target.value)}
            className="rounded-lg bg-[#07111d] border border-white/10 px-2 py-1 text-[10px] text-cyan-100 backdrop-blur-md focus:border-cyan-400/50 focus:outline-none">
            <option value="">{f.label}</option>
            {f.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        );
      })}
    </div>
  );
}

/* ─── Detail Panel ─── */

function DetailPanel({ panel, data, onClose }: {
  panel: DetailPanelDefinition;
  data: ChartDatum | null;
  onClose: () => void;
}) {
  if (!data) return null;
  const positionCls = panel.position === "modal"
    ? "fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-sm"
    : panel.position === "right"
      ? "absolute right-0 top-0 h-full w-72 z-40"
      : "w-full mt-3";

  return (
    <AnimatePresence>
      <motion.div className={positionCls} initial={{ opacity: 0, x: panel.position === "right" ? 20 : 0 }}
        animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: panel.position === "right" ? 20 : 0 }}
        transition={{ duration: 0.25 }}>
        <div className={`rounded-2xl border border-cyan-400/20 bg-[#0a1628]/90 backdrop-blur-xl p-4 shadow-[0_0_40px_rgba(34,211,238,.08)] ${panel.position === "modal" ? "w-96 max-h-[80vh] overflow-y-auto" : ""}`}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-cyan-100 tracking-wide uppercase">{panel.title}</h4>
            <button type="button" onClick={onClose} className="text-white/40 hover:text-white/80 text-xs">×</button>
          </div>
          {panel.narrative && <p className="text-[10px] text-white/50 mb-3">{panel.narrative}</p>}
          <div className="space-y-2">
            {panel.fields.map((field) => (
              <div key={field.dataKey} className="flex justify-between gap-4 text-[11px]">
                <span className="text-white/60">{field.label}</span>
                <span className="text-cyan-200 font-medium text-right">{formatValue(data[field.dataKey], field.formatter)}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function formatValue(val: string | number | undefined, formatter?: TooltipFormat): string {
  if (val === undefined) return "—";
  if (typeof val === "string") return val;
  switch (formatter) {
    case "currencyM": return `$${val}M`;
    case "currencyK": return `$${val}K`;
    case "percent": return `${val}%`;
    case "hoursM": return `${val}M hrs`;
    default: return String(val);
  }
}

/* ─── Tick formatters ─── */

function formatTickByType(formatter: TooltipFormat | undefined) {
  switch (formatter) {
    case "currencyM": return (v: number) => `$${v}M`;
    case "currencyK": return (v: number) => `$${v}K`;
    case "percent": return (v: number) => `${v}%`;
    case "hoursM": return (v: number) => `${v}M hrs`;
    default: return undefined;
  }
}

/* ─── Chart renderers ─── */

function RenderBarChart({ chart, onActivate }: { chart: ChartDefinition; onActivate: (datum: ChartDatum | null) => void }) {
  return (
    <ChartBlock title={chart.title} subtitle={chart.subtitle}>
      <BarChart data={chart.data} onClick={(event: unknown) => onActivate(toDatum(event))}>
        <CartesianGrid stroke="rgba(255,255,255,.08)" />
        <XAxis dataKey={chart.xKey} stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
        <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} domain={chart.domain} tickFormatter={formatTickByType(chart.formatter)} />
        {chart.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        <Tooltip cursor={{ fill: "rgba(34,211,238,.08)" }} content={<LuminousChartTooltip formatter={chart.formatter ?? "plain"} headline={chart.headline ?? "data focus"} />} />
        {chart.referenceLines?.map((ref, i) => <ReferenceLine key={i} y={ref.y} stroke={ref.stroke} strokeDasharray={ref.strokeDasharray} label={ref.label} />)}
        {chart.series.map((s) => <Bar key={s.dataKey} dataKey={s.dataKey} name={s.name ?? s.dataKey} fill={s.color ?? "#22d3ee"} radius={s.radius ?? [10, 10, 0, 0]} stackId={s.stackId} onClick={(datum: unknown) => onActivate(toDatum(datum))} />)}
      </BarChart>
    </ChartBlock>
  );
}

function RenderAreaChart({ chart, onActivate }: { chart: ChartDefinition; onActivate: (datum: ChartDatum | null) => void }) {
  return (
    <ChartBlock title={chart.title} subtitle={chart.subtitle}>
      <AreaChart data={chart.data} onClick={(event: unknown) => onActivate(toDatum(event))}>
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

function RenderLineChart({ chart, onActivate }: { chart: ChartDefinition; onActivate: (datum: ChartDatum | null) => void }) {
  return (
    <ChartBlock title={chart.title} subtitle={chart.subtitle}>
      <LineChart data={chart.data} onClick={(event: unknown) => onActivate(toDatum(event))}>
        <CartesianGrid stroke="rgba(255,255,255,.08)" />
        <XAxis dataKey={chart.xKey} stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
        <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} domain={chart.domain} tickFormatter={formatTickByType(chart.formatter)} />
        {chart.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        <Tooltip content={<LuminousChartTooltip formatter={chart.formatter ?? "plain"} headline={chart.headline ?? "data focus"} />} />
        {chart.referenceLines?.map((ref, i) => <ReferenceLine key={i} y={ref.y} stroke={ref.stroke} strokeDasharray={ref.strokeDasharray} label={ref.label} />)}
        {chart.series.map((s) => <Line key={s.dataKey} type="monotone" dataKey={s.dataKey} name={s.name ?? s.dataKey} stroke={s.color ?? "#22d3ee"} strokeWidth={3} dot={{ r: 5 }} />)}
      </LineChart>
    </ChartBlock>
  );
}

function RenderScatterChart({ chart, onActivate }: { chart: ChartDefinition; onActivate: (datum: ChartDatum | null) => void }) {
  return (
    <ChartBlock title={chart.title} subtitle={chart.subtitle}>
      <ScatterChart onClick={(event: unknown) => onActivate(toDatum(event))}>
        <CartesianGrid stroke="rgba(255,255,255,.08)" />
        <XAxis dataKey={chart.series[0]?.dataKey ?? "x"} name={chart.series[0]?.name ?? "X"} stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} tickFormatter={formatTickByType(chart.formatter)} />
        <YAxis dataKey={chart.series[1]?.dataKey ?? "y"} name={chart.series[1]?.name ?? "Y"} stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} domain={chart.domain} />
        {chart.series.length > 2 && <ZAxis dataKey={chart.series[2]?.dataKey ?? "z"} range={[80, 520]} />}
        <Tooltip cursor={{ stroke: "rgba(34,211,238,.35)", strokeDasharray: "4 4" }} content={<LuminousChartTooltip headline={chart.headline ?? "data focus"} />} />
        <Scatter name="Data" data={chart.data} fill={chart.series[0]?.color ?? "#22d3ee"} onClick={(datum: unknown) => onActivate(toDatum(datum))} />
      </ScatterChart>
    </ChartBlock>
  );
}

/* ─── Chart Router ─── */

function ChartRouter({ chart, onActivate }: { chart: ChartDefinition; onActivate: (datum: ChartDatum | null) => void }) {
  switch (chart.type) {
    case "area": return <RenderAreaChart chart={chart} onActivate={onActivate} />;
    case "line": return <RenderLineChart chart={chart} onActivate={onActivate} />;
    case "scatter": return <RenderScatterChart chart={chart} onActivate={onActivate} />;
    case "bar":
    case "stacked":
    case "grouped":
    default: return <RenderBarChart chart={chart} onActivate={onActivate} />;
  }
}

/* ─── Interactive chart wrapper ─── */

function InteractiveChartWrapper({ chart, companyInteraction }: {
  chart: ChartDefinition;
  companyInteraction?: CompanyInteractionConfig;
}) {
  const interaction = chart.interaction;
  const [filterValues, setFilterValues] = useState<Record<string, FilterValue>>(() => {
    const init: Record<string, FilterValue> = {};
    interaction?.filters?.forEach((f) => { if (f.defaultValue !== undefined) init[f.id] = f.defaultValue; });
    return init;
  });
  const [detailData, setDetailData] = useState<ChartDatum | null>(null);
  const { state, setHighlight } = useContext(LinkedChartContext);
  const motionProps = getMotionProps(interaction?.transition, companyInteraction?.defaultTransition);

  const filteredChart = useMemo(() => applyFilters(chart, filterValues), [chart, filterValues]);

  const handleChartActivate = useCallback((data: ChartDatum | null) => {
    if (!data) return;
    if (interaction?.detailPanel && interaction.detailPanel.triggerOn !== "hover") {
      setDetailData(data);
    }
    if (interaction?.linkedCharts && companyInteraction?.enableLinkedHighlighting !== false) {
      const key = data[interaction.linkedCharts.highlightKey];
      setHighlight(chart.id, key != null ? String(key) : null);
    }
  }, [interaction, chart.id, setHighlight, companyInteraction?.enableLinkedHighlighting]);

  const showFilters = Boolean((companyInteraction?.enableFilters !== false) && interaction?.filters?.length);
  const isLinkedTarget = Boolean(state.highlightedKey && state.activeChartId !== chart.id && companyInteraction?.enableLinkedHighlighting !== false);
  const activeFrameClass = isLinkedTarget ? "ring-1 ring-cyan-300/35 shadow-[0_0_34px_rgba(34,211,238,.12)]" : "";

  return (
    <motion.div className={`${getVisualFrameClass(chart)} ${activeFrameClass}`} {...motionProps}>
      {showFilters && (
        <ChartFilterBar
          filters={interaction!.filters!}
          values={filterValues}
          onChange={(id, val) => setFilterValues((prev) => ({ ...prev, [id]: val }))}
        />
      )}
      {showFilters && filteredChart.data.length !== chart.data.length ? (
        <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Filtered view: {filteredChart.data.length} of {chart.data.length} records</p>
      ) : null}
      {isLinkedTarget ? (
        <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-cyan-100/50">Linked focus: {state.highlightedKey}</p>
      ) : null}
      <ChartRouter chart={filteredChart} onActivate={handleChartActivate} />
      {interaction?.detailPanel && (
        <DetailPanel panel={interaction.detailPanel} data={detailData} onClose={() => setDetailData(null)} />
      )}
    </motion.div>
  );
}

/* ─── Main exported renderer ─── */

export function CompanyChartRenderer({ charts, companyInteraction }: {
  charts: ChartDefinition[];
  companyInteraction?: CompanyInteractionConfig;
}) {
  const [linkedState, setLinkedState] = useState<LinkedChartState>({ highlightedKey: null, activeChartId: null });
  const setHighlight = useCallback((chartId: string, key: string | null) => {
    setLinkedState({ highlightedKey: key, activeChartId: chartId });
  }, []);
  const contextValue = useMemo(() => ({ state: linkedState, setHighlight }), [linkedState, setHighlight]);

  const stagger = companyInteraction?.defaultTransition?.staggerChildren;

  if (!charts.length) return null;

  return (
    <LinkedChartContext.Provider value={contextValue}>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        {charts.map((chart, idx) => (
          <motion.div key={chart.id} className={chart.fullWidth ? "xl:col-span-2" : ""}
            initial={stagger ? { opacity: 0, y: 12 } : undefined}
            animate={stagger ? { opacity: 1, y: 0 } : undefined}
            transition={stagger ? { delay: idx * 0.06 } : undefined}>
            <InteractiveChartWrapper chart={chart} companyInteraction={companyInteraction} />
          </motion.div>
        ))}
      </div>
    </LinkedChartContext.Provider>
  );
}

export function RiskMatrixRenderer({ data, title }: { data: RiskMatrixPoint[]; title?: string }) {
  if (!data.length) return null;
  return (
    <div className="xl:col-span-2">
      <ChartBlock title={title ?? "Opportunity / risk matrix"} subtitle="Revenue opportunity plotted against worker risk with worker count bubble size.">
        <ScatterChart>
          <CartesianGrid stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="revenue" name="Revenue" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${v}M`} />
          <YAxis dataKey="risk" name="Risk score" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} domain={[0, 10]} />
          <ZAxis dataKey="workers" range={[80, 520]} />
          <Tooltip cursor={{ stroke: "rgba(34,211,238,.35)", strokeDasharray: "4 4" }} content={<LuminousChartTooltip headline="risk matrix" />} />
          <Scatter name="Region" data={data} fill="#22d3ee" />
        </ScatterChart>
      </ChartBlock>
    </div>
  );
}
