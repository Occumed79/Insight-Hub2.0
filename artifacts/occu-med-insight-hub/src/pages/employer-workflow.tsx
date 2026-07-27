import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Database,
  ExternalLink,
  FileText,
  Landmark,
  Loader2,
  MapPin,
  Network,
  Play,
  RadioTower,
  Scale,
  Search,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { useEmployerWorkflow } from "@/components/insight/EmployerWorkflowContext";
import {
  fetchBlsBenchmark,
  normalizeJob,
  type BlsResponse,
  type JobNormalization,
} from "@/data/employerIntelligenceApi";
import {
  runCompanyLiveIntelligence,
  type CompanyLiveResponse,
  type CompanyLiveSignal,
  type CompanyLiveSourceStatus,
  type LiveSourceName,
} from "@/data/companyLiveIntelligenceApi";
import { cn } from "@/lib/utils";

type HubTabId = "onet" | "bls" | "sec" | "sam" | "usaspending" | "courtlistener";

type HubTab = {
  id: HubTabId;
  label: string;
  eyebrow: string;
  description: string;
  requirement: string;
  icon: LucideIcon;
  liveSource?: LiveSourceName;
};

const TABS: HubTab[] = [
  {
    id: "onet",
    label: "O*NET",
    eyebrow: "Occupation intelligence",
    description: "Retrieves occupation details and work context, identifies physical and environmental demands, and maps them to relevant Occu-Med services.",
    requirement: "Requires a public job title.",
    icon: BriefcaseBusiness,
  },
  {
    id: "bls",
    label: "BLS",
    eyebrow: "Industry benchmark",
    description: "Retrieves industry injury benchmarks by NAICS and exposes source status, attempted series, publication metadata, and limitations.",
    requirement: "Requires a NAICS code.",
    icon: BarChart3,
  },
  {
    id: "sec",
    label: "SEC EDGAR",
    eyebrow: "Filings and issuer signals",
    description: "Searches public issuer filings and filing metadata for the selected company while preserving direct source context and confidence.",
    requirement: "Requires a public company or organization name.",
    icon: FileText,
    liveSource: "SEC EDGAR",
  },
  {
    id: "sam",
    label: "SAM.gov",
    eyebrow: "Federal entity identity",
    description: "Searches federal entity registration and can return legal names, UEI, CAGE, NAICS, DBA names, registration status, and addresses.",
    requirement: "Requires a public company or organization name.",
    icon: Landmark,
    liveSource: "SAM.gov",
  },
  {
    id: "usaspending",
    label: "USAspending",
    eyebrow: "Federal footprint",
    description: "Retrieves federal award, agency, NAICS, amount, and place-of-performance context for the selected company.",
    requirement: "Requires a public company or organization name; state is optional.",
    icon: RadioTower,
    liveSource: "USAspending",
  },
  {
    id: "courtlistener",
    label: "CourtListener",
    eyebrow: "Public legal references",
    description: "Searches public legal references. Every result remains context-only and requires human relevance review.",
    requirement: "Requires a public company or organization name.",
    icon: Scale,
    liveSource: "CourtListener",
  },
];

const PUBLIC_SOURCE_NOTICE =
  "Public-source research only. Do not enter client, applicant, referral, pricing, provider-network, scheduling, case-management, medical, employee, or other internal operational information.";

const LIVE_SOURCE_BY_TAB = Object.fromEntries(
  TABS.filter((tab) => tab.liveSource).map((tab) => [tab.id, tab.liveSource]),
) as Partial<Record<HubTabId, LiveSourceName>>;

