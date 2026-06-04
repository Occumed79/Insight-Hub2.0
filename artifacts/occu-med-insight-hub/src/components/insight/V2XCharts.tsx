import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from "recharts";
import { ChartBlock } from "./ChartBlock";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const allMetrics2024 = [
  { month: "Jan", trir: 0.97, dart: 0.66, nearMiss: 1.03 },
  { month: "Feb", trir: 0.81, dart: 0.54, nearMiss: 1.03 },
  { month: "Mar", trir: 0.53, dart: 0.34, nearMiss: 0.96 },
  { month: "Apr", trir: 0.67, dart: 0.64, nearMiss: 0.70 },
  { month: "May", trir: 0.36, dart: 0.31, nearMiss: 0.60 },
  { month: "Jun", trir: 0.55, dart: 0.35, nearMiss: 0.96 },
  { month: "Jul", trir: 0.82, dart: 0.48, nearMiss: 1.13 },
  { month: "Aug", trir: 0.58, dart: 0.50, nearMiss: 0.67 },
  { month: "Sep", trir: 0.45, dart: 0.34, nearMiss: 0.88 },
  { month: "Oct", trir: 0.63, dart: 0.43, nearMiss: 0.74 },
  { month: "Nov", trir: 0.64, dart: 0.50, nearMiss: 1.48 },
  { month: "Dec", trir: 0.52, dart: 0.30, nearMiss: 1.10 },
];

const annualSafety = [
  { year: "CY2023", dart: 0.34, trir: 0.47, nearMiss: 0.63 },
  { year: "CY2024", dart: 0.45, trir: 0.62, nearMiss: 0.93 },
];

const customerMix = [
  { name: "Army", value: 42.5 },
  { name: "Navy", value: 33.3 },
  { name: "Other", value: 13.0 },
  { name: "Air Force", value: 11.1 },
];

const revenueGrowth = [
  { year: "FY2020", revenue: 1400 },
  { year: "FY2021", revenue: 1400 },
  { year: "FY2022", revenue: 2900 },
  { year: "FY2023", revenue: 4000 },
  { year: "FY2024", revenue: 4300 },
];

const regionRevenue = [
  { region: "United States", fy2022: 1500, fy2023: 2300, fy2024: 2400 },
  { region: "Middle East", fy2022: 1000, fy2023: 1200, fy2024: 1400 },
  { region: "Asia/INDOPACOM", fy2022: 200, fy2023: 300, fy2024: 300 },
  { region: "Europe", fy2022: 200, fy2023: 200, fy2024: 200 },
];

const regionGrowth = [
  { region: "Middle East", old: 16.5, latest: 17.2 },
  { region: "INDOPACOM", old: 57.6, latest: 23.7 },
  { region: "Europe", old: 7.4, latest: -5.5 },
  { region: "United States", old: 52.9, latest: 4.5 },
];

const hoursData = [
  { year: "2022", hours: 99.9 },
  { year: "2023", hours: 105.2 },
  { year: "2024", hours: 86.4 },
];

const injuryMix = [
  { type: "Sprain/Strain", y2022: 41.7, y2023: 38.3, y2024: 45 },
  { type: "Laceration", y2022: 17.3, y2023: 15.9, y2024: 15 },
  { type: "Bruise", y2022: 9.0, y2023: 9.2, y2024: 11 },
  { type: "Fracture", y2022: 3.2, y2023: 5.8, y2024: 6 },
  { type: "Swelling", y2022: 0, y2023: 1.7, y2024: 2 },
];

const nearMissTrend = [
  { year: "2021", value: 0.09 },
  { year: "2022", value: 0.25 },
  { year: "2023", value: 0.60 },
  { year: "2024", value: 0.93 },
];

const wcReserve = [
  { period: "Dec 2022", value: 2.8 },
  { period: "Dec 2023", value: 7.0 },
  { period: "Dec 2024", value: 9.5 },
];

const riskMatrix = [
  { name: "Europe", revenue: 0.21, risk: 3.5, workers: 150 },
  { name: "INDOPACOM", revenue: 0.33, risk: 6.0, workers: 260 },
  { name: "CONUS Aviation", revenue: 1.10, risk: 8.0, workers: 600 },
  { name: "CONUS Base Ops", revenue: 1.28, risk: 5.0, workers: 520 },
  { name: "Kuwait/Iraq", revenue: 1.40, risk: 9.0, workers: 760 },
];

function BarPanel({ title, subtitle, data, dataKey, formatter, domain }: { title: string; subtitle: string; data: any[]; dataKey: string; formatter?: "$M" | "%" | "M hrs"; domain?: [number, number] }) {
  return (
    <ChartBlock title={title} subtitle={subtitle}>
      <BarChart data={data}>
        <CartesianGrid stroke="rgba(255,255,255,.08)" />
        <XAxis dataKey="name" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
        <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} domain={domain} tickFormatter={(value) => formatter === "$M" ? `$${value}M` : formatter === "%" ? `${value}%` : formatter === "M hrs" ? `${value}M` : `${value}`} />
        <Bar dataKey={dataKey} fill="#22d3ee" radius={[10, 10, 0, 0]} />
      </BarChart>
    </ChartBlock>
  );
}

