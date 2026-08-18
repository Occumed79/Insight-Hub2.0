import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Atom,
  BookOpenCheck,
  BriefcaseBusiness,
  Calculator,
  CheckCircle2,
  ClipboardList,
  Database,
  Droplets,
  ExternalLink,
  Flame,
  Heart,
  HeartPulse,
  Loader2,
  MapPinned,
  Pill,
  Plus,
  Radar,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Truck,
  Waves,
  X,
  Zap,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";

type AnyRecord = Record<string, any>;

async function loadJson(url: string): Promise<any> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status}).`);
  return payload;
}

function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <GlassCard
      variant="glass"
      className={`border border-white/24 bg-white/[0.065] p-[1px] shadow-[0_24px_72px_rgba(0,0,0,.28),0_0_34px_rgba(186,230,253,.07)] backdrop-blur-3xl ${className}`}
    >
      <div className="h-full rounded-[27px] border border-white/[0.14] bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.17)] md:p-6">
        {children}
      </div>
    </GlassCard>
  );
}

function ToolShell({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="aurora-bg min-h-screen pb-24 text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 pt-24 lg:ml-[210px] lg:px-12 lg:pt-8">
        <HeaderBar eyebrow={eyebrow} title={title} subtitle={subtitle} />
        {children}
      </section>
    </main>
  );
}

function Tabs({ items, active, onChange }: { items: Array<{ id: string; label: string }>; active: string; onChange: (id: any) => void }) {
  return (
    <div className="mb-6 flex gap-2 overflow-x-auto pb-1" role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={active === item.id}
          onClick={() => onChange(item.id)}
          className={`min-h-11 whitespace-nowrap rounded-2xl border px-4 text-xs font-bold backdrop-blur-xl transition ${
            active === item.id
              ? "border-cyan-100/38 bg-cyan-300/[0.13] text-white shadow-[0_0_24px_rgba(34,211,238,.10),inset_0_1px_0_rgba(255,255,255,.20)]"
              : "border-white/16 bg-white/[0.035] text-cyan-100/58 hover:border-cyan-100/28 hover:text-white"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function StatusPill({ children, tone = "cyan" }: { children: ReactNode; tone?: "cyan" | "green" | "amber" | "red" }) {
  const colors = {
    cyan: "border-cyan-200/20 bg-cyan-300/[0.07] text-cyan-50/78",
    green: "border-emerald-200/20 bg-emerald-300/[0.07] text-emerald-50/80",
    amber: "border-amber-200/20 bg-amber-300/[0.07] text-amber-50/80",
    red: "border-rose-200/20 bg-rose-300/[0.07] text-rose-50/80",
  };
  return <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] ${colors[tone]}`}>{children}</span>;
}

function Loading({ text = "Loading source data…" }: { text?: string }) {
  return <div className="flex min-h-28 items-center justify-center gap-3 text-sm text-cyan-100/55"><Loader2 size={18} className="animate-spin" />{text}</div>;
}
function ErrorState({ error }: { error: string }) {
  return <div className="rounded-2xl border border-rose-200/16 bg-rose-300/[0.05] p-4 text-sm text-rose-50/75"><AlertTriangle size={16} className="mr-2 inline" />{error}</div>;
}
function SourceLink({ href, label }: { href: string; label: string }) {
  return <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-100/70 transition hover:text-white">{label}<ArrowUpRight size={12} /></a>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Injuries & Medical Conditions
// ─────────────────────────────────────────────────────────────────────────────

const CONDITIONS = [
  { id: "diabetes", label: "Diabetes", domains: ["glycemic stability", "hypoglycemia", "medication access", "renal / cardiovascular context"], prompts: ["What is the current A1C and treatment route?", "Any severe hypoglycemia or impaired awareness?", "Can medication, monitoring supplies, food, and storage be maintained in the work setting?"], docs: ["Recent A1C", "Medication list", "Glucose-monitoring history", "Complication / specialist documentation when applicable"] },
  { id: "osa", label: "Obstructive Sleep Apnea", domains: ["alertness", "PAP adherence", "fatigue", "power / equipment access"], prompts: ["What was the diagnostic AHI/RDI?", "Is there objective PAP compliance data?", "Any residual daytime sleepiness or safety-sensitive symptoms?"], docs: ["Sleep study", "30–90 day PAP download", "Epworth / symptom history", "Device / battery plan when relevant"] },
  { id: "hypertension", label: "Hypertension", domains: ["blood pressure control", "medication tolerance", "cardiovascular risk", "exertion"], prompts: ["Are repeated resting blood pressures available?", "Any dizziness, syncope, or medication side effects?", "Is additional cardiac risk assessment required by the controlling program?"], docs: ["Serial blood pressures", "Medication history", "Cardiology records when indicated"] },
  { id: "asthma", label: "Asthma / Reactive Airway Disease", domains: ["respiratory reserve", "trigger exposure", "rescue medication", "PPE / respirator tolerance"], prompts: ["Current severity and symptom frequency?", "Recent ER visits, hospitalization, or systemic steroids?", "Pulmonary function / FEV1 available?", "Can required respiratory protection be used?"], docs: ["Spirometry/PFT", "ACT or symptom history", "Recent urgent-care records", "Medication plan"] },
  { id: "seizure", label: "Seizure Disorder", domains: ["loss of consciousness", "medication stability", "driving / heights", "emergency access"], prompts: ["Date and circumstances of last seizure?", "Current anticonvulsant indication and stability?", "Any duty involving driving, weapons, heights, or hazardous machinery?"], docs: ["Neurology note", "Seizure history", "Medication list / levels when applicable"] },
  { id: "cardiac", label: "Cardiovascular Disease", domains: ["functional capacity", "ischemia", "arrhythmia", "anticoagulation"], prompts: ["Symptoms with exertion?", "Most recent functional testing / METs?", "Any rhythm disorder or anticoagulant therapy?"], docs: ["Cardiology note", "ECG", "Stress test / echo when applicable", "Medication list"] },
  { id: "behavioral", label: "Behavioral Health", domains: ["stability", "sleep", "judgment", "medication effects"], prompts: ["Current diagnosis and treatment stability?", "Any recent hospitalization, self-harm, or major functional change?", "Any medication side effects relevant to safety-sensitive work?"], docs: ["Treating clinician summary", "Medication history", "Functional / stability documentation"] },
  { id: "musculoskeletal", label: "Musculoskeletal Condition", domains: ["lifting / carrying", "mobility", "pain", "PPE / emergency egress"], prompts: ["What movements or loads reproduce symptoms?", "Any restrictions, assistive devices, or recent surgery?", "Can the person meet the actual job task and emergency egress demands?"], docs: ["Orthopedic / PT note", "Functional restrictions", "Imaging when clinically relevant", "Job-demand description"] },
] as const;

export function ReviewerInjuriesMedicalPage() {
  const [tab, setTab] = useState<"injury" | "conditions">("injury");
  const [osha, setOsha] = useState<any>(null);
  const [oshaError, setOshaError] = useState("");
  const [occupation, setOccupation] = useState("");
  const [onet, setOnet] = useState<any>(null);
  const [onetLoading, setOnetLoading] = useState(false);
  const [conditionId, setConditionId] = useState<(typeof CONDITIONS)[number]["id"]>("diabetes");

  useEffect(() => {
    void loadJson("/api/occupational-discovery/osha-overview").then(setOsha).catch((error) => setOshaError(error.message));
  }, []);
  async function runOccupation() {
    if (!occupation.trim()) return;
    setOnetLoading(true);
    try { setOnet(await loadJson(`/api/occupational-discovery/onet/profile?keyword=${encodeURIComponent(occupation.trim())}`)); }
    catch (error) { setOnet({ error: error instanceof Error ? error.message : "O*NET request failed." }); }
    finally { setOnetLoading(false); }
  }
  const condition = CONDITIONS.find((item) => item.id === conditionId) ?? CONDITIONS[0];
  const profile = onet?.profile;

  return (
    <ToolShell eyebrow="Clinical / Occupational Health Intelligence" title="Injuries & Medical Conditions" subtitle="Occupation-linked injury surveillance and condition-specific reviewer context, transplanted into the native Insight Hub 2 workspace.">
      <Tabs items={[{ id: "injury", label: "Injury Intelligence" }, { id: "conditions", label: "Medical Conditions" }]} active={tab} onChange={setTab} />
      {tab === "injury" ? (
        <div className="space-y-6">
          <Surface>
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <label><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/52">Occupation</span><div className="mt-2 flex min-h-12 items-center gap-3 rounded-2xl border border-white/20 bg-white/[0.045] px-4"><Search size={16} className="text-cyan-100/50" /><input value={occupation} onChange={(event) => setOccupation(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void runOccupation()} placeholder="Firefighter, electrician, truck driver…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-cyan-100/30" /></div></label>
              <button type="button" onClick={() => void runOccupation()} disabled={onetLoading || !occupation.trim()} className="min-h-12 rounded-2xl border border-cyan-100/24 bg-cyan-300/[0.10] px-5 text-sm font-black disabled:opacity-40">{onetLoading ? <Loader2 size={16} className="mr-2 inline animate-spin" /> : <Radar size={16} className="mr-2 inline" />}Build occupation profile</button>
            </div>
          </Surface>
          <div className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
            <Surface>
              <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/48">OSHA imported intelligence</p><h2 className="mt-2 text-xl font-black">Reported injury burden</h2></div><Database className="text-cyan-100/55" /></div>
              {oshaError ? <ErrorState error={oshaError} /> : !osha ? <Loading /> : !osha.imported ? <p className="mt-5 text-sm leading-6 text-cyan-100/55">{osha.warning || "No OSHA ITA rows are imported yet."}</p> : <div className="mt-5 grid gap-3 sm:grid-cols-2"><Metric label="Latest year" value={String(osha.latestYear || "—")} /><Metric label="Top employer cases" value={String(osha.topEmployers?.[0]?.total_cases ?? "—")} /><Metric label="Top state cases" value={String(osha.topStates?.[0]?.total_cases ?? "—")} /><Metric label="High-rate establishments" value={String(osha.highRateEstablishments?.length ?? 0)} /></div>}
              <p className="mt-5 text-[11px] leading-5 text-cyan-100/38">OSHA ITA reporting is not representative of every employer and does not establish fault, negligence, compensability, or causation.</p>
            </Surface>
            <Surface>
              <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-100/48">O*NET source evidence</p><h2 className="mt-2 text-xl font-black">Occupation demand profile</h2></div><BriefcaseBusiness className="text-violet-100/55" /></div>
              {onetLoading ? <Loading text="Loading O*NET evidence…" /> : onet?.error ? <ErrorState error={onet.error} /> : profile ? <div className="mt-5"><h3 className="text-lg font-black">{profile.occupation?.title}</h3><p className="mt-2 text-sm leading-6 text-cyan-100/55">{profile.occupation?.description}</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{(profile.serviceMatches || []).slice(0, 8).map((item: any) => <div key={item.id} className="rounded-2xl border border-white/12 bg-white/[0.025] p-4"><div className="flex items-start justify-between gap-2"><strong className="text-sm">{item.label}</strong><StatusPill>{item.count} hits</StatusPill></div><p className="mt-2 text-xs leading-5 text-cyan-100/45">{item.description}</p></div>)}</div></div> : <p className="mt-5 text-sm text-cyan-100/50">Search an occupation to combine O*NET job-demand evidence with the injury workspace.</p>}
            </Surface>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <Surface><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/48">Condition library</p><div className="mt-4 space-y-2">{CONDITIONS.map((item) => <button key={item.id} type="button" onClick={() => setConditionId(item.id)} className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${conditionId === item.id ? "border-cyan-100/30 bg-cyan-300/[0.11]" : "border-white/10 bg-white/[0.025] text-cyan-50/65 hover:border-white/20"}`}>{item.label}</button>)}</div></Surface>
          <Surface><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-100/48">Clinical context</p><h2 className="mt-2 text-2xl font-black">{condition.label}</h2></div><Stethoscope className="text-violet-100/55" /></div><div className="mt-6 grid gap-4 lg:grid-cols-3"><ListBlock title="Functional domains" items={[...condition.domains]} /><ListBlock title="Questions to resolve" items={[...condition.prompts]} /><ListBlock title="Useful documentation" items={[...condition.docs]} /></div><p className="mt-6 rounded-2xl border border-amber-200/14 bg-amber-300/[0.04] p-4 text-xs leading-6 text-amber-50/65">Condition context supports reviewer questioning; it does not independently determine fitness, disability, causation, or clearance.</p></Surface>
        </div>
      )}
    </ToolShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/12 bg-white/[0.025] p-4"><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-100/42">{label}</p><strong className="mt-2 block text-2xl font-black">{value}</strong></div>;
}
function ListBlock({ title, items }: { title: string; items: string[] }) {
  return <div className="rounded-2xl border border-white/12 bg-white/[0.025] p-4"><h3 className="text-sm font-black">{title}</h3><div className="mt-3 space-y-2">{items.map((item) => <div key={item} className="flex gap-2 text-xs leading-5 text-cyan-100/58"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-cyan-100/52" />{item}</div>)}</div></div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Job Intelligence
// ─────────────────────────────────────────────────────────────────────────────

type SavedDuty = { id: string; duty: string; source: string; types: string[] };
const DUTY_KEY = "insight_hub_reviewer_job_duties";
function dutyTypes(value: string) {
  const text = value.toLowerCase();
  const values: string[] = [];
  if (/lift|carry|climb|stand|walk|push|pull|bend|kneel|reach|strength|endurance/.test(text)) values.push("Physical");
  if (/decision|memory|attention|read|write|communicat|judg|assess|reason/.test(text)) values.push("Cognitive");
  if (/chemical|heat|cold|noise|dust|fume|outdoor|weather|toxic|hazard|exposure/.test(text)) values.push("Environmental");
  if (/drive|operat|pilot|firearm|weapon|emergency|critical|public safety|hazardous equipment/.test(text)) values.push("Safety-sensitive");
  return values.length ? values : ["General"];
}

export function ReviewerJobIntelligencePage() {
  const [tab, setTab] = useState<"lookup" | "workspace" | "paste">("lookup");
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [paste, setPaste] = useState("");
  const [duties, setDuties] = useState<SavedDuty[]>(() => { try { return JSON.parse(localStorage.getItem(DUTY_KEY) || "[]"); } catch { return []; } });
  useEffect(() => { localStorage.setItem(DUTY_KEY, JSON.stringify(duties)); }, [duties]);
  async function searchJob() {
    if (!query.trim()) return;
    setLoading(true);
    try { setProfile(await loadJson(`/api/occupational-discovery/onet/profile?keyword=${encodeURIComponent(query.trim())}`)); }
    catch (error) { setProfile({ error: error instanceof Error ? error.message : "O*NET unavailable." }); }
    finally { setLoading(false); }
  }
  const occupation = profile?.profile;
  function addDuty(duty: string, source: string) {
    const clean = duty.trim(); if (!clean || duties.some((item) => item.duty.toLowerCase() === clean.toLowerCase())) return;
    setDuties((current) => [...current, { id: crypto.randomUUID(), duty: clean, source, types: dutyTypes(clean) }]);
  }
  function importPaste() {
    paste.split(/\n|•|;/).map((item) => item.replace(/^[-*\d.)\s]+/, "").trim()).filter(Boolean).forEach((item) => addDuty(item, "Reviewer pasted"));
    setPaste(""); setTab("workspace");
  }
  return (
    <ToolShell eyebrow="Occupational / Job Intelligence" title="Job Intelligence" subtitle="O*NET occupation lookup, reviewer duty workspace, and pasted job-description analysis in the Insight Hub 2 visual system.">
      <Tabs items={[{ id: "lookup", label: "Occupation Lookup" }, { id: "workspace", label: `Duty Workspace (${duties.length})` }, { id: "paste", label: "Paste Duties" }]} active={tab} onChange={setTab} />
      {tab === "lookup" && <div className="space-y-6"><Surface><div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end"><label><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/52">Occupation title</span><div className="mt-2 flex min-h-12 items-center gap-3 rounded-2xl border border-white/20 bg-white/[0.045] px-4"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void searchJob()} placeholder="Aircraft mechanic, firefighter, HVAC mechanic…" className="flex-1 bg-transparent text-sm outline-none" /></div></label><button onClick={() => void searchJob()} disabled={loading || !query.trim()} className="min-h-12 rounded-2xl border border-cyan-100/24 bg-cyan-300/[0.10] px-5 text-sm font-black disabled:opacity-40">{loading ? <Loader2 size={16} className="mr-2 inline animate-spin" /> : <Search size={16} className="mr-2 inline" />}Search O*NET</button></div></Surface>{loading ? <Loading /> : profile?.error ? <ErrorState error={profile.error} /> : occupation ? <Surface><div className="flex items-start justify-between"><div><StatusPill tone="green">O*NET live</StatusPill><h2 className="mt-3 text-2xl font-black">{occupation.occupation?.title}</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-cyan-100/55">{occupation.occupation?.description}</p></div><BriefcaseBusiness className="text-cyan-100/50" /></div><div className="mt-6 grid gap-6 xl:grid-cols-2"><EvidenceList title="Tasks" rows={occupation.tasks} onAdd={(row) => addDuty(row.name, `O*NET ${occupation.occupation?.code} · task`)} /><EvidenceList title="Work context / abilities" rows={[...(occupation.workContext || []), ...(occupation.abilities || [])]} onAdd={(row) => addDuty(row.name, `O*NET ${occupation.occupation?.code} · evidence`)} /></div></Surface> : null}</div>}
      {tab === "workspace" && <Surface><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/48">Reviewer workspace</p><h2 className="mt-2 text-xl font-black">Saved job duties</h2></div><StatusPill>{duties.length} duties</StatusPill></div>{duties.length ? <div className="mt-5 space-y-3">{duties.map((item) => <div key={item.id} className="rounded-2xl border border-white/12 bg-white/[0.025] p-4"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-bold">{item.duty}</p><p className="mt-1 text-[10px] text-cyan-100/40">{item.source}</p><div className="mt-2 flex flex-wrap gap-1.5">{item.types.map((type) => <StatusPill key={type}>{type}</StatusPill>)}</div></div><button onClick={() => setDuties((current) => current.filter((d) => d.id !== item.id))} className="rounded-xl border border-white/10 p-2 text-cyan-100/45 hover:text-white" aria-label={`Remove ${item.duty}`}><Trash2 size={14} /></button></div></div>)}</div> : <p className="mt-5 text-sm text-cyan-100/50">Add duties from O*NET or paste a job description.</p>}</Surface>}
      {tab === "paste" && <Surface><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/48">Unstructured job description</p><h2 className="mt-2 text-xl font-black">Paste duties</h2><textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={12} placeholder="Paste bullets, duties, or job-description text…" className="mt-5 w-full rounded-2xl border border-white/16 bg-black/20 p-4 text-sm leading-6 outline-none placeholder:text-cyan-100/28 focus:border-cyan-100/30" /><button onClick={importPaste} disabled={!paste.trim()} className="mt-4 min-h-11 rounded-2xl border border-cyan-100/24 bg-cyan-300/[0.10] px-5 text-sm font-black disabled:opacity-40"><Plus size={15} className="mr-2 inline" />Add to duty workspace</button></Surface>}
    </ToolShell>
  );
}
function EvidenceList({ title, rows = [], onAdd }: { title: string; rows?: any[]; onAdd: (row: any) => void }) {
  return <div><h3 className="text-sm font-black">{title}</h3><div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-1">{rows.slice(0, 40).map((row, index) => <div key={`${row.id || row.name}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.025] p-3"><div className="flex gap-3"><div className="min-w-0 flex-1"><p className="text-xs font-bold leading-5">{row.name}</p>{row.description ? <p className="mt-1 text-[11px] leading-5 text-cyan-100/42">{row.description}</p> : null}</div><button onClick={() => onAdd(row)} className="h-8 w-8 shrink-0 rounded-xl border border-cyan-100/16 text-cyan-100/60 hover:text-white"><Plus size={13} className="mx-auto" /></button></div></div>)}</div></div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// AOR Factors
