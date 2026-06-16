import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { ChartBlock } from "./ChartBlock";
import { LuminousChartTooltip } from "./LuminousChartTooltip";

const contractData = [
  { name: "GPS MATOC", value: 10.3 },
  { name: "WPS III Baghdad", value: 1.3 },
  { name: "DOE Savannah River", value: 1.0 },
  { name: "LANL", value: 0.592 },
  { name: "Other DOE", value: 0.5 },
];

const injuryCostData = [
  { name: "OCONUS PSOs", direct: 2.2, additional: 1.2 },
  { name: "DOE Nuclear Guard", direct: 2.8, additional: 1.4 },
  { name: "DoD Domestic", direct: 7.3, additional: 3.6 },
  { name: "Total Portfolio", direct: 12.5, additional: 6.2 },
];

const doeExamData = [
  { name: "SRS", low: 480, additional: 240 },
  { name: "LANL", low: 240, additional: 120 },
  { name: "Hanford", low: 120, additional: 60 },
  { name: "SPR Sites", low: 80, additional: 40 },
  { name: "NFS Erwin", low: 60, additional: 30 },
];

const gpsExamData = [
  { name: "15% Turnover", exams: 1950 },
  { name: "20% Turnover", exams: 2600 },
  { name: "25% Turnover", exams: 3250 },
];

const trirData = [
  { name: "OCONUS PSOs", value: 3.0 },
  { name: "DOE Nuclear Guard", value: 2.0 },
  { name: "DoD Domestic Guard", value: 1.4 },
  { name: "Background Investigators", value: 0.5 },
];

function y(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function getTooltipFormat(formatter?: "$K" | "$M" | "$B") {
  if (formatter === "$K") return "currencyK" as const;
  if (formatter === "$M" || formatter === "$B") return "currencyM" as const;
  return "plain" as const;
}

function BarPanel({ title, subtitle, data, dataKey, formatter, domain }: { title: string; subtitle: string; data: any[]; dataKey: string; formatter?: "$K" | "$M" | "$B"; domain?: [number, number] }) {
  return (
    <ChartBlock title={title} subtitle={subtitle}>
      <BarChart data={data}>
        <CartesianGrid stroke="rgba(255,255,255,.08)" />
        <XAxis dataKey="name" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
        <YAxis
          stroke="rgba(207,250,254,.45)"
          tick={{ fontSize: 11 }}
          domain={domain}
          tickFormatter={(value) => formatter ? `$${value}${formatter.slice(1)}` : y(value as number)}
        />
        <Tooltip cursor={{ fill: "rgba(34,211,238,.08)" }} content={<LuminousChartTooltip formatter={getTooltipFormat(formatter)} headline="Constellis metric" />} />
        <Bar dataKey={dataKey} fill="#22d3ee" radius={[10, 10, 0, 0]} />
      </BarChart>
    </ChartBlock>
  );
}

export function ConstellisCharts() {
  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <BarPanel title="Constellis contract portfolio" subtitle="Source: uploaded Constellis visual; active vehicle ceiling/value shown in $B." data={contractData} dataKey="value" formatter="$B" />
      <ChartBlock title="Constellis annual injury-cost exposure" subtitle="Source: uploaded Constellis visual; direct cost plus additional high estimate shown in $M.">
        <BarChart data={injuryCostData}>
          <CartesianGrid stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="name" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
          <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} tickFormatter={(value) => `$${value}M`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Tooltip cursor={{ fill: "rgba(34,211,238,.08)" }} content={<LuminousChartTooltip formatter="currencyM" headline="injury cost stack" />} />
          <Bar dataKey="direct" name="Direct low" stackId="cost" fill="#22d3ee" />
          <Bar dataKey="additional" name="Additional high" stackId="cost" fill="#ef4444" radius={[10, 10, 0, 0]} />
        </BarChart>
      </ChartBlock>
      <ChartBlock title="Centerra DOE fitness-for-duty exam revenue" subtitle="Source: uploaded Centerra DOE visual; annual revenue shown in $K.">
        <BarChart data={doeExamData}>
          <CartesianGrid stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="name" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
          <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} tickFormatter={(value) => `$${value}K`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Tooltip cursor={{ fill: "rgba(34,211,238,.08)" }} content={<LuminousChartTooltip formatter="currencyK" headline="exam revenue stack" />} />
          <Bar dataKey="low" name="Low" stackId="rev" fill="#22d3ee" />
          <Bar dataKey="additional" name="Additional" stackId="rev" fill="#ef4444" radius={[10, 10, 0, 0]} />
        </BarChart>
      </ChartBlock>
      <BarPanel title="GPS MATOC annual new-hire exam volume" subtitle="Source: uploaded GPS MATOC visual; annual pre-employment exam volume by turnover scenario." data={gpsExamData} dataKey="exams" />
      <div className="xl:col-span-2">
        <BarPanel title="Constellis workforce risk by BLS TRIR benchmark" subtitle="Source: uploaded Constellis visual; worker population benchmark risk." data={trirData} dataKey="value" domain={[0, 3.3]} />
      </div>
    </div>
  );
}
