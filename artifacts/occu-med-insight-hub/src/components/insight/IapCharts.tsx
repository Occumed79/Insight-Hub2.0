import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { ChartBlock } from "./ChartBlock";
import { LuminousChartTooltip } from "./LuminousChartTooltip";

const contractData = [
  { name: "NSA Souda Bay", value: 9 },
  { name: "DoD BOS IDIQ", value: 58 },
  { name: "LOGCAP V", value: 120 },
  { name: "GCS MAC III", value: 80 },
  { name: "IAP-ECC JV", value: 25 },
];

const dbaCompareData = [
  { name: "IDS Intl", oconus: 70 },
  { name: "IAP", oconus: 80 },
  { name: "Constellis", oconus: 15 },
  { name: "GDIT", oconus: 5 },
  { name: "Cloveltch", oconus: 10 },
];

const injuryCostData = [
  { name: "Power Gen", low: 640, additional: 512 },
  { name: "BOS Facilities", low: 375, additional: 300 },
  { name: "Logistics", low: 780, additional: 624 },
  { name: "Program Mgmt", low: 105, additional: 84 },
];

const revenueData = [
  { name: "DBA Pre-Deploy", value: 245 },
  { name: "Pre-Employment", value: 65 },
  { name: "Hearing", value: 43 },
  { name: "Electrical Safety", value: 45 },
  { name: "Respirator", value: 45 },
  { name: "DOT/CDL", value: 18 },
];

const trirData = [
  { name: "Power Gen", value: 3.2 },
  { name: "BOS Facilities", value: 2.5 },
  { name: "Logistics", value: 3.9 },
  { name: "Program Mgmt", value: 0.7 },
];

function y(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function getTooltipFormat(formatter?: "$K" | "$M" | "%") {
  if (formatter === "$K") return "currencyK" as const;
  if (formatter === "$M") return "currencyM" as const;
  if (formatter === "%") return "percent" as const;
  return "plain" as const;
}

function BarPanel({ title, subtitle, data, dataKey, formatter, domain }: { title: string; subtitle: string; data: any[]; dataKey: string; formatter?: "$K" | "$M" | "%"; domain?: [number, number] }) {
  return (
    <ChartBlock title={title} subtitle={subtitle}>
      <BarChart data={data}>
        <CartesianGrid stroke="rgba(255,255,255,.08)" />
        <XAxis dataKey="name" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
        <YAxis
          stroke="rgba(207,250,254,.45)"
          tick={{ fontSize: 11 }}
          domain={domain}
          tickFormatter={(value) => formatter === "$K" || formatter === "$M" ? `$${value}${formatter.slice(1)}` : formatter === "%" ? `${value}%` : y(value as number)}
        />
        <Tooltip cursor={{ fill: "rgba(34,211,238,.08)" }} content={<LuminousChartTooltip formatter={getTooltipFormat(formatter)} headline="IAP metric" />} />
        <Bar dataKey={dataKey} fill="#22d3ee" radius={[10, 10, 0, 0]} />
      </BarChart>
    </ChartBlock>
  );
}

export function IapCharts() {
  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <BarPanel title="IAP active contract revenue streams" subtitle="Source: uploaded IAP visual; estimated annual value shown in $M." data={contractData} dataKey="value" formatter="$M" />
      <BarPanel title="OCONUS workforce percentage / DBA exposure" subtitle="Source: uploaded IAP comparison visual; estimated workforce OCONUS percentage." data={dbaCompareData} dataKey="oconus" formatter="%" domain={[0, 90]} />
      <ChartBlock title="IAP estimated annual DBA injury costs" subtitle="Source: uploaded IAP visual; low DBA average plus additional modeled cost shown in $K.">
        <BarChart data={injuryCostData}>
          <CartesianGrid stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="name" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
          <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} tickFormatter={(value) => `$${value}K`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Tooltip cursor={{ fill: "rgba(34,211,238,.08)" }} content={<LuminousChartTooltip formatter="currencyK" headline="DBA cost stack" />} />
          <Bar dataKey="low" name="Low DBA avg" stackId="cost" fill="#22d3ee" />
          <Bar dataKey="additional" name="Additional" stackId="cost" fill="#ef4444" radius={[10, 10, 0, 0]} />
        </BarChart>
      </ChartBlock>
      <BarPanel title="IAP Occu-Med revenue by exam type" subtitle="Source: uploaded IAP visual; annual revenue potential shown in $K." data={revenueData} dataKey="value" formatter="$K" />
      <div className="xl:col-span-2">
        <BarPanel title="IAP worker risk by BLS TRIR benchmark" subtitle="Source: uploaded IAP visual; worker category TRIR benchmark." data={trirData} dataKey="value" domain={[0, 4.2]} />
      </div>
    </div>
  );
}
