import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  BookOpenCheck,
  Database,
  ExternalLink,
  FileQuestion,
  Filter,
  Layers3,
  Loader2,
  MapPinned,
  Search,
  ShieldCheck,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";

type Region = "Northeast" | "Midwest" | "South" | "West";
type CoverageType = "claim-level" | "aggregate" | "administrative" | "unindexed";
type ReviewStatus = "indexed-pending-review" | "unindexed";

type WorkersCompSource = {
  name: string;
  agency: string;
  url: string;
  type: Exclude<CoverageType, "unindexed">;
  publicationNote: string;
};

type StateCoverage = {
  code: string;
  name: string;
  region: Region;
  coverageType: CoverageType;
  reviewStatus: ReviewStatus;
  sourceCount: number;
  sources: WorkersCompSource[];
  coverageNotes: string;
  freshness: string;
  limitations: string[];
};

type CoverageResponse = {
  ok: boolean;
  enabled: boolean;
  generatedAt: string;
  sourceModel: string;
  summary: {
    totalStates: number;
    indexedStates: number;
    unindexedStates: number;
    claimLevelStates: number;
    aggregateStates: number;
    administrativeStates: number;
    sourceCount: number;
  };
  states: StateCoverage[];
  limitation: string;
  error?: string;
};

const COVERAGE_LABELS: Record<CoverageType, string> = {
  "claim-level": "Claim-oriented source",
  aggregate: "Aggregate reporting",
  administrative: "Administrative reports",
  unindexed: "Not indexed",
};

const COVERAGE_TONES: Record<CoverageType, string> = {
  "claim-level": "border-emerald-200/25 bg-emerald-300/12 text-emerald-100 shadow-[0_0_24px_rgba(52,211,153,.10)]",
  aggregate: "border-cyan-200/22 bg-cyan-300/10 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,.08)]",
  administrative: "border-violet-200/22 bg-violet-300/10 text-violet-100 shadow-[0_0_24px_rgba(167,139,250,.08)]",
  unindexed: "border-slate-200/10 bg-slate-300/[0.04] text-slate-400",
};

const REGION_ORDER: Region[] = ["Northeast", "Midwest", "South", "West"];

