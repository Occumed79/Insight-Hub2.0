import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  Building2,
  Database,
  FileSearch,
  Globe2,
  Landmark,
  Layers3,
  Loader2,
  MapPinned,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassCard } from "@/components/insight/GlassCard";
import {
  EvidenceGradeBadge,
  MetricOrb,
  OccupationalToolShell,
  SectionTabs,
  ToolHero,
} from "@/components/insight/OccupationalToolPrimitives";
import type { BlsBenchmark, OshaEstablishment } from "@/data/employerIntelligenceApi";

type ExplorerTab = "library" | "bls" | "osha" | "datagov";

type Manifest = {
  businessQuestions: Array<{ id: string; title: string; description: string; source: string; serviceId?: string }>;
  blsSectors: Array<{ id: string; naics: string; label: string; description: string }>;
  dataGovCollections: Array<{ id: string; label: string; query: string; why: string; analyses: string[] }>;
  sources: Array<{
    id: string;
    source: string;
    status: string;
    officialUrl: string;
    dataFamilies: Array<{ name: string; coverage: string; status: string }>;
  }>;
};

type BlsOverview = {
  sectors: Array<{ id: string; naics: string; label: string; description: string; benchmark: BlsBenchmark | null; message?: string }>;
  ranked: Array<{ id: string; naics: string; label: string; benchmark: BlsBenchmark | null }>;
  limitation?: string;
};

type OshaOverview = {
  configured: boolean;
  imported: boolean;
  latestYear?: number;
  importInfo?: { totalRecords: number; importRuns: Array<{ datasetName: string; datasetYear: number; importedAt: string; recordCount: number }> };
  trend?: Array<Record<string, number>>;
  topEmployers?: Array<Record<string, string | number | null>>;
  topStates?: Array<Record<string, string | number | null>>;
  topIndustries?: Array<Record<string, string | number | null>>;
  highRateEstablishments?: Array<Record<string, string | number | null>>;
  limitation?: string;
  warning?: string;
};

type DataGovDataset = {
  id: string;
  title: string;
  description: string;
  agency: string;
  updatedAt: string;
  apiReady: boolean;
  catalogUrl: string;
  resources: Array<{ name: string; format: string; url: string; apiReady: boolean }>;
};

type DataGovOverview = {
  collections: Array<{
    id: string;
    label: string;
    why: string;
    analyses: string[];
    count: number | null;
    datasets: DataGovDataset[];
    error?: string;
  }>;
};

const tabs: Array<{ id: ExplorerTab; label: string; icon: typeof Database }> = [
  { id: "library", label: "Occu-Med Data Library", icon: Sparkles },
  { id: "bls", label: "BLS Industry Intelligence", icon: BarChart3 },
  { id: "osha", label: "OSHA Injury Intelligence", icon: ShieldAlert },
  { id: "datagov", label: "Public Data Collections", icon: Globe2 },
];

function fmt(value: unknown, digits = 1): string {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString(undefined, { maximumFractionDigits: digits })
    : "—";
}

function statusLabel(value: string): string {
  return value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-200/80 transition hover:text-white">
      {children}<ArrowUpRight size={13} />
    </a>
  );
}

function LoadingCard({ text }: { text: string }) {
  return <GlassCard className="p-8 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-cyan-200/70" /><p className="mt-3 text-sm font-bold text-white">{text}</p></GlassCard>;
}

