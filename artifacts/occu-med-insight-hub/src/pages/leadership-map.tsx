import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  FileSearch,
  Filter,
  Loader2,
  Network,
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
  type LeadershipConfidence,
  type LeadershipLevel,
  type LeadershipMapResponse,
  type LeadershipPerson,
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

const SESSION_KEY = "insight-hub.leadership-map.form";

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

function levelAccent(level: LeadershipLevel): string {
  if (level === "board") return "from-violet-300/24 via-cyan-300/8 to-transparent";
  if (level === "executive") return "from-cyan-300/24 via-emerald-300/8 to-transparent";
  if (level === "senior-leadership") return "from-emerald-300/20 via-cyan-300/8 to-transparent";
  if (level === "director") return "from-blue-300/18 via-cyan-300/7 to-transparent";
  if (level === "manager") return "from-teal-300/15 via-cyan-300/6 to-transparent";
  if (level === "individual-contributor") return "from-slate-300/12 via-cyan-300/5 to-transparent";
  return "from-amber-300/14 via-cyan-300/5 to-transparent";
}

function Stat({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <GlassCard className="p-4">
      <p className="text-[10px] uppercase tracking-[0.23em] text-cyan-100/42">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-cyan-100/48">{note}</p>
    </GlassCard>
  );
}

