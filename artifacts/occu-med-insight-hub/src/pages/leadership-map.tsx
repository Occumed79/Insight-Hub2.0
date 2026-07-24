import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Database,
  ExternalLink,
  FileSearch,
  Filter,
  Loader2,
  Network,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import {
  analyzeLeadershipMap,
  getSavedOrganizationalChart,
  getSavedOrganizationalCharts,
  type LeadershipConfidence,
  type LeadershipLevel,
  type LeadershipMapResponse,
  type LeadershipPerson,
  type SavedOrganizationalChart,
} from "@/data/leadershipMapApi";

const LEVEL_ORDER: LeadershipLevel[] = [
  "board",
  "executive",
  "senior-leadership",
  "director",
  "manager",
  "individual-contributor",
  "unknown",
];

const LEVEL_LABELS: Record<LeadershipLevel, string> = {
  board: "Board & Governance",
  executive: "Executive Leadership",
  "senior-leadership": "Senior Leadership",
  director: "Directors",
  manager: "Managers",
  "individual-contributor": "Publicly Identified Specialists & Analysts",
  unknown: "Unplaced / Needs Review",
};

const CONFIDENCE_LABELS: Record<LeadershipConfidence, string> = {
  confirmed: "Confirmed",
  probable: "Probable",
  inferred: "Inferred",
};

const SESSION_KEY = "insight-hub.organizational-chart.form";

type SavedForm = {
  companyName: string;
  primaryUrl: string;
  supportingUrls: string;
  secQuery: string;
};

function loadSavedForm(): SavedForm {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null") as SavedForm | null;
    return parsed || { companyName: "", primaryUrl: "", supportingUrls: "", secQuery: "" };
  } catch {
    return { companyName: "", primaryUrl: "", supportingUrls: "", secQuery: "" };
  }
}

function confidenceClass(confidence: LeadershipConfidence): string {
  if (confidence === "confirmed") return "border-emerald-200/20 bg-emerald-300/10 text-emerald-100";
  if (confidence === "probable") return "border-cyan-200/20 bg-cyan-300/10 text-cyan-100";
  return "border-amber-200/20 bg-amber-300/10 text-amber-100";
}

function levelGlow(level: LeadershipLevel): string {
  if (level === "board") return "shadow-[0_0_26px_rgba(167,139,250,.06)]";
  if (level === "executive") return "shadow-[0_0_26px_rgba(34,211,238,.07)]";
  if (level === "senior-leadership") return "shadow-[0_0_24px_rgba(52,211,153,.05)]";
  return "";
}