export default function EmployerWorkflow() {
  const { context, updateContext } = useEmployerWorkflow();
  const [activeTab, setActiveTab] = useState<HubTabId>("onet");
  const [onetResult, setOnetResult] = useState<JobNormalization | null>(null);
  const [blsResult, setBlsResult] = useState<BlsResponse | null>(null);
  const [liveResults, setLiveResults] = useState<Partial<Record<LiveSourceName, CompanyLiveResponse>>>({});
  const [loadingTab, setLoadingTab] = useState<HubTabId | null>(null);
  const [errors, setErrors] = useState<Partial<Record<HubTabId, string>>>({});

  const activeDefinition = TABS.find((tab) => tab.id === activeTab) ?? TABS[0];
  const activeLiveSource = LIVE_SOURCE_BY_TAB[activeTab];
  const activeLiveResult = activeLiveSource ? liveResults[activeLiveSource] ?? null : null;
  const activeLiveStatus = activeLiveResult?.sources.find((source) => source.source === activeLiveSource) ?? null;

  const tabCounts = useMemo<Partial<Record<HubTabId, number>>>(() => {
    const counts: Partial<Record<HubTabId, number>> = {
      onet: onetResult?.occupationMatches.length ?? 0,
      bls: blsResult?.benchmark ? 1 : 0,
    };
    for (const tab of TABS) {
      if (!tab.liveSource) continue;
      const result = liveResults[tab.liveSource];
      const status = result?.sources.find((source) => source.source === tab.liveSource);
      counts[tab.id] = status?.resultCount ?? 0;
    }
    return counts;
  }, [blsResult, liveResults, onetResult]);

  function setField(field: "employer" | "state" | "jobTitle" | "naics", value: string): void {
    const normalized = field === "state" ? value.toUpperCase().slice(0, 2) : value;
    if (field === "employer") {
      updateContext({ employer: normalized, legalName: "" });
      setLiveResults({});
    } else {
      updateContext({ [field]: normalized });
      if (field === "state") setLiveResults({});
      if (field === "jobTitle") setOnetResult(null);
      if (field === "naics") setBlsResult(null);
    }
    setErrors({});
  }

  async function runTab(tabId: HubTabId): Promise<void> {
    setLoadingTab(tabId);
    setErrors((current) => ({ ...current, [tabId]: "" }));

    try {
      if (tabId === "onet") {
        const jobTitle = context.jobTitle.trim();
        if (!jobTitle) throw new Error("Enter a public job title before running O*NET.");
        const result = await normalizeJob({
          jobTitle,
          company: context.employer.trim() || undefined,
          location: context.state.trim() || undefined,
        });
        if (!result.ok) throw new Error(result.error || "O*NET did not return a usable response.");
        setOnetResult(result);
        return;
      }

      if (tabId === "bls") {
        const naics = context.naics.trim();
        if (!naics) throw new Error("Enter a NAICS code before running BLS.");
        const result = await fetchBlsBenchmark({ naics });
        if (!result.ok) throw new Error(result.error || "BLS did not return a usable response.");
        setBlsResult(result);
        return;
      }

      const liveSource = LIVE_SOURCE_BY_TAB[tabId];
      const companyName = context.legalName.trim() || context.employer.trim();
      if (!liveSource) throw new Error("This source is not connected to a live company adapter.");
      if (!companyName) throw new Error(`Enter a public company or organization name before running ${liveSource}.`);

      const result = await runCompanyLiveIntelligence({
        companyName,
        state: context.state.trim() || undefined,
      });
      setLiveResults({
        "SAM.gov": result,
        "SEC EDGAR": result,
        CourtListener: result,
        USAspending: result,
      });
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [tabId]: error instanceof Error ? error.message : "The source request failed.",
      }));
    } finally {
      setLoadingTab(null);
    }
  }

  return (
    <main className="aurora-bg min-h-screen pb-16 text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar
          eyebrow="Public data intelligence"
          title="Public Data Intelligence Hub"
          subtitle="Use source-specific tabs to run and review official public data without jumping across overlapping tools."
        />

        <section className="relative overflow-hidden rounded-[34px] border border-cyan-100/14 bg-[radial-gradient(circle_at_80%_16%,rgba(124,58,237,.18),transparent_33%),radial-gradient(circle_at_12%_82%,rgba(20,184,166,.18),transparent_38%),rgba(2,8,23,.80)] p-5 shadow-[0_32px_110px_rgba(0,0,0,.44)] backdrop-blur-2xl md:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,.035),transparent)]" />
          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-cyan-100/15 bg-cyan-300/[0.08] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/70">
                    <Database size={13} />
                    Six source tabs
                  </span>
                  <span className="rounded-full border border-emerald-200/14 bg-emerald-300/[0.07] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100/70">
                    Manual only
                  </span>
                </div>
                <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] text-white md:text-5xl">
                  {context.employer.trim() || "Choose a company, occupation, or industry code."}
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-cyan-100/58">
                  O*NET and BLS use the occupation and NAICS fields. SEC EDGAR, SAM.gov, USAspending, and CourtListener share one coordinated manual company scan, then remain separated into source-specific tabs. Nothing runs automatically when the page opens or when tabs change.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void runTab(activeTab)}
                disabled={loadingTab !== null}
                className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-cyan-200/24 bg-cyan-300/14 px-5 text-sm font-bold text-cyan-50 shadow-[0_0_28px_rgba(34,211,238,.12),inset_0_1px_0_rgba(255,255,255,.10)] transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {loadingTab === activeTab ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} />}
                {loadingTab === activeTab
                  ? `Running ${activeDefinition.liveSource ? "company sources" : activeDefinition.label}`
                  : `Run ${activeDefinition.liveSource ? "company-source scan" : activeDefinition.label}`
                }
              </button>
            </div>

            <div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <HubField
                label="Company or organization"
                value={context.employer}
                placeholder="Example: Fluor Corporation"
                icon={Building2}
                onChange={(value) => setField("employer", value)}
              />
              <HubField
                label="State"
                value={context.state}
                placeholder="Optional"
                icon={MapPin}
                onChange={(value) => setField("state", value)}
              />
              <HubField
                label="Public job title"
                value={context.jobTitle}
                placeholder="Example: Aircraft mechanic"
                icon={BriefcaseBusiness}
                onChange={(value) => setField("jobTitle", value)}
              />
              <HubField
                label="NAICS"
                value={context.naics}
                placeholder="Example: 336411"
                icon={Search}
                onChange={(value) => setField("naics", value)}
              />
            </div>

            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200/12 bg-rose-300/[0.045] px-4 py-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-rose-200" />
              <p className="text-xs leading-6 text-rose-100/62">{PUBLIC_SOURCE_NOTICE}</p>
            </div>
          </div>
        </section>

        <div className="mt-6 overflow-x-auto pb-2">
          <nav className="flex min-w-max gap-2" aria-label="Public data sources">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              const count = tabCounts[tab.id] ?? 0;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "group inline-flex min-h-12 items-center gap-3 rounded-2xl border px-4 text-sm font-semibold transition",
                    active
                      ? "border-cyan-200/25 bg-cyan-300/14 text-cyan-50 shadow-[0_0_30px_rgba(34,211,238,.12),inset_0_1px_0_rgba(255,255,255,.10)]"
                      : "border-cyan-100/10 bg-[#06101d]/58 text-cyan-100/52 backdrop-blur-xl hover:border-cyan-100/18 hover:bg-white/[0.055] hover:text-cyan-50",
                  )}
                >
                  <Icon size={16} />
                  {tab.label}
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[9px] font-bold tabular-nums",
                    active ? "bg-cyan-100/12 text-cyan-50" : "bg-white/[0.05] text-cyan-100/38",
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        <section className="mt-4 grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
          <SourceOverview tab={activeDefinition} status={activeLiveStatus} />

          <div className="min-w-0">
            {errors[activeTab] && (
              <div className="mb-4 flex items-start gap-3 rounded-[24px] border border-rose-200/18 bg-rose-300/[0.07] p-4 text-sm text-rose-100">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <span>{errors[activeTab]}</span>
              </div>
            )}

            {activeTab === "onet" && <OnetPanel result={onetResult} />}
            {activeTab === "bls" && <BlsPanel result={blsResult} />}
            {activeLiveSource && (
              <LiveSourcePanel source={activeLiveSource} result={activeLiveResult} status={activeLiveStatus} />
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function HubField({
  label,
  value,
  placeholder,
  icon: Icon,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  icon: LucideIcon;
  onChange: (value: string) => void;
}) {
  return (
    <label className="rounded-[22px] border border-cyan-100/11 bg-[#06101d]/52 p-3 backdrop-blur-xl transition focus-within:border-cyan-200/24 focus-within:bg-cyan-300/[0.06]">
      <span className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-100/42">
        <Icon size={13} />
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-cyan-100/25"
      />
    </label>
  );
}

function SourceOverview({ tab, status }: { tab: HubTab; status: CompanyLiveSourceStatus | null }) {
  const Icon = tab.icon;
  return (
    <aside className="relative overflow-hidden rounded-[30px] border border-cyan-100/12 bg-[linear-gradient(145deg,rgba(8,25,43,.72),rgba(5,11,24,.68))] p-5 shadow-[0_24px_80px_rgba(0,0,0,.32)] backdrop-blur-2xl md:p-6">
      <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-cyan-300/10 blur-3xl" />
      <div className="relative">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-100/14 bg-cyan-300/10 text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,.10)]">
          <Icon size={22} />
        </div>
        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.23em] text-cyan-100/42">{tab.eyebrow}</p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">{tab.label}</h2>
        <p className="mt-3 text-sm leading-7 text-cyan-100/58">{tab.description}</p>
        <p className="mt-4 rounded-2xl border border-cyan-100/10 bg-white/[0.035] px-4 py-3 text-xs leading-6 text-cyan-100/52">
          {tab.requirement}
        </p>

        {status && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <MiniMetric label="Source state" value={status.state} icon={Activity} />
            <MiniMetric label="Results" value={String(status.resultCount)} icon={Database} />
            <MiniMetric label="Latency" value={`${status.latencyMs.toLocaleString("en-US")} ms`} icon={CalendarDays} />
            <MiniMetric label="Configured" value={status.configured ? "Yes" : "No"} icon={BadgeCheck} />
          </div>
        )}

        {status?.limitation && (
          <p className="mt-5 text-xs leading-6 text-amber-100/58">{status.limitation}</p>
        )}
      </div>
    </aside>
  );
}

function MiniMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-cyan-100/10 bg-white/[0.035] p-3">
      <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.17em] text-cyan-100/35">
        <Icon size={12} />
        {label}
      </div>
      <p className="mt-2 truncate text-sm font-bold capitalize text-cyan-50">{value}</p>
    </div>
  );
}

function EmptySource({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-[30px] border border-dashed border-cyan-100/14 bg-[#06101d]/42 p-8 text-center backdrop-blur-xl">
      <div className="max-w-lg">
        <Database className="mx-auto h-8 w-8 text-cyan-100/30" />
        <h3 className="mt-4 text-lg font-bold text-cyan-50">{title}</h3>
        <p className="mt-2 text-sm leading-7 text-cyan-100/48">{detail}</p>
      </div>
    </div>
  );
}

function OnetPanel({ result }: { result: JobNormalization | null }) {
  if (!result) {
    return <EmptySource title="O*NET has not been run" detail="Enter a public job title above, then run O*NET to retrieve occupation matches, work-context indicators, and service-relevance tags." />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <ResultMetric label="SOC code" value={result.socCode || "Not resolved"} />
        <ResultMetric label="Occupation family" value={result.occupationFamily || "Not resolved"} />
        <ResultMetric label="Confidence" value={`${Math.round(result.confidence * 100)}%`} />
      </div>

      <ResultSection title="Occupation matches" icon={Network}>
        <div className="grid gap-3 md:grid-cols-2">
          {result.occupationMatches.map((match) => (
            <div key={`${match.code}-${match.title}`} className="rounded-2xl border border-cyan-100/10 bg-white/[0.035] p-4">
              <p className="text-sm font-bold text-white">{match.title}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-cyan-100/48">
                <span className="rounded-full border border-cyan-100/10 px-2 py-1">SOC {match.code}</span>
                {match.score !== undefined && <span className="rounded-full border border-cyan-100/10 px-2 py-1">Match {Math.round(match.score)}%</span>}
              </div>
            </div>
          ))}
        </div>
      </ResultSection>

      <div className="grid gap-4 xl:grid-cols-3">
        <TagSection title="Physical demands" items={result.physicalDemandIndicators} />
        <TagSection title="Environmental demands" items={result.environmentalIndicators} />
        <TagSection title="Safety-sensitive indicators" items={result.safetySensitiveIndicators} />
      </div>

      <ResultSection title="Relevant Occu-Med services" icon={Activity}>
        <TagCloud items={result.serviceRelevanceTags} empty="No service-relevance tags were returned for this occupation." />
      </ResultSection>
    </div>
  );
}

function BlsPanel({ result }: { result: BlsResponse | null }) {
  if (!result) {
    return <EmptySource title="BLS has not been run" detail="Enter a NAICS code above, then run BLS to retrieve the available industry benchmark and the exact series attempted." />;
  }

  if (!result.benchmark) {
    return (
      <div className="rounded-[30px] border border-amber-200/15 bg-amber-300/[0.055] p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
          <div>
            <h3 className="font-bold text-amber-100">No benchmark was returned</h3>
            <p className="mt-2 text-sm leading-7 text-amber-100/58">{result.message || "BLS did not return a benchmark for the requested NAICS code."}</p>
            {result.attemptedSeriesIds && result.attemptedSeriesIds.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {result.attemptedSeriesIds.map((series) => <span key={series} className="rounded-full border border-amber-100/12 px-3 py-1 text-[10px] text-amber-100/55">{series}</span>)}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const benchmark = result.benchmark;
  return (
    <div className="space-y-4">
      <div className="rounded-[30px] border border-cyan-100/12 bg-[#06101d]/58 p-5 backdrop-blur-xl md:p-6">
        <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/40">{benchmark.year} industry benchmark</p>
        <h3 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">{benchmark.industryTitle}</h3>
        <p className="mt-2 text-sm text-cyan-100/48">NAICS {benchmark.naics} · {benchmark.authMode}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ResultMetric label="TRC rate" value={formatOptionalNumber(benchmark.trcRate)} />
        <ResultMetric label="DART rate" value={formatOptionalNumber(benchmark.dartRate)} />
        <ResultMetric label="Days-away rate" value={formatOptionalNumber(benchmark.daysAwayRate)} />
        <ResultMetric label="Fatality rate" value={formatOptionalNumber(benchmark.fatalityRate)} />
      </div>

      <ResultSection title="Series and provenance" icon={Database}>
        <p className="text-sm leading-7 text-cyan-100/56">{benchmark.sourceMetadata}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {benchmark.attemptedSeriesIds.map((series) => (
            <span key={series} className="rounded-full border border-cyan-100/10 bg-white/[0.03] px-3 py-1 text-[10px] text-cyan-100/55">{series}</span>
          ))}
        </div>
        <p className="mt-4 text-xs leading-6 text-amber-100/56">{benchmark.limitation}</p>
        <a href={benchmark.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-cyan-200 transition hover:text-white">
          Open BLS source <ExternalLink size={13} />
        </a>
      </ResultSection>
    </div>
  );
}

function LiveSourcePanel({
  source,
  result,
  status,
}: {
  source: LiveSourceName;
  result: CompanyLiveResponse | null;
  status: CompanyLiveSourceStatus | null;
}) {
  if (!result) {
    return <EmptySource title={`${source} has not been run`} detail={`Enter a company above, then run the coordinated company-source scan. This tab will display only ${source} results.`} />;
  }

  const signals = result.signals.filter((signal) => signal.source === source);
  return (
    <div className="space-y-4">
      {status && (
        <div className={cn(
          "rounded-[26px] border p-5 backdrop-blur-xl",
          status.state === "success" && "border-emerald-200/16 bg-emerald-300/[0.055]",
          status.state === "empty" && "border-cyan-100/12 bg-[#06101d]/58",
          status.state === "disabled" && "border-amber-200/16 bg-amber-300/[0.055]",
          status.state === "error" && "border-rose-200/16 bg-rose-300/[0.06]",
        )}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/42">Source response</p>
              <h3 className="mt-2 text-lg font-bold text-white">{source} · {status.state}</h3>
            </div>
            <span className="rounded-full border border-cyan-100/12 px-3 py-1 text-[10px] font-semibold text-cyan-100/55">
              {status.resultCount} result{status.resultCount === 1 ? "" : "s"}
            </span>
          </div>
          <p className="mt-3 text-xs leading-6 text-cyan-100/52">{status.freshness}</p>
          {status.error && <p className="mt-2 text-xs leading-6 text-rose-100/70">{status.error}</p>}
        </div>
      )}

      {signals.length === 0 ? (
        <EmptySource title={`No ${source} records returned`} detail={status?.limitation || "The source returned no matching public records for this manual run."} />
      ) : (
        signals.map((signal) => <SignalCard key={signal.id} signal={signal} />)
      )}

      {result.warnings.length > 0 && (
        <div className="rounded-[26px] border border-amber-200/14 bg-amber-300/[0.045] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-100/48">Interpretation warnings</p>
          <div className="mt-3 space-y-2">
            {result.warnings.map((warning) => <p key={warning} className="text-xs leading-6 text-amber-100/58">{warning}</p>)}
          </div>
        </div>
      )}
    </div>
  );
}

function SignalCard({ signal }: { signal: CompanyLiveSignal }) {
  const metricEntries = Object.entries(signal.metrics);
  const identifierEntries = Object.entries(signal.identifiers);
  return (
    <article className="group rounded-[28px] border border-cyan-100/11 bg-[linear-gradient(145deg,rgba(8,25,43,.68),rgba(5,11,24,.60))] p-5 shadow-[0_22px_70px_rgba(0,0,0,.28)] backdrop-blur-2xl transition hover:border-cyan-100/20 hover:bg-cyan-300/[0.055] md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-100/12 bg-cyan-300/[0.07] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.17em] text-cyan-100/55">{signal.category}</span>
            <span className="text-[10px] text-cyan-100/38">Confidence {Math.round(signal.confidence * 100)}%</span>
          </div>
          <h3 className="mt-3 text-lg font-black tracking-[-0.02em] text-white">{signal.title}</h3>
          <p className="mt-3 text-sm leading-7 text-cyan-100/56">{signal.summary}</p>
        </div>
        <a href={signal.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-100/12 bg-white/[0.035] text-cyan-100/55 transition hover:bg-cyan-300/12 hover:text-white" aria-label="Open original public source">
          <ExternalLink size={15} />
        </a>
      </div>

      {(signal.occurredAt || signal.geography) && (
        <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-cyan-100/42">
          {signal.occurredAt && <span className="inline-flex items-center gap-1.5"><CalendarDays size={12} />{formatDate(signal.occurredAt)}</span>}
          {signal.geography && <span className="inline-flex items-center gap-1.5"><MapPin size={12} />{signal.geography}</span>}
        </div>
      )}

      {(metricEntries.length > 0 || identifierEntries.length > 0) && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...identifierEntries, ...metricEntries].map(([key, value]) => (
            <div key={`${signal.id}-${key}`} className="rounded-2xl border border-cyan-100/9 bg-white/[0.03] p-3">
              <p className="text-[9px] uppercase tracking-[0.16em] text-cyan-100/34">{humanize(key)}</p>
              <p className="mt-2 break-words text-sm font-semibold text-cyan-50">{formatMetricValue(key, value)}</p>
            </div>
          ))}
        </div>
      )}

      {signal.evidenceFields.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {signal.evidenceFields.map((field) => (
            <span key={`${signal.id}-${field}`} className="rounded-full border border-cyan-100/9 bg-white/[0.025] px-3 py-1 text-[9px] text-cyan-100/42">{field}</span>
          ))}
        </div>
      )}
    </article>
  );
}

function ResultSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-cyan-100/11 bg-[#06101d]/56 p-5 backdrop-blur-xl md:p-6">
      <div className="flex items-center gap-2 text-sm font-bold text-cyan-50">
        <Icon size={16} />
        {title}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-cyan-100/11 bg-[#06101d]/56 p-4 backdrop-blur-xl">
      <p className="text-[9px] uppercase tracking-[0.17em] text-cyan-100/36">{label}</p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function TagSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-[26px] border border-cyan-100/10 bg-[#06101d]/52 p-5 backdrop-blur-xl">
      <h3 className="text-sm font-bold text-cyan-50">{title}</h3>
      <div className="mt-4">
        <TagCloud items={items} empty="No indicators returned." />
      </div>
    </section>
  );
}

function TagCloud({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-xs leading-6 text-cyan-100/40">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="rounded-full border border-cyan-100/10 bg-cyan-300/[0.055] px-3 py-1.5 text-[10px] text-cyan-100/58">{item}</span>
      ))}
    </div>
  );
}

function formatOptionalNumber(value: number | undefined): string {
  return value === undefined ? "Not reported" : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatMetricValue(key: string, value: string | number): string {
  if (typeof value === "number") {
    if (/amount|dollar|value/i.test(key)) {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
    }
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  if (/date/i.test(key)) return formatDate(value);
  return value;
}

function humanize(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}
