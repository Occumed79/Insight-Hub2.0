import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Building2,
  FileSpreadsheet,
  Globe2,
  Layers3,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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

const CATEGORY_CONFIG: Array<{ key: keyof DbaHubCounts; label: string; color: string }> = [
  { key: "nlt", label: "NLT", color: "#67e8f9" },
  { key: "lto3", label: "LTO3", color: "#a78bfa" },
  { key: "lto4", label: "LTO4", color: "#f472b6" },
  { key: "dea", label: "DEA", color: "#fb7185" },
  { key: "cop", label: "COP", color: "#34d399" },
  { key: "oth", label: "OTH", color: "#fbbf24" },
];

const TAB_LABELS = {
  employer: "Employer Data",
  country: "Country Trends",
  carrier: "Carrier Trends",
  cumulative: "2001–2024 Cumulative",
  notes: "Data Notes",
} as const;

type WorkspaceTab = keyof typeof TAB_LABELS;
type YearPoint = DbaHubCounts & { fiscalYear: number; suppressed: boolean; sourceRows: number };

function sumNullable(records: DbaHubRecord[], key: keyof DbaHubCounts): number | null {
  const values = records.map((record) => record[key]).filter((value): value is number => typeof value === "number");
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

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-2xl border border-cyan-100/10 bg-white/[0.025] p-4"><p className="text-[9px] font-black uppercase tracking-[.16em] text-cyan-100/36">{label}</p><p className="mt-2 text-2xl font-black text-white">{value}</p><p className="mt-1 text-[10px] text-cyan-50/38">{note}</p></div>;
}

function TrendWorkspace({ records, years, title }: { records: DbaHubRecord[]; years: number[]; title: string }) {
  const points = useMemo(() => buildYearPoints(records, years), [records, years]);
  const reported = points.filter((point) => typeof point.total === "number");
  const latest = reported.at(-1)?.total ?? null;
  const peak = reported.length ? [...reported].sort((a, b) => (b.total ?? 0) - (a.total ?? 0))[0] : null;
  const visibleCategories = CATEGORY_CONFIG.reduce((sum, category) => sum + points.reduce((subtotal, point) => subtotal + (typeof point[category.key] === "number" ? Number(point[category.key]) : 0), 0), 0);

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label="Latest reported total" value={latest === null ? "Not reported" : latest.toLocaleString()} note={reported.length ? `FY${reported.at(-1)?.fiscalYear}` : "No visible annual total"} />
      <Metric label="Peak annual total" value={peak?.total === null || peak?.total === undefined ? "Not reported" : peak.total.toLocaleString()} note={peak ? `FY${peak.fiscalYear}` : "No visible annual total"} />
      <Metric label="Visible category values" value={visibleCategories.toLocaleString()} note="Suppressed cells stay absent" />
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <GlassCard variant="glass" className="p-5">
        <p className="text-[9px] font-black uppercase tracking-[.16em] text-cyan-100/38">Annual movement</p>
        <h2 className="mt-1 text-lg font-black text-white">{title} · reported total</h2>
        <div className="mt-4 h-[300px] rounded-2xl border border-white/7 bg-black/20 p-3">
          <ResponsiveContainer width="100%" height="100%"><LineChart data={points}><CartesianGrid stroke="rgba(165,243,252,.08)" vertical={false} /><XAxis dataKey="fiscalYear" tickFormatter={(value) => `FY${String(value).slice(-2)}`} tick={{ fill: "rgba(207,250,254,.55)", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "rgba(207,250,254,.45)", fontSize: 10 }} axisLine={false} tickLine={false} width={52} /><Tooltip contentStyle={{ background: "rgba(4,16,29,.96)", border: "1px solid rgba(165,243,252,.20)", borderRadius: 12 }} /><Line type="monotone" dataKey="total" stroke="#67e8f9" strokeWidth={3} connectNulls dot={{ r: 4 }} /></LineChart></ResponsiveContainer>
        </div>
      </GlassCard>

      <GlassCard variant="glass" className="p-5">
        <p className="text-[9px] font-black uppercase tracking-[.16em] text-violet-100/38">Category composition</p>
        <h2 className="mt-1 text-lg font-black text-white">Visible annual categories</h2>
        <div className="mt-4 h-[300px] rounded-2xl border border-white/7 bg-black/20 p-3">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={points}><CartesianGrid stroke="rgba(165,243,252,.08)" vertical={false} /><XAxis dataKey="fiscalYear" tickFormatter={(value) => `FY${String(value).slice(-2)}`} tick={{ fill: "rgba(207,250,254,.55)", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "rgba(207,250,254,.45)", fontSize: 10 }} axisLine={false} tickLine={false} width={52} /><Tooltip contentStyle={{ background: "rgba(4,16,29,.96)", border: "1px solid rgba(165,243,252,.20)", borderRadius: 12 }} /><Legend wrapperStyle={{ fontSize: 10 }} />{CATEGORY_CONFIG.map((category) => <Bar key={category.key} dataKey={category.key} name={category.label} stackId="category" fill={category.color} />)}</BarChart></ResponsiveContainer>
        </div>
      </GlassCard>
    </div>
  </div>;
}