function PersonNode({ person, onOpen }: { person: LeadershipPerson; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group min-h-[142px] w-full rounded-[22px] border border-cyan-100/12 bg-white/[0.035] p-4 text-left backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-200/30 hover:bg-white/[0.06] ${levelGlow(person.level)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-cyan-100/12 bg-black/18">
          <UserRound className="h-4.5 w-4.5 text-cyan-200/72" />
        </div>
        <span className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${confidenceClass(person.confidence)}`}>
          {CONFIDENCE_LABELS[person.confidence]}
        </span>
      </div>
      <h3 className="mt-4 text-[15px] font-black leading-5 text-white">{person.name}</h3>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-cyan-100/62">{person.title}</p>
      <div className="mt-3 flex items-center justify-between gap-3 text-[10px] text-cyan-100/40">
        <span className="truncate">{person.department || "Department not stated"}</span>
        <ChevronRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-[105px] border-l border-cyan-100/10 pl-4 first:border-l-0 first:pl-0">
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-100/34">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  );
}

export default function LeadershipMap() {
  const savedForm = useMemo(loadSavedForm, []);
  const [companyName, setCompanyName] = useState(savedForm.companyName);
  const [primaryUrl, setPrimaryUrl] = useState(savedForm.primaryUrl);
  const [supportingUrls, setSupportingUrls] = useState(savedForm.supportingUrls);
  const [secQuery, setSecQuery] = useState(savedForm.secQuery);
  const [advancedOpen, setAdvancedOpen] = useState(Boolean(savedForm.primaryUrl || savedForm.supportingUrls || savedForm.secQuery));
  const [savedCharts, setSavedCharts] = useState<SavedOrganizationalChart[]>([]);
  const [savedSelection, setSavedSelection] = useState("");
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [result, setResult] = useState<LeadershipMapResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [confidenceFilter, setConfidenceFilter] = useState<"all" | LeadershipConfidence>("all");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  const loadSavedList = useCallback(async () => {
    setLoadingSaved(true);
    try {
      const response = await getSavedOrganizationalCharts();
      setSavedCharts(response.companies);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Saved organizational charts could not be loaded from Neon.");
    } finally {
      setLoadingSaved(false);
    }
  }, []);

  useEffect(() => {
    void loadSavedList();
  }, [loadSavedList]);

  const visiblePeople = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    return (result?.people || []).filter((person) => {
      const matchesConfidence = confidenceFilter === "all" || person.confidence === confidenceFilter;
      const matchesQuery = !lowered || [person.name, person.title, person.department, person.location]
        .some((value) => String(value || "").toLowerCase().includes(lowered));
      return matchesConfidence && matchesQuery;
    });
  }, [confidenceFilter, query, result]);

  const groupedPeople = useMemo(() => LEVEL_ORDER.map((level) => ({
    level,
    people: visiblePeople.filter((person) => person.level === level),
  })).filter((group) => group.people.length > 0), [visiblePeople]);

  const selectedPerson = useMemo(
    () => result?.people.find((person) => person.id === selectedPersonId) || null,
    [result, selectedPersonId],
  );

  const selectedEdges = useMemo(
    () => selectedPerson ? (result?.edges || []).filter((edge) => edge.fromId === selectedPerson.id || edge.toId === selectedPerson.id) : [],
    [result, selectedPerson],
  );

  function resetResultState() {
    setResult(null);
    setSelectedPersonId(null);
    setQuery("");
    setConfidenceFilter("all");
    setError(null);
    setNotice(null);
  }

  async function loadSavedChart(entityIdText: string) {
    setSavedSelection(entityIdText);
    if (!entityIdText) return;
    const entityId = Number(entityIdText);
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const response = await getSavedOrganizationalChart(entityId);
      setResult(response);
      setCompanyName(response.companyName);
      setSelectedPersonId(response.people[0]?.id || null);
      setNotice(`${response.companyName} was loaded from Neon without spending AI or search quota.`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The saved organizational chart could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function runAnalysis(refresh = false) {
    const company = companyName.trim();
    if (!company) {
      setError("Enter a company name.");
      return;
    }

    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ companyName, primaryUrl, supportingUrls, secQuery }));
    setLoading(true);
    setError(null);
    setNotice(null);
    setSelectedPersonId(null);
    setQuery("");
    setConfidenceFilter("all");
    try {
      const response = await analyzeLeadershipMap({
        companyName: company,
        primaryUrl: primaryUrl.trim() || undefined,
        supportingUrls: supportingUrls.split(/\n+/).map((value) => value.trim()).filter(Boolean),
        secQuery: secQuery.trim() || undefined,
        refresh,
      });
      setResult(response);
      setSelectedPersonId(response.people[0]?.id || null);
      await loadSavedList();
      if (response.entityId) setSavedSelection(String(response.entityId));
      setNotice(response.cacheHit
        ? `${response.companyName} was already researched, so the saved Neon chart was loaded without calling external providers.`
        : `${response.companyName} was researched and its organizational chart was saved to Neon.`);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Organizational chart analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  function clearWorkspace() {
    setCompanyName("");
    setPrimaryUrl("");
    setSupportingUrls("");
    setSecQuery("");
    setSavedSelection("");
    setAdvancedOpen(false);
    resetResultState();
    sessionStorage.removeItem(SESSION_KEY);
  }

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-10">
        <HeaderBar
          eyebrow="Organizational Intelligence"
          title="Organizational Chart Builder"
          subtitle="Research a company once, save the source-backed chart to Neon, and reopen it without repeatedly spending AI or search quota."
        />

        <GlassCard
          variant="glass"
          className="rounded-[30px] border border-cyan-100/18 bg-[#06101d]/74 p-5 shadow-[0_24px_80px_rgba(0,0,0,.36),0_0_38px_rgba(34,211,238,.07),inset_0_1px_0_rgba(255,255,255,.11)] md:p-6"
        >
          <div className="grid gap-5 xl:grid-cols-[minmax(260px,.72fr)_minmax(420px,1.28fr)] xl:items-end">
            <label>
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/44">Charts saved in Neon</span>
              <div className="mt-2 flex min-h-12 items-center gap-3 rounded-2xl border border-cyan-100/13 bg-black/20 px-4 focus-within:border-cyan-200/30">
                {loadingSaved ? <Loader2 className="h-4 w-4 animate-spin text-cyan-200/50" /> : <Database className="h-4 w-4 text-cyan-200/50" />}
                <select
                  value={savedSelection}
                  onChange={(event) => void loadSavedChart(event.target.value)}
                  className="min-w-0 flex-1 appearance-none bg-transparent text-sm font-semibold text-cyan-50 outline-none"
                >
                  <option value="" className="bg-[#07101d]">Select a saved company</option>
                  {savedCharts.map((chart) => (
                    <option key={chart.id} value={String(chart.id)} className="bg-[#07101d]">
                      {chart.companyName} · {chart.people} people
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-cyan-100/34">Selecting a saved company reads the chart directly from Neon.</p>
            </label>

            <div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/44">Build or reopen a company chart</span>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <div className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-cyan-100/13 bg-black/20 px-4 focus-within:border-cyan-200/30">
                  <Building2 className="h-4 w-4 shrink-0 text-cyan-200/48" />
                  <input
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") void runAnalysis(false); }}
                    placeholder="Enter a company name"
                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-cyan-100/26"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void runAnalysis(false)}
                  disabled={loading || !companyName.trim()}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-200/23 bg-cyan-300/14 px-5 text-sm font-bold text-cyan-50 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {loading ? "Building chart…" : "Build organizational chart"}
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-cyan-100/34">Existing research loads from Neon. New companies run the public-source AI pipeline once and are then saved.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAdvancedOpen((value) => !value)}
            className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-cyan-100/46 transition hover:text-cyan-50"
          >
            <ChevronDown className={`h-4 w-4 transition ${advancedOpen ? "rotate-180" : ""}`} />
            Advanced source controls
          </button>

          {advancedOpen && (
            <div className="mt-4 grid gap-4 border-t border-cyan-100/10 pt-5 xl:grid-cols-2">
              <label>
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/40">Official company or leadership URL</span>
                <div className="mt-2 flex min-h-11 items-center gap-3 rounded-2xl border border-cyan-100/11 bg-black/16 px-4 focus-within:border-cyan-200/26">
                  <Network className="h-4 w-4 text-cyan-200/42" />
                  <input value={primaryUrl} onChange={(event) => setPrimaryUrl(event.target.value)} placeholder="Optional official company URL" className="w-full bg-transparent text-sm outline-none placeholder:text-cyan-100/24" />
                </div>
              </label>
              <label>
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/40">SEC issuer or ticker override</span>
                <div className="mt-2 flex min-h-11 items-center gap-3 rounded-2xl border border-cyan-100/11 bg-black/16 px-4 focus-within:border-cyan-200/26">
                  <FileSearch className="h-4 w-4 text-cyan-200/42" />
                  <input value={secQuery} onChange={(event) => setSecQuery(event.target.value)} placeholder="Optional ticker or legal issuer" className="w-full bg-transparent text-sm outline-none placeholder:text-cyan-100/24" />
                </div>
              </label>
              <label className="xl:col-span-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/40">Additional public pages</span>
                <textarea value={supportingUrls} onChange={(event) => setSupportingUrls(event.target.value)} rows={3} placeholder="One optional public URL per line" className="mt-2 w-full rounded-2xl border border-cyan-100/11 bg-black/16 px-4 py-3 text-sm leading-6 outline-none placeholder:text-cyan-100/24 focus:border-cyan-200/26" />
              </label>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-cyan-100/10 pt-5">
            {result && (
              <button
                type="button"
                onClick={() => void runAnalysis(true)}
                disabled={loading}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-amber-200/18 bg-amber-300/[0.07] px-4 text-xs font-bold text-amber-100 transition hover:bg-amber-300/[0.11] disabled:opacity-45"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh from public sources
              </button>
            )}
            <button type="button" onClick={clearWorkspace} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-cyan-100/11 bg-white/[0.025] px-4 text-xs text-cyan-100/52 transition hover:bg-white/[0.05] hover:text-white">
              Clear workspace
            </button>
            <span className="text-[10px] leading-4 text-cyan-100/30">Refresh is the only action that intentionally spends provider quota again for a saved company.</span>
          </div>

          {(error || notice) && (
            <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${error ? "border-rose-200/18 bg-rose-300/[0.06] text-rose-100" : "border-emerald-200/18 bg-emerald-300/[0.06] text-emerald-100"}`}>
              {error || notice}
            </div>
          )}
        </GlassCard>

        {result && (
          <>
            <div className="mt-6 flex flex-wrap items-end justify-between gap-5 border-y border-cyan-100/10 py-5">
              <div className="flex flex-wrap gap-5">
                <Metric label="People" value={result.summary.people} />
                <Metric label="Confirmed" value={result.summary.confirmed} />
                <Metric label="Probable" value={result.summary.probable} />
                <Metric label="Sources" value={result.summary.sourcesAnalyzed} />
                <Metric label="Gaps" value={result.summary.gaps} />
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/34">Data source</p>
                <p className="mt-1 text-xs font-semibold text-cyan-50/74">{result.cacheHit ? "Neon saved chart" : "Fresh public-source build saved to Neon"}</p>
                {result.savedAt && <p className="mt-1 text-[10px] text-cyan-100/34">Saved {new Date(result.savedAt).toLocaleString()}</p>}
              </div>
            </div>

            {result.providerDiagnostics && result.providerDiagnostics.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {result.providerDiagnostics.map((diagnostic) => (
                  <span key={diagnostic.source} className="inline-flex items-center gap-2 rounded-full border border-cyan-100/10 bg-white/[0.025] px-3 py-1.5 text-[10px] text-cyan-100/52">
                    <span className={`h-1.5 w-1.5 rounded-full ${diagnostic.status === "success" ? "bg-emerald-300" : diagnostic.status === "error" ? "bg-rose-300" : "bg-amber-300"}`} />
                    {diagnostic.source} · {diagnostic.resultsFound}
                  </span>
                ))}
              </div>
            )}

            {result.warnings.length > 0 && (
              <div className="mt-5 flex items-start gap-3 border-l-2 border-amber-300/32 pl-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <p className="text-xs leading-5 text-amber-100/58">{result.warnings.join(" ")}</p>
              </div>
            )}

            <div className="mt-6 grid gap-6 2xl:grid-cols-[minmax(0,1fr)_330px]">
              <div className="min-w-0">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
                  <div className="flex min-h-11 flex-1 items-center gap-3 rounded-2xl border border-cyan-100/10 bg-black/16 px-4 focus-within:border-cyan-200/24">
                    <Search className="h-4 w-4 text-cyan-100/36" />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by person, title, department, or location" className="w-full bg-transparent text-sm outline-none placeholder:text-cyan-100/26" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Filter className="h-4 w-4 text-cyan-100/34" />
                    {(["all", "confirmed", "probable", "inferred"] as const).map((value) => (
                      <button key={value} type="button" onClick={() => setConfidenceFilter(value)} className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${confidenceFilter === value ? "border-cyan-200/23 bg-cyan-300/11 text-white" : "border-cyan-100/9 bg-white/[0.02] text-cyan-100/46 hover:text-white"}`}>
                        {value === "all" ? "All" : CONFIDENCE_LABELS[value]}
                      </button>
                    ))}
                  </div>
                </div>

                <GlassCard
                  variant="glass"
                  className="overflow-hidden rounded-[32px] border border-cyan-100/16 bg-[#050d18]/72 p-0 shadow-[0_28px_90px_rgba(0,0,0,.38),inset_0_1px_0_rgba(255,255,255,.09)]"
                >
                  <div className="flex items-center gap-3 border-b border-cyan-100/10 px-5 py-4">
                    <UsersRound className="h-5 w-5 text-cyan-200/68" />
                    <div>
                      <h2 className="text-lg font-black text-white">{result.companyName} organizational chart</h2>
                      <p className="text-xs text-cyan-100/43">People are source-backed; connecting hierarchy remains inferred unless a public source states it explicitly.</p>
                    </div>
                  </div>
                  <div className="p-5 md:p-6">
                    {groupedPeople.length === 0 ? (
                      <div className="py-16 text-center text-sm text-cyan-100/44">No people match the current filters.</div>
                    ) : groupedPeople.map((group, groupIndex) => (
                      <section key={group.level} className="relative pb-9 last:pb-0">
                        {groupIndex > 0 && <div className="absolute -top-7 left-1/2 h-7 w-px bg-gradient-to-b from-cyan-200/26 to-transparent" />}
                        <div className="mb-4 flex items-end justify-between gap-3 border-b border-cyan-100/8 pb-3">
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-cyan-100/32">Hierarchy layer</p>
                            <h3 className="mt-1 text-base font-black text-white">{LEVEL_LABELS[group.level]}</h3>
                          </div>
                          <span className="text-xs font-semibold text-cyan-100/40">{group.people.length}</span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {group.people.map((person) => <PersonNode key={person.id} person={person} onOpen={() => setSelectedPersonId(person.id)} />)}
                        </div>
                      </section>
                    ))}
                  </div>
                </GlassCard>
              </div>

              <aside className="space-y-7">
                <section>
                  <div className="flex items-center gap-2">
                    <CircleHelp className="h-4 w-4 text-amber-200/70" />
                    <h2 className="text-sm font-black text-white">Unresolved hierarchy gaps</h2>
                  </div>
                  <div className="mt-3 space-y-3 border-l border-amber-200/14 pl-4">
                    {result.gaps.map((gap) => (
                      <div key={`${gap.level}-${gap.label}`}>
                        <p className="text-xs font-bold text-amber-100">{gap.label}</p>
                        <p className="mt-1 text-[11px] leading-5 text-amber-100/50">{gap.reason}</p>
                      </div>
                    ))}
                    {result.gaps.length === 0 && <p className="text-xs leading-5 text-cyan-100/48">No standard hierarchy layers are completely absent.</p>}
                  </div>
                </section>

                <section>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-200/70" />
                    <h2 className="text-sm font-black text-white">Evidence inventory</h2>
                  </div>
                  <div className="mt-3 divide-y divide-cyan-100/8 border-y border-cyan-100/8">
                    {result.sources.slice(0, 20).map((source) => (
                      <a key={`${source.url}-${source.status}`} href={source.url} target="_blank" rel="noreferrer" className="flex items-start justify-between gap-3 py-3 transition hover:pl-1">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-cyan-50/82">{source.label}</p>
                          <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-cyan-100/34">{source.sourceType} · {source.status}</p>
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-cyan-100/34" />
                      </a>
                    ))}
                  </div>
                </section>

                <section className="border-t border-cyan-100/9 pt-5">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-100/32">Methodology</p>
                  <p className="mt-2 text-[11px] leading-5 text-cyan-100/48">{result.methodology}</p>
                </section>
              </aside>
            </div>
          </>
        )}
      </section>

      {selectedPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/58 px-4 py-8 backdrop-blur-md" onClick={() => setSelectedPersonId(null)}>
          <GlassCard
            variant="glass"
            className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-[32px] border border-cyan-100/20 bg-[#06101d]/94 p-6 shadow-[0_40px_130px_rgba(0,0,0,.68),0_0_55px_rgba(34,211,238,.09),inset_0_1px_0_rgba(255,255,255,.12)] md:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/40">Leadership evidence</p>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-white">{selectedPerson.name}</h2>
                <p className="mt-2 text-sm leading-6 text-cyan-100/62">{selectedPerson.title}</p>
              </div>
              <button type="button" onClick={() => setSelectedPersonId(null)} className="rounded-xl border border-cyan-100/10 bg-white/[0.03] p-2 text-cyan-100/52 transition hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${confidenceClass(selectedPerson.confidence)}`}>{CONFIDENCE_LABELS[selectedPerson.confidence]}</span>
              <span className="rounded-full border border-cyan-100/10 bg-white/[0.025] px-3 py-1 text-xs text-cyan-100/52">{LEVEL_LABELS[selectedPerson.level]}</span>
              {selectedPerson.department && <span className="rounded-full border border-cyan-100/10 bg-white/[0.025] px-3 py-1 text-xs text-cyan-100/52">{selectedPerson.department}</span>}
            </div>

            {selectedPerson.bio && (
              <section className="mt-6 border-y border-cyan-100/9 py-5">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-100/34">Public biography</p>
                <p className="mt-2 text-xs leading-6 text-cyan-100/58">{selectedPerson.bio}</p>
              </section>
            )}

            <div className="mt-6 grid gap-7 md:grid-cols-2">
              <section>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-200/70" />
                  <h3 className="text-sm font-black text-white">Source evidence</h3>
                </div>
                <div className="mt-3 divide-y divide-cyan-100/8 border-y border-cyan-100/8">
                  {selectedPerson.evidence.map((evidence, index) => (
                    <a key={`${evidence.url}-${index}`} href={evidence.url} target="_blank" rel="noreferrer" className="block py-4 transition hover:pl-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-cyan-50">{evidence.label}</p>
                          <p className="mt-1 text-[9px] uppercase tracking-[0.15em] text-cyan-100/32">{evidence.sourceType}</p>
                        </div>
                        <ExternalLink className="h-4 w-4 shrink-0 text-cyan-100/34" />
                      </div>
                      <p className="mt-2 text-[11px] leading-5 text-cyan-100/54">{evidence.snippet}</p>
                    </a>
                  ))}
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-cyan-200/70" />
                  <h3 className="text-sm font-black text-white">Chart placement</h3>
                </div>
                {selectedEdges.length === 0 ? (
                  <p className="mt-3 text-xs leading-5 text-cyan-100/46">No hierarchy edge was created for this person.</p>
                ) : (
                  <div className="mt-3 space-y-3 border-l border-amber-200/14 pl-4">
                    {selectedEdges.map((edge) => {
                      const otherId = edge.fromId === selectedPerson.id ? edge.toId : edge.fromId;
                      const other = result?.people.find((person) => person.id === otherId);
                      return (
                        <div key={`${edge.fromId}-${edge.toId}`}>
                          <p className="text-xs font-bold text-amber-100">{other?.name || "Unresolved person"}</p>
                          <p className="mt-1 text-[11px] leading-5 text-amber-100/50">{edge.note}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </GlassCard>
        </div>
      )}
    </main>
  );
}
