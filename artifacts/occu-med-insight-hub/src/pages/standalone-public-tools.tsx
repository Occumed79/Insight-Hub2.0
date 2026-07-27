import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeDollarSign,
  BarChart3,
  BookOpenCheck,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  FileSearch,
  Gauge,
  Globe2,
  Landmark,
  Loader2,
  MapPinned,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";

const inputClass = "min-h-12 w-full rounded-2xl border border-cyan-100/14 bg-[#06101c]/82 px-4 text-sm text-white outline-none transition placeholder:text-cyan-100/25 focus:border-cyan-200/38 focus:shadow-[0_0_24px_rgba(34,211,238,.08)]";
const buttonClass = "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-200/22 bg-cyan-300/12 px-5 text-sm font-black text-white shadow-[0_0_28px_rgba(34,211,238,.10)] transition hover:border-cyan-100/38 hover:bg-cyan-300/18 disabled:cursor-not-allowed disabled:opacity-45";

function formatCurrency(value: number | null | undefined): string {
  return typeof value === "number"
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
    : "Not reported";
}

function formatNumber(value: number | null | undefined): string {
  return typeof value === "number" ? value.toLocaleString("en-US") : "Not reported";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Date not reported";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function ToolPage({ eyebrow, title, subtitle, children, notice }: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  notice: string;
}) {
  return (
    <main className="aurora-bg min-h-screen pb-24 text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar eyebrow={eyebrow} title={title} subtitle={subtitle} />
        <GlassCard variant="glass" className="mb-6 border-cyan-100/14 bg-[#06101d]/58 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.10),0_22px_65px_rgba(0,0,0,.30)] backdrop-blur-2xl">
          <div className="flex items-start gap-3 text-xs leading-6 text-cyan-100/48">
            <ShieldCheck size={17} className="mt-1 shrink-0 text-cyan-200/55" />
            <p>{notice}</p>
          </div>
        </GlassCard>
        {children}
      </section>
    </main>
  );
}

function SearchPanel({ children }: { children: ReactNode }) {
  return (
    <GlassCard variant="glass" className="mb-6 border border-white/16 bg-white/[0.045] p-[1px] shadow-[0_30px_90px_rgba(0,0,0,.38),0_0_38px_rgba(34,211,238,.06)] backdrop-blur-3xl">
      <div className="rounded-[27px] border border-white/[0.08] bg-[#06101d]/62 p-5 md:p-6">
        {children}
      </div>
    </GlassCard>
  );
}

function Metric({ label, value, note, icon: Icon = Sparkles }: { label: string; value: string; note: string; icon?: typeof Sparkles }) {
  return (
    <div className="rounded-[24px] border border-white/14 bg-white/[0.045] p-[1px] shadow-[0_22px_55px_rgba(0,0,0,.28)] backdrop-blur-2xl">
      <div className="h-full rounded-[23px] border border-white/[0.075] bg-[#071321]/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-100/40">{label}</p>
          <Icon size={15} className="text-cyan-200/42" />
        </div>
        <p className="mt-3 text-2xl font-black tracking-[-0.04em] text-white">{value}</p>
        <p className="mt-1 text-xs leading-5 text-cyan-100/43">{note}</p>
      </div>
    </div>
  );
}

