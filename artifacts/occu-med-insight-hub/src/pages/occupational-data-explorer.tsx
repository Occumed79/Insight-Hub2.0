import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  Building2,
  CalendarDays,
  Database,
  FileSearch,
  Globe2,
  Landmark,
  Layers3,
  Loader2,
  MapPinned,
  Search,
  ShieldAlert,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import type {
  BlsBenchmark,
  OshaEstablishment,
} from "@/data/employerIntelligenceApi";

type ExplorerTab = "bls" | "osha" | "datagov";

const tabs: Array<{ id: ExplorerTab; label: string; icon: typeof BarChart3 }> = [
  { id: "bls", label: "BLS SOII Explorer", icon: BarChart3 },
  { id: "osha", label: "OSHA ITA Records", icon: ShieldAlert },
  { id: "datagov", label: "Data.gov Catalog", icon: Database },
];

const blsSectors = [
  { code: "23", label: "Construction" },
  { code: "31", label: "Manufacturing" },
  { code: "48", label: "Transportation & Warehousing" },
  { code: "62", label: "Healthcare & Social Assistance" },
  { code: "21", label: "Mining / Oil & Gas" },
  { code: "22", label: "Utilities" },
  { code: "54", label: "Professional / Scientific / Technical" },
  { code: "72", label: "Accommodation & Food" },
] as const;

const oshaSectors = [
  ...blsSectors,
  { code: "92", label: "Public Administration" },
] as const;

function formatNumber(value: number | null | undefined, digits = 1): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString(undefined, { maximumFractionDigits: digits })
    : "Not reported";
}

function formatDate(value?: string): string {
  if (!value) return "Not reported";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-200/80 transition hover:text-white"
    >
      {children}
      <ArrowUpRight size={13} />
    </a>
  );
}

function SourceEmpty({
  title,
  detail,
  icon: Icon,
}: {
  title: string;
  detail: string;
  icon: typeof Database;
}) {
  return (
    <GlassCard className="p-8 text-center">
      <Icon className="mx-auto h-8 w-8 text-cyan-200/45" />
      <p className="mt-3 font-black text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-2xl text-xs leading-6 text-cyan-50/58">
        {detail}
      </p>
    </GlassCard>
  );
}

