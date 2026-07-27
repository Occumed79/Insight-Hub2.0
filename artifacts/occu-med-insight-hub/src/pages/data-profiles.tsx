import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Database,
  FileText,
  Info,
  Loader2,
  Search,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import {
  loadCompanyFile,
  loadCompanyLibrary,
  type CompanyFileNarrativeItem,
  type CompanyLibraryCard,
  type CompanySafetyFile,
} from "@/data/companyLibraryApi";

const SELECTED_COMPANY_KEY = "insight-hub.company-library.selected";

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

function statusStyles(status?: CompanyFileNarrativeItem["status"]): string {
  switch (status) {
    case "observed":
      return "border-emerald-200/18 bg-emerald-300/[0.055] text-emerald-50";
    case "normalized":
      return "border-cyan-200/18 bg-cyan-300/[0.055] text-cyan-50";
    case "unverified-source-claim":
      return "border-amber-200/18 bg-amber-300/[0.055] text-amber-50";
    default:
      return "border-violet-200/16 bg-violet-300/[0.045] text-violet-50";
  }
}

function DarkGlassSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <GlassCard
      variant="glass"
      className={`relative overflow-hidden rounded-[30px] border border-white/22 bg-[#06101d]/94 p-5 shadow-[0_28px_90px_rgba(0,0,0,.46),0_0_32px_rgba(34,211,238,.055),inset_0_1px_0_rgba(255,255,255,.13)] backdrop-blur-3xl before:pointer-events-none before:absolute before:inset-[2px] before:rounded-[27px] before:border before:border-white/[0.08] before:content-[''] [&>*]:relative [&>*]:z-10 md:p-6 ${className}`}
    >
      {children}
    </GlassCard>
  );
}

function NarrativeList({ items }: { items: CompanyFileNarrativeItem[] }) {
  return (
    <div className="mt-5 space-y-3">
      {items.map((item) => (
        <div key={`${item.title}-${item.body}`} className={`rounded-2xl border px-4 py-4 ${statusStyles(item.status)}`}>
          <p className="text-sm font-black tracking-[-0.01em]">{item.title}</p>
          <p className="mt-2 text-xs leading-6 text-current/72">{item.body}</p>
        </div>
      ))}
    </div>
  );
}

