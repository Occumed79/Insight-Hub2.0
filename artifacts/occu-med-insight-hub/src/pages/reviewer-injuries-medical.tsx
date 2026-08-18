import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  Database,
  Loader2,
  Radar,
  Search,
  Stethoscope,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { ReviewerInjuryHologram } from "./reviewer-injury-hologram";

async function loadJson(url: string): Promise<any> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status}).`);
  return payload;
}

function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <GlassCard variant="glass" className={`border border-white/24 bg-white/[0.065] p-[1px] shadow-[0_24px_72px_rgba(0,0,0,.28),0_0_34px_rgba(186,230,253,.07)] backdrop-blur-3xl ${className}`}>
      <div className="h-full rounded-[27px] border border-white/[0.14] bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.17)] md:p-6">{children}</div>
    </GlassCard>
  );
}

function StatusPill({ children }: { children: ReactNode }) {
  return <span className="inline-flex min-h-7 items-center rounded-full border border-cyan-200/20 bg-cyan-300/[0.07] px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-50/78">{children}</span>;
}
function Loading({ text = "Loading source data…" }: { text?: string }) {
  return <div className="flex min-h-28 items-center justify-center gap-3 text-sm text-cyan-100/55"><Loader2 size={18} className="animate-spin" />{text}</div>;
}
function ErrorState({ error }: { error: string }) {
  return <div className="rounded-2xl border border-rose-200/16 bg-rose-300/[0.05] p-4 text-sm text-rose-50/75"><AlertTriangle size={16} className="mr-2 inline" />{error}</div>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/12 bg-white/[0.025] p-4"><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-100/42">{label}</p><strong className="mt-2 block text-2xl font-black">{value}</strong></div>;
}
function ListBlock({ title, items }: { title: string; items: string[] }) {
  return <div className="rounded-2xl border border-white/12 bg-white/[0.025] p-4"><h3 className="text-sm font-black">{title}</h3><div className="mt-3 space-y-2">{items.map((item) => <div key={item} className="flex gap-2 text-xs leading-5 text-cyan-100/58"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-cyan-100/52" />{item}</div>)}</div></div>;
}

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

export default function ReviewerInjuriesMedicalPage() {
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
    try {
      setOnet(await loadJson(`/api/occupational-discovery/onet/profile?keyword=${encodeURIComponent(occupation.trim())}`));
    } catch (error) {
      setOnet({ error: error instanceof Error ? error.message : "O*NET request failed." });
    } finally {
      setOnetLoading(false);
    }
  }

  const profile = onet?.profile ?? null;
  const condition = CONDITIONS.find((item) => item.id === conditionId) ?? CONDITIONS[0];

  return (
    <main className="aurora-bg min-h-screen pb-24 text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 pt-24 lg:ml-[210px] lg:px-12 lg:pt-8">
        <HeaderBar eyebrow="Clinical / Occupational Health Intelligence" title="Injuries & Medical Conditions" subtitle="Occupation-linked injury surveillance, the original holographic anatomy projection, and condition-specific reviewer context in the native Insight Hub 2 workspace." />

        <div className="mb-6 flex gap-2 overflow-x-auto pb-1" role="tablist">
          {[
            { id: "injury", label: "Injury Intelligence" },
            { id: "conditions", label: "Medical Conditions" },
          ].map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id as typeof tab)} className={`min-h-11 whitespace-nowrap rounded-2xl border px-4 text-xs font-bold backdrop-blur-xl transition ${tab === item.id ? "border-cyan-100/38 bg-cyan-300/[0.13] text-white shadow-[0_0_24px_rgba(34,211,238,.10),inset_0_1px_0_rgba(255,255,255,.20)]" : "border-white/16 bg-white/[0.035] text-cyan-100/58 hover:border-cyan-100/28 hover:text-white"}`}>{item.label}</button>
          ))}
        </div>

        {tab === "injury" ? (
          <div className="space-y-6">
            <Surface>
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <label>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/52">Occupation</span>
                  <div className="mt-2 flex min-h-12 items-center gap-3 rounded-2xl border border-white/20 bg-white/[0.045] px-4"><Search size={16} className="text-cyan-100/50" /><input value={occupation} onChange={(event) => setOccupation(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void runOccupation()} placeholder="Firefighter, electrician, truck driver…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-cyan-100/30" /></div>
                </label>
                <button type="button" onClick={() => void runOccupation()} disabled={onetLoading || !occupation.trim()} className="min-h-12 rounded-2xl border border-cyan-100/24 bg-cyan-300/[0.10] px-5 text-sm font-black disabled:opacity-40">{onetLoading ? <Loader2 size={16} className="mr-2 inline animate-spin" /> : <Radar size={16} className="mr-2 inline" />}Build occupation profile</button>
              </div>
            </Surface>

            <ReviewerInjuryHologram profile={profile} />

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
      </section>
    </main>
  );
}
