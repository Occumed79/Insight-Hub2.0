import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Database,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { useEmployerWorkflow } from "@/components/insight/EmployerWorkflowContext";

type Evidence = { id?: string; name: string; description?: string; value?: number; category?: string; response?: Array<{ percentage?: number; description?: string }> };
type SourceKind = "onet-task" | "onet-work-context" | "onet-ability" | "onet-work-activity" | "onet-detailed-activity" | "reviewer";
type JobDuty = {
  id: string;
  duty: string;
  sourceKind: SourceKind;
  sourceLabel: string;
  sourceId?: string;
  sourceValue?: number;
  sourceResponse?: Array<{ percentage?: number; description?: string }>;
  domains: string[];
  essentiality: "essential" | "supporting" | "unknown";
  frequency: "rare" | "occasional" | "frequent" | "constant" | "unknown";
  duration: string;
  maxLiftLbs: number | null;
  postures: string[];
  exposures: string[];
  ppe: string[];
  driving: boolean;
  heights: boolean;
  emergencyResponse: boolean;
  shiftWork: boolean;
  heavyEquipment: boolean;
  firearms: boolean;
  reviewerNotes: string;
};
type JobProfile = { id: string; profileName: string; companyName: string; jobTitle: string; location: string; onetCode: string; onetTitle: string; onetDescription: string; onetMatchScore: number | null; duties: JobDuty[]; notes: string; createdAt: string; updatedAt: string };
type OccupationProfile = { occupation?: { code?: string; title?: string; description?: string }; tasks?: Evidence[]; workContext?: Evidence[]; abilities?: Evidence[]; workActivities?: Evidence[]; detailedWorkActivities?: Evidence[] };
type Match = { code: string; title: string; score?: number };
type SearchPayload = { ok?: boolean; error?: string; matches?: Match[]; profile?: OccupationProfile | null };
type CodePayload = { ok?: boolean; error?: string; profile?: OccupationProfile | null };
type EvidenceTab = { key: string; label: string; field: keyof OccupationProfile; kind: SourceKind };

const EVIDENCE_TABS: EvidenceTab[] = [
  { key: "tasks", label: "Tasks", field: "tasks", kind: "onet-task" },
  { key: "context", label: "Work Context", field: "workContext", kind: "onet-work-context" },
  { key: "abilities", label: "Abilities", field: "abilities", kind: "onet-ability" },
  { key: "activities", label: "Work Activities", field: "workActivities", kind: "onet-work-activity" },
  { key: "detailed", label: "Detailed Activities", field: "detailedWorkActivities", kind: "onet-detailed-activity" },
];
const DOMAINS = ["Physical", "Cognitive", "Environmental", "Safety-sensitive"];
const POSTURES = ["Standing", "Walking", "Sitting", "Bending / stooping", "Kneeling / crouching", "Climbing", "Reaching", "Crawling"];
const EXPOSURES = ["Heat", "Cold", "Noise", "Dust / fumes", "Chemicals", "Infectious hazards", "Weather", "Confined space"];
const PPE = ["Respirator", "Hearing protection", "Eye / face protection", "Gloves", "Protective clothing", "Fall protection"];
const inputClass = "mt-1.5 min-h-10 w-full border border-white/10 bg-black/25 px-3 text-sm text-white outline-none focus:border-cyan-200/35";

