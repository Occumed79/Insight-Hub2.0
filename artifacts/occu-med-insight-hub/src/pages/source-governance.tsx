import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Database,
  ExternalLink,
  Filter,
  KeyRound,
  Layers3,
  Loader2,
  Network,
  RefreshCw,
  Search,
  ServerCog,
  ShieldCheck,
  Waypoints,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import {
  ConfidenceBadge,
  GovernanceMetric,
  GovernancePill,
  SourceStateBadge,
} from "@/components/insight/SourceGovernancePrimitives";
import {
  loadSourceGovernance,
  type GovernedSource,
  type GovernedSourceCategory,
  type GovernedSourceMode,
  type GovernedSourceState,
  type SourceGovernanceResponse,
} from "@/data/sourceGovernanceApi";

const CATEGORY_LABELS: Record<GovernedSourceCategory, string> = {
  injury: "Injury intelligence",
  occupation: "Occupation intelligence",
  entity: "Entity intelligence",
  company: "Company intelligence",
  "workers-comp": "Workers’ compensation",
  dba: "Defense Base Act",
};

const MODE_LABELS: Record<GovernedSourceMode, string> = {
  "live-api": "Live API",
  "manual-live": "Manual live",
  "cached-import": "Cached import",
  "static-index": "Static index",
  "official-workbook": "Official workbook",
};

type FilterValue<T extends string> = "all" | T;

