import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ExternalLink,
  Filter,
  Globe2,
  Loader2,
  MapPin,
  Radar,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import {
  analyzeCareersPage,
  type HiringCountItem,
  type HiringIntelligenceResponse,
  type HiringJob,
} from "@/data/hiringIntelligenceApi";

const SESSION_URL_KEY = "insight-hub.hiring-intelligence.url";

function platformLabel(value: string): string {
  const labels: Record<string, string> = {
    greenhouse: "Greenhouse",
    lever: "Lever",
    workday: "Workday",
    ashby: "Ashby",
    smartrecruiters: "SmartRecruiters",
    "json-ld": "Structured JobPosting data",
    "generic-html": "Generic public-page analysis",
  };
  return labels[value] || value;
}

function formatDate(value?: string): string {
  if (!value) return "Not stated";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

function chartData(items: HiringCountItem[], limit = 10): HiringCountItem[] {
  return items.slice(0, limit).map((item) => ({
    ...item,
    label: item.label.length > 34 ? `${item.label.slice(0, 31)}…` : item.label,
  }));
}

function MetricCard({ label, value, note }: { label: string; value: number | string; note: string }) {
  return (
    <GlassCard className="p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/40">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-cyan-100/48">{note}</p>
    </GlassCard>
  );
}

function AnalysisChart({ title, subtitle, data }: { title: string; subtitle: string; data: HiringCountItem[] }) {
  const visible = chartData(data);
  return (
    <GlassCard className="min-h-[360px] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/40">Visual breakdown</p>
      <h2 className="mt-2 text-lg font-black text-white">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-cyan-100/48">{subtitle}</p>
      <div className="mt-5 h-[270px]">
        {visible.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={visible} layout="vertical" margin={{ top: 4, right: 18, bottom: 4, left: 6 }}>
              <CartesianGrid stroke="rgba(165,243,252,.08)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fill: "rgba(207,250,254,.55)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="label" type="category" width={150} tick={{ fill: "rgba(207,250,254,.64)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <ChartTooltip
                cursor={{ fill: "rgba(103,232,249,.05)" }}
                contentStyle={{ background: "#06111d", border: "1px solid rgba(165,243,252,.18)", borderRadius: 14, color: "white" }}
              />
              <Bar dataKey="count" fill="#67e8f9" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-cyan-100/12 text-sm text-cyan-100/40">
            No chartable records were extracted.
          </div>
        )}
      </div>
    </GlassCard>
  );
}

export default function HiringIntelligence() {
  const [careersUrl, setCareersUrl] = useState(() => sessionStorage.getItem(SESSION_URL_KEY) || "");
  const [result, setResult] = useState<HiringIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [familyFilter, setFamilyFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");

  const familyOptions = useMemo(
    () => Array.from(new Set((result?.jobs ?? []).map((job) => job.jobFamily))).sort(),
    [result],
  );

  const locationOptions = useMemo(
    () => Array.from(new Set((result?.jobs ?? []).map((job) => job.locationText))).sort().slice(0, 100),
    [result],
  );

  const filteredJobs = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    return (result?.jobs ?? []).filter((job) => {
      const matchesText = !lowered || [
        job.title,
        job.locationText,
        job.department,
        job.jobFamily,
        job.seniority,
      ].some((value) => String(value || "").toLowerCase().includes(lowered));
      const matchesFamily = familyFilter === "all" || job.jobFamily === familyFilter;
      const matchesLocation = locationFilter === "all" || job.locationText === locationFilter;
      return matchesText && matchesFamily && matchesLocation;
    });
  }, [familyFilter, locationFilter, query, result]);

  const selectedJob = useMemo(
    () => result?.jobs.find((job) => job.id === selectedJobId) ?? null,
    [result, selectedJobId],
  );

  async function runAnalysis() {
    const url = careersUrl.trim();
    if (!url) {
      setError("Paste the company careers or job-posting page URL first.");
      return;
    }
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    } catch {
      setError("Enter a complete public URL beginning with http:// or https://.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedJobId(null);
    setQuery("");
    setFamilyFilter("all");
    setLocationFilter("all");
    sessionStorage.setItem(SESSION_URL_KEY, url);
    try {
      const response = await analyzeCareersPage(url);
      setResult(response);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "The careers page could not be analyzed.");
    } finally {
      setLoading(false);
    }
  }

  function clearWorkspace() {
    setCareersUrl("");
    setResult(null);
    setSelectedJobId(null);
    setQuery("");
    setFamilyFilter("all");
    setLocationFilter("all");
    setError(null);
    sessionStorage.removeItem(SESSION_URL_KEY);
  }

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-10">
        <HeaderBar
          eyebrow="Standalone Intelligence Tool"
          title="Hiring Intelligence"
          subtitle="Paste a public company careers page to extract current openings and visualize where hiring is concentrated, which job families are growing, and what seniority levels are in demand."
        />

        <GlassCard className="mb-6 p-5 md:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
            <label className="min-w-0 flex-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/45">Careers or job-posting page</span>
              <div className="mt-2 flex min-h-12 items-center gap-3 rounded-2xl border border-cyan-100/12 bg-black/20 px-4 focus-within:border-cyan-200/30">
                <Globe2 size={17} className="shrink-0 text-cyan-200/45" />
                <input
                  value={careersUrl}
                  onChange={(event) => setCareersUrl(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter" && !loading) void runAnalysis(); }}
                  placeholder="https://company.com/careers or the public ATS page"
                  className="min-w-0 flex-1 bg-transparent text-sm text-cyan-50 outline-none placeholder:text-cyan-100/28"
                />
              </div>
            </label>
            <div className="flex flex-wrap gap-2">
              {result ? (
                <button type="button" onClick={clearWorkspace} className="min-h-12 rounded-2xl border border-cyan-100/12 bg-white/[0.03] px-4 text-sm font-semibold text-cyan-100/65 transition hover:bg-white/[0.07] hover:text-white">
                  Clear
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void runAnalysis()}
                disabled={loading || !careersUrl.trim()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-200/20 bg-cyan-300/14 px-5 text-sm font-bold text-cyan-50 shadow-[0_0_28px_rgba(34,211,238,.10)] transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {loading ? <Loader2 size={17} className="animate-spin" /> : <Radar size={17} />}
                {loading ? "Analyzing postings…" : "Analyze careers site"}
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-cyan-100/42">
            <span className="mr-1">Dedicated adapters:</span>
            {["Workday", "Greenhouse", "Lever", "Ashby", "SmartRecruiters"].map((platform) => (
              <span key={platform} className="rounded-full border border-cyan-100/10 bg-white/[0.025] px-2.5 py-1">{platform}</span>
            ))}
            <span className="rounded-full border border-cyan-100/10 bg-white/[0.025] px-2.5 py-1">Structured JobPosting fallback</span>
          </div>
        </GlassCard>

        {error ? (
          <GlassCard className="mb-6 border-rose-300/18 p-4">
            <div className="flex items-start gap-3 text-rose-100">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-bold">Hiring analysis could not run</p>
                <p className="mt-1 text-xs leading-5 text-rose-100/65">{error}</p>
              </div>
            </div>
          </GlassCard>
        ) : null}

        {result ? (
          <>
            <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Open postings" value={result.summary.totalJobs} note={`Detected through ${platformLabel(result.platform)}.`} />
              <MetricCard label="Hiring locations" value={result.summary.uniqueLocations} note="Distinct location labels in current postings." />
              <MetricCard label="Countries" value={result.summary.countries || "—"} note="Countries explicitly identified by the source." />
              <MetricCard label="Remote / hybrid" value={result.summary.remoteJobs} note="Postings containing remote or hybrid indicators." />
            </div>

            <GlassCard className="mb-5 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  {result.coverage.complete ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" /> : <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" />}
                  <div>
                    <p className="text-sm font-bold text-white">{result.companyName}</p>
                    <p className="mt-1 text-xs leading-5 text-cyan-100/52">
                      {platformLabel(result.platform)} · {result.coverage.analyzedPages} public page{result.coverage.analyzedPages === 1 ? "" : "s"} inspected · {result.coverage.complete ? "Complete adapter response" : "Partial coverage"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-cyan-100/42">{result.coverage.note}</p>
                  </div>
                </div>
                <a href={result.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-200/75 hover:text-cyan-100">
                  Open careers source <ExternalLink size={14} />
                </a>
              </div>
            </GlassCard>

            {result.warnings.length > 0 ? (
              <GlassCard className="mb-5 border-amber-200/15 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                  <div>
                    <p className="text-sm font-bold text-amber-100">Coverage notes</p>
                    <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-100/65">
                      {result.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                    </ul>
                  </div>
                </div>
              </GlassCard>
            ) : null}

            <div className="mb-5 grid gap-5 2xl:grid-cols-2">
              <AnalysisChart title="Where hiring is concentrated" subtitle="Current postings grouped by the location text published on the careers site." data={result.summary.topLocations} />
              <AnalysisChart title="Position types in demand" subtitle="Titles and departments classified into practical job-family groups." data={result.summary.jobFamilies} />
            </div>

            <div className="mb-5 grid gap-5 2xl:grid-cols-2">
              <AnalysisChart title="Seniority mix" subtitle="A title-based view of leadership, management, senior, entry, and individual-contributor demand." data={result.summary.seniority} />
              <AnalysisChart title="Remote, hybrid, and onsite signals" subtitle="Work-arrangement indicators found in published location and description text." data={result.summary.remoteMix} />
            </div>

            <GlassCard className="overflow-hidden">
              <div className="border-b border-cyan-100/10 p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/40">Extracted postings</p>
                    <h2 className="mt-2 text-xl font-black text-white">Hiring review table</h2>
                    <p className="mt-1 text-xs text-cyan-100/45">{filteredJobs.length} of {result.jobs.length} postings shown</p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    <label className="flex min-h-10 items-center gap-2 rounded-xl border border-cyan-100/10 bg-black/20 px-3">
                      <Search size={14} className="text-cyan-100/35" />
                      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search jobs" className="w-full bg-transparent text-xs text-cyan-50 outline-none placeholder:text-cyan-100/28" />
                    </label>
                    <label className="flex min-h-10 items-center gap-2 rounded-xl border border-cyan-100/10 bg-black/20 px-3">
                      <Filter size={14} className="text-cyan-100/35" />
                      <select value={familyFilter} onChange={(event) => setFamilyFilter(event.target.value)} className="w-full bg-transparent text-xs text-cyan-50 outline-none">
                        <option value="all" className="bg-[#06111d]">All job families</option>
                        {familyOptions.map((family) => <option key={family} value={family} className="bg-[#06111d]">{family}</option>)}
                      </select>
                    </label>
                    <label className="flex min-h-10 items-center gap-2 rounded-xl border border-cyan-100/10 bg-black/20 px-3">
                      <MapPin size={14} className="text-cyan-100/35" />
                      <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} className="w-full bg-transparent text-xs text-cyan-50 outline-none">
                        <option value="all" className="bg-[#06111d]">All locations</option>
                        {locationOptions.map((location) => <option key={location} value={location} className="bg-[#06111d]">{location}</option>)}
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left">
                  <thead className="bg-white/[0.025] text-[10px] uppercase tracking-[0.18em] text-cyan-100/38">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Position</th>
                      <th className="px-4 py-3 font-semibold">Location</th>
                      <th className="px-4 py-3 font-semibold">Job family</th>
                      <th className="px-4 py-3 font-semibold">Seniority</th>
                      <th className="px-4 py-3 font-semibold">Posted</th>
                      <th className="px-5 py-3 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-100/[0.07]">
                    {filteredJobs.map((job, index) => (
                      <tr key={`${job.id}-${index}`} className="transition hover:bg-white/[0.025]">
                        <td className="px-5 py-4">
                          <p className="max-w-[340px] text-sm font-bold text-white">{job.title}</p>
                          <p className="mt-1 text-xs text-cyan-100/42">{job.department || job.employmentType || platformLabel(job.adapter)}</p>
                        </td>
                        <td className="px-4 py-4 text-xs text-cyan-100/65">{job.locationText}</td>
                        <td className="px-4 py-4 text-xs text-cyan-100/65">{job.jobFamily}</td>
                        <td className="px-4 py-4 text-xs text-cyan-100/65">{job.seniority}</td>
                        <td className="px-4 py-4 text-xs text-cyan-100/52">{formatDate(job.postedAt)}</td>
                        <td className="px-5 py-4 text-right">
                          <button type="button" onClick={() => setSelectedJobId(job.id)} className="rounded-xl border border-cyan-100/12 bg-cyan-300/[0.07] px-3 py-2 text-xs font-bold text-cyan-100 transition hover:bg-cyan-300/[0.14]">
                            View details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredJobs.length === 0 ? (
                  <div className="border-t border-cyan-100/8 px-5 py-12 text-center text-sm text-cyan-100/40">No postings match the current filters.</div>
                ) : null}
              </div>
            </GlassCard>
          </>
        ) : null}
      </section>

      {selectedJob ? <JobEvidenceDrawer job={selectedJob} onClose={() => setSelectedJobId(null)} /> : null}
    </main>
  );
}

function JobEvidenceDrawer({ job, onClose }: { job: HiringJob; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" onMouseDown={onClose}>
      <aside className="absolute right-0 top-0 h-full w-full max-w-[470px] overflow-y-auto border-l border-cyan-100/14 bg-[#050d18]/98 p-6 shadow-[-30px_0_90px_rgba(0,0,0,.55)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/40">Job evidence</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">{job.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close job details" className="rounded-xl border border-cyan-100/12 p-2 text-cyan-100/55 transition hover:bg-white/[0.06] hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 space-y-3">
          <EvidenceRow icon={<Building2 size={15} />} label="Company" value={job.companyName || "Not stated"} />
          <EvidenceRow icon={<MapPin size={15} />} label="Location" value={job.locationText} />
          <EvidenceRow icon={<BriefcaseBusiness size={15} />} label="Job family" value={job.jobFamily} />
          <EvidenceRow icon={<ShieldCheck size={15} />} label="Seniority" value={job.seniority} />
          <EvidenceRow icon={<Globe2 size={15} />} label="Work arrangement" value={job.remoteType} />
          <EvidenceRow icon={<Radar size={15} />} label="Source adapter" value={platformLabel(job.adapter)} />
        </div>

        {job.description ? (
          <div className="mt-6 rounded-2xl border border-cyan-100/10 bg-white/[0.025] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/38">Published description excerpt</p>
            <p className="mt-3 text-sm leading-6 text-cyan-100/65">{job.description}</p>
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-cyan-100/10 bg-black/20 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/38">Provenance</p>
          <p className="mt-2 break-all text-xs leading-5 text-cyan-100/48">{job.source}</p>
          <p className="mt-3 text-xs leading-5 text-cyan-100/42">Classification is derived from the published title, department, location, and description. It should be treated as analytical context rather than an employer-confirmed organizational taxonomy.</p>
        </div>

        <a href={job.url} target="_blank" rel="noreferrer" className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-200/20 bg-cyan-300/12 px-4 text-sm font-bold text-cyan-50 transition hover:bg-cyan-300/18">
          Open original posting <ExternalLink size={16} />
        </a>
      </aside>
    </div>
  );
}

function EvidenceRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-cyan-100/10 bg-white/[0.025] p-3.5">
      <div className="mt-0.5 text-cyan-200/55">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/35">{label}</p>
        <p className="mt-1 text-sm font-semibold capitalize text-cyan-50">{value}</p>
      </div>
    </div>
  );
}