function blankProfile(companyName = ""): JobProfile {
  return { id: "", profileName: "", companyName, jobTitle: "", location: "", onetCode: "", onetTitle: "", onetDescription: "", onetMatchScore: null, duties: [], notes: "", createdAt: "", updatedAt: "" };
}
function blankDuty(duty: string, sourceKind: SourceKind, sourceLabel: string, row?: Evidence): JobDuty {
  return { id: crypto.randomUUID(), duty, sourceKind, sourceLabel, sourceId: row?.id, sourceValue: row?.value, sourceResponse: row?.response, domains: [], essentiality: "unknown", frequency: "unknown", duration: "", maxLiftLbs: null, postures: [], exposures: [], ppe: [], driving: false, heights: false, emergencyResponse: false, shiftWork: false, heavyEquipment: false, firearms: false, reviewerNotes: "" };
}
async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, headers: { Accept: "application/json", "Content-Type": "application/json", ...(init.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status}).`);
  return payload as T;
}
function Field({ label, value, onChange, placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="block"><span className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={inputClass} /></label>;
}
function Toggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`border px-2.5 py-1.5 text-[10px] font-bold transition ${active ? "border-cyan-200/35 bg-cyan-300/[.10] text-white" : "border-white/10 text-slate-500 hover:text-slate-200"}`}>{active ? <Check size={10} className="mr-1 inline" /> : null}{label}</button>;
}
function evidenceRows(profile: OccupationProfile | null | undefined): Evidence[] {
  return profile ? [...(profile.tasks || []), ...(profile.workContext || []), ...(profile.abilities || []), ...(profile.workActivities || []), ...(profile.detailedWorkActivities || [])] : [];
}
function tokens(value: string): string[] { return value.toLowerCase().split(/[^a-z0-9]+/).filter((item) => item.length >= 3); }
function scoreEvidence(row: Evidence, query: string): number {
  const haystack = `${row.name} ${row.description || ""} ${row.category || ""}`.toLowerCase();
  return tokens(query).reduce((sum, term) => sum + (haystack.includes(term) ? 20 : 0), 0) + Math.max(row.value || 0, 0);
}
function signalCounts(profile: OccupationProfile | null | undefined) {
  const text = evidenceRows(profile).map((item) => `${item.name} ${item.description || ""}`).join(" ").toLowerCase();
  const rules = {
    Physical: ["lift", "carry", "climb", "strength", "standing", "walking", "handling", "reaching", "kneeling", "crouching"],
    Cognitive: ["attention", "decision", "problem", "remember", "reasoning", "information", "monitor", "communicat"],
    Environmental: ["noise", "heat", "cold", "weather", "contaminant", "chemical", "dust", "fume", "outdoors"],
    "Safety-sensitive": ["vehicle", "emergency", "hazard", "protective equipment", "public safety", "control precision", "reaction time"],
  };
  return Object.entries(rules).map(([label, terms]) => ({ label, count: terms.filter((term) => text.includes(term)).length }));
}
function number(value: number): string { return Number.isFinite(value) ? value.toLocaleString("en-US", { maximumFractionDigits: 1 }) : "0"; }

export default function JobIntelligenceV2() {
  const { context } = useEmployerWorkflow();
  const selectedEmployer = (context.legalName || context.employer || "").trim();
  const [profiles, setProfiles] = useState<JobProfile[]>([]);
  const [active, setActive] = useState<JobProfile>(() => blankProfile(selectedEmployer));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [onet, setOnet] = useState<OccupationProfile | null>(null);
  const [loadingOnet, setLoadingOnet] = useState(false);
  const [compareTerm, setCompareTerm] = useState("");
  const [compareMatches, setCompareMatches] = useState<Match[]>([]);
  const [compareProfile, setCompareProfile] = useState<OccupationProfile | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [evidenceTab, setEvidenceTab] = useState("tasks");
  const [relevance, setRelevance] = useState("");
  const [manualDuty, setManualDuty] = useState("");

  useEffect(() => { void api<{ profiles: JobProfile[] }>("/api/job-intelligence/profiles").then((payload) => setProfiles(payload.profiles || [])).catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Unable to load saved profiles.")).finally(() => setLoadingProfiles(false)); }, []);
  useEffect(() => { if (selectedEmployer && !active.companyName) { setActive((current) => ({ ...current, companyName: selectedEmployer })); setDirty(true); } }, [selectedEmployer, active.companyName]);

  function mutate(patch: Partial<JobProfile>) { setActive((current) => ({ ...current, ...patch })); setDirty(true); }
  function mutateDuty(id: string, patch: Partial<JobDuty>) { setActive((current) => ({ ...current, duties: current.duties.map((duty) => duty.id === id ? { ...duty, ...patch } : duty) })); setDirty(true); }
  function toggleArray(id: string, key: "domains" | "postures" | "exposures" | "ppe", value: string) {
    const duty = active.duties.find((item) => item.id === id);
    if (!duty) return;
    const next = duty[key].includes(value) ? duty[key].filter((item) => item !== value) : [...duty[key], value];
    mutateDuty(id, { [key]: next } as Partial<JobDuty>);
  }

  async function searchOccupation() {
    const clean = searchTerm.trim();
    if (!clean) return;
    setLoadingOnet(true); setError("");
    try {
      const payload = await api<SearchPayload>(`/api/occupational-discovery/onet/profile?keyword=${encodeURIComponent(clean)}`);
      setMatches(payload.matches || []);
      if (payload.matches?.length === 1 && payload.matches[0]) await selectCandidate(payload.matches[0]); else setOnet(null);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "O*NET search failed."); }
    finally { setLoadingOnet(false); }
  }

  async function selectCandidate(match: Match) {
    setLoadingOnet(true); setError("");
    try {
      const payload = await api<CodePayload>(`/api/occupational-discovery/onet/profile-by-code?code=${encodeURIComponent(match.code)}`);
      const profile = payload.profile || null;
      setOnet(profile);
      if (profile?.occupation) mutate({ jobTitle: active.jobTitle || profile.occupation.title || "", profileName: active.profileName || profile.occupation.title || "", onetCode: profile.occupation.code || match.code, onetTitle: profile.occupation.title || match.title, onetDescription: profile.occupation.description || "", onetMatchScore: match.score ?? null });
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to load selected O*NET occupation."); }
    finally { setLoadingOnet(false); }
  }

  async function searchCompare() {
    const clean = compareTerm.trim();
    if (!clean) return;
    setLoadingCompare(true); setError("");
    try { const payload = await api<SearchPayload>(`/api/occupational-discovery/onet/profile?keyword=${encodeURIComponent(clean)}`); setCompareMatches(payload.matches || []); setCompareProfile(null); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Comparison search failed."); }
    finally { setLoadingCompare(false); }
  }

  async function selectCompare(match: Match) {
    setLoadingCompare(true);
    try { const payload = await api<CodePayload>(`/api/occupational-discovery/onet/profile-by-code?code=${encodeURIComponent(match.code)}`); setCompareProfile(payload.profile || null); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Comparison occupation failed to load."); }
    finally { setLoadingCompare(false); }
  }

  const tabConfig = EVIDENCE_TABS.find((item) => item.key === evidenceTab) || EVIDENCE_TABS[0];
  const tabRows = ((onet?.[tabConfig.field] as Evidence[] | undefined) || []).map((row) => ({ row, score: scoreEvidence(row, relevance) })).sort((a, b) => b.score - a.score);
  const essential = active.duties.filter((duty) => duty.essentiality === "essential");
  const structured = active.duties.filter((duty) => duty.essentiality !== "unknown" || duty.frequency !== "unknown" || duty.domains.length || duty.postures.length || duty.exposures.length || duty.ppe.length || duty.maxLiftLbs !== null).length;
  const comparisonA = signalCounts(onet);
  const comparisonB = signalCounts(compareProfile);

  function addEvidence(row: Evidence) {
    if (active.duties.some((duty) => duty.sourceKind === tabConfig.kind && (row.id ? duty.sourceId === row.id : duty.duty.toLowerCase() === row.name.toLowerCase()))) return;
    mutate({ duties: [...active.duties, blankDuty(row.name, tabConfig.kind, `O*NET ${onet?.occupation?.code || active.onetCode} · ${tabConfig.label}`, row)] });
  }
  function addManualDuty() {
    const duty = manualDuty.trim();
    if (!duty || active.duties.some((item) => item.duty.toLowerCase() === duty.toLowerCase())) return;
    mutate({ duties: [...active.duties, blankDuty(duty, "reviewer", "Reviewer-entered essential-function candidate")] });
    setManualDuty("");
  }

  async function saveProfile() {
    if (!active.profileName.trim() && !active.jobTitle.trim()) { setError("Give this profile a name or job title before saving."); return; }
    setSaving(true); setError("");
    try {
      const payload = active.id
        ? await api<{ profile: JobProfile }>(`/api/job-intelligence/profiles/${encodeURIComponent(active.id)}`, { method: "PATCH", body: JSON.stringify(active) })
        : await api<{ profile: JobProfile }>("/api/job-intelligence/profiles", { method: "POST", body: JSON.stringify(active) });
      setActive(payload.profile);
      setProfiles((current) => [payload.profile, ...current.filter((item) => item.id !== payload.profile.id)]);
      setDirty(false);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to save profile."); }
    finally { setSaving(false); }
  }

  async function deleteProfile() {
    if (!active.id) { setActive(blankProfile(selectedEmployer)); setOnet(null); setMatches([]); setDirty(false); return; }
    try {
      await api(`/api/job-intelligence/profiles/${encodeURIComponent(active.id)}`, { method: "DELETE" });
      setProfiles((current) => current.filter((item) => item.id !== active.id));
      setActive(blankProfile(selectedEmployer)); setOnet(null); setMatches([]); setDirty(false);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to delete profile."); }
  }

  return (
    <main className="min-h-screen bg-[#06090d] pb-16 text-white">
      <Sidebar />
      <section className="px-5 py-8 lg:ml-[210px] lg:px-8 2xl:px-10">
        <HeaderBar eyebrow="Occupational Intelligence · O*NET + Reviewer Evidence" title="Job Intelligence" subtitle="Resolve the occupation, inspect official O*NET evidence, and build a durable employer-specific essential-functions profile without mixing jobs or turning source signals into medical conclusions." />
        {error ? <div className="mt-4 border border-rose-200/18 bg-rose-300/[.04] p-3 text-xs text-rose-100">{error}</div> : null}

        <div className="mt-5 grid min-h-[790px] border border-white/10 bg-[#080c12] xl:grid-cols-[285px_minmax(0,1fr)_390px]">
          <aside className="border-b border-white/10 xl:border-b-0 xl:border-r">
            <div className="border-b border-white/10 p-4"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-500">Saved profile library</p><p className="mt-1 text-sm font-black text-white">{loadingProfiles ? "Loading…" : `${profiles.length} profiles`}</p></div><BriefcaseBusiness size={16} className="text-cyan-200/50" /></div></div>
            <div className="max-h-[250px] overflow-y-auto divide-y divide-white/[.06]">{profiles.map((profile) => <button key={profile.id} type="button" onClick={() => { setActive(profile); setDirty(false); setSearchTerm(profile.jobTitle); if (profile.onetCode) void api<CodePayload>(`/api/occupational-discovery/onet/profile-by-code?code=${encodeURIComponent(profile.onetCode)}`).then((payload) => setOnet(payload.profile || null)).catch(() => setOnet(null)); }} className={`w-full p-4 text-left transition ${active.id === profile.id ? "bg-cyan-300/[.055]" : "hover:bg-white/[.02]"}`}><p className="text-sm font-black text-white">{profile.profileName}</p><p className="mt-1 text-[10px] leading-5 text-slate-500">{profile.companyName || "No company"} · {profile.jobTitle || "No job title"}</p></button>)}{!profiles.length && !loadingProfiles ? <p className="p-4 text-xs text-slate-500">No saved profiles yet.</p> : null}</div>

            <div className="border-t border-white/10 p-4"><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-500">Profile identity</p><div className="mt-4 space-y-3"><Field label="Profile name" value={active.profileName} onChange={(value) => mutate({ profileName: value })} placeholder="e.g. V2X Firefighter — Redzikowo" /><Field label="Company" value={active.companyName} onChange={(value) => mutate({ companyName: value })} placeholder="Employer / Entity" /><Field label="Job title" value={active.jobTitle} onChange={(value) => mutate({ jobTitle: value })} /><Field label="Location" value={active.location} onChange={(value) => mutate({ location: value })} /></div><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => void saveProfile()} disabled={saving || !dirty} className="inline-flex min-h-10 items-center justify-center gap-2 border border-cyan-200/20 bg-cyan-300/[.08] px-3 text-xs font-black disabled:opacity-40">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Save profile</button><button type="button" onClick={() => void deleteProfile()} className="inline-flex min-h-10 items-center justify-center gap-2 border border-rose-200/14 px-3 text-xs text-rose-100/70"><Trash2 size={14} />{active.id ? "Delete" : "Clear"}</button></div></div>

            <div className="border-t border-white/10 p-4"><div className="grid grid-cols-3 gap-3 text-center"><div><p className="text-[9px] uppercase text-slate-600">Duties</p><p className="mt-1 text-lg font-black">{active.duties.length}</p></div><div><p className="text-[9px] uppercase text-slate-600">Essential</p><p className="mt-1 text-lg font-black">{essential.length}</p></div><div><p className="text-[9px] uppercase text-slate-600">Structured</p><p className="mt-1 text-lg font-black">{structured}</p></div></div></div>
          </aside>

          <section className="min-w-0 border-b border-white/10 xl:border-b-0 xl:border-r">
            <div className="border-b border-white/10 p-5"><div className="flex items-center gap-2"><Database size={15} className="text-emerald-200/60" /><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-500">Occupation resolution</p></div><h2 className="mt-2 text-xl font-black text-white">Select the actual O*NET occupation</h2><p className="mt-1 text-xs leading-5 text-slate-500">Search results remain explicit when more than one occupation matches.</p><div className="mt-4 flex gap-2"><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchOccupation(); }} placeholder="Search occupation title" className="min-h-11 min-w-0 flex-1 border border-white/10 bg-black/25 px-3 text-sm outline-none" /><button type="button" onClick={() => void searchOccupation()} disabled={loadingOnet || !searchTerm.trim()} className="inline-flex min-h-11 items-center gap-2 border border-emerald-200/20 bg-emerald-300/[.07] px-4 text-xs font-black">{loadingOnet ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}Search</button></div>{matches.length ? <div className="mt-3 grid gap-1 border-y border-white/7">{matches.map((match) => <button key={match.code} type="button" onClick={() => void selectCandidate(match)} className={`grid grid-cols-[1fr_100px] gap-3 border-b border-white/[.05] px-3 py-3 text-left last:border-b-0 ${active.onetCode === match.code ? "bg-emerald-300/[.055]" : "hover:bg-white/[.02]"}`}><span className="text-xs font-black text-white">{match.title}</span><span className="text-right text-[10px] font-bold text-slate-500">{match.code}{match.score != null ? ` · ${match.score}` : ""}</span></button>)}</div> : null}{onet?.occupation ? <div className="mt-4 border-l-2 border-emerald-200/50 pl-4"><p className="text-sm font-black text-white">Selected: {onet.occupation.title}</p><p className="mt-1 text-[10px] font-bold text-emerald-100/65">{onet.occupation.code}</p><p className="mt-2 text-xs leading-6 text-slate-400">{onet.occupation.description}</p></div> : null}</div>

            <div className="border-b border-white/10 p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-500">O*NET evidence</p><h2 className="mt-1 text-lg font-black text-white">Source demands</h2></div><span className="text-[10px] text-slate-600">{tabRows.length} rows</span></div><div className="mt-4 flex gap-5 overflow-x-auto border-b border-white/8">{EVIDENCE_TABS.map((tab) => <button key={tab.key} type="button" onClick={() => setEvidenceTab(tab.key)} className={`min-h-10 shrink-0 border-b-2 text-xs font-bold ${evidenceTab === tab.key ? "border-cyan-200 text-white" : "border-transparent text-slate-500"}`}>{tab.label}</button>)}</div><label className="mt-4 block"><span className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">Relevance keywords</span><input value={relevance} onChange={(event) => setRelevance(event.target.value)} placeholder="e.g. lifting overhead noise respirator driving" className={inputClass} /><span className="mt-1 block text-[9px] leading-4 text-slate-600">Keywords re-rank source evidence; they do not alter the O*NET values.</span></label><div className="mt-4 max-h-[520px] overflow-y-auto divide-y divide-white/[.06] border-t border-white/7">{tabRows.slice(0, 40).map(({ row, score }, index) => { const added = active.duties.some((duty) => duty.sourceKind === tabConfig.kind && (row.id ? duty.sourceId === row.id : duty.duty.toLowerCase() === row.name.toLowerCase())); return <article key={`${row.id || row.name}-${index}`} className="grid grid-cols-[1fr_90px_42px] gap-3 py-3"><div><p className="text-xs font-black leading-5 text-white">{row.name}</p>{row.description ? <p className="mt-1 text-[10px] leading-5 text-slate-500">{row.description}</p> : null}</div><div className="text-right"><p className="text-[9px] text-slate-600">rank</p><p className="mt-1 text-xs font-black text-slate-300">{number(score)}</p>{row.value != null ? <p className="mt-1 text-[9px] text-slate-600">O*NET {row.value}</p> : null}</div><button type="button" onClick={() => addEvidence(row)} disabled={added} aria-label={`Add ${row.name} to duty workspace`} className="grid h-9 w-9 place-items-center border border-cyan-100/14 disabled:opacity-35">{added ? <Check size={13} /> : <Plus size={13} />}</button></article>; })}{!onet ? <p className="py-5 text-xs text-slate-500">Select an occupation to load source evidence.</p> : null}</div></div>

            <div className="p-5"><div className="flex items-center gap-2"><ArrowRightLeft size={15} className="text-violet-200/55" /><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-500">Occupation comparison</p></div><div className="mt-3 flex gap-2"><input value={compareTerm} onChange={(event) => setCompareTerm(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchCompare(); }} placeholder="Compare against another occupation" className="min-h-10 min-w-0 flex-1 border border-white/10 bg-black/25 px-3 text-sm outline-none" /><button type="button" onClick={() => void searchCompare()} disabled={loadingCompare || !compareTerm.trim()} className="min-h-10 border border-violet-200/18 px-4 text-xs font-black">{loadingCompare ? <Loader2 size={14} className="animate-spin" /> : "Find"}</button></div>{compareMatches.length ? <div className="mt-3 flex gap-2 overflow-x-auto">{compareMatches.map((match) => <button key={match.code} type="button" onClick={() => void selectCompare(match)} className={`shrink-0 border px-3 py-2 text-[10px] font-black ${compareProfile?.occupation?.code === match.code ? "border-violet-200/30 bg-violet-300/[.08]" : "border-white/10"}`}>{match.title} · {match.code}</button>)}</div> : null}{onet?.occupation && compareProfile?.occupation ? <div className="mt-4 grid gap-4 md:grid-cols-2"><SignalComparison title={`A · ${onet.occupation.title}`} items={comparisonA} /><SignalComparison title={`B · ${compareProfile.occupation.title}`} items={comparisonB} /><p className="md:col-span-2 text-[9px] leading-4 text-slate-600">Signal counts are transparent keyword-presence summaries across O*NET source fields for orientation only; they are not medical or job-risk scores.</p></div> : null}</div>
          </section>

          <aside className="bg-[#070b10]">
            <div className="sticky top-0 max-h-screen overflow-y-auto">
              <div className="border-b border-white/10 p-4"><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-500">Duty / essential-functions workspace</p><h2 className="mt-1 text-lg font-black text-white">Employer-specific duties</h2><p className="mt-2 text-[11px] leading-5 text-slate-500">O*NET is source evidence. Essentiality, frequency, exposures, PPE, physical detail, and employer-specific requirements remain reviewer decisions.</p><div className="mt-4 flex gap-2"><input value={manualDuty} onChange={(event) => setManualDuty(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addManualDuty(); }} placeholder="Add employer-specific duty" className="min-h-10 min-w-0 flex-1 border border-white/10 bg-black/25 px-3 text-xs outline-none" /><button type="button" onClick={addManualDuty} className="grid h-10 w-10 place-items-center border border-white/10"><Plus size={14} /></button></div></div>

              <div className="divide-y divide-white/[.06]">{active.duties.map((duty) => <details key={duty.id} className="group p-4" open={duty.essentiality === "essential"}><summary className="flex cursor-pointer list-none items-start justify-between gap-3"><div><p className="text-sm font-black leading-5 text-white">{duty.duty}</p><p className="mt-1 text-[9px] leading-4 text-slate-600">{duty.sourceLabel}</p></div><div className="flex items-center gap-2"><span className={`border px-2 py-1 text-[8px] font-black uppercase ${duty.essentiality === "essential" ? "border-emerald-200/20 text-emerald-100" : "border-white/9 text-slate-500"}`}>{duty.essentiality}</span><ChevronDown size={14} className="text-slate-600 transition group-open:rotate-180" /></div></summary><div className="mt-4 border-t border-white/8 pt-4"><div className="grid gap-3 sm:grid-cols-3"><label><span className="text-[9px] font-bold uppercase text-slate-600">Essentiality</span><select aria-label="Essentiality" value={duty.essentiality} onChange={(event) => mutateDuty(duty.id, { essentiality: event.target.value as JobDuty["essentiality"] })} className={inputClass}><option value="unknown">Unknown</option><option value="essential">Essential</option><option value="supporting">Supporting</option></select></label><label><span className="text-[9px] font-bold uppercase text-slate-600">Frequency</span><select aria-label="Frequency" value={duty.frequency} onChange={(event) => mutateDuty(duty.id, { frequency: event.target.value as JobDuty["frequency"] })} className={inputClass}><option value="unknown">Unknown</option><option value="rare">Rare</option><option value="occasional">Occasional</option><option value="frequent">Frequent</option><option value="constant">Constant</option></select></label><label><span className="text-[9px] font-bold uppercase text-slate-600">Max lift lbs</span><input aria-label="Max lift lbs" type="number" value={duty.maxLiftLbs ?? ""} onChange={(event) => mutateDuty(duty.id, { maxLiftLbs: event.target.value ? Number(event.target.value) : null })} className={inputClass} /></label></div><DutyToggleGroup label="Domains" values={DOMAINS} selected={duty.domains} onToggle={(value) => toggleArray(duty.id, "domains", value)} /><DutyToggleGroup label="Postures" values={POSTURES} selected={duty.postures} onToggle={(value) => toggleArray(duty.id, "postures", value)} /><DutyToggleGroup label="Exposures" values={EXPOSURES} selected={duty.exposures} onToggle={(value) => toggleArray(duty.id, "exposures", value)} /><DutyToggleGroup label="PPE" values={PPE} selected={duty.ppe} onToggle={(value) => toggleArray(duty.id, "ppe", value)} /><div className="mt-4 flex flex-wrap gap-2">{(["driving", "heights", "emergencyResponse", "shiftWork", "heavyEquipment", "firearms"] as const).map((key) => <Toggle key={key} label={{ driving: "Driving", heights: "Heights", emergencyResponse: "Emergency response", shiftWork: "Shift work", heavyEquipment: "Heavy equipment", firearms: "Firearms" }[key]} active={Boolean(duty[key])} onClick={() => mutateDuty(duty.id, { [key]: !duty[key] } as Partial<JobDuty>)} />)}</div><label className="mt-4 block"><span className="text-[9px] font-bold uppercase text-slate-600">Reviewer notes</span><textarea value={duty.reviewerNotes} onChange={(event) => mutateDuty(duty.id, { reviewerNotes: event.target.value })} rows={3} className={`${inputClass} min-h-[82px] py-2`} /></label><button type="button" onClick={() => mutate({ duties: active.duties.filter((item) => item.id !== duty.id) })} className="mt-3 inline-flex items-center gap-1 text-[10px] text-rose-100/60"><Trash2 size={12} />Remove duty</button></div></details>)}{!active.duties.length ? <p className="p-5 text-xs leading-5 text-slate-500">Add O*NET evidence or an employer-specific duty from the workspace.</p> : null}</div>

              <div className="border-t border-white/10 p-4"><p className="text-[10px] font-black uppercase tracking-[.14em] text-emerald-100/55">Verified essential functions</p><div className="mt-3 divide-y divide-white/[.06]">{essential.map((duty) => <div key={duty.id} className="py-3"><p className="text-xs font-black text-white">{duty.duty}</p><p className="mt-1 text-[9px] leading-4 text-slate-500">{duty.frequency} · {duty.domains.join(" / ") || "domain not tagged"}{duty.maxLiftLbs != null ? ` · max lift ${duty.maxLiftLbs} lb` : ""}</p></div>)}{!essential.length ? <p className="py-3 text-xs text-slate-500">Mark reviewed duties as Essential to build this profile.</p> : null}</div></div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function DutyToggleGroup({ label, values, selected, onToggle }: { label: string; values: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return <div className="mt-4"><p className="text-[9px] font-bold uppercase text-slate-600">{label}</p><div className="mt-2 flex flex-wrap gap-2">{values.map((value) => <Toggle key={value} label={value} active={selected.includes(value)} onClick={() => onToggle(value)} />)}</div></div>;
}

function SignalComparison({ title, items }: { title: string; items: Array<{ label: string; count: number }> }) {
  return <div className="border border-white/8 p-3"><p className="text-xs font-black text-white">{title}</p><div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">{items.map((item) => <div key={item.label} className="flex items-center justify-between gap-2 border-b border-white/[.05] py-1.5"><span className="text-[9px] text-slate-500">{item.label}</span><strong className="text-xs text-slate-300">{item.count}</strong></div>)}</div></div>;
}
