import { useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleOff,
  Clock3,
  Database,
  ExternalLink,
  FileSearch,
  Filter,
  Gavel,
  Landmark,
  Loader2,
  MapPin,
  Radar,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import {
  runCompanyLiveIntelligence,
  type CompanyLiveResponse,
  type CompanyLiveSignal,
  type CompanyLiveSourceStatus,
  type LiveSignalCategory,
  type LiveSourceName,
} from "@/data/companyLiveIntelligenceApi";

const LIVE_WARNING =
  "Company Live Intelligence is a manual research workspace. Source results may be incomplete, delayed, ambiguous, or unrelated to the searched employer and require human review. Litigation references do not establish liability or wrongdoing, and federal awards do not establish occupational risk.";

const CATEGORY_LABELS: Record<LiveSignalCategory, string> = {
  entity: "Entity identity",
  filing: "SEC filing",
  litigation: "Legal reference",
  "federal-award": "Federal footprint",
};

const CATEGORY_ICONS: Record<LiveSignalCategory, ReactNode> = {
  entity: <Building2 size={16} />,
  filing: <FileSearch size={16} />,
  litigation: <Gavel size={16} />,
  "federal-award": <Landmark size={16} />,
};

type ConfidenceFilter = "all" | "high" | "moderate" | "review";
type SourceFilter = "all" | LiveSourceName;
type CategoryFilter = "all" | LiveSignalCategory;

function confidenceBucket(value: number): Exclude<ConfidenceFilter, "all"> {
  if (value >= 0.75) return "high";
  if (value >= 0.55) return "moderate";
  return "review";
}

function confidenceTone(value: number): string {
  if (value >= 0.75) return "border-emerald-200/20 bg-emerald-300/10 text-emerald-100";
  if (value >= 0.55) return "border-amber-200/20 bg-amber-300/10 text-amber-100";
  return "border-rose-200/20 bg-rose-300/10 text-rose-100";
}

function sourceStateTone(state: CompanyLiveSourceStatus["state"]): string {
  if (state === "success") return "border-emerald-200/20 bg-emerald-300/10 text-emerald-100";
  if (state === "empty") return "border-cyan-200/15 bg-cyan-300/[0.07] text-cyan-100";
  if (state === "disabled") return "border-slate-200/10 bg-slate-300/[0.05] text-slate-300";
  return "border-rose-200/20 bg-rose-300/10 text-rose-100";
}

function categoryTone(category: LiveSignalCategory): string {
  if (category === "entity") return "border-cyan-200/20 bg-cyan-300/10 text-cyan-100";
  if (category === "filing") return "border-violet-200/20 bg-violet-300/10 text-violet-100";
  if (category === "litigation") return "border-amber-200/20 bg-amber-300/10 text-amber-100";
  return "border-emerald-200/20 bg-emerald-300/10 text-emerald-100";
}

function formatDate(value?: string): string {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatMetric(value: string | number): string {
  if (typeof value === "number") {
    if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return value.toLocaleString();
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDate(value);
  return value;
}

function titleCase(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function CompanyLiveIntelligence() {
  const [companyName, setCompanyName] = useState("");
  const [state, setState] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompanyLiveResponse | null>(null);
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("all");

  const filteredSignals = useMemo(() => {
    if (!result) return [];
    return result.signals.filter((signal) => {
      if (sourceFilter !== "all" && signal.source !== sourceFilter) return false;
      if (categoryFilter !== "all" && signal.category !== categoryFilter) return false;
      if (confidenceFilter !== "all" && confidenceBucket(signal.confidence) !== confidenceFilter) return false;
      return true;
    });
  }, [result, sourceFilter, categoryFilter, confidenceFilter]);

  const selectedSignal = filteredSignals.find((signal) => signal.id === selectedSignalId)
    ?? filteredSignals[0]
    ?? null;

  const sourceNames = useMemo(
    () => result ? result.sources.map((sourceStatus) => sourceStatus.source) : [],
    [result],
  );

  async function runScan(): Promise<void> {
    const company = companyName.trim();
    if (!company) {
      setError("Enter a company, legal entity, or DBA name.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedSignalId(null);
    setSourceFilter("all");
    setCategoryFilter("all");
    setConfidenceFilter("all");

    try {
      const response = await runCompanyLiveIntelligence({
        companyName: company,
        state: state.trim().toUpperCase() || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      setResult(response);
      setSelectedSignalId(response.signals[0]?.id ?? null);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "The live company scan could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar
          eyebrow="Employer Intelligence"
          title="Company Live Intelligence"
          subtitle="Manually scan supported live sources for current company identity, filing, legal-reference, and federal-footprint signals with visible provenance and source health."
        />

        <GlassCard className="mb-6 border-amber-200/15 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <p className="text-xs leading-5 text-amber-100/70">{LIVE_WARNING}</p>
          </div>
        </GlassCard>

        <motion.section
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[34px] border border-cyan-100/12 bg-[radial-gradient(circle_at_82%_18%,rgba(99,102,241,.20),transparent_34%),radial-gradient(circle_at_18%_78%,rgba(8,145,178,.18),transparent_36%),rgba(2,8,23,.80)] p-5 shadow-[0_30px_90px_rgba(0,0,0,.36)] backdrop-blur-2xl md:p-8"
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent,rgba(255,255,255,.035),transparent)]" />
          <div className="relative grid gap-7 xl:grid-cols-[1.15fr_.85fr]">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-cyan-100/42">Manual source ingestion</p>
              <h1 className="mt-3 max-w-4xl text-3xl font-black tracking-[-0.04em] text-white md:text-5xl">
                Press once. See exactly which live sources answered.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-cyan-100/55">
                Nothing runs on a timer. Every source request begins only when you launch a scan, and partial failures remain visible instead of erasing successful evidence.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Company / DBA" value={companyName} onChange={setCompanyName} placeholder="Example: V2X" />
                <Field label="State filter" value={state} onChange={setState} placeholder="Example: VA" maxLength={2} />
                <DateField label="Award period start" value={fromDate} onChange={setFromDate} />
                <DateField label="Award period end" value={toDate} onChange={setToDate} />
              </div>

              <button
                type="button"
                onClick={() => void runScan()}
                disabled={loading || !companyName.trim()}
                className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-100/20 bg-cyan-200/12 px-5 text-sm font-bold text-cyan-50 shadow-[0_0_28px_rgba(34,211,238,.10)] transition hover:bg-cyan-200/18 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {loading ? <Loader2 size={17} className="animate-spin" /> : result ? <RefreshCw size={17} /> : <Search size={17} />}
                {loading ? "Running manual source scan…" : result ? "Run live scan again" : "Run live company scan"}
              </button>

              {error && <p className="mt-3 text-sm text-rose-200">{error}</p>}
            </div>

            <div className="grid content-start gap-3 sm:grid-cols-2">
              <HeroPrinciple icon={<Radar size={18} />} label="Trigger" value="Manual only" note="No cron, startup job, timer, or unattended refresh" />
              <HeroPrinciple icon={<Database size={18} />} label="Sources" value="4 adapters" note="SAM, SEC, CourtListener, and USAspending" />
              <HeroPrinciple icon={<ShieldCheck size={18} />} label="Evidence" value="Provenance first" note="Configuration, latency, confidence, freshness, and limits" />
              <HeroPrinciple icon={<Sparkles size={18} />} label="Output" value="Research signals" note="Never a safety, liability, or compliance determination" />
            </div>
          </div>
        </motion.section>

        {!result && !loading && (
          <GlassCard className="mt-6 p-8 text-center">
            <Radar className="mx-auto h-9 w-9 text-cyan-200/35" />
            <p className="mt-3 text-sm font-semibold text-cyan-50">Ready for a manual live-source run</p>
            <p className="mx-auto mt-2 max-w-2xl text-xs leading-6 text-cyan-100/45">
              Company name is required. State and date range narrow USAspending context without changing SAM, SEC, or CourtListener interpretation.
            </p>
          </GlassCard>
        )}

        {result && (
          <div className="mt-8 space-y-8">
            <RunSummary result={result} />
            <SourceHealthRail sources={result.sources} />
            <FilterBar
              sources={sourceNames}
              sourceFilter={sourceFilter}
              onSourceChange={setSourceFilter}
              categoryFilter={categoryFilter}
              onCategoryChange={setCategoryFilter}
              confidenceFilter={confidenceFilter}
              onConfidenceChange={setConfidenceFilter}
            />

            {filteredSignals.length > 0 ? (
              <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
                <SignalStream
                  signals={filteredSignals}
                  selectedId={selectedSignal?.id ?? null}
                  onSelect={setSelectedSignalId}
                />
                <SignalEvidence signal={selectedSignal} />
              </section>
            ) : (
              <GlassCard className="p-8 text-center">
                <CircleOff className="mx-auto h-8 w-8 text-cyan-100/30" />
                <p className="mt-3 text-sm font-semibold text-cyan-50">No signals match the current filters</p>
                <p className="mt-2 text-xs text-cyan-100/42">Change a source, category, or confidence filter to restore the live result stream.</p>
              </GlassCard>
            )}

            <WarningsPanel result={result} />
          </div>
        )}

        <footer className="mt-10 border-t border-cyan-100/10 pt-4">
          <p className="text-[10px] leading-5 text-cyan-100/35">
            Live company sources are called through Insight Hub’s server-side adapters only. No private key is exposed to the browser. USAspending is used only for company footprint context and not as procurement, solicitation, or injury data.
          </p>
        </footer>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/42">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="mt-2 min-h-12 w-full rounded-2xl border border-cyan-100/12 bg-black/20 px-4 text-sm text-cyan-50 outline-none transition placeholder:text-cyan-100/25 focus:border-cyan-200/30 focus:bg-black/28"
      />
    </label>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/42">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-12 w-full rounded-2xl border border-cyan-100/12 bg-black/20 px-4 text-sm text-cyan-50 outline-none transition focus:border-cyan-200/30 focus:bg-black/28"
      />
    </label>
  );
}

function HeroPrinciple({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) {
  return (
    <div className="rounded-3xl border border-cyan-100/10 bg-white/[0.035] p-4 backdrop-blur-xl">
      <div className="flex items-center justify-between text-cyan-100/50">
        {icon}
        <span className="text-[9px] uppercase tracking-[0.2em]">{label}</span>
      </div>
      <p className="mt-4 text-xl font-black text-white">{value}</p>
      <p className="mt-2 text-[11px] leading-5 text-cyan-100/42">{note}</p>
    </div>
  );
}

function RunSummary({ result }: { result: CompanyLiveResponse }) {
  const highConfidence = result.signals.filter((signal) => signal.confidence >= 0.75).length;
  const datedSignals = result.signals.filter((signal) => signal.occurredAt).length;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-100/42">Manual run complete</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.03em] text-white">{result.companyName}</h2>
          <p className="mt-2 text-xs text-cyan-100/45">
            {result.state ? `${result.state} filter · ` : ""}Run ID {result.runId}
          </p>
        </div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/30">
          {new Date(result.executedAt).toLocaleString()}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard icon={<Radar size={17} />} label="Signals" value={String(result.summary.signalCount)} note="Normalized source records" />
        <MetricCard icon={<CheckCircle2 size={17} />} label="Sources answered" value={String(result.summary.successfulSources)} note={`${result.summary.attemptedSources} enabled`} />
        <MetricCard icon={<XCircle size={17} />} label="Source failures" value={String(result.summary.failedSources)} note="Visible, never silently dropped" />
        <MetricCard icon={<CircleOff size={17} />} label="Disabled" value={String(result.summary.disabledSources)} note="Missing configuration or source toggle" />
        <MetricCard icon={<ShieldCheck size={17} />} label="High confidence" value={String(highConfidence)} note="Name/source match ≥ 75%" />
        <MetricCard icon={<CalendarClock size={17} />} label="Dated records" value={String(datedSignals)} note="Timeline-ready signals" />
      </div>
    </section>
  );
}

function MetricCard({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between text-cyan-100/42">
        {icon}
        <span className="text-[9px] uppercase tracking-[0.18em]">{label}</span>
      </div>
      <p className="mt-4 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-[10px] leading-4 text-cyan-100/38">{note}</p>
    </GlassCard>
  );
}

function SourceHealthRail({ sources }: { sources: CompanyLiveSourceStatus[] }) {
  return (
    <section>
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-100/42">Source health</p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.03em] text-white">Every connector reports its own outcome.</h2>
      </div>
      <div className="grid gap-4 xl:grid-cols-4">
        {sources.map((sourceStatus) => (
          <GlassCard key={sourceStatus.source} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-cyan-50">{sourceStatus.source}</p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.16em] text-cyan-100/32">{sourceStatus.freshness}</p>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${sourceStateTone(sourceStatus.state)}`}>
                {sourceStatus.state}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <SmallMetric label="Results" value={String(sourceStatus.resultCount)} />
              <SmallMetric label="Latency" value={sourceStatus.enabled ? `${sourceStatus.latencyMs} ms` : "—"} />
            </div>
            <p className="mt-4 text-[11px] leading-5 text-cyan-100/46">{sourceStatus.limitation}</p>
            {sourceStatus.error && <p className="mt-3 text-[10px] leading-5 text-amber-100/55">{sourceStatus.error}</p>}
            <a
              href={sourceStatus.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1 text-[10px] text-cyan-200/45 hover:text-cyan-100"
            >
              Source information <ExternalLink size={10} />
            </a>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-cyan-100/8 bg-white/[0.025] p-3">
      <p className="text-[8px] uppercase tracking-[0.16em] text-cyan-100/32">{label}</p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function FilterBar({
  sources,
  sourceFilter,
  onSourceChange,
  categoryFilter,
  onCategoryChange,
  confidenceFilter,
  onConfidenceChange,
}: {
  sources: LiveSourceName[];
  sourceFilter: SourceFilter;
  onSourceChange: (value: SourceFilter) => void;
  categoryFilter: CategoryFilter;
  onCategoryChange: (value: CategoryFilter) => void;
  confidenceFilter: ConfidenceFilter;
  onConfidenceChange: (value: ConfidenceFilter) => void;
}) {
  return (
    <GlassCard className="p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-h-11 items-center gap-2 rounded-2xl border border-cyan-100/10 bg-white/[0.025] px-4 text-xs text-cyan-100/55">
          <Filter size={14} />
          Filter live signals
        </div>
        <SelectField label="Source" value={sourceFilter} onChange={(value) => onSourceChange(value as SourceFilter)}>
          <option value="all">All sources</option>
          {sources.map((source) => <option key={source} value={source}>{source}</option>)}
        </SelectField>
        <SelectField label="Category" value={categoryFilter} onChange={(value) => onCategoryChange(value as CategoryFilter)}>
          <option value="all">All categories</option>
          {(Object.keys(CATEGORY_LABELS) as LiveSignalCategory[]).map((category) => (
            <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>
          ))}
        </SelectField>
        <SelectField label="Confidence" value={confidenceFilter} onChange={(value) => onConfidenceChange(value as ConfidenceFilter)}>
          <option value="all">All confidence</option>
          <option value="high">High</option>
          <option value="moderate">Moderate</option>
          <option value="review">Needs review</option>
        </SelectField>
      </div>
    </GlassCard>
  );
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className="min-w-44 flex-1">
      <span className="text-[9px] uppercase tracking-[0.16em] text-cyan-100/32">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-11 w-full rounded-2xl border border-cyan-100/10 bg-[#07101f] px-3 text-xs text-cyan-50 outline-none focus:border-cyan-200/25"
      >
        {children}
      </select>
    </label>
  );
}

function SignalStream({ signals, selectedId, onSelect }: { signals: CompanyLiveSignal[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <section className="overflow-hidden rounded-[34px] border border-cyan-100/12 bg-[radial-gradient(circle_at_18%_20%,rgba(14,165,233,.12),transparent_32%),rgba(3,7,18,.72)] p-5 shadow-[0_30px_90px_rgba(0,0,0,.28)] md:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-100/42">Live signal stream</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">Observed records, newest first.</h2>
        </div>
        <span className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/30">{signals.length} visible</span>
      </div>

      <div className="relative mt-6 space-y-3 before:absolute before:bottom-3 before:left-[22px] before:top-3 before:w-px before:bg-gradient-to-b before:from-cyan-200/35 before:via-violet-200/20 before:to-transparent">
        {signals.map((signal, index) => {
          const selected = signal.id === selectedId;
          return (
            <motion.button
              type="button"
              key={signal.id}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: Math.min(index * 0.035, 0.3) }}
              onClick={() => onSelect(signal.id)}
              className={`relative block w-full rounded-3xl border p-4 pl-14 text-left transition ${selected ? "border-cyan-200/30 bg-cyan-200/[0.09] shadow-[0_0_34px_rgba(34,211,238,.10)]" : "border-cyan-100/8 bg-white/[0.025] hover:border-cyan-100/16 hover:bg-white/[0.045]"}`}
            >
              <span className={`absolute left-3 top-4 flex h-9 w-9 items-center justify-center rounded-2xl border ${categoryTone(signal.category)}`}>
                {CATEGORY_ICONS[signal.category]}
              </span>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.13em] ${categoryTone(signal.category)}`}>
                      {CATEGORY_LABELS[signal.category]}
                    </span>
                    <span className="text-[9px] uppercase tracking-[0.15em] text-cyan-100/32">{signal.source}</span>
                  </div>
                  <p className="mt-3 font-bold leading-6 text-cyan-50">{signal.title}</p>
                  <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-cyan-100/48">{signal.summary}</p>
                </div>
                <div className="text-right">
                  <span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${confidenceTone(signal.confidence)}`}>
                    {Math.round(signal.confidence * 100)}%
                  </span>
                  <p className="mt-2 text-[9px] uppercase tracking-[0.12em] text-cyan-100/28">{formatDate(signal.occurredAt)}</p>
                </div>
              </div>
              {signal.geography && (
                <p className="mt-3 flex items-center gap-1.5 text-[10px] text-cyan-100/38">
                  <MapPin size={11} /> {signal.geography}
                </p>
              )}
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

function SignalEvidence({ signal }: { signal: CompanyLiveSignal | null }) {
  if (!signal) {
    return (
      <GlassCard className="p-7">
        <CircleOff className="h-7 w-7 text-cyan-100/30" />
        <p className="mt-3 text-sm text-cyan-100/45">Select a live signal to inspect its evidence.</p>
      </GlassCard>
    );
  }

  const identifiers = Object.entries(signal.identifiers);
  const metrics = Object.entries(signal.metrics);

  return (
    <GlassCard className="sticky top-6 self-start p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.26em] text-cyan-100/38">Evidence detail</p>
          <h3 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">{signal.title}</h3>
        </div>
        <span className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold ${confidenceTone(signal.confidence)}`}>
          {Math.round(signal.confidence * 100)}% confidence
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] ${categoryTone(signal.category)}`}>
          {CATEGORY_ICONS[signal.category]} {CATEGORY_LABELS[signal.category]}
        </span>
        <span className="rounded-full border border-cyan-100/10 bg-white/[0.025] px-3 py-1.5 text-[10px] text-cyan-100/50">{signal.source}</span>
      </div>

      <p className="mt-5 text-sm leading-7 text-cyan-100/58">{signal.summary}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <EvidenceDatum icon={<Clock3 size={14} />} label="Observed date" value={formatDate(signal.occurredAt)} />
        <EvidenceDatum icon={<MapPin size={14} />} label="Geography" value={signal.geography || "Not returned"} />
      </div>

      {identifiers.length > 0 && (
        <EvidenceSection title="Identifiers">
          <div className="grid gap-2 sm:grid-cols-2">
            {identifiers.map(([key, value]) => <EvidenceDatum key={key} label={titleCase(key)} value={value} />)}
          </div>
        </EvidenceSection>
      )}

      {metrics.length > 0 && (
        <EvidenceSection title="Returned metrics">
          <div className="grid gap-2 sm:grid-cols-2">
            {metrics.map(([key, value]) => <EvidenceDatum key={key} label={titleCase(key)} value={formatMetric(value)} />)}
          </div>
        </EvidenceSection>
      )}

      <EvidenceSection title="Evidence fields">
        <div className="flex flex-wrap gap-2">
          {signal.evidenceFields.map((field) => (
            <span key={field} className="rounded-full border border-cyan-100/9 bg-white/[0.025] px-2.5 py-1 text-[10px] text-cyan-100/48">{field}</span>
          ))}
        </div>
      </EvidenceSection>

      <a
        href={signal.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-2xl border border-cyan-100/14 bg-cyan-200/[0.07] px-4 text-xs font-semibold text-cyan-100/70 hover:bg-cyan-200/[0.12] hover:text-cyan-50"
      >
        Open source <ExternalLink size={13} />
      </a>
    </GlassCard>
  );
}

function EvidenceSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6 border-t border-cyan-100/8 pt-5">
      <p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-100/34">{title}</p>
      {children}
    </div>
  );
}

function EvidenceDatum({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-cyan-100/8 bg-white/[0.025] p-3">
      <div className="flex items-center gap-2 text-cyan-100/35">
        {icon}
        <p className="text-[8px] uppercase tracking-[0.15em]">{label}</p>
      </div>
      <p className="mt-2 break-words text-xs leading-5 text-cyan-50/72">{value}</p>
    </div>
  );
}

function WarningsPanel({ result }: { result: CompanyLiveResponse }) {
  const notes = [...new Set([...result.warnings, result.limitation])];
  return (
    <section>
      <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-100/42">Interpretation and source notes</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {notes.map((note) => (
          <GlassCard key={note} className="border-amber-200/12 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/75" />
              <p className="text-[11px] leading-6 text-amber-100/55">{note}</p>
            </div>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
