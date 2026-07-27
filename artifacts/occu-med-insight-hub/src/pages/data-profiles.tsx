import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CircleDashed,
  Database,
  ExternalLink,
  FileSearch,
  GitBranch,
  Landmark,
  Loader2,
  MapPin,
  Network,
  RadioTower,
  RefreshCw,
  Search,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useLocation } from "wouter";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import {
  loadCompanyLibrary,
  type CompanyLibraryCard,
  type CompanyModuleKey,
  type CompanyModuleState,
} from "@/data/companyLibraryApi";
import { EMPLOYER_WORKFLOW_STORAGE_KEY } from "@/data/employerWorkflow";

const SELECTED_COMPANY_KEY = "insight-hub.company-library.selected";

const MODULES: Array<{
  key: CompanyModuleKey;
  label: string;
  description: string;
  route?: string;
  icon: typeof Building2;
}> = [
  { key: "locations", label: "Locations", description: "Mapped branches, offices, facilities, and operating sites.", route: "/geographic-footprint", icon: MapPin },
  { key: "jobs", label: "Jobs & Workforce", description: "Current public postings, job families, locations, and hiring patterns.", route: "/hiring-intelligence", icon: BriefcaseBusiness },
  { key: "bls", label: "BLS & O*NET", description: "Industry and occupation benchmarks connected to the company workforce.", route: "/industry-injury-benchmarks", icon: BarChart3 },
  { key: "organizationalChart", label: "Organizational Chart", description: "Publicly supported leadership layers and evidence-backed people.", route: "/leadership-map", icon: UsersRound },
  { key: "corporateStructure", label: "Corporate Structure", description: "Parent, subsidiary, division, brand, DBA, and affiliate context.", route: "/corporate-structure", icon: GitBranch },
  { key: "sec", label: "SEC Filings", description: "Saved issuer identity and recent public filing activity.", route: "/sec-filings", icon: FileSearch },
  { key: "corporateSignals", label: "Corporate Signals", description: "Public regulatory, legal, federal-award, and entity signals.", route: "/corporate-signals", icon: RadioTower },
  { key: "fec", label: "FEC Filings", description: "Committee identity and federal filing activity from OpenFEC.", route: "/fec-filings", icon: Landmark },
  { key: "injuryExposure", label: "Injury & Exposure", description: "OSHA records, BLS benchmarks, and occupational exposure context.", route: "/injury-workforce-exposure", icon: Activity },
  { key: "evidence", label: "Evidence & Sources", description: "Source coverage, freshness, diagnostics, and limitations.", route: "/source-governance", icon: ShieldCheck },
];

function formatDate(value?: string): string {
  if (!value) return "Not researched yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function initials(company: CompanyLibraryCard): string {
  const words = company.shortName.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((word) => word[0]).join("").toUpperCase();
}

function prepareCompanyContext(company: CompanyLibraryCard): void {
  if (typeof window === "undefined") return;
  const name = company.canonicalName || company.name;
  window.sessionStorage.setItem(SELECTED_COMPANY_KEY, company.slug);
  window.sessionStorage.setItem("insight-hub.locations.company", name);
  window.sessionStorage.setItem("insight-hub.corporate-structure.company", name);
  window.sessionStorage.setItem("insight-hub.corporate-signals.company", name);
  window.sessionStorage.setItem("insight-hub.injury-workforce.company", name);
  window.sessionStorage.setItem("insight-hub.leadership-map.form", JSON.stringify({
    companyName: name,
    primaryUrl: company.officialWebsite || "",
    supportingUrls: "",
    secQuery: name,
  }));
  if (company.officialWebsite) {
    window.sessionStorage.setItem("insight-hub.corporate-structure.url", company.officialWebsite);
    window.sessionStorage.setItem("insight-hub.hiring-intelligence.url", company.officialWebsite);
  }
  window.sessionStorage.setItem(EMPLOYER_WORKFLOW_STORAGE_KEY, JSON.stringify({
    context: {
      employer: company.name,
      legalName: name,
      state: "",
      jobTitle: "",
      naics: "",
      country: "",
    },
    completedStepIds: [],
    updatedAt: new Date().toISOString(),
  }));
}

