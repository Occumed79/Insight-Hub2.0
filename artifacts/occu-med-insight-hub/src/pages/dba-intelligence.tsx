import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Database,
  FileSpreadsheet,
  Globe2,
  Layers3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { DbaCumulativeWorkspace } from "@/components/insight/DbaCumulativeWorkspace";
import {
  loadDbaHub,
  type DbaHubCounts,
  type DbaHubDimension,
  type DbaHubRecord,
  type DbaHubResponse,
} from "@/data/dbaHubApi";

const CATEGORY_CONFIG: Array<{
  key: keyof DbaHubCounts;
  label: string;
  shortLabel: string;
  color: string;
}> = [
  { key: "nlt", label: "No lost time", shortLabel: "NLT", color: "#67e8f9" },
  { key: "lto3", label: "Lost time ≤3 days", shortLabel: "LTO3", color: "#a78bfa" },
  { key: "lto4", label: "Lost time ≥4 days", shortLabel: "LTO4", color: "#f472b6" },
  { key: "dea", label: "Death-coded", shortLabel: "DEA", color: "#fb7185" },
  { key: "cop", label: "Continuation of pay", shortLabel: "COP", color: "#34d399" },
  { key: "oth", label: "Other / unknown", shortLabel: "OTH", color: "#fbbf24" },
];

const TAB_LABELS = {
  employer: "Employer Data",
  country: "Country Trends",
  carrier: "Carrier Trends",
  cumulative: "2001–2024 Cumulative",
  notes: "Data Notes",
} as const;

type WorkspaceTab = keyof typeof TAB_LABELS;

type YearPoint = DbaHubCounts & {
  fiscalYear: number;
  suppressed: boolean;
  sourceRows: number;
};

function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "Suppressed / not reported" : value.toLocaleString();
}