function BlsExplorer() {
  const [naics, setNaics] = useState("");
  const [year, setYear] = useState("");
  const [searchedNaics, setSearchedNaics] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [benchmark, setBenchmark] = useState<BlsBenchmark | null>(null);

  async function run(nextNaics?: string) {
    const query = (nextNaics ?? naics).trim();
    if (!query) return;
    setNaics(query);
    setLoading(true);
    setError("");
    setMessage("");
    setBenchmark(null);
    setSearchedNaics("");
    try {
      const params = new URLSearchParams({ naics: query });
      if (year.trim()) params.set("year", year.trim());
      const response = await fetch(`/api/bls/industry-benchmark?${params}`);
      const payload = await response.json();
      if (!response.ok || !payload.ok)
        throw new Error(payload.error || "BLS request failed.");
      setBenchmark(payload.benchmark ?? null);
      setMessage(payload.message || payload.limitation || "");
      setSearchedNaics(query);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "BLS request failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  const chartData = benchmark
    ? [
        { metric: "TRC", value: benchmark.trcRate ?? null },
        { metric: "DART", value: benchmark.dartRate ?? null },
        { metric: "Days Away", value: benchmark.daysAwayRate ?? null },
      ].filter((item) => item.value !== null)
    : [];

  return (
    <div className="space-y-5">
      <GlassCard className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/58">
              Live aggregate benchmark source
            </p>
            <h2 className="mt-1 text-xl font-black text-white">BLS SOII industry rates</h2>
            <p className="mt-2 max-w-3xl text-xs leading-6 text-cyan-50/62">
              Queries current BLS SOII industry incidence-rate series. No benchmark is selected or displayed until you run a lookup.
            </p>
          </div>
          <EvidenceGradeBadge grade="A" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {blsSectors.map((sector) => (
            <button
              key={sector.code}
              type="button"
              onClick={() => void run(sector.code)}
              className={`rounded-xl border p-3 text-left transition ${searchedNaics === sector.code ? "border-cyan-200/30 bg-cyan-300/12" : "border-white/10 bg-[#071321]/70 hover:border-cyan-200/20"}`}
            >
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-cyan-50/50">NAICS {sector.code}</span>
              <span className="mt-1 block text-xs font-black text-white">{sector.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_.45fr_auto] md:items-end">
          <label>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-50/62">NAICS code</span>
            <input
              value={naics}
              onChange={(event) => setNaics(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
              placeholder="2–6 digits"
              className="mt-2 min-h-11 w-full rounded-xl border border-white/12 bg-[#040c16]/92 px-3 text-sm text-white outline-none focus:border-cyan-200/42"
            />
          </label>
          <label>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-50/62">Year optional</span>
            <input
              value={year}
              onChange={(event) => setYear(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
              placeholder="Latest"
              className="mt-2 min-h-11 w-full rounded-xl border border-white/12 bg-[#040c16]/92 px-3 text-sm text-white outline-none focus:border-cyan-200/42"
            />
          </label>
          <button
            type="button"
            onClick={() => void run()}
            disabled={loading || !naics.trim()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-200/24 bg-cyan-300/14 px-5 text-sm font-black text-white disabled:opacity-45"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Lookup
          </button>
        </div>
        <p className="mt-3 text-[10px] leading-5 text-amber-50/66">
          Public Administration is intentionally not offered as a one-click BLS benchmark because SOII government data depends on ownership; the tool will not silently substitute a single government rate.
        </p>
      </GlassCard>

      {error ? (
        <GlassCard className="border-rose-200/18 p-4 text-sm text-rose-50/80">{error}</GlassCard>
      ) : null}
      {!benchmark && message && !loading ? (
        <GlassCard className="p-5">
          <p className="font-black text-white">No benchmark returned</p>
          <p className="mt-2 text-xs leading-6 text-cyan-50/62">{message}</p>
        </GlassCard>
      ) : null}
      {!benchmark && !message && !error && !loading ? (
        <SourceEmpty
          icon={BarChart3}
          title="No BLS benchmark loaded"
          detail="Choose a sector or enter a NAICS code. The blank state is intentional so a default scenario cannot be mistaken for live BLS data."
        />
      ) : null}

      {benchmark ? (
        <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricOrb label="TRC rate" value={formatNumber(benchmark.trcRate)} note="Cases per 100 FTE" icon={BarChart3} />
            <MetricOrb label="DART rate" value={formatNumber(benchmark.dartRate)} note="Cases per 100 FTE" icon={CalendarDays} tone="violet" />
            <MetricOrb label="Days-away rate" value={formatNumber(benchmark.daysAwayRate)} note="Cases per 100 FTE" icon={Layers3} tone="rose" />
            <MetricOrb label="Data year" value={String(benchmark.year)} note={benchmark.authMode} icon={BookOpenCheck} tone="emerald" />
          </section>
          <div className="grid gap-5 xl:grid-cols-[1fr_.8fr]">
            <GlassCard className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/58">Returned rates</p>
              <div className="mt-3 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid stroke="rgba(165,243,252,.10)" vertical={false} />
                    <XAxis dataKey="metric" tick={{ fill: "rgba(207,250,254,.7)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(207,250,254,.55)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#06101d", border: "1px solid rgba(103,232,249,.2)", borderRadius: 12 }} />
                    <Bar dataKey="value" fill="#67e8f9" radius={[8, 8, 2, 2]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
            <GlassCard className="p-5">
              <div className="flex flex-wrap items-center gap-3">
                <EvidenceGradeBadge grade="A" />
                <span className="text-xs text-cyan-50/60">Official aggregate benchmark</span>
              </div>
              <h2 className="mt-3 text-xl font-black text-white">{benchmark.industryTitle}</h2>
              <p className="mt-3 text-xs leading-6 text-cyan-50/66">{benchmark.sourceMetadata}</p>
              <p className="mt-3 rounded-xl border border-amber-100/14 bg-amber-300/[0.045] p-3 text-xs leading-6 text-amber-50/70">{benchmark.limitation}</p>
              <div className="mt-4 flex flex-wrap gap-4">
                <ExternalLink href={benchmark.sourceUrl}>Open BLS source</ExternalLink>
                <ExternalLink href={benchmark.developerDocsUrl}>BLS developer docs</ExternalLink>
              </div>
              <div className="mt-4 border-t border-white/8 pt-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-cyan-50/45">Queried series IDs</p>
                <p className="mt-1 break-all text-[10px] leading-5 text-cyan-50/50">{benchmark.attemptedSeriesIds.join(" · ")}</p>
              </div>
            </GlassCard>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OshaExplorer() {
  const [company, setCompany] = useState("");
  const [state, setState] = useState("");
  const [naics, setNaics] = useState("");
  const [year, setYear] = useState("");
  const [searchedNaics, setSearchedNaics] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [records, setRecords] = useState<OshaEstablishment[]>([]);
  const [warning, setWarning] = useState("");
  const [source, setSource] = useState("");
  const [hasRun, setHasRun] = useState(false);

  async function run(nextNaics?: string) {
    const chosenNaics = nextNaics ?? naics;
    if (nextNaics !== undefined) setNaics(nextNaics);
    setLoading(true);
    setError("");
    setRecords([]);
    setWarning("");
    setSearchedNaics("");
    setHasRun(true);
    try {
      const params = new URLSearchParams();
      if (company.trim()) params.set("company", company.trim());
      if (state.trim()) params.set("state", state.trim());
      if (chosenNaics.trim()) params.set("naics", chosenNaics.trim());
      if (year.trim()) params.set("year", year.trim());
      const response = await fetch(`/api/osha/establishments?${params}`);
      const payload = await response.json();
      if (!response.ok || !payload.ok)
        throw new Error(payload.error || "OSHA record query failed.");
      setRecords(payload.records ?? []);
      setWarning(payload.warning || "");
      setSource(payload.source || "OSHA ITA imported records");
      setSearchedNaics(chosenNaics.trim());
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "OSHA record query failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(
    () => ({
      cases: records.reduce((sum, record) => sum + (record.totalCases ?? 0), 0),
      dart: records.reduce((sum, record) => sum + (record.dartCases ?? 0), 0),
      hours: records.reduce((sum, record) => sum + (record.totalHoursWorked ?? 0), 0),
      states: new Set(records.map((record) => record.state).filter(Boolean)).size,
    }),
    [records],
  );

  return (
    <div className="space-y-5">
      <GlassCard className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-rose-50/60">Imported OSHA ITA establishment records</p>
            <h2 className="mt-1 text-xl font-black text-white">Search the records actually loaded into Insight Hub</h2>
            <p className="mt-2 max-w-3xl text-xs leading-6 text-cyan-50/62">
              This is not a universal live OSHA search. It queries OSHA ITA establishment data that has already been imported into the application database and reports the source/import limitations returned by the server.
            </p>
          </div>
          <EvidenceGradeBadge grade="A" />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {oshaSectors.map((sector) => (
            <button
              key={sector.code}
              type="button"
              onClick={() => void run(sector.code)}
              className={`rounded-xl border px-3 py-3 text-left transition ${searchedNaics === sector.code ? "border-rose-200/30 bg-rose-300/10" : "border-white/10 bg-[#071321]/70 hover:border-rose-200/18"}`}
            >
              <span className="text-[9px] text-rose-50/52">NAICS {sector.code}</span>
              <span className="mt-1 block text-[11px] font-bold text-white">{sector.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_.4fr_.42fr_.42fr_auto] xl:items-end">
          <label>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-50/62">Establishment / employer</span>
            <input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Optional" className="mt-2 min-h-11 w-full rounded-xl border border-white/12 bg-[#040c16]/92 px-3 text-sm text-white outline-none" />
          </label>
          <label>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-50/62">State</span>
            <input value={state} onChange={(event) => setState(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))} placeholder="CA" className="mt-2 min-h-11 w-full rounded-xl border border-white/12 bg-[#040c16]/92 px-3 text-sm text-white outline-none" />
          </label>
          <label>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-50/62">NAICS</span>
            <input value={naics} onChange={(event) => setNaics(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))} placeholder="Optional" className="mt-2 min-h-11 w-full rounded-xl border border-white/12 bg-[#040c16]/92 px-3 text-sm text-white outline-none" />
          </label>
          <label>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-50/62">Year</span>
            <input value={year} onChange={(event) => setYear(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))} placeholder="All" className="mt-2 min-h-11 w-full rounded-xl border border-white/12 bg-[#040c16]/92 px-3 text-sm text-white outline-none" />
          </label>
          <button type="button" onClick={() => void run()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200/22 bg-rose-300/10 px-5 text-sm font-black text-white disabled:opacity-45">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Query records
          </button>
        </div>
      </GlassCard>

      {error ? <GlassCard className="border-rose-200/18 p-4 text-sm text-rose-50/80">{error}</GlassCard> : null}
      {!hasRun && !loading ? (
        <SourceEmpty icon={Building2} title="No OSHA record query has run" detail="Enter filters or choose a sector. No default NAICS is preselected and no imported record count is presented until the database is queried." />
      ) : null}
      {hasRun && !loading && !error && records.length === 0 ? (
        <SourceEmpty icon={FileSearch} title="No imported OSHA ITA rows matched" detail={warning || "The current imported OSHA ITA data did not return a row for these filters. This does not mean OSHA has no record; it only describes the imported dataset currently available to this tool."} />
      ) : null}

      {records.length ? (
        <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricOrb label="Returned rows" value={records.length.toLocaleString()} note={source || "Imported OSHA ITA"} icon={Database} />
            <MetricOrb label="Reported cases" value={summary.cases.toLocaleString()} note="Sum across returned rows" icon={ShieldAlert} tone="rose" />
            <MetricOrb label="Reported DART cases" value={summary.dart.toLocaleString()} note="Sum across returned rows" icon={CalendarDays} tone="violet" />
            <MetricOrb label="Returned coverage" value={`${summary.states} state${summary.states === 1 ? "" : "s"}`} note={`${summary.hours.toLocaleString()} reported hours`} icon={MapPinned} tone="emerald" />
          </section>
          <GlassCard className="overflow-hidden">
            <div className="border-b border-white/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-cyan-50/58">Imported establishment evidence</p>
              <h2 className="mt-1 text-lg font-black text-white">Returned OSHA ITA rows</h2>
            </div>
            <div className="max-h-[620px] overflow-auto">
              <table className="w-full min-w-[980px] text-left text-xs">
                <thead className="sticky top-0 bg-[#06101d] text-[9px] uppercase tracking-[0.14em] text-cyan-50/58">
                  <tr>
                    <th className="px-4 py-3">Establishment</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">NAICS / Year</th>
                    <th className="px-4 py-3">Cases</th>
                    <th className="px-4 py-3">DART</th>
                    <th className="px-4 py-3">TRC rate</th>
                    <th className="px-4 py-3">Dataset</th>
                  </tr>
                </thead>
                <tbody>
                  {records.slice(0, 500).map((record, index) => (
                    <tr key={`${record.establishmentName}-${record.address}-${record.year}-${index}`} className="border-t border-white/8 text-cyan-50/70 hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <p className="font-bold text-white">{record.establishmentName || record.companyName}</p>
                        {record.dbaName ? <p className="mt-1 text-cyan-50/48">{record.dbaName}</p> : null}
                      </td>
                      <td className="px-4 py-3">{[record.city, record.state].filter(Boolean).join(", ") || "Not reported"}</td>
                      <td className="px-4 py-3">{record.naics || "—"} · {record.year || "—"}</td>
                      <td className="px-4 py-3 font-bold text-white">{formatNumber(record.totalCases, 0)}</td>
                      <td className="px-4 py-3">{formatNumber(record.dartCases, 0)}</td>
                      <td className="px-4 py-3">{formatNumber(record.trcRate)}</td>
                      <td className="px-4 py-3">
                        <p>{record.datasetName || "OSHA ITA"}</p>
                        <ExternalLink href={record.sourceUrl}>Source</ExternalLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
          {warning ? <GlassCard className="border-amber-200/16 p-4 text-xs leading-6 text-amber-50/70">{warning}</GlassCard> : null}
        </div>
      ) : null}
    </div>
  );
}

type DataGovTopic = {
  id: string;
  label: string;
  query: string;
  description: string;
};

type DataGovDataset = {
  id: string;
  name: string;
  title: string;
  description: string;
  agency: string;
  updatedAt: string;
  createdAt: string;
  tags: string[];
  resources: Array<{
    id: string;
    name: string;
    description?: string;
    format: string;
    url: string;
    apiReady: boolean;
    lastModified?: string;
  }>;
  apiReady: boolean;
  relevanceScore: number;
  catalogUrl: string;
};

function DataGovExplorer() {
  const [topics, setTopics] = useState<DataGovTopic[]>([]);
  const [query, setQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [datasets, setDatasets] = useState<DataGovDataset[]>([]);
  const [total, setTotal] = useState(0);
  const [sourceUrl, setSourceUrl] = useState("https://catalog.data.gov/dataset");
  const [sourceEndpoint, setSourceEndpoint] = useState("");
  const [limitation, setLimitation] = useState("");
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    void fetch("/api/occupational-data/catalog")
      .then((response) => response.json())
      .then((payload) => {
        if (payload.ok) setTopics(payload.topics ?? []);
      })
      .catch(() => undefined);
  }, []);

  async function run(topicId?: string) {
    const topic = topicId ?? selectedTopic;
    if (!query.trim() && !topic) return;
    if (topicId !== undefined) setSelectedTopic(topicId);
    setLoading(true);
    setError("");
    setDatasets([]);
    setHasRun(true);
    try {
      const params = new URLSearchParams({ rows: "30" });
      if (query.trim() && !topicId) params.set("query", query.trim());
      if (topic) params.set("topic", topic);
      const response = await fetch(`/api/occupational-data/datagov?${params}`);
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        const attempts = Array.isArray(payload.attempts) && payload.attempts.length
          ? ` ${payload.attempts.join(" · ")}`
          : "";
        throw new Error(`${payload.error || "Data.gov search failed."}${attempts}`);
      }
      setDatasets(payload.datasets ?? []);
      setTotal(payload.count ?? 0);
      setSourceUrl(payload.sourceUrl || "https://catalog.data.gov/dataset");
      setSourceEndpoint(payload.sourceEndpoint || "");
      setLimitation(payload.limitation || "");
      if (payload.query) setQuery(payload.query);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Data.gov search failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  const agencies = new Set(datasets.map((dataset) => dataset.agency)).size;
  const apiReady = datasets.filter((dataset) => dataset.apiReady).length;

  return (
    <div className="space-y-5">
      <GlassCard className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-50/60">Official catalog discovery</p>
            <h2 className="mt-1 text-xl font-black text-white">Search Data.gov metadata without fake fallback rows</h2>
            <p className="mt-2 max-w-3xl text-xs leading-6 text-cyan-50/62">
              Topic cards generate transparent catalog queries. If the official CKAN endpoints fail, this tab shows the failure and a source link instead of substituting placeholder results.
            </p>
          </div>
          <EvidenceGradeBadge grade="A" />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {topics.map((topic) => (
            <button
              key={topic.id}
              type="button"
              onClick={() => void run(topic.id)}
              className={`rounded-xl border p-3 text-left transition ${selectedTopic === topic.id ? "border-violet-200/30 bg-violet-300/10" : "border-white/10 bg-[#071321]/70 hover:border-violet-200/18"}`}
            >
              <p className="text-xs font-black text-white">{topic.label}</p>
              <p className="mt-1 text-[10px] leading-5 text-cyan-50/50">{topic.description}</p>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cyan-50/38" size={16} />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedTopic("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") void run("");
              }}
              placeholder="state employee injuries, hearing loss, worker fatigue…"
              className="min-h-11 w-full rounded-xl border border-white/12 bg-[#040c16]/92 pl-10 pr-3 text-sm text-white outline-none focus:border-violet-200/42"
            />
          </div>
          <button type="button" onClick={() => void run("")} disabled={loading || !query.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-violet-200/24 bg-violet-300/12 px-5 text-sm font-black text-white disabled:opacity-45">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Globe2 size={16} />}
            Search catalog
          </button>
        </div>
      </GlassCard>

      {error ? (
        <GlassCard className="border-rose-200/18 p-5">
          <p className="font-black text-rose-50">Data.gov catalog request failed</p>
          <p className="mt-2 text-xs leading-6 text-rose-50/72">{error}</p>
          <div className="mt-3"><ExternalLink href={sourceUrl}>Open Data.gov manually</ExternalLink></div>
        </GlassCard>
      ) : null}
      {!hasRun && !loading ? <SourceEmpty icon={FileSearch} title="No Data.gov search has run" detail="Choose a topic or enter a plain-language query. Nothing is prefilled from another source tab." /> : null}
      {hasRun && !loading && !error && datasets.length === 0 ? <SourceEmpty icon={Database} title="No catalog datasets returned" detail="The official catalog query completed without a displayed dataset. No placeholder or synthetic dataset cards were added." /> : null}

      {datasets.length ? (
        <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricOrb label="Catalog matches" value={total.toLocaleString()} note="Data.gov metadata count" icon={Database} />
            <MetricOrb label="Displayed" value={datasets.length.toLocaleString()} note="Top returned metadata rows" icon={Layers3} tone="violet" />
            <MetricOrb label="Publishing agencies" value={agencies.toLocaleString()} note="Distinct displayed publishers" icon={Landmark} tone="emerald" />
            <MetricOrb label="API-ready datasets" value={apiReady.toLocaleString()} note="At least one API/JSON/CSV-style resource" icon={Globe2} tone="amber" />
          </section>
          <div className="grid gap-4 xl:grid-cols-2">
            {datasets.map((dataset, index) => (
              <motion.article key={dataset.id || `${dataset.title}-${index}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.02, 0.2) }} className="rounded-2xl border border-white/12 bg-[#071321]/86 p-5 shadow-[0_14px_36px_rgba(0,0,0,.22)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-violet-50/56">{dataset.agency}</p>
                    <h2 className="mt-2 text-lg font-black text-white">{dataset.title}</h2>
                  </div>
                  {dataset.apiReady ? <span className="shrink-0 rounded-full border border-emerald-200/22 bg-emerald-300/10 px-2.5 py-1 text-[9px] font-bold text-emerald-50">API-ready</span> : null}
                </div>
                <p className="mt-3 line-clamp-4 text-xs leading-6 text-cyan-50/66">{dataset.description || "No catalog description reported."}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {dataset.tags.slice(0, 6).map((tag) => <span key={tag} className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-1 text-[9px] text-cyan-50/58">{tag}</span>)}
                </div>
                <div className="mt-4 border-t border-white/8 pt-3">
                  <p className="text-[10px] text-cyan-50/48">Updated {formatDate(dataset.updatedAt)} · relevance {dataset.relevanceScore}</p>
                  <div className="mt-3 flex flex-wrap gap-4">
                    <ExternalLink href={dataset.catalogUrl}>Catalog record</ExternalLink>
                    {dataset.resources[0]?.url ? <ExternalLink href={dataset.resources[0].url}>Open first resource</ExternalLink> : null}
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
          <GlassCard className="p-4 text-xs leading-6 text-cyan-50/60">
            <strong className="text-white">Source adapter:</strong> {sourceEndpoint || "official Data.gov CKAN action API"}. {limitation}
          </GlassCard>
          <ExternalLink href={sourceUrl}>Open this query on Data.gov</ExternalLink>
        </div>
      ) : null}
    </div>
  );
}

export default function OccupationalDataExplorer() {
  const [activeTab, setActiveTab] = useState<ExplorerTab>("bls");
  return (
    <OccupationalToolShell
      eyebrow="Independent Intelligence Tool · Public Occupational Data"
      title="Occupational Data Explorer"
      subtitle="Three separate source workspaces for BLS SOII benchmarks, imported OSHA ITA records, and Data.gov catalog discovery."
      notice="The source tabs are independent. Filters and results do not transfer between tabs or into another Insight Hub tool. BLS is a live aggregate benchmark lookup; OSHA searches imported ITA establishment records; Data.gov searches catalog metadata. Each source keeps its own limitations visible."
    >
      <ToolHero
        kicker="Three sources · three scopes"
        title="Use the right source without pretending they are the same thing."
        description="BLS answers industry-rate questions, the OSHA tab inspects the ITA rows currently loaded in the database, and Data.gov discovers public datasets. No default result is presented as a live finding."
        accent="violet"
      >
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: BarChart3, label: "BLS", note: "Live SOII rates" },
            { icon: ShieldAlert, label: "OSHA", note: "Imported ITA rows" },
            { icon: Globe2, label: "Data.gov", note: "Live catalog" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-white/12 bg-black/20 p-3 text-center">
              <item.icon className="mx-auto text-cyan-200/65" size={18} />
              <p className="mt-2 text-xs font-black text-white">{item.label}</p>
              <p className="mt-1 text-[9px] text-cyan-50/50">{item.note}</p>
            </div>
          ))}
        </div>
      </ToolHero>
      <SectionTabs<ExplorerTab> tabs={tabs} active={activeTab} onChange={setActiveTab} />
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
          {activeTab === "bls" ? <BlsExplorer /> : activeTab === "osha" ? <OshaExplorer /> : <DataGovExplorer />}
        </motion.div>
      </AnimatePresence>
    </OccupationalToolShell>
  );
}