async function fetchCoverage(): Promise<CoverageResponse> {
  const response = await fetch("/api/workers-comp/coverage");
  const payload = await response.json() as CoverageResponse;
  if (!response.ok) throw new Error(payload.error || `Coverage request failed with HTTP ${response.status}`);
  return payload;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function WorkersCompCoverage() {
  const [data, setData] = useState<CoverageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState("CA");
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<"all" | Region>("all");
  const [coverage, setCoverage] = useState<"all" | CoverageType>("all");

  useEffect(() => {
    let active = true;
    void fetchCoverage()
      .then((result) => {
        if (!active) return;
        setData(result);
        const preferred = result.states.find((state) => state.code === "CA")
          ?? result.states.find((state) => state.sourceCount > 0)
          ?? result.states[0];
        setSelectedCode(preferred?.code ?? "");
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Coverage data could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filteredStates = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    return data.states.filter((state) => {
      if (region !== "all" && state.region !== region) return false;
      if (coverage !== "all" && state.coverageType !== coverage) return false;
      if (!needle) return true;
      return state.code.toLowerCase().includes(needle)
        || state.name.toLowerCase().includes(needle)
        || state.sources.some((source) => `${source.name} ${source.agency}`.toLowerCase().includes(needle));
    });
  }, [data, query, region, coverage]);

  const selected = data?.states.find((state) => state.code === selectedCode)
    ?? filteredStates[0]
    ?? null;

  const regions = useMemo(() => REGION_ORDER.map((regionName) => ({
    region: regionName,
    states: filteredStates.filter((state) => state.region === regionName),
  })).filter((group) => group.states.length > 0), [filteredStates]);

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar
          eyebrow="Employer Intelligence"
          title="Workers’ Compensation Source Coverage"
          subtitle="See which state-level public workers’ compensation sources are indexed, what kind of information they may provide, and where manual research is still required."
        />

        <GlassCard className="mb-6 border-amber-200/15 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <p className="text-xs leading-5 text-amber-100/70">
              {data?.limitation ?? "There is no single complete national workers’ compensation database. State coverage, definitions, reporting periods, and publication practices vary."}
            </p>
          </div>
        </GlassCard>

        <motion.section
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[34px] border border-cyan-100/12 bg-[radial-gradient(circle_at_78%_15%,rgba(34,211,238,.18),transparent_32%),radial-gradient(circle_at_16%_82%,rgba(139,92,246,.17),transparent_35%),rgba(2,8,23,.82)] p-5 shadow-[0_30px_90px_rgba(0,0,0,.36)] backdrop-blur-2xl md:p-8"
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent,rgba(255,255,255,.035),transparent)]" />
          <div className="relative grid gap-7 xl:grid-cols-[1.18fr_.82fr]">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-cyan-100/42">State source atlas</p>
              <h1 className="mt-3 max-w-4xl text-3xl font-black tracking-[-0.04em] text-white md:text-5xl">
                Fifty states. One honest view of what is—and is not—indexed.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-cyan-100/55">
                This is a manual research index, not a national claims database. Indexed sources remain visibly separate from unreviewed states, and every source keeps its limitations attached.
              </p>
            </div>

            <div className="grid content-start gap-3 sm:grid-cols-2">
              <HeroPrinciple icon={<MapPinned size={18} />} label="Jurisdictions" value={data ? String(data.summary.totalStates) : "50"} note="State-by-state source visibility" />
              <HeroPrinciple icon={<Database size={18} />} label="Source model" value="Manual index" note="No cron, crawler, or unattended ingestion" />
              <HeroPrinciple icon={<ShieldCheck size={18} />} label="Interpretation" value="Research only" note="Never liability, claim validity, or safety scoring" />
              <HeroPrinciple icon={<BookOpenCheck size={18} />} label="Review state" value="Explicit" note="Indexed, pending review, or not yet indexed" />
            </div>
          </div>
        </motion.section>

        {loading && (
          <GlassCard className="mt-6 p-10 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-200" />
            <p className="mt-3 text-sm text-cyan-100/60">Loading state coverage index…</p>
          </GlassCard>
        )}

        {error && (
          <GlassCard className="mt-6 border-rose-200/15 p-6">
            <p className="text-sm font-semibold text-rose-100">Coverage index could not load</p>
            <p className="mt-2 text-xs leading-6 text-rose-100/60">{error}</p>
          </GlassCard>
        )}

        {data && !loading && (
          <div className="mt-8 space-y-8">
            <SummaryGrid data={data} />

            {!data.enabled && (
              <GlassCard className="border-amber-200/15 p-5">
                <p className="text-sm font-semibold text-amber-100">Source index disabled</p>
                <p className="mt-2 text-xs leading-6 text-amber-100/60">
                  Set WORKERS_COMP_SOURCE_INDEX_ENABLED=true to expose the indexed source records. State shells and limitations remain visible while disabled.
                </p>
              </GlassCard>
            )}

            <FilterBar query={query} onQuery={setQuery} region={region} onRegion={setRegion} coverage={coverage} onCoverage={setCoverage} />

            <div className="grid gap-6 2xl:grid-cols-[1.35fr_.65fr]">
              <GlassCard className="overflow-hidden p-5 md:p-7">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-100/35">Coverage atlas</p>
                    <h2 className="mt-2 text-xl font-black tracking-tight text-white">State source index</h2>
                  </div>
                  <p className="text-xs text-cyan-100/40">{filteredStates.length} state{filteredStates.length === 1 ? "" : "s"} shown</p>
                </div>

                <div className="mt-6 space-y-6">
                  {regions.map((group) => (
                    <section key={group.region}>
                      <div className="mb-3 flex items-center gap-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-100/42">{group.region}</p>
                        <span className="h-px flex-1 bg-cyan-100/8" />
                        <span className="text-[10px] text-cyan-100/30">{group.states.length}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 xl:grid-cols-10">
                        {group.states.map((state) => (
                          <button
                            key={state.code}
                            type="button"
                            onClick={() => setSelectedCode(state.code)}
                            title={`${state.name}: ${COVERAGE_LABELS[state.coverageType]}`}
                            className={`group relative min-h-16 rounded-2xl border p-2 text-left transition duration-300 ${selected?.code === state.code ? "ring-2 ring-cyan-200/45 ring-offset-2 ring-offset-[#030813]" : "hover:-translate-y-0.5"} ${COVERAGE_TONES[state.coverageType]}`}
                          >
                            <span className="block text-base font-black tracking-tight">{state.code}</span>
                            <span className="mt-1 block truncate text-[9px] opacity-55">{state.sourceCount > 0 ? `${state.sourceCount} source${state.sourceCount === 1 ? "" : "s"}` : "Not indexed"}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}

                  {filteredStates.length === 0 && (
                    <div className="rounded-3xl border border-dashed border-cyan-100/12 px-5 py-12 text-center">
                      <FileQuestion className="mx-auto h-8 w-8 text-cyan-100/25" />
                      <p className="mt-3 text-sm text-cyan-100/55">No states match the current filters.</p>
                    </div>
                  )}
                </div>
              </GlassCard>

              <StateDetail state={selected} generatedAt={data.generatedAt} sourceModel={data.sourceModel} />
            </div>

            <Legend />
          </div>
        )}
      </section>
    </main>
  );
}

function SummaryGrid({ data }: { data: CoverageResponse }) {
  const cards = [
    { icon: <Layers3 size={18} />, label: "Indexed states", value: data.summary.indexedStates, note: `${data.summary.sourceCount} indexed source records` },
    { icon: <FileQuestion size={18} />, label: "Not yet indexed", value: data.summary.unindexedStates, note: "Not evidence that no data exists" },
    { icon: <Database size={18} />, label: "Aggregate coverage", value: data.summary.aggregateStates, note: "State-level statistics or reporting" },
    { icon: <BarChart3 size={18} />, label: "Claim-oriented", value: data.summary.claimLevelStates, note: "Availability still requires review" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <GlassCard key={card.label} className="p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-2xl border border-cyan-100/12 bg-white/[0.04] p-2.5 text-cyan-100/65">{card.icon}</span>
            <span className="text-3xl font-black tracking-tight text-white">{card.value}</span>
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/58">{card.label}</p>
          <p className="mt-2 text-xs leading-5 text-cyan-100/38">{card.note}</p>
        </GlassCard>
      ))}
    </div>
  );
}

function FilterBar({
  query,
  onQuery,
  region,
  onRegion,
  coverage,
  onCoverage,
}: {
  query: string;
  onQuery: (value: string) => void;
  region: "all" | Region;
  onRegion: (value: "all" | Region) => void;
  coverage: "all" | CoverageType;
  onCoverage: (value: "all" | CoverageType) => void;
}) {
  return (
    <GlassCard className="p-4">
      <div className="grid gap-3 md:grid-cols-[1.3fr_.8fr_.9fr]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-100/35" />
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search state, agency, or source"
            className="h-11 w-full rounded-2xl border border-cyan-100/12 bg-[#020817]/70 pl-10 pr-3 text-sm text-cyan-50 outline-none transition placeholder:text-cyan-100/25 focus:border-cyan-200/30"
          />
        </label>
        <Select value={region} onChange={(value) => onRegion(value as "all" | Region)} icon={<MapPinned size={15} />}>
          <option value="all">All regions</option>
          {REGION_ORDER.map((item) => <option key={item} value={item}>{item}</option>)}
        </Select>
        <Select value={coverage} onChange={(value) => onCoverage(value as "all" | CoverageType)} icon={<Filter size={15} />}>
          <option value="all">All coverage types</option>
          {(Object.keys(COVERAGE_LABELS) as CoverageType[]).map((item) => <option key={item} value={item}>{COVERAGE_LABELS[item]}</option>)}
        </Select>
      </div>
    </GlassCard>
  );
}

function StateDetail({ state, generatedAt, sourceModel }: { state: StateCoverage | null; generatedAt: string; sourceModel: string }) {
  if (!state) {
    return (
      <GlassCard className="p-6">
        <p className="text-sm text-cyan-100/45">Select a state to inspect its source record.</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-100/35">Selected jurisdiction</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">{state.name}</h2>
          <p className="mt-1 text-xs text-cyan-100/40">{state.region} · {state.code}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[10px] font-bold ${COVERAGE_TONES[state.coverageType]}`}>
          {COVERAGE_LABELS[state.coverageType]}
        </span>
      </div>

      <div className="mt-5 rounded-3xl border border-cyan-100/10 bg-white/[0.025] p-4">
        <p className="text-xs leading-6 text-cyan-100/58">{state.coverageNotes}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-cyan-100/35">
          <span className="rounded-full border border-cyan-100/10 px-2.5 py-1">{state.reviewStatus === "indexed-pending-review" ? "Indexed · verification pending" : "Not indexed"}</span>
          <span className="rounded-full border border-cyan-100/10 px-2.5 py-1">{state.freshness}</span>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {state.sources.map((source) => (
          <article key={`${state.code}-${source.name}`} className="rounded-3xl border border-cyan-100/10 bg-[#020817]/55 p-4 transition hover:border-cyan-200/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-cyan-50">{source.name}</p>
                <p className="mt-1 text-[11px] leading-5 text-cyan-100/42">{source.agency}</p>
              </div>
              <a href={source.url} target="_blank" rel="noreferrer" className="rounded-xl border border-cyan-100/12 p-2 text-cyan-100/50 transition hover:bg-cyan-200/10 hover:text-cyan-50" aria-label={`Open ${source.name}`}>
                <ExternalLink size={15} />
              </a>
            </div>
            <p className="mt-3 text-xs leading-6 text-cyan-100/52">{source.publicationNote}</p>
            <span className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${COVERAGE_TONES[source.type]}`}>{COVERAGE_LABELS[source.type]}</span>
          </article>
        ))}

        {state.sources.length === 0 && (
          <div className="rounded-3xl border border-dashed border-cyan-100/12 px-4 py-8 text-center">
            <FileQuestion className="mx-auto h-7 w-7 text-cyan-100/24" />
            <p className="mt-3 text-sm font-semibold text-cyan-100/55">No source indexed yet</p>
            <p className="mt-2 text-xs leading-6 text-cyan-100/36">This is a research backlog state, not a conclusion that public information is unavailable.</p>
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-cyan-100/8 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/35">Known limitations</p>
        <ul className="mt-3 space-y-2">
          {state.limitations.map((limitation) => (
            <li key={limitation} className="flex gap-2 text-[11px] leading-5 text-cyan-100/42">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan-200/45" />
              {limitation}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[10px] text-cyan-100/24">{sourceModel} · generated {formatTimestamp(generatedAt)}</p>
      </div>
    </GlassCard>
  );
}

function Legend() {
  return (
    <GlassCard className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="mr-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-100/35">Coverage legend</p>
        {(Object.keys(COVERAGE_LABELS) as CoverageType[]).map((type) => (
          <span key={type} className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold ${COVERAGE_TONES[type]}`}>{COVERAGE_LABELS[type]}</span>
        ))}
      </div>
      <p className="mt-4 text-xs leading-6 text-cyan-100/40">
        Coverage categories describe the type of source currently indexed by Insight Hub, not the completeness, accessibility, quality, or legal significance of any state’s workers’ compensation data.
      </p>
    </GlassCard>
  );
}

function HeroPrinciple({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) {
  return (
    <div className="rounded-3xl border border-cyan-100/10 bg-white/[0.035] p-4 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 text-cyan-100/55">
        <span className="rounded-2xl border border-cyan-100/10 bg-[#020817]/60 p-2">{icon}</span>
        <span className="text-[9px] font-bold uppercase tracking-[0.2em]">{label}</span>
      </div>
      <p className="mt-4 text-xl font-black tracking-tight text-white">{value}</p>
      <p className="mt-2 text-[11px] leading-5 text-cyan-100/38">{note}</p>
    </div>
  );
}

function Select({ value, onChange, icon, children }: { value: string; onChange: (value: string) => void; icon: ReactNode; children: ReactNode }) {
  return (
    <label className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cyan-100/35">{icon}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full appearance-none rounded-2xl border border-cyan-100/12 bg-[#020817]/70 pl-10 pr-8 text-sm text-cyan-50 outline-none transition focus:border-cyan-200/30">
        {children}
      </select>
    </label>
  );
}
