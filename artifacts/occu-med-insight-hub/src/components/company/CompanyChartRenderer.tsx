import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { ChartBlock } from "../insight/ChartBlock";
import { LuminousChartTooltip } from "../insight/LuminousChartTooltip";
import type { ChartDefinition, RiskMatrixPoint, TooltipFormat } from "../../company-configs/types";

function formatTickByType(formatter: TooltipFormat | undefined) {
  switch (formatter) {
    case "currencyM": return (v: number) => `$${v}M`;
    case "currencyK": return (v: number) => `$${v}K`;
    case "percent": return (v: number) => `${v}%`;
    case "hoursM": return (v: number) => `${v}M hrs`;
    default: return undefined;
  }
}

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

export function CompanyChartRenderer({ charts }: { charts: ChartDefinition[] }) {
  if (!charts.length) return null;
  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      {charts.map((chart) => (
        <div key={chart.id} className={chart.fullWidth ? "xl:col-span-2" : ""}>
          <ChartRouter chart={chart} />
        </div>
      ))}
    </div>
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