function EmployerWorkspace({ data }: { data: DbaHubResponse }) {
  const [selectedName, setSelectedName] = useState(data.employers[0]?.canonicalName ?? "");
  useEffect(() => { if (!selectedName && data.employers[0]) setSelectedName(data.employers[0].canonicalName); }, [data.employers, selectedName]);
  const records = data.records.filter((record) => record.dimension === "employer" && record.canonicalName === selectedName);
  return <div className="space-y-4"><GlassCard variant="glass" className="p-4"><label className="block text-[9px] font-black uppercase tracking-[.16em] text-cyan-100/38">Employer<select value={selectedName} onChange={(event) => setSelectedName(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#06111f] px-3 text-sm font-bold text-white outline-none">{data.employers.map((employer) => <option key={employer.canonicalName} value={employer.canonicalName}>{employer.canonicalName}</option>)}</select></label></GlassCard><TrendWorkspace records={records} years={data.years} title={selectedName || "Employer"} /></div>;
}

function EntityWorkspace({ data, dimension }: { data: DbaHubResponse; dimension: Extract<DbaHubDimension, "country" | "carrier"> }) {
  const names = useMemo(() => [...new Set(data.records.filter((record) => record.dimension === dimension).map((record) => record.canonicalName).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [data.records, dimension]);
  const [selectedName, setSelectedName] = useState(names[0] ?? "");
  useEffect(() => { if (!names.includes(selectedName)) setSelectedName(names[0] ?? ""); }, [names, selectedName]);
  const listId = `dba-${dimension}-options`;
  const records = data.records.filter((record) => record.dimension === dimension && record.canonicalName === selectedName);
  return <div className="space-y-4"><GlassCard variant="glass" className="p-4"><label className="block text-[9px] font-black uppercase tracking-[.16em] text-cyan-100/38">Search {dimension}<input list={listId} value={selectedName} onChange={(event) => setSelectedName(event.target.value)} placeholder={`Type to find a ${dimension}…`} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#06111f] px-3 text-sm font-bold text-white outline-none placeholder:text-cyan-50/28" /><datalist id={listId}>{names.map((name) => <option key={name} value={name} />)}</datalist></label><p className="mt-2 text-[10px] text-cyan-50/34">{names.length.toLocaleString()} {dimension} values available. Type any part of the name instead of scrolling a giant dropdown.</p></GlassCard>{names.includes(selectedName) ? <TrendWorkspace records={records} years={data.years} title={selectedName} /> : <GlassCard variant="glass" className="p-8 text-center text-sm text-cyan-50/45">Choose a matching {dimension} from the searchable suggestions.</GlassCard>}</div>;
}

function DataNotes({ data }: { data: DbaHubResponse }) {
  return <div className="grid gap-4 xl:grid-cols-2"><GlassCard variant="glass" className="p-5"><p className="text-[9px] font-black uppercase tracking-[.16em] text-cyan-100/38">Source model</p><h2 className="mt-1 text-lg font-black">How this data is structured</h2><p className="mt-3 text-xs leading-6 text-cyan-50/52">{data.sourceModel}</p><p className="mt-3 text-xs leading-6 text-cyan-50/44">Administrative DBA counts can include suppressed or blank values. The hub preserves missing values rather than converting them to zero.</p></GlassCard><GlassCard variant="glass" className="p-5"><p className="text-[9px] font-black uppercase tracking-[.16em] text-violet-100/38">Imported sources</p><h2 className="mt-1 text-lg font-black">Annual workbooks</h2><div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">{data.sources.map((source) => <div key={`${source.sourceFile}-${source.dimension}-${source.fiscalYear}`} className="rounded-xl border border-white/7 bg-white/[0.02] p-3"><p className="text-xs font-bold text-white">{source.sourceFile}</p><p className="mt-1 text-[10px] text-cyan-50/38">{source.dimension} · FY{source.fiscalYear} · {source.analyticRows.toLocaleString()} analytic rows</p></div>)}</div></GlassCard></div>;
}

export default function DbaIntelligencePage() {
  const [data, setData] = useState<DbaHubResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<WorkspaceTab>("employer");

  async function load() {
    setLoading(true); setError("");
    try { setData(await loadDbaHub()); }
    catch (err) { setError(err instanceof Error ? err.message : "DBA Data Hub unavailable"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const icons = { employer: Building2, country: Globe2, carrier: Layers3, cumulative: BarChart3, notes: FileSpreadsheet };

  return <main className="aurora-bg min-h-screen pb-24 text-white"><Sidebar /><section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12"><HeaderBar eyebrow="Employer-Level Defense Base Act Analytics" title="DBA Data Hub" subtitle="FY2021–FY2024 annual trends plus the separate 2001–2024 cumulative employer, country, and carrier layer persisted in Neon." />
    <div className="mb-6 flex flex-wrap gap-2 rounded-[22px] border border-cyan-100/10 bg-black/20 p-2 backdrop-blur-xl">{(Object.keys(TAB_LABELS) as WorkspaceTab[]).map((item) => { const Icon = icons[item]; return <button key={item} type="button" onClick={() => setTab(item)} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold transition ${tab === item ? "border-cyan-200/28 bg-cyan-300/14 text-white" : "border-transparent text-cyan-100/48 hover:border-cyan-100/12 hover:bg-white/[0.04] hover:text-cyan-50"}`}><Icon size={16} />{TAB_LABELS[item]}</button>; })}<button type="button" onClick={() => void load()} disabled={loading} className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-100/12 bg-black/18 px-4 text-xs font-bold text-cyan-100/58 hover:text-white disabled:opacity-45"><RefreshCw size={14} className={loading ? "animate-spin" : ""} />Refresh Neon data</button></div>
    {loading && !data ? <GlassCard variant="glass" className="flex min-h-[320px] items-center justify-center p-8"><div className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-200" /><p className="mt-4 text-sm text-cyan-100/55">Loading DBA data from Neon…</p></div></GlassCard> : null}
    {error && !data ? <GlassCard variant="glass" className="border-rose-200/18 p-6"><h2 className="font-bold text-rose-100">DBA Data Hub unavailable</h2><p className="mt-2 text-sm text-rose-100/65">{error}</p></GlassCard> : null}
    {data && tab === "employer" ? <EmployerWorkspace data={data} /> : null}
    {data && tab === "country" ? <EntityWorkspace data={data} dimension="country" /> : null}
    {data && tab === "carrier" ? <EntityWorkspace data={data} dimension="carrier" /> : null}
    {data && tab === "cumulative" ? <DbaCumulativeWorkspace data={data} /> : null}
    {data && tab === "notes" ? <DataNotes data={data} /> : null}
  </section></main>;
}
