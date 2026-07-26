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
  Filter,
  GitBranch,
  Loader2,
  Network,
  Plus,
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
  type LeadershipSourceRecord,
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
  board: "Board & Parent Governance",
  executive: "Chief Executive Layer",
  "senior-leadership": "C-Suite & Senior Executives",
  director: "Functional & Division Leadership",
  manager: "Managers & Operating Leads",
  "individual-contributor": "Specialists & Publicly Identified Staff",
  unknown: "Unplaced / Needs Review",
};

const LEVEL_THEME: Record<LeadershipLevel, {
  card: string;
  icon: string;
  badge: string;
  line: string;
}> = {
  board: {
    card: "border-sky-200/24 bg-sky-300/[0.055] shadow-[0_0_34px_rgba(56,189,248,.08),inset_0_1px_0_rgba(255,255,255,.09)] hover:border-sky-200/42 hover:shadow-[0_0_48px_rgba(56,189,248,.14),inset_0_1px_0_rgba(255,255,255,.13)]",
    icon: "border-sky-100/18 bg-sky-300/10 text-sky-100",
    badge: "border-sky-200/22 bg-sky-300/10 text-sky-100",
    line: "from-sky-300/0 via-sky-200/38 to-sky-300/0",
  },
  executive: {
    card: "border-violet-200/25 bg-violet-300/[0.06] shadow-[0_0_38px_rgba(167,139,250,.10),inset_0_1px_0_rgba(255,255,255,.09)] hover:border-violet-200/44 hover:shadow-[0_0_52px_rgba(167,139,250,.17),inset_0_1px_0_rgba(255,255,255,.13)]",
    icon: "border-violet-100/18 bg-violet-300/10 text-violet-100",
    badge: "border-violet-200/22 bg-violet-300/10 text-violet-100",
    line: "from-violet-300/0 via-violet-200/40 to-violet-300/0",
  },
  "senior-leadership": {
    card: "border-emerald-200/23 bg-emerald-300/[0.05] shadow-[0_0_34px_rgba(52,211,153,.08),inset_0_1px_0_rgba(255,255,255,.09)] hover:border-emerald-200/42 hover:shadow-[0_0_48px_rgba(52,211,153,.14),inset_0_1px_0_rgba(255,255,255,.13)]",
    icon: "border-emerald-100/18 bg-emerald-300/10 text-emerald-100",
    badge: "border-emerald-200/22 bg-emerald-300/10 text-emerald-100",
    line: "from-emerald-300/0 via-emerald-200/36 to-emerald-300/0",
  },
  director: {
    card: "border-amber-200/22 bg-amber-300/[0.045] shadow-[0_0_30px_rgba(251,191,36,.07),inset_0_1px_0_rgba(255,255,255,.08)] hover:border-amber-200/38 hover:shadow-[0_0_44px_rgba(251,191,36,.13),inset_0_1px_0_rgba(255,255,255,.12)]",
    icon: "border-amber-100/17 bg-amber-300/9 text-amber-100",
    badge: "border-amber-200/20 bg-amber-300/9 text-amber-100",
    line: "from-amber-300/0 via-amber-200/34 to-amber-300/0",
  },
  manager: {
    card: "border-fuchsia-200/20 bg-fuchsia-300/[0.04] shadow-[0_0_28px_rgba(232,121,249,.06),inset_0_1px_0_rgba(255,255,255,.08)] hover:border-fuchsia-200/36 hover:shadow-[0_0_42px_rgba(232,121,249,.12),inset_0_1px_0_rgba(255,255,255,.12)]",
    icon: "border-fuchsia-100/16 bg-fuchsia-300/8 text-fuchsia-100",
    badge: "border-fuchsia-200/18 bg-fuchsia-300/8 text-fuchsia-100",
    line: "from-fuchsia-300/0 via-fuchsia-200/30 to-fuchsia-300/0",
  },
  "individual-contributor": {
    card: "border-cyan-100/15 bg-cyan-300/[0.025] shadow-[0_0_24px_rgba(34,211,238,.04),inset_0_1px_0_rgba(255,255,255,.07)] hover:border-cyan-200/30 hover:shadow-[0_0_36px_rgba(34,211,238,.09),inset_0_1px_0_rgba(255,255,255,.11)]",
    icon: "border-cyan-100/14 bg-cyan-300/7 text-cyan-100",
    badge: "border-cyan-200/16 bg-cyan-300/7 text-cyan-100",
    line: "from-cyan-300/0 via-cyan-200/26 to-cyan-300/0",
  },
  unknown: {
    card: "border-white/12 bg-white/[0.025] shadow-[inset_0_1px_0_rgba(255,255,255,.07)] hover:border-white/22 hover:bg-white/[0.04]",
    icon: "border-white/12 bg-white/[0.035] text-white/65",
    badge: "border-white/12 bg-white/[0.035] text-white/65",
    line: "from-white/0 via-white/18 to-white/0",
  },
};

