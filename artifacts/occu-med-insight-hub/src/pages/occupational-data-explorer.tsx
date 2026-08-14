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
  Sparkles,
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

const tabs: Array<{ id: ExplorerTab; label: string; icon: typeof BarChart3 }> =
  [
    { id: "bls", label: "BLS Master Explorer", icon: BarChart3 },
    { id: "osha", label: "OSHA Master Explorer", icon: ShieldAlert },
    { id: "datagov", label: "Data.gov Master Explorer", icon: Database },
  ];

const sectors = [
  {
    code: "23",
    label: "Construction",
    note: "Construction and extraction work",
  },
  {
    code: "31",
    label: "Manufacturing",
    note: "Production and plant operations",
  },
  {
    code: "48",
    label: "Transportation",
    note: "Transportation and warehousing",
  },
  { code: "62", label: "Healthcare", note: "Healthcare and social assistance" },
  { code: "92", label: "Public Administration", note: "Government workforces" },
  {
    code: "21",
    label: "Mining & Extraction",
    note: "Mining, quarrying, oil, and gas",
  },
  { code: "22", label: "Utilities", note: "Energy and utility operations" },
  {
    code: "72",
    label: "Accommodation & Food",
    note: "Hospitality and food service",
  },
];

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
      className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-200/68 transition hover:text-white"
    >
      {children}
      <ArrowUpRight size={13} />
    </a>
  );
}

