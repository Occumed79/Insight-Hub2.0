import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { ChartBlock } from "./ChartBlock";
import { LuminousChartTooltip } from "./LuminousChartTooltip";

const blastNoiseData = [
  { name: "OSHA Action", value: 85 },
  { name: "OSHA Permissible", value: 90 },
  { name: "M16/M4", value: 158 },
  { name: "M249 SAW", value: 162 },
  { name: "M2 .50 Cal", value: 165 },
  { name: "Artillery Sim", value: 180 },
  { name: "Pyro Blast", value: 170 },
];

const contractData = [
  { name: "XCTC ANG", value: 555 },
  { name: "Army IDIQ", value: 530 },
  { name: "USASOC SOF", value: 150 },
  { name: "Winn Army", value: 8.6 },
  { name: "NATO Linguist", value: 2.4 },
];

const heatData = [
  { name: "Fort Irwin", temp: 116, risk: 9 },
  { name: "Fort Johnson", temp: 102, risk: 8 },
  { name: "Grafenwoehr", temp: 88, risk: 4 },
  { name: "Fort Cavazos", temp: 110, risk: 8 },
  { name: "Fort Bliss", temp: 113, risk: 8 },
  { name: "CMTC Europe", temp: 90, risk: 4 },
];

const revenueData = [
  { name: "Blast Audio", value: 344 },
  { name: "Pre-Employ", value: 172 },
  { name: "DBA Pre-Deploy", value: 202 },
  { name: "Heat Illness", value: 100 },
  { name: "Standard Audio", value: 69 },
  { name: "Drug Screen", value: 23 },
  { name: "DOT/CDL", value: 35 },
];

const trirData = [
  { name: "Range Cadre", value: 2.0 },
  { name: "SOF Trainers", value: 2.2 },
  { name: "Mechanics", value: 3.2 },
  { name: "Logistics", value: 3.9 },
  { name: "Linguists", value: 0.5 },
  { name: "Hospital/Base", value: 1.8 },
  { name: "Program/Admin", value: 0.6 },
];

function y(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function getTooltipFormat(formatter?: "$K" | "$M" | "°F" | "dB") {
  if (formatter === "$K") return "currencyK" as const;
  if (formatter === "$M") return "currencyM" as const;
  return "plain" as const;
}

function BarPanel({ title, subtitle, data, dataKey, formatter, domain }: { title: string; subtitle: string; data: any[]; dataKey: string; formatter?: "$K" | "$M" | "°F" | "dB"; domain?: [number, number] }) {
  return (
    <ChartBlock title={title} subtitle={subtitle}>
      <BarChart data={data}>
        <CartesianGrid stroke="rgba(255,255,255,.08)" />
        <XAxis dataKey="name" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
        <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} domain={domain} tickFormatter={(value) => formatter === "$K" || formatter === "$M" ? `$${value}${formatter.slice(1)}` : formatter === "°F" ? `${value}°F` : formatter === "dB" ? `${value} dB` : y(value as number)} />
        <Tooltip cursor={{ fill: "rgba(34,211,238,.08)" }} content={<LuminousChartTooltip formatter={getTooltipFormat(formatter)} headline="Valiant metric" />} />
        {dataKey === "temp" ? <Legend wrapperStyle={{ fontSize: 11 }} /> : null}
        {dataKey === "temp" ? <Bar dataKey="risk" name="Risk score" fill="#ef4444" radius={[10, 10, 0, 0]} /> : null}
        <Bar dataKey={dataKey} name={dataKey === "temp" ? "Peak temp" : undefined} fill="#22d3ee" radius={[10, 10, 0, 0]} />
      </BarChart>
    </ChartBlock>
  );
}

export function ValiantCharts() {
  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <ChartBlock title="Training range noise vs OSHA thresholds" subtitle="Source: uploaded Valiant visual; peak sound levels in dB with OSHA and NIH reference lines.">
        <BarChart data={blastNoiseData}>
          <CartesianGrid stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="name" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
          <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} domain={[0, 185]} tickFormatter={(value) => `${value} dB`} />
          <Tooltip cursor={{ fill: "rgba(34,211,238,.08)" }} content={<LuminousChartTooltip headline="noise exposure" />} />
          <ReferenceLine y={85} stroke="#22c55e" strokeDasharray="4 4" label={{ value: "85 dB OSHA action", fill: "#bbf7d0", fontSize: 10 }} />
          <ReferenceLine y={90} stroke="#16a34a" strokeDasharray="4 4" label={{ value: "90 dB OSHA permissible", fill: "#bbf7d0", fontSize: 10 }} />
          <ReferenceLine y={140} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "140 dB NIH", fill: "#fde68a", fontSize: 10 }} />
          <Bar dataKey="value" fill="#dc2626" radius={[10, 10, 0, 0]} />
        </BarChart>
      </ChartBlock>
      <BarPanel title="Valiant federal contract portfolio" subtitle="Source: uploaded Valiant visual; contract value shown in $M." data={contractData} dataKey="value" formatter="$M" />
      <BarPanel title="XCTC training site peak summer temperatures" subtitle="Source: uploaded Valiant visual; peak summer temperature by training site." data={heatData} dataKey="temp" formatter="°F" domain={[0, 125]} />
      <BarPanel title="Valiant Occu-Med revenue potential" subtitle="Source: uploaded Valiant visual; annual revenue shown in $K by exam type." data={revenueData} dataKey="value" formatter="$K" />
      <div className="xl:col-span-2">
        <BarPanel title="Valiant worker risk by BLS TRIR benchmark" subtitle="Source: uploaded Valiant visual; worker category benchmark risk." data={trirData} dataKey="value" domain={[0, 4.2]} />
      </div>
    </div>
  );
}