function ResultSurface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[27px] border border-white/14 bg-white/[0.045] p-[1px] shadow-[0_24px_70px_rgba(0,0,0,.31)] backdrop-blur-2xl ${className}`}>
      <div className="h-full rounded-[26px] border border-white/[0.075] bg-[#071321]/72 p-5 md:p-6">{children}</div>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return <div className="flex min-h-[260px] items-center justify-center gap-3 text-sm text-cyan-100/48"><Loader2 size={20} className="animate-spin" />{label}</div>;
}

function ErrorState({ message }: { message: string }) {
  return (
    <ResultSurface>
      <div className="flex items-start gap-3 text-rose-100">
        <AlertTriangle className="mt-0.5 shrink-0" size={20} />
        <div><p className="font-black">Source request failed</p><p className="mt-2 text-sm leading-6 text-rose-100/62">{message}</p></div>
      </div>
    </ResultSurface>
  );
}

function SourceLink({ href, children = "Open official source" }: { href: string; children?: ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-200/70 transition hover:text-white">{children}<ArrowUpRight size={13} /></a>;
}

export function OccupationalDemandsPage() {
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);

  async function run() {
    if (!keyword.trim()) return;
    setLoading(true); setError(""); setData(null);
    try {
      const response = await fetch(`/api/onet/job-context?keyword=${encodeURIComponent(keyword.trim())}`);
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "O*NET request failed");
      setData(payload);
    } catch (runError) { setError(runError instanceof Error ? runError.message : "O*NET request failed"); }
    finally { setLoading(false); }
  }

  const context = data?.context;
  const occupation = context?.occupation;
  const physical = context?.physical_demands;
  const cognitive = context?.cognitive_demands;
  const safety = context?.safety_sensitive_indicators;
  const environment = context?.environmental_indicators;

  return (
    <ToolPage eyebrow="O*NET Web Services" title="Occupational Demands" subtitle="Search a job title and retrieve source-backed physical, cognitive, environmental, and safety-sensitive work context." notice="O*NET describes occupations broadly. Results are not individualized medical standards, essential-function determinations, disability assessments, or fitness-for-duty conclusions.">
      <SearchPanel>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <label><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/42">Job title or occupation</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void run(); }} placeholder="Example: aircraft mechanic" className={`mt-2 ${inputClass}`} /></label>
          <button type="button" onClick={() => void run()} disabled={loading || !keyword.trim()} className={buttonClass}>{loading ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}Analyze occupation</button>
        </div>
      </SearchPanel>
      {loading && <LoadingState label="Retrieving O*NET occupation context…" />}
      {error && <ErrorState message={error} />}
      {context && <>
        <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Occupation" value={occupation?.title || "Unresolved"} note={occupation?.code || "No SOC code"} icon={BriefcaseBusiness} />
          <Metric label="Physical indicators" value={formatNumber((physical?.abilities?.length || 0) + (physical?.work_activities?.length || 0) + (physical?.work_context?.length || 0))} note="Abilities, activities, and work context" icon={Gauge} />
          <Metric label="Safety indicators" value={formatNumber((safety?.indicators?.length || safety?.length || 0))} note="Source-derived hazard and vigilance signals" icon={ShieldAlert} />
          <Metric label="Candidate matches" value={formatNumber(context?.matches?.length || 0)} note="Occupation alternatives returned by O*NET" icon={Users} />
        </section>
        <section className="grid gap-6 xl:grid-cols-2">
          <ResultSurface><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/42">Physical demands</p><h2 className="mt-2 text-xl font-black text-white">{physical?.summary || "No physical-demand summary returned"}</h2><div className="mt-5 space-y-2">{[...(physical?.abilities || []), ...(physical?.work_activities || []), ...(physical?.work_context || [])].slice(0, 18).map((item: any, index: number) => <div key={`${item?.name || item}-${index}`} className="rounded-2xl border border-cyan-100/9 bg-black/18 px-4 py-3 text-sm text-cyan-50/68">{item?.name || item}{item?.description ? <p className="mt-1 text-xs text-cyan-100/40">{item.description}</p> : null}</div>)}</div></ResultSurface>
          <ResultSurface><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-100/42">Cognitive demands</p><h2 className="mt-2 text-xl font-black text-white">{cognitive?.summary || "No cognitive-demand summary returned"}</h2><div className="mt-5 space-y-2">{[...(cognitive?.abilities || []), ...(cognitive?.work_activities || []), ...(cognitive?.work_context || [])].slice(0, 18).map((item: any, index: number) => <div key={`${item?.name || item}-${index}`} className="rounded-2xl border border-violet-100/9 bg-black/18 px-4 py-3 text-sm text-violet-50/68">{item?.name || item}{item?.description ? <p className="mt-1 text-xs text-violet-100/40">{item.description}</p> : null}</div>)}</div></ResultSurface>
          <ResultSurface><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-100/42">Safety-sensitive context</p><div className="mt-4 space-y-2">{(safety?.indicators || safety || []).map((item: any, index: number) => <div key={`${item}-${index}`} className="rounded-2xl border border-rose-100/10 bg-rose-300/[0.045] px-4 py-3 text-sm leading-6 text-rose-50/72">{item?.name || item}</div>)}</div></ResultSurface>
          <ResultSurface><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100/42">Environmental context</p><div className="mt-4 space-y-2">{(environment?.indicators || environment || []).map((item: any, index: number) => <div key={`${item?.name || item}-${index}`} className="rounded-2xl border border-emerald-100/10 bg-emerald-300/[0.04] px-4 py-3 text-sm leading-6 text-emerald-50/72">{item?.name || item}</div>)}</div></ResultSurface>
        </section>
        <div className="mt-6"><SourceLink href="https://www.onetonline.org/">Open O*NET Online</SourceLink></div>
      </>}
    </ToolPage>
  );
}

export function IndustryBenchmarksPage() {
  const [naics, setNaics] = useState("");
  const [year, setYear] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);

  async function run() {
    if (!naics.trim()) return;
    setLoading(true); setError(""); setData(null);
    try {
      const params = new URLSearchParams({ naics: naics.trim() });
      if (year.trim()) params.set("year", year.trim());
      const response = await fetch(`/api/bls/industry-benchmark?${params}`);
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "BLS request failed");
      setData(payload);
    } catch (runError) { setError(runError instanceof Error ? runError.message : "BLS request failed"); }
    finally { setLoading(false); }
  }

  const benchmark = data?.benchmark;
  return (
    <ToolPage eyebrow="Bureau of Labor Statistics" title="Industry Injury Benchmarks" subtitle="Retrieve BLS industry-level injury and illness benchmark rates by NAICS code." notice="BLS industry benchmarks are aggregate estimates. They do not represent a specific employer, worksite, employee population, or current safety condition. Series breaks and unavailable NAICS mappings must remain visible.">
      <SearchPanel><div className="grid gap-4 md:grid-cols-[1fr_.55fr_auto] md:items-end"><label><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/42">NAICS code</span><input value={naics} onChange={(event) => setNaics(event.target.value.replace(/[^0-9]/g, ""))} placeholder="Example: 336411" className={`mt-2 ${inputClass}`} /></label><label><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/42">Year optional</span><input value={year} onChange={(event) => setYear(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))} placeholder="Latest" className={`mt-2 ${inputClass}`} /></label><button type="button" onClick={() => void run()} disabled={loading || !naics.trim()} className={buttonClass}>{loading ? <Loader2 size={17} className="animate-spin" /> : <BarChart3 size={17} />}Load benchmark</button></div></SearchPanel>
      {loading && <LoadingState label="Retrieving BLS benchmark series…" />}
      {error && <ErrorState message={error} />}
      {data && !benchmark && <ResultSurface><p className="font-black text-white">No usable benchmark returned</p><p className="mt-2 text-sm leading-6 text-cyan-100/48">{data.message || data.limitation || "The requested NAICS/year did not resolve to a published series."}</p><div className="mt-4 text-xs text-cyan-100/34">Attempted series: {(data.attemptedSeriesIds || []).join(", ") || "None reported"}</div></ResultSurface>}
      {benchmark && <><section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="TRC rate" value={benchmark.trcRate ?? "Not reported"} note="Total recordable cases" icon={TrendingUp} /><Metric label="DART rate" value={benchmark.dartRate ?? "Not reported"} note="Days away, restricted, or transferred" icon={Gauge} /><Metric label="Days-away rate" value={benchmark.daysAwayRate ?? "Not reported"} note="Cases involving days away from work" icon={CalendarDays} /><Metric label="Benchmark year" value={String(benchmark.year || "Unknown")} note={benchmark.authMode || "BLS API"} icon={BookOpenCheck} /></section><ResultSurface><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/42">Resolved industry</p><h2 className="mt-2 text-2xl font-black text-white">{benchmark.industryTitle || `NAICS ${benchmark.naics}`}</h2><p className="mt-3 text-sm leading-7 text-cyan-100/52">{benchmark.sourceMetadata}</p><div className="mt-5 rounded-2xl border border-amber-100/12 bg-amber-300/[0.05] p-4 text-xs leading-6 text-amber-100/62">{benchmark.limitation}</div><div className="mt-5 flex flex-wrap gap-4"><SourceLink href={benchmark.sourceUrl}>Open BLS source</SourceLink><SourceLink href={benchmark.developerDocsUrl}>BLS developer documentation</SourceLink></div></ResultSurface></>}
    </ToolPage>
  );
}

type FecData = { committees: any[]; filings: any[]; limitation: string; sourceUrl: string };
export function FecFilingsPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<FecData | null>(null);
  async function run() { if (!query.trim()) return; setLoading(true); setError(""); setData(null); try { const response = await fetch(`/api/public-data/fec?query=${encodeURIComponent(query.trim())}`); const payload = await response.json(); if (!response.ok || !payload.ok) throw new Error(payload.error || "FEC request failed"); setData(payload); } catch (runError) { setError(runError instanceof Error ? runError.message : "FEC request failed"); } finally { setLoading(false); } }
  return <ToolPage eyebrow="Federal Election Commission" title="FEC Filings" subtitle="Search political committees by company or organization name and review their public federal filings." notice="Committee-name matches and employee political activity must not be attributed to an employer without explicit evidence of sponsorship or affiliation. FEC contributor information cannot be used for commercial solicitation."><SearchPanel><div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end"><label><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/42">Company, sponsor, or committee name</span><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void run(); }} placeholder="Example: Lockheed Martin" className={`mt-2 ${inputClass}`} /></label><button type="button" onClick={() => void run()} disabled={loading || !query.trim()} className={buttonClass}>{loading ? <Loader2 size={17} className="animate-spin" /> : <Landmark size={17} />}Search FEC</button></div></SearchPanel>{loading && <LoadingState label="Searching OpenFEC committees and filings…" />}{error && <ErrorState message={error} />}{data && <><section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Metric label="Committee matches" value={formatNumber(data.committees.length)} note="Name-search results requiring review" icon={Users} /><Metric label="Recent filings" value={formatNumber(data.filings.length)} note="Filings for the strongest committee matches" icon={FileSearch} /><Metric label="Official source" value="OpenFEC" note="Live FEC API query" icon={Landmark} /></section><section className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]"><ResultSurface><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/42">Committee matches</p><div className="mt-4 space-y-3">{data.committees.map((committee) => <div key={committee.committeeId} className="rounded-2xl border border-cyan-100/10 bg-black/18 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-white">{committee.name}</p><p className="mt-1 text-xs text-cyan-100/42">{committee.committeeId} · {committee.committeeType || committee.designation || "Type not reported"}</p></div><SourceLink href={committee.sourceUrl}>Open</SourceLink></div>{committee.treasurer && <p className="mt-3 text-xs text-cyan-100/50">Treasurer: {committee.treasurer}</p>}</div>)}</div></ResultSurface><ResultSurface><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-100/42">Recent filings</p><div className="mt-4 space-y-3">{data.filings.map((filing, index) => <div key={`${filing.committeeId}-${filing.fileNumber}-${index}`} className="rounded-2xl border border-violet-100/10 bg-black/18 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black text-white">{filing.formType || "FEC filing"} · {filing.committeeName || filing.committeeId}</p><p className="mt-1 text-xs text-violet-100/42">{filing.reportType || "Report type not listed"} · {formatDate(filing.receiptDate)}</p></div><SourceLink href={filing.sourceUrl}>View filing</SourceLink></div><div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs text-cyan-100/52"><span>Receipts: {formatCurrency(filing.totalReceipts)}</span><span>Disbursements: {formatCurrency(filing.totalDisbursements)}</span><span>Cash: {formatCurrency(filing.cashOnHandEnd)}</span></div></div>)}</div></ResultSurface></section><p className="mt-6 text-xs leading-6 text-amber-100/55">{data.limitation}</p></>}</ToolPage>;
}

export function FederalAwardsPage() {
  const [companyName, setCompanyName] = useState("");
  const [state, setState] = useState("");
  const [fromDate, setFromDate] = useState(`${new Date().getFullYear() - 5}-01-01`);
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [data, setData] = useState<any>(null);
  async function run() { if (!companyName.trim()) return; setLoading(true); setError(""); setData(null); try { const response = await fetch("/api/public-data/usaspending", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyName: companyName.trim(), state: state.trim(), fromDate, toDate }) }); const payload = await response.json(); if (!response.ok || !payload.ok) throw new Error(payload.error || "USAspending request failed"); setData(payload); } catch (runError) { setError(runError instanceof Error ? runError.message : "USAspending request failed"); } finally { setLoading(false); } }
  const agencies = useMemo(() => data ? Array.from(new Set(data.awards.map((award: any) => award.awardingAgency).filter(Boolean))) : [], [data]);
  return <ToolPage eyebrow="USAspending.gov" title="Federal Awards" subtitle="Search federal contract awards by recipient name, date range, and optional place-of-performance state." notice="Award records describe federal spending and contractor footprint. They do not establish contract performance, current staffing, workplace conditions, occupational risk, or service demand."><SearchPanel><div className="grid gap-4 xl:grid-cols-[1.1fr_.4fr_.55fr_.55fr_auto] xl:items-end"><label><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/42">Recipient/company</span><input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Example: KBR" className={`mt-2 ${inputClass}`} /></label><label><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/42">State optional</span><input value={state} onChange={(event) => setState(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))} placeholder="VA" className={`mt-2 ${inputClass}`} /></label><label><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/42">From</span><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className={`mt-2 ${inputClass}`} /></label><label><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/42">To</span><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className={`mt-2 ${inputClass}`} /></label><button type="button" onClick={() => void run()} disabled={loading || !companyName.trim()} className={buttonClass}>{loading ? <Loader2 size={17} className="animate-spin" /> : <CircleDollarSign size={17} />}Search awards</button></div></SearchPanel>{loading && <LoadingState label="Searching USAspending awards…" />}{error && <ErrorState message={error} />}{data && <><section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Awards returned" value={formatNumber(data.awards.length)} note="Highest-value matching awards" icon={BadgeDollarSign} /><Metric label="Returned award value" value={formatCurrency(data.totalAwardAmount)} note="Sum of displayed award amounts" icon={CircleDollarSign} /><Metric label="Awarding agencies" value={formatNumber(agencies.length)} note="Distinct agencies in displayed results" icon={Landmark} /><Metric label="Query period" value={`${data.fromDate.slice(0, 4)}–${data.toDate.slice(0, 4)}`} note="Manual live query window" icon={CalendarDays} /></section><div className="grid gap-4 xl:grid-cols-2">{data.awards.map((award: any, index: number) => <ResultSurface key={`${award.awardId}-${index}`}><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/38">{award.awardId || "Award ID not reported"}</p><h2 className="mt-2 text-lg font-black text-white">{award.recipientName || companyName}</h2></div><p className="text-lg font-black text-emerald-200">{formatCurrency(award.awardAmount)}</p></div><p className="mt-4 text-sm leading-6 text-cyan-100/55">{award.description || "No award description returned."}</p><div className="mt-4 grid gap-2 text-xs text-cyan-100/44 sm:grid-cols-2"><span>{award.awardingAgency || "Agency not reported"}</span><span>{[award.city, award.state, award.country].filter(Boolean).join(", ") || "Place not reported"}</span><span>{award.naics ? `NAICS ${award.naics}` : "NAICS not reported"}</span><span>{formatDate(award.startDate)} – {formatDate(award.endDate)}</span></div></ResultSurface>)}</div><div className="mt-6"><SourceLink href={data.sourceUrl}>Open USAspending</SourceLink></div></>}</ToolPage>;
}

export function LegalReferencesPage() {
  const [query, setQuery] = useState(""); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [data, setData] = useState<any>(null);
  async function run() { if (!query.trim()) return; setLoading(true); setError(""); setData(null); try { const response = await fetch(`/api/public-data/courtlistener?query=${encodeURIComponent(query.trim())}`); const payload = await response.json(); if (!response.ok || !payload.ok) throw new Error(payload.error || "CourtListener request failed"); setData(payload); } catch (runError) { setError(runError instanceof Error ? runError.message : "CourtListener request failed"); } finally { setLoading(false); } }
  return <ToolPage eyebrow="CourtListener" title="Public Legal References" subtitle="Search public federal and state legal references by company, organization, or exact phrase." notice="A public legal search result is a reference requiring human review. It does not establish that the matched entity is the intended company or prove liability, wrongdoing, negligence, injury, or an adverse judgment."><SearchPanel><div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end"><label><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/42">Company or search phrase</span><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void run(); }} placeholder="Example: Amentum" className={`mt-2 ${inputClass}`} /></label><button type="button" onClick={() => void run()} disabled={loading || !query.trim()} className={buttonClass}>{loading ? <Loader2 size={17} className="animate-spin" /> : <Scale size={17} />}Search records</button></div></SearchPanel>{loading && <LoadingState label="Searching CourtListener…" />}{error && <ErrorState message={error} />}{data && <><section className="mb-6 grid gap-3 sm:grid-cols-3"><Metric label="References returned" value={formatNumber(data.references.length)} note="Recent matching public records" icon={Scale} /><Metric label="Search term" value={data.query} note="Exact phrase used by the API" icon={Search} /><Metric label="Source" value="CourtListener" note="Public legal reference index" icon={Landmark} /></section><div className="space-y-4">{data.references.map((reference: any, index: number) => <ResultSurface key={`${reference.docketNumber}-${index}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-black text-white">{reference.caseName}</h2><p className="mt-1 text-xs text-cyan-100/42">{reference.court || "Court not reported"} · {reference.docketNumber || "Docket not reported"} · {formatDate(reference.dateFiled)}</p></div><SourceLink href={reference.sourceUrl}>Open record</SourceLink></div><p className="mt-4 text-sm leading-7 text-cyan-100/55">{reference.snippet || "No indexed snippet was returned."}</p>{reference.citation && <p className="mt-3 text-xs text-violet-100/55">Citation: {reference.citation}</p>}</ResultSurface>)}</div><p className="mt-6 text-xs leading-6 text-amber-100/55">{data.limitation}</p></>}</ToolPage>;
}