export function V2XCharts() {
  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <ChartBlock title="V2X CY2024 all three safety metrics by month" subtitle="Source: uploaded V2X EHS visual; January and July spikes plus November near-miss peak.">
        <AreaChart data={allMetrics2024}>
          <CartesianGrid stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="month" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
          <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} domain={[0, 1.6]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Area type="monotone" dataKey="nearMiss" name="Near Miss" stroke="#22c55e" fill="rgba(34,197,94,.25)" />
          <Area type="monotone" dataKey="trir" name="TRIR" stroke="#ef4444" fill="rgba(239,68,68,.22)" />
          <Area type="monotone" dataKey="dart" name="DART" stroke="#f97316" fill="rgba(249,115,22,.22)" />
        </AreaChart>
      </ChartBlock>
      <ChartBlock title="V2X annual safety rates: CY2023 vs CY2024" subtitle="Source: uploaded V2X YTD chart; TRIR +32%, DART +32%, near miss +48% YoY.">
        <BarChart data={annualSafety}>
          <CartesianGrid stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="year" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
          <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} domain={[0, 1]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="dart" name="DART" fill="#22d3ee" radius={[8, 8, 0, 0]} />
          <Bar dataKey="trir" name="TRIR" fill="#ef4444" radius={[8, 8, 0, 0]} />
          <Bar dataKey="nearMiss" name="Near Miss" fill="#22c55e" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ChartBlock>
      <BarPanel title="V2X FY2024 revenue by customer" subtitle="Source: uploaded SEC 10-K visual; customer mix percentage." data={customerMix} dataKey="value" formatter="%" domain={[0, 50]} />
      <ChartBlock title="V2X revenue growth FY2020-FY2024" subtitle="Source: uploaded SEC 10-K visual; 2022 Vectrus-Vertex merger doubled revenue.">
        <AreaChart data={revenueGrowth}>
          <CartesianGrid stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="year" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
          <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} tickFormatter={(value) => `$${value}M`} />
          <Area type="monotone" dataKey="revenue" stroke="#22d3ee" fill="rgba(34,211,238,.25)" strokeWidth={3} />
        </AreaChart>
      </ChartBlock>
      <ChartBlock title="V2X revenue by region FY2022-FY2024" subtitle="Source: uploaded SEC 10-K visual; Middle East and United States are largest shown regions.">
        <BarChart data={regionRevenue}>
          <CartesianGrid stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="region" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
          <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} tickFormatter={(value) => `$${value}M`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="fy2022" name="FY2022" fill="#22d3ee" radius={[8, 8, 0, 0]} />
          <Bar dataKey="fy2023" name="FY2023" fill="#ef4444" radius={[8, 8, 0, 0]} />
          <Bar dataKey="fy2024" name="FY2024" fill="#22c55e" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ChartBlock>
      <ChartBlock title="V2X revenue growth by region" subtitle="Source: uploaded SEC 10-K visual; latest period shows Europe decline and INDOPACOM still positive.">
        <BarChart data={regionGrowth}>
          <CartesianGrid stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="region" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
          <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="old" name="FY2022-FY2023" fill="#22d3ee" radius={[8, 8, 0, 0]} />
          <Bar dataKey="latest" name="FY2023-FY2024" fill="#ef4444" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ChartBlock>
      <ChartBlock title="V2X recordable injury mix 2022-2024" subtitle="Source: uploaded V2X EHS metrics visual; sprains/strains are the leading cause at 45% in 2024.">
        <BarChart data={injuryMix}>
          <CartesianGrid stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="type" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
          <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="y2022" name="2022" fill="#22d3ee" radius={[8, 8, 0, 0]} />
          <Bar dataKey="y2023" name="2023" fill="#ef4444" radius={[8, 8, 0, 0]} />
          <Bar dataKey="y2024" name="2024" fill="#22c55e" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ChartBlock>
      <ChartBlock title="V2X near-miss reporting trend" subtitle="Source: uploaded Good Catch Program visual; near-miss rate grows from 0.09 to 0.93.">
        <AreaChart data={nearMissTrend}>
          <CartesianGrid stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="year" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
          <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} domain={[0, 1]} />
          <Area type="monotone" dataKey="value" stroke="#22c55e" fill="rgba(34,197,94,.3)" strokeWidth={3} />
        </AreaChart>
      </ChartBlock>
      <BarPanel title="V2X total hours worked" subtitle="Source: uploaded V2X EHS metrics visual; 2024 excludes training sites and classified programs." data={hoursData.map((item) => ({ name: item.year, value: item.hours }))} dataKey="value" formatter="M hrs" />
      <ChartBlock title="V2X injury risk matrix by region" subtitle="Source: uploaded V2X risk matrix visual; bubble size reflects workforce estimate.">
        <ScatterChart>
          <CartesianGrid stroke="rgba(255,255,255,.08)" />
          <XAxis type="number" dataKey="revenue" name="Revenue" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} tickFormatter={(value) => `$${value}B`} domain={[0, 1.6]} />
          <YAxis type="number" dataKey="risk" name="Risk" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} domain={[0, 10]} />
          <ZAxis type="number" dataKey="workers" range={[80, 700]} />
          <Scatter data={riskMatrix} fill="#ef4444" />
        </ScatterChart>
      </ChartBlock>
      <ChartBlock title="V2X workers' comp reserves rising" subtitle="Source: uploaded SEC 10-K visual; current accrued liabilities up 240% since 2022.">
        <AreaChart data={wcReserve}>
          <CartesianGrid stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="period" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} />
          <YAxis stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} tickFormatter={(value) => `$${value}M`} domain={[0, 10]} />
          <Area type="monotone" dataKey="value" stroke="#ef4444" fill="rgba(239,68,68,.3)" strokeWidth={3} />
        </AreaChart>
      </ChartBlock>
    </div>
  );
}