function statusLabel(state: CompanyModuleState): string {
  if (state.status === "available" && typeof state.count === "number") {
    return `${state.count.toLocaleString()} saved`;
  }
  return state.status === "available" ? "Saved in Neon" : "Not researched";
}

export default function DataProfiles() {
  const [, setLocation] = useLocation();
  const [companies, setCompanies] = useState<CompanyLibraryCard[]>([]);
  const [selectedSlug, setSelectedSlug] = useState(() => sessionStorage.getItem(SELECTED_COMPANY_KEY) || "");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "researched" | "unresearched">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  async function loadCatalog() {
    setLoading(true);
    setError(null);
    try {
      const response = await loadCompanyLibrary();
      setCompanies(response.companies);
      setNotice(response.publicRepositoryNotice);
      if (selectedSlug && !response.companies.some((company) => company.slug === selectedSlug)) {
        setSelectedSlug("");
        sessionStorage.removeItem(SELECTED_COMPANY_KEY);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The company library could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCatalog();
  }, []);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.slug === selectedSlug) || null,
    [companies, selectedSlug],
  );

  const visibleCompanies = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return companies.filter((company) => {
      if (statusFilter === "researched" && company.availableModules === 0) return false;
      if (statusFilter === "unresearched" && company.availableModules > 0) return false;
      if (!needle) return true;
      return [company.name, company.shortName, company.canonicalName, ...company.aliases]
        .some((value) => value.toLowerCase().includes(needle));
    });
  }, [companies, query, statusFilter]);

  function selectCompany(company: CompanyLibraryCard) {
    prepareCompanyContext(company);
    setSelectedSlug(company.slug);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openModule(company: CompanyLibraryCard, route?: string) {
    if (!route) return;
    prepareCompanyContext(company);
    setLocation(route);
  }

  if (selectedCompany) {
    return (
      <main className="aurora-bg min-h-screen text-white">
        <Sidebar />
        <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-10">
          <button
            type="button"
            onClick={() => {
              setSelectedSlug("");
              sessionStorage.removeItem(SELECTED_COMPANY_KEY);
            }}
            className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-100/50 transition hover:text-white"
          >
            <ArrowLeft size={15} />
            Back to company library
          </button>

          <GlassCard
            variant="glass"
            className="mt-5 overflow-hidden rounded-[34px] border border-cyan-100/18 bg-[#05101d]/80 p-6 shadow-[0_30px_110px_rgba(0,0,0,.52),0_0_48px_rgba(34,211,238,.08),inset_0_1px_0_rgba(255,255,255,.12)] md:p-8"
          >
            <div className="flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
              <div className="flex min-w-0 items-start gap-5">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[26px] border border-cyan-100/16 bg-[radial-gradient(circle_at_30%_20%,rgba(103,232,249,.22),transparent_48%),rgba(255,255,255,.035)] text-xl font-black tracking-[-0.04em] text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_0_32px_rgba(34,211,238,.08)]">
                  {initials(selectedCompany)}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-100/38">Company intelligence workspace</p>
                  <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-white md:text-6xl">{selectedCompany.shortName}</h1>
                  <p className="mt-2 text-sm text-cyan-100/52">{selectedCompany.canonicalName}</p>
                  {selectedCompany.aliases.length > 0 && (
                    <p className="mt-2 text-xs text-cyan-100/32">Also matched as {selectedCompany.aliases.join(" · ")}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {selectedCompany.officialWebsite && (
                  <a
                    href={selectedCompany.officialWebsite}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-cyan-100/12 bg-white/[0.035] px-4 text-xs font-semibold text-cyan-50 transition hover:bg-white/[0.07]"
                  >
                    <ExternalLink size={15} />
                    Official website
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => openModule(selectedCompany, "/employer-workflow")}
                  className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-cyan-200/22 bg-cyan-300/12 px-4 text-xs font-bold text-cyan-50 transition hover:bg-cyan-300/18"
                >
                  <RefreshCw size={15} />
                  Open refresh controls
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-5 border-t border-cyan-100/10 pt-6 sm:grid-cols-3">
              <WorkspaceMetric label="Intelligence modules" value={`${selectedCompany.availableModules}/${selectedCompany.totalModules}`} />
              <WorkspaceMetric label="Neon entity" value={selectedCompany.entityId ? `#${selectedCompany.entityId}` : "Not created"} />
              <WorkspaceMetric label="Last company update" value={formatDate(selectedCompany.lastUpdatedAt)} />
            </div>
          </GlassCard>

          <div className="mt-7 grid gap-x-6 gap-y-1 xl:grid-cols-2">
            {MODULES.map((module) => {
              const Icon = module.icon;
              const state = selectedCompany.modules[module.key];
              const available = state.status === "available";
              return (
                <button
                  type="button"
                  key={module.key}
                  onClick={() => openModule(selectedCompany, module.route)}
                  disabled={!module.route}
                  className="group flex min-h-[116px] w-full items-center gap-5 border-b border-cyan-100/9 px-2 py-5 text-left transition hover:border-cyan-100/20 disabled:cursor-default"
                >
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${available ? "border-cyan-100/18 bg-cyan-300/[0.09] text-cyan-100" : "border-white/[0.07] bg-white/[0.025] text-cyan-100/32"}`}>
                    <Icon size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-black tracking-[-0.02em] text-white">{module.label}</span>
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] ${available ? "text-emerald-200/72" : "text-cyan-100/30"}`}>
                        {available ? <CheckCircle2 size={12} /> : <CircleDashed size={12} />}
                        {statusLabel(state)}
                      </span>
                    </span>
                    <span className="mt-2 block text-xs leading-5 text-cyan-100/42">{module.description}</span>
                    <span className="mt-2 block text-[10px] text-cyan-100/28">{formatDate(state.updatedAt)}</span>
                  </span>
                  {module.route && <ArrowRight size={18} className="shrink-0 text-cyan-100/24 transition group-hover:translate-x-1 group-hover:text-cyan-100/72" />}
                </button>
              );
            })}
          </div>

          <div className="mt-7 flex items-start gap-3 border-t border-cyan-100/9 pt-5 text-xs leading-6 text-cyan-100/38">
            <ShieldCheck size={16} className="mt-1 shrink-0" />
            <p>{notice}</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-10">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-cyan-100/38">Public research catalog</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-white md:text-6xl">Company Library</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-cyan-100/48">
              Open a company and move through its saved public intelligence without entering the same identity into every tool.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-cyan-100/40">
            <Database size={16} />
            <span>{companies.length} public research targets</span>
          </div>
        </div>

        <GlassCard
          variant="glass"
          className="mt-7 rounded-[28px] border border-cyan-100/15 bg-[#06101d]/72 p-4 shadow-[0_24px_70px_rgba(0,0,0,.38),inset_0_1px_0_rgba(255,255,255,.1)]"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-cyan-100/12 bg-black/20 px-4 focus-within:border-cyan-100/28">
              <Search size={17} className="shrink-0 text-cyan-100/36" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search company names or aliases"
                className="min-w-0 flex-1 bg-transparent text-sm text-cyan-50 outline-none placeholder:text-cyan-100/24"
              />
            </label>
            <div className="flex gap-2 overflow-x-auto">
              {(["all", "researched", "unresearched"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={`min-h-11 whitespace-nowrap rounded-2xl border px-4 text-xs font-semibold transition ${statusFilter === filter ? "border-cyan-200/22 bg-cyan-300/12 text-cyan-50" : "border-cyan-100/9 bg-white/[0.025] text-cyan-100/42 hover:text-cyan-50"}`}
                >
                  {filter === "all" ? "All companies" : filter === "researched" ? "Has saved intelligence" : "Not researched"}
                </button>
              ))}
            </div>
          </div>
        </GlassCard>

        {loading && (
          <div className="flex min-h-[420px] items-center justify-center gap-3 text-sm text-cyan-100/48">
            <Loader2 size={19} className="animate-spin" />
            Loading the company library from Neon…
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-2xl border border-rose-200/16 bg-rose-300/[0.06] px-5 py-4 text-sm text-rose-100">
            {error}
            <button type="button" onClick={() => void loadCatalog()} className="ml-3 font-bold underline underline-offset-4">Retry</button>
          </div>
        )}

        {!loading && !error && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visibleCompanies.map((company) => (
              <button type="button" key={company.slug} onClick={() => selectCompany(company)} className="group text-left">
                <GlassCard
                  variant="glass"
                  className="relative h-full min-h-[220px] overflow-hidden rounded-[28px] border border-white/20 bg-white/[0.055] p-5 shadow-[0_22px_70px_rgba(0,0,0,.34),0_0_32px_rgba(34,211,238,.055),inset_0_1px_0_rgba(255,255,255,.18)] backdrop-blur-3xl before:pointer-events-none before:absolute before:inset-[2px] before:rounded-[25px] before:border before:border-white/[0.09] before:content-[''] after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(135deg,rgba(255,255,255,.075),transparent_38%,rgba(103,232,249,.035))] after:content-[''] [&>*]:relative [&>*]:z-10 transition duration-300 group-hover:-translate-y-1.5 group-hover:border-white/32 group-hover:bg-white/[0.075] group-hover:shadow-[0_30px_90px_rgba(0,0,0,.44),0_0_42px_rgba(34,211,238,.11),inset_0_1px_0_rgba(255,255,255,.22)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-12 min-w-12 items-center justify-center rounded-2xl border border-cyan-100/12 bg-white/[0.035] px-3 text-xs font-black tracking-[-0.02em] text-cyan-50">
                      {initials(company)}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] ${company.availableModules > 0 ? "text-emerald-200/66" : "text-cyan-100/28"}`}>
                      {company.availableModules > 0 ? <CheckCircle2 size={12} /> : <CircleDashed size={12} />}
                      {company.availableModules > 0 ? `${company.availableModules} saved` : "New research"}
                    </span>
                  </div>
                  <h2 className="mt-6 text-xl font-black tracking-[-0.035em] text-white">{company.shortName}</h2>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-cyan-100/42">{company.canonicalName}</p>
                  <div className="mt-6 flex items-center justify-between border-t border-cyan-100/8 pt-4">
                    <span className="text-[10px] text-cyan-100/28">{formatDate(company.lastUpdatedAt)}</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-100/10 bg-white/[0.025] text-cyan-100/30 transition group-hover:border-cyan-100/20 group-hover:text-white">
                      <ArrowRight size={15} />
                    </span>
                  </div>
                </GlassCard>
              </button>
            ))}
          </div>
        )}

        {!loading && !error && visibleCompanies.length === 0 && (
          <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
            <Building2 size={28} className="text-cyan-100/24" />
            <p className="mt-4 text-sm font-bold text-cyan-50">No companies match this view.</p>
            <p className="mt-2 text-xs text-cyan-100/36">Clear the search or change the saved-intelligence filter.</p>
          </div>
        )}

        {notice && (
          <div className="mt-8 flex items-start gap-3 border-t border-cyan-100/9 pt-5 text-xs leading-6 text-cyan-100/36">
            <ShieldCheck size={16} className="mt-1 shrink-0" />
            <p>{notice}</p>
          </div>
        )}
      </section>
    </main>
  );
}

function WorkspaceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-100/32">{label}</p>
      <p className="mt-2 text-lg font-black tracking-[-0.02em] text-cyan-50">{value}</p>
    </div>
  );
}