export function AorRiskIntelligencePage() {
  const [country, setCountry] = useState(""); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [data, setData] = useState<any>(null);
  async function run() { if (!country.trim()) return; setLoading(true); setError(""); setData(null); try { const response = await fetch(`/api/public-data/aor-risk?country=${encodeURIComponent(country.trim())}`); const payload = await response.json(); if (!response.ok || !payload.ok) throw new Error(payload.error || "AOR risk request failed"); setData(payload); } catch (runError) { setError(runError instanceof Error ? runError.message : "AOR risk request failed"); } finally { setLoading(false); } }
  const advisory = data?.advisory;
  const levelTone = advisory?.level === 4 ? "text-rose-200" : advisory?.level === 3 ? "text-orange-200" : advisory?.level === 2 ? "text-amber-200" : "text-emerald-200";
  return <ToolPage eyebrow="Area of Responsibility Context" title="AOR Risk Intelligence" subtitle="Look up official U.S. Department of State travel-advisory context for a country or operating area." notice="This workspace currently uses official U.S. travel-advisory context as one risk layer. It is not a complete threat assessment, force-protection plan, medical-support analysis, or substitute for local security reporting."><SearchPanel><div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end"><label><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/42">Country or operating area</span><input value={country} onChange={(event) => setCountry(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void run(); }} placeholder="Example: Kuwait" className={`mt-2 ${inputClass}`} /></label><button type="button" onClick={() => void run()} disabled={loading || !country.trim()} className={buttonClass}>{loading ? <Loader2 size={17} className="animate-spin" /> : <Globe2 size={17} />}Check official advisory</button></div></SearchPanel>{loading && <LoadingState label="Retrieving official travel-advisory context…" />}{error && <ErrorState message={error} />}{data && !data.found && <ResultSurface><p className="font-black text-white">No exact advisory link resolved</p><p className="mt-2 text-sm leading-7 text-cyan-100/52">The official index did not return an exact country match through the automated parser. Use the source link for manual review.</p><div className="mt-5"><SourceLink href={data.sourceUrl}>Open State Department advisories</SourceLink></div></ResultSurface>}{advisory && <><section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Advisory level" value={advisory.level ? `Level ${advisory.level}` : "Not parsed"} note={advisory.levelLabel} icon={ShieldAlert} /><Metric label="Risk factors found" value={formatNumber(advisory.riskFactors.length)} note="Keywords present in the official advisory" icon={Gauge} /><Metric label="Country" value={data.country} note="Requested operating area" icon={MapPinned} /><Metric label="Advisory date" value={advisory.updatedAt || "Not parsed"} note="Issued/reissued date when available" icon={CalendarDays} /></section><section className="grid gap-6 xl:grid-cols-[.72fr_1.28fr]"><ResultSurface><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/42">Official advisory posture</p><p className={`mt-4 text-5xl font-black ${levelTone}`}>{advisory.level ? `Level ${advisory.level}` : "—"}</p><h2 className="mt-3 text-xl font-black text-white">{advisory.levelLabel}</h2><div className="mt-5 flex flex-wrap gap-2">{advisory.riskFactors.map((factor: string) => <span key={factor} className="rounded-full border border-amber-100/14 bg-amber-300/[0.055] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-100/70">{factor}</span>)}</div></ResultSurface><ResultSurface><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-100/42">Official-source excerpt</p><h2 className="mt-2 text-xl font-black text-white">{advisory.title}</h2><p className="mt-4 text-sm leading-7 text-cyan-100/56">{advisory.summary}</p><div className="mt-5"><SourceLink href={advisory.sourceUrl}>Read full advisory</SourceLink></div></ResultSurface></section><div className="mt-6 rounded-2xl border border-amber-100/12 bg-amber-300/[0.045] p-4 text-xs leading-6 text-amber-100/60">{data.limitation}</div></>}</ToolPage>;
}