function BlsExplorer() {
  const [naics, setNaics] = useState("23");
  const [year, setYear] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [benchmark, setBenchmark] = useState<BlsBenchmark | null>(null);
  const [message, setMessage] = useState("");

  async function run(nextNaics = naics) {
    const query = nextNaics.trim();
    if (!query) return;
    setNaics(query);
    setLoading(true);
    setError("");
    setMessage("");
    setBenchmark(null);
    try {
      const params = new URLSearchParams({ naics: query });
      if (year.trim()) params.set("year", year.trim());
      const response = await fetch(`/api/bls/industry-benchmark?${params}`);
      const payload = await response.json();
      if (!response.ok || !payload.ok)
        throw new Error(payload.error || "BLS request failed.");
      setBenchmark(payload.benchmark ?? null);
      setMessage(payload.message || payload.limitation || "");
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
        { metric: "TRC", value: benchmark.trcRate ?? 0 },
        { metric: "DART", value: benchmark.dartRate ?? 0 },
        { metric: "Days Away", value: benchmark.daysAwayRate ?? 0 },
      ]
    : [];

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {sectors.map((sector) => (
          <button
            key={sector.code}
            type="button"
            onClick={() => void run(sector.code)}
            className={`rounded-[22px] border p-4 text-left transition hover:-translate-y-0.5 ${naics === sector.code ? "border-cyan-200/26 bg-cyan-300/10 shadow-[0_0_28px_rgba(34,211,238,.08)]" : "border-white/9 bg-white/[0.025] hover:border-white/15"}`}
          >
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-100/36">
              NAICS {sector.code}
            </p>
            <p className="mt-2 text-sm font-black text-white">{sector.label}</p>
            <p className="mt-1 text-[11px] text-cyan-100/38">{sector.note}</p>
          </button>
        ))}
      </div>

      <GlassCard className="mt-6 p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_.55fr_auto] md:items-end">
          <label>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/42">
              NAICS industry code
            </span>
            <input
              value={naics}
              onChange={(event) =>
                setNaics(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))
              }
              className="mt-2 min-h-12 w-full rounded-2xl border border-cyan-100/14 bg-[#06101c]/82 px-4 text-sm text-white outline-none focus:border-cyan-200/38"
            />
          </label>
          <label>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/42">
              Year optional
            </span>
            <input
              value={year}
              onChange={(event) =>
                setYear(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))
              }
              placeholder="Latest"
              className="mt-2 min-h-12 w-full rounded-2xl border border-cyan-100/14 bg-[#06101c]/82 px-4 text-sm text-white outline-none focus:border-cyan-200/38"
            />
          </label>
          <button
            type="button"
            onClick={() => void run()}
            disabled={loading || !naics}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-200/22 bg-cyan-300/13 px-5 text-sm font-black text-white disabled:opacity-45"
          >
            {loading ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <Search size={17} />
            )}
            Explore BLS
          </button>
        </div>
      </GlassCard>

      {error ? (
        <GlassCard className="mt-6 border-rose-200/16 p-5 text-sm text-rose-100">
          {error}
        </GlassCard>
      ) : null}
      {!benchmark && message && !loading ? (
        <GlassCard className="mt-6 p-6">
          <p className="font-black text-white">No usable series returned</p>
          <p className="mt-2 text-sm leading-7 text-cyan-100/48">{message}</p>
        </GlassCard>
      ) : null}
      {benchmark ? (
        <div className="mt-6 space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricOrb
              label="TRC rate"
              value={formatNumber(benchmark.trcRate)}
              note="Total recordable cases per 100 FTE"
              icon={BarChart3}
            />
            <MetricOrb
              label="DART rate"
              value={formatNumber(benchmark.dartRate)}
              note="Days away, restricted, or transferred"
              icon={CalendarDays}
              tone="violet"
            />
            <MetricOrb
              label="Days-away rate"
              value={formatNumber(benchmark.daysAwayRate)}
              note="Cases involving days away"
              icon={Layers3}
              tone="rose"
            />
            <MetricOrb
              label="Benchmark year"
              value={String(benchmark.year)}
              note={benchmark.authMode}
              icon={BookOpenCheck}
              tone="emerald"
            />
          </section>
          <div className="grid gap-6 xl:grid-cols-[1fr_.75fr]">
            <GlassCard className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/38">
                Rate comparison
              </p>
              <div className="mt-4 h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <defs>
                      <linearGradient
                        id="blsExplorerGradient"
                        x1="0"
                        x2="0"
                        y1="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#67e8f9"
                          stopOpacity={0.95}
                        />
                        <stop
                          offset="100%"
                          stopColor="#8b5cf6"
                          stopOpacity={0.35}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="rgba(165,243,252,.08)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="metric"
                      tick={{ fill: "rgba(207,250,254,.52)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "rgba(207,250,254,.42)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#06101d",
                        border: "1px solid rgba(103,232,249,.18)",
                        borderRadius: 16,
                      }}
                    />
                    <Bar
                      dataKey="value"
                      fill="url(#blsExplorerGradient)"
                      radius={[10, 10, 2, 2]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
            <GlassCard className="p-6">
              <div className="flex flex-wrap items-center gap-3">
                <EvidenceGradeBadge grade="A" />
                <span className="text-xs text-cyan-100/42">
                  Official aggregate benchmark
                </span>
              </div>
              <h2 className="mt-4 text-2xl font-black text-white">
                {benchmark.industryTitle}
              </h2>
              <p className="mt-3 text-sm leading-7 text-cyan-100/52">
                {benchmark.sourceMetadata}
              </p>
              <p className="mt-4 rounded-2xl border border-amber-100/12 bg-amber-300/[0.045] p-4 text-xs leading-6 text-amber-100/60">
                {benchmark.limitation}
              </p>
              <div className="mt-5 flex flex-wrap gap-4">
                <ExternalLink href={benchmark.sourceUrl}>
                  Open BLS source
                </ExternalLink>
                <ExternalLink href={benchmark.developerDocsUrl}>
                  Developer documentation
                </ExternalLink>
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
  const [naics, setNaics] = useState("23");
  const [year, setYear] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [records, setRecords] = useState<OshaEstablishment[]>([]);
  const [warning, setWarning] = useState("");
  const [source, setSource] = useState("");

  async function run(nextNaics = naics) {
    setNaics(nextNaics);
    setLoading(true);
    setError("");
    setRecords([]);
    try {
      const params = new URLSearchParams();
      if (company.trim()) params.set("company", company.trim());
      if (state.trim()) params.set("state", state.trim());
      if (nextNaics.trim()) params.set("naics", nextNaics.trim());
      if (year.trim()) params.set("year", year.trim());
      const response = await fetch(`/api/osha/establishments?${params}`);
      const payload = await response.json();
      if (!response.ok || !payload.ok)
        throw new Error(payload.error || "OSHA query failed.");
      setRecords(payload.records ?? []);
      setWarning(payload.warning || "");
      setSource(payload.source || "OSHA ITA");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "OSHA query failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(
    () => ({
      cases: records.reduce((sum, record) => sum + (record.totalCases ?? 0), 0),
      dart: records.reduce((sum, record) => sum + (record.dartCases ?? 0), 0),
      hours: records.reduce(
        (sum, record) => sum + (record.totalHoursWorked ?? 0),
        0,
      ),
      states: new Set(records.map((record) => record.state).filter(Boolean))
        .size,
    }),
    [records],
  );

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {sectors.slice(0, 8).map((sector) => (
          <button
            key={sector.code}
            type="button"
            onClick={() => void run(sector.code)}
            className={`rounded-[22px] border p-4 text-left transition hover:-translate-y-0.5 ${naics === sector.code ? "border-rose-200/24 bg-rose-300/[0.08]" : "border-white/9 bg-white/[0.025] hover:border-white/15"}`}
          >
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-rose-100/38">
              OSHA lens · {sector.code}
            </p>
            <p className="mt-2 text-sm font-black text-white">{sector.label}</p>
            <p className="mt-1 text-[11px] text-cyan-100/38">
              Browse imported establishment evidence
            </p>
          </button>
        ))}
      </div>
      <GlassCard className="mt-6 p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.2fr_.42fr_.42fr_.42fr_auto] xl:items-end">
          <label>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/42">
              Employer optional
            </span>
            <input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="Search establishment or DBA"
              className="mt-2 min-h-12 w-full rounded-2xl border border-cyan-100/14 bg-[#06101c]/82 px-4 text-sm text-white outline-none"
            />
          </label>
          <label>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/42">
              State
            </span>
            <input
              value={state}
              onChange={(event) =>
                setState(
                  event.target.value
                    .toUpperCase()
                    .replace(/[^A-Z]/g, "")
                    .slice(0, 2),
                )
              }
              placeholder="CA"
              className="mt-2 min-h-12 w-full rounded-2xl border border-cyan-100/14 bg-[#06101c]/82 px-4 text-sm text-white outline-none"
            />
          </label>
          <label>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/42">
              NAICS
            </span>
            <input
              value={naics}
              onChange={(event) =>
                setNaics(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))
              }
              className="mt-2 min-h-12 w-full rounded-2xl border border-cyan-100/14 bg-[#06101c]/82 px-4 text-sm text-white outline-none"
            />
          </label>
          <label>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/42">
              Year
            </span>
            <input
              value={year}
              onChange={(event) =>
                setYear(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))
              }
              placeholder="All"
              className="mt-2 min-h-12 w-full rounded-2xl border border-cyan-100/14 bg-[#06101c]/82 px-4 text-sm text-white outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => void run()}
            disabled={loading}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-rose-200/20 bg-rose-300/10 px-5 text-sm font-black text-white"
          >
            {loading ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <Search size={17} />
            )}
            Explore OSHA
          </button>
        </div>
      </GlassCard>
      {error ? (
        <GlassCard className="mt-6 border-rose-200/16 p-5 text-sm text-rose-100">
          {error}
        </GlassCard>
      ) : null}
      {records.length > 0 ? (
        <div className="mt-6 space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricOrb
              label="Records"
              value={records.length.toLocaleString()}
              note={source}
              icon={Database}
            />
            <MetricOrb
              label="Reported cases"
              value={summary.cases.toLocaleString()}
              note="Sum of returned establishment records"
              icon={ShieldAlert}
              tone="rose"
            />
            <MetricOrb
              label="Reported DART"
              value={summary.dart.toLocaleString()}
              note="Returned DART case count"
              icon={CalendarDays}
              tone="violet"
            />
            <MetricOrb
              label="Geographic coverage"
              value={`${summary.states} states`}
              note={`${summary.hours.toLocaleString()} reported hours`}
              icon={MapPinned}
              tone="emerald"
            />
          </section>
          <GlassCard className="overflow-hidden">
            <div className="border-b border-white/8 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/38">
                    Establishment evidence
                  </p>
                  <h2 className="mt-1 text-xl font-black text-white">
                    Returned OSHA records
                  </h2>
                </div>
                <EvidenceGradeBadge grade="A" />
              </div>
            </div>
            <div className="max-h-[660px] overflow-auto">
              <table className="min-w-[980px] w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#071321]/96 text-[9px] uppercase tracking-[0.16em] text-cyan-100/38">
                  <tr>
                    <th className="px-5 py-3">Establishment</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">NAICS / year</th>
                    <th className="px-4 py-3">Cases</th>
                    <th className="px-4 py-3">DART</th>
                    <th className="px-4 py-3">TRC rate</th>
                    <th className="px-4 py-3">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {records.slice(0, 500).map((record, index) => (
                    <tr
                      key={`${record.establishmentName}-${record.address}-${record.year}-${index}`}
                      className="border-t border-white/6 text-cyan-50/66 hover:bg-cyan-300/[0.035]"
                    >
                      <td className="px-5 py-4">
                        <p className="font-bold text-white">
                          {record.establishmentName || record.companyName}
                        </p>
                        <p className="mt-1 text-cyan-100/35">
                          {record.dbaName || record.companyName}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        {[record.city, record.state].filter(Boolean).join(", ")}
                      </td>
                      <td className="px-4 py-4">
                        {record.naics || "—"} · {record.year || "—"}
                      </td>
                      <td className="px-4 py-4 font-bold text-white">
                        {formatNumber(record.totalCases, 0)}
                      </td>
                      <td className="px-4 py-4">
                        {formatNumber(record.dartCases, 0)}
                      </td>
                      <td className="px-4 py-4">
                        {formatNumber(record.trcRate)}
                      </td>
                      <td className="px-4 py-4">
                        <ExternalLink href={record.sourceUrl}>
                          Source
                        </ExternalLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
          {warning ? (
            <GlassCard className="border-amber-200/14 p-4 text-xs leading-6 text-amber-100/58">
              {warning}
            </GlassCard>
          ) : null}
        </div>
      ) : null}
      {!loading && !error && records.length === 0 ? (
        <GlassCard className="mt-6 p-10 text-center">
          <Building2 className="mx-auto h-9 w-9 text-cyan-100/25" />
          <p className="mt-3 font-black text-white">Run an OSHA source lens</p>
          <p className="mt-2 text-xs text-cyan-100/42">
            Choose a sector or enter filters. This tab does not inherit anything
            from the BLS or Data.gov tabs.
          </p>
        </GlassCard>
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
  tags: string[];
  resources: Array<{
    id: string;
    name: string;
    format: string;
    url: string;
    apiReady: boolean;
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
  const [sourceUrl, setSourceUrl] = useState(
    "https://catalog.data.gov/dataset",
  );
  const [limitation, setLimitation] = useState("");

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
    if (topicId) setSelectedTopic(topicId);
    setLoading(true);
    setError("");
    setDatasets([]);
    try {
      const params = new URLSearchParams({ rows: "30" });
      if (query.trim() && !topicId) params.set("query", query.trim());
      if (topic) params.set("topic", topic);
      const response = await fetch(`/api/occupational-data/datagov?${params}`);
      const payload = await response.json();
      if (!response.ok || !payload.ok)
        throw new Error(payload.error || "Data.gov search failed.");
      setDatasets(payload.datasets ?? []);
      setTotal(payload.count ?? 0);
      setSourceUrl(payload.sourceUrl || sourceUrl);
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
    <div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {topics.map((topic) => (
          <button
            key={topic.id}
            type="button"
            onClick={() => void run(topic.id)}
            className={`rounded-[22px] border p-4 text-left transition hover:-translate-y-0.5 ${selectedTopic === topic.id ? "border-violet-200/25 bg-violet-300/[0.09]" : "border-white/9 bg-white/[0.025] hover:border-white/15"}`}
          >
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-violet-100/38">
              Topic collection
            </p>
            <p className="mt-2 text-sm font-black text-white">{topic.label}</p>
            <p className="mt-1 text-[11px] leading-5 text-cyan-100/38">
              {topic.description}
            </p>
          </button>
        ))}
      </div>
      <GlassCard className="mt-6 p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <label>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/42">
              Plain-language dataset search
            </span>
            <div className="relative mt-2">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cyan-100/30"
                size={17}
              />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedTopic("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void run("");
                }}
                placeholder="Example: state employee injuries, hearing loss, worker fatigue…"
                className="min-h-12 w-full rounded-2xl border border-cyan-100/14 bg-[#06101c]/82 pl-11 pr-4 text-sm text-white outline-none focus:border-violet-200/38"
              />
            </div>
          </label>
          <button
            type="button"
            onClick={() => void run("")}
            disabled={loading || !query.trim()}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-violet-200/22 bg-violet-300/12 px-5 text-sm font-black text-white disabled:opacity-45"
          >
            {loading ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <Globe2 size={17} />
            )}
            Search Data.gov
          </button>
        </div>
      </GlassCard>
      {error ? (
        <GlassCard className="mt-6 border-rose-200/16 p-5 text-sm text-rose-100">
          {error}
        </GlassCard>
      ) : null}
      {datasets.length > 0 ? (
        <div className="mt-6 space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricOrb
              label="Catalog matches"
              value={total.toLocaleString()}
              note="Total Data.gov metadata results"
              icon={Database}
            />
            <MetricOrb
              label="Displayed datasets"
              value={datasets.length.toLocaleString()}
              note="Highest relevance returned"
              icon={Layers3}
              tone="violet"
            />
            <MetricOrb
              label="Publishing agencies"
              value={agencies.toLocaleString()}
              note="Distinct publishers displayed"
              icon={Landmark}
              tone="emerald"
            />
            <MetricOrb
              label="API-ready resources"
              value={apiReady.toLocaleString()}
              note="Datasets with API/JSON/CSV resources"
              icon={Sparkles}
              tone="amber"
            />
          </section>
          <div className="grid gap-4 xl:grid-cols-2">
            {datasets.map((dataset, index) => (
              <motion.article
                key={dataset.id || `${dataset.title}-${index}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.025, 0.25) }}
                className="rounded-[26px] border border-white/10 bg-white/[0.035] p-[1px] shadow-[0_22px_60px_rgba(0,0,0,.28)]"
              >
                <div className="h-full rounded-[25px] border border-white/[0.06] bg-[#071321]/78 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-violet-100/40">
                        {dataset.agency}
                      </p>
                      <h2 className="mt-2 text-lg font-black text-white">
                        {dataset.title}
                      </h2>
                    </div>
                    {dataset.apiReady ? (
                      <span className="shrink-0 rounded-full border border-emerald-200/18 bg-emerald-300/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-emerald-100">
                        API-ready
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 line-clamp-4 text-xs leading-6 text-cyan-100/48">
                    {dataset.description || "No catalog description reported."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {dataset.tags.slice(0, 6).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[9px] text-cyan-100/45"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/7 pt-4">
                    <div className="text-[10px] text-cyan-100/34">
                      Updated {formatDate(dataset.updatedAt)} · relevance{" "}
                      {dataset.relevanceScore}
                    </div>
                    <div className="flex gap-3">
                      <ExternalLink href={dataset.catalogUrl}>
                        Catalog record
                      </ExternalLink>
                      {dataset.resources[0]?.url ? (
                        <ExternalLink href={dataset.resources[0].url}>
                          Open data
                        </ExternalLink>
                      ) : null}
                    </div>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
          {limitation ? (
            <GlassCard className="border-amber-200/14 p-4 text-xs leading-6 text-amber-100/58">
              {limitation}
            </GlassCard>
          ) : null}
          <ExternalLink href={sourceUrl}>
            Open this search on Data.gov
          </ExternalLink>
        </div>
      ) : null}
      {!loading && !error && datasets.length === 0 ? (
        <GlassCard className="mt-6 p-10 text-center">
          <FileSearch className="mx-auto h-9 w-9 text-violet-100/28" />
          <p className="mt-3 font-black text-white">
            Choose a topic collection or run a search.
          </p>
          <p className="mt-2 text-xs text-cyan-100/42">
            This tab searches Data.gov independently. It does not use selections
            from the BLS or OSHA tabs.
          </p>
        </GlassCard>
      ) : null}
    </div>
  );
}

export default function OccupationalDataExplorer() {
  const [activeTab, setActiveTab] = useState<ExplorerTab>("bls");
  return (
    <OccupationalToolShell
      eyebrow="Independent Intelligence Tool · Public Data"
      title="Occupational Data Explorer"
      subtitle="Three separate master explorers for BLS, OSHA, and Data.gov occupational-health evidence."
      notice="Each source tab is independent. Searches, filters, records, and results do not pass between tabs or into any other Insight Hub tool. Public data may be incomplete, delayed, suppressed, or affected by reporting rules and must remain attached to its source limitations."
    >
      <ToolHero
        kicker="Browse first. Search second."
        title="Explore the public evidence without knowing the perfect query."
        description="Start with curated occupational-health topic collections, then narrow the live source data with plain-language searches and transparent filters."
        accent="violet"
      >
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: BarChart3, label: "BLS", note: "Industry rates" },
            { icon: ShieldAlert, label: "OSHA", note: "Establishments" },
            { icon: Globe2, label: "Data.gov", note: "Federal catalog" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center"
            >
              <item.icon className="mx-auto text-cyan-200/55" size={20} />
              <p className="mt-2 text-sm font-black text-white">{item.label}</p>
              <p className="mt-1 text-[10px] text-cyan-100/35">{item.note}</p>
            </div>
          ))}
        </div>
      </ToolHero>
      <SectionTabs<ExplorerTab>
        tabs={tabs}
        active={activeTab}
        onChange={setActiveTab}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          {activeTab === "bls" ? (
            <BlsExplorer />
          ) : activeTab === "osha" ? (
            <OshaExplorer />
          ) : (
            <DataGovExplorer />
          )}
        </motion.div>
      </AnimatePresence>
    </OccupationalToolShell>
  );
}