const CONFIDENCE_LABELS: Record<LeadershipConfidence, string> = {
  confirmed: "Confirmed",
  probable: "Probable",
  inferred: "Inferred",
};

const SESSION_KEY = "insight-hub.organizational-chart.form";

type WorkspaceMode = "saved" | "new";

type SavedForm = {
  companyName: string;
  primaryUrl: string;
  supportingUrls: string;
};

function loadSavedForm(): SavedForm {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null") as Partial<SavedForm> | null;
    return {
      companyName: String(parsed?.companyName || ""),
      primaryUrl: String(parsed?.primaryUrl || ""),
      supportingUrls: String(parsed?.supportingUrls || ""),
    };
  } catch {
    return { companyName: "", primaryUrl: "", supportingUrls: "" };
  }
}

function confidenceClass(confidence: LeadershipConfidence): string {
  if (confidence === "confirmed") return "border-emerald-200/20 bg-emerald-300/10 text-emerald-100";
  if (confidence === "probable") return "border-cyan-200/20 bg-cyan-300/10 text-cyan-100";
  return "border-amber-200/20 bg-amber-300/10 text-amber-100";
}

function isHttpUrl(value: string | undefined): boolean {
  return Boolean(value && /^https?:\/\//i.test(value));
}

function PersonNode({ person, onOpen }: { person: LeadershipPerson; onOpen: () => void }) {
  const theme = LEVEL_THEME[person.level];
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative min-h-[148px] w-full max-w-[282px] overflow-hidden rounded-[24px] border p-4 text-left backdrop-blur-2xl transition duration-300 hover:-translate-y-1 ${theme.card}`}
    >
      <div className={`pointer-events-none absolute inset-x-7 top-0 h-px bg-gradient-to-r ${theme.line}`} />
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border backdrop-blur-xl ${theme.icon}`}>
          <UserRound className="h-4 w-4" />
        </div>
        <span className={`rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-[0.14em] ${confidenceClass(person.confidence)}`}>
          {CONFIDENCE_LABELS[person.confidence]}
        </span>
      </div>
      <p className="mt-4 text-[9px] font-bold uppercase leading-4 tracking-[0.17em] text-cyan-50/48">{person.title}</p>
      <h3 className="mt-1.5 text-[16px] font-black leading-5 tracking-[-0.015em] text-white">{person.name}</h3>
      <div className="mt-3 flex items-center justify-between gap-3 text-[10px] text-cyan-100/38">
        <span className="truncate">{person.department || person.location || "Organizational role"}</span>
        <ChevronRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}

