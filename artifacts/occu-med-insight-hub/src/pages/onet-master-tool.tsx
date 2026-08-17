import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  BriefcaseBusiness,
  CloudSun,
  Ear,
  Eye,
  HeartPulse,
  Layers3,
  ListChecks,
  Loader2,
  Search,
  ShieldAlert,
  Sparkles,
  Truck,
  Wind,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassCard } from "@/components/insight/GlassCard";
import {
  EvidenceGradeBadge,
  MetricOrb,
  OccupationalToolShell,
  SectionTabs,
  ToolHero,
} from "@/components/insight/OccupationalToolPrimitives";

type Manifest = {
  workforceGroups: Array<{ id: string; label: string; description: string; occupations: string[] }>;
  serviceOpportunities: Array<{ id: string; label: string; description: string; occupations: string[] }>;
};

type EvidenceItem = {
  id?: string;
  name: string;
  description?: string;
  value?: number;
  category?: string;
  response?: Array<{ percentage?: number; description?: string }>;
};

type OnetProfile = {
  occupation: { code: string; title: string; description: string };
  tasks: EvidenceItem[];
  workContext: EvidenceItem[];
  abilities: EvidenceItem[];
  workActivities: EvidenceItem[];
  detailedWorkActivities: EvidenceItem[];
  serviceMatches: Array<{ id: string; label: string; description: string; count: number; evidence: EvidenceItem[] }>;
  counts: Record<string, number>;
  partialErrors: string[];
};

type ProfileResponse = {
  ok: boolean;
  keyword?: string;
  matches?: Array<{ code: string; title: string; score?: number }>;
  profile?: OnetProfile | null;
  message?: string;
  source?: string;
  limitation?: string;
  error?: string;
};

type ViewId = "overview" | "tasks" | "demands" | "context" | "services";

const tabs: Array<{ id: ViewId; label: string; icon: typeof Activity }> = [
  { id: "overview", label: "Command View", icon: Activity },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "demands", label: "Abilities & Activities", icon: BrainCircuit },
  { id: "context", label: "Work Context", icon: CloudSun },
  { id: "services", label: "Occu-Med Service Evidence", icon: HeartPulse },
];

const serviceIcons: Record<string, typeof Activity> = {
  hearing: Ear,
  respirator: Wind,
  physical: Activity,
  driver: Truck,
  heat: CloudSun,
  vision: Eye,
  fatigue: BrainCircuit,
  surveillance: HeartPulse,
};

function compact(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(0) : "—";
}

