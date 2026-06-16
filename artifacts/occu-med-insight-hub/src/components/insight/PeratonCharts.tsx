import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { ChartBlock } from "./ChartBlock";
import { LuminousChartTooltip } from "./LuminousChartTooltip";

const classifiedAwards = [
  { year: "2022", awards: 0.36 },
  { year: "2023", awards: 1.2 },
  { year: "2024", awards: 1.15 },
];

const ipoGap = [
  { metric: "TRIR Published?", peer: 5, peraton: 0 },
  { metric: "Fatality Data Published?", peer: 5, peraton: 0 },
  { metric: "Sustainability Report?", peer: 5, peraton: 0 },
  { metric: "Occ Med Program Docs?", peer: 4, peraton: 1 },
  { metric: "Behavioral Health Protocol?", peer: 2, peraton: 0 },
  { metric: "RF/EMF Surveillance?", peer: 3, peraton: 0 },
];

const revenuePotential = [
  { exam: "Pre-Employment Physicals", revenue: 938 },
  { exam: "DBA Pre-Deploy OCONUS", revenue: 462 },
  { exam: "Behavioral Health IC Workers", revenue: 1550 },
  { exam: "RF/EMF Surveillance", revenue: 155 },
  { exam: "Ergonomic Assessments", revenue: 375 },
  { exam: "Audiometry", revenue: 82 },
];

const revenueBuild = [
  { year: "2017", revenue: 0.7 },
  { year: "2019", revenue: 1.5 },
  { year: "2021", revenue: 7.1 },
  { year: "2022", revenue: 7.4 },
  { year: "2024", revenue: 8.1 },
];

const workerRisk = [
  { category: "Space & Intel Analysts", trir: 0.5 },
  { category: "Cyber Mission", trir: 0.5 },
  { category: "Ground Station Ops & Techs", trir: 2.2 },
  { category: "DHA Health IT OCONUS", trir: 1.2 },
  { category: "Enterprise IT", trir: 0.5 },
];

export function PeratonCharts() {
  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <ChartBlock title="Peraton Space & Intel: Annual classified awards" subtitle="Source: uploaded Peraton visual; classified awards remain above $1B in 2023 and 2024.">
        <BarChart data={classifiedAwards}>
          <CartesianGrid stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="year" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
          <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} tickFormatter={(value) => `$${value}B`} domain={[0, 1.3]} />
          <Tooltip cursor={{ fill: "rgba(34,211,238,.08)" }} content={<LuminousChartTooltip formatter="currencyM" headline="classified awards" />} />
          <Bar dataKey="awards" name="Classified Awards" fill="#22d3ee" radius={[10, 10, 0, 0]} />
        </BarChart>
      </ChartBlock>

      <ChartBlock title="IPO-readiness gap: Peraton vs public peer standards" subtitle="Source: uploaded Peraton ESG/safety maturity visual; public-peer maturity compared with current Peraton visibility.">
        <BarChart data={ipoGap}>
          <CartesianGrid stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="metric" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 9 }} />
          <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} domain={[0, 5]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Tooltip cursor={{ fill: "rgba(34,211,238,.08)" }} content={<LuminousChartTooltip headline="IPO readiness" />} />
          <Bar dataKey="peer" name="Public Peer Avg" fill="#22d3ee" radius={[8, 8, 0, 0]} />
          <Bar dataKey="peraton" name="Peraton Current" fill="#ef4444" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ChartBlock>

      <ChartBlock title="Peraton: Occu-Med revenue potential by exam type" subtitle="Source: uploaded Peraton model; total modeled opportunity approximately $3.562M per year.">
        <BarChart data={revenuePotential}>
          <CartesianGrid stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="exam" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 9 }} />
          <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} tickFormatter={(value) => `$${value}K`} />
          <Tooltip cursor={{ fill: "rgba(34,211,238,.08)" }} content={<LuminousChartTooltip formatter="currencyK" headline="revenue potential" />} />
          <Bar dataKey="revenue" name="Annual Revenue" fill="#22d3ee" radius={[10, 10, 0, 0]} />
        </BarChart>
      </ChartBlock>

      <ChartBlock title="Peraton revenue build-up: 2017-2024" subtitle="Source: uploaded Peraton visual; Perspecta acquisition creates the largest scale jump.">
        <AreaChart data={revenueBuild}>
          <CartesianGrid stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="year" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
          <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} tickFormatter={(value) => `$${value}B`} domain={[0, 9]} />
          <Tooltip content={<LuminousChartTooltip formatter="currencyM" headline="revenue build" />} />
          <Area type="monotone" dataKey="revenue" stroke="#38bdf8" fill="rgba(56,189,248,.25)" strokeWidth={3} />
        </AreaChart>
      </ChartBlock>

      <ChartBlock title="Peraton worker risk by BLS TRIR benchmark" subtitle="Source: uploaded Peraton TRIR model; ground-station ops and techs carry the highest modeled benchmark risk.">
        <BarChart data={workerRisk}>
          <CartesianGrid stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="category" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 9 }} />
          <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} domain={[0, 2.5]} />
          <Tooltip cursor={{ fill: "rgba(34,211,238,.08)" }} content={<LuminousChartTooltip headline="worker risk" />} />
          <Bar dataKey="trir" name="BLS TRIR Benchmark" fill="#ef4444" radius={[10, 10, 0, 0]} />
        </BarChart>
      </ChartBlock>
    </div>
  );
}
