import { useState, useCallback, createContext, useContext, useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { ChartBlock } from "../insight/ChartBlock";
import { LuminousChartTooltip } from "../insight/LuminousChartTooltip";
import type { ChartDefinition, ChartInteractionConfig, CompanyInteractionConfig, DetailPanelDefinition, ChartFilterDefinition, RiskMatrixPoint, TooltipFormat, TransitionConfig } from "../../company-configs/types";

/* ─── Transition helpers ─── */

function getMotionProps(transition?: TransitionConfig, companyTransition?: TransitionConfig) {
  const t = transition ?? companyTransition;
  if (!t || t.enter === "none") return {};
  const duration = (t.duration ?? 400) / 1000;
  switch (t.enter) {
    case "slide": return { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration } };
    case "scale": return { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.95 }, transition: { duration } };
    case "fade":
    default: return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration } };
  }
}

/* ─── Linked chart context ─── */

type LinkedChartState = { highlightedKey: string | null; activeChartId: string | null };
const LinkedChartContext = createContext<{
  state: LinkedChartState;
  setHighlight: (chartId: string, key: string | null) => void;
}>({ state: { highlightedKey: null, activeChartId: null }, setHighlight: () => {} });

/* ─── Filter UI ─── */

function ChartFilterBar({ filters, values, onChange }: {
  filters: ChartFilterDefinition[];
  values: Record<string, string | string[] | [number, number] | boolean>;
  onChange: (filterId: string, value: string | string[] | [number, number] | boolean) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {filters.map((f) => {
        if (f.type === "toggle") {
          const checked = values[f.id] as boolean ?? false;
          return (
            <button key={f.id} onClick={() => onChange(f.id, !checked)}
              className={`rounded-full px-3 py-1 text-[10px] font-medium backdrop-blur-md border transition-all ${
                checked ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-100" : "border-white/10 bg-white/5 text-white/50"
              }`}>
              {f.label}
            </button>
          );
        }
        if (f.type === "select" || f.type === "multi-select") {
          return (
            <select key={f.id} value={(values[f.id] as string) ?? ""}
              onChange={(e) => onChange(f.id, e.target.value)}
              className="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-cyan-100 backdrop-blur-md focus:border-cyan-400/50 focus:outline-none">
              <option value="">{f.label}</option>
              {f.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          );
        }
        return null;
      })}
    </div>
  );
}

/* ─── Detail Panel ─── */

function DetailPanel({ panel, data, onClose }: {
  panel: DetailPanelDefinition;
  data: Record<string, string | number> | null;
  onClose: () => void;
}) {
  if (!data) return null;
  const positionCls = panel.position === "modal"
    ? "fixed inset-0 z-50 flex items-center justify-center"
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
            <button onClick={onClose} className="text-white/40 hover:text-white/80 text-xs">✕</button>
          </div>
          {panel.narrative && <p className="text-[10px] text-white/50 mb-3">{panel.narrative}</p>}
          <div className="space-y-2">
            {panel.fields.map((field) => (
              <div key={field.dataKey} className="flex justify-between text-[11px]">
                <span className="text-white/60">{field.label}</span>
                <span className="text-cyan-200 font-medium">{formatValue(data[field.dataKey], field.formatter)}</span>
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

/* ─── Interactive chart wrapper ─── */

function InteractiveChartWrapper({ chart, children, companyInteraction }: {
  chart: ChartDefinition;
  children: React.ReactNode;
  companyInteraction?: CompanyInteractionConfig;
}) {
  const interaction = chart.interaction;
  const [filterValues, setFilterValues] = useState<Record<string, string | string[] | [number, number] | boolean>>(() => {
    const init: Record<string, string | string[] | [number, number] | boolean> = {};
    interaction?.filters?.forEach((f) => { if (f.defaultValue !== undefined) init[f.id] = f.defaultValue; });
    return init;
  });
  const [detailData, setDetailData] = useState<Record<string, string | number> | null>(null);
  const { setHighlight } = useContext(LinkedChartContext);
  const motionProps = getMotionProps(interaction?.transition, companyInteraction?.defaultTransition);

  const handleChartClick = useCallback((data: Record<string, string | number> | null) => {
    if (!data) return;
    if (interaction?.detailPanel && interaction.detailPanel.triggerOn === "click") {
      setDetailData(data);
    }
    if (interaction?.linkedCharts) {
      const key = data[interaction.linkedCharts.highlightKey];
      setHighlight(chart.id, key != null ? String(key) : null);
    }
  }, [interaction, chart.id, setHighlight]);

  const showFilters = (companyInteraction?.enableFilters !== false) && interaction?.filters?.length;

  return (
    <motion.div className="relative" {...motionProps}>
      {showFilters && (
        <ChartFilterBar
          filters={interaction!.filters!}
          values={filterValues}
          onChange={(id, val) => setFilterValues((prev) => ({ ...prev, [id]: val }))}
        />
      )}
      <div onClick={() => handleChartClick(null)}>
        {children}
      </div>
      {interaction?.detailPanel && (
        <DetailPanel panel={interaction.detailPanel} data={detailData} onClose={() => setDetailData(null)} />
      )}
    </motion.div>
  );
}

/* ─── Chart renderers ─── */

function RenderBarChart({ chart }: { chart: ChartDefinition }) {
  return (
    <ChartBlock title={chart.title} subtitle={chart.subtitle}>
      <BarChart data={chart.data}>
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

function RenderAreaChart({ chart }: { chart: ChartDefinition }) {
  return (
    <ChartBlock title={chart.title} subtitle={chart.subtitle}>
      <AreaChart data={chart.data}>
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

function RenderLineChart({ chart }: { chart: ChartDefinition }) {
  return (
    <ChartBlock title={chart.title} subtitle={chart.subtitle}>
      <LineChart data={chart.data}>
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

function RenderScatterChart({ chart }: { chart: ChartDefinition }) {
  return (
    <ChartBlock title={chart.title} subtitle={chart.subtitle}>
      <ScatterChart>
        <CartesianGrid stroke="rgba(255,255,255,.08)" />
        <XAxis dataKey={chart.series[0]?.dataKey ?? "x"} name={chart.series[0]?.name ?? "X"} stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} tickFormatter={formatTickByType(chart.formatter)} />
        <YAxis dataKey={chart.series[1]?.dataKey ?? "y"} name={chart.series[1]?.name ?? "Y"} stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} domain={chart.domain} />
        {chart.series.length > 2 && <ZAxis dataKey={chart.series[2]?.dataKey ?? "z"} range={[80, 520]} />}
        <Tooltip cursor={{ stroke: "rgba(34,211,238,.35)", strokeDasharray: "4 4" }} content={<LuminousChartTooltip headline={chart.headline ?? "data focus"} />} />
        <Scatter name="Data" data={chart.data} fill={chart.series[0]?.color ?? "#22d3ee"} />
      </ScatterChart>
    </ChartBlock>
  );
}

/* ─── Chart Router ─── */

function ChartRouter({ chart }: { chart: ChartDefinition }) {
  switch (chart.type) {
    case "area": return <RenderAreaChart chart={chart} />;
    case "line": return <RenderLineChart chart={chart} />;
    case "scatter": return <RenderScatterChart chart={chart} />;
    case "bar":
    case "stacked":
    case "grouped":
    default: return <RenderBarChart chart={chart} />;
  }
}

/* ─── Main exported renderer ─── */

export function CompanyChartRenderer({ charts, companyInteraction }: {
  charts: ChartDefinition[];
  companyInteraction?: CompanyInteractionConfig;
}) {
  if (!charts.length) return null;

  const [linkedState, setLinkedState] = useState<LinkedChartState>({ highlightedKey: null, activeChartId: null });
  const setHighlight = useCallback((chartId: string, key: string | null) => {
    setLinkedState({ highlightedKey: key, activeChartId: chartId });
  }, []);
  const contextValue = useMemo(() => ({ state: linkedState, setHighlight }), [linkedState, setHighlight]);

  const stagger = companyInteraction?.defaultTransition?.staggerChildren;

  return (
    <LinkedChartContext.Provider value={contextValue}>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        {charts.map((chart, idx) => (
          <motion.div key={chart.id} className={chart.fullWidth ? "xl:col-span-2" : ""}
            initial={stagger ? { opacity: 0, y: 12 } : undefined}
            animate={stagger ? { opacity: 1, y: 0 } : undefined}
            transition={stagger ? { delay: idx * 0.06 } : undefined}>
            <InteractiveChartWrapper chart={chart} companyInteraction={companyInteraction}>
              <ChartRouter chart={chart} />
            </InteractiveChartWrapper>
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
