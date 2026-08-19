import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Check, ChevronDown, Database, Loader2, Plus, Save, Search, Trash2 } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import "./reviewer-tool-hierarchy.css";

type Evidence = {
  id?: string;
  name: string;
  description?: string;
  value?: number;
  category?: string;
  response?: Array<{ percentage?: number; description?: string }>;
};

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

type JobProfile = {
  id: string;
  profileName: string;
  companyName: string;
  jobTitle: string;
  location: string;
  onetCode: string;
  onetTitle: string;
  onetDescription: string;
  onetMatchScore: number | null;
  duties: JobDuty[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type OnetPayload = {
  ok?: boolean;
  error?: string;
  matches?: Array<{ code: string; title: string; score?: number }>;
  profile?: {
    occupation?: { code?: string; title?: string; description?: string };
    tasks?: Evidence[];
    workContext?: Evidence[];
    abilities?: Evidence[];
    workActivities?: Evidence[];
    detailedWorkActivities?: Evidence[];
    counts?: Record<string, number>;
    partialErrors?: string[];
  } | null;
  source?: string;
};

const LEGACY_DUTY_KEY = "insight_hub_reviewer_job_duties";
const DOMAINS = ["Physical", "Cognitive", "Environmental", "Safety-sensitive"];
const POSTURES = ["Standing", "Walking", "Sitting", "Bending / stooping", "Kneeling / crouching", "Climbing", "Reaching", "Crawling"];
const EXPOSURES = ["Heat", "Cold", "Noise", "Dust / fumes", "Chemicals", "Infectious hazards", "Weather", "Confined space"];
const PPE = ["Respirator", "Hearing protection", "Eye / face protection", "Gloves", "Protective clothing", "Fall protection"];

const EVIDENCE_TABS: Array<{ key: string; label: string; kind: SourceKind; field: keyof NonNullable<OnetPayload["profile"]> }> = [
  { key: "tasks", label: "Tasks", kind: "onet-task", field: "tasks" },
  { key: "context", label: "Work context", kind: "onet-work-context", field: "workContext" },
  { key: "abilities", label: "Abilities", kind: "onet-ability", field: "abilities" },
  { key: "activities", label: "Work activities", kind: "onet-work-activity", field: "workActivities" },
  { key: "detailed", label: "Detailed activities", kind: "onet-detailed-activity", field: "detailedWorkActivities" },
];

function blankProfile(): JobProfile {
  return {
    id: "",
    profileName: "",
    companyName: "",
    jobTitle: "",
    location: "",
    onetCode: "",
    onetTitle: "",
    onetDescription: "",
    onetMatchScore: null,
    duties: [],
    notes: "",
    createdAt: "",
    updatedAt: "",
  };
}

function blankDuty(duty: string, sourceKind: SourceKind, sourceLabel: string, row?: Evidence): JobDuty {
  return {
    id: crypto.randomUUID(),
    duty,
    sourceKind,
    sourceLabel,
    sourceId: row?.id,
    sourceValue: typeof row?.value === "number" ? row.value : undefined,
    sourceResponse: row?.response,
    domains: [],
    essentiality: "unknown",
    frequency: "unknown",
    duration: "",
    maxLiftLbs: null,
    postures: [],
    exposures: [],
    ppe: [],
    driving: false,
    heights: false,
    emergencyResponse: false,
    shiftWork: false,
    heavyEquipment: false,
    firearms: false,
    reviewerNotes: "",
  };
}

async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json" },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status}).`);
  return payload as T;
}

function Field({ label, value, onChange, placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="block"><span className="rh-label">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="rh-input mt-2" /></label>;
}

function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-full border px-2.5 py-1.5 text-[10px] font-black transition ${active ? "border-cyan-200/35 bg-cyan-300/[.12] text-cyan-50" : "border-white/10 bg-white/[.025] text-cyan-100/45 hover:border-white/20 hover:text-white"}`}>{active ? <Check size={10} className="mr-1 inline" /> : null}{label}</button>;
}

function EvidenceCard({ row, onAdd, alreadyAdded }: { row: Evidence; onAdd: () => void; alreadyAdded: boolean }) {
  const responses = (row.response || []).filter((item) => item.description || typeof item.percentage === "number").slice(0, 4);
  return <article className="rounded-2xl border border-white/10 bg-white/[.022] p-4">
    <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-bold leading-5">{row.name}</p>{row.description ? <p className="mt-1 text-[11px] leading-5 text-cyan-100/42">{row.description}</p> : null}</div><button type="button" onClick={onAdd} disabled={alreadyAdded} aria-label={`Add ${row.name}`} className="h-9 w-9 shrink-0 rounded-xl border border-cyan-100/16 text-cyan-100/65 disabled:opacity-35">{alreadyAdded ? <Check size={14} className="mx-auto" /> : <Plus size={14} className="mx-auto" />}</button></div>
    <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-black text-cyan-100/50">{typeof row.value === "number" ? <span className="rounded-full border border-white/10 px-2 py-1">O*NET value {row.value}</span> : null}{row.category ? <span className="rounded-full border border-white/10 px-2 py-1">{row.category}</span> : null}</div>
    {responses.length ? <div className="mt-3 grid gap-1.5">{responses.map((response, index) => <div key={`${response.description}-${index}`} className="flex items-center justify-between gap-3 text-[10px] text-cyan-100/45"><span>{response.description || "Response"}</span><strong className="text-cyan-50/75">{typeof response.percentage === "number" ? `${response.percentage}%` : "—"}</strong></div>)}</div> : null}
  </article>;
}

export default function ReviewerJobIntelligencePage() {
  const [profiles, setProfiles] = useState<JobProfile[]>([]);
  const [active, setActive] = useState<JobProfile>(() => blankProfile());
  const [dirty, setDirty] = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [onet, setOnet] = useState<OnetPayload | null>(null);
  const [loadingOnet, setLoadingOnet] = useState(false);
  const [error, setError] = useState("");
  const [evidenceTab, setEvidenceTab] = useState("tasks");
  const [paste, setPaste] = useState("");
  const [legacyDuties, setLegacyDuties] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(LEGACY_DUTY_KEY) || "[]"); } catch { return []; }
  });

  useEffect(() => {
    void api<{ profiles: JobProfile[] }>("/api/job-intelligence/profiles")
      .then((payload) => setProfiles(payload.profiles || []))
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Unable to load saved profiles."))
      .finally(() => setLoadingProfiles(false));
  }, []);

  const selectedEvidence = useMemo(() => {
    const config = EVIDENCE_TABS.find((tab) => tab.key === evidenceTab) || EVIDENCE_TABS[0];
    const rows = (onet?.profile?.[config.field] as Evidence[] | undefined) || [];
    return { ...config, rows };
  }, [evidenceTab, onet]);

  const summary = useMemo(() => {
    const domainCounts = Object.fromEntries(DOMAINS.map((domain) => [domain, active.duties.filter((duty) => duty.domains.includes(domain)).length]));
    const essential = active.duties.filter((duty) => duty.essentiality === "essential").length;
    const operational = active.duties.filter((duty) => duty.driving || duty.heights || duty.emergencyResponse || duty.shiftWork || duty.heavyEquipment || duty.firearms).length;
    const structured = active.duties.filter((duty) => duty.domains.length || duty.essentiality !== "unknown" || duty.frequency !== "unknown" || duty.maxLiftLbs !== null || duty.postures.length || duty.exposures.length || duty.ppe.length || duty.driving || duty.heights || duty.emergencyResponse || duty.shiftWork || duty.heavyEquipment || duty.firearms).length;
    return { domainCounts, essential, operational, structured };
  }, [active.duties]);

  function mutateProfile(patch: Partial<JobProfile>) {
    setActive((current) => ({ ...current, ...patch }));
    setDirty(true);
  }

  function mutateDuty(id: string, patch: Partial<JobDuty>) {
    setActive((current) => ({ ...current, duties: current.duties.map((duty) => duty.id === id ? { ...duty, ...patch } : duty) }));
    setDirty(true);
  }

  function toggleDutyArray(id: string, key: "domains" | "postures" | "exposures" | "ppe", value: string) {
    const duty = active.duties.find((item) => item.id === id);
    if (!duty) return;
    const next = duty[key].includes(value) ? duty[key].filter((item) => item !== value) : [...duty[key], value];
    mutateDuty(id, { [key]: next } as Partial<JobDuty>);
  }

  async function searchJob(term = query, attachIdentity = true) {
    const clean = term.trim();
    if (!clean) return;
    setQuery(clean);
    setLoadingOnet(true);
    setError("");
    try {
      const payload = await api<OnetPayload>(`/api/occupational-discovery/onet/profile?keyword=${encodeURIComponent(clean)}`);
      setOnet(payload);
      const occupation = payload.profile?.occupation;
      if (attachIdentity && occupation?.title) {
        setActive((current) => ({
          ...current,
          jobTitle: current.jobTitle || occupation.title || "",
          profileName: current.profileName || occupation.title || "",
          onetCode: occupation.code || "",
          onetTitle: occupation.title || "",
          onetDescription: occupation.description || "",
          onetMatchScore: payload.matches?.[0]?.score ?? null,
        }));
        setDirty(true);
      }
    } catch (requestError) {
      setOnet(null);
      setError(requestError instanceof Error ? requestError.message : "O*NET unavailable.");
    } finally {
      setLoadingOnet(false);
    }
  }

  function addEvidence(row: Evidence, sourceKind: SourceKind) {
    const duplicate = active.duties.some((duty) => duty.sourceKind === sourceKind && ((row.id && duty.sourceId === row.id) || duty.duty.toLowerCase() === row.name.toLowerCase()));
    if (duplicate) return;
    const label = `O*NET ${active.onetCode || onet?.profile?.occupation?.code || ""} · ${selectedEvidence.label}`.replace(/\s+·/, " ·");
    mutateProfile({ duties: [...active.duties, blankDuty(row.name, sourceKind, label, row)] });
  }

  function importPaste() {
    const rows = paste.split(/\n|•|;/).map((item) => item.replace(/^[-*\d.)\s]+/, "").trim()).filter(Boolean);
    if (!rows.length) return;
    const additions = rows.filter((row) => !active.duties.some((duty) => duty.duty.toLowerCase() === row.toLowerCase())).map((row) => blankDuty(row, "reviewer", "Reviewer-entered job description"));
    mutateProfile({ duties: [...active.duties, ...additions] });
    setPaste("");
  }

  function importLegacy() {
    const additions = legacyDuties.map((item) => blankDuty(String(item?.duty || "").trim(), "reviewer", String(item?.source || "Legacy browser duty"))).filter((item) => item.duty && !active.duties.some((duty) => duty.duty.toLowerCase() === item.duty.toLowerCase()));
    mutateProfile({ duties: [...active.duties, ...additions] });
    localStorage.removeItem(LEGACY_DUTY_KEY);
    setLegacyDuties([]);
  }

  async function saveProfile() {
    if (!active.profileName.trim() && !active.jobTitle.trim()) { setError("Give this job profile a name or job title before saving."); return; }
    setSaving(true);
    setError("");
    try {
      const body = JSON.stringify(active);
      const payload = active.id
        ? await api<{ profile: JobProfile }>(`/api/job-intelligence/profiles/${encodeURIComponent(active.id)}`, { method: "PATCH", body })
        : await api<{ profile: JobProfile }>("/api/job-intelligence/profiles", { method: "POST", body });
      setActive(payload.profile);
      setProfiles((current) => [payload.profile, ...current.filter((item) => item.id !== payload.profile.id)]);
      setDirty(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProfile() {
    if (!active.id) { setActive(blankProfile()); setOnet(null); setDirty(false); return; }
    try {
      await api(`/api/job-intelligence/profiles/${encodeURIComponent(active.id)}`, { method: "DELETE" });
      setProfiles((current) => current.filter((item) => item.id !== active.id));
      setActive(blankProfile());
      setOnet(null);
      setDirty(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to delete profile.");
    }
  }

  function chooseProfile(id: string) {
    if (!id) { setActive(blankProfile()); setOnet(null); setQuery(""); setDirty(false); return; }
    const found = profiles.find((profile) => profile.id === id);
    if (!found) return;
    setActive(found);
    setDirty(false);
    setQuery(found.onetTitle || found.jobTitle);
    if (found.onetTitle || found.jobTitle) void searchJob(found.onetTitle || found.jobTitle, false);
  }

  return <main className="aurora-bg reviewer-native-page min-h-screen pb-24 text-white"><Sidebar/><section className="relative z-10 px-5 py-8 pt-24 lg:ml-[210px] lg:px-12 lg:pt-8">
    <HeaderBar eyebrow="Occupational / Job Intelligence" title="Job Intelligence" subtitle="Build a durable job profile from official O*NET evidence and reviewer-confirmed job demands — without mixing one job's duties into another."/>

    <div className="rh-stack">
      <section className="rh-primary-action">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="rh-kicker">01 · Persistent job profile</div><h2 className="rh-section-title">Anchor every demand to the actual job.</h2><p className="rh-section-copy">Profiles are saved in Neon by company/job identity. O*NET evidence and reviewer-entered demands stay attached to that profile.</p></div><div className="flex items-center gap-2 rounded-full border border-emerald-200/15 bg-emerald-300/[.05] px-3 py-1.5 text-[10px] font-black text-emerald-50/70"><Database size={12}/>NEON-BACKED</div></div>
        <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(260px,.9fr)_1fr_1fr_1fr]">
          <label><span className="rh-label">Saved profiles</span><div className="relative mt-2"><select value={active.id} onChange={(event) => chooseProfile(event.target.value)} className="rh-input appearance-none pr-10"><option value="">New profile</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.companyName ? `${profile.companyName} · ` : ""}{profile.profileName}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-cyan-100/40"/></div></label>
          <Field label="Company / employer" value={active.companyName} onChange={(value) => mutateProfile({ companyName: value })} placeholder="V2X, CDOT, Fire District…"/>
          <Field label="Profile name" value={active.profileName} onChange={(value) => mutateProfile({ profileName: value })} placeholder="Redzikowo Firefighter"/>
          <Field label="Work location" value={active.location} onChange={(value) => mutateProfile({ location: value })} placeholder="Site, city, country…"/>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto_auto]"><Field label="Internal / client job title" value={active.jobTitle} onChange={(value) => mutateProfile({ jobTitle: value })} placeholder="Firefighter, HVAC Mechanic…"/><button type="button" onClick={() => { setActive(blankProfile()); setOnet(null); setQuery(""); setDirty(false); }} className="rh-action self-end !bg-white/[.035]"><Plus size={15} className="mr-2 inline"/>New profile</button><button type="button" onClick={() => void saveProfile()} disabled={saving || (!dirty && Boolean(active.id))} className="rh-action self-end">{saving ? <Loader2 size={15} className="mr-2 inline animate-spin"/> : <Save size={15} className="mr-2 inline"/>}{active.id ? "Save changes" : "Create profile"}</button></div>
        {active.id ? <div className="mt-3 flex justify-end"><button type="button" onClick={() => void deleteProfile()} className="text-[10px] font-black text-rose-100/55 hover:text-rose-50"><Trash2 size={12} className="mr-1 inline"/>Delete profile</button></div> : null}
        {loadingProfiles ? <p className="mt-3 text-xs text-cyan-100/45"><Loader2 size={12} className="mr-2 inline animate-spin"/>Loading saved profiles…</p> : null}
      </section>

      {legacyDuties.length ? <section className="rounded-2xl border border-amber-200/15 bg-amber-300/[.045] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[.18em] text-amber-100/60">Legacy browser data found</div><p className="mt-1 text-sm text-amber-50/75">{legacyDuties.length} duties from the old global localStorage bucket are available. Import them only into the profile they actually belong to.</p></div><button type="button" onClick={importLegacy} className="rounded-xl border border-amber-100/20 px-3 py-2 text-xs font-black text-amber-50/80">Import into this profile</button></div></section> : null}

      <section className="rh-primary-action"><div className="rh-kicker">02 · O*NET occupation evidence</div><h2 className="rh-section-title">Resolve the occupation, then inspect the evidence.</h2><p className="rh-section-copy">O*NET remains the official occupational source. Nothing below is converted into a medical conclusion or injury probability.</p><div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]"><div className="flex items-center gap-3 rounded-2xl border border-white/16 bg-black/20 px-4"><Search size={17} className="text-cyan-100/55"/><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void searchJob()} placeholder="Aircraft mechanic, firefighter, HVAC mechanic…" className="rh-input !border-0 !bg-transparent !px-0"/></div><button type="button" onClick={() => void searchJob()} disabled={loadingOnet || !query.trim()} className="rh-action">{loadingOnet ? <Loader2 size={16} className="mr-2 inline animate-spin"/> : <Search size={16} className="mr-2 inline"/>}Search O*NET</button></div>
        {onet?.matches && onet.matches.length > 1 ? <div className="mt-4"><div className="rh-label">Occupation candidates</div><div className="mt-2 flex flex-wrap gap-2">{onet.matches.slice(0, 8).map((match) => <button type="button" key={match.code} onClick={() => void searchJob(match.title)} className={`rounded-full border px-3 py-1.5 text-[10px] font-black ${match.code === active.onetCode ? "border-cyan-200/35 bg-cyan-300/[.10] text-cyan-50" : "border-white/10 text-cyan-100/55"}`}>{match.title} · {match.code}</button>)}</div></div> : null}
      </section>

      {error ? <div className="rounded-2xl border border-rose-200/18 bg-rose-300/[.05] p-4 text-sm text-rose-50/75">{error}</div> : null}

      {onet?.profile ? <section className="rh-hero"><div className="rh-hero-grid"><div className="rh-hero-main"><div className="flex items-start justify-between gap-4"><div><div className="rh-kicker">03 · Matched occupation</div><h2 className="rh-section-title">{onet.profile.occupation?.title}</h2><p className="rh-section-copy">{onet.profile.occupation?.description}</p></div><BriefcaseBusiness className="text-cyan-100/55"/></div><div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full border border-cyan-100/15 px-3 py-1.5 text-[10px] font-black text-cyan-50/70">O*NET {onet.profile.occupation?.code}</span>{typeof active.onetMatchScore === "number" ? <span className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-black text-cyan-100/50">Match score {active.onetMatchScore}</span> : null}<span className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-black text-cyan-100/50">Official source evidence</span></div></div><aside className="rh-hero-side"><div className="rh-kicker">Evidence inventory</div><div className="rh-metric-grid mt-5"><div className="rh-metric"><span>Tasks</span><strong>{onet.profile.tasks?.length || 0}</strong></div><div className="rh-metric"><span>Context</span><strong>{onet.profile.workContext?.length || 0}</strong></div><div className="rh-metric"><span>Abilities</span><strong>{onet.profile.abilities?.length || 0}</strong></div><div className="rh-metric"><span>Activities</span><strong>{(onet.profile.workActivities?.length || 0) + (onet.profile.detailedWorkActivities?.length || 0)}</strong></div></div></aside></div></section> : null}

      {onet?.profile ? <section className="rh-card is-full"><div className="flex flex-wrap items-end justify-between gap-4"><div><div className="rh-label">04 · Official evidence bank</div><h3 className="mt-2">Promote evidence into the reviewer workspace</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-cyan-100/45">The original O*NET value and response distribution stay attached to each promoted item. Structured demand fields are reviewer-confirmed separately.</p></div><span className="rounded-full border border-cyan-100/14 px-2.5 py-1 text-[9px] font-black text-cyan-100/60">{selectedEvidence.rows.length} records</span></div><div className="mt-5 flex flex-wrap gap-2">{EVIDENCE_TABS.map((tab) => <button type="button" key={tab.key} onClick={() => setEvidenceTab(tab.key)} className={`rounded-xl border px-3 py-2 text-[10px] font-black ${evidenceTab === tab.key ? "border-cyan-200/30 bg-cyan-300/[.09] text-cyan-50" : "border-white/10 text-cyan-100/45"}`}>{tab.label}</button>)}</div><div className="mt-4 grid gap-3 xl:grid-cols-2">{selectedEvidence.rows.slice(0, 60).map((row, index) => <EvidenceCard key={`${row.id || row.name}-${index}`} row={row} onAdd={() => addEvidence(row, selectedEvidence.kind)} alreadyAdded={active.duties.some((duty) => duty.sourceKind === selectedEvidence.kind && ((row.id && duty.sourceId === row.id) || duty.duty.toLowerCase() === row.name.toLowerCase()))}/>)}</div></section> : null}

      <section className="rh-support-grid">
        <div className="rh-card is-full"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="rh-label">05 · Structured demand profile</div><h3 className="mt-2">Reviewer-confirmed job demands</h3><p className="mt-2 max-w-4xl text-sm leading-6 text-cyan-100/45">This is the actual job model: essentiality, frequency, duration, lifting, posture, exposure, PPE, driving, heights, emergency response, shift work, equipment, and firearms. Empty means unknown — not zero.</p></div><span className="rounded-full border border-violet-200/14 bg-violet-300/[.05] px-3 py-1.5 text-[10px] font-black text-violet-50/70">{active.duties.length} duty records</span></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rh-metric"><span>Essential duties</span><strong>{summary.essential}</strong></div><div className="rh-metric"><span>Structured records</span><strong>{summary.structured}</strong></div><div className="rh-metric"><span>Safety / operational</span><strong>{summary.operational}</strong></div><div className="rh-metric"><span>Unstructured</span><strong>{Math.max(0, active.duties.length - summary.structured)}</strong></div></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{DOMAINS.map((domain) => <div key={domain} className="flex items-center justify-between rounded-xl border border-white/8 bg-black/15 px-3 py-2 text-xs"><span className="text-cyan-100/50">{domain}</span><strong>{summary.domainCounts[domain] || 0}</strong></div>)}</div>

          {active.duties.length ? <div className="mt-5 space-y-4">{active.duties.map((duty) => <article key={duty.id} className="rounded-3xl border border-white/10 bg-black/15 p-4 lg:p-5">
            <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><textarea value={duty.duty} onChange={(event) => mutateDuty(duty.id, { duty: event.target.value })} rows={2} className="w-full resize-none bg-transparent text-sm font-bold leading-6 outline-none"/><div className="mt-1 flex flex-wrap items-center gap-2 text-[9px] font-black"><span className={`rounded-full border px-2 py-1 ${duty.sourceKind === "reviewer" ? "border-amber-200/15 text-amber-100/60" : "border-emerald-200/15 text-emerald-100/60"}`}>{duty.sourceKind === "reviewer" ? "REVIEWER ENTERED" : "OFFICIAL O*NET"}</span><span className="text-cyan-100/35">{duty.sourceLabel}</span>{typeof duty.sourceValue === "number" ? <span className="text-cyan-100/35">value {duty.sourceValue}</span> : null}</div></div><button type="button" aria-label={`Remove ${duty.duty}`} onClick={() => mutateProfile({ duties: active.duties.filter((item) => item.id !== duty.id) })} className="rounded-xl border border-white/10 p-2 text-cyan-100/40 hover:text-rose-50"><Trash2 size={14}/></button></div>
            {duty.sourceResponse?.length ? <div className="mt-3 flex flex-wrap gap-2">{duty.sourceResponse.slice(0, 5).map((response, index) => <span key={`${response.description}-${index}`} className="rounded-full border border-white/8 px-2 py-1 text-[9px] text-cyan-100/45">{response.description || "Response"}{typeof response.percentage === "number" ? ` · ${response.percentage}%` : ""}</span>)}</div> : null}
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><label><span className="rh-label">Essentiality</span><select value={duty.essentiality} onChange={(event) => mutateDuty(duty.id, { essentiality: event.target.value as JobDuty["essentiality"] })} className="rh-input mt-2"><option value="unknown">Unknown</option><option value="essential">Essential</option><option value="supporting">Supporting / incidental</option></select></label><label><span className="rh-label">Frequency</span><select value={duty.frequency} onChange={(event) => mutateDuty(duty.id, { frequency: event.target.value as JobDuty["frequency"] })} className="rh-input mt-2"><option value="unknown">Unknown</option><option value="rare">Rare</option><option value="occasional">Occasional</option><option value="frequent">Frequent</option><option value="constant">Constant</option></select></label><label><span className="rh-label">Typical duration</span><input value={duty.duration} onChange={(event) => mutateDuty(duty.id, { duration: event.target.value })} placeholder="e.g. 2–4 hours / shift" className="rh-input mt-2"/></label><label><span className="rh-label">Max lift / carry (lb)</span><input type="number" min="0" value={duty.maxLiftLbs ?? ""} onChange={(event) => mutateDuty(duty.id, { maxLiftLbs: event.target.value === "" ? null : Math.max(0, Number(event.target.value) || 0) })} placeholder="Unknown" className="rh-input mt-2"/></label></div>
            <div className="mt-4 grid gap-4 xl:grid-cols-2"><div><div className="rh-label">Demand domains</div><div className="mt-2 flex flex-wrap gap-2">{DOMAINS.map((value) => <ToggleChip key={value} label={value} active={duty.domains.includes(value)} onClick={() => toggleDutyArray(duty.id, "domains", value)}/>)}</div></div><div><div className="rh-label">Postures / mobility</div><div className="mt-2 flex flex-wrap gap-2">{POSTURES.map((value) => <ToggleChip key={value} label={value} active={duty.postures.includes(value)} onClick={() => toggleDutyArray(duty.id, "postures", value)}/>)}</div></div><div><div className="rh-label">Environmental exposures</div><div className="mt-2 flex flex-wrap gap-2">{EXPOSURES.map((value) => <ToggleChip key={value} label={value} active={duty.exposures.includes(value)} onClick={() => toggleDutyArray(duty.id, "exposures", value)}/>)}</div></div><div><div className="rh-label">PPE</div><div className="mt-2 flex flex-wrap gap-2">{PPE.map((value) => <ToggleChip key={value} label={value} active={duty.ppe.includes(value)} onClick={() => toggleDutyArray(duty.id, "ppe", value)}/>)}</div></div></div>
            <div className="mt-4"><div className="rh-label">Operational / safety-sensitive requirements</div><div className="mt-2 flex flex-wrap gap-2"><ToggleChip label="Driving" active={duty.driving} onClick={() => mutateDuty(duty.id, { driving: !duty.driving })}/><ToggleChip label="Work at heights" active={duty.heights} onClick={() => mutateDuty(duty.id, { heights: !duty.heights })}/><ToggleChip label="Emergency response" active={duty.emergencyResponse} onClick={() => mutateDuty(duty.id, { emergencyResponse: !duty.emergencyResponse })}/><ToggleChip label="Shift / night work" active={duty.shiftWork} onClick={() => mutateDuty(duty.id, { shiftWork: !duty.shiftWork })}/><ToggleChip label="Heavy equipment" active={duty.heavyEquipment} onClick={() => mutateDuty(duty.id, { heavyEquipment: !duty.heavyEquipment })}/><ToggleChip label="Firearms" active={duty.firearms} onClick={() => mutateDuty(duty.id, { firearms: !duty.firearms })}/></div></div>
            <label className="mt-4 block"><span className="rh-label">Reviewer notes / source-specific clarification</span><textarea value={duty.reviewerNotes} onChange={(event) => mutateDuty(duty.id, { reviewerNotes: event.target.value })} rows={2} placeholder="Document source-specific frequency, weight, PPE, site conditions, client clarification…" className="mt-2 w-full rounded-2xl border border-white/12 bg-black/20 p-3 text-xs leading-5 outline-none placeholder:text-cyan-100/25 focus:border-cyan-100/28"/></label>
          </article>)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-white/12 p-6 text-center text-sm text-cyan-100/40">Add official O*NET evidence or paste the actual job description below. No global duty bucket is used anymore.</div>}
        </div>

        <div className="rh-card is-full"><div className="rh-label">06 · Paste actual job duties</div><h3 className="mt-2">Bring in the employer / client job description</h3><p className="mt-2 text-sm leading-6 text-cyan-100/45">Pasted duties are clearly marked as reviewer-entered evidence and start with all demand fields unknown until you structure them.</p><textarea value={paste} onChange={(event) => setPaste(event.target.value)} rows={7} placeholder="Paste bullets, duties, or job-description text…" className="mt-4 w-full rounded-2xl border border-white/14 bg-black/20 p-4 text-sm leading-6 outline-none placeholder:text-cyan-100/28 focus:border-cyan-100/30"/><button type="button" onClick={importPaste} disabled={!paste.trim()} className="rh-action mt-3"><Plus size={15} className="mr-2 inline"/>Add to this job profile</button></div>

        <div className="rh-card is-full"><div className="rh-label">07 · Profile notes</div><textarea value={active.notes} onChange={(event) => mutateProfile({ notes: event.target.value })} rows={4} placeholder="Job-level notes, source limitations, client clarifications, unresolved questions…" className="mt-3 w-full rounded-2xl border border-white/12 bg-black/20 p-4 text-sm leading-6 outline-none placeholder:text-cyan-100/25 focus:border-cyan-100/28"/></div>
        <div className="rh-card is-full is-quiet"><div className="rh-label">Interpretation boundary</div><p className="mt-2">O*NET evidence describes occupational tasks and demands. Reviewer-entered structure records the job information available to Occu-Med. Neither source independently establishes medical restrictions, causation, disability, compensability, or individual fitness.</p></div>
      </section>
    </div>
  </section></main>;
}