function PersonCard({ person, onOpen }: { person: LeadershipPerson; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group min-h-[156px] w-full rounded-2xl border border-cyan-100/10 bg-black/24 p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-200/28 hover:bg-cyan-200/[0.045]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-100/12 bg-white/[0.04]">
          <UserRound className="h-5 w-5 text-cyan-200/70" />
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${confidenceClass(person.confidence)}`}>
          {CONFIDENCE_LABELS[person.confidence]}
        </span>
      </div>
      <h3 className="mt-4 text-base font-black leading-5 text-white">{person.name}</h3>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-cyan-100/64">{person.title}</p>
      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-cyan-100/42">
        <span className="truncate">{person.department || "Department not stated"}</span>
        <ChevronRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}

export default function LeadershipMap() {
  const saved = useMemo(loadSavedForm, []);
  const [companyName, setCompanyName] = useState(saved.companyName);
  const [primaryUrl, setPrimaryUrl] = useState(saved.primaryUrl);
  const [supportingUrls, setSupportingUrls] = useState(saved.supportingUrls);
  const [secQuery, setSecQuery] = useState(saved.secQuery);
  const [result, setResult] = useState<LeadershipMapResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [confidenceFilter, setConfidenceFilter] = useState<"all" | LeadershipConfidence>("all");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

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

  async function runAnalysis() {
    if (!companyName.trim()) {
      setError("Enter a company name.");
      return;
    }
    if (!primaryUrl.trim() && !supportingUrls.trim()) {
      setError("Add at least one public leadership, team, company, or governance page URL.");
      return;
    }

    const savedForm = { companyName, primaryUrl, supportingUrls, secQuery };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(savedForm));
    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedPersonId(null);
    setQuery("");
    setConfidenceFilter("all");
    try {
      const response = await analyzeLeadershipMap({
        companyName: companyName.trim(),
        primaryUrl: primaryUrl.trim(),
        supportingUrls: supportingUrls.split(/\n+/).map((value) => value.trim()).filter(Boolean),
        secQuery: secQuery.trim() || undefined,
      });
      setResult(response);
      setSelectedPersonId(response.people[0]?.id || null);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Leadership analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  function clearWorkspace() {
    setCompanyName("");
    setPrimaryUrl("");
    setSupportingUrls("");
    setSecQuery("");
    setResult(null);
    setError(null);
    setQuery("");
    setConfidenceFilter("all");
    setSelectedPersonId(null);
    sessionStorage.removeItem(SESSION_KEY);
  }

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-10">
        <HeaderBar
          eyebrow="Standalone Intelligence Tool"
          title="Leadership Map"
          subtitle="Build a source-backed public leadership hierarchy, expose missing layers, and clearly separate confirmed people from inferred placement."
        />

        <GlassCard className="p-5 md:p-6">
          <div className="grid gap-4 xl:grid-cols-2">
            <label>
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/45">Company name</span>
              <div className="mt-2 flex min-h-12 items-center gap-3 rounded-2xl border border-cyan-100/12 bg-black/20 px-4 focus-within:border-cyan-200/30">
                <Building2 className="h-4 w-4 text-cyan-200/45" />
                <input
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="Enter the company or legal entity"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-cyan-100/28"
                />
              </div>
            </label>

            <label>
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/45">Primary public page</span>
              <div className="mt-2 flex min-h-12 items-center gap-3 rounded-2xl border border-cyan-100/12 bg-black/20 px-4 focus-within:border-cyan-200/30">
                <Network className="h-4 w-4 text-cyan-200/45" />
                <input
                  value={primaryUrl}
                  onChange={(event) => setPrimaryUrl(event.target.value)}
                  placeholder="https://company.com/leadership"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-cyan-100/28"
                />
              </div>
            </label>

            <label>
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/45">Supporting public pages</span>
              <textarea
                value={supportingUrls}
                onChange={(event) => setSupportingUrls(event.target.value)}
                placeholder={"One URL per line\nBoard page\nBusiness-unit leadership page\nPublic biographies or governance page"}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-cyan-100/12 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-cyan-100/28 focus:border-cyan-200/30"
              />
            </label>

            <div className="flex flex-col gap-4">
              <label>
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/45">SEC match override</span>
                <div className="mt-2 flex min-h-12 items-center gap-3 rounded-2xl border border-cyan-100/12 bg-black/20 px-4 focus-within:border-cyan-200/30">
                  <FileSearch className="h-4 w-4 text-cyan-200/45" />
                  <input
                    value={secQuery}
                    onChange={(event) => setSecQuery(event.target.value)}
                    placeholder="Optional ticker or SEC issuer name"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-cyan-100/28"
                  />
                </div>
              </label>
              <div className="flex flex-1 items-end gap-3">
                <button
                  type="button"
                  onClick={runAnalysis}
                  disabled={loading}
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-cyan-200/22 bg-cyan-300/14 px-5 text-sm font-bold text-cyan-50 transition hover:bg-cyan-300/20 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {loading ? "Analyzing public sources..." : "Build leadership map"}
                </button>
                <button
                  type="button"
                  onClick={clearWorkspace}
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-cyan-100/12 bg-white/[0.03] px-4 text-sm text-cyan-100/58 transition hover:bg-white/[0.06] hover:text-white"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200/12 bg-amber-300/[0.045] p-4 text-xs leading-5 text-amber-100/70">
            <CircleHelp className="mt-0.5 h-4 w-4 shrink-0" />
            The tool may infer chart placement from titles, but inferred placement is never presented as a confirmed reporting relationship. Public sources rarely expose a complete chain down to every analyst.
          </div>
        </GlassCard>

        {error && (
          <GlassCard className="mt-5 border-rose-300/18 p-4">
            <div className="flex items-start gap-3 text-rose-100">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-bold">Leadership analysis could not be completed</p>
                <p className="mt-1 text-xs leading-5 text-rose-100/65">{error}</p>
              </div>
            </div>
          </GlassCard>
        )}

        {result && (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <Stat label="People found" value={result.summary.people} note="Deduplicated public records" />
              <Stat label="Confirmed" value={result.summary.confirmed} note="Structured official or SEC evidence" />
              <Stat label="Probable" value={result.summary.probable} note="Strong public-page match" />
              <Stat label="Inferred" value={result.summary.inferred} note="Needs human verification" />
              <Stat label="Sources" value={result.summary.sourcesAnalyzed} note="Pages analyzed this run" />
              <Stat label="Known gaps" value={result.summary.gaps} note="Missing hierarchy layers" />
            </div>

            {result.warnings.length > 0 && (
              <GlassCard className="mt-5 border-amber-200/14 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                  <div>
                    <p className="text-sm font-bold text-amber-100">Review notes</p>
                    <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-100/62">
                      {result.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
                    </ul>
                  </div>
                </div>
              </GlassCard>
            )}

            <div className="mt-6 grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0 space-y-5">
                <GlassCard className="p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <div className="flex min-h-11 flex-1 items-center gap-3 rounded-2xl border border-cyan-100/10 bg-black/20 px-4 focus-within:border-cyan-200/25">
                      <Search className="h-4 w-4 text-cyan-100/38" />
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Filter by person, title, department, or location"
                        className="w-full bg-transparent text-sm outline-none placeholder:text-cyan-100/28"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-cyan-100/38" />
                      {(["all", "confirmed", "probable", "inferred"] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setConfidenceFilter(value)}
                          className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${confidenceFilter === value ? "border-cyan-200/24 bg-cyan-300/12 text-white" : "border-cyan-100/10 bg-white/[0.025] text-cyan-100/48 hover:text-white"}`}
                        >
                          {value === "all" ? "All" : CONFIDENCE_LABELS[value]}
                        </button>
                      ))}
                    </div>
                  </div>
                </GlassCard>

                <GlassCard className="overflow-hidden p-0">
                  <div className="border-b border-cyan-100/10 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <UsersRound className="h-5 w-5 text-cyan-200/70" />
                      <div>
                        <h2 className="text-lg font-black text-white">{result.companyName} public hierarchy</h2>
                        <p className="text-xs text-cyan-100/46">Cards show extracted people; vertical placement follows public titles and may be inferred.</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-0 p-5">
                    {groupedPeople.length === 0 ? (
                      <div className="py-16 text-center text-sm text-cyan-100/45">No people match the current filters.</div>
                    ) : groupedPeople.map((group, groupIndex) => (
                      <section key={group.level} className="relative pb-8 last:pb-0">
                        {groupIndex > 0 && <div className="absolute -top-5 left-1/2 h-5 w-px bg-gradient-to-b from-cyan-200/28 to-transparent" />}
                        <div className={`rounded-3xl border border-cyan-100/9 bg-gradient-to-r ${levelAccent(group.level)} p-4`}>
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-100/42">Hierarchy layer</p>
                              <h3 className="mt-1 text-base font-black text-white">{LEVEL_LABELS[group.level]}</h3>
                            </div>
                            <span className="rounded-full border border-cyan-100/10 bg-black/20 px-3 py-1 text-xs text-cyan-100/52">{group.people.length}</span>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {group.people.map((person) => (
                              <PersonCard key={person.id} person={person} onOpen={() => setSelectedPersonId(person.id)} />
                            ))}
                          </div>
                        </div>
                      </section>
                    ))}
                  </div>
                </GlassCard>
              </div>

              <aside className="space-y-5">
                <GlassCard className="p-5">
                  <div className="flex items-center gap-3">
                    <CircleHelp className="h-5 w-5 text-amber-200/70" />
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Hierarchy gaps</p>
                      <h2 className="mt-1 text-base font-black text-white">What public sources did not resolve</h2>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {result.gaps.map((gap) => (
                      <div key={`${gap.level}-${gap.label}`} className="rounded-2xl border border-amber-200/10 bg-amber-300/[0.035] p-3">
                        <p className="text-sm font-bold text-amber-100">{gap.label}</p>
                        <p className="mt-1 text-xs leading-5 text-amber-100/55">{gap.reason}</p>
                      </div>
                    ))}
                    {result.gaps.length === 0 && <p className="text-xs leading-5 text-cyan-100/52">No standard hierarchy layers are completely missing from the current result.</p>}
                  </div>
                </GlassCard>

                <GlassCard className="p-5">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-200/70" />
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Sources analyzed</p>
                      <h2 className="mt-1 text-base font-black text-white">Evidence inventory</h2>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {result.sources.slice(0, 18).map((source) => (
                      <a
                        key={`${source.url}-${source.status}`}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-2xl border border-cyan-100/9 bg-white/[0.025] p-3 transition hover:border-cyan-200/20 hover:bg-white/[0.045]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-cyan-50">{source.label}</p>
                            <p className="mt-1 text-[11px] uppercase tracking-[0.13em] text-cyan-100/38">{source.sourceType} · {source.status}</p>
                          </div>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-cyan-100/36" />
                        </div>
                      </a>
                    ))}
                  </div>
                </GlassCard>
              </aside>
            </div>

            <GlassCard className="mt-6 p-5">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Methodology</p>
              <p className="mt-2 text-xs leading-6 text-cyan-100/58">{result.methodology}</p>
            </GlassCard>
          </>
        )}
      </section>

      {selectedPerson && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/42 backdrop-blur-sm" onClick={() => setSelectedPersonId(null)}>
          <aside
            className="h-full w-full max-w-[520px] overflow-y-auto border-l border-cyan-100/14 bg-[#050c16]/97 p-5 shadow-[-30px_0_90px_rgba(0,0,0,.5)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/42">Leadership evidence</p>
                <h2 className="mt-2 text-2xl font-black text-white">{selectedPerson.name}</h2>
                <p className="mt-1 text-sm leading-6 text-cyan-100/64">{selectedPerson.title}</p>
              </div>
              <button type="button" onClick={() => setSelectedPersonId(null)} className="rounded-xl border border-cyan-100/10 bg-white/[0.035] p-2 text-cyan-100/54 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${confidenceClass(selectedPerson.confidence)}`}>{CONFIDENCE_LABELS[selectedPerson.confidence]}</span>
              <span className="rounded-full border border-cyan-100/10 bg-white/[0.03] px-3 py-1 text-xs text-cyan-100/55">{LEVEL_LABELS[selectedPerson.level]}</span>
              {selectedPerson.department && <span className="rounded-full border border-cyan-100/10 bg-white/[0.03] px-3 py-1 text-xs text-cyan-100/55">{selectedPerson.department}</span>}
            </div>

            {selectedPerson.bio && (
              <div className="mt-5 rounded-2xl border border-cyan-100/10 bg-white/[0.025] p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/38">Public biography</p>
                <p className="mt-2 text-xs leading-6 text-cyan-100/62">{selectedPerson.bio}</p>
              </div>
            )}

            <div className="mt-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-200/70" />
                <h3 className="text-sm font-black text-white">Source evidence</h3>
              </div>
              <div className="mt-3 space-y-3">
                {selectedPerson.evidence.map((evidence, index) => (
                  <a
                    key={`${evidence.url}-${index}`}
                    href={evidence.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-2xl border border-cyan-100/10 bg-white/[0.025] p-4 transition hover:border-cyan-200/22 hover:bg-white/[0.045]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-cyan-50">{evidence.label}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100/36">{evidence.sourceType}</p>
                      </div>
                      <ExternalLink className="h-4 w-4 shrink-0 text-cyan-100/38" />
                    </div>
                    <p className="mt-3 text-xs leading-5 text-cyan-100/58">{evidence.snippet}</p>
                  </a>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-cyan-200/70" />
                <h3 className="text-sm font-black text-white">Chart placement</h3>
              </div>
              {selectedEdges.length === 0 ? (
                <p className="mt-3 text-xs leading-5 text-cyan-100/48">No hierarchy edge was created for this person.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {selectedEdges.map((edge) => {
                    const otherId = edge.fromId === selectedPerson.id ? edge.toId : edge.fromId;
                    const other = result?.people.find((person) => person.id === otherId);
                    return (
                      <div key={`${edge.fromId}-${edge.toId}`} className="rounded-2xl border border-amber-200/10 bg-amber-300/[0.035] p-3">
                        <p className="text-xs font-bold text-amber-100">{other?.name || "Unresolved person"}</p>
                        <p className="mt-1 text-xs leading-5 text-amber-100/55">{edge.note}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
