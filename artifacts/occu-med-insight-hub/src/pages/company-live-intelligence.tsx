import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleOff,
  ExternalLink,
  FileSearch,
  Gavel,
  Landmark,
  Loader2,
  MapPin,
  Radar,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
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

const SESSION_COMPANY_KEY = "insight-hub.corporate-signals.company";

const CATEGORY_LABELS: Record<LiveSignalCategory, string> = {
  entity: "Entity identity",
  filing: "Regulatory filing",
  litigation: "Legal reference",
  "federal-award": "Federal footprint",
};

const REQUIRED_WARNING =
  "Corporate Signals is a public-source research tool. Results can be incomplete, delayed, ambiguous, or unrelated to the searched organization. Legal references do not establish wrongdoing or liability, federal awards do not establish current operations, and source matches require human review.";

type SourceFilter = "all" | LiveSourceName;
type CategoryFilter = "all" | LiveSignalCategory;
type ConfidenceFilter = "all" | "high" | "moderate" | "review";

function confidenceBand(value: number): Exclude<ConfidenceFilter, "all"> {
  if (value >= 0.75) return "high";
  if (value >= 0.55) return "moderate";
  return "review";
}

function confidenceTone(value: number): string {
  if (value >= 0.75) return "border-emerald-200/20 bg-emerald-300/10 text-emerald-100";
  if (value >= 0.55) return "border-amber-200/20 bg-amber-300/10 text-amber-100";
  return "border-rose-200/20 bg-rose-300/10 text-rose-100";
}

function sourceTone(state: CompanyLiveSourceStatus["state"]): string {
  if (state === "success") return "border-emerald-200/20 bg-emerald-300/10 text-emerald-100";
  if (state === "empty") return "border-cyan-200/15 bg-cyan-300/[0.07] text-cyan-100";
  if (state === "disabled") return "border-slate-200/10 bg-slate-300/[0.05] text-slate-300";
  return "border-rose-200/20 bg-rose-300/10 text-rose-100";
}

function categoryIcon(category: LiveSignalCategory) {
  if (category === "entity") return <Building2 size={16} />;
  if (category === "filing") return <FileSearch size={16} />;
  if (category === "litigation") return <Gavel size={16} />;
  return <Landmark size={16} />;
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
    if (Math.abs(value) >= 1_000) return value.toLocaleString();
    return String(value);
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDate(value);
  return value;
}

