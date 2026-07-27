import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, CalendarRange, Globe2, Layers3 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassCard } from "@/components/insight/GlassCard";
import type {
  DbaHubCounts,
  DbaHubCumulativeRecord,
  DbaHubDimension,
  DbaHubResponse,
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

const DIMENSION_CONFIG: Record<DbaHubDimension, {
  label: string;
  plural: string;
  icon: typeof Building2;
}> = {
  employer: { label: "Employer", plural: "employers", icon: Building2 },
  country: { label: "Country", plural: "countries", icon: Globe2 },
  carrier: { label: "Carrier", plural: "carriers", icon: Layers3 },
};

type CumulativeGroup = {
  canonicalName: string;
  entityId: number | null;
  records: DbaHubCumulativeRecord[];
  aliases: string[];
  total: number | null;
};

function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "Suppressed / not reported" : value.toLocaleString();
}

function sumNullable(records: DbaHubCumulativeRecord[], key: keyof DbaHubCounts): number | null {
  const values = records
    .map((record) => record[key])
    .filter((value): value is number => typeof value === "number");
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

function buildGroups(records: DbaHubCumulativeRecord[]): CumulativeGroup[] {
  const grouped = new Map<string, DbaHubCumulativeRecord[]>();
  for (const record of records) {
    const bucket = grouped.get(record.canonicalName) ?? [];
    bucket.push(record);
    grouped.set(record.canonicalName, bucket);
  }
  return [...grouped.entries()]
    .map(([canonicalName, groupRecords]) => ({
      canonicalName,
      entityId: groupRecords.find((record) => record.entityId !== null)?.entityId ?? null,
      records: groupRecords,
      aliases: Array.from(new Set(groupRecords.map((record) => record.sourceName))).sort(),
      total: sumNullable(groupRecords, "total"),
    }))
    .sort((left, right) => (right.total ?? -1) - (left.total ?? -1) || left.canonicalName.localeCompare(right.canonicalName));
}

function CumulativeMetric({ label, value, note, tone = "cyan" }: {
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

export function DbaCumulativeWorkspace({ data }: { data: DbaHubResponse }) {
  const [dimension, setDimension] = useState<DbaHubDimension>("employer");
  const dimensionRecords = useMemo(
    () => data.cumulativeRecords.filter((record) => record.dimension === dimension),
    [data.cumulativeRecords, dimension],
  );
  const groups = useMemo(() => buildGroups(dimensionRecords), [dimensionRecords]);
  const [selectedName, setSelectedName] = useState(() => groups[0]?.canonicalName ?? "");

  useEffect(() => {
    if (!groups.some((group) => group.canonicalName === selectedName)) {
      setSelectedName(groups[0]?.canonicalName ?? "");
    }
  }, [groups, selectedName]);

  const selected = groups.find((group) => group.canonicalName === selectedName) ?? groups[0] ?? null;
  const source = data.cumulativeSources.find((item) => item.dimension === dimension);
  const period = data.cumulativePeriod ?? { startYear: 2001, endYear: 2024 };
  const sourceTotal = source?.reportedTotal ?? null;
  const selectedTotal = selected?.total ?? null;
  const share = selectedTotal !== null && sourceTotal
    ? (selectedTotal / sourceTotal) * 100
    : null;
  const categories = CATEGORY_CONFIG.map((category) => ({
    ...category,
    value: selected ? sumNullable(selected.records, category.key) : null,
  }));
  const visibleCategories = categories.filter((category) => typeof category.value === "number" && category.value > 0);
  const leadingCategory = [...visibleCategories].sort((left, right) => (right.value ?? 0) - (left.value ?? 0))[0];
  const visibleCategoryTotal = visibleCategories.reduce((sum, category) => sum + (category.value ?? 0), 0);
  const ranking = groups
    .filter((group) => typeof group.total === "number")
    .slice(0, 15)
    .map((group) => ({ name: group.canonicalName, total: group.total }));
  const config = DIMENSION_CONFIG[dimension];
  const SelectedIcon = config.icon;

  return (
    <>
      <GlassCard variant="glass" className="mb-6 overflow-hidden p-0">
        <div className="relative p-5 md:p-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(34,211,238,.14),transparent_34%),radial-gradient(circle_at_88%_80%,rgba(168,85,247,.16),transparent_34%)]" />
          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-200/18 bg-violet-300/[0.08] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-100/65">
                <CalendarRange size={13} /> {period.startYear}–{period.endYear} cumulative
              </div>
              <h2 className="mt-4 text-2xl font-black tracking-[-0.035em] text-white md:text-3xl">Long-range DBA reporting layer</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-cyan-100/55">
                This view summarizes the full cumulative workbook period. It is separate from the FY2021–FY2024 annual trend layer and should not be interpreted as a year-by-year sequence.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 rounded-[20px] border border-cyan-100/10 bg-black/20 p-2">
              {(Object.keys(DIMENSION_CONFIG) as DbaHubDimension[]).map((item) => {
                const ItemIcon = DIMENSION_CONFIG[item].icon;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setDimension(item)}
                    className={`inline-flex min-h-10 items-center gap-2 rounded-2xl border px-3 text-xs font-bold transition ${dimension === item ? "border-cyan-200/28 bg-cyan-300/14 text-white shadow-[0_0_22px_rgba(34,211,238,.14)]" : "border-transparent text-cyan-100/48 hover:border-cyan-100/12 hover:bg-white/[0.04] hover:text-cyan-50"}`}
                  >
                    <ItemIcon size={14} /> {DIMENSION_CONFIG[item].label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard variant="glass" className="mb-6 p-5 md:p-6">
        <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr] xl:items-end">
          <label>
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/45">Select {config.label.toLowerCase()}</span>
            <div className="mt-2 flex min-h-14 items-center gap-3 rounded-[20px] border border-cyan-100/16 bg-[#06101c]/90 px-4 shadow-[0_0_32px_rgba(34,211,238,.08)] focus-within:border-cyan-200/38">
              <SelectedIcon size={18} className="text-cyan-200/55" />
              <select
                value={selected?.canonicalName ?? ""}
                onChange={(event) => setSelectedName(event.target.value)}
                className="w-full bg-transparent text-sm font-semibold text-white outline-none"
              >
                {groups.map((group) => (
                  <option key={group.canonicalName} value={group.canonicalName} className="bg-[#07111d]">
                    {group.canonicalName}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <div className="rounded-[22px] border border-violet-200/14 bg-violet-300/[0.055] p-4 shadow-[0_0_34px_rgba(167,139,250,.08)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-100/44">Source names included</p>
            <p className="mt-2 text-sm font-bold text-white">{selected?.aliases.length ?? 0} reported name{selected?.aliases.length === 1 ? "" : "s"}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-violet-100/50">{selected?.aliases.join(" • ") || "No selected source row"}</p>
          </div>
        </div>
      </GlassCard>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <CumulativeMetric label="Cumulative total" value={formatNumber(selectedTotal)} note={`${period.startYear}–${period.endYear} reported total`} />
        <CumulativeMetric label="Share of dimension" value={share === null ? "Unavailable" : `${share.toFixed(2)}%`} note={`Share of the ${config.label.toLowerCase()} workbook total`} tone="violet" />
        <CumulativeMetric label="Workbook total" value={formatNumber(sourceTotal)} note={`${source?.analyticRows.toLocaleString() ?? "0"} visible analytic rows`} tone="emerald" />
        <CumulativeMetric label="Leading visible category" value={leadingCategory?.label ?? "Unavailable"} note={leadingCategory ? formatNumber(leadingCategory.value) : "Category cells suppressed"} tone="rose" />
        <CumulativeMetric label="Suppression present" value={selected?.records.some((record) => record.suppressed) ? "Yes" : "No"} note="Blank category values remain missing, not zero" tone="cyan" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.12fr_.88fr]">
        <GlassCard variant="glass" className="min-h-[560px] p-5 md:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/42">Cumulative ranking</p>
          <h2 className="mt-2 text-xl font-black text-white">Top reported {config.plural}</h2>
          <p className="mt-1 text-xs leading-5 text-cyan-100/48">Ranked by the cumulative total stored in Neon.</p>
          <div className="mt-5 h-[455px] rounded-[22px] border border-cyan-100/10 bg-slate-950/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.05),inset_0_0_34px_rgba(34,211,238,.04)]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ranking} layout="vertical" margin={{ top: 5, right: 32, left: 8, bottom: 5 }}>
                <CartesianGrid stroke="rgba(165,243,252,.07)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "rgba(207,250,254,.48)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={190} tick={{ fill: "rgba(207,250,254,.62)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => [Number(value).toLocaleString(), "Cumulative total"]} contentStyle={{ background: "rgba(5, 18, 38, .88)", border: "1px solid rgba(165,243,252,.30)", borderRadius: 16, color: "#ecfeff", boxShadow: "0 18px 52px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.10), inset 0 0 24px rgba(34,211,238,.08)", backdropFilter: "blur(18px) saturate(1.35)", WebkitBackdropFilter: "blur(18px) saturate(1.35)" }} itemStyle={{ color: "#ecfeff", fontWeight: 700 }} labelStyle={{ color: "rgba(207,250,254,.72)", fontWeight: 700, marginBottom: 4 }} wrapperStyle={{ outline: "none", zIndex: 40 }} />
                <Bar dataKey="total" fill="#67e8f9" radius={[0, 9, 9, 0]} style={{ filter: "drop-shadow(0 0 8px rgba(103,232,249,.62))" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard variant="glass" className="p-5 md:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-fuchsia-100/45">Visible category mix</p>
          <h2 className="mt-2 text-xl font-black text-white">{selected?.canonicalName ?? `Selected ${config.label.toLowerCase()}`}</h2>
          <p className="mt-1 text-xs leading-5 text-cyan-100/48">The ring contains only categories that were disclosed in the cumulative workbook.</p>
          <div className="relative mt-4 h-[270px] rounded-[22px] border border-cyan-100/10 bg-slate-950/20 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.05),inset_0_0_34px_rgba(167,139,250,.05)]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={visibleCategories} dataKey="value" nameKey="label" innerRadius={78} outerRadius={112} paddingAngle={3} stroke="rgba(255,255,255,.10)" strokeWidth={1}>
                  {visibleCategories.map((category) => (
                    <Cell key={category.key} fill={category.color} style={{ filter: `drop-shadow(0 0 8px ${category.color}88)` }} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-3xl font-black text-white">{visibleCategoryTotal.toLocaleString()}</p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-100/42">Visible categories</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {categories.map((category) => (
              <div key={category.key} className="flex items-center justify-between gap-3 rounded-2xl border border-cyan-100/10 bg-black/18 px-3 py-3">
                <span className="flex min-w-0 items-center gap-2 text-xs text-cyan-50/72">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: category.color, boxShadow: `0 0 12px ${category.color}` }} />
                  <span className="truncate">{category.label}</span>
                </span>
                <span className="text-right font-bold text-white">{formatNumber(category.value)}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_.85fr]">
        <GlassCard variant="glass" className="overflow-hidden p-0">
          <div className="border-b border-cyan-100/10 p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/42">Selected cumulative row</p>
            <h2 className="mt-2 text-xl font-black text-white">Category detail</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-cyan-300/[0.045] text-[9px] uppercase tracking-[0.18em] text-cyan-100/45">
                <tr>
                  <th className="px-5 py-3">Reported name</th>
                  <th className="px-4 py-3">Total</th>
                  {CATEGORY_CONFIG.map((category) => <th key={category.key} className="px-4 py-3">{category.shortLabel}</th>)}
                </tr>
              </thead>
              <tbody>
                {(selected?.records ?? []).map((record) => (
                  <tr key={record.id} className="border-t border-cyan-100/[0.07] text-cyan-50/68">
                    <td className="px-5 py-4 font-semibold text-white">{record.sourceName}</td>
                    <td className="px-4 py-4 font-bold text-cyan-100">{formatNumber(record.total)}</td>
                    {CATEGORY_CONFIG.map((category) => <td key={category.key} className="px-4 py-4">{formatNumber(record[category.key])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        <GlassCard variant="glass" className="border-amber-200/14 p-5 md:p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-100/45">Cumulative source boundary</p>
              <h2 className="mt-2 text-lg font-black text-amber-50">Not an annual trend</h2>
              <p className="mt-3 text-sm leading-7 text-amber-100/65">
                This workbook combines the full {period.startYear}–{period.endYear} period. It cannot show when within that period a case was recorded. It also cannot connect a selected employer to a particular country or carrier.
              </p>
              <div className="mt-5 space-y-2 rounded-2xl border border-amber-200/12 bg-black/16 p-4 text-xs leading-6 text-amber-100/62">
                <p><strong className="text-amber-50">Source:</strong> {source?.sourceFile ?? "Cumulative workbook unavailable"}</p>
                <p><strong className="text-amber-50">Named rows:</strong> {source?.sourceRows.toLocaleString() ?? "0"}</p>
                <p><strong className="text-amber-50">Blank or suppressed rows:</strong> {source?.suppressedOrBlankRows.toLocaleString() ?? "0"}</p>
              </div>
            </div>
          </div>
        </GlassCard>
      </section>
    </>
  );
}