function CompanySafetyReport({ file }: { file: CompanySafetyFile }) {
  const maxNearMiss = Math.max(...file.nearMissTrend.map((point) => point.value), 1);

  return (
    <div className="mt-8 space-y-6">
      <DarkGlassSection>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/62">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-100/18 bg-cyan-300/[0.055] px-3 py-1.5">
                <Activity size={13} />
                Safety performance intelligence
              </span>
              <span>{file.period.start} - {file.period.end}</span>
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.045em] text-white md:text-5xl">{file.title}</h2>
            <p className="mt-3 text-sm leading-7 text-cyan-50/72">{file.subtitle}</p>
            <p className="mt-5 max-w-3xl text-base font-semibold leading-8 text-white/90">{file.headline}</p>
          </div>
          <div className="min-w-[245px] rounded-[24px] border border-white/14 bg-[#020812]/78 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">
            <div className="flex items-center gap-2 text-cyan-100/62">
              <FileText size={16} />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em]">Source</span>
            </div>
            <p className="mt-3 text-sm font-black text-white">{file.source.title}</p>
            <p className="mt-2 text-xs leading-5 text-cyan-50/62">{file.source.fileName} · {file.source.pageCount} pages</p>
            <p className="mt-2 text-[11px] leading-5 text-cyan-100/48">{file.source.attribution}</p>
            <p className="mt-3 text-[10px] text-cyan-100/38">Ingested {formatDate(file.source.ingestedAt)}</p>
          </div>
        </div>
      </DarkGlassSection>

      <section className="grid gap-4 md:grid-cols-3">
        {file.annualMetrics.map((metric) => (
          <DarkGlassSection key={metric.key} className="p-5 md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/52">{metric.label}</p>
                <div className="mt-4 flex items-end gap-3">
                  <span className="text-3xl font-black tracking-[-0.04em] text-white">{metric.cy2024.toFixed(2)}</span>
                  <span className="pb-1 text-xs text-cyan-50/52">from {metric.cy2023.toFixed(2)}</span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-200/18 bg-rose-300/[0.06] px-2.5 py-1 text-xs font-black text-rose-100">
                <TrendingUp size={13} />
                +{metric.changePercent}%
              </span>
            </div>
            <p className="mt-4 border-t border-white/8 pt-4 text-xs leading-6 text-cyan-50/62">{metric.interpretation}</p>
          </DarkGlassSection>
        ))}
      </section>

      <DarkGlassSection>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/52">Monthly comparison</p>
            <h3 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">TRIR, DART, and near-miss rates</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-cyan-50/54">
            <CalendarDays size={15} />
            Twelve-month CY2023 vs CY2024 table
          </div>
        </div>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10 bg-[#020812]/62">
          <table className="min-w-[860px] w-full border-collapse text-left text-xs">
            <thead className="bg-white/[0.045] text-cyan-100/64">
              <tr>
                {['Month', 'DART 2023', 'TRIR 2023', 'Near Miss 2023', 'DART 2024', 'TRIR 2024', 'Near Miss 2024'].map((label) => (
                  <th key={label} className="border-b border-white/10 px-4 py-3 font-bold uppercase tracking-[0.12em]">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {file.monthlyMetrics.map((row) => {
                const highlight = row.trir2024 >= 0.8 || row.dart2024 >= 0.6 || row.nearMiss2024 >= 1.4;
                return (
                  <tr key={row.month} className={highlight ? "bg-rose-300/[0.035]" : "odd:bg-white/[0.018]"}>
                    <td className="border-b border-white/[0.06] px-4 py-3 font-black text-white">{row.month}</td>
                    <td className="border-b border-white/[0.06] px-4 py-3 text-cyan-50/66">{row.dart2023.toFixed(2)}</td>
                    <td className="border-b border-white/[0.06] px-4 py-3 text-cyan-50/66">{row.trir2023.toFixed(2)}</td>
                    <td className="border-b border-white/[0.06] px-4 py-3 text-cyan-50/66">{row.nearMiss2023.toFixed(2)}</td>
                    <td className="border-b border-white/[0.06] px-4 py-3 text-cyan-50/78">{row.dart2024.toFixed(2)}</td>
                    <td className="border-b border-white/[0.06] px-4 py-3 font-bold text-white">{row.trir2024.toFixed(2)}</td>
                    <td className="border-b border-white/[0.06] px-4 py-3 font-bold text-white">{row.nearMiss2024.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DarkGlassSection>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <DarkGlassSection>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/52">Near-miss trend</p>
              <h3 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">2021-2024 reporting growth</h3>
            </div>
            <BarChart3 size={21} className="text-cyan-200/62" />
          </div>
          <div className="mt-7 flex h-64 items-end gap-4 rounded-2xl border border-white/10 bg-[#020812]/58 px-5 pb-5 pt-8">
            {file.nearMissTrend.map((point) => (
              <div key={point.year} className="flex h-full flex-1 flex-col items-center justify-end gap-3">
                <span className="text-xs font-black text-white">{point.value.toFixed(2)}</span>
                <div
                  className="w-full max-w-16 rounded-t-2xl border border-cyan-100/18 bg-[linear-gradient(180deg,rgba(45,212,191,.80),rgba(34,211,238,.36))] shadow-[0_0_24px_rgba(34,211,238,.12)]"
                  style={{ height: `${Math.max(12, (point.value / maxNearMiss) * 100)}%` }}
                />
                <span className="text-[11px] font-bold text-cyan-50/58">{point.year}</span>
              </div>
            ))}
          </div>
        </DarkGlassSection>

        <DarkGlassSection>
          <div className="flex items-center gap-3">
            <AlertTriangle size={19} className="text-amber-200/72" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/52">Key findings</p>
              <h3 className="mt-1 text-2xl font-black tracking-[-0.035em] text-white">Observed patterns and source interpretation</h3>
            </div>
          </div>
          <NarrativeList items={file.findings} />
        </DarkGlassSection>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <DarkGlassSection>
          <div className="flex items-center gap-3">
            <ShieldCheck size={19} className="text-emerald-200/72" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/52">Occu-Med relevance</p>
              <h3 className="mt-1 text-2xl font-black tracking-[-0.035em] text-white">Operational implications</h3>
            </div>
          </div>
          <NarrativeList items={file.operationalImplications} />
        </DarkGlassSection>

        <DarkGlassSection>
          <div className="flex items-center gap-3">
            <Info size={19} className="text-cyan-200/72" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/52">Data governance</p>
              <h3 className="mt-1 text-2xl font-black tracking-[-0.035em] text-white">Normalization and verification notes</h3>
            </div>
          </div>
          <NarrativeList items={[...file.methodologyNotes, ...file.sourceClaims]} />
        </DarkGlassSection>
      </section>
    </div>
  );
}

export default function DataProfiles() {
  const [companies, setCompanies] = useState<CompanyLibraryCard[]>([]);
  const [selectedSlug, setSelectedSlug] = useState(() => sessionStorage.getItem(SELECTED_COMPANY_KEY) || "");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "researched" | "unresearched">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [companyFile, setCompanyFile] = useState<CompanySafetyFile | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    const entityId = selectedCompany?.entityId;

    setCompanyFile(null);
    setFileError(null);

    if (!entityId) {
      setFileLoading(false);
      return () => { cancelled = true; };
    }

    setFileLoading(true);
    void loadCompanyFile(entityId)
      .then((response) => {
        if (!cancelled) setCompanyFile(response.file);
      })
      .catch((loadError) => {
        if (!cancelled) setFileError(loadError instanceof Error ? loadError.message : "The company file could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setFileLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedCompany?.entityId]);

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
    sessionStorage.setItem(SELECTED_COMPANY_KEY, company.slug);
    setSelectedSlug(company.slug);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeCompanyFile() {
    setSelectedSlug("");
    sessionStorage.removeItem(SELECTED_COMPANY_KEY);
  }

  if (selectedCompany) {
    return (
      <main className="aurora-bg min-h-screen text-white">
        <Sidebar />
        <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-10">
          <button
            type="button"
            onClick={closeCompanyFile}
            className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-50/72 transition hover:text-white"
          >
            <ArrowLeft size={15} />
            Back to company library
          </button>

          <div className="mt-12">
            <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-cyan-100/58">Company file</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-white md:text-6xl">
              {selectedCompany.shortName}
            </h1>
          </div>

          {fileLoading && (
            <div className="flex min-h-[360px] items-center justify-center gap-3 text-sm text-cyan-50/72">
              <Loader2 size={19} className="animate-spin" />
              Loading the company file from Neon…
            </div>
          )}

          {fileError && (
            <div className="mt-7 rounded-2xl border border-rose-200/24 bg-rose-950/70 px-5 py-4 text-sm text-rose-50">
              {fileError}
            </div>
          )}

          {!fileLoading && !fileError && companyFile && <CompanySafetyReport file={companyFile} />}
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
            <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-cyan-100/58">Public research catalog</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-white md:text-6xl">Company Library</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-cyan-50/74">
              Open a company file from the library.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-cyan-50/68">
            <Database size={16} />
            <span>{companies.length} company files</span>
          </div>
        </div>

        <GlassCard
          variant="glass"
          className="mt-7 rounded-[28px] border border-cyan-100/24 bg-[#06101d]/90 p-4 shadow-[0_24px_70px_rgba(0,0,0,.42),inset_0_1px_0_rgba(255,255,255,.12)]"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-cyan-100/20 bg-[#020812]/88 px-4 focus-within:border-cyan-100/38">
              <Search size={17} className="shrink-0 text-cyan-100/62" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search company names or aliases"
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-cyan-100/46"
              />
            </label>
            <div className="flex gap-2 overflow-x-auto">
              {(["all", "researched", "unresearched"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={`min-h-11 whitespace-nowrap rounded-2xl border px-4 text-xs font-semibold transition ${statusFilter === filter ? "border-cyan-200/34 bg-cyan-300/18 text-white" : "border-cyan-100/16 bg-[#071321]/80 text-cyan-50/70 hover:text-white"}`}
                >
                  {filter === "all" ? "All companies" : filter === "researched" ? "Has saved intelligence" : "Not researched"}
                </button>
              ))}
            </div>
          </div>
        </GlassCard>

        {loading && (
          <div className="flex min-h-[420px] items-center justify-center gap-3 text-sm text-cyan-50/72">
            <Loader2 size={19} className="animate-spin" />
            Loading the company library from Neon…
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-2xl border border-rose-200/24 bg-rose-950/70 px-5 py-4 text-sm text-rose-50">
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
                  className="relative h-full min-h-[220px] overflow-hidden rounded-[28px] border border-white/24 bg-[#071321]/88 p-5 shadow-[0_22px_70px_rgba(0,0,0,.40),0_0_32px_rgba(34,211,238,.07),inset_0_1px_0_rgba(255,255,255,.14)] backdrop-blur-3xl before:pointer-events-none before:absolute before:inset-[2px] before:rounded-[25px] before:border before:border-white/[0.11] before:content-[''] [&>*]:relative [&>*]:z-10 transition duration-300 group-hover:-translate-y-1.5 group-hover:border-white/34 group-hover:bg-[#0a1a2d]/92"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-12 min-w-12 items-center justify-center rounded-2xl border border-cyan-100/20 bg-[#0a1a2d]/90 px-3 text-xs font-black tracking-[-0.02em] text-white">
                      {initials(company)}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] ${company.availableModules > 0 ? "text-emerald-200/90" : "text-cyan-100/58"}`}>
                      {company.availableModules > 0 ? <CheckCircle2 size={12} /> : <CircleDashed size={12} />}
                      {company.availableModules > 0 ? `${company.availableModules} saved` : "New research"}
                    </span>
                  </div>
                  <h2 className="mt-6 text-xl font-black tracking-[-0.035em] text-white">{company.shortName}</h2>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-cyan-50/72">{company.canonicalName}</p>
                  <div className="mt-6 flex items-center justify-between border-t border-cyan-100/16 pt-4">
                    <span className="text-[10px] text-cyan-50/58">{formatDate(company.lastUpdatedAt)}</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-100/18 bg-[#0a1a2d]/84 text-cyan-50/64 transition group-hover:border-cyan-100/30 group-hover:text-white">
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
            <Building2 size={28} className="text-cyan-100/48" />
            <p className="mt-4 text-sm font-bold text-white">No companies match this view.</p>
            <p className="mt-2 text-xs text-cyan-50/66">Clear the search or change the filter.</p>
          </div>
        )}

        {notice && (
          <div className="mt-8 flex items-start gap-3 border-t border-cyan-100/16 pt-5 text-xs leading-6 text-cyan-50/66">
            <ShieldCheck size={16} className="mt-1 shrink-0" />
            <p>{notice}</p>
          </div>
        )}
      </section>
    </main>
  );
}