function sumNullable(records: DbaHubRecord[], key: keyof DbaHubCounts): number | null {
  const values = records
    .map((record) => record[key])
    .filter((value): value is number => typeof value === "number");
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

function buildYearPoints(records: DbaHubRecord[], years: number[]): YearPoint[] {
  return years.map((fiscalYear) => {
    const matching = records.filter((record) => record.fiscalYear === fiscalYear);
    return {
      fiscalYear,
      nlt: sumNullable(matching, "nlt"),
      cop: sumNullable(matching, "cop"),
      lto3: sumNullable(matching, "lto3"),
      lto4: sumNullable(matching, "lto4"),
      dea: sumNullable(matching, "dea"),
      oth: sumNullable(matching, "oth"),
      total: sumNullable(matching, "total"),
      suppressed: matching.some((record) => record.suppressed),
      sourceRows: matching.length,
    };
  });
}

function aggregateCategories(points: YearPoint[]) {
  return CATEGORY_CONFIG.map((category) => {
    const values = points
      .map((point) => point[category.key])
      .filter((value): value is number => typeof value === "number");
    return {
      name: category.label,
      value: values.reduce((sum, value) => sum + value, 0),
      color: category.color,
    };
  }).filter((item) => item.value > 0);
}

function trendSummary(points: YearPoint[]) {
  const reported = points.filter((point) => typeof point.total === "number");
  if (!reported.length) return { delta: null, direction: "unavailable" as const, peak: null };
  const first = reported[0];
  const latest = reported[reported.length - 1];
  const delta = first.total && latest.total !== null
    ? ((latest.total - first.total) / first.total) * 100
    : null;
  const direction = delta === null
    ? "unavailable" as const
    : delta > 5
      ? "up" as const
      : delta < -5
        ? "down" as const
        : "stable" as const;
  const peak = [...reported].sort((left, right) => (right.total ?? 0) - (left.total ?? 0))[0];
  return { delta, direction, peak };
}

function MetricCard({ label, value, note, tone = "cyan" }: {
  label: string;
  value: string;
  note: string;
  tone?: "cyan" | "violet" | "emerald" | "rose";
}) {
  const tones = {
    cyan: "border-cyan-200/18 bg-cyan-300/[0.055] shadow-[0_0_34px_rgba(34,211,238,.08)]",
    violet: "border-violet-200/18 bg-violet-300/[0.055] shadow-[0_0_34px_rgba(167,139,250,.08)]",
    emerald: "border-emerald-200/18 bg-emerald-300/[0.055] shadow-[0_0_34px_rgba(52,211,153,.08)]",
    rose: "border-rose-200/18 bg-rose-300/[0.055] shadow-[0_0_34px_rgba(251,113,133,.08)]",
  };
  return (
    <div className={`rounded-[24px] border p-4 backdrop-blur-xl ${tones[tone]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/42">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-cyan-100/48">{note}</p>
    </div>
  );
}

function GlowTrendChart({ points, label }: { points: YearPoint[]; label: string }) {
  return (
    <GlassCard variant="glass" className="min-h-[390px] p-5 md:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/42">Reported trend</p>
      <h2 className="mt-2 text-xl font-black text-white">{label} by fiscal year</h2>
      <p className="mt-1 text-xs leading-5 text-cyan-100/48">The illuminated line follows the total reported in the imported employer rows.</p>
      <div className="mt-5 h-[285px] rounded-[22px] border border-cyan-100/10 bg-slate-950/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.05),inset_0_0_34px_rgba(34,211,238,.04)]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 16, right: 18, left: 0, bottom: 6 }}>
            <defs>
              <linearGradient id="dbaTrendFill" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#67e8f9" />
                <stop offset="52%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#f472b6" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(165,243,252,.08)" vertical={false} />
            <XAxis dataKey="fiscalYear" tickFormatter={(value) => `FY${String(value).slice(-2)}`} tick={{ fill: "rgba(207,250,254,.58)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "rgba(207,250,254,.48)", fontSize: 10 }} axisLine={false} tickLine={false} width={54} />
            <Tooltip
              formatter={(value) => [Number(value).toLocaleString(), "Reported total"]}
              labelFormatter={(value) => `Fiscal year ${value}`}
              contentStyle={{ background: "rgba(5, 18, 38, .88)", border: "1px solid rgba(165,243,252,.30)", borderRadius: 16, color: "#ecfeff", boxShadow: "0 18px 52px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.10), inset 0 0 24px rgba(34,211,238,.08)", backdropFilter: "blur(18px) saturate(1.35)", WebkitBackdropFilter: "blur(18px) saturate(1.35)" }} itemStyle={{ color: "#ecfeff", fontWeight: 700 }} labelStyle={{ color: "rgba(207,250,254,.72)", fontWeight: 700, marginBottom: 4 }} wrapperStyle={{ outline: "none", zIndex: 40 }}
            />
            <Line type="monotone" dataKey="total" stroke="url(#dbaTrendFill)" strokeWidth={12} strokeOpacity={0.12} dot={false} activeDot={false} connectNulls />
            <Line
              type="monotone"
              dataKey="total"
              stroke="url(#dbaTrendFill)"
              strokeWidth={3.5}
              connectNulls
              dot={{ r: 5, fill: "#08111f", stroke: "#67e8f9", strokeWidth: 3 }}
              activeDot={{ r: 8, fill: "#ffffff", stroke: "#a78bfa", strokeWidth: 4 }}
              style={{ filter: "drop-shadow(0 0 9px rgba(103,232,249,.78)) drop-shadow(0 0 18px rgba(167,139,250,.42))" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}

function GlowCategoryChart({ points }: { points: YearPoint[] }) {
  return (
    <GlassCard variant="glass" className="min-h-[390px] p-5 md:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-100/45">Claim-category composition</p>
      <h2 className="mt-2 text-xl font-black text-white">Visible category values</h2>
      <p className="mt-1 text-xs leading-5 text-cyan-100/48">Blank or suppressed cells remain absent rather than being converted to zero.</p>
      <div className="mt-5 h-[285px] rounded-[22px] border border-cyan-100/10 bg-slate-950/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.05),inset_0_0_34px_rgba(34,211,238,.04)]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 12, right: 10, left: 0, bottom: 6 }}>
            <CartesianGrid stroke="rgba(165,243,252,.08)" vertical={false} />
            <XAxis dataKey="fiscalYear" tickFormatter={(value) => `FY${String(value).slice(-2)}`} tick={{ fill: "rgba(207,250,254,.58)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "rgba(207,250,254,.48)", fontSize: 10 }} axisLine={false} tickLine={false} width={54} />
            <Tooltip
              formatter={(value, name) => [Number(value).toLocaleString(), String(name)]}
              contentStyle={{ background: "rgba(5, 18, 38, .88)", border: "1px solid rgba(165,243,252,.30)", borderRadius: 16, color: "#ecfeff", boxShadow: "0 18px 52px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.10), inset 0 0 24px rgba(34,211,238,.08)", backdropFilter: "blur(18px) saturate(1.35)", WebkitBackdropFilter: "blur(18px) saturate(1.35)" }} itemStyle={{ color: "#ecfeff", fontWeight: 700 }} labelStyle={{ color: "rgba(207,250,254,.72)", fontWeight: 700, marginBottom: 4 }} wrapperStyle={{ outline: "none", zIndex: 40 }}
            />
            <Legend wrapperStyle={{ fontSize: 10, color: "rgba(207,250,254,.65)" }} />
            {CATEGORY_CONFIG.map((category) => (
              <Bar
                key={category.key}
                dataKey={category.key}
                name={category.shortLabel}
                stackId="categories"
                fill={category.color}
                radius={category.key === "oth" ? [8, 8, 0, 0] : undefined}
                style={{ filter: `drop-shadow(0 0 7px ${category.color}88)` }}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}

function GlowComposition({ points }: { points: YearPoint[] }) {
  const data = aggregateCategories(points);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <GlassCard variant="glass" className="p-5 md:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-fuchsia-100/45">Four-year visible mix</p>
      <h2 className="mt-2 text-xl font-black text-white">Reported category composition</h2>
      <div className="mt-5 grid gap-5 md:grid-cols-[230px_1fr] md:items-center">
        <div className="relative h-[230px] rounded-[22px] border border-cyan-100/10 bg-slate-950/20 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.05),inset_0_0_34px_rgba(167,139,250,.05)]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={68} outerRadius={96} paddingAngle={3} stroke="rgba(255,255,255,.10)" strokeWidth={1}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} style={{ filter: `drop-shadow(0 0 8px ${entry.color}88)` }} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-3xl font-black text-white">{total.toLocaleString()}</p>
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-100/42">Visible categories</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {data.map((entry) => (
            <div key={entry.name} className="flex items-center justify-between gap-3 rounded-2xl border border-cyan-100/10 bg-black/18 px-3 py-3">
              <span className="flex min-w-0 items-center gap-2 text-xs text-cyan-50/72">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: entry.color, boxShadow: `0 0 12px ${entry.color}` }} />
                <span className="truncate">{entry.name}</span>
              </span>
              <span className="font-bold text-white">{entry.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

function RankedLatestChart({ records, dimension, latestYear }: {
  records: DbaHubRecord[];
  dimension: "country" | "carrier";
  latestYear: number;
}) {
  const data = records
    .filter((record) => record.dimension === dimension && record.fiscalYear === latestYear && typeof record.total === "number")
    .sort((left, right) => (right.total ?? 0) - (left.total ?? 0))
    .slice(0, 12)
    .map((record) => ({ name: record.sourceName, total: record.total }));
  return (
    <GlassCard variant="glass" className="min-h-[520px] p-5 md:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/42">FY{String(latestYear).slice(-2)} ranking</p>
      <h2 className="mt-2 text-xl font-black text-white">Top reported {dimension === "country" ? "countries" : "carriers"}</h2>
      <div className="mt-5 h-[420px] rounded-[22px] border border-cyan-100/10 bg-slate-950/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.05),inset_0_0_34px_rgba(34,211,238,.04)]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 8, bottom: 5 }}>
            <CartesianGrid stroke="rgba(165,243,252,.07)" horizontal={false} />
            <XAxis type="number" tick={{ fill: "rgba(207,250,254,.48)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis dataKey="name" type="category" width={170} tick={{ fill: "rgba(207,250,254,.62)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(value) => [Number(value).toLocaleString(), "Reported total"]} contentStyle={{ background: "rgba(5, 18, 38, .88)", border: "1px solid rgba(165,243,252,.30)", borderRadius: 16, color: "#ecfeff", boxShadow: "0 18px 52px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.10), inset 0 0 24px rgba(34,211,238,.08)", backdropFilter: "blur(18px) saturate(1.35)", WebkitBackdropFilter: "blur(18px) saturate(1.35)" }} itemStyle={{ color: "#ecfeff", fontWeight: 700 }} labelStyle={{ color: "rgba(207,250,254,.72)", fontWeight: 700, marginBottom: 4 }} wrapperStyle={{ outline: "none", zIndex: 40 }} />
            <Bar dataKey="total" fill="#67e8f9" radius={[0, 9, 9, 0]} style={{ filter: "drop-shadow(0 0 8px rgba(103,232,249,.62))" }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}

function YearTable({ points }: { points: YearPoint[] }) {
  return (
    <GlassCard variant="glass" className="overflow-hidden p-0">
      <div className="border-b border-cyan-100/10 p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/42">Source detail</p>
        <h2 className="mt-2 text-xl font-black text-white">Fiscal-year values</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-xs">
          <thead className="bg-cyan-300/[0.045] text-[9px] uppercase tracking-[0.18em] text-cyan-100/45">
            <tr>
              <th className="px-5 py-3">Fiscal year</th>
              <th className="px-4 py-3">Reported total</th>
              {CATEGORY_CONFIG.map((category) => <th key={category.key} className="px-4 py-3">{category.shortLabel}</th>)}
              <th className="px-4 py-3">Source rows</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.fiscalYear} className="border-t border-cyan-100/[0.07] text-cyan-50/68">
                <td className="px-5 py-4 font-bold text-white">FY{point.fiscalYear}</td>
                <td className="px-4 py-4 font-bold text-cyan-100">{formatNumber(point.total)}</td>
                {CATEGORY_CONFIG.map((category) => <td key={category.key} className="px-4 py-4">{formatNumber(point[category.key])}</td>)}
                <td className="px-4 py-4">{point.sourceRows}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

function EntityWorkspace({ data, dimension }: { data: DbaHubResponse; dimension: "country" | "carrier" }) {
  const names = useMemo(() => Array.from(new Set(
    data.records.filter((record) => record.dimension === dimension).map((record) => record.canonicalName),
  )).sort(), [data.records, dimension]);
  const [selectedName, setSelectedName] = useState(() => names[0] ?? "");
  useEffect(() => {
    if (!names.includes(selectedName)) setSelectedName(names[0] ?? "");
  }, [names, selectedName]);
  const selectedRecords = data.records.filter((record) => record.dimension === dimension && record.canonicalName === selectedName);
  const points = buildYearPoints(selectedRecords, data.years);
  const latestYear = data.years[data.years.length - 1] ?? 2024;
  const summary = trendSummary(points);
  return (
    <>
      <GlassCard variant="glass" className="mb-6 p-5 md:p-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <label>
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/45">Select {dimension}</span>
            <select value={selectedName} onChange={(event) => setSelectedName(event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-cyan-100/14 bg-[#07111d] px-4 text-sm text-white outline-none focus:border-cyan-200/35">
              {names.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <div className="rounded-2xl border border-cyan-100/12 bg-black/18 px-4 py-3 text-xs text-cyan-100/52">
            {names.length.toLocaleString()} {dimension === "country" ? "countries" : "carrier names"} with reported values
          </div>
        </div>
      </GlassCard>
      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Four-year total" value={formatNumber(sumNullable(selectedRecords, "total"))} note="Sum of reported annual totals" />
        <MetricCard label={`FY${String(latestYear).slice(-2)} total`} value={formatNumber(points.find((point) => point.fiscalYear === latestYear)?.total)} note="Latest imported fiscal year" tone="violet" />
        <MetricCard label="Reported direction" value={summary.direction === "up" ? "Increasing" : summary.direction === "down" ? "Declining" : summary.direction === "stable" ? "Stable" : "Unavailable"} note={summary.delta === null ? "Not enough comparable totals" : `${Math.abs(summary.delta).toFixed(1)}% from first to latest reported year`} tone={summary.direction === "up" ? "rose" : summary.direction === "down" ? "emerald" : "cyan"} />
        <MetricCard label="Peak year" value={summary.peak ? `FY${summary.peak.fiscalYear}` : "Unavailable"} note={summary.peak ? `${formatNumber(summary.peak.total)} reported cases` : "No reported total"} tone="emerald" />
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <GlowTrendChart points={points} label={selectedName || `Selected ${dimension}`} />
        <GlowCategoryChart points={points} />
      </section>
      <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <RankedLatestChart records={data.records} dimension={dimension} latestYear={latestYear} />
        <GlowComposition points={points} />
      </section>
      <section className="mt-6"><YearTable points={points} /></section>
    </>
  );
}

function EmployerWorkspace({ data }: { data: DbaHubResponse }) {
  const [selectedCompany, setSelectedCompany] = useState(() => data.employers[0]?.canonicalName ?? "");
  useEffect(() => {
    if (!data.employers.some((employer) => employer.canonicalName === selectedCompany)) {
      setSelectedCompany(data.employers[0]?.canonicalName ?? "");
    }
  }, [data.employers, selectedCompany]);
  const employer = data.employers.find((item) => item.canonicalName === selectedCompany) ?? data.employers[0] ?? null;
  const selectedRecords = data.records.filter((record) => record.dimension === "employer" && record.canonicalName === employer?.canonicalName);
  const points = buildYearPoints(selectedRecords, data.years);
  const summary = trendSummary(points);
  const latestYear = data.years[data.years.length - 1] ?? 2024;
  const latest = points.find((point) => point.fiscalYear === latestYear);
  const previous = points.find((point) => point.fiscalYear === latestYear - 1);
  const yoy = latest?.total !== null && latest?.total !== undefined && previous?.total
    ? ((latest.total - previous.total) / previous.total) * 100
    : null;
  const categoryTotals = aggregateCategories(points).sort((left, right) => right.value - left.value);
  const leadingCategory = categoryTotals[0];

  return (
    <>
      <GlassCard variant="glass" className="mb-6 overflow-hidden p-0">
        <div className="relative grid gap-6 p-5 md:p-7 xl:grid-cols-[1.15fr_.85fr] xl:items-end">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(34,211,238,.13),transparent_34%),radial-gradient(circle_at_86%_78%,rgba(168,85,247,.14),transparent_32%)]" />
          <label className="relative">
            <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/45">Select company</span>
            <div className="mt-2 flex min-h-14 items-center gap-3 rounded-[20px] border border-cyan-100/16 bg-[#06101c]/90 px-4 shadow-[0_0_32px_rgba(34,211,238,.08)] focus-within:border-cyan-200/38">
              <Building2 size={18} className="text-cyan-200/55" />
              <select value={employer?.canonicalName ?? ""} onChange={(event) => setSelectedCompany(event.target.value)} className="w-full bg-transparent text-sm font-semibold text-white outline-none">
                {data.employers.map((item) => <option key={item.canonicalName} value={item.canonicalName} className="bg-[#07111d]">{item.canonicalName}</option>)}
              </select>
            </div>
          </label>
          <div className="relative rounded-[22px] border border-violet-200/14 bg-violet-300/[0.055] p-4 shadow-[0_0_34px_rgba(167,139,250,.08)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-100/44">Aliases included</p>
            <p className="mt-2 text-sm font-bold text-white">{employer?.aliases.length ?? 0} source name{employer?.aliases.length === 1 ? "" : "s"}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-violet-100/50">{employer?.aliases.join(" • ") || "No source aliases"}</p>
          </div>
        </div>
      </GlassCard>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Four-year total" value={formatNumber(employer?.reportedTotal)} note="All imported source aliases" />
        <MetricCard label={`FY${String(latestYear).slice(-2)} total`} value={formatNumber(latest?.total)} note="Latest imported fiscal year" tone="violet" />
        <MetricCard label="Year-over-year" value={yoy === null ? "Unavailable" : `${yoy >= 0 ? "+" : ""}${yoy.toFixed(1)}%`} note="FY23 to FY24 reported change" tone={yoy !== null && yoy > 0 ? "rose" : "emerald"} />
        <MetricCard label="Peak year" value={summary.peak ? `FY${summary.peak.fiscalYear}` : "Unavailable"} note={summary.peak ? `${formatNumber(summary.peak.total)} reported cases` : "No total available"} tone="emerald" />
        <MetricCard label="Leading visible category" value={leadingCategory?.name ?? "Unavailable"} note={leadingCategory ? `${leadingCategory.value.toLocaleString()} visible records` : "Categories suppressed"} tone="rose" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <GlowTrendChart points={points} label={employer?.canonicalName ?? "Selected company"} />
        <GlowCategoryChart points={points} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[.86fr_1.14fr]">
        <GlassCard variant="glass" className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/42">Trend interpretation</p>
              <h2 className="mt-2 text-xl font-black text-white">What changed in the reported data</h2>
            </div>
            {summary.direction === "up" ? <TrendingUp className="text-rose-300" /> : <TrendingDown className="text-emerald-300" />}
          </div>
          <div className="mt-5 space-y-3 text-sm leading-7 text-cyan-50/65">
            <p>
              The first-to-latest reported direction is <strong className="text-white">{summary.direction}</strong>
              {summary.delta === null ? "." : ` (${summary.delta >= 0 ? "+" : ""}${summary.delta.toFixed(1)}%).`}
            </p>
            <p>
              The highest reported year is <strong className="text-white">{summary.peak ? `FY${summary.peak.fiscalYear}` : "unavailable"}</strong>
              {summary.peak ? ` with ${formatNumber(summary.peak.total)} cases.` : "."}
            </p>
            <p>
              This describes the source workbooks only. It does not establish a change in workforce size, exposure, safety performance, claim acceptance, or employer responsibility.
            </p>
          </div>
          <div className="mt-5 rounded-2xl border border-amber-200/14 bg-amber-300/[0.06] p-4 text-xs leading-6 text-amber-100/70">
            Privacy-suppressed category cells remain blank. A reported total can therefore be larger than the sum of the visible category values.
          </div>
        </GlassCard>
        <GlowComposition points={points} />
      </section>

      <section className="mt-6"><YearTable points={points} /></section>
    </>
  );
}

function DataNotes({ data }: { data: DbaHubResponse }) {
  const dimensionTotals = (["employer", "country", "carrier"] as DbaHubDimension[]).map((dimension) => ({
    dimension,
    records: data.records.filter((record) => record.dimension === dimension).length,
    sourceRows: data.sources.filter((source) => source.dimension === dimension).reduce((sum, source) => sum + source.sourceRows, 0),
  }));
  return (
    <>
      <section className="mb-6 grid gap-3 md:grid-cols-3">
        {dimensionTotals.map((item) => (
          <MetricCard key={item.dimension} label={`${item.dimension} records`} value={item.records.toLocaleString()} note={`${item.sourceRows.toLocaleString()} named source rows inventoried`} tone={item.dimension === "employer" ? "cyan" : item.dimension === "country" ? "violet" : "emerald"} />
        ))}
      </section>
      <GlassCard variant="glass" className="mb-6 border-amber-200/14 p-5 md:p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <div>
            <h2 className="font-bold text-amber-50">How totals and suppression are handled</h2>
            <p className="mt-2 text-sm leading-7 text-amber-100/65">
              Workbook-level reported totals are preserved separately from visible analytic rows. Some files contain privacy-suppressed or blank employer, country, carrier, or category detail. Those missing cells are never converted to zero, and the app does not force separate workbook dimensions to reconcile with one another.
            </p>
          </div>
        </div>
      </GlassCard>
      <GlassCard variant="glass" className="overflow-hidden p-0">
        <div className="border-b border-cyan-100/10 p-5 md:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/42">Neon source registry</p>
          <h2 className="mt-2 text-xl font-black text-white">Imported workbook coverage</h2>
          <p className="mt-1 text-xs leading-5 text-cyan-100/48">Every dashboard value is queried from these persisted imports.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="bg-cyan-300/[0.045] text-[9px] uppercase tracking-[0.17em] text-cyan-100/45">
              <tr>
                <th className="px-5 py-3">Source workbook</th>
                <th className="px-4 py-3">Dimension</th>
                <th className="px-4 py-3">Fiscal year</th>
                <th className="px-4 py-3">Named rows</th>
                <th className="px-4 py-3">Analytic rows</th>
                <th className="px-4 py-3">Blank / suppressed</th>
                <th className="px-4 py-3">Workbook total</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.sources.map((source) => (
                <tr key={source.sourceFile} className="border-t border-cyan-100/[0.07] text-cyan-50/68">
                  <td className="px-5 py-4 font-semibold text-white">{source.sourceFile}</td>
                  <td className="px-4 py-4 capitalize">{source.dimension}</td>
                  <td className="px-4 py-4">FY{source.fiscalYear}</td>
                  <td className="px-4 py-4">{source.sourceRows.toLocaleString()}</td>
                  <td className="px-4 py-4">{source.analyticRows.toLocaleString()}</td>
                  <td className="px-4 py-4">{source.suppressedOrBlankRows.toLocaleString()}</td>
                  <td className="px-4 py-4 font-bold text-cyan-100">{formatNumber(source.reportedTotal)}</td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${source.redacted ? "border-amber-200/20 bg-amber-300/10 text-amber-100" : "border-emerald-200/20 bg-emerald-300/10 text-emerald-100"}`}>
                      {source.redacted ? "Redacted" : "Imported"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </>
  );
}

export default function DbaDataHub() {
  const [data, setData] = useState<DbaHubResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>("employer");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await loadDbaHub());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The DBA Data Hub could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <main className="aurora-bg min-h-screen pb-24 text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar
          eyebrow="Employer-Level Defense Base Act Analytics"
          title="DBA Data Hub"
          subtitle="Explore FY2021–FY2024 annual trends alongside a separate 2001–2024 cumulative employer, country, and carrier layer persisted in Neon."
        />

        <GlassCard variant="glass" className="mb-6 border-amber-200/14 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <p className="text-xs leading-6 text-amber-100/68">
              {data?.warning ?? "DBA case-summary data is administrative and may contain privacy suppression. Missing values are not zero, and reported counts do not establish liability, employer fault, claim acceptance, or safety performance."}
            </p>
          </div>
        </GlassCard>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative mb-6 overflow-hidden rounded-[34px] border border-cyan-100/14 bg-[radial-gradient(circle_at_82%_14%,rgba(168,85,247,.20),transparent_34%),radial-gradient(circle_at_12%_82%,rgba(34,211,238,.19),transparent_36%),rgba(2,8,23,.84)] p-5 shadow-[0_30px_100px_rgba(0,0,0,.42)] backdrop-blur-2xl md:p-8"
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,.04),transparent)]" />
          <div className="relative grid gap-7 xl:grid-cols-[1.1fr_.9fr] xl:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/16 bg-cyan-300/[0.08] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/65"><Database size={13} /> Neon-backed</span>
                <span className="inline-flex items-center gap-2 rounded-full border border-violet-200/16 bg-violet-300/[0.08] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-100/65"><Sparkles size={13} /> Luminous analytics</span>
              </div>
              <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-[-0.045em] text-white md:text-5xl">Annual movement and 24-year cumulative context in one honest operating picture.</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-cyan-100/56">Use FY2021–FY2024 for annual movement, then open the cumulative workspace for the full 2001–2024 reporting period without pretending employer, country, and carrier extracts are relationally linked.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard label="Persisted analytic rows" value={((data?.records.length ?? 0) + (data?.cumulativeRecords.length ?? 0)).toLocaleString()} note="Annual and cumulative Neon records" />
              <MetricCard label="Source workbooks" value={((data?.sources.length ?? 0) + (data?.cumulativeSources.length ?? 0)).toLocaleString()} note="Annual plus 2001–2024 cumulative" tone="violet" />
              <MetricCard label="Saved employers" value={(data?.employers.length ?? 0).toLocaleString()} note="Canonical dropdown options" tone="emerald" />
              <MetricCard label="Frontend data" value="Zero hardcoded rows" note="All values load through the API" tone="rose" />
            </div>
          </div>
        </motion.section>

        <div className="mb-6 flex flex-wrap gap-2 rounded-[24px] border border-cyan-100/10 bg-black/20 p-2 backdrop-blur-xl">
          {(Object.keys(TAB_LABELS) as WorkspaceTab[]).map((item) => {
            const icons = { employer: Building2, country: Globe2, carrier: Layers3, cumulative: BarChart3, notes: FileSpreadsheet };
            const Icon = icons[item];
            return (
              <button key={item} type="button" onClick={() => setTab(item)} className={`inline-flex min-h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-bold transition ${tab === item ? "border-cyan-200/28 bg-cyan-300/14 text-white shadow-[0_0_26px_rgba(34,211,238,.14)]" : "border-transparent text-cyan-100/48 hover:border-cyan-100/12 hover:bg-white/[0.04] hover:text-cyan-50"}`}>
                <Icon size={16} />{TAB_LABELS[item]}
              </button>
            );
          })}
          <button type="button" onClick={() => void load()} disabled={loading} className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-2xl border border-cyan-100/12 bg-black/18 px-4 text-xs font-bold text-cyan-100/58 transition hover:border-cyan-200/25 hover:text-white disabled:opacity-45">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh Neon data
          </button>
        </div>

        {loading && !data && (
          <GlassCard variant="glass" className="flex min-h-[360px] items-center justify-center p-8">
            <div className="text-center"><Loader2 className="mx-auto h-9 w-9 animate-spin text-cyan-200" /><p className="mt-4 text-sm text-cyan-100/55">Loading the DBA Data Hub from Neon…</p></div>
          </GlassCard>
        )}
        {error && !data && (
          <GlassCard variant="glass" className="border-rose-200/18 p-6"><div className="flex items-start gap-3"><AlertTriangle className="text-rose-300" /><div><h2 className="font-bold text-rose-100">DBA Data Hub unavailable</h2><p className="mt-2 text-sm text-rose-100/65">{error}</p></div></div></GlassCard>
        )}
        {data && tab === "employer" && <EmployerWorkspace data={data} />}
        {data && tab === "country" && <EntityWorkspace data={data} dimension="country" />}
        {data && tab === "carrier" && <EntityWorkspace data={data} dimension="carrier" />}
        {data && tab === "cumulative" && <DbaCumulativeWorkspace data={data} />}
        {data && tab === "notes" && <DataNotes data={data} />}
      </section>
    </main>
  );
}