function EvidenceList({ title, items, tone = "cyan", limit = 40 }: { title: string; items: EvidenceItem[]; tone?: "cyan" | "violet" | "rose" | "emerald" | "amber"; limit?: number }) {
  const classes = {
    cyan: "border-cyan-100/13 bg-cyan-300/[0.04]",
    violet: "border-violet-100/13 bg-violet-300/[0.04]",
    rose: "border-rose-100/13 bg-rose-300/[0.04]",
    emerald: "border-emerald-100/13 bg-emerald-300/[0.04]",
    amber: "border-amber-100/13 bg-amber-300/[0.04]",
  }[tone];
  return (
    <GlassCard className="p-5">
      <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/52">O*NET source evidence</p><h2 className="mt-1 text-lg font-black text-white">{title}</h2></div><span className="text-xs text-cyan-50/45">{items.length} items</span></div>
      <div className="mt-4 space-y-2">
        {items.slice(0, limit).map((item, index) => (
          <motion.div key={`${item.id || item.name}-${index}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={`rounded-xl border p-3 ${classes}`}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-xs font-bold leading-5 text-white">{item.name}</p>{item.description ? <p className="mt-1 text-[10px] leading-5 text-cyan-50/52">{item.description}</p> : null}</div><div className="flex shrink-0 flex-col items-end gap-1">{item.value != null ? <span className="rounded-full border border-white/10 bg-black/15 px-2 py-1 text-[9px] font-black text-cyan-50/70">O*NET value {compact(item.value)}</span> : null}{item.category ? <span className="text-[9px] font-bold text-emerald-100/65">{item.category}</span> : null}</div></div>
            {item.response?.length ? <div className="mt-2 flex flex-wrap gap-1.5">{item.response.slice(0, 5).map((response, responseIndex) => <span key={`${item.name}-${responseIndex}`} className="rounded-full border border-white/9 px-2 py-1 text-[8px] text-cyan-50/50">{response.percentage != null ? `${response.percentage.toFixed(0)}% · ` : ""}{response.description}</span>)}</div> : null}
          </motion.div>
        ))}
        {!items.length ? <p className="rounded-xl border border-dashed border-white/12 p-6 text-center text-xs text-cyan-50/48">No source items returned for this section.</p> : null}
      </div>
    </GlassCard>
  );
}

function Library({ manifest, onOccupation }: { manifest: Manifest; onOccupation: (occupation: string) => void }) {
  const [selectedService, setSelectedService] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const service = manifest.serviceOpportunities.find((item) => item.id === selectedService);
  const group = manifest.workforceGroups.find((item) => item.id === selectedGroup);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 2xl:grid-cols-[1fr_1fr]">
        <GlassCard className="p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/52">Browse by Occu-Med service opportunity</p><h2 className="mt-1 text-xl font-black text-white">Start with the service question, not a job-title guess.</h2></div><HeartPulse size={20} className="text-rose-200/60" /></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {manifest.serviceOpportunities.map((item) => {
              const Icon = serviceIcons[item.id] ?? Sparkles;
              const active = selectedService === item.id;
              return <button key={item.id} type="button" onClick={() => { setSelectedService(active ? "" : item.id); setSelectedGroup(""); }} className={`rounded-2xl border p-4 text-left transition ${active ? "border-cyan-200/28 bg-cyan-300/[0.08]" : "border-white/10 bg-[#071321]/72 hover:border-cyan-200/20"}`}><Icon size={17} className="text-cyan-200/65" /><p className="mt-2 text-xs font-black text-white">{item.label}</p><p className="mt-1 text-[10px] leading-5 text-cyan-50/50">{item.description}</p><p className="mt-2 text-[9px] font-bold uppercase tracking-[0.12em] text-cyan-200/55">{item.occupations.length} ready occupation examples</p></button>;
            })}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-50/52">Browse by workforce</p><h2 className="mt-1 text-xl font-black text-white">Common occupational groups are already mapped.</h2></div><BriefcaseBusiness size={20} className="text-violet-200/60" /></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {manifest.workforceGroups.map((item) => {
              const active = selectedGroup === item.id;
              return <button key={item.id} type="button" onClick={() => { setSelectedGroup(active ? "" : item.id); setSelectedService(""); }} className={`rounded-2xl border p-4 text-left transition ${active ? "border-violet-200/28 bg-violet-300/[0.08]" : "border-white/10 bg-[#071321]/72 hover:border-violet-200/20"}`}><Layers3 size={17} className="text-violet-200/65" /><p className="mt-2 text-xs font-black text-white">{item.label}</p><p className="mt-1 text-[10px] leading-5 text-cyan-50/50">{item.description}</p><p className="mt-2 text-[9px] font-bold uppercase tracking-[0.12em] text-violet-200/55">{item.occupations.length} ready occupations</p></button>;
            })}
          </div>
        </GlassCard>
      </div>

      {service || group ? (
        <GlassCard className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/52">Ready occupation library</p>
          <h2 className="mt-1 text-xl font-black text-white">{service?.label ?? group?.label}</h2>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-cyan-50/56">{service?.description ?? group?.description}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(service?.occupations ?? group?.occupations ?? []).map((occupation) => <button key={occupation} type="button" onClick={() => onOccupation(occupation)} className="rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-left text-xs font-bold text-white transition hover:border-cyan-200/24 hover:bg-cyan-300/[0.055]">{occupation}<span className="mt-1 block text-[9px] font-normal text-cyan-50/42">Load live O*NET evidence</span></button>)}
          </div>
        </GlassCard>
      ) : null}
    </div>
  );
}

export default function OnetMasterTool() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState<ProfileResponse | null>(null);
  const [activeView, setActiveView] = useState<ViewId>("overview");

  useEffect(() => {
    void fetch("/api/occupational-discovery/manifest").then((result) => result.json()).then((payload) => { if (payload.ok) setManifest(payload); }).catch(() => undefined);
  }, []);

  async function analyze(value?: string) {
    const query = (value ?? keyword).trim();
    if (!query) return;
    setKeyword(query); setLoading(true); setError(""); setResponse(null); setActiveView("overview");
    try {
      const result = await fetch(`/api/occupational-discovery/onet/profile?keyword=${encodeURIComponent(query)}`);
      const payload = await result.json() as ProfileResponse;
      if (!result.ok || !payload.ok) throw new Error(payload.error || "O*NET analysis failed.");
      setResponse(payload);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "O*NET analysis failed."); }
    finally { setLoading(false); }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) { if (event.key === "Enter") void analyze(); }

  const profile = response?.profile ?? null;
  const totalEvidence = useMemo(() => profile ? profile.tasks.length + profile.workContext.length + profile.abilities.length + profile.workActivities.length + profile.detailedWorkActivities.length : 0, [profile]);
  const chart = profile ? [
    { category: "Tasks", items: profile.tasks.length },
    { category: "Work context", items: profile.workContext.length },
    { category: "Abilities", items: profile.abilities.length },
    { category: "Activities", items: profile.workActivities.length },
    { category: "Detailed", items: profile.detailedWorkActivities.length },
  ] : [];

  return (
    <OccupationalToolShell eyebrow="Independent Intelligence Tool · O*NET Web Services" title="O*NET Master Tool" subtitle="Browse occupational evidence by workforce and Occu-Med service opportunity before using free-text search." notice="This workspace uses O*NET occupational source data only. Standardized O*NET values and respondent percentages are shown where the source returns them. Service matches are transparent evidence filters, not individual medical conclusions or unsupported risk scores.">
      <ToolHero kicker="Discovery-first occupational evidence" title="Nobody should have to know which job title to search before the tool becomes useful." description="Start with hearing conservation, respiratory programs, physical demands, driving, heat, vision, fatigue, surveillance, or a common workforce group. Insight Hub supplies the occupation library; O*NET supplies the evidence."><div className="grid grid-cols-3 gap-2"><div className="rounded-xl border border-white/12 bg-black/20 p-3 text-center"><HeartPulse className="mx-auto text-rose-200/65" size={18} /><p className="mt-2 text-xl font-black text-white">{manifest?.serviceOpportunities.length ?? "—"}</p><p className="text-[9px] text-cyan-50/45">Service libraries</p></div><div className="rounded-xl border border-white/12 bg-black/20 p-3 text-center"><Layers3 className="mx-auto text-violet-200/65" size={18} /><p className="mt-2 text-xl font-black text-white">{manifest?.workforceGroups.length ?? "—"}</p><p className="text-[9px] text-cyan-50/45">Workforce groups</p></div><div className="rounded-xl border border-white/12 bg-black/20 p-3 text-center"><Search className="mx-auto text-cyan-200/65" size={18} /><p className="mt-2 text-xl font-black text-white">2nd</p><p className="text-[9px] text-cyan-50/45">Search priority</p></div></div></ToolHero>

      {error ? <GlassCard className="mb-5 border-rose-200/18 p-5"><div className="flex gap-3 text-rose-100"><AlertTriangle size={18} className="mt-0.5 shrink-0" /><div><p className="font-black">O*NET analysis unavailable</p><p className="mt-2 text-xs leading-6 text-rose-50/70">{error}</p></div></div></GlassCard> : null}

      {!profile ? (
        <>
          {manifest ? <Library manifest={manifest} onOccupation={(occupation) => void analyze(occupation)} /> : <GlassCard className="p-8 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-200/60" /><p className="mt-3 font-black text-white">Loading occupation libraries</p></GlassCard>}
          <GlassCard className="mt-5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/48">Advanced occupation search</p><h2 className="mt-1 text-lg font-black text-white">Can't find it in the prepared libraries?</h2><p className="mt-1 text-[10px] leading-5 text-cyan-50/48">Search any O*NET occupation here. Search is the fallback, not the product.</p></div><Search size={18} className="text-cyan-200/55" /></div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row"><input value={keyword} onChange={(event) => setKeyword(event.target.value)} onKeyDown={onKeyDown} placeholder="Search any occupation…" className="min-h-11 flex-1 rounded-xl border border-white/12 bg-[#040c16]/92 px-4 text-sm text-white outline-none placeholder:text-cyan-50/34" /><button type="button" onClick={() => void analyze()} disabled={loading || !keyword.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-200/24 bg-cyan-300/12 px-5 text-sm font-black text-white disabled:opacity-45">{loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}{loading ? "Loading" : "Analyze"}</button></div>
          </GlassCard>
        </>
      ) : (
        <>
          <button type="button" onClick={() => { setResponse(null); setKeyword(""); }} className="mb-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#06101d]/80 px-3 py-2 text-xs font-bold text-cyan-50/65 hover:text-white"><ArrowLeft size={14} />Back to occupation library</button>
          <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricOrb label="Resolved occupation" value={profile.occupation.title} note={profile.occupation.code} icon={BriefcaseBusiness} /><MetricOrb label="Returned source items" value={totalEvidence.toLocaleString()} note="Tasks + context + abilities + activities" icon={Layers3} tone="violet" /><MetricOrb label="Service evidence groups" value={profile.serviceMatches.length.toString()} note="Transparent evidence filters with matches" icon={HeartPulse} tone="rose" /><MetricOrb label="Unsupported risk score" value="None" note="Source values stay source values" icon={ShieldAlert} tone="emerald" /></section>
          <GlassCard className="mb-5 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/52">Occupation resolved from O*NET</p><h2 className="mt-1 text-2xl font-black text-white">{profile.occupation.title}</h2><p className="mt-2 max-w-4xl text-xs leading-6 text-cyan-50/60">{profile.occupation.description || "O*NET did not return an occupation description in this response."}</p></div><EvidenceGradeBadge grade="A" /></div>{profile.partialErrors.length ? <p className="mt-3 text-[10px] text-amber-50/65">Partial source sections unavailable: {profile.partialErrors.join(", ")}</p> : null}</GlassCard>
          <SectionTabs tabs={tabs} active={activeView} onChange={setActiveView} />
          <AnimatePresence mode="wait"><motion.div key={activeView} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
            {activeView === "overview" ? <div className="grid gap-5 2xl:grid-cols-[.8fr_1.2fr]"><GlassCard className="p-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/52">Returned evidence volume</p><div className="mt-3 h-[360px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} layout="vertical"><CartesianGrid stroke="rgba(165,243,252,.09)" horizontal={false} /><XAxis type="number" tick={{ fill: "rgba(207,250,254,.5)", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="category" width={105} tick={{ fill: "rgba(207,250,254,.68)", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "#06101d", border: "1px solid rgba(103,232,249,.2)", borderRadius: 12 }} /><Bar dataKey="items" fill="#67e8f9" radius={[0, 8, 8, 0]} /></BarChart></ResponsiveContainer></div><p className="text-[10px] leading-5 text-cyan-50/45">Counts describe source items returned by O*NET. They are not severity or risk scores.</p></GlassCard><GlassCard className="p-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-rose-50/52">Occu-Med opportunity evidence</p><h2 className="mt-1 text-xl font-black text-white">Which service questions deserve review?</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{profile.serviceMatches.map((service) => { const Icon = serviceIcons[service.id] ?? HeartPulse; return <div key={service.id} className="rounded-2xl border border-white/10 bg-black/15 p-4"><div className="flex items-start justify-between gap-3"><div><Icon size={17} className="text-rose-200/65" /><p className="mt-2 text-xs font-black text-white">{service.label}</p></div><span className="text-lg font-black text-rose-100">{service.count}</span></div><p className="mt-2 text-[10px] leading-5 text-cyan-50/50">{service.description}</p><p className="mt-2 line-clamp-2 text-[9px] leading-4 text-cyan-50/42">Evidence: {service.evidence.slice(0, 2).map((item) => item.name).join(" · ")}</p></div>; })}{!profile.serviceMatches.length ? <p className="text-xs text-cyan-50/50">No configured service-evidence terms matched the returned O*NET items.</p> : null}</div></GlassCard></div> : null}
            {activeView === "tasks" ? <EvidenceList title="Task statements — core/supplemental and importance where returned" items={profile.tasks} tone="emerald" /> : null}
            {activeView === "demands" ? <div className="grid gap-5 xl:grid-cols-2"><EvidenceList title="Abilities" items={profile.abilities} tone="violet" /><EvidenceList title="Work activities" items={profile.workActivities} tone="cyan" /><div className="xl:col-span-2"><EvidenceList title="Detailed work activities" items={profile.detailedWorkActivities} tone="emerald" limit={60} /></div></div> : null}
            {activeView === "context" ? <EvidenceList title="Work context — standardized context and respondent percentages where returned" items={profile.workContext} tone="amber" limit={70} /> : null}
            {activeView === "services" ? <div className="space-y-5">{profile.serviceMatches.map((service) => <EvidenceList key={service.id} title={`${service.label} · ${service.count} matched source items`} items={service.evidence} tone="rose" limit={40} />)}{!profile.serviceMatches.length ? <GlassCard className="p-8 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-cyan-200/50" /><p className="mt-3 font-black text-white">No configured service-evidence matches</p><p className="mt-2 text-xs text-cyan-50/50">This does not mean the occupation has no occupational-health considerations; it only means the current transparent filter found no matching returned source terms.</p></GlassCard> : null}</div> : null}
          </motion.div></AnimatePresence>
          {response?.limitation ? <p className="mt-5 rounded-xl border border-amber-200/12 bg-amber-300/[0.04] p-4 text-[10px] leading-5 text-amber-50/62">{response.limitation}</p> : null}
        </>
      )}
    </OccupationalToolShell>
  );
}