function humanize(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sortSignals(signals: CompanyLiveSignal[]): CompanyLiveSignal[] {
  return [...signals].sort((left, right) => {
    const leftTime = left.occurredAt ? new Date(left.occurredAt).getTime() : 0;
    const rightTime = right.occurredAt ? new Date(right.occurredAt).getTime() : 0;
    return rightTime - leftTime || right.confidence - left.confidence;
  });
}

function buildTimeline(signals: CompanyLiveSignal[]): Array<{ month: string; count: number }> {
  const counts = new Map<string, number>();
  for (const signal of signals) {
    if (!signal.occurredAt) continue;
    const date = new Date(signal.occurredAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-18)
    .map(([key, count]) => {
      const [year, month] = key.split("-").map(Number);
      return {
        month: new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
        count,
      };
    });
}

export default function CorporateSignals() {
  const [companyName, setCompanyName] = useState(() => sessionStorage.getItem(SESSION_COMPANY_KEY) ?? "");
  const [state, setState] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompanyLiveResponse | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("all");
  const [selectedSignal, setSelectedSignal] = useState<CompanyLiveSignal | null>(null);

  const filteredSignals = useMemo(() => {
    if (!result) return [];
    return sortSignals(result.signals.filter((signal) => {
      if (sourceFilter !== "all" && signal.source !== sourceFilter) return false;
      if (categoryFilter !== "all" && signal.category !== categoryFilter) return false;
      if (confidenceFilter !== "all" && confidenceBand(signal.confidence) !== confidenceFilter) return false;
      return true;
    }));
  }, [result, sourceFilter, categoryFilter, confidenceFilter]);

  const timeline = useMemo(() => buildTimeline(filteredSignals), [filteredSignals]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<LiveSignalCategory, number>();
    for (const signal of filteredSignals) counts.set(signal.category, (counts.get(signal.category) ?? 0) + 1);
    return (Object.keys(CATEGORY_LABELS) as LiveSignalCategory[]).map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      count: counts.get(category) ?? 0,
    }));
  }, [filteredSignals]);

  const geographyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const signal of filteredSignals) {
      if (!signal.geography) continue;
      counts.set(signal.geography, (counts.get(signal.geography) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [filteredSignals]);

  async function runScan(): Promise<void> {
    const company = companyName.trim();
    if (!company) {
      setError("Enter a company, legal entity, or DBA name.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedSignal(null);
    sessionStorage.setItem(SESSION_COMPANY_KEY, company);

    try {
      const response = await runCompanyLiveIntelligence({
        companyName: company,
        state: state.trim().toUpperCase() || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      setResult(response);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "The corporate signal scan could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-10">
        <HeaderBar
          eyebrow="Public company research"
          title="Corporate Signals"
          subtitle="Scan current public sources for identity, regulatory, legal-reference, and federal-footprint signals in one evidence-first timeline."
        />

        <GlassCard className="mt-5 border-amber-200/15 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <p className="text-xs leading-5 text-amber-100/70">{REQUIRED_WARNING}</p>
          </div>
        </GlassCard>

        <GlassCard className="mt-5 p-5">
          <div className="grid gap-3 lg:grid-cols-[1.4fr_.45fr_.6fr_.6fr_auto]">
            <Field label="Company / DBA" value={companyName} onChange={setCompanyName} placeholder="Enter a public company name" />
            <Field label="State" value={state} onChange={setState} placeholder="VA" maxLength={2} />
            <DateField label="Award start" value={fromDate} onChange={setFromDate} />
            <DateField label="Award end" value={toDate} onChange={setToDate} />
            <button
              type="button"
              onClick={() => void runScan()}
              disabled={loading || !companyName.trim()}
              className="mt-[22px] inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-100/20 bg-cyan-200/12 px-5 text-sm font-bold text-cyan-50 transition hover:bg-cyan-200/18 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : result ? <RefreshCw size={16} /> : <Search size={16} />}
              {loading ? "Scanning…" : result ? "Run again" : "Run scan"}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-rose-200">{error}</p>}
        </GlassCard>

        {!result && !loading && (
          <GlassCard className="mt-5 p-10 text-center">
            <Radar className="mx-auto h-10 w-10 text-cyan-200/35" />
            <p className="mt-3 text-sm font-semibold text-cyan-50">Ready for a manual corporate signal scan</p>
            <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-cyan-100/45">
              The scan runs only when you press the button. Each source reports its own status, result count, freshness, and limitations.
            </p>
          </GlassCard>
        )}

        {result && (
          <div className="mt-5 space-y-5">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Metric label="Signals" value={result.summary.signalCount} note="Returned before filters" />
              <Metric label="Sources answered" value={result.summary.successfulSources} note={`of ${result.summary.attemptedSources} attempted`} />
              <Metric label="Dated signals" value={result.signals.filter((signal) => signal.occurredAt).length} note="Timeline-ready evidence" />
              <Metric label="Geographies" value={new Set(result.signals.map((signal) => signal.geography).filter(Boolean)).size} note="Distinct reported locations" />
              <Metric label="Run time" value={formatDate(result.executedAt)} note="Manual execution" compact />
            </section>

            <SourceHealth sources={result.sources} />

            <GlassCard className="p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Select label="Source" value={sourceFilter} onChange={(value) => setSourceFilter(value as SourceFilter)} options={["all", ...result.sources.map((source) => source.source)]} />
                <Select label="Signal type" value={categoryFilter} onChange={(value) => setCategoryFilter(value as CategoryFilter)} options={["all", ...Object.keys(CATEGORY_LABELS)]} />
                <Select label="Confidence" value={confidenceFilter} onChange={(value) => setConfidenceFilter(value as ConfidenceFilter)} options={["all", "high", "moderate", "review"]} />
              </div>
            </GlassCard>

            <section className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
              <GlassCard className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/40">Signal timeline</p>
                    <h2 className="mt-1 text-lg font-bold text-white">When public signals appeared</h2>
                  </div>
                  <CalendarDays className="text-cyan-200/45" size={20} />
                </div>
                {timeline.length > 0 ? (
                  <div className="mt-5 h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={timeline} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}>
                        <CartesianGrid stroke="rgba(165,243,252,.08)" vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: "rgba(207,250,254,.48)", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fill: "rgba(207,250,254,.42)", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <RechartsTooltip contentStyle={{ background: "rgba(2,8,23,.96)", border: "1px solid rgba(165,243,252,.14)", borderRadius: 12 }} />
                        <Bar dataKey="count" fill="rgba(103,232,249,.72)" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState text="The current filtered signals do not contain usable dates." />
                )}
              </GlassCard>

              <GlassCard className="p-5">
                <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/40">Signal composition</p>
                <h2 className="mt-1 text-lg font-bold text-white">What the scan found</h2>
                <div className="mt-5 divide-y divide-cyan-100/8">
                  {categoryCounts.map((item) => (
                    <button
                      type="button"
                      key={item.category}
                      onClick={() => setCategoryFilter(item.category)}
                      className="flex w-full items-center justify-between gap-3 py-3 text-left transition hover:bg-white/[0.025]"
                    >
                      <span className="flex items-center gap-3 text-sm text-cyan-50">
                        <span className="text-cyan-200/55">{categoryIcon(item.category)}</span>
                        {item.label}
                      </span>
                      <span className="text-lg font-black text-white">{item.count}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-5 border-t border-cyan-100/10 pt-4">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/35">Top reported geographies</p>
                  {geographyCounts.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {geographyCounts.map(([geography, count]) => (
                        <span key={geography} className="inline-flex items-center gap-1.5 rounded-full border border-cyan-100/12 bg-cyan-200/[0.06] px-3 py-1.5 text-xs text-cyan-100/65">
                          <MapPin size={12} /> {geography} · {count}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-cyan-100/40">No geography was reported by the filtered evidence.</p>
                  )}
                </div>
              </GlassCard>
            </section>

            <GlassCard className="overflow-hidden">
              <div className="flex items-center justify-between gap-4 border-b border-cyan-100/10 px-5 py-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/40">Evidence stream</p>
                  <h2 className="mt-1 text-lg font-bold text-white">{filteredSignals.length} matching signals</h2>
                </div>
                <Radar size={20} className="text-cyan-200/45" />
              </div>

              {filteredSignals.length > 0 ? (
                <div className="divide-y divide-cyan-100/8">
                  {filteredSignals.map((signal) => (
                    <button
                      key={signal.id}
                      type="button"
                      onClick={() => setSelectedSignal(signal)}
                      className="grid w-full gap-3 px-5 py-4 text-left transition hover:bg-cyan-200/[0.035] md:grid-cols-[130px_150px_1fr_110px] md:items-center"
                    >
                      <div>
                        <p className="text-xs font-semibold text-white">{formatDate(signal.occurredAt)}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100/35">{signal.source}</p>
                      </div>
                      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-100/12 bg-white/[0.03] px-3 py-1.5 text-xs text-cyan-100/65">
                        {categoryIcon(signal.category)} {CATEGORY_LABELS[signal.category]}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-cyan-50">{signal.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-cyan-100/45">{signal.summary}</p>
                      </div>
                      <span className={`justify-self-start rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] md:justify-self-end ${confidenceTone(signal.confidence)}`}>
                        {Math.round(signal.confidence * 100)}%
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState text="No public signals match the current filters." />
              )}
            </GlassCard>

            {(result.warnings.length > 0 || result.limitation) && (
              <GlassCard className="border-amber-200/12 p-5">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 shrink-0 text-amber-300" size={18} />
                  <div>
                    <p className="text-sm font-semibold text-amber-100">Coverage and interpretation limits</p>
                    <p className="mt-2 text-xs leading-6 text-amber-100/60">{result.limitation}</p>
                    {result.warnings.length > 0 && (
                      <ul className="mt-3 space-y-1 text-xs leading-5 text-amber-100/55">
                        {result.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
              </GlassCard>
            )}
          </div>
        )}
      </section>

      {selectedSignal && <EvidenceDrawer signal={selectedSignal} onClose={() => setSelectedSignal(null)} />}
    </main>
  );
}

function Field({ label, value, onChange, placeholder, maxLength }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; maxLength?: number }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/40">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="mt-1.5 h-11 w-full rounded-xl border border-cyan-100/12 bg-[#020817]/72 px-3 text-sm text-white outline-none placeholder:text-cyan-100/25 focus:border-cyan-200/30"
      />
    </label>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/40">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-11 w-full rounded-xl border border-cyan-100/12 bg-[#020817]/72 px-3 text-sm text-white outline-none focus:border-cyan-200/30"
      />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/40">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-cyan-100/12 bg-[#020817] px-3 text-sm text-cyan-50 outline-none">
        {options.map((option) => (
          <option key={option} value={option}>
            {option === "all" ? "All" : option in CATEGORY_LABELS ? CATEGORY_LABELS[option as LiveSignalCategory] : humanize(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function Metric({ label, value, note, compact = false }: { label: string; value: string | number; note: string; compact?: boolean }) {
  return (
    <GlassCard className="p-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/38">{label}</p>
      <p className={`mt-2 font-black text-white ${compact ? "text-base" : "text-2xl"}`}>{value}</p>
      <p className="mt-1 text-[11px] text-cyan-100/40">{note}</p>
    </GlassCard>
  );
}

function SourceHealth({ sources }: { sources: CompanyLiveSourceStatus[] }) {
  return (
    <GlassCard className="overflow-hidden">
      <div className="border-b border-cyan-100/10 px-5 py-4">
        <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/40">Source health</p>
        <h2 className="mt-1 text-lg font-bold text-white">What answered this run</h2>
      </div>
      <div className="grid gap-px bg-cyan-100/8 sm:grid-cols-2 xl:grid-cols-4">
        {sources.map((source) => (
          <div key={source.source} className="bg-[#030a18]/96 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-cyan-50">{source.source}</p>
              <span className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${sourceTone(source.state)}`}>{source.state}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-cyan-100/45">
              <span>{source.resultCount} results</span>
              <span className="text-right">{source.latencyMs} ms</span>
            </div>
            <p className="mt-3 line-clamp-2 text-[11px] leading-5 text-cyan-100/35">{source.error || source.limitation}</p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="px-5 py-10 text-center">
      <CircleOff className="mx-auto h-8 w-8 text-cyan-100/25" />
      <p className="mt-3 text-sm text-cyan-100/45">{text}</p>
    </div>
  );
}

function EvidenceDrawer({ signal, onClose }: { signal: CompanyLiveSignal; onClose: () => void }) {
  return (
    <>
      <button type="button" aria-label="Close evidence drawer" onClick={onClose} className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm" />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l border-cyan-100/14 bg-[#020817]/98 p-6 shadow-[-30px_0_90px_rgba(0,0,0,.5)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/40">{signal.source} · {CATEGORY_LABELS[signal.category]}</p>
            <h2 className="mt-2 text-xl font-black leading-tight text-white">{signal.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-cyan-100/12 p-2 text-cyan-100/55 hover:bg-white/[0.05] hover:text-white"><X size={18} /></button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] ${confidenceTone(signal.confidence)}`}>{Math.round(signal.confidence * 100)}% confidence</span>
          <span className="rounded-full border border-cyan-100/12 bg-white/[0.03] px-3 py-1.5 text-[10px] text-cyan-100/55">{formatDate(signal.occurredAt)}</span>
          {signal.geography && <span className="rounded-full border border-cyan-100/12 bg-white/[0.03] px-3 py-1.5 text-[10px] text-cyan-100/55">{signal.geography}</span>}
        </div>

        <p className="mt-6 text-sm leading-7 text-cyan-100/65">{signal.summary}</p>

        {Object.keys(signal.identifiers).length > 0 && (
          <EvidenceSection title="Identifiers">
            {Object.entries(signal.identifiers).map(([key, value]) => <EvidenceRow key={key} label={humanize(key)} value={value} />)}
          </EvidenceSection>
        )}

        {Object.keys(signal.metrics).length > 0 && (
          <EvidenceSection title="Reported metrics">
            {Object.entries(signal.metrics).map(([key, value]) => <EvidenceRow key={key} label={humanize(key)} value={formatMetric(value)} />)}
          </EvidenceSection>
        )}

        {signal.evidenceFields.length > 0 && (
          <EvidenceSection title="Fields supporting this match">
            <div className="flex flex-wrap gap-2">
              {signal.evidenceFields.map((field) => <span key={field} className="rounded-lg border border-cyan-100/10 bg-cyan-200/[0.05] px-2.5 py-1.5 text-xs text-cyan-100/55">{humanize(field)}</span>)}
            </div>
          </EvidenceSection>
        )}

        <a href={signal.sourceUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-xl border border-cyan-100/16 bg-cyan-200/[0.08] px-4 py-2.5 text-sm font-semibold text-cyan-50 hover:bg-cyan-200/[0.13]">
          Open public source <ExternalLink size={15} />
        </a>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200/12 bg-amber-300/[0.05] p-4">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-300" />
          <p className="text-xs leading-5 text-amber-100/60">This evidence is a research lead, not a verified conclusion about ownership, operations, legal responsibility, safety, or compliance.</p>
        </div>
      </aside>
    </>
  );
}

function EvidenceSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 border-t border-cyan-100/10 pt-5">
      <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-cyan-100/40">{title}</p>
      {children}
    </section>
  );
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 border-b border-cyan-100/7 py-2.5 text-xs">
      <span className="text-cyan-100/38">{label}</span>
      <span className="break-words text-cyan-50/80">{value}</span>
    </div>
  );
}