function DataLibrary({ manifest, onOpen }: { manifest: Manifest; onOpen: (source: ExplorerTab) => void }) {
  const sourceMap: Record<string, ExplorerTab> = { osha: "osha", bls: "bls", datagov: "datagov" };
  return (
    <div className="space-y-5">
      <GlassCard className="p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-50/55">Start with the business question</p>
        <h2 className="mt-1 text-xl font-black text-white">Useful intelligence is already organized for you.</h2>
        <p className="mt-2 max-w-4xl text-xs leading-6 text-cyan-50/62">You do not need to know an API name, a BLS series ID, a NAICS code, an OSHA dataset name, or the right Data.gov keyword. Pick what you are trying to learn and the workspace opens the prepared source view.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {manifest.businessQuestions.map((question) => (
            <button key={question.id} type="button" onClick={() => onOpen(sourceMap[question.source] ?? "library")} className="group rounded-2xl border border-cyan-100/12 bg-[#071321]/76 p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-200/25 hover:bg-cyan-300/[0.055]">
              <p className="text-sm font-black leading-5 text-white">{question.title}</p>
              <p className="mt-2 text-[11px] leading-5 text-cyan-50/56">{question.description}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-200/68">Open prepared view <ArrowUpRight size={12} /></span>
            </button>
          ))}
        </div>
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-2">
        {manifest.sources.map((source) => (
          <GlassCard key={source.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-50/50">Data inventory</p>
                <h3 className="mt-1 text-lg font-black text-white">{source.source}</h3>
              </div>
              <span className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-cyan-50/65">{statusLabel(source.status)}</span>
            </div>
            <div className="mt-4 space-y-2">
              {source.dataFamilies.map((family) => (
                <div key={`${source.id}-${family.name}`} className="rounded-xl border border-white/9 bg-black/15 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-xs font-bold text-white">{family.name}</p>
                    <span className="text-[9px] text-cyan-50/42">{family.coverage}</span>
                  </div>
                  <p className="mt-1 text-[10px] leading-5 text-cyan-50/54">{family.status}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-4">
              {sourceMap[source.id] ? <button type="button" onClick={() => onOpen(sourceMap[source.id])} className="text-xs font-black text-cyan-200/82 hover:text-white">Open workspace</button> : null}
              <ExternalLink href={source.officialUrl}>Official source</ExternalLink>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

function BlsWorkspace({ overview, manifest }: { overview: BlsOverview | null; manifest: Manifest }) {
  const [naics, setNaics] = useState("");
  const [year, setYear] = useState("");
  const [loading, setLoading] = useState(false);
  const [benchmark, setBenchmark] = useState<BlsBenchmark | null>(null);
  const [message, setMessage] = useState("");

  async function lookup(code?: string) {
    const query = (code ?? naics).trim();
    if (!query) return;
    setNaics(query);
    setLoading(true);
    setMessage("");
    setBenchmark(null);
    try {
      const params = new URLSearchParams({ naics: query });
      if (year) params.set("year", year);
      const response = await fetch(`/api/bls/industry-benchmark?${params}`);
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "BLS lookup failed.");
      setBenchmark(payload.benchmark ?? null);
      setMessage(payload.message || payload.limitation || "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "BLS lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  if (!overview) return <LoadingCard text="Loading live BLS priority-sector intelligence" />;
  const available = overview.sectors.filter((sector) => sector.benchmark);
  const chart = overview.ranked.slice(0, 8).map((sector) => ({ name: sector.label, trc: sector.benchmark?.trcRate ?? 0, dart: sector.benchmark?.dartRate ?? 0 }));

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricOrb label="Priority sectors loaded" value={`${available.length}/${manifest.blsSectors.length}`} note="Live BLS SOII benchmarks" icon={Database} />
        <MetricOrb label="Highest returned TRC" value={overview.ranked[0]?.benchmark?.trcRate != null ? fmt(overview.ranked[0].benchmark?.trcRate) : "—"} note={overview.ranked[0]?.label || "No returned sector"} icon={BarChart3} tone="rose" />
        <MetricOrb label="Current source" value="BLS SOII" note="Industry aggregate incidence rates" icon={BookOpenCheck} tone="emerald" />
        <MetricOrb label="Search required" value="No" note="Prepared sector intelligence loads first" icon={Search} tone="violet" />
      </section>

      <div className="grid gap-5 2xl:grid-cols-[1.08fr_.92fr]">
        <GlassCard className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/55">Priority industry library</p>
          <h2 className="mt-1 text-xl font-black text-white">Click an industry. The source codes stay behind the scenes.</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {overview.sectors.map((sector) => (
              <button key={sector.id} type="button" onClick={() => void lookup(sector.naics)} className="rounded-2xl border border-white/10 bg-[#071321]/72 p-4 text-left transition hover:border-cyan-200/24 hover:bg-cyan-300/[0.055]">
                <div className="flex items-start justify-between gap-3"><p className="text-sm font-black text-white">{sector.label}</p><span className="text-[9px] text-cyan-50/40">NAICS {sector.naics}</span></div>
                <p className="mt-2 text-[10px] leading-5 text-cyan-50/50">{sector.description}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-black/20 p-2"><p className="text-sm font-black text-white">{fmt(sector.benchmark?.trcRate)}</p><p className="text-[8px] text-cyan-50/42">TRC</p></div>
                  <div className="rounded-lg bg-black/20 p-2"><p className="text-sm font-black text-white">{fmt(sector.benchmark?.dartRate)}</p><p className="text-[8px] text-cyan-50/42">DART</p></div>
                  <div className="rounded-lg bg-black/20 p-2"><p className="text-sm font-black text-white">{fmt(sector.benchmark?.daysAwayRate)}</p><p className="text-[8px] text-cyan-50/42">Away</p></div>
                </div>
              </button>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/55">Prepared comparison</p>
          <h2 className="mt-1 text-xl font-black text-white">Priority sectors ranked by returned TRC rate</h2>
          <div className="mt-4 h-[390px]">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={chart} layout="vertical" margin={{ left: 10 }}><CartesianGrid stroke="rgba(165,243,252,.09)" horizontal={false} /><XAxis type="number" tick={{ fill: "rgba(207,250,254,.5)", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" width={132} tick={{ fill: "rgba(207,250,254,.68)", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "#06101d", border: "1px solid rgba(103,232,249,.2)", borderRadius: 12 }} /><Bar dataKey="trc" name="TRC" fill="#67e8f9" radius={[0, 7, 7, 0]} /><Bar dataKey="dart" name="DART" fill="#c4b5fd" radius={[0, 7, 7, 0]} /></BarChart></ResponsiveContainer>
          </div>
          <p className="text-[10px] leading-5 text-cyan-50/46">{overview.limitation}</p>
        </GlassCard>
      </div>

      {benchmark ? (
        <GlassCard className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/55">Selected benchmark</p><h2 className="mt-1 text-xl font-black text-white">{benchmark.industryTitle}</h2></div><EvidenceGradeBadge grade="A" /></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricOrb label="TRC rate" value={fmt(benchmark.trcRate)} note="Cases per 100 FTE" icon={BarChart3} /><MetricOrb label="DART rate" value={fmt(benchmark.dartRate)} note="Cases per 100 FTE" icon={Layers3} tone="violet" /><MetricOrb label="Days-away rate" value={fmt(benchmark.daysAwayRate)} note="Cases per 100 FTE" icon={BookOpenCheck} tone="rose" /><MetricOrb label="Data year" value={String(benchmark.year)} note={benchmark.authMode} icon={Database} tone="emerald" /></div>
        </GlassCard>
      ) : null}

      <GlassCard className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/50">Advanced lookup</p><h3 className="mt-1 text-lg font-black text-white">Need a specific industry? Search is here, not the front door.</h3></div><Search size={18} className="text-cyan-200/55" /></div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_.45fr_auto] md:items-end"><label><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-50/55">NAICS code</span><input value={naics} onChange={(event) => setNaics(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))} placeholder="2–6 digits" className="mt-2 min-h-11 w-full rounded-xl border border-white/12 bg-[#040c16]/92 px-3 text-sm text-white outline-none" /></label><label><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-50/55">Year optional</span><input value={year} onChange={(event) => setYear(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))} placeholder="Latest" className="mt-2 min-h-11 w-full rounded-xl border border-white/12 bg-[#040c16]/92 px-3 text-sm text-white outline-none" /></label><button type="button" disabled={loading || !naics} onClick={() => void lookup()} className="min-h-11 rounded-xl border border-cyan-200/22 bg-cyan-300/12 px-5 text-sm font-black text-white disabled:opacity-45">{loading ? "Loading…" : "Lookup"}</button></div>
        {message && !benchmark ? <p className="mt-3 text-xs leading-5 text-amber-50/70">{message}</p> : null}
      </GlassCard>
    </div>
  );
}

function OshaWorkspace({ overview }: { overview: OshaOverview | null }) {
  const [company, setCompany] = useState("");
  const [state, setState] = useState("");
  const [naics, setNaics] = useState("");
  const [year, setYear] = useState("");
  const [records, setRecords] = useState<OshaEstablishment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function searchRecords() {
    setLoading(true); setError(""); setRecords([]);
    try {
      const params = new URLSearchParams();
      if (company) params.set("company", company); if (state) params.set("state", state); if (naics) params.set("naics", naics); if (year) params.set("year", year);
      const response = await fetch(`/api/osha/establishments?${params}`);
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "OSHA query failed.");
      setRecords(payload.records ?? []);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "OSHA query failed."); }
    finally { setLoading(false); }
  }

  if (!overview) return <LoadingCard text="Loading OSHA injury intelligence from imported ITA data" />;
  if (!overview.imported) return <GlassCard className="p-8 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-rose-200/60" /><p className="mt-3 text-lg font-black text-white">OSHA source is indexed, but summary data is not currently query-ready.</p><p className="mx-auto mt-2 max-w-3xl text-xs leading-6 text-cyan-50/58">{overview.warning || "No OSHA ITA rows are imported into the application database."}</p></GlassCard>;

  const latestTrend = overview.trend?.[overview.trend.length - 1];
  const trend = overview.trend ?? [];
  const stateChart = (overview.topStates ?? []).slice(0, 10).map((row) => ({ name: String(row.name), cases: Number(row.total_cases ?? 0), trc: Number(row.trc_rate ?? 0) }));

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricOrb label="Imported ITA rows" value={fmt(overview.importInfo?.totalRecords, 0)} note="Persistent source rows" icon={Database} /><MetricOrb label="Latest data year" value={String(overview.latestYear ?? "—")} note="Latest year in imported summary rows" icon={BookOpenCheck} tone="emerald" /><MetricOrb label="Reported cases" value={fmt(latestTrend?.total_cases, 0)} note="Latest-year aggregate in imported rows" icon={ShieldAlert} tone="rose" /><MetricOrb label="Aggregate TRC" value={fmt(latestTrend?.trc_rate, 2)} note="Computed from returned hours and cases" icon={BarChart3} tone="violet" /></section>

      <div className="grid gap-5 2xl:grid-cols-[1.15fr_.85fr]">
        <GlassCard className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-rose-50/55">Prepared employer intelligence</p><h2 className="mt-1 text-xl font-black text-white">Largest reported injury burden — latest imported year</h2>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="text-[9px] uppercase tracking-[0.14em] text-cyan-50/50"><tr><th className="pb-3">Employer</th><th className="pb-3">Establishments</th><th className="pb-3">Cases</th><th className="pb-3">DART</th><th className="pb-3">TRC</th></tr></thead><tbody>{(overview.topEmployers ?? []).slice(0, 15).map((row) => <tr key={String(row.name)} className="border-t border-white/8"><td className="py-3 pr-4 font-bold text-white">{String(row.name)}</td><td className="py-3 pr-4 text-cyan-50/65">{fmt(row.establishments, 0)}</td><td className="py-3 pr-4 text-white">{fmt(row.total_cases, 0)}</td><td className="py-3 pr-4 text-cyan-50/65">{fmt(row.dart_cases, 0)}</td><td className="py-3 text-cyan-100">{fmt(row.trc_rate, 2)}</td></tr>)}</tbody></table></div>
        </GlassCard>
        <GlassCard className="p-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/55">Prepared state view</p><h2 className="mt-1 text-xl font-black text-white">Reported cases by state</h2><div className="mt-4 h-[400px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={stateChart} layout="vertical"><CartesianGrid stroke="rgba(165,243,252,.08)" horizontal={false} /><XAxis type="number" tick={{ fill: "rgba(207,250,254,.5)", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" width={42} tick={{ fill: "rgba(207,250,254,.68)", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "#06101d", border: "1px solid rgba(251,113,133,.2)", borderRadius: 12 }} /><Bar dataKey="cases" fill="#fda4af" radius={[0, 7, 7, 0]} /></BarChart></ResponsiveContainer></div></GlassCard>
      </div>

      <div className="grid gap-5 2xl:grid-cols-[1fr_1fr]">
        <GlassCard className="p-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/55">Multi-year imported trend</p><h2 className="mt-1 text-xl font-black text-white">Cases and aggregate rates over time</h2><div className="mt-4 h-[340px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid stroke="rgba(165,243,252,.08)" /><XAxis dataKey="year" tick={{ fill: "rgba(207,250,254,.55)", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis yAxisId="cases" tick={{ fill: "rgba(207,250,254,.5)", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis yAxisId="rate" orientation="right" tick={{ fill: "rgba(207,250,254,.5)", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "#06101d", border: "1px solid rgba(103,232,249,.2)", borderRadius: 12 }} /><Line yAxisId="cases" dataKey="total_cases" name="Cases" stroke="#67e8f9" strokeWidth={2.5} dot={false} /><Line yAxisId="rate" dataKey="trc_rate" name="TRC" stroke="#c4b5fd" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></div></GlassCard>
        <GlassCard className="p-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/55">Highest returned establishment rates</p><h2 className="mt-1 text-xl font-black text-white">Prepared outlier review list</h2><div className="mt-4 max-h-[340px] space-y-2 overflow-auto pr-1">{(overview.highRateEstablishments ?? []).slice(0, 20).map((row, index) => <div key={`${row.name}-${index}`} className="rounded-xl border border-white/9 bg-black/15 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-white">{String(row.name)}</p><p className="mt-1 text-[10px] text-cyan-50/48">{String(row.company_name || "")} · {[row.city, row.state].filter(Boolean).join(", ")} · NAICS {String(row.naics || "—")}</p></div><span className="text-sm font-black text-rose-100">{fmt(row.trc_rate, 2)}</span></div></div>)}</div></GlassCard>
      </div>

      <GlassCard className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/50">Advanced establishment lookup</p><h3 className="mt-1 text-lg font-black text-white">Search only when you already know the employer or filter you need.</h3></div><FileSearch size={18} className="text-cyan-200/55" /></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_.35fr_.42fr_.42fr_auto] xl:items-end"><input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Employer / establishment" className="min-h-11 rounded-xl border border-white/12 bg-[#040c16]/92 px-3 text-sm text-white outline-none" /><input value={state} onChange={(event) => setState(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))} placeholder="State" className="min-h-11 rounded-xl border border-white/12 bg-[#040c16]/92 px-3 text-sm text-white outline-none" /><input value={naics} onChange={(event) => setNaics(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))} placeholder="NAICS" className="min-h-11 rounded-xl border border-white/12 bg-[#040c16]/92 px-3 text-sm text-white outline-none" /><input value={year} onChange={(event) => setYear(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))} placeholder="Year" className="min-h-11 rounded-xl border border-white/12 bg-[#040c16]/92 px-3 text-sm text-white outline-none" /><button type="button" onClick={() => void searchRecords()} disabled={loading} className="min-h-11 rounded-xl border border-rose-200/22 bg-rose-300/10 px-4 text-xs font-black text-white disabled:opacity-45">{loading ? "Querying…" : "Query records"}</button></div>{error ? <p className="mt-3 text-xs text-rose-100/80">{error}</p> : null}{records.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="text-[9px] uppercase tracking-[0.14em] text-cyan-50/50"><tr><th className="pb-3">Establishment</th><th className="pb-3">Location</th><th className="pb-3">Year</th><th className="pb-3">Cases</th><th className="pb-3">DART</th><th className="pb-3">TRC</th></tr></thead><tbody>{records.slice(0, 100).map((record, index) => <tr key={`${record.establishmentName}-${index}`} className="border-t border-white/8"><td className="py-3 pr-3 font-bold text-white">{record.establishmentName}</td><td className="py-3 pr-3">{[record.city, record.state].filter(Boolean).join(", ")}</td><td className="py-3 pr-3">{record.year}</td><td className="py-3 pr-3">{fmt(record.totalCases, 0)}</td><td className="py-3 pr-3">{fmt(record.dartCases, 0)}</td><td className="py-3">{fmt(record.trcRate, 2)}</td></tr>)}</tbody></table></div> : null}<p className="mt-4 text-[10px] leading-5 text-amber-50/60">{overview.limitation}</p></GlassCard>
    </div>
  );
}

function DataGovWorkspace({ overview }: { overview: DataGovOverview | null }) {
  const [activeId, setActiveId] = useState("");
  const [datasets, setDatasets] = useState<DataGovDataset[]>([]);
  const [loading, setLoading] = useState(false);
  const [custom, setCustom] = useState("");
  const [customResults, setCustomResults] = useState<DataGovDataset[]>([]);

  async function openCollection(id: string) {
    setActiveId(id); setLoading(true); setDatasets([]);
    try { const response = await fetch(`/api/occupational-discovery/datagov-collection/${encodeURIComponent(id)}?rows=24`); const payload = await response.json(); if (payload.ok) setDatasets(payload.datasets ?? []); }
    finally { setLoading(false); }
  }

  async function customSearch() {
    if (!custom.trim()) return;
    setLoading(true); setCustomResults([]);
    try { const response = await fetch(`/api/occupational-data/datagov?query=${encodeURIComponent(custom.trim())}&rows=24`); const payload = await response.json(); if (payload.ok) setCustomResults(payload.datasets ?? []); }
    finally { setLoading(false); }
  }

  if (!overview) return <LoadingCard text="Loading curated public-data collections and live Data.gov previews" />;
  const active = overview.collections.find((collection) => collection.id === activeId);
  const shown = activeId ? datasets : [];

  return (
    <div className="space-y-5">
      <GlassCard className="p-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-50/55">Curated Occu-Med public-data collections</p><h2 className="mt-1 text-xl font-black text-white">The useful searches are already done for you.</h2><p className="mt-2 max-w-4xl text-xs leading-6 text-cyan-50/60">Every card is a prepared government-data question with a live Data.gov catalog preview. Open a collection to see the datasets, publishers, available resources, and suggested analyses. Free-text search is kept below for edge cases.</p><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{overview.collections.map((collection) => <button key={collection.id} type="button" onClick={() => void openCollection(collection.id)} className={`rounded-2xl border p-4 text-left transition ${activeId === collection.id ? "border-violet-200/28 bg-violet-300/[0.08]" : "border-white/10 bg-[#071321]/72 hover:border-violet-200/20"}`}><div className="flex items-start justify-between gap-3"><p className="text-sm font-black text-white">{collection.label}</p><span className="text-xs font-black text-violet-100">{collection.count == null ? "—" : collection.count.toLocaleString()}</span></div><p className="mt-2 text-[10px] leading-5 text-cyan-50/52">{collection.why}</p><div className="mt-3 flex flex-wrap gap-1.5">{collection.analyses.slice(0, 4).map((analysis) => <span key={analysis} className="rounded-full border border-white/9 px-2 py-1 text-[8px] text-cyan-50/46">{analysis}</span>)}</div>{collection.datasets[0] ? <p className="mt-3 line-clamp-2 text-[9px] leading-4 text-violet-50/55">Preview: {collection.datasets[0].title}</p> : null}</button>)}</div></GlassCard>

      {loading && activeId ? <LoadingCard text={`Loading ${active?.label ?? "collection"} datasets`} /> : null}
      {shown.length ? <div className="grid gap-4 xl:grid-cols-2">{shown.map((dataset) => <GlassCard key={dataset.id} className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-violet-50/52">{dataset.agency}</p><h3 className="mt-1 text-base font-black text-white">{dataset.title}</h3></div>{dataset.apiReady ? <span className="rounded-full border border-emerald-200/18 bg-emerald-300/[0.07] px-2 py-1 text-[8px] font-bold text-emerald-50">API / data resource</span> : null}</div><p className="mt-3 line-clamp-4 text-[11px] leading-5 text-cyan-50/58">{dataset.description || "No catalog description reported."}</p><div className="mt-3 space-y-1.5">{dataset.resources.slice(0, 3).map((resource) => <a key={`${dataset.id}-${resource.url}`} href={resource.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-black/15 px-3 py-2 text-[9px] text-cyan-50/58 hover:border-violet-200/20"><span className="line-clamp-1">{resource.name}</span><span className="shrink-0 text-violet-100/70">{resource.format}</span></a>)}</div><div className="mt-4"><ExternalLink href={dataset.catalogUrl}>Catalog record</ExternalLink></div></GlassCard>)}</div> : null}

      <GlassCard className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/50">Advanced catalog search</p><h3 className="mt-1 text-lg font-black text-white">Only use this when the curated collections do not cover the question.</h3></div><Search size={18} className="text-cyan-200/55" /></div><div className="mt-4 flex flex-col gap-3 md:flex-row"><input value={custom} onChange={(event) => setCustom(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void customSearch(); }} placeholder="Search a specific government-data topic…" className="min-h-11 flex-1 rounded-xl border border-white/12 bg-[#040c16]/92 px-3 text-sm text-white outline-none" /><button type="button" onClick={() => void customSearch()} disabled={loading || !custom.trim()} className="min-h-11 rounded-xl border border-cyan-200/22 bg-cyan-300/10 px-5 text-sm font-black text-white disabled:opacity-45">Search catalog</button></div>{customResults.length ? <div className="mt-4 grid gap-2 md:grid-cols-2">{customResults.slice(0, 12).map((dataset) => <a key={dataset.id} href={dataset.catalogUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-white/9 bg-black/15 p-3 hover:border-cyan-200/20"><p className="text-xs font-bold text-white">{dataset.title}</p><p className="mt-1 text-[9px] text-cyan-50/46">{dataset.agency}</p></a>)}</div> : null}</GlassCard>
    </div>
  );
}

export default function OccupationalDataExplorer() {
  const [activeTab, setActiveTab] = useState<ExplorerTab>("library");
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [bls, setBls] = useState<BlsOverview | null>(null);
  const [osha, setOsha] = useState<OshaOverview | null>(null);
  const [datagov, setDatagov] = useState<DataGovOverview | null>(null);

  useEffect(() => {
    void fetch("/api/occupational-discovery/manifest").then((response) => response.json()).then((payload) => { if (payload.ok) setManifest(payload); }).catch(() => undefined);
    void fetch("/api/occupational-discovery/bls-overview").then((response) => response.json()).then((payload) => { if (payload.ok) setBls(payload); }).catch(() => undefined);
    void fetch("/api/occupational-discovery/osha-overview").then((response) => response.json()).then((payload) => { if (payload.ok) setOsha(payload); }).catch(() => undefined);
    void fetch("/api/occupational-discovery/datagov-overview").then((response) => response.json()).then((payload) => { if (payload.ok) setDatagov(payload); }).catch(() => undefined);
  }, []);

  const readySources = useMemo(() => manifest?.sources.filter((source) => !source.status.includes("not-imported") && !source.status.includes("required")).length ?? 0, [manifest]);

  return (
    <OccupationalToolShell eyebrow="Independent Intelligence Tool · Occupational Data Library" title="Occupational Data Explorer" subtitle="Prepared occupational-health intelligence first; source-specific search only when you actually need it." notice="The source workspaces remain independent. This page is a navigation and discovery layer: it surfaces relevant data, prepared analyses, and source inventories without transferring results into another tool or client/case record.">
      <ToolHero kicker="Discovery first" title="Stop asking users to know what government databases contain." description="Insight Hub now opens with business questions, data inventories, curated industry views, OSHA rankings, and public-data collections. Search is an advanced fallback instead of the product." accent="violet"><div className="grid grid-cols-3 gap-2"><div className="rounded-xl border border-white/12 bg-black/20 p-3 text-center"><Database className="mx-auto text-cyan-200/65" size={18} /><p className="mt-2 text-lg font-black text-white">{manifest?.sources.length ?? "—"}</p><p className="text-[9px] text-cyan-50/45">Indexed sources</p></div><div className="rounded-xl border border-white/12 bg-black/20 p-3 text-center"><Sparkles className="mx-auto text-violet-200/65" size={18} /><p className="mt-2 text-lg font-black text-white">{manifest?.businessQuestions.length ?? "—"}</p><p className="text-[9px] text-cyan-50/45">Prepared questions</p></div><div className="rounded-xl border border-white/12 bg-black/20 p-3 text-center"><BookOpenCheck className="mx-auto text-emerald-200/65" size={18} /><p className="mt-2 text-lg font-black text-white">{readySources || "—"}</p><p className="text-[9px] text-cyan-50/45">Ready / live sources</p></div></div></ToolHero>
      <SectionTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
      <AnimatePresence mode="wait"><motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>{activeTab === "library" ? (manifest ? <DataLibrary manifest={manifest} onOpen={setActiveTab} /> : <LoadingCard text="Loading the Occu-Med data inventory" />) : activeTab === "bls" ? (manifest ? <BlsWorkspace overview={bls} manifest={manifest} /> : <LoadingCard text="Loading BLS intelligence" />) : activeTab === "osha" ? <OshaWorkspace overview={osha} /> : <DataGovWorkspace overview={datagov} />}</motion.div></AnimatePresence>
    </OccupationalToolShell>
  );
}