// ─────────────────────────────────────────────────────────────────────────────

const COMMANDS = [
  { id: "northcom", label: "USNORTHCOM", scope: "United States, Canada, Mexico, Greenland, Bahamas and assigned approaches" },
  { id: "southcom", label: "USSOUTHCOM", scope: "Central America, South America and the Caribbean" },
  { id: "eucom", label: "USEUCOM", scope: "Europe and assigned portions of Eurasia and adjoining approaches" },
  { id: "africom", label: "USAFRICOM", scope: "African continent and island nations except Egypt" },
  { id: "centcom", label: "USCENTCOM", scope: "Middle East, Central Asia, Egypt, Afghanistan and Pakistan" },
  { id: "indopacom", label: "USINDOPACOM", scope: "Indo-Pacific from India through East Asia, Australia and Pacific island nations" },
] as const;

export function ReviewerAorFactorsPage() {
  const [tab, setTab] = useState<"command" | "environment">("command");
  const [command, setCommand] = useState<(typeof COMMANDS)[number]["id"]>("centcom");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [environment, setEnvironment] = useState({ heat: false, cold: false, altitude: false, poorAir: false, fatigue: false, ppe: false, night: false });
  useEffect(() => { let active = true; setLoading(true); setError(""); loadJson(`/api/reviewer-tools/aor?command=${command}`).then((value) => active && setData(value)).catch((err) => active && setError(err.message)).finally(() => active && setLoading(false)); return () => { active = false; }; }, [command]);
  const selected = COMMANDS.find((item) => item.id === command)!;
  const envSelected = Object.entries(environment).filter(([, value]) => value).map(([key]) => key);
  return <ToolShell eyebrow="Operational / Environmental Intelligence" title="AOR Factors" subtitle="Combatant-command operating picture plus human-performance and environmental context, using WHO, GDACS and USGS public sources.">
    <Tabs items={[{ id: "command", label: "AOR & Command Intelligence" }, { id: "environment", label: "Environmental & Performance Factors" }]} active={tab} onChange={setTab} />
    {tab === "command" ? <div className="space-y-6"><Surface><div className="flex flex-wrap gap-2">{COMMANDS.map((item) => <button key={item.id} onClick={() => setCommand(item.id)} className={`min-h-10 rounded-2xl border px-4 text-xs font-black ${command === item.id ? "border-cyan-100/32 bg-cyan-300/[0.12]" : "border-white/12 bg-white/[0.025] text-cyan-100/55"}`}>{item.label}</button>)}</div><div className="mt-5"><StatusPill tone={data?.partial ? "amber" : "green"}>{data?.partial ? "Partial source coverage" : "Public sources live"}</StatusPill><h2 className="mt-3 text-2xl font-black">{selected.label}</h2><p className="mt-2 text-sm text-cyan-100/52">{selected.scope}</p></div></Surface>{loading ? <Loading /> : error ? <ErrorState error={error} /> : data ? <div className="grid gap-6 xl:grid-cols-3"><Feed title="WHO Disease Outbreaks" icon={<HeartPulse size={16} />} items={(data.outbreaks || []).map((item: any) => ({ title: item.title, meta: `${item.matchedArea || "AOR"} · ${formatDate(item.publishedAt)}`, detail: item.summary, url: item.url }))} empty="No recent WHO outbreak item matched this command." /><Feed title="GDACS Natural Hazards" icon={<ShieldAlert size={16} />} items={(data.disasters || []).map((item: any) => ({ title: `${item.alertLevel ? `${String(item.alertLevel).toUpperCase()} · ` : ""}${item.title}`, meta: `${item.country || item.eventType} · ${formatDate(item.fromDate || item.toDate)}`, detail: item.eventType, url: item.url }))} empty="No current GDACS event matched this command." /><Feed title="USGS Seismic Activity" icon={<Waves size={16} />} items={(data.earthquakes || []).map((item: any) => ({ title: `${item.magnitude != null ? `M${Number(item.magnitude).toFixed(1)} · ` : ""}${item.place || item.title}`, meta: formatDate(item.occurredAt), detail: `${item.depthKm != null ? `${Number(item.depthKm).toFixed(1)} km deep` : ""}${item.tsunami ? " · tsunami flag" : ""}`, url: item.url }))} empty="No magnitude 4.0+ earthquake matched this command in the current window." /></div> : null}</div> : <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]"><Surface><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/48">Exposure scenario</p><h2 className="mt-2 text-xl font-black">Build the work environment</h2><div className="mt-5 grid gap-2 sm:grid-cols-2">{Object.entries({ heat: "Heat / high WBGT", cold: "Cold exposure", altitude: "Altitude", poorAir: "Poor air quality", fatigue: "Fatigue / long shift", ppe: "PPE burden", night: "Night / circadian disruption" }).map(([key, label]) => <button key={key} onClick={() => setEnvironment((current) => ({ ...current, [key]: !current[key as keyof typeof current] }))} className={`rounded-2xl border p-3 text-left text-xs font-bold ${environment[key as keyof typeof environment] ? "border-cyan-100/30 bg-cyan-300/[0.10]" : "border-white/10 bg-white/[0.02] text-cyan-100/55"}`}>{label}</button>)}</div></Surface><Surface><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-100/48">Reviewer prompts</p><h2 className="mt-2 text-xl font-black">Human-performance load field</h2>{envSelected.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{envSelected.map((key) => <div key={key} className="rounded-2xl border border-white/12 bg-white/[0.025] p-4"><strong className="text-sm capitalize">{key.replace(/([A-Z])/g, " $1")}</strong><p className="mt-2 text-xs leading-5 text-cyan-100/50">{environmentPrompt(key)}</p></div>)}</div> : <p className="mt-5 text-sm text-cyan-100/50">Select actual exposure conditions. This workspace does not generate a fabricated composite danger score.</p>}</Surface></div>}
  </ToolShell>;
}
function environmentPrompt(key: string) {
  const prompts: Record<string, string> = { heat: "Confirm temperature/WBGT, work-rest cycle, hydration, acclimatization, clothing/PPE and heat-sensitive conditions or medications.", cold: "Confirm temperature, wind, wetness, protective clothing, warming access and dexterity requirements.", altitude: "Confirm elevation, ascent profile, prior tolerance, cardiopulmonary limitations and emergency descent/oxygen access.", poorAir: "Identify pollutant or particulate source, AQI/monitoring, respiratory protection and underlying respiratory disease.", fatigue: "Confirm shift length, sleep opportunity, recent time-zone change, driving/critical tasks and recovery time.", ppe: "Confirm respirator/body armor/chemical PPE burden, heat retention, communication and emergency egress requirements.", night: "Confirm circadian timing, sleep opportunity, lighting, vigilance demand and commute/driving exposure." };
  return prompts[key] || "Review the actual exposure and task demands rather than assigning a generic score.";
}
function formatDate(value?: string) { if (!value) return "Date not supplied"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(); }
function Feed({ title, icon, items, empty }: { title: string; icon: ReactNode; items: Array<{ title: string; meta: string; detail?: string; url: string }>; empty: string }) {
  return <Surface><div className="flex items-center gap-2"><span className="text-cyan-100/55">{icon}</span><h2 className="text-sm font-black">{title}</h2></div>{items.length ? <div className="mt-4 max-h-[650px] space-y-2 overflow-y-auto pr-1">{items.map((item, index) => <a key={`${item.title}-${index}`} href={item.url} target="_blank" rel="noreferrer" className="block rounded-2xl border border-white/10 bg-white/[0.025] p-3 transition hover:border-cyan-100/24"><div className="flex gap-2"><strong className="min-w-0 flex-1 text-xs leading-5">{item.title}</strong><ExternalLink size={11} className="shrink-0 text-cyan-100/40" /></div><p className="mt-1 text-[10px] text-cyan-100/38">{item.meta}</p>{item.detail ? <p className="mt-2 text-[11px] leading-5 text-cyan-100/48">{item.detail}</p> : null}</a>)}</div> : <p className="mt-5 text-sm text-cyan-100/48">{empty}</p>}</Surface>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Drug Checker
// ─────────────────────────────────────────────────────────────────────────────

const DRUG_PROFILES = [
  { aliases: ["gabapentin", "neurontin"], className: "Anticonvulsant / neuropathic pain agent", flags: ["Sedation / dizziness", "Coordination"], points: ["Consider reported somnolence, dizziness, or ataxia when duties require sustained alertness, balance, driving, or hazardous equipment.", "Renal function may affect dosing and tolerability."] },
  { aliases: ["warfarin", "coumadin", "jantoven"], className: "Vitamin K antagonist anticoagulant", flags: ["Bleeding", "Monitoring"], points: ["Bleeding consequences may matter more in jobs with trauma exposure or delayed access to care.", "Confirm required anticoagulation monitoring can be maintained in the work setting."] },
  { aliases: ["insulin", "humalog", "novolog", "lantus", "levemir", "tresiba", "basaglar"], className: "Insulin therapy", flags: ["Hypoglycemia", "Medication access / storage"], points: ["Review severe hypoglycemia history, recognition, monitoring, and actual safety sensitivity of the position.", "Confirm reliable access to medication, supplies, monitoring and appropriate storage."] },
  { aliases: ["metoprolol", "lopressor", "toprol"], className: "Beta blocker", flags: ["Heart-rate response", "Dizziness / fatigue"], points: ["Beta blockade can alter expected heart-rate response during exertion.", "Reported fatigue, bradycardia, or dizziness may matter in strenuous or safety-sensitive duties."] },
  { aliases: ["hydrochlorothiazide", "hctz", "microzide"], className: "Thiazide diuretic", flags: ["Hydration / electrolytes", "Heat"], points: ["Review dehydration or electrolyte concerns when work involves sustained heat exposure or heavy exertion.", "Reported orthostasis or weakness may be occupationally relevant."] },
  { aliases: ["doxycycline", "vibramycin"], className: "Tetracycline antibiotic", flags: ["Photosensitivity", "Administration constraints"], points: ["Photosensitivity can matter for prolonged outdoor work or deployment.", "Consider whether reliable hydration and appropriate administration are practical."] },
  { aliases: ["sertraline", "zoloft"], className: "SSRI antidepressant", flags: ["Alertness / sleep", "Treatment stability"], points: ["Review actual side effects and treatment stability; the medication itself does not establish impairment.", "Somnolence, insomnia, dizziness, or recent dose changes may matter in safety-sensitive work."] },
  { aliases: ["amlodipine", "norvasc"], className: "Calcium-channel blocker", flags: ["Hypotension / dizziness", "Edema"], points: ["Review symptomatic hypotension, dizziness, or edema if the job includes heights, heavy exertion, or prolonged standing.", "Medication tolerance and BP control are more useful than the drug name alone."] },
  { aliases: ["metformin", "glucophage", "fortamet"], className: "Biguanide antihyperglycemic", flags: ["GI tolerance", "Renal function"], points: ["GI effects may matter when field access to hydration or sanitation is limited.", "Renal status and underlying diabetes control are generally more relevant than metformin use itself."] },
] as const;
function drugProfile(name: string) { const clean = name.toLowerCase(); return DRUG_PROFILES.find((profile) => profile.aliases.some((alias) => clean.includes(alias))) || null; }

export function ReviewerDrugCheckerPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [molecule, setMolecule] = useState<any>(null);
  const [moleculeLoading, setMoleculeLoading] = useState(false);
  useEffect(() => { const clean = query.trim(); if (clean.length < 2) { setResults([]); return; } const timer = window.setTimeout(() => { setSearching(true); loadJson(`/api/reviewer-tools/rxnorm?term=${encodeURIComponent(clean)}`).then((payload) => setResults(payload.candidates || [])).catch(() => setResults([])).finally(() => setSearching(false)); }, 250); return () => clearTimeout(timer); }, [query]);
  async function focusDrug(drug: any) { setMoleculeLoading(true); setMolecule(null); try { setMolecule(await loadJson(`/api/reviewer-tools/pubchem?name=${encodeURIComponent(drug.name)}`)); } catch { setMolecule({ error: "PubChem molecular record unavailable for this name." }); } finally { setMoleculeLoading(false); } }
  function addDrug(drug: any) { if (!selected.some((item) => item.rxcui === drug.rxcui)) setSelected((current) => [...current, drug]); setQuery(""); setResults([]); void focusDrug(drug); }
  return <ToolShell eyebrow="Medication / Occupational Review" title="Drug Checker" subtitle="RxNorm medication identity, PubChem molecular data, and curated occupational-review factors without invented interaction claims.">
    <Surface><label><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/52">Medication name</span><div className="mt-2 flex min-h-12 items-center gap-3 rounded-2xl border border-white/20 bg-white/[0.045] px-4">{searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Gabapentin, Eliquis, metoprolol…" className="flex-1 bg-transparent text-sm outline-none" />{query ? <button onClick={() => setQuery("")}><X size={14} /></button> : null}</div></label>{results.length ? <div className="mt-3 overflow-hidden rounded-2xl border border-white/14 bg-[#050b16]/95">{results.map((item) => <button key={item.rxcui} onClick={() => addDrug(item)} className="flex w-full items-center justify-between border-b border-white/8 px-4 py-3 text-left last:border-0 hover:bg-white/[0.05]"><div><strong className="text-sm">{item.name}</strong><p className="mt-0.5 text-[10px] text-cyan-100/40">RxCUI {item.rxcui}</p></div><StatusPill tone={drugProfile(item.name) ? "green" : "cyan"}>{drugProfile(item.name) ? "Reviewed profile" : "Identity only"}</StatusPill></button>)}</div> : null}</Surface>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_.8fr]">
      <Surface><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/48">Selected medications</p><h2 className="mt-2 text-xl font-black">{selected.length ? `${selected.length} in review` : "No medications selected"}</h2></div><Pill className="text-cyan-100/50" /></div>{selected.length ? <div className="mt-5 space-y-3">{selected.map((drug) => { const profile = drugProfile(drug.name); return <div key={drug.rxcui} className="rounded-2xl border border-white/12 bg-white/[0.025] p-4"><div className="flex items-start gap-3"><button onClick={() => void focusDrug(drug)} className="min-w-0 flex-1 text-left"><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-100/40">{profile ? "Reviewed occupational profile" : "RxNorm identity"}</p><h3 className="mt-1 text-lg font-black">{drug.name}</h3><p className="mt-1 text-xs text-cyan-100/45">{profile?.className || `RxCUI ${drug.rxcui}`}</p></button><button onClick={() => setSelected((current) => current.filter((item) => item.rxcui !== drug.rxcui))} className="rounded-xl border border-white/10 p-2 text-cyan-100/45 hover:text-white"><Trash2 size={14} /></button></div>{profile ? <><div className="mt-3 flex flex-wrap gap-1.5">{profile.flags.map((flag) => <StatusPill key={flag} tone="amber">{flag}</StatusPill>)}</div><div className="mt-3 space-y-2">{profile.points.map((point) => <p key={point} className="flex gap-2 text-xs leading-5 text-cyan-100/55"><CheckCircle2 size={13} className="mt-0.5 shrink-0" />{point}</p>)}</div></> : <p className="mt-3 text-xs leading-5 text-cyan-100/48">No curated occupational profile is stored for this medication. No occupational risk is inferred from the name alone.</p>}</div>; })}</div> : <p className="mt-5 text-sm text-cyan-100/48">Search and select a medication above.</p>}</Surface>
      <Surface><div className="flex items-center gap-2"><Atom size={16} className="text-violet-100/55" /><h2 className="text-sm font-black">Molecular intelligence</h2></div>{moleculeLoading ? <Loading text="Resolving PubChem compound…" /> : molecule?.error ? <ErrorState error={molecule.error} /> : molecule?.molecule ? <div className="mt-5"><div className="flex justify-center rounded-2xl border border-white/10 bg-white p-4">{molecule.structureImageUrl ? <img src={molecule.structureImageUrl} alt="PubChem molecular structure" className="max-h-52 object-contain" /> : null}</div><div className="mt-4 grid grid-cols-2 gap-2"><Metric label="Formula" value={String(molecule.molecule.MolecularFormula || "—")} /><Metric label="Molecular weight" value={String(molecule.molecule.MolecularWeight || "—")} /><Metric label="XLogP" value={String(molecule.molecule.XLogP ?? "—")} /><Metric label="TPSA" value={String(molecule.molecule.TPSA ?? "—")} /></div><div className="mt-4"><SourceLink href={molecule.pubchemUrl} label="Open PubChem record" /></div></div> : <p className="mt-5 text-sm text-cyan-100/48">Select a medication to resolve its PubChem record.</p>}</Surface>
    </div>
  </ToolShell>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Clinical Calculators