function formatDate(value?: string): string {
  if (!value) return "No recorded run";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function SourceGovernance() {
  const [data, setData] = useState<SourceGovernanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FilterValue<GovernedSourceCategory>>("all");
  const [mode, setMode] = useState<FilterValue<GovernedSourceMode>>("all");
  const [state, setState] = useState<FilterValue<GovernedSourceState>>("all");
  const [workspace, setWorkspace] = useState("all");
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const response = await loadSourceGovernance();
      setData(response);
      setSelectedSourceId((current) => current ?? response.sources[0]?.id ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Source governance could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const workspaceOptions = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.sources.flatMap((source) => source.workspaces))).sort();
  }, [data]);

  const filteredSources = useMemo(() => {
    if (!data) return [];
    const normalizedQuery = query.trim().toLowerCase();
    return data.sources.filter((source) => {
      if (category !== "all" && source.category !== category) return false;
      if (mode !== "all" && source.mode !== mode) return false;
      if (state !== "all" && source.state !== state) return false;
      if (workspace !== "all" && !source.workspaces.includes(workspace)) return false;
      if (!normalizedQuery) return true;
      return [source.label, source.authority, source.category, source.mode, ...source.workspaces, ...source.environmentKeys]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [data, query, category, mode, state, workspace]);

  const selectedSource = filteredSources.find((source) => source.id === selectedSourceId)
    ?? filteredSources[0]
    ?? null;

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar
          eyebrow="Intelligence Operations"
          title="Source Governance Command Center"
          subtitle="One control plane for source configuration, provenance, confidence, freshness, ingestion mode, limitations, and human-review requirements across Insight Hub 2.0."
        />

        <GlassCard className="mb-6 border-amber-200/15 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <p className="text-xs leading-5 text-amber-100/70">
              This page performs no external ingestion. It displays server-side configuration state and environment-key names only—never secret values. Source confidence describes evidence fit and match quality, not truth, safety, liability, compliance, or medical necessity.
            </p>
          </div>
        </GlassCard>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[34px] border border-cyan-100/12 bg-[radial-gradient(circle_at_84%_16%,rgba(14,165,233,.20),transparent_32%),radial-gradient(circle_at_16%_82%,rgba(124,58,237,.16),transparent_36%),rgba(2,8,23,.82)] p-5 shadow-[0_30px_90px_rgba(0,0,0,.36)] backdrop-blur-2xl md:p-8"
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent,rgba(255,255,255,.035),transparent)]" />
          <div className="relative grid gap-7 xl:grid-cols-[1.15fr_.85fr]">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-cyan-100/42">Phase 6 — shared governance</p>
              <h1 className="mt-3 max-w-4xl text-3xl font-black tracking-[-0.04em] text-white md:text-5xl">
                Every source. One operating picture.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-cyan-100/55">
                Inspect which sources are ready, disabled, partial, or not configured; see how each workspace depends on them; and keep provenance, freshness, confidence, and limitations visible before interpreting any result.
              </p>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-100/20 bg-cyan-200/12 px-5 text-sm font-bold text-cyan-50 shadow-[0_0_28px_rgba(34,211,238,.10)] transition hover:bg-cyan-200/18 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {loading ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
                {loading ? "Reading source registry…" : "Refresh configuration status"}
              </button>
              {error && <p className="mt-3 text-sm text-rose-200">{error}</p>}
            </div>

            <div className="grid content-start gap-3 sm:grid-cols-2">
              <HeroPrinciple icon={<ServerCog size={18} />} label="Execution" value="Manual first" note="No cron, timers, startup jobs, or background workers" />
              <HeroPrinciple icon={<ShieldCheck size={18} />} label="Secrets" value="Server only" note="Only environment-key names appear in this view" />
              <HeroPrinciple icon={<Waypoints size={18} />} label="Failure model" value="Partial results" note="One failed source never erases successful evidence" />
              <HeroPrinciple icon={<Database size={18} />} label="Evidence" value="Provenance retained" note="Source, unit, freshness, confidence, and limits" />
            </div>
          </div>
        </motion.section>

        {data && (
          <>
            <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
              <GovernanceMetric label="Sources" value={data.summary.totalSources} note="Canonical active registry" />
              <GovernanceMetric label="Ready" value={data.summary.readySources} note="Configured and enabled" />
              <GovernanceMetric label="Partial" value={data.summary.partialSources} note="Usable with gaps" />
              <GovernanceMetric label="Disabled" value={data.summary.disabledSources} note="Intentionally off" />
              <GovernanceMetric label="Not configured" value={data.summary.notConfiguredSources} note="Required setup missing" />
              <GovernanceMetric label="Official" value={data.summary.officialSources} note="Government-origin sources" />
              <GovernanceMetric label="Manual only" value={data.summary.manualOnlySources} note="User-triggered sources" />
            </section>

            <GlassCard className="mt-6 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/40">Dependency map</p>
                  <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-white">Workspace → governed sources</h2>
                </div>
                <p className="text-xs text-cyan-100/40">Registry snapshot {formatDate(data.generatedAt)}</p>
              </div>
              <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {data.workflows.map((flow) => (
                  <div key={flow.id} className="rounded-2xl border border-cyan-100/10 bg-white/[0.035] p-4">
                    <div className="flex items-center gap-2 text-cyan-50">
                      <Network size={16} />
                      <p className="text-sm font-bold">{flow.label}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {flow.dependsOn.map((sourceId) => {
                        const source = data.sources.find((item) => item.id === sourceId);
                        if (!source) return null;
                        return (
                          <button
                            key={sourceId}
                            type="button"
                            onClick={() => {
                              setSelectedSourceId(sourceId);
                              setQuery("");
                              setCategory("all");
                              setMode("all");
                              setState("all");
                              setWorkspace("all");
                            }}
                            className="inline-flex items-center gap-1 rounded-full border border-cyan-100/12 bg-cyan-300/[0.06] px-2.5 py-1 text-[10px] text-cyan-100/70 transition hover:bg-cyan-300/12"
                          >
                            {source.label}
                            <ArrowRight size={11} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="mt-6 p-5">
              <div className="flex items-center gap-2 text-cyan-50">
                <Filter size={16} />
                <h2 className="text-sm font-bold">Filter source registry</h2>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <label className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-cyan-100/35" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search sources or keys"
                    className="h-11 w-full rounded-xl border border-cyan-100/12 bg-slate-950/45 pl-9 pr-3 text-sm text-white outline-none placeholder:text-cyan-100/25 focus:border-cyan-200/30"
                  />
                </label>
                <Select value={category} onChange={(value) => setCategory(value as FilterValue<GovernedSourceCategory>)} options={[{ value: "all", label: "All categories" }, ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))]} />
                <Select value={mode} onChange={(value) => setMode(value as FilterValue<GovernedSourceMode>)} options={[{ value: "all", label: "All ingestion modes" }, ...Object.entries(MODE_LABELS).map(([value, label]) => ({ value, label }))]} />
                <Select value={state} onChange={(value) => setState(value as FilterValue<GovernedSourceState>)} options={[{ value: "all", label: "All source states" }, { value: "ready", label: "Ready" }, { value: "partial", label: "Partial" }, { value: "disabled", label: "Disabled" }, { value: "not-configured", label: "Not configured" }]} />
                <Select value={workspace} onChange={setWorkspace} options={[{ value: "all", label: "All workspaces" }, ...workspaceOptions.map((value) => ({ value, label: value }))]} />
              </div>
            </GlassCard>

            <section className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
              <GlassCard className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/40">Registry</p>
                    <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-white">{filteredSources.length} governed source{filteredSources.length === 1 ? "" : "s"}</h2>
                  </div>
                  <Layers3 size={22} className="text-cyan-200/45" />
                </div>
                <div className="mt-4 space-y-3">
                  {filteredSources.map((source) => (
                    <SourceRow key={source.id} source={source} active={selectedSource?.id === source.id} onSelect={() => setSelectedSourceId(source.id)} />
                  ))}
                  {filteredSources.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-cyan-100/12 p-8 text-center text-sm text-cyan-100/40">
                      No governed source matches the current filters.
                    </div>
                  )}
                </div>
              </GlassCard>

              <GlassCard className="p-5">
                {selectedSource ? <SourceDetail source={selectedSource} /> : (
                  <div className="flex min-h-64 items-center justify-center text-sm text-cyan-100/40">Select a source to inspect its governance record.</div>
                )}
              </GlassCard>
            </section>

            <GlassCard className="mt-6 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/40">System-wide interpretation rules</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {Object.entries(data.governance).map(([key, value]) => (
                  <div key={key} className="rounded-2xl border border-cyan-100/10 bg-white/[0.03] p-4">
                    <p className="text-xs font-bold capitalize text-cyan-50">{key.replace(/([A-Z])/g, " $1")}</p>
                    <p className="mt-2 text-[11px] leading-5 text-cyan-100/45">{value}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          </>
        )}

        {!data && loading && (
          <GlassCard className="mt-6 flex min-h-48 items-center justify-center gap-3 text-cyan-100/55">
            <Loader2 className="h-5 w-5 animate-spin" /> Reading the canonical source registry…
          </GlassCard>
        )}
      </section>
    </main>
  );
}

function HeroPrinciple({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-cyan-100/10 bg-white/[0.035] p-4">
      <div className="flex items-center gap-2 text-cyan-200/70">{icon}<span className="text-[10px] font-semibold uppercase tracking-[0.18em]">{label}</span></div>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
      <p className="mt-1 text-[11px] leading-5 text-cyan-100/42">{note}</p>
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-xl border border-cyan-100/12 bg-slate-950/75 px-3 text-sm text-cyan-50 outline-none focus:border-cyan-200/30">
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

function SourceRow({ source, active, onSelect }: { source: GovernedSource; active: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className={`w-full rounded-2xl border p-4 text-left transition ${active ? "border-cyan-200/25 bg-cyan-300/[0.09] shadow-[0_0_30px_rgba(34,211,238,.08)]" : "border-cyan-100/10 bg-white/[0.025] hover:bg-white/[0.05]"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">{source.label}</p>
          <p className="mt-1 text-[11px] text-cyan-100/40">{source.authority}</p>
        </div>
        <SourceStateBadge state={source.state} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <GovernancePill>{CATEGORY_LABELS[source.category]}</GovernancePill>
        <GovernancePill>{MODE_LABELS[source.mode]}</GovernancePill>
        <ConfidenceBadge tier={source.confidence.tier} />
      </div>
    </button>
  );
}

function SourceDetail({ source }: { source: GovernedSource }) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/40">Source governance record</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">{source.label}</h2>
          <p className="mt-1 text-xs text-cyan-100/45">{source.authority}</p>
        </div>
        <SourceStateBadge state={source.state} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Detail label="Category" value={CATEGORY_LABELS[source.category]} />
        <Detail label="Ingestion mode" value={MODE_LABELS[source.mode]} />
        <Detail label="Evidence unit" value={source.provenance.evidenceUnit} />
        <Detail label="Freshness policy" value={source.freshness.policy} />
        <Detail label="Last known run" value={formatDate(source.freshness.lastKnown)} />
        <Detail label="Internal endpoint" value={source.internalEndpoint} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <ConfidenceBadge tier={source.confidence.tier} />
        <GovernancePill>{source.provenance.official ? "Official source" : "Supporting source"}</GovernancePill>
        <GovernancePill>{source.provenance.serverSide ? "Server-side" : "Client-side"}</GovernancePill>
        <GovernancePill>{source.provenance.reviewRequired ? "Human review required" : "Review optional"}</GovernancePill>
      </div>
      <p className="mt-3 text-xs leading-6 text-cyan-100/50">{source.confidence.rationale}</p>

      <section className="mt-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/40">Environment keys</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {source.environmentKeys.length > 0 ? source.environmentKeys.map((key) => (
            <GovernancePill key={key} className="font-mono"><KeyRound size={11} className="mr-1" />{key}</GovernancePill>
          )) : <GovernancePill>No secret or configuration key required</GovernancePill>}
        </div>
      </section>

      <section className="mt-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/40">Responsible workspaces</p>
        <div className="mt-2 flex flex-wrap gap-2">{source.workspaces.map((item) => <GovernancePill key={item}>{item}</GovernancePill>)}</div>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2">
        <ListBlock title="Limitations" items={source.limitations} />
        <ListBlock title="Safeguards" items={source.safeguards} />
      </section>

      <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-cyan-200/80 hover:text-cyan-100">
        Open official/source reference <ExternalLink size={14} />
      </a>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-cyan-100/10 bg-white/[0.025] p-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-100/35">{label}</p>
      <p className="mt-1 break-words text-xs leading-5 text-cyan-50/80">{value}</p>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-cyan-100/10 bg-white/[0.025] p-4">
      <p className="text-xs font-bold text-cyan-50">{title}</p>
      <ul className="mt-3 space-y-2 text-[11px] leading-5 text-cyan-100/45">
        {items.map((item) => <li key={item} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan-200/50" />{item}</li>)}
      </ul>
    </div>
  );
}
