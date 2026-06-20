import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { motion } from "framer-motion";
import { ChartBlock } from "../insight/ChartBlock";
import { GlassCard } from "../insight/GlassCard";
import { LuminousChartTooltip } from "../insight/LuminousChartTooltip";
import type { ChartDefinition, CompanyInteractionConfig, RiskMatrixPoint, TooltipFormat } from "../../company-configs/types";

function formatTickByType(formatter: TooltipFormat | undefined) {
  if (formatter === "currencyM") return (v: number) => `$${v}M`;
  if (formatter === "currencyK") return (v: number) => `$${v}K`;
  if (formatter === "percent") return (v: number) => `${v}%`;
  if (formatter === "hoursM") return (v: number) => `${v}M hrs`;
  return undefined;
}

function chartHeight(chart: ChartDefinition) {
  const rowCount = chart.data.length;
  const base = chart.fullWidth ? 340 : 300;
  const expanded = base + Math.max(0, rowCount - 6) * 18;
  return Math.min(chart.fullWidth ? 560 : 440, expanded);
}

function ChartInteractionBadges({ chart, companyInteraction }: { chart: ChartDefinition; companyInteraction?: CompanyInteractionConfig }) {
  const badges = [
    chart.interaction?.filters?.length ? `${chart.interaction.filters.length} chart filters configured` : null,
    chart.interaction?.drillDown ? "Drill-down configured" : null,
    chart.interaction?.detailPanel ? "Detail panel configured" : null,
    chart.interaction?.linkedCharts ? "Linked highlight configured" : null,
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

function RenderBarChart({ chart }: { chart: ChartDefinition }) {
  return (
    <ChartBlock title={chart.title} subtitle={chart.subtitle} height={chartHeight(chart)}>
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
    <ChartBlock title={chart.title} subtitle={chart.subtitle} height={chartHeight(chart)}>
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
    <ChartBlock title={chart.title} subtitle={chart.subtitle} height={chartHeight(chart)}>
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
    <ChartBlock title={chart.title} subtitle={chart.subtitle} height={chartHeight(chart)}>
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

function ChartRouter({ chart }: { chart: ChartDefinition }) {
  if (chart.type === "area") return <RenderAreaChart chart={chart} />;
  if (chart.type === "line") return <RenderLineChart chart={chart} />;
  if (chart.type === "scatter") return <RenderScatterChart chart={chart} />;
  return <RenderBarChart chart={chart} />;
}

export function CompanyChartRenderer({ charts, companyInteraction }: { charts: ChartDefinition[]; companyInteraction?: CompanyInteractionConfig }) {
  if (!charts.length) return null;
  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      {companyInteraction && (
        <GlassCard className="xl:col-span-2 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/45">Interaction layer</p>
          <p className="mt-2 text-sm text-cyan-100/60">Preset: {companyInteraction.preset ?? "default"}. Configured interaction capabilities are surfaced on each chart so dashboards no longer hide the interaction schema.</p>
        </GlassCard>
      )}
      {charts.map((chart, index) => (
        <motion.div key={chart.id} className={chart.fullWidth ? "xl:col-span-2" : ""} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: index * 0.025 }}>
          <ChartInteractionBadges chart={chart} companyInteraction={companyInteraction} />
          <ChartRouter chart={chart} />
        </motion.div>
      ))}
    </div>
  );
}

export function RiskMatrixRenderer({ data, title }: { data: RiskMatrixPoint[]; title?: string }) {
  if (!data.length) return null;
  return (
    <div className="xl:col-span-2">
      <ChartBlock title={title ?? "Opportunity / risk matrix"} subtitle="Revenue opportunity plotted against worker risk with worker count bubble size." height={360}>
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