// ─────────────────────────────────────────────────────────────────────────────

type CalcField = { key: string; label: string; unit?: string; type?: "number" | "select"; options?: Array<{ label: string; value: string }>; min?: number; max?: number; step?: number };
type CalcDef = { id: string; label: string; description: string; fields: CalcField[]; calculate: (v: Record<string, string>) => { value: string; interpretation: string; reference: string } | null };
const n = (v: Record<string, string>, key: string) => Number.parseFloat(v[key] || "");
const sexOptions = [{ label: "Male", value: "male" }, { label: "Female", value: "female" }];
function result(value: string, interpretation: string, reference: string) { return { value, interpretation, reference }; }
const CALCS: CalcDef[] = [
  { id: "bmi", label: "BMI", description: "Adult body-mass-index screening value", fields: [{ key: "weight", label: "Weight", unit: "kg", min: 20, max: 300 }, { key: "height", label: "Height", unit: "cm", min: 100, max: 250 }], calculate: (v) => { const bmi = n(v,"weight") / ((n(v,"height")/100) ** 2); if (!Number.isFinite(bmi)) return null; const band = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Healthy-weight" : bmi < 30 ? "Overweight" : bmi < 35 ? "Obesity class 1" : bmi < 40 ? "Obesity class 2" : "Obesity class 3"; return result(bmi.toFixed(1), `${band} range. BMI is a screening measure, not a fitness determination.`, "CDC adult BMI categories"); } },
  { id: "egfr", label: "eGFR", description: "2021 CKD-EPI creatinine estimate", fields: [{ key: "creatinine", label: "Serum creatinine", unit: "mg/dL", min: .3, max: 15, step: .01 }, { key: "age", label: "Age", unit: "years", min: 18, max: 120 }, { key: "sex", label: "Sex used by equation", type: "select", options: sexOptions }], calculate: (v) => { const cr=n(v,"creatinine"), age=n(v,"age"), female=v.sex==="female", k=female?.7:.9, a=female?-.241:-.302, ratio=cr/k; const value=142*Math.pow(Math.min(ratio,1),a)*Math.pow(Math.max(ratio,1),-1.2)*Math.pow(.9938,age)*(female?1.012:1); return Number.isFinite(value)?result(`${value.toFixed(0)} mL/min/1.73m²`, value>=90?"G1 eGFR range — eGFR alone does not establish CKD":value>=60?"G2 eGFR range — eGFR alone does not establish CKD":value>=45?"G3a eGFR range":value>=30?"G3b eGFR range":value>=15?"G4 eGFR range":"G5 eGFR range", "CKD-EPI 2021 race-free creatinine equation"):null; } },
  { id: "map", label: "Mean Arterial Pressure", description: "Quick SBP / DBP arithmetic estimate", fields: [{ key:"sbp",label:"Systolic BP",unit:"mmHg",min:50,max:300},{key:"dbp",label:"Diastolic BP",unit:"mmHg",min:20,max:200}], calculate:(v)=> n(v,"sbp")>n(v,"dbp")?result(`${((n(v,"sbp")+2*n(v,"dbp"))/3).toFixed(0)} mmHg`,"Arithmetic estimate. Apply program-specific BP criteria separately.","MAP ≈ (SBP + 2×DBP) / 3"):null },
  { id:"pack",label:"Pack-Years",description:"Smoking exposure history",fields:[{key:"cigs",label:"Cigarettes per day",min:0,max:200},{key:"years",label:"Years smoked",min:0,max:100,step:.5}],calculate:(v)=>result(`${((n(v,"cigs")/20)*n(v,"years")).toFixed(1)} pack-years`,"Exposure summary only. Screening criteria come from the applicable standard.","(cigarettes/day ÷ 20) × years") },
  { id:"mets",label:"Walking METs",description:"ACSM treadmill walking-equation estimate",fields:[{key:"speed",label:"Speed",unit:"mph",min:.1,max:8,step:.1},{key:"grade",label:"Grade",unit:"%",min:0,max:30,step:.5}],calculate:(v)=>{const sp=n(v,"speed"),m=sp*26.8224,g=n(v,"grade")/100,mets=(.1*m+1.8*m*g+3.5)/3.5;return result(mets.toFixed(1),`${sp>=1.9&&sp<=3.7?"Within":"Outside"} the usual walking-equation speed range. Estimate only.`,"ACSM walking metabolic equation");}},
  { id:"bsa",label:"Body Surface Area",description:"Mosteller body surface area",fields:[{key:"height",label:"Height",unit:"cm",min:50,max:275},{key:"weight",label:"Weight",unit:"kg",min:2,max:500}],calculate:(v)=>result(`${Math.sqrt(n(v,"height")*n(v,"weight")/3600).toFixed(2)} m²`,"Body-size estimate; use only where the applicable protocol calls for BSA.","Mosteller: √((height cm × weight kg) ÷ 3600)")},
  { id:"ibw",label:"Ideal Body Weight",description:"Devine equation reference",fields:[{key:"height",label:"Height",unit:"cm",min:100,max:250},{key:"sex",label:"Sex used by equation",type:"select",options:sexOptions}],calculate:(v)=>{const inches=n(v,"height")/2.54,base=v.sex==="female"?45.5:50,value=base+2.3*Math.max(0,inches-60);return result(`${value.toFixed(1)} kg`,"Equation-derived dosing reference, not a target weight or fitness determination.","Devine equation");}},
  { id:"adjbw",label:"Adjusted Body Weight",description:"IBW-based dosing reference",fields:[{key:"actual",label:"Actual weight",unit:"kg",min:2,max:500},{key:"ibw",label:"Ideal body weight",unit:"kg",min:20,max:250}],calculate:(v)=>result(`${(n(v,"ibw")+.4*(n(v,"actual")-n(v,"ibw"))).toFixed(1)} kg`,"Use only when a medication or protocol specifies adjusted body weight.","AdjBW = IBW + 0.4 × (actual − IBW)")},
  { id:"crcl",label:"Creatinine Clearance",description:"Adult Cockcroft–Gault estimate",fields:[{key:"age",label:"Age",unit:"years",min:18,max:120},{key:"weight",label:"Weight selected for equation",unit:"kg",min:20,max:500},{key:"creatinine",label:"Serum creatinine",unit:"mg/dL",min:.2,max:20,step:.01},{key:"sex",label:"Sex adjustment",type:"select",options:sexOptions}],calculate:(v)=>{let value=((140-n(v,"age"))*n(v,"weight"))/(72*n(v,"creatinine"));if(v.sex==="female")value*=.85;return result(`${value.toFixed(0)} mL/min`,"Adult estimate; clinically appropriate weight and dosing decision remain protocol-specific.","Cockcroft–Gault equation");}},
  { id:"mphr",label:"Maximum Predicted HR",description:"Age-predicted maximum",fields:[{key:"age",label:"Age",unit:"years",min:1,max:120}],calculate:(v)=>result(`${(220-n(v,"age")).toFixed(0)} bpm`,"Population estimate only; not an exercise clearance or fitness decision.","220 − age")},
  { id:"target",label:"Target Heart Rate",description:"User-selected intensity zone",fields:[{key:"age",label:"Age",unit:"years",min:1,max:120},{key:"low",label:"Low intensity",unit:"%",min:1,max:100},{key:"high",label:"High intensity",unit:"%",min:1,max:100}],calculate:(v)=>{const max=220-n(v,"age");return result(`${(max*n(v,"low")/100).toFixed(0)}–${(max*n(v,"high")/100).toFixed(0)} bpm`,"Age-predicted zone; individual response may differ.","(220 − age) × selected intensity")}},
  { id:"bazett",label:"QTc — Bazett",description:"Heart-rate corrected QT",fields:[{key:"qt",label:"QT interval",unit:"ms",min:100,max:1000},{key:"rr",label:"RR interval",unit:"seconds",min:.3,max:2,step:.01}],calculate:(v)=>result(`${(n(v,"qt")/Math.sqrt(n(v,"rr"))).toFixed(0)} ms`,"Rate-corrected estimate; interpret in ECG and clinical context.","QTc = QT ÷ √RR")},
  { id:"fridericia",label:"QTc — Fridericia",description:"Cube-root corrected QT",fields:[{key:"qt",label:"QT interval",unit:"ms",min:100,max:1000},{key:"rr",label:"RR interval",unit:"seconds",min:.3,max:2,step:.01}],calculate:(v)=>result(`${(n(v,"qt")/Math.cbrt(n(v,"rr"))).toFixed(0)} ms`,"Rate-corrected estimate; interpret in ECG and clinical context.","QTc = QT ÷ ∛RR")},
  { id:"heat",label:"Heat Index",description:"NOAA apparent heat estimate",fields:[{key:"temp",label:"Air temperature",unit:"°F",min:80,max:130,step:.1},{key:"rh",label:"Relative humidity",unit:"%",min:40,max:100}],calculate:(v)=>{const T=n(v,"temp"),R=n(v,"rh"),hi=-42.379+2.04901523*T+10.14333127*R-.22475541*T*R-.00683783*T*T-.05481717*R*R+.00122874*T*T*R+.00085282*T*R*R-.00000199*T*T*R*R;return result(`${hi.toFixed(0)} °F`,"Apparent temperature estimate for shaded, light-wind conditions.","NOAA/NWS Rothfusz regression")}},
  { id:"wind",label:"Wind Chill",description:"NWS apparent cold estimate",fields:[{key:"temp",label:"Air temperature",unit:"°F",min:-100,max:50,step:.1},{key:"wind",label:"Wind speed",unit:"mph",min:3,max:150,step:.1}],calculate:(v)=>{const T=n(v,"temp"),W=n(v,"wind"),wc=35.74+.6215*T-35.75*Math.pow(W,.16)+.4275*T*Math.pow(W,.16);return result(`${wc.toFixed(0)} °F`,"Apparent cold estimate for exposed skin; clothing and wetness materially affect risk.","NWS wind-chill formula")}},
];
export function ReviewerClinicalCalculatorsPage() {
  const [activeId,setActiveId]=useState("bmi"); const [values,setValues]=useState<Record<string,Record<string,string>>>({}); const [output,setOutput]=useState<any>(null); const [error,setError]=useState(""); const active=CALCS.find((c)=>c.id===activeId)!; const current=values[activeId]||{};
  function setValue(key:string,value:string){setValues((all)=>({...all,[activeId]:{...(all[activeId]||{}),[key]:value}}));setOutput(null);setError("");}
  function calculate(){const missing=active.fields.find((f)=>!current[f.key]);if(missing){setError(`${missing.label} is required.`);return;}const invalid=active.fields.find((f)=>f.type!=="select"&&(!Number.isFinite(n(current,f.key))||(f.min!==undefined&&n(current,f.key)<f.min)||(f.max!==undefined&&n(current,f.key)>f.max)));if(invalid){setError(`${invalid.label} must be within ${invalid.min}–${invalid.max}${invalid.unit?` ${invalid.unit}`:""}.`);return;}try{const value=active.calculate(current);if(!value)throw new Error("Inputs are not valid for this equation.");setOutput(value);setError("");}catch(e){setError(e instanceof Error?e.message:"Calculation failed.");}}
  return <ToolShell eyebrow="Clinical / Calculators" title="Clinical Calculators" subtitle="Transparent quick calculations transplanted from the reviewer toolkit; controlling program standards remain separate."><div className="grid gap-6 xl:grid-cols-[330px_1fr]"><Surface><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/48">Calculators</p><div className="mt-4 max-h-[740px] space-y-2 overflow-y-auto pr-1">{CALCS.map((calc)=><button key={calc.id} onClick={()=>{setActiveId(calc.id);setOutput(null);setError("");}} className={`w-full rounded-2xl border p-3 text-left ${activeId===calc.id?"border-cyan-100/30 bg-cyan-300/[0.10]":"border-white/10 bg-white/[0.02] text-cyan-50/60"}`}><strong className="text-sm">{calc.label}</strong><p className="mt-1 text-[10px] leading-4 text-cyan-100/38">{calc.description}</p></button>)}</div></Surface><Surface><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-100/48">Active calculation</p><h2 className="mt-2 text-2xl font-black">{active.label}</h2><p className="mt-1 text-sm text-cyan-100/48">{active.description}</p></div><Calculator className="text-violet-100/55" /></div><div className="mt-6 grid gap-4 sm:grid-cols-2">{active.fields.map((field)=><label key={field.key}><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-100/45">{field.label}{field.unit?` · ${field.unit}`:""}</span>{field.type==="select"?<select value={current[field.key]||""} onChange={(e)=>setValue(field.key,e.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-white/16 bg-[#07111f] px-4 text-sm outline-none"><option value="">Select…</option>{field.options?.map((o)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:<input type="number" min={field.min} max={field.max} step={field.step||.1} value={current[field.key]||""} onChange={(e)=>setValue(field.key,e.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-white/16 bg-black/20 px-4 text-sm outline-none" />}</label>)}</div><div className="mt-5 flex gap-2"><button onClick={calculate} className="min-h-11 rounded-2xl border border-cyan-100/24 bg-cyan-300/[0.10] px-5 text-sm font-black"><Calculator size={15} className="mr-2 inline" />Calculate</button><button onClick={()=>{setValues((all)=>({...all,[activeId]:{}}));setOutput(null);setError("");}} className="min-h-11 rounded-2xl border border-white/14 bg-white/[0.035] px-4 text-sm"><RefreshCw size={14} className="mr-2 inline" />Clear</button></div>{error?<div className="mt-4"><ErrorState error={error}/></div>:null}{output?<div className="mt-6 rounded-[26px] border border-cyan-100/20 bg-cyan-300/[0.06] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/52">Result</p><strong className="mt-2 block text-4xl font-black tracking-tight">{output.value}</strong><p className="mt-3 text-sm leading-6 text-cyan-100/60">{output.interpretation}</p><p className="mt-3 text-xs font-bold text-violet-100/60">{output.reference}</p></div>:null}<p className="mt-6 rounded-2xl border border-amber-200/14 bg-amber-300/[0.04] p-4 text-xs leading-6 text-amber-50/65">Decision-support calculation only. Apply the current controlling medical or program standard separately; this tool does not produce clearance.</p></Surface></div></ToolShell>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Standards Intelligence
// ─────────────────────────────────────────────────────────────────────────────

type StandardId = "centcom" | "fmcsa" | "faa" | "nfpa";
type Finding = { id:string; standard:StandardId; level:"info"|"review"|"waiver"|"strict"; title:string; summary:string; action:string; source:string; url:string };
const STANDARDS: Record<StandardId,{label:string;title:string;source:string;url:string;icon:any}> = {
  centcom:{label:"CENTCOM MOD 18",title:"USCENTCOM MOD EIGHTEEN + TAB A",source:"Current deployment policy",url:"https://www.centcom.mil/CONTACT/THEATRE-MEDICAL-REQUIREMENTS/",icon:Radar},
  fmcsa:{label:"FMCSA",title:"49 CFR Part 391 + Medical Examiner's Handbook",source:"Current CFR / handbook",url:"https://www.fmcsa.dot.gov/regulations/medical/medical-regulations-and-guidance-resource-links",icon:Truck},
  faa:{label:"FAA",title:"FAA Guide for Aviation Medical Examiners",source:"Official aeromedical guidance",url:"https://www.faa.gov/ame_guide",icon:Activity},
  nfpa:{label:"NFPA 1580",title:"Emergency Responder Occupational Health and Wellness",source:"2025 consensus standard",url:"https://link.nfpa.org/all-publications/1580/2025",icon:Flame},
};
function evaluateStandards(v:Record<string,string>, frameworks:StandardId[]):Finding[]{const condition=(v.condition||"").toLowerCase(),med=(v.medication||"").toLowerCase(),findings:Finding[]=[];const push=(f:Finding)=>findings.push(f);if(frameworks.includes("centcom")){push({id:"base",standard:"centcom",level:"info",title:"Deployment functional baseline",summary:"Deployers must meet medical, dental and behavioral-health fitness standards and remain capable of required duties in the deployed environment.",action:"Confirm duty-specific functional capacity, PPE use, emergency egress and location support limitations.",source:"MOD 18 paras 4–5; Tab A",url:STANDARDS.centcom.url});if(/diabet/.test(condition)||v.a1c||/insulin|semaglutide|tirzepatide/.test(med)){const a=Number(v.a1c);push({id:"diabetes",standard:"centcom",level:/insulin/.test(med)?"strict":Number.isFinite(a)&&a>7?"waiver":"review",title:"Diabetes / glycemic deployment criteria",summary:"MOD 18 includes treatment route, medication stability, A1C and cardiovascular-risk criteria for diabetes deployment review.",action:"Review A1C, treatment route, medication stability and current cardiac-risk requirements.",source:"MOD 18 Tab A §7.A.3",url:"https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabAFINAL.pdf"});}if(/sleep apnea|osa/.test(condition)||v.ahi||v.pap){const ahi=Number(v.ahi);push({id:"osa",standard:"centcom",level:Number.isFinite(ahi)&&ahi>30?"waiver":"review",title:"Obstructive sleep apnea deployment criteria",summary:"Moderate/severe OSA review includes symptoms, objective PAP compliance and deployment power/equipment considerations.",action:"Review diagnostic AHI/RDI, symptoms, Epworth score, compliance download and device support plan.",source:"MOD 18 Tab A §7.A.15",url:"https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabAFINAL.pdf"});}if(/seizure|epilep/.test(condition)){push({id:"seizure",standard:"centcom",level:"strict",title:"Seizure activity / anticonvulsant rule",summary:"Recent seizure activity and anticonvulsant treatment for seizure history trigger specific deployment-limiting and waiver provisions.",action:"Document last seizure, diagnosis, medication indication, stability and current waiver pathway.",source:"MOD 18 Tab A §7.A.2",url:"https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabAFINAL.pdf"});}if(/warfarin|coumadin|apixaban|eliquis|rivaroxaban|xarelto/.test(med)){push({id:"anticoag",standard:"centcom",level:"strict",title:"Therapeutic anticoagulant rule",summary:"MOD 18 Tab A identifies therapeutic anticoagulants including warfarin, rivaroxaban and apixaban in its strictly disqualifying medication section.",action:"Surface the controlling medication section and current waiver-authority pathway rather than treating this as a generic medication flag.",source:"MOD 18 Tab A §7.I.3.a",url:"https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabAFINAL.pdf"});}const sbp=Number(v.sbp),dbp=Number(v.dbp),ascvd=Number(v.ascvd);if(v.sbp||v.dbp||v.ascvd||/hypertension|cardiac|heart/.test(condition)){push({id:"cardio",standard:"centcom",level:(sbp>140||dbp>90||ascvd>=15)?"waiver":"review",title:"Cardiovascular risk / blood pressure screen",summary:"MOD 18 includes serial blood-pressure and cardiovascular-risk requirements, with additional work-up at specified thresholds.",action:"Capture serial BP, age/risk calculation, medication stability and functional testing when required.",source:"MOD 18 Tab A §7.B.6–7",url:"https://www.centcom.mil/Portals/6/MEDICAL/MOD18TabAFINAL.pdf"});}}
if(frameworks.includes("fmcsa")){push({id:"fmcsa-base",standard:"fmcsa",level:"info",title:"FMCSA physical qualification baseline",summary:"Commercial driver qualification is governed by 49 CFR Part 391 and current Medical Examiner guidance.",action:"Apply the current driver-specific standard and Medical Advisory Criteria to the actual condition and medication.",source:"49 CFR 391.41 / FMCSA ME Handbook",url:STANDARDS.fmcsa.url});if(/seizure|epilep/.test(condition))push({id:"fmcsa-seizure",standard:"fmcsa",level:"strict",title:"Driver seizure standard",summary:"The FMCSA seizure standard and exemption pathway require specific history and qualification review.",action:"Use the current FMCSA seizure standard/exemption guidance; do not infer qualification from diagnosis alone.",source:"49 CFR 391.41(b)(8)",url:STANDARDS.fmcsa.url});}
if(frameworks.includes("faa")){push({id:"faa-base",standard:"faa",level:"info",title:"FAA aeromedical disposition framework",summary:"FAA certification uses condition- and medication-specific disposition tables, protocols and special-issuance pathways.",action:"Open the current AME Guide for the exact condition/medication and certification class.",source:"FAA Guide for Aviation Medical Examiners",url:STANDARDS.faa.url});}
if(frameworks.includes("nfpa")){push({id:"nfpa-base",standard:"nfpa",level:"info",title:"Emergency responder medical / wellness framework",summary:"NFPA 1580 contains occupational-health and wellness requirements for emergency responders.",action:"Compare the responder's essential tasks and current medical status with the applicable edition and departmental adoption.",source:"NFPA 1580 (2025)",url:STANDARDS.nfpa.url});}
return findings;}
export function ReviewerStandardsIntelligencePage(){const [frameworks,setFrameworks]=useState<StandardId[]>(["centcom"]);const [v,setV]=useState<Record<string,string>>({occupation:"DoD contractor — CENTCOM deployment"});const findings=useMemo(()=>evaluateStandards(v,frameworks),[v,frameworks]);const levelTone=(level:Finding["level"])=>level==="strict"?"red":level==="waiver"?"amber":level==="review"?"cyan":"green";return <ToolShell eyebrow="Standards / Interaction Engine" title="Standards Intelligence" subtitle="Stack occupational frameworks around one reviewer scenario and surface source-backed requirements, escalation pathways and reviewer actions."><Surface><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/48">Controlling frameworks</p><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{(Object.keys(STANDARDS) as StandardId[]).map((id)=>{const source=STANDARDS[id],Icon=source.icon,active=frameworks.includes(id);return <button key={id} onClick={()=>setFrameworks((current)=>active?(current.length===1?current:current.filter((x)=>x!==id)):[...current,id])} className={`rounded-2xl border p-4 text-left ${active?"border-cyan-100/30 bg-cyan-300/[0.10]":"border-white/10 bg-white/[0.02] text-cyan-50/55"}`}><Icon size={17}/><strong className="mt-3 block text-sm">{source.label}</strong><p className="mt-1 text-[10px] leading-4 text-cyan-100/40">{source.source}</p></button>})}</div></Surface><div className="mt-6 grid gap-6 xl:grid-cols-[.75fr_1.25fr]"><Surface><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-100/48">Scenario builder</p><div className="mt-4 space-y-3"><Field label="Occupation / context" value={v.occupation||""} onChange={(value)=>setV((x)=>({...x,occupation:value}))}/><Field label="Condition" value={v.condition||""} onChange={(value)=>setV((x)=>({...x,condition:value}))} placeholder="OSA, diabetes, seizure…"/><Field label="Medication" value={v.medication||""} onChange={(value)=>setV((x)=>({...x,medication:value}))} placeholder="Warfarin, insulin…"/><div className="grid grid-cols-2 gap-3"><Field label="A1C" value={v.a1c||""} onChange={(value)=>setV((x)=>({...x,a1c:value}))} type="number"/><Field label="AHI" value={v.ahi||""} onChange={(value)=>setV((x)=>({...x,ahi:value}))} type="number"/><Field label="PAP compliance %" value={v.pap||""} onChange={(value)=>setV((x)=>({...x,pap:value}))} type="number"/><Field label="ASCVD %" value={v.ascvd||""} onChange={(value)=>setV((x)=>({...x,ascvd:value}))} type="number"/><Field label="SBP" value={v.sbp||""} onChange={(value)=>setV((x)=>({...x,sbp:value}))} type="number"/><Field label="DBP" value={v.dbp||""} onChange={(value)=>setV((x)=>({...x,dbp:value}))} type="number"/></div></div></Surface><Surface><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/48">Matched source rules</p><h2 className="mt-2 text-xl font-black">{findings.length} findings</h2></div><BookOpenCheck className="text-cyan-100/50" /></div><div className="mt-5 space-y-3">{findings.map((finding)=><div key={`${finding.standard}-${finding.id}`} className="rounded-2xl border border-white/12 bg-white/[0.025] p-4"><div className="flex flex-wrap items-center gap-2"><StatusPill tone={levelTone(finding.level)}>{finding.level}</StatusPill><StatusPill>{STANDARDS[finding.standard].label}</StatusPill></div><h3 className="mt-3 text-base font-black">{finding.title}</h3><p className="mt-2 text-xs leading-5 text-cyan-100/55">{finding.summary}</p><div className="mt-3 rounded-xl border border-cyan-100/10 bg-cyan-300/[0.035] p-3 text-xs leading-5 text-cyan-50/64"><strong>Reviewer action:</strong> {finding.action}</div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] text-cyan-100/38">{finding.source}</span><SourceLink href={finding.url} label="Open source" /></div></div>)}</div><p className="mt-5 text-[11px] leading-5 text-amber-50/55">Standards change. The linked controlling source must be checked before a final operational or medical determination.</p></Surface></div></ToolShell>}
function Field({label,value,onChange,placeholder,type="text"}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string;type?:string}){return <label className="block"><span className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-100/42">{label}</span><input type={type} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} className="mt-1.5 min-h-11 w-full rounded-2xl border border-white/14 bg-black/20 px-3 text-sm outline-none placeholder:text-cyan-100/25 focus:border-cyan-100/30" /></label>}