function HierarchyLayer({
  level,
  people,
  index,
  onOpen,
}: {
  level: LeadershipLevel;
  people: LeadershipPerson[];
  index: number;
  onOpen: (personId: string) => void;
}) {
  const theme = LEVEL_THEME[level];
  return (
    <section className="relative pb-10 last:pb-1">
      {index > 0 && (
        <div className="mx-auto h-9 w-px bg-gradient-to-b from-cyan-100/8 via-cyan-200/30 to-cyan-100/8 shadow-[0_0_14px_rgba(103,232,249,.14)]" />
      )}
      <div className={`mx-auto flex w-fit items-center gap-3 rounded-full border px-4 py-2 backdrop-blur-xl ${theme.badge}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_12px_currentColor]" />
        <span className="text-[9px] font-black uppercase tracking-[0.2em]">{LEVEL_LABELS[level]}</span>
        <span className="border-l border-current/20 pl-3 text-[10px] font-bold opacity-65">{people.length}</span>
      </div>
      <div className="mx-auto h-5 w-px bg-gradient-to-b from-cyan-100/28 to-transparent" />
      <div className="relative mx-auto max-w-[1260px]">
        {people.length > 1 && (
          <div className={`absolute left-[9%] right-[9%] top-0 hidden h-px bg-gradient-to-r sm:block ${theme.line}`} />
        )}
        <div className="flex flex-wrap justify-center gap-4 pt-5">
          {people.map((person) => (
            <div key={person.id} className="relative flex w-full max-w-[282px] justify-center">
              {people.length > 1 && <div className="absolute -top-5 left-1/2 hidden h-5 w-px bg-cyan-100/18 sm:block" />}
              <PersonNode person={person} onOpen={() => onOpen(person.id)} />
            </div>
          ))}
        </div>
      </div>
    </section>
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

function SourceRow({ source }: { source: LeadershipSourceRecord }) {
  const body = (
    <>
      <div className="min-w-0">
        <p className="truncate text-xs font-bold text-cyan-50/82">{source.label}</p>
        <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-cyan-100/34">{source.sourceType} · {source.status}</p>
      </div>
      {isHttpUrl(source.url) && <ExternalLink className="h-3.5 w-3.5 shrink-0 text-cyan-100/34" />}
    </>
  );
  return isHttpUrl(source.url) ? (
    <a href={source.url} target="_blank" rel="noreferrer" className="flex items-start justify-between gap-3 py-3 transition hover:pl-1">
      {body}
    </a>
  ) : (
    <div className="flex items-start justify-between gap-3 py-3">{body}</div>
  );
}

export default function LeadershipMap() {
  const savedForm = useMemo(loadSavedForm, []);
  const [mode, setMode] = useState<WorkspaceMode>("saved");
  const [companyName, setCompanyName] = useState(savedForm.companyName);
  const [primaryUrl, setPrimaryUrl] = useState(savedForm.primaryUrl);
  const [supportingUrls, setSupportingUrls] = useState(savedForm.supportingUrls);
  const [advancedOpen, setAdvancedOpen] = useState(Boolean(savedForm.supportingUrls));
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

  function beginNewCompany() {
    setMode("new");
    setCompanyName("");
    setPrimaryUrl("");
    setSupportingUrls("");
    setAdvancedOpen(false);
    setSavedSelection("");
    resetResultState();
  }

  async function loadSavedChart(entityIdText: string) {
    setMode("saved");
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

    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ companyName, primaryUrl, supportingUrls }));
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
        refresh,
      });
      setResult(response);
      setSelectedPersonId(response.people[0]?.id || null);
      await loadSavedList();
      if (response.entityId) setSavedSelection(String(response.entityId));
      setMode("saved");
      setNotice(response.cacheHit
        ? `${response.companyName} already existed in Neon, so its saved chart was opened.`
        : `${response.companyName} was researched, added to Neon, and opened in the organizational tree.`);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Organizational chart analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  function clearWorkspace() {
    setMode("saved");
    setCompanyName("");
    setPrimaryUrl("");
    setSupportingUrls("");
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
          subtitle="Open a saved Neon company or add a new company from the app, then view its leadership as a luminous, structured hierarchy."
        />

        <GlassCard
          variant="glass"
          className="rounded-[30px] border border-cyan-100/18 bg-[#06101d]/74 p-5 shadow-[0_24px_80px_rgba(0,0,0,.36),0_0_38px_rgba(34,211,238,.07),inset_0_1px_0_rgba(255,255,255,.11)] md:p-6"
        >
          <div className="flex flex-wrap gap-2 rounded-2xl border border-cyan-100/10 bg-black/18 p-1.5">
            <button
              type="button"
              onClick={() => setMode("saved")}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold transition ${mode === "saved" ? "border border-cyan-200/22 bg-cyan-300/12 text-white shadow-[0_0_20px_rgba(34,211,238,.08)]" : "text-cyan-100/48 hover:bg-white/[0.035] hover:text-white"}`}
            >
              <Database className="h-4 w-4" />
              Saved company
            </button>
            <button
              type="button"
              onClick={beginNewCompany}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold transition ${mode === "new" ? "border border-violet-200/22 bg-violet-300/12 text-white shadow-[0_0_20px_rgba(167,139,250,.09)]" : "text-cyan-100/48 hover:bg-white/[0.035] hover:text-white"}`}
            >
              <Plus className="h-4 w-4" />
              Add new company
            </button>
          </div>

          {mode === "saved" ? (
            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(320px,.8fr)_minmax(360px,1.2fr)] xl:items-end">
              <label>
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/44">Companies saved in Neon</span>
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
              </label>
              <div className="rounded-2xl border border-cyan-100/9 bg-white/[0.018] px-4 py-3">
                <p className="text-xs font-semibold text-cyan-50/72">Select a company and the hierarchy tree populates directly from Neon.</p>
                <p className="mt-1 text-[11px] leading-5 text-cyan-100/35">Use Refresh from public sources only when the saved names or positions may have changed.</p>
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <div className="grid gap-4 xl:grid-cols-2">
                <label>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-100/52">Company name</span>
                  <div className="mt-2 flex min-h-12 items-center gap-3 rounded-2xl border border-violet-100/15 bg-black/20 px-4 focus-within:border-violet-200/34">
                    <Building2 className="h-4 w-4 shrink-0 text-violet-200/55" />
                    <input
                      value={companyName}
                      onChange={(event) => setCompanyName(event.target.value)}
                      onKeyDown={(event) => { if (event.key === "Enter") void runAnalysis(false); }}
                      placeholder="Enter a new company name"
                      className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-violet-100/26"
                    />
                  </div>
                </label>
                <label>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-100/52">Official website — optional</span>
                  <div className="mt-2 flex min-h-12 items-center gap-3 rounded-2xl border border-violet-100/15 bg-black/20 px-4 focus-within:border-violet-200/34">
                    <Network className="h-4 w-4 shrink-0 text-violet-200/55" />
                    <input
                      value={primaryUrl}
                      onChange={(event) => setPrimaryUrl(event.target.value)}
                      placeholder="https://company.com"
                      className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-violet-100/26"
                    />
                  </div>
                </label>
              </div>

              <button
                type="button"
                onClick={() => setAdvancedOpen((value) => !value)}
                className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-cyan-100/46 transition hover:text-cyan-50"
              >
                <ChevronDown className={`h-4 w-4 transition ${advancedOpen ? "rotate-180" : ""}`} />
                Additional public pages
              </button>

              {advancedOpen && (
                <label className="mt-4 block border-t border-cyan-100/10 pt-4">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/40">Optional supporting URLs</span>
                  <textarea
                    value={supportingUrls}
                    onChange={(event) => setSupportingUrls(event.target.value)}
                    rows={3}
                    placeholder="One public leadership or management URL per line"
                    className="mt-2 w-full rounded-2xl border border-cyan-100/11 bg-black/16 px-4 py-3 text-sm leading-6 outline-none placeholder:text-cyan-100/24 focus:border-cyan-200/26"
                  />
                </label>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-cyan-100/10 pt-5">
                <button
                  type="button"
                  onClick={() => void runAnalysis(false)}
                  disabled={loading || !companyName.trim()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-violet-200/25 bg-violet-300/14 px-5 text-sm font-bold text-violet-50 transition hover:bg-violet-300/20 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {loading ? "Researching and saving…" : "Add company and build chart"}
                </button>
                <span className="text-[10px] leading-4 text-cyan-100/30">New companies are researched once, saved to Neon, and added to the saved-company selector.</span>
              </div>
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
            {result && <span className="text-[10px] leading-4 text-cyan-100/30">Refresh updates the saved Neon chart when public names or positions have changed.</span>}
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
                  className="overflow-hidden rounded-[34px] border border-cyan-100/16 bg-[#050d18]/72 p-0 shadow-[0_30px_100px_rgba(0,0,0,.42),0_0_70px_rgba(34,211,238,.045),inset_0_1px_0_rgba(255,255,255,.09)]"
                >
                  <div className="flex items-center gap-3 border-b border-cyan-100/10 px-5 py-4">
                    <GitBranch className="h-5 w-5 text-cyan-200/68" />
                    <div>
                      <h2 className="text-lg font-black text-white">{result.companyName} organizational tree</h2>
                      <p className="text-xs text-cyan-100/43">Centered hierarchy layers populate dynamically from the names and positions stored in Neon.</p>
                    </div>
                  </div>
                  <div className="relative overflow-hidden p-5 md:p-7">
                    <div className="pointer-events-none absolute left-1/2 top-0 h-full w-[520px] -translate-x-1/2 bg-[radial-gradient(circle_at_center,rgba(34,211,238,.055),transparent_68%)]" />
                    <div className="relative">
                      {groupedPeople.length === 0 ? (
                        <div className="py-16 text-center text-sm text-cyan-100/44">No people match the current filters.</div>
                      ) : groupedPeople.map((group, groupIndex) => (
                        <HierarchyLayer
                          key={group.level}
                          level={group.level}
                          people={group.people}
                          index={groupIndex}
                          onOpen={setSelectedPersonId}
                        />
                      ))}
                    </div>
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
                    {result.sources.slice(0, 20).map((source) => <SourceRow key={`${source.url}-${source.status}-${source.label}`} source={source} />)}
                    {result.sources.length === 0 && <p className="py-4 text-xs leading-5 text-cyan-100/44">This saved chart contains a manual name-and-position baseline.</p>}
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
                <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/40">Organizational position</p>
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
                  {selectedPerson.evidence.map((evidence, index) => {
                    const body = (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold text-cyan-50">{evidence.label}</p>
                            <p className="mt-1 text-[9px] uppercase tracking-[0.15em] text-cyan-100/32">{evidence.sourceType}</p>
                          </div>
                          {isHttpUrl(evidence.url) && <ExternalLink className="h-4 w-4 shrink-0 text-cyan-100/34" />}
                        </div>
                        <p className="mt-2 text-[11px] leading-5 text-cyan-100/54">{evidence.snippet}</p>
                      </>
                    );
                    return isHttpUrl(evidence.url) ? (
                      <a key={`${evidence.url}-${index}`} href={evidence.url} target="_blank" rel="noreferrer" className="block py-4 transition hover:pl-1">{body}</a>
                    ) : (
                      <div key={`${evidence.label}-${index}`} className="py-4">{body}</div>
                    );
                  })}
                  {selectedPerson.evidence.length === 0 && <p className="py-4 text-xs leading-5 text-cyan-100/44">This name and position came from the manually loaded organizational baseline.</p>}
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-cyan-200/70" />
                  <h3 className="text-sm font-black text-white">Chart placement</h3>
                </div>
                {selectedEdges.length === 0 ? (
                  <p className="mt-3 text-xs leading-5 text-cyan-100/46">Placed in the {LEVEL_LABELS[selectedPerson.level].toLowerCase()} based on the saved position title.</p>
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
